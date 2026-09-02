import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { auditLog } from '../middleware/audit';
import { canDownloadReports } from '../middleware/featureGate';
import { getScoreForAssessment } from '../security-scoring/integration/assessment-hook';
import { generatePdfReport, generateExcelReport, buildReportDataFromDatabase } from '../reporting/src';
import type { AssessmentDatabaseRow, FindingRow, ModuleRow, MetadataRow } from '../reporting/src';

const router = express.Router();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

// Validation schemas
const shareReportSchema = z.object({
  emails: z.array(z.string().email()).min(1),
  message: z.string().max(2000).optional(),
  includeFindings: z.boolean().optional(),
  includeModules: z.boolean().optional(),
});

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// Generate PDF report
router.get('/:id/pdf', authenticate, canDownloadReports('pdf'), async (req: AuthRequest, res) => {
  try {
    const assessmentId = req.params.id;

    const assessments = await query('SELECT * FROM assessments WHERE id = ? AND organization_id = ?', [assessmentId, req.user!.organizationId!]);
    if (assessments.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    const assessment = assessments[0] as any;
    const modules = await query('SELECT * FROM assessment_modules WHERE assessment_id = ?', [assessmentId]);
    const findings = await query(
      `SELECT f.control_catalog_id, f.result, f.severity, f.evidence, f.recommendation, cc.control_name, cc.module_name, cc.weight, cc.category
       FROM findings f
       JOIN control_catalog cc ON f.control_catalog_id = cc.id
       JOIN assessment_modules am ON f.assessment_module_id = am.id
       WHERE am.assessment_id = ?`,
      [assessmentId]
    );

    const metadata = await query('SELECT * FROM assessment_metadata WHERE assessment_id = ?', [assessmentId]);

    const scoreResult = await getScoreForAssessment(assessmentId);
    if (!scoreResult) {
      return res.status(400).json({ success: false, error: 'Assessment score not available. Please ensure the assessment has completed scoring.' });
    }

    const reportData = buildReportDataFromDatabase({
      assessment: assessment as AssessmentDatabaseRow,
      modules: modules as ModuleRow[],
      findings: findings as FindingRow[],
      metadata: metadata as MetadataRow[],
      scoreResult,
    });

    const filename = `aegis-report-${assessmentId}-${Date.now()}.pdf`;
    const filepath = path.join(STORAGE_PATH, filename);

    await generatePdfReport(reportData, { outputPath: filepath });

    const reportId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query(
      'INSERT INTO reports (id, assessment_id, format, storage_path, expires_at) VALUES (?, ?, ?, ?, ?)',
      [reportId, assessmentId, 'pdf', filepath, expiresAt]
    );

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'report_downloaded',
      resource: 'report',
      resourceId: reportId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        assessment_id: assessmentId,
        report_format: 'pdf',
      },
      status: 'success',
    });

    res.download(filepath, filename);
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate PDF report' });
  }
});

// Generate Excel report
router.get('/:id/excel', authenticate, canDownloadReports('excel'), async (req: AuthRequest, res) => {
  try {
    const assessmentId = req.params.id;

    const assessments = await query('SELECT * FROM assessments WHERE id = ? AND organization_id = ?', [assessmentId, req.user!.organizationId!]);
    if (assessments.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    const assessment = assessments[0] as any;
    const modules = await query('SELECT * FROM assessment_modules WHERE assessment_id = ?', [assessmentId]);
    const findings = await query(
      `SELECT f.control_catalog_id, f.result, f.severity, f.evidence, f.recommendation, cc.control_name, cc.module_name, cc.weight, cc.category
       FROM findings f
       JOIN control_catalog cc ON f.control_catalog_id = cc.id
       JOIN assessment_modules am ON f.assessment_module_id = am.id
       WHERE am.assessment_id = ?`,
      [assessmentId]
    );

    const metadata = await query('SELECT * FROM assessment_metadata WHERE assessment_id = ?', [assessmentId]);

    const scoreResult = await getScoreForAssessment(assessmentId);
    if (!scoreResult) {
      return res.status(400).json({ success: false, error: 'Assessment score not available. Please ensure the assessment has completed scoring.' });
    }

    const reportData = buildReportDataFromDatabase({
      assessment: assessment as AssessmentDatabaseRow,
      modules: modules as ModuleRow[],
      findings: findings as FindingRow[],
      metadata: metadata as MetadataRow[],
      scoreResult,
    });

    const filename = `aegis-report-${assessmentId}-${Date.now()}.xlsx`;
    const filepath = path.join(STORAGE_PATH, filename);

    await generateExcelReport(reportData, filepath);

    const reportId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query(
      'INSERT INTO reports (id, assessment_id, format, storage_path, expires_at) VALUES (?, ?, ?, ?, ?)',
      [reportId, assessmentId, 'excel', filepath, expiresAt]
    );

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'report_downloaded',
      resource: 'report',
      resourceId: reportId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        assessment_id: assessmentId,
        report_format: 'excel',
      },
      status: 'success',
    });

    res.download(filepath, filename);
  } catch (error) {
    console.error('Generate Excel error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate Excel report' });
  }
});

// Get reports for an assessment
router.get('/assessment/:assessmentId', authenticate, async (req: AuthRequest, res) => {
  try {
    const reports = await query(
      'SELECT * FROM reports WHERE assessment_id = ?',
      [req.params.assessmentId]
    );
    res.json({ success: true, data: reports });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

// Share report via email
router.post('/:id/share', authenticate, async (req: AuthRequest, res) => {
  try {
    const assessmentId = req.params.id;
    const data = shareReportSchema.parse(req.body);
    const { emails, message, includeFindings, includeModules } = data;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one email is required' });
    }

    const assessments = await query(
      'SELECT * FROM assessments WHERE id = ? AND organization_id = ?',
      [assessmentId, req.user!.organizationId!]
    );
    if (assessments.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    const assessment = assessments[0] as any;

    const shareToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query(
      'INSERT INTO report_shares (id, assessment_id, shared_by, share_token, emails, message, include_findings, include_modules, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), assessmentId, req.user!.id, shareToken, JSON.stringify(emails), message || '', includeFindings ? 1 : 0, includeModules ? 1 : 0, expiresAt]
    );

    const shareLink = `${process.env.APP_URL || 'http://localhost:3000'}/shared/report/${shareToken}`;

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'report_shared',
      resource: 'report_share',
      resourceId: shareToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        assessment_id: assessmentId,
        recipient_emails: emails,
        include_findings: includeFindings,
        include_modules: includeModules,
      },
      status: 'success',
    });

    res.json({
      success: true,
      data: {
        shareLink,
        expiresAt,
        emails,
      },
    });
  } catch (error) {
    console.error('Share report error:', error);
    res.status(500).json({ success: false, error: 'Failed to share report' });
  }
});

// Get shared report (public endpoint - no auth required)
router.get('/shared/:token', async (req, res) => {
  try {
    const share = await query(
      'SELECT rs.*, a.type, a.overall_score, a.score_band, a.completed_at FROM report_shares rs JOIN assessments a ON rs.assessment_id = a.id WHERE rs.share_token = ? AND rs.expires_at > NOW()',
      [req.params.token]
    );

    if (share.length === 0) {
      return res.status(404).json({ success: false, error: 'Share link not found or expired' });
    }

    const reportShare = share[0] as any;

    let modules = [];
    let findings = [];

    if (reportShare.include_modules) {
      modules = await query('SELECT * FROM assessment_modules WHERE assessment_id = ?', [reportShare.assessment_id]);
    }

    if (reportShare.include_findings) {
      findings = await query(
        `SELECT f.*, cc.control_name, cc.module_name, cc.description as control_description
         FROM findings f
         JOIN control_catalog cc ON f.control_catalog_id = cc.id
         JOIN assessment_modules am ON f.assessment_module_id = am.id
         WHERE am.assessment_id = ?`,
        [reportShare.assessment_id]
      );
    }

    res.json({
      success: true,
      data: {
        assessment: {
          type: reportShare.type,
          overallScore: reportShare.overall_score,
          scoreBand: reportShare.score_band,
          completedAt: reportShare.completed_at,
        },
        modules,
        findings,
        sharedBy: reportShare.shared_by,
        message: reportShare.message,
      },
    });
  } catch (error) {
    console.error('Get shared report error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch shared report' });
  }
});

export default router;
