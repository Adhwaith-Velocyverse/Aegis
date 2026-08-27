import { Router } from 'express';
import { query } from '../db/connection';
import { requireOrgRole, OrgAuthRequest, requireOrgOwner } from '../middleware/orgRole';
import { z } from 'zod';

const router = Router();

// Validation schemas
const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.string().min(1),
  orgRole: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
});

const updateMemberRoleSchema = z.object({
  orgRole: z.enum(['owner', 'admin', 'member', 'viewer']),
});

// Get current organization details
router.get('/current', requireOrgRole(['owner', 'admin', 'member', 'viewer']), async (req: OrgAuthRequest, res) => {
  try {
    const orgs = await query<any[]>(
      'SELECT id, name, industry, company_size, created_at FROM organizations WHERE id = ?',
      [req.orgUser!.orgId]
    );

    const org = orgs[0];
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get member count
    const memberCountResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE org_id = ?',
      [req.orgUser!.orgId]
    ) as { count: number }[];

    res.json({
      ...org,
      memberCount: memberCountResult[0]?.count || 0
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Update organization details
router.put('/current', requireOrgRole(['owner', 'admin']), async (req: OrgAuthRequest, res) => {
  try {
    const data = updateOrgSchema.parse(req.body);
    const { name, industry, companySize } = data;

    await query(
      'UPDATE organizations SET name = ?, industry = ?, company_size = ? WHERE id = ?',
      [name, industry, companySize, req.orgUser!.orgId]
    );

    res.json({ message: 'Organization updated successfully' });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Get organization members
router.get('/members', requireOrgRole(['owner', 'admin', 'member', 'viewer']), async (req: OrgAuthRequest, res) => {
  try {
    const members = await query<any[]>(
      `SELECT id, email, full_name, role, org_role, created_at
       FROM users
       WHERE org_id = ?
       ORDER BY created_at DESC`,
      [req.orgUser!.orgId]
    );

    res.json({ members });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Invite member to organization
router.post('/invite', requireOrgRole(['owner', 'admin']), async (req: OrgAuthRequest, res) => {
  try {
    const data = inviteMemberSchema.parse(req.body);
    const { email, fullName, role, orgRole } = data;

    // Check if user already exists
    const existing = await query<any[]>('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create invitation (in production, send email)
    const invitationToken = Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(
      'INSERT INTO invitations (org_id, email, full_name, role, org_role, token, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.orgUser!.orgId, email, fullName, role, orgRole || 'member', invitationToken, expiresAt]
    );

    // TODO: Send invitation email

    res.json({
      message: 'Invitation sent successfully',
      invitationToken
    });
  } catch (error) {
    console.error('Error inviting member:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Update member role
router.put('/members/:userId/role', requireOrgOwner(), async (req: OrgAuthRequest, res) => {
  try {
    const { userId } = req.params;
    const data = updateMemberRoleSchema.parse(req.body);
    const { orgRole } = data;

    // Prevent changing own role
    if (userId === req.orgUser!.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    await query(
      'UPDATE users SET org_role = ? WHERE id = ? AND org_id = ?',
      [orgRole, userId, req.orgUser!.orgId]
    );

    res.json({ message: 'Member role updated successfully' });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// Remove member from organization
router.delete('/members/:userId', requireOrgOwner(), async (req: OrgAuthRequest, res) => {
  try {
    const { userId } = req.params;

    // Prevent removing self
    if (userId === req.orgUser!.userId) {
      return res.status(400).json({ error: 'Cannot remove yourself from organization' });
    }

    await query(
      'UPDATE users SET org_id = NULL, org_role = NULL WHERE id = ? AND org_id = ?',
      [userId, req.orgUser!.orgId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Leave organization
router.post('/leave', requireOrgRole(['owner', 'admin', 'member', 'viewer']), async (req: OrgAuthRequest, res) => {
  try {
    // Prevent owner from leaving (must transfer ownership first)
    if (req.orgUser!.role === 'owner') {
      return res.status(400).json({ error: 'Owner cannot leave organization. Transfer ownership first.' });
    }

    await query(
      'UPDATE users SET org_id = NULL, org_role = NULL WHERE id = ?',
      [req.orgUser!.userId]
    );

    res.json({ message: 'Left organization successfully' });
  } catch (error) {
    console.error('Error leaving organization:', error);
    res.status(500).json({ error: 'Failed to leave organization' });
  }
});

export default router;
