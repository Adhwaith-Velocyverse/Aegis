import express from 'express';
import { query } from '../db/connection';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { z } from 'zod';
import { notifyAssessmentComplete, notifyClientDocumentRequest } from '../services/notifications';
import { auditLog } from '../middleware/audit';

const router = express.Router();

// All assessor routes require assessor role
router.use(authenticate, authorize('assessor'));

// Validation schemas
const findingSchema = z.object({
  id: z.string().uuid().optional(),
  assessmentModuleId: z.string().uuid().optional(),
  controlCatalogId: z.string().uuid(),
  result: z.enum(['pass', 'fail', 'not_applicable']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  evidence: z.string().min(1),
  recommendation: z.string().min(1),
});

const submitFindingsSchema = z.object({
  findings: z.array(findingSchema).min(1),
});

const requestDocsSchema = z.object({
  message: z.string().min(1).max(1000),
});

// Get assessor dashboard
router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const assessor = await query('SELECT * FROM assessors WHERE user_id = ?', [req.user!.id]);
    if (assessor.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessor not found' });
    }

    const assignedRequests = await query(
      `SELECT dar.*, a.type, a.overall_score, u.full_name as client_name, tc.tenant_name
       FROM detailed_assessment_requests dar
       JOIN assessments a ON dar.assessment_id = a.id
       JOIN users u ON a.organization_id = u.organization_id AND u.platform_role = 'client'
       LEFT JOIN tenant_connections tc ON a.tenant_connection_id = tc.id
       WHERE dar.assigned_assessor_id = ? AND dar.status IN ('assigned', 'in_review', 'awaiting_client')
       ORDER BY dar.requested_on DESC`,
      [(assessor[0] as any).id]
    );

    const completedRequests = await query(
      `SELECT dar.*, a.type, a.overall_score, u.full_name as client_name
       FROM detailed_assessment_requests dar
       JOIN assessments a ON dar.assessment_id = a.id
       JOIN users u ON a.organization_id = u.organization_id AND u.platform_role = 'client'
       WHERE dar.assigned_assessor_id = ? AND dar.status = 'completed'
       ORDER BY dar.completed_on DESC LIMIT 20`,
      [(assessor[0] as any).id]
    );

    res.json({
      success: true,
      data: {
        assigned: assignedRequests,
        completed: completedRequests,
        stats: {
          assignedCount: assignedRequests.length,
          completedCount: completedRequests.length,
        },
      },
    });
  } catch (error) {
    console.error('Assessor dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
});

// Get assessment details for review
router.get('/assessment/:id', async (req: AuthRequest, res) => {
  try {
    const request = await query(
      `SELECT dar.*, a.type, a.overall_score, u.full_name as client_name, u.email as client_email, tc.tenant_name
       FROM detailed_assessment_requests dar
       JOIN assessments a ON dar.assessment_id = a.id
       JOIN users u ON a.organization_id = u.organization_id AND u.platform_role = 'client'
       LEFT JOIN tenant_connections tc ON a.tenant_connection_id = tc.id
       WHERE dar.id = ? AND dar.assigned_assessor_id = (SELECT id FROM assessors WHERE user_id = ?)`,
      [req.params.id, req.user!.id]
    );

    if (request.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found or not assigned to you' });
    }

    // Get assessment modules and findings
    const modules = await query(
      'SELECT * FROM assessment_modules WHERE assessment_id = ?',
      [(request[0] as any).assessment_id]
    );

    const findings = await query(
      `SELECT f.*, cc.control_name, cc.module_name, cc.description as control_description
       FROM findings f
       JOIN control_catalog cc ON f.control_catalog_id = cc.id
       JOIN assessment_modules am ON f.assessment_module_id = am.id
       WHERE am.assessment_id = ?`,
      [(request[0] as any).assessment_id]
    );

    res.json({
      success: true,
      data: {
        request: request[0],
        modules,
        findings,
      },
    });
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assessment' });
  }
});

// Submit manual findings
router.post('/assessment/:id/findings', async (req: AuthRequest, res) => {
  try {
    const data = submitFindingsSchema.parse(req.body);
    const findings = data.findings;

    // Get assessment ID from request
    const requestResult = await query(
      'SELECT assessment_id FROM detailed_assessment_requests WHERE id = ?',
      [req.params.id]
    );
    if (requestResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment request not found' });
    }
    const assessmentId = (requestResult[0] as any).assessment_id;

    // Get assessment modules for mapping
    const modules = await query(
      'SELECT id, module_name FROM assessment_modules WHERE assessment_id = ?',
      [assessmentId]
    );
    const moduleMap = new Map((modules as any[]).map(m => [m.module_name, m.id]));

    // Insert findings
    const insertedFindings = [];
    for (const finding of findings) {
      // Auto-resolve assessmentModuleId from control catalog if not provided
      let assessmentModuleId = finding.assessmentModuleId;
      if (!assessmentModuleId && finding.controlCatalogId) {
        const control = await query('SELECT module_name FROM control_catalog WHERE id = ?', [finding.controlCatalogId]);
        if (control.length > 0) {
          const moduleName = (control[0] as any).module_name;
          assessmentModuleId = moduleMap.get(moduleName);
        }
      }

      if (!assessmentModuleId) {
        continue; // Skip if we can't resolve the module
      }

      const findingId = finding.id || require('uuid').v4();
      await query(
        `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          findingId,
          assessmentModuleId,
          finding.controlCatalogId,
          finding.result,
          finding.severity,
          finding.evidence,
          finding.recommendation,
          'manual',
        ]
      );
      insertedFindings.push({ id: findingId, ...finding });
    }

    // Update request status
    await query(
      'UPDATE detailed_assessment_requests SET status = ?, completed_on = NOW() WHERE id = ?',
      ['completed', req.params.id]
    );

    // Update assessment status
    const assessmentResult = await query(
      'SELECT assessment_id, a.organization_id FROM detailed_assessment_requests dar JOIN assessments a ON dar.assessment_id = a.id WHERE dar.id = ?',
      [req.params.id]
    );

    if (assessmentResult.length > 0) {
      const assessmentId = (assessmentResult[0] as any).assessment_id;
      const orgId = (assessmentResult[0] as any).organization_id;
      
      await query(
        'UPDATE assessments SET status = ?, completed_at = NOW() WHERE id = ?',
        ['completed', assessmentId]
      );

      // Notify client that assessment is complete
      const users = await query('SELECT id FROM users WHERE organization_id = ? AND platform_role = ?', [orgId, 'client']);
      for (const user of users) {
        await notifyAssessmentComplete((user as any).id, assessmentId, 0); // Score will be recalculated
      }
    }

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'assessor_findings_submitted',
      resource: 'detailed_assessment_request',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        findings_count: findings.length,
        request_id: req.params.id,
      },
      status: 'success',
    });

    res.json({ success: true, data: { findings: insertedFindings }, message: 'Findings submitted' });
  } catch (error) {
    console.error('Submit findings error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit findings' });
  }
});

// Request documents from client
router.post('/assessment/:id/request-docs', async (req: AuthRequest, res) => {
  try {
    const data = requestDocsSchema.parse(req.body);
    const message = data.message;

    // Get assessment and client info
    const request = await query(
      `SELECT a.organization_id, u.email as client_email FROM detailed_assessment_requests dar
       JOIN assessments a ON dar.assessment_id = a.id
       JOIN users u ON a.organization_id = u.organization_id AND u.platform_role = 'client'
       WHERE dar.id = ?`,
      [req.params.id]
    );

    if (request.length > 0) {
      // Update request status
      await query(
        'UPDATE detailed_assessment_requests SET status = ? WHERE id = ?',
        ['awaiting_client', req.params.id]
      );

      // Send notification to client
      const clientUser = await query(
        'SELECT id FROM users WHERE organization_id = ? AND platform_role = ?',
        [(request[0] as any).organization_id, 'client']
      );
      
      if (clientUser.length > 0) {
        await notifyClientDocumentRequest((clientUser[0] as any).id, message);
      }

      // In production, send email notification to client
      console.log(`Document request sent to ${(request[0] as any).client_email}: ${message}`);

      await auditLog({
        userId: req.user!.id,
        orgId: req.user!.organizationId,
        action: 'assessor_document_requested',
        resource: 'detailed_assessment_request',
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          request_id: req.params.id,
          message_length: message.length,
        },
        status: 'success',
      });
    }

    res.json({ success: true, message: 'Document request sent' });
  } catch (error) {
    console.error('Request docs error:', error);
    res.status(500).json({ success: false, error: 'Failed to request documents' });
  }
});

export default router;
