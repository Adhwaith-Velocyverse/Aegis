import express from 'express';
import { query } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get user notifications
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE user_id = ?';
    const params: any[] = [req.user!.id];

    if (unreadOnly === 'true') {
      whereClause += ' AND is_read = 0';
    }

    const notifications = await query(
      `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalResult = await query(`SELECT COUNT(*) as total FROM notifications ${whereClause}`, params);
    const total = (totalResult[0] as any).total;

    res.json({
      success: true,
      data: notifications,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticate, async (req: AuthRequest, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [req.user!.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    await query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
});

// Get unread count
router.get('/unread-count', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user!.id]
    );
    res.json({ success: true, count: (result[0] as any).count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
  }
});

export default router;
