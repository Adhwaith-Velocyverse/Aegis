import express from 'express';
import { query } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all controls (with optional filtering)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { module, automatable, version } = req.query as any;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (module) {
      whereClause += ' AND module_name = ?';
      params.push(module);
    }
    if (automatable !== undefined) {
      whereClause += ' AND automatable = ?';
      params.push(automatable === 'true' ? 1 : 0);
    }
    if (version) {
      whereClause += ' AND version = ?';
      params.push(version);
    }

    const controls = await query(
      `SELECT * FROM control_catalog ${whereClause} ORDER BY module_name, order_num`,
      params
    );

    res.json({ success: true, data: controls });
  } catch (error) {
    console.error('Get controls error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch controls' });
  }
});

// Get control by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const controls = await query('SELECT * FROM control_catalog WHERE id = ?', [req.params.id]);
    if (controls.length === 0) {
      return res.status(404).json({ success: false, error: 'Control not found' });
    }
    res.json({ success: true, data: controls[0] });
  } catch (error) {
    console.error('Get control error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch control' });
  }
});

export default router;
