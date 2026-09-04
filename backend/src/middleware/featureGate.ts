import express from 'express';
import { AuthRequest } from './auth';
import { query } from '../db/connection';
import { z } from 'zod';

export interface PlanFeatures {
  canRunQuick: boolean;
  canRunDetailed: boolean;
  canDownloadPdf: boolean;
  canDownloadExcel: boolean;
  canShareReport: boolean;
  canViewHistory: boolean;
  canConnectTenants: boolean;
  maxTenants: number;
  includedQuickCredits: number;
  includedDetailedCredits: number;
  seatLimit: number;
  reportRetentionDays: number;
  hasScheduledReassessment: boolean;
  hasTrendView: boolean;
  hasMspDashboard: boolean;
  hasApiAccess: boolean;
  hasPrioritySla: boolean;
  hasWhiteLabel: boolean;
  hasSsoScim: boolean;
  hasContinuousMonitoring: boolean;
  complianceFrameworks: string[];
}

export async function getPlanFeatures(organizationId: string): Promise<PlanFeatures> {
  const subscriptions = await query(
    `SELECT s.*, sp.name as plan_name, sp.features, sp.included_tenant_slots,
            sp.included_quick_credits, sp.included_detailed_credits, sp.seat_limit
     FROM subscriptions s
     JOIN subscription_plans sp ON s.plan_id = sp.id
     WHERE s.organization_id = ? AND s.billing_status = 'active'
     ORDER BY s.created_at DESC LIMIT 1`,
    [organizationId]
  );

  if (subscriptions.length === 0) {
    // Default to Free plan features
    return getFreePlanFeatures();
  }

  const sub = subscriptions[0] as any;
  const features = typeof sub.features === 'string' ? JSON.parse(sub.features) : (sub.features || {});

  return {
    canRunQuick: true,
    canRunDetailed: true,
    canDownloadPdf: true,
    canDownloadExcel: sub.plan_name !== 'Free',
    canShareReport: sub.plan_name !== 'Free',
    canViewHistory: sub.plan_name !== 'Free',
    canConnectTenants: sub.plan_name !== 'Free',
    maxTenants: sub.included_tenant_slots || 0,
    includedQuickCredits: sub.included_quick_credits || 0,
    includedDetailedCredits: sub.included_detailed_credits || 0,
    seatLimit: sub.seat_limit || 1,
    reportRetentionDays: sub.plan_name === 'Free' ? 0 : sub.plan_name === 'Starter (PAYG)' ? 30 : sub.plan_name === 'Professional' ? 90 : 90,
    hasScheduledReassessment: ['Professional', 'Business/MSP', 'Enterprise'].includes(sub.plan_name),
    hasTrendView: ['Professional', 'Business/MSP', 'Enterprise'].includes(sub.plan_name),
    hasMspDashboard: ['Business/MSP', 'Enterprise'].includes(sub.plan_name),
    hasApiAccess: ['Business/MSP', 'Enterprise'].includes(sub.plan_name),
    hasPrioritySla: ['Business/MSP', 'Enterprise'].includes(sub.plan_name),
    hasWhiteLabel: ['Business/MSP', 'Enterprise'].includes(sub.plan_name),
    hasSsoScim: sub.plan_name === 'Enterprise',
    hasContinuousMonitoring: sub.plan_name === 'Enterprise',
    complianceFrameworks: features.compliance_frameworks || ['CIS'],
  };
}

function getFreePlanFeatures(): PlanFeatures {
  return {
    canRunQuick: true,
    canRunDetailed: true,
    canDownloadPdf: true,
    canDownloadExcel: false,
    canShareReport: false,
    canViewHistory: false,
    canConnectTenants: false,
    maxTenants: 0,
    includedQuickCredits: 0,
    includedDetailedCredits: 0,
    seatLimit: 1,
    reportRetentionDays: 0,
    hasScheduledReassessment: false,
    hasTrendView: false,
    hasMspDashboard: false,
    hasApiAccess: false,
    hasPrioritySla: false,
    hasWhiteLabel: false,
    hasSsoScim: false,
    hasContinuousMonitoring: false,
    complianceFrameworks: ['CIS'],
  };
}

// Middleware to check if user can run a specific assessment type
export function canRunAssessment(assessmentType: 'quick' | 'detailed') {
  return async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const features = await getPlanFeatures(req.user.organizationId);
      
      if (assessmentType === 'quick' && !features.canRunQuick) {
        return res.status(403).json({ 
          success: false, 
          error: 'Quick Assessment requires a paid plan. Please upgrade to continue.',
          upgradeRequired: true 
        });
      }
      
      if (assessmentType === 'detailed' && !features.canRunDetailed) {
        return res.status(403).json({ 
          success: false, 
          error: 'Detailed Assessment requires a Professional plan or higher. Please upgrade to continue.',
          upgradeRequired: true 
        });
      }

      // Check tenant connection
      const tenantConnectionId = req.body.tenantConnectionId || req.query.tenantConnectionId;
      if (tenantConnectionId) {
        const connections = await query(
          'SELECT COUNT(*) as count FROM tenant_connections WHERE id = ? AND organization_id = ?',
          [tenantConnectionId, req.user.organizationId]
        );
        if ((connections[0] as any).count === 0) {
          return res.status(404).json({ success: false, error: 'Tenant connection not found' });
        }
      }

      next();
    } catch (error) {
      console.error('Feature gate error:', error);
      res.status(500).json({ success: false, error: 'Failed to verify plan features' });
    }
  };
}

// Middleware to check if user can download reports
export function canDownloadReports(format: 'pdf' | 'excel') {
  return async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const features = await getPlanFeatures(req.user.organizationId);
      
      if (format === 'excel' && !features.canDownloadExcel) {
        return res.status(403).json({ 
          success: false, 
          error: 'Excel reports require a paid plan. Please upgrade to continue.',
          upgradeRequired: true 
        });
      }

      next();
    } catch (error) {
      console.error('Feature gate error:', error);
      res.status(500).json({ success: false, error: 'Failed to verify plan features' });
    }
  };
}

// Middleware to check if user can connect tenants
export function canConnectTenants() {
  return async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const features = await getPlanFeatures(req.user.organizationId);
      
      if (!features.canConnectTenants) {
        return res.status(403).json({ 
          success: false, 
          error: 'Tenant connection requires a paid plan. Please upgrade to continue.',
          upgradeRequired: true 
        });
      }

      // Check tenant slot limit
      const { tenantId } = req.body;
      if (tenantId) {
        const existingConnections = await query(
          'SELECT COUNT(*) as count FROM tenant_connections WHERE organization_id = ?',
          [req.user.organizationId]
        );
        const currentCount = (existingConnections[0] as any).count;
        
        if (currentCount >= features.maxTenants) {
          return res.status(403).json({ 
            success: false, 
            error: `You have reached the maximum of ${features.maxTenants} tenant(s) for your plan. Please upgrade or add more tenant slots.`,
            upgradeRequired: true,
            currentTenants: currentCount,
            maxTenants: features.maxTenants
          });
        }
      }

      next();
    } catch (error) {
      console.error('Feature gate error:', error);
      res.status(500).json({ success: false, error: 'Failed to verify plan features' });
    }
  };
}

