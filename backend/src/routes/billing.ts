import express from 'express';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { auditLog } from '../middleware/audit';

const router = express.Router();

// Initialize Stripe only if secret key is configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Validation schemas
const upgradeSchema = z.object({
  planId: z.string().uuid(),
});

// Stripe webhook endpoint (no auth required - verified via signature)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.warn('Stripe not configured - webhook received but not processed');
      return res.status(400).json({ success: false, error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ success: false, error: 'Webhook signature verification failed' });
    }

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        
        // Update subscription billing status
        await query(
          "UPDATE subscriptions SET billing_status = 'active', updated_at = NOW() WHERE stripe_subscription_id = ?",
          [subscriptionId]
        );
        
        // Record payment in usage ledger
        const subs = await query(
          'SELECT id, organization_id FROM subscriptions WHERE stripe_subscription_id = ?',
          [subscriptionId]
        );
        
        if (subs.length > 0) {
          const sub = subs[0] as any;
          await query(
            'INSERT INTO usage_ledger (id, organization_id, subscription_id, type, amount, description) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), sub.organization_id, sub.id, 'credit_grant', invoice.amount_paid || 0, `Payment succeeded for invoice ${invoice.id}`]
          );
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        
        await query(
          "UPDATE subscriptions SET billing_status = 'past_due', updated_at = NOW() WHERE stripe_subscription_id = ?",
          [subscriptionId]
        );
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status === 'active' ? 'active' :
                       subscription.status === 'past_due' ? 'past_due' :
                       subscription.status === 'canceled' ? 'canceled' : 'active';
        
        const periodStart = (subscription as any).current_period_start;
        const periodEnd = (subscription as any).current_period_end;
        
        await query(
          "UPDATE subscriptions SET billing_status = ?, current_period_start = ?, current_period_end = ?, updated_at = NOW() WHERE stripe_subscription_id = ?",
          [status, periodStart ? new Date(periodStart * 1000) : null, periodEnd ? new Date(periodEnd * 1000) : null, subscription.id]
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await query(
          "UPDATE subscriptions SET billing_status = 'canceled', updated_at = NOW() WHERE stripe_subscription_id = ?",
          [subscription.id]
        );
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ success: false, error: 'Webhook handler failed' });
  }
});

// Get current subscription
router.get('/subscription', authenticate, async (req: AuthRequest, res) => {
  try {
    const subscriptions = await query(
      `SELECT s.*, sp.name as plan_name, sp.price_monthly, sp.features, sp.included_tenant_slots,
              sp.included_quick_credits, sp.included_detailed_credits, sp.seat_limit
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.organization_id = ? AND s.billing_status = 'active'
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.user!.organizationId!]
    );

    if (subscriptions.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: subscriptions[0] });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

// Get all available plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await query(
      'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price_monthly ASC'
    );
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

// Get usage ledger
router.get('/usage', authenticate, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20 } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const limitVal = parseInt(limit);
    const usage = await query(
      `SELECT ul.*, sp.name as plan_name
       FROM usage_ledger ul
       JOIN subscriptions s ON ul.subscription_id = s.id
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE ul.organization_id = ?
       ORDER BY ul.created_at DESC LIMIT ${limitVal} OFFSET ${offset}`,
      [req.user!.organizationId!]
    );

    const totalResult = await query(
      'SELECT COUNT(*) as total FROM usage_ledger WHERE organization_id = ?',
      [req.user!.organizationId!]
    );
    const total = (totalResult[0] as any).total;

    res.json({
      success: true,
      data: usage,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch usage' });
  }
});

// Create Stripe checkout session
router.post('/checkout', authenticate, async (req: AuthRequest, res) => {
  try {
    const { planId } = req.body as { planId: string };

    // Validate plan exists
    const plans = await query('SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1', [planId]);
    if (plans.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const plan = plans[0] as any;

    // Free plans don't need Stripe checkout
    if (plan.price_monthly === 0) {
      // Directly assign the free plan
      const existingSubs = await query(
        'SELECT id FROM subscriptions WHERE organization_id = ? AND billing_status = ?',
        [req.user!.organizationId!, 'active']
      );

      if (existingSubs.length > 0) {
        await query(
          'UPDATE subscriptions SET plan_id = ?, updated_at = NOW() WHERE id = ?',
          [planId, existingSubs[0].id]
        );
      } else {
        await query(
          'INSERT INTO subscriptions (id, organization_id, plan_id, billing_status, current_period_start, current_period_end) VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH))',
          [uuidv4(), req.user!.organizationId!, planId, 'active']
        );
      }

      await auditLog({
        userId: req.user!.id,
        orgId: req.user!.organizationId,
        action: 'subscription_plan_changed',
        resource: 'subscription',
        resourceId: existingSubs.length > 0 ? existingSubs[0].id : 'new',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          plan_id: planId,
          plan_name: plan.name,
        },
        status: 'success',
      });

      return res.json({ success: true, data: { url: `${APP_URL}/billing?success=true` } });
    }

    if (!stripe) {
      return res.status(500).json({ success: false, error: 'Stripe not configured' });
    }

    // Get or create Stripe customer
    let customerId: string;
    const existingSubs = await query(
      'SELECT stripe_customer_id FROM subscriptions WHERE organization_id = ? AND stripe_customer_id IS NOT NULL LIMIT 1',
      [req.user!.organizationId!]
    );

    if (existingSubs.length > 0 && (existingSubs[0] as any).stripe_customer_id) {
      customerId = (existingSubs[0] as any).stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        metadata: {
          organization_id: req.user!.organizationId!,
        },
      });
      customerId = customer.id;
    }

    // Create Stripe checkout session
    const priceId = plan.stripe_price_id || process.env.STRIPE_PRICE_ID_PROFESSIONAL;
    
    if (!priceId) {
      return res.status(500).json({ success: false, error: 'Stripe price ID not configured for this plan' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/billing?canceled=true`,
      metadata: {
        organization_id: req.user!.organizationId!,
        plan_id: planId,
      },
    });

    res.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

// Cancel subscription
router.post('/cancel', authenticate, async (req: AuthRequest, res) => {
  try {
    const subscriptions = await query(
      'SELECT * FROM subscriptions WHERE organization_id = ? AND billing_status = ?',
      [req.user!.organizationId!, 'active']
    );

    if (subscriptions.length === 0) {
      return res.status(404).json({ success: false, error: 'No active subscription found' });
    }

    const sub = subscriptions[0] as any;

    // Cancel in Stripe if we have a subscription ID
    if (sub.stripe_subscription_id && stripe) {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    }

    await query(
      "UPDATE subscriptions SET billing_status = 'canceled', updated_at = NOW() WHERE id = ?",
      [sub.id]
    );

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'subscription_canceled',
      resource: 'subscription',
      resourceId: sub.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        stripe_subscription_id: sub.stripe_subscription_id,
      },
      status: 'success',
    });

    res.json({ success: true, message: 'Subscription canceled successfully' });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

// Get billing history
router.get('/history', authenticate, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20 } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const limitVal = parseInt(limit);
    const history = await query(
      `SELECT ul.*, sp.name as plan_name
       FROM usage_ledger ul
       JOIN subscriptions s ON ul.subscription_id = s.id
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE ul.organization_id = ? AND ul.type IN ('credit_grant', 'credit_consumption')
       ORDER BY ul.created_at DESC LIMIT ${limitVal} OFFSET ${offset}`,
      [req.user!.organizationId!]
    );

    const totalResult = await query(
      'SELECT COUNT(*) as total FROM usage_ledger WHERE organization_id = ? AND type IN (?, ?)',
      [req.user!.organizationId!, 'credit_grant', 'credit_consumption']
    );
    const total = (totalResult[0] as any).total;

    res.json({
      success: true,
      data: history,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get billing history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch billing history' });
  }
});

// Generate invoice PDF
router.get('/invoices/:id/pdf', authenticate, async (req: AuthRequest, res) => {
  try {
    const invoiceId = req.params.id;

    // Get invoice data
    const invoices = await query(
      `SELECT ul.*, sp.name as plan_name, sp.price_monthly
       FROM usage_ledger ul
       JOIN subscriptions s ON ul.subscription_id = s.id
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE ul.id = ? AND ul.organization_id = ?`,
      [invoiceId, req.user!.organizationId!]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const invoice = invoices[0] as any;

    res.json({
      success: true,
      data: {
        invoice,
        pdfUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/billing/invoices/${invoiceId}/download`,
      },
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoice' });
  }
});

export default router;
