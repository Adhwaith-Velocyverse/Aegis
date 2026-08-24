import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import bcrypt from 'bcryptjs';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { z } from 'zod';
import { notifyAssessorAssigned } from '../services/notifications';
import { auditLog } from '../middleware/audit';

const router = express.Router();

// All admin routes require admin role
router.use(authenticate, authorize('admin'));

// Validation schemas
const assignAssessorSchema = z.object({
  assessorId: z.string().uuid(),
});

const addAssessorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  platformRole: z.enum(['client', 'admin', 'assessor']).default('client'),
  orgRole: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
  phoneNumber: z.string().optional(),
  organizationId: z.string().uuid().optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  platformRole: z.enum(['client', 'admin', 'assessor']).optional(),
  orgRole: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
  phoneNumber: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  emailVerified: z.boolean().optional(),
  mfaEnabled: z.boolean().optional(),
});

// Get dashboard stats
router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const activeRequests = await query(
      `SELECT COUNT(*) as count FROM detailed_assessment_requests WHERE status IN ('unassigned', 'assigned', 'in_review', 'awaiting_client')`
    );
    const assessors = await query('SELECT COUNT(*) as count FROM assessors WHERE status = ?', ['active']);
    const recentRequests = await query(
      `SELECT dar.*, a.type, u.full_name as client_name, tc.tenant_name FROM detailed_assessment_requests dar
       JOIN assessments a ON dar.assessment_id = a.id
       JOIN users u ON a.organization_id = u.organization_id
       LEFT JOIN tenant_connections tc ON a.tenant_connection_id = tc.id
       ORDER BY dar.requested_on DESC LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        activeRequests: (activeRequests[0] as any).count,
        assessors: (assessors[0] as any).count,
        recentRequests,
      },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// Get all detailed assessment requests
router.get('/requests', async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND dar.status = ?';
      params.push(status);
    }

    const requests = await query(
      `SELECT dar.*, a.type, a.overall_score, u.full_name as client_name, u.email as client_email,
              tc.tenant_name, ass.name as assessor_name
       FROM detailed_assessment_requests dar
       JOIN assessments a ON dar.assessment_id = a.id
       JOIN users u ON a.organization_id = u.organization_id AND u.platform_role = 'client'
       LEFT JOIN tenant_connections tc ON a.tenant_connection_id = tc.id
       LEFT JOIN assessors ass ON dar.assigned_assessor_id = ass.user_id
       ${whereClause}
       ORDER BY dar.requested_on DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalResult = await query(`SELECT COUNT(*) as total FROM detailed_assessment_requests dar ${whereClause}`, params);
    const total = (totalResult[0] as any).total;

    res.json({
      success: true,
      data: requests,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
});

// Assign assessor to request
router.post('/requests/:id/assign', async (req: AuthRequest, res) => {
  try {
    const data = assignAssessorSchema.parse(req.body);

    await query(
      'UPDATE detailed_assessment_requests SET assigned_assessor_id = ?, status = ?, assigned_on = NOW() WHERE id = ?',
      [data.assessorId, 'assigned', req.params.id]
    );

    // Get assessment and client info for notification
    const request = await query(
      `SELECT a.organization_id, u.full_name as client_name FROM detailed_assessment_requests dar
       JOIN assessments a ON dar.assessment_id = a.id
       JOIN users u ON a.organization_id = u.organization_id AND u.platform_role = 'client'
       WHERE dar.id = ?`,
      [req.params.id]
    );

    if (request.length > 0) {
      await notifyAssessorAssigned(data.assessorId, req.params.id, (request[0] as any).client_name);
    }

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'assessor_assigned',
      resource: 'detailed_assessment_request',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        assigned_assessor_id: data.assessorId,
        request_id: req.params.id,
      },
      status: 'success',
    });

    res.json({ success: true, message: 'Assessor assigned' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Assign assessor error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign assessor' });
  }
});

// Get assessors
router.get('/assessors', async (req: AuthRequest, res) => {
  try {
    const assessors = await query(
      'SELECT a.*, u.email FROM assessors a JOIN users u ON a.user_id = u.id ORDER BY a.added_on DESC'
    );
    res.json({ success: true, data: assessors });
  } catch (error) {
    console.error('Get assessors error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assessors' });
  }
});

// Add assessor
router.post('/assessors', async (req: AuthRequest, res) => {
  try {
    const { name, email, phone } = addAssessorSchema.parse(req.body);

    // Check if user exists
    const existingUsers = await query('SELECT id FROM users WHERE email = ?', [email]);
    let userId: string;

    if (existingUsers.length > 0) {
      userId = (existingUsers[0] as any).id;
      await query('UPDATE users SET platform_role = ? WHERE id = ?', ['assessor', userId]);
    } else {
      userId = uuidv4();
      const passwordHash = await bcrypt.hash(uuidv4(), 12);
      await query(
        'INSERT INTO users (id, email, password_hash, full_name, platform_role, email_verified) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, email, passwordHash, name, 'assessor', true]
      );
    }

    const assessorId = uuidv4();
    await query(
      'INSERT INTO assessors (id, user_id, name, email, phone) VALUES (?, ?, ?, ?, ?)',
      [assessorId, userId, name, email, phone]
    );

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'assessor_added',
      resource: 'assessor',
      resourceId: assessorId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        assessor_name: name,
        assessor_email: email,
        user_id: userId,
      },
      status: 'success',
    });

    res.status(201).json({ success: true, data: { id: assessorId, name, email, phone } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Add assessor error:', error);
    res.status(500).json({ success: false, error: 'Failed to add assessor' });
  }
});

// Remove assessor
router.delete('/assessors/:id', async (req: AuthRequest, res) => {
  try {
    const assessors = await query('SELECT user_id FROM assessors WHERE id = ?', [req.params.id]);
    if (assessors.length > 0) {
      await query('UPDATE users SET platform_role = ? WHERE id = ?', ['client', (assessors[0] as any).user_id]);
      await query('DELETE FROM assessors WHERE id = ?', [req.params.id]);
    }

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'assessor_removed',
      resource: 'assessor',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        assessor_id: req.params.id,
      },
      status: 'success',
    });

    res.json({ success: true, message: 'Assessor removed' });
  } catch (error) {
    console.error('Remove assessor error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove assessor' });
  }
});

// Get all organizations
router.get('/organizations', async (req: AuthRequest, res) => {
  try {
    const organizations = await query(
      `SELECT o.*, COUNT(u.id) as member_count FROM organizations o
       LEFT JOIN users u ON o.id = u.organization_id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );
    res.json({ success: true, data: organizations });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch organizations' });
  }
});

// Get all subscriptions
router.get('/subscriptions', async (req: AuthRequest, res) => {
  try {
    const subscriptions = await query(
      `SELECT s.*, sp.name as plan_name, sp.included_quick_credits, sp.included_detailed_credits,
              o.name as organization_name
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       JOIN organizations o ON s.organization_id = o.id
       ORDER BY s.created_at DESC`
    );
    res.json({ success: true, data: subscriptions });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

// Get all users
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, search, role, orgRole } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      whereClause += ' AND u.platform_role = ?';
      params.push(role);
    }

    if (orgRole) {
      whereClause += ' AND u.org_role = ?';
      params.push(orgRole);
    }

    const users = await query(
      `SELECT u.*, o.name as organization_name FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       ${whereClause}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
       [...params, parseInt(limit), offset]
    );

    const totalResult = await query(`SELECT COUNT(*) as total FROM users u ${whereClause}`, params);
    const total = (totalResult[0] as any).total;

    res.json({
      success: true,
      data: users,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Create new user
router.post('/users', async (req: AuthRequest, res) => {
  try {
    const { fullName, email, password, platformRole, orgRole, phoneNumber, organizationId } = createUserSchema.parse(req.body);

    // Check if user already exists
    const existingUsers = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await query(
      'INSERT INTO users (id, email, password_hash, full_name, phone_number, platform_role, org_role, organization_id, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, email, passwordHash, fullName, phoneNumber || null, platformRole, orgRole || 'member', organizationId || null, true]
    );

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'user_created',
      resource: 'user',
      resourceId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        user_email: email,
        user_name: fullName,
        platform_role: platformRole,
        org_role: orgRole,
      },
      status: 'success',
    });

    res.status(201).json({
      success: true,
      data: {
        id: userId,
        fullName,
        email,
        platformRole,
        orgRole: orgRole || 'member',
        phoneNumber,
        organizationId,
        emailVerified: true,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// Update user
router.put('/users/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = updateUserSchema.parse(req.body);

    // Check if user exists
    const existingUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.fullName !== undefined) {
      updateFields.push('full_name = ?');
      updateValues.push(updates.fullName);
    }
    if (updates.email !== undefined) {
      // Check if email is already taken by another user
      const emailCheck = await query('SELECT id FROM users WHERE email = ? AND id != ?', [updates.email, id]);
      if (emailCheck.length > 0) {
        return res.status(400).json({ success: false, error: 'Email already in use by another user' });
      }
      updateFields.push('email = ?');
      updateValues.push(updates.email);
    }
    if (updates.platformRole !== undefined) {
      updateFields.push('platform_role = ?');
      updateValues.push(updates.platformRole);
    }
    if (updates.orgRole !== undefined) {
      updateFields.push('org_role = ?');
      updateValues.push(updates.orgRole);
    }
    if (updates.phoneNumber !== undefined) {
      updateFields.push('phone_number = ?');
      updateValues.push(updates.phoneNumber);
    }
    if (updates.organizationId !== undefined) {
      updateFields.push('organization_id = ?');
      updateValues.push(updates.organizationId);
    }
    if (updates.emailVerified !== undefined) {
      updateFields.push('email_verified = ?');
      updateValues.push(updates.emailVerified);
    }
    if (updates.mfaEnabled !== undefined) {
      updateFields.push('mfa_enabled = ?');
      updateValues.push(updates.mfaEnabled);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updateValues.push(id);
    await query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'user_updated',
      resource: 'user',
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        updated_fields: Object.keys(updates),
      },
      status: 'success',
    });

    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// Delete user (soft delete)
router.delete('/users/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user!.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const existingUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await query('UPDATE users SET deleted_at = NOW(), deletion_reason = ? WHERE id = ?', ['Deleted by admin', id]);

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'user_deleted',
      resource: 'user',
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        deleted_user_email: (existingUsers[0] as any).email,
      },
      status: 'success',
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// Get released reports
router.get('/reports', async (req: AuthRequest, res) => {
  try {
    const reports = await query(
      `SELECT r.*, a.type, u.full_name as client_name FROM reports r
       JOIN assessments a ON r.assessment_id = a.id
       JOIN users u ON a.organization_id = u.organization_id
       WHERE a.type = 'detailed'
       ORDER BY r.created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: reports });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

export default router;
