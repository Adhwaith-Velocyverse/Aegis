import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AssessmentType, AssessmentStatus } from '@aegis/shared';
import { enqueueAssessment } from '../services/queue';
import { getActiveModuleNames, getActiveModuleNamesForAssessmentType } from '../services/graphConnector';
import { z } from 'zod';
import { auditLog } from '../middleware/audit';
import { canRunAssessment } from '../middleware/featureGate';

import { mapAssessmentRow, mapAssessmentRows } from '../utils/mapAssessmentRow';

const router = express.Router();

// Validation schemas
const trialAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.enum(['yes', 'no', 'unsure']),
});

const startAssessmentSchema = z.object({
  tenantConnectionId: z.string().uuid(),
});

// Get assessment history
router.get('/history', authenticate, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, type, status, startDate, endDate, minScore, maxScore, module, sortBy = 'created_at', sortOrder = 'DESC' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE a.organization_id = ?';
    const params: any[] = [req.user!.organizationId!];

    if (type) {
      whereClause += ' AND a.type = ?';
      params.push(type);
    }
    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }
    if (startDate) {
      whereClause += ' AND a.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND a.created_at <= ?';
      params.push(endDate);
    }
    if (minScore !== undefined && minScore !== '') {
      whereClause += ' AND a.overall_score >= ?';
      params.push(parseFloat(minScore));
    }
    if (maxScore !== undefined && maxScore !== '') {
      whereClause += ' AND a.overall_score <= ?';
      params.push(parseFloat(maxScore));
    }
    if (module) {
      whereClause += ' AND EXISTS (SELECT 1 FROM assessment_modules am WHERE am.assessment_id = a.id AND am.module_name = ? AND am.collection_status = ?)';
      params.push(module, 'completed');
    }

    // Validate sortBy to prevent SQL injection
    const allowedSortColumns = ['created_at', 'overall_score', 'type', 'status', 'completed_at'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const limitVal = parseInt(limit);
    const offsetVal = offset;
    const assessments = await query(
      `SELECT a.*, tc.tenant_name FROM assessments a LEFT JOIN tenant_connections tc ON a.tenant_connection_id = tc.id ${whereClause} ORDER BY a.${safeSortBy} ${safeSortOrder} LIMIT ${limitVal} OFFSET ${offsetVal}`,
      params
    );

    const totalResult = await query(`SELECT COUNT(*) as total FROM assessments a ${whereClause}`, params);
    const total = (totalResult[0] as any).total;

    res.json({
      success: true,
      data: mapAssessmentRows(assessments as any[]),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get history error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ success: false, error: 'Failed to fetch assessment history', details: String(error) });
  }
});

// Delete assessment
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const assessmentId = req.params.id;

    // Verify assessment belongs to user's organization
    const assessments = await query(
      'SELECT id FROM assessments WHERE id = ? AND organization_id = ?',
      [assessmentId, req.user!.organizationId!]
    );

    if (assessments.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    // Soft delete
    await query(
      'UPDATE assessments SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
      [assessmentId]
    );

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'assessment_deleted',
      resource: 'assessment',
      resourceId: assessmentId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        organization_id: req.user!.organizationId,
      },
      status: 'success',
    });

    res.json({ success: true, message: 'Assessment deleted successfully' });
  } catch (error) {
    console.error('Delete assessment error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete assessment' });
  }
});

// Get assessment by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const assessments = await query(
      'SELECT a.*, tc.tenant_name FROM assessments a LEFT JOIN tenant_connections tc ON a.tenant_connection_id = tc.id WHERE a.id = ? AND a.organization_id = ?',
      [req.params.id, req.user!.organizationId!]
    );
    if (assessments.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }
    res.json({ success: true, data: mapAssessmentRow(assessments[0] as any) });
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assessment' });
  }
});

// Get assessment progress
router.get('/:id/progress', authenticate, async (req: AuthRequest, res) => {
  try {
    const assessment = await query('SELECT * FROM assessments WHERE id = ? AND organization_id = ?', [req.params.id, req.user!.organizationId!]);
    if (assessment.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    const modules = await query('SELECT * FROM assessment_modules WHERE assessment_id = ?', [req.params.id]);
    const totalModules = modules.length;
    const completedModules = (modules as any[]).filter((m) => m.collection_status === 'completed').length;
    const failedModules = (modules as any[]).filter((m) => m.collection_status === 'failed' || m.collection_status === 'permission_denied').length;
    const progress = totalModules > 0 ? Math.round(((completedModules + failedModules) / totalModules) * 100) : 0;

    res.json({
      success: true,
      data: {
        status: (assessment[0] as any).status,
        progress,
        totalModules,
        completedModules,
        failedModules,
        modules: modules,
      },
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
});

// Get assessment modules
router.get('/:id/modules', authenticate, async (req: AuthRequest, res) => {
  try {
    const modules = await query('SELECT * FROM assessment_modules WHERE assessment_id = ?', [req.params.id]);
    const mapped = (modules as any[]).map((m) => ({
      id: m.id,
      assessmentId: m.assessment_id,
      moduleName: m.module_name,
      collectionStatus: m.collection_status,
      moduleScore: m.module_score ?? undefined,
      passedCount: m.passed_count ?? undefined,
      failedCount: m.failed_count ?? undefined,
      notApplicableCount: m.not_applicable_count ?? undefined,
      rawDataPath: m.raw_data_path ?? undefined,
      createdAt: m.created_at ? new Date(m.created_at) : undefined,
      updatedAt: m.updated_at ? new Date(m.updated_at) : undefined,
    }));
    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch modules' });
  }
});

// Get assessment findings
router.get('/:id/findings', authenticate, async (req: AuthRequest, res) => {
  try {
    const findings = await query(
      `SELECT f.*, cc.control_name, cc.module_name, cc.description as control_description
       FROM findings f
       JOIN control_catalog cc ON f.control_catalog_id = cc.id
       JOIN assessment_modules am ON f.assessment_module_id = am.id
       WHERE am.assessment_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: findings });
  } catch (error) {
    console.error('Get findings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch findings' });
  }
});

// Get raw API call details for an assessment module
router.get('/:id/api-calls/:moduleName', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, moduleName } = req.params;
    
    // Verify assessment belongs to user's organization
    const assessment = await query('SELECT * FROM assessments WHERE id = ? AND organization_id = ?', [id, req.user!.organizationId!]);
    if (assessment.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    // Get the module's raw data
    const modules = await query(
      'SELECT * FROM assessment_modules WHERE assessment_id = ? AND module_name = ?',
      [id, moduleName]
    );

    if (modules.length === 0) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    const rawDataPath = (modules[0] as any).raw_data_path;
    if (!rawDataPath) {
      return res.json({ success: true, data: { apiCalls: [], message: 'No data collected' } });
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(rawDataPath);
    } catch {
      return res.json({ success: true, data: { apiCalls: [], rawData: rawDataPath } });
    }

    // Format API calls for display
    const apiCalls: Array<{
      endpoint: string;
      method: string;
      status: 'success' | 'error';
      response?: any;
      error?: string;
    }> = [];

    // Handle Entra ID format (rawData structure)
    if (parsedData.rawData) {
      for (const [endpoint, data] of Object.entries(parsedData.rawData)) {
        const endpointStr = String(endpoint);
        const dataObj = data as any;
        
        if (dataObj && dataObj.error) {
          apiCalls.push({
            endpoint: endpointStr,
            method: 'GET',
            status: 'error',
            error: dataObj.error,
          });
        } else {
          apiCalls.push({
            endpoint: endpointStr,
            method: 'GET',
            status: 'success',
            response: dataObj?.value || dataObj,
          });
        }
      }
    }
    // Handle other module formats
    else if (parsedData.data) {
      for (const [endpoint, data] of Object.entries(parsedData.data)) {
        const endpointStr = String(endpoint);
        const dataObj = data as any;
        
        if (dataObj && dataObj.error) {
          apiCalls.push({
            endpoint: endpointStr,
            method: 'GET',
            status: 'error',
            error: dataObj.error,
          });
        } else {
          apiCalls.push({
            endpoint: endpointStr,
            method: 'GET',
            status: 'success',
            response: dataObj,
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        moduleName,
        collectionStatus: (modules[0] as any).collection_status,
        collectedAt: parsedData.collectedAt,
        apiCalls,
        errors: parsedData.errors || [],
        controls: parsedData.controls || {},
      },
    });
  } catch (error) {
    console.error('Get API calls error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch API calls' });
  }
});

// List assessment-data files for an assessment
router.get('/:id/assessment-data', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Verify assessment belongs to user's organization
    const assessment = await query('SELECT * FROM assessments WHERE id = ? AND organization_id = ?', [id, req.user!.organizationId!]);
    if (assessment.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    const path = require('path');
    const fs = require('fs');
    const baseDir = path.join(__dirname, '..', '..', 'assessment-data', id);

    if (!fs.existsSync(baseDir)) {
      return res.json({ success: true, data: { assessmentId: id, files: [], message: 'No assessment data files found' } });
    }

    const files: Array<{ name: string; size: number; modified: string; type: string }> = [];
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(baseDir, entry.name);
        const stats = fs.statSync(filePath);
        files.push({
          name: entry.name,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          type: entry.name.endsWith('.json') ? 'json' : 'unknown',
        });
      }
    }

    res.json({
      success: true,
      data: {
        assessmentId: id,
        path: baseDir,
        files,
      },
    });
  } catch (error) {
    console.error('List assessment-data error:', error);
    res.status(500).json({ success: false, error: 'Failed to list assessment data files' });
  }
});

// Get a specific assessment-data file content
router.get('/:id/assessment-data/:filename', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, filename } = req.params;
    
    // Verify assessment belongs to user's organization
    const assessment = await query('SELECT * FROM assessments WHERE id = ? AND organization_id = ?', [id, req.user!.organizationId!]);
    if (assessment.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    const path = require('path');
    const fs = require('fs');
    const baseDir = path.join(__dirname, '..', '..', 'assessment-data', id);
    const filePath = path.join(baseDir, filename);

    // Security: prevent path traversal
    if (!filePath.startsWith(baseDir)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    res.json({
      success: true,
      data: {
        assessmentId: id,
        filename,
        content: parsed,
      },
    });
  } catch (error) {
    console.error('Get assessment-data file error:', error);
    res.status(500).json({ success: false, error: 'Failed to read assessment data file' });
  }
});

// Start Trial Assessment
router.post('/trial/start', authenticate, async (req: AuthRequest, res) => {
  try {
    const assessmentId = uuidv4();
    await query(
      'INSERT INTO assessments (id, organization_id, type, status) VALUES (?, ?, ?, ?)',
      [assessmentId, req.user!.organizationId!, 'trial', 'in_progress']
    );

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'assessment_started',
      resource: 'assessment',
      resourceId: assessmentId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        assessment_type: 'trial',
        organization_id: req.user!.organizationId,
      },
      status: 'success',
    });

    res.status(201).json({ success: true, data: { assessmentId } });
  } catch (error) {
    console.error('Start trial error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ success: false, error: 'Failed to start trial assessment', details: String(error) });
  }
});

// Submit Trial Assessment
router.post('/trial/:id/submit', authenticate, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      answers: z.array(trialAnswerSchema).min(1),
    });
    const { answers } = schema.parse(req.body);
    const assessmentId = req.params.id;

    // Calculate score
    const questions = await query('SELECT id, weight FROM trial_questionnaires ORDER BY order_num');
    let totalWeight = 0;
    let earnedWeight = 0;

    for (const answer of answers) {
      const question = (questions as any[]).find((q) => q.id === answer.questionId);
      if (question) {
        totalWeight += parseFloat(question.weight);
        if (answer.answer === 'yes') {
          earnedWeight += parseFloat(question.weight);
        } else if (answer.answer === 'unsure') {
          earnedWeight += parseFloat(question.weight) * 0.5;
        }
      }
    }

    const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    // Get configurable score band from database
    const thresholds = await query(
      `SELECT band_name, min_score, max_score, color, description FROM scoring_thresholds WHERE assessment_type = 'trial' AND is_active = TRUE ORDER BY min_score ASC`
    );

    let scoreBand = 'Fair';
    let bandColor = 'yellow';
    let bandDescription = 'Some security controls in place but improvements needed.';

    for (const threshold of thresholds as any[]) {
      if (score >= parseFloat(threshold.min_score) && score <= parseFloat(threshold.max_score)) {
        scoreBand = threshold.band_name;
        bandColor = threshold.color;
        bandDescription = threshold.description;
        break;
      }
    }

    // Save answers
    for (const answer of answers) {
      await query(
        'INSERT INTO trial_answers (id, assessment_id, question_id, answer) VALUES (?, ?, ?, ?)',
        [uuidv4(), assessmentId, answer.questionId, answer.answer]
      );
    }

    // Update assessment
    await query(
      'UPDATE assessments SET status = ?, overall_score = ?, score_band = ?, completed_at = NOW() WHERE id = ?',
      ['completed', score, scoreBand, assessmentId]
    );

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'assessment_completed',
      resource: 'assessment',
      resourceId: assessmentId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        assessment_type: 'trial',
        score,
        score_band: scoreBand,
        organization_id: req.user!.organizationId,
      },
      status: 'success',
    });

    res.json({ success: true, data: { score, scoreBand, bandColor, bandDescription } });
  } catch (error) {
    console.error('Submit trial error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit trial assessment' });
  }
});

// Start Quick/Detailed Assessment (with feature gating)
router.post('/:type/start', authenticate, (req, res, next) => {
  const type = req.params.type as 'quick' | 'detailed';
  return canRunAssessment(type)(req, res, next);
}, async (req: AuthRequest, res) => {
  try {
    const { type } = req.params as { type: AssessmentType };
    const data = startAssessmentSchema.parse(req.body);
    const { tenantConnectionId } = data;

    if (!tenantConnectionId) {
      return res.status(400).json({ success: false, error: 'Tenant connection required' });
    }

    // Check subscription and credits for paid assessments
    // UNLIMITED CREDITS - Bypass credit check
    if (type === 'quick' || type === 'detailed') {
      const subscriptions = await query(
        `SELECT s.*, sp.features, sp.included_quick_credits, sp.included_detailed_credits
         FROM subscriptions s
         JOIN subscription_plans sp ON s.plan_id = sp.id
         WHERE s.organization_id = ? AND s.billing_status = 'active'
         ORDER BY s.created_at DESC LIMIT 1`,
        [req.user!.organizationId!]
      );

      // Skip subscription check - allow unlimited assessments
      // if (subscriptions.length === 0) {
      //   return res.status(403).json({
      //     success: false,
      //     error: 'No active subscription. Please upgrade to a paid plan to run assessments.',
      //     upgradeRequired: true
      //   });
      // }

      // Credit consumption tracking disabled for unlimited credits
      // const subscription = subscriptions[0] as any;
      // const features = typeof subscription.features === 'string' ? JSON.parse(subscription.features) : (subscription.features || {});
      // 
      // if (!features[type]) {
      //   return res.status(403).json({
      //     success: false,
      //     error: `Your plan does not include ${type} assessments. Please upgrade.`,
      //     upgradeRequired: true
      //   });
      // }

      // Check usage ledger for credits - DISABLED
      // const creditType = type === 'quick' ? 'quick_credits' : 'detailed_credits';
      // const includedCredits = type === 'quick' ? subscription.included_quick_credits : subscription.included_detailed_credits;
      // 
      // const usageResult = await query(
      //   `SELECT SUM(amount) as used FROM usage_ledger
      //    WHERE organization_id = ? AND type = 'credit_consumption' AND description LIKE ?`,
      //   [req.user!.organizationId!, `%${type}%`]
      // );
      // 
      // const usedCredits = (usageResult[0] as any).used || 0;
      // 
      // if (usedCredits >= includedCredits) {
      //   return res.status(403).json({
      //     success: false,
      //     error: `You have used all your ${type} assessment credits. Please upgrade your plan.`,
      //     upgradeRequired: true
      //   });
      // }

      // Record credit consumption - DISABLED
      // await query(
      //   'INSERT INTO usage_ledger (id, organization_id, subscription_id, type, amount, description) VALUES (?, ?, ?, ?, ?, ?)',
      //   [uuidv4(), req.user!.organizationId!, subscription.id, 'credit_consumption', 1, `${type} assessment consumption`]
      // );
    }

    const assessmentId = uuidv4();
    await query(
      'INSERT INTO assessments (id, organization_id, tenant_connection_id, type, status, started_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [assessmentId, req.user!.organizationId!, tenantConnectionId, type, 'in_progress']
    );

    // Create assessment modules from MODULES registry (FR-5.1)
    const modules = getActiveModuleNamesForAssessmentType(type);
    for (const moduleName of modules) {
      await query(
        'INSERT INTO assessment_modules (id, assessment_id, module_name, collection_status) VALUES (?, ?, ?, ?)',
        [uuidv4(), assessmentId, moduleName, 'pending']
      );
    }

    // Enqueue assessment job for background processing (only for quick/detailed)
    if (type === 'quick' || type === 'detailed') {
      await enqueueAssessment(assessmentId, type, tenantConnectionId);
    }

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'assessment_started',
      resource: 'assessment',
      resourceId: assessmentId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        assessment_type: type,
        tenant_connection_id: tenantConnectionId,
        organization_id: req.user!.organizationId,
      },
      status: 'success',
    });

    res.status(201).json({
      success: true,
      data: {
        assessmentId,
        loadingUrl: `/assessment-loading?assessmentId=${assessmentId}`
      }
    });
  } catch (error) {
    console.error('Start assessment error:', error);
    res.status(500).json({ success: false, error: 'Failed to start assessment' });
  }
});

// Get trial questions
router.get('/trial/questions', authenticate, async (req: AuthRequest, res) => {
  try {
    const questions = await query('SELECT * FROM trial_questionnaires ORDER BY order_num');
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch questions' });
  }
});

// Bulk delete assessments
router.delete('/bulk', authenticate, async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No assessment IDs provided' });
    }

    // Verify all assessments belong to the user's organization
    const placeholders = ids.map(() => '?').join(',');
    const assessments = await query(
      `SELECT id FROM assessments WHERE id IN (${placeholders}) AND organization_id = ?`,
      [...ids, req.user!.organizationId!]
    );

    if (assessments.length !== ids.length) {
      return res.status(403).json({ success: false, error: 'Some assessments not found or access denied' });
    }

    // Soft delete assessments
    await query(
      `UPDATE assessments SET deleted_at = NOW(), updated_at = NOW() WHERE id IN (${placeholders})`,
      ids
    );

    res.json({ success: true, message: `${ids.length} assessment(s) deleted successfully` });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete assessments' });
  }
});

// Get assessment metadata
router.get('/:id/metadata', authenticate, async (req: AuthRequest, res) => {
  try {
    const metadata = await query(
      'SELECT * FROM assessment_metadata WHERE assessment_id = ?',
      [req.params.id]
    );
    res.json({ success: true, data: metadata });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metadata' });
  }
});

// Request Detailed Assessment (creates request for manual review)
router.post('/detailed/request', authenticate, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      assessmentId: z.string().uuid(),
      notes: z.string().optional(),
    });
    const { assessmentId, notes } = schema.parse(req.body);

    // Verify assessment belongs to user's organization
    const assessments = await query(
      'SELECT * FROM assessments WHERE id = ? AND organization_id = ?',
      [assessmentId, req.user!.organizationId!]
    );

    if (assessments.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    // Check if detailed assessment request already exists
    const existingRequest = await query(
      'SELECT id FROM detailed_assessment_requests WHERE assessment_id = ?',
      [assessmentId]
    );

    if (existingRequest.length > 0) {
      return res.status(400).json({ success: false, error: 'Detailed assessment request already exists for this assessment' });
    }

    // Create detailed assessment request
    const requestId = uuidv4();
    await query(
      'INSERT INTO detailed_assessment_requests (id, assessment_id, status, notes) VALUES (?, ?, ?, ?)',
      [requestId, assessmentId, 'unassigned', notes || null]
    );

    // Update assessment status
    await query("UPDATE assessments SET status = 'pending_review' WHERE id = ?", [assessmentId]);

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'detailed_assessment_requested',
      resource: 'detailed_assessment_request',
      resourceId: requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        assessment_id: assessmentId,
        organization_id: req.user!.organizationId,
        notes: notes || null,
      },
      status: 'success',
    });

    res.status(201).json({
      success: true,
      data: { requestId },
      message: 'Detailed assessment request created. An assessor will be assigned shortly.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Request detailed assessment error:', error);
    res.status(500).json({ success: false, error: 'Failed to request detailed assessment' });
  }
});

// Get detailed assessment request status
router.get('/detailed/:assessmentId/request', authenticate, async (req: AuthRequest, res) => {
  try {
    const { assessmentId } = req.params;

    const request = await query(
      `SELECT dar.*, a.type, a.overall_score, ass.name as assessor_name, ass.email as assessor_email
       FROM detailed_assessment_requests dar
       JOIN assessments a ON dar.assessment_id = a.id
       LEFT JOIN assessors ass ON dar.assigned_assessor_id = ass.user_id
       WHERE dar.assessment_id = ? AND a.organization_id = ?`,
      [assessmentId, req.user!.organizationId!]
    );

    if (request.length === 0) {
      return res.status(404).json({ success: false, error: 'Detailed assessment request not found' });
    }

    res.json({ success: true, data: request[0] });
  } catch (error) {
    console.error('Get request status error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch request status' });
  }
});

export default router;
