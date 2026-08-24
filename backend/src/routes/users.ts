import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Validation schemas
const deleteAccountSchema = z.object({
  password: z.string().optional(),
  reason: z.string().max(500).optional(),
});

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const users = await query('SELECT id, email, full_name, phone_number, platform_role, org_role, organization_id, email_verified, mfa_enabled, deleted_at, created_at FROM users WHERE id = ?', [req.user!.id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// Update profile
router.put('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      fullName: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().email().optional(),
    });
    const data = schema.parse(req.body);

    const updates: string[] = [];
    const params: any[] = [];

    if (data.fullName) {
      updates.push('full_name = ?');
      params.push(data.fullName);
    }
    if (data.phoneNumber) {
      updates.push('phone_number = ?');
      params.push(data.phoneNumber);
    }
    if (data.email) {
      // Check if email is already taken by another user
      const existing = await query('SELECT id FROM users WHERE email = ? AND id != ?', [data.email, req.user!.id]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, error: 'Email is already in use' });
      }
      updates.push('email = ?');
      params.push(data.email);
      updates.push('email_verified = ?');
      params.push(false); // Require re-verification
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    params.push(req.user!.id);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// Change password
router.put('/me/password', authenticate, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    });
    const { currentPassword, newPassword } = schema.parse(req.body);

    const users = await query('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    const user = users[0] as { password_hash: string };

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.user!.id]);

    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

// Delete account (soft-delete with 30-day grace period)
router.delete('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = deleteAccountSchema.parse(req.body);
    const { password, reason } = data;

    // Verify password if provided
    if (password) {
      const users = await query('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
      const user = users[0] as { password_hash: string };
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(400).json({ success: false, error: 'Invalid password' });
      }
    }

    // Check if user is the only owner of the organization
    const orgOwners = await query(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND org_role = ?',
      [req.user!.organizationId, 'owner']
    );
    const ownerCount = (orgOwners[0] as any).count;

    if (req.user!.orgRole === 'owner' && ownerCount <= 1) {
      return res.status(400).json({
        success: false,
        error: 'You are the only owner of this organization. Please transfer ownership or delete the organization first.',
      });
    }

    // Soft delete: set deletion scheduled date
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30-day grace period

    await query(
      'UPDATE users SET deleted_at = ?, deletion_reason = ? WHERE id = ?',
      [deletionDate, reason || null, req.user!.id]
    );

    // Log the deletion request
    await query(
      'INSERT INTO audit_logs (id, user_id, org_id, action, resource, resource_id, details, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.user!.id, req.user!.organizationId, 'account_deletion_requested', 'user', req.user!.id, JSON.stringify({ reason, deletionDate }), 'success']
    );

    res.json({
      success: true,
      message: 'Account deletion scheduled. You have 30 days to cancel this request.',
      data: {
        deletionDate,
        gracePeriodDays: 30,
      },
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, error: 'Failed to schedule account deletion' });
  }
});

// Cancel account deletion
router.post('/me/cancel-deletion', authenticate, async (req: AuthRequest, res) => {
  try {
    await query(
      'UPDATE users SET deleted_at = NULL, deletion_reason = NULL WHERE id = ?',
      [req.user!.id]
    );

    // Log the cancellation
    await query(
      'INSERT INTO audit_logs (id, user_id, org_id, action, resource, resource_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.user!.id, req.user!.organizationId, 'account_deletion_cancelled', 'user', req.user!.id, 'success']
    );

    res.json({
      success: true,
      message: 'Account deletion cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel deletion error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel account deletion' });
  }
});

export default router;
