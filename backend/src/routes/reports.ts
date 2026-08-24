import express from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createWriteStream } from 'fs';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { auditLog } from '../middleware/audit';
import { canDownloadReports } from '../middleware/featureGate';

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

    // Fetch assessment data
    const assessments = await query('SELECT * FROM assessments WHERE id = ? AND organization_id = ?', [assessmentId, req.user!.organizationId!]);
    if (assessments.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    const assessment = assessments[0] as any;
    const modules = await query('SELECT * FROM assessment_modules WHERE assessment_id = ?', [assessmentId]);
    const findings = await query(
      `SELECT f.*, cc.control_name, cc.module_name, cc.description as control_description, cc.framework_refs
       FROM findings f
       JOIN control_catalog cc ON f.control_catalog_id = cc.id
       JOIN assessment_modules am ON f.assessment_module_id = am.id
       WHERE am.assessment_id = ?`,
      [assessmentId]
    );

    // Get organization and tenant info
    const orgResult = await query(
      'SELECT o.name, tc.tenant_name FROM organizations o JOIN assessments a ON a.organization_id = o.id LEFT JOIN tenant_connections tc ON a.tenant_connection_id = tc.id WHERE a.id = ?',
      [assessmentId]
    );
    const orgName = (orgResult[0] as any)?.name || 'Unknown';
    const tenantName = (orgResult[0] as any)?.tenant_name || 'N/A';

    // Get metadata
    const metadata = await query('SELECT * FROM assessment_metadata WHERE assessment_id = ?', [assessmentId]);
    const metaMap: Record<string, string> = {};
    (metadata as any[]).forEach((m: any) => { metaMap[m.key] = m.value; });

    // Calculate duration
    const startedAt = assessment.started_at ? new Date(assessment.started_at) : null;
    const completedAt = assessment.completed_at ? new Date(assessment.completed_at) : null;
    const durationMs = startedAt && completedAt ? completedAt.getTime() - startedAt.getTime() : 0;
    const durationText = durationMs > 0 ? `${Math.round(durationMs / 1000)}s` : 'N/A';

    // Generate PDF
    const filename = `report-${assessmentId}-${Date.now()}.pdf`;
    const filepath = path.join(STORAGE_PATH, filename);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = createWriteStream(filepath);
    doc.pipe(stream);

    // ===== SECTION 1: Assessment Summary =====
    doc.fontSize(22).text('Aegis Security Assessment Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(14).text('1. Assessment Summary', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    doc.text(`Organization: ${orgName}`);
    doc.text(`Tenant: ${tenantName}`);
    doc.text(`Assessment Type: ${assessment.type.toUpperCase()}`);
    doc.text(`Status: ${assessment.status}`);
    doc.text(`Date: ${completedAt ? completedAt.toLocaleDateString() : 'N/A'}`);
    doc.text(`Duration: ${durationText}`);
    doc.text(`Controls Assessed: ${assessment.controls_assessed || 0}`);
    doc.moveDown(1);

    // ===== SECTION 2: Overall Security Score =====
    doc.fontSize(14).text('2. Overall Security Score', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(28).text(`${assessment.overall_score || 0}/100`, { align: 'center' });
    doc.fontSize(14).text(`${assessment.score_band || 'N/A'}`, { align: 'center' });
    doc.fontSize(10).text(metaMap.band_description || '', { align: 'center' });
    doc.moveDown(1);

    // ===== SECTION 3: Area-Specific Security Score =====
    doc.fontSize(14).text('3. Area-Specific Security Scores', { underline: true });
    doc.moveDown(0.3);
    for (const module of modules) {
      const m = module as any;
      const moduleFindings = findings.filter((f: any) => f.module_name === m.module_name);
      const passed = moduleFindings.filter((f: any) => f.result === 'pass').length;
      const failed = moduleFindings.filter((f: any) => f.result === 'fail').length;
      const na = moduleFindings.filter((f: any) => f.result === 'not_applicable' || f.result === 'needs_manual_review').length;
      doc.fontSize(10).text(`${m.module_name}: ${m.module_score || 0}/100 (Passed: ${passed}, Failed: ${failed}, N/A: ${na})`);
    }
    doc.moveDown(1);

    // ===== SECTION 4: Executive Summary =====
    doc.fontSize(14).text('4. Executive Summary', { underline: true });
    doc.moveDown(0.3);
    const failedFindings = findings.filter((f: any) => f.result === 'fail');
    const passedFindings = findings.filter((f: any) => f.result === 'pass');
    doc.fontSize(10);
    doc.text(`This ${assessment.type} security assessment evaluated ${assessment.controls_assessed || 0} controls across ${modules.length} modules. ` +
      `${passedFindings.length} controls passed, ${failedFindings.length} failed, and ${findings.length - passedFindings.length - failedFindings.length} were not applicable.`);
    doc.moveDown(0.3);
    if (failedFindings.length > 0) {
      doc.text('Key areas requiring attention include:');
      for (const finding of failedFindings.slice(0, 5)) {
        doc.text(`  - ${finding.control_name} (${finding.severity}): ${finding.recommendation}`, { indent: 10 });
      }
    } else {
      doc.text('All evaluated controls passed. Continue monitoring and maintaining your security posture.');
    }
    doc.moveDown(1);

    // ===== SECTION 5: Detailed Assessment Report =====
    doc.fontSize(14).text('5. Detailed Assessment Report', { underline: true });
    doc.moveDown(0.3);
    for (const finding of findings) {
      const f = finding as any;
      doc.fontSize(11).text(`[${f.result.toUpperCase()}] ${f.control_name}`, { continued: false });
      doc.fontSize(9).text(`Module: ${f.module_name} | Severity: ${f.severity}`, { indent: 10 });
      if (f.evidence) doc.text(`Evidence: ${f.evidence}`, { indent: 10 });
      if (f.recommendation) doc.text(`Recommendation: ${f.recommendation}`, { indent: 10 });
      if (f.framework_refs) doc.text(`Frameworks: ${f.framework_refs}`, { indent: 10 });
      doc.moveDown(0.5);
    }

    // ===== SECTION 6: Appendix (Detailed tier only) =====
    if (assessment.type === 'detailed') {
      // Fetch detailed assessment request data for appendix
      const detailedRequests = await query(
        'SELECT * FROM detailed_assessment_requests WHERE assessment_id = ?',
        [assessmentId]
      );
      const detailedRequest = detailedRequests.length > 0 ? (detailedRequests[0] as any) : null;

      doc.addPage();
      doc.fontSize(14).text('6. Appendix', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).text('This section contains detailed assessment notes and supporting documentation.');
      doc.moveDown(0.5);

      // Manual Review Notes
      doc.font('Helvetica-Bold').fontSize(12).text('Manual Review Notes');
      doc.font('Helvetica').fontSize(10);
      doc.moveDown(0.2);
      if (detailedRequest?.manual_review_notes) {
        doc.text(detailedRequest.manual_review_notes, { indent: 10 });
      } else {
        doc.text('No manual review notes recorded for this assessment.', { indent: 10 });
      }
      doc.moveDown(0.5);

      // Supporting Documents
      doc.font('Helvetica-Bold').fontSize(12).text('Supporting Documents');
      doc.font('Helvetica').fontSize(10);
      doc.moveDown(0.2);
      const supportingDocs = detailedRequest?.supporting_docs ? JSON.parse(detailedRequest.supporting_docs) : [];
      if (supportingDocs.length > 0) {
        for (const docItem of supportingDocs) {
          doc.text(`  - ${docItem.name || docItem.filename || 'Unnamed document'}`, { indent: 10 });
        }
      } else {
        doc.text('No supporting documents were submitted for this assessment.', { indent: 10 });
      }
      doc.moveDown(0.5);

      // Assessor Sign-off
      doc.font('Helvetica-Bold').fontSize(12).text('Assessor Sign-off');
      doc.font('Helvetica').fontSize(10);
      doc.moveDown(0.2);
      if (detailedRequest?.assessor_signature) {
        doc.text(`Assessor: ${detailedRequest.assessor_signature}`, { indent: 10 });
      } else {
        doc.text('Assessor: _________________________', { indent: 10 });
      }
      if (detailedRequest?.assessor_sign_off_date) {
        doc.text(`Date: ${new Date(detailedRequest.assessor_sign_off_date).toLocaleDateString()}`, { indent: 10 });
      } else {
        doc.text('Date: ____________________', { indent: 10 });
      }
    }

    doc.end();

    stream.on('finish', async () => {
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

      res.download(filepath, `aegis-report-${assessmentId}.pdf`);
    });
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
      `SELECT f.*, cc.control_name, cc.module_name, cc.description as control_description, cc.framework_refs
       FROM findings f
       JOIN control_catalog cc ON f.control_catalog_id = cc.id
       JOIN assessment_modules am ON f.assessment_module_id = am.id
       WHERE am.assessment_id = ?`,
      [assessmentId]
    );

    // Get organization and tenant info
    const orgResult = await query(
      'SELECT o.name, tc.tenant_name FROM organizations o JOIN assessments a ON a.organization_id = o.id LEFT JOIN tenant_connections tc ON a.tenant_connection_id = tc.id WHERE a.id = ?',
      [assessmentId]
    );
    const orgName = (orgResult[0] as any)?.name || 'Unknown';
    const tenantName = (orgResult[0] as any)?.tenant_name || 'N/A';

    // Get metadata
    const metadata = await query('SELECT * FROM assessment_metadata WHERE assessment_id = ?', [assessmentId]);
    const metaMap: Record<string, string> = {};
    (metadata as any[]).forEach((m: any) => { metaMap[m.key] = m.value; });

    // Calculate duration
    const startedAt = assessment.started_at ? new Date(assessment.started_at) : null;
    const completedAt = assessment.completed_at ? new Date(assessment.completed_at) : null;
    const durationMs = startedAt && completedAt ? completedAt.getTime() - startedAt.getTime() : 0;
    const durationText = durationMs > 0 ? `${Math.round(durationMs / 1000)}s` : 'N/A';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Aegis';
    workbook.created = new Date();

    // ===== Sheet 1: Assessment Summary =====
    const summarySheet = workbook.addWorksheet('Assessment Summary');
    summarySheet.columns = [{ width: 30 }, { width: 50 }];
    summarySheet.addRow(['Aegis Security Assessment Report']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Organization', orgName]);
    summarySheet.addRow(['Tenant', tenantName]);
    summarySheet.addRow(['Assessment Type', assessment.type.toUpperCase()]);
    summarySheet.addRow(['Status', assessment.status]);
    summarySheet.addRow(['Date', completedAt ? completedAt.toLocaleDateString() : 'N/A']);
    summarySheet.addRow(['Duration', durationText]);
    summarySheet.addRow(['Controls Assessed', assessment.controls_assessed || 0]);
    summarySheet.addRow(['Overall Score', `${assessment.overall_score || 0}/100`]);
    summarySheet.addRow(['Score Band', assessment.score_band || 'N/A']);
    summarySheet.addRow(['Band Description', metaMap.band_description || '']);

    // ===== Sheet 2: Module Scores =====
    const moduleSheet = workbook.addWorksheet('Module Scores');
    moduleSheet.columns = [{ width: 25 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];
    moduleSheet.addRow(['Module', 'Score', 'Passed', 'Failed', 'N/A']);
    for (const module of modules) {
      const m = module as any;
      const moduleFindings = findings.filter((f: any) => f.module_name === m.module_name);
      const passed = moduleFindings.filter((f: any) => f.result === 'pass').length;
      const failed = moduleFindings.filter((f: any) => f.result === 'fail').length;
      const na = moduleFindings.filter((f: any) => f.result === 'not_applicable' || f.result === 'needs_manual_review').length;
      moduleSheet.addRow([m.module_name, m.module_score || 0, passed, failed, na]);
    }

    // ===== Sheet 3: Detailed Findings =====
    const findingsSheet = workbook.addWorksheet('Detailed Findings');
    findingsSheet.columns = [
      { width: 25 }, { width: 40 }, { width: 12 }, { width: 12 }, { width: 50 }, { width: 50 }, { width: 12 }, { width: 30 }
    ];
    findingsSheet.addRow(['Module', 'Control', 'Result', 'Severity', 'Evidence', 'Recommendation', 'Source', 'Frameworks']);
    for (const finding of findings) {
      const f = finding as any;
      findingsSheet.addRow([
        f.module_name,
        f.control_name,
        f.result,
        f.severity,
        f.evidence || '',
        f.recommendation || '',
        f.source || 'automated',
        f.framework_refs || '',
      ]);
    }

    // ===== Sheet 4: Executive Summary =====
    const execSheet = workbook.addWorksheet('Executive Summary');
    execSheet.columns = [{ width: 100 }];
    const failedFindings = findings.filter((f: any) => f.result === 'fail');
    const passedFindings = findings.filter((f: any) => f.result === 'pass');
    execSheet.addRow(['Executive Summary']);
    execSheet.addRow([]);
    execSheet.addRow([`This ${assessment.type} security assessment evaluated ${assessment.controls_assessed || 0} controls across ${modules.length} modules. ` +
      `${passedFindings.length} controls passed, ${failedFindings.length} failed, and ${findings.length - passedFindings.length - failedFindings.length} were not applicable.`]);
    execSheet.addRow([]);
    if (failedFindings.length > 0) {
      execSheet.addRow(['Key areas requiring attention:']);
      for (const finding of failedFindings.slice(0, 10)) {
        execSheet.addRow([`  - ${finding.control_name} (${finding.severity}): ${finding.recommendation}`]);
      }
    } else {
      execSheet.addRow(['All evaluated controls passed. Continue monitoring and maintaining your security posture.']);
    }

    // ===== Sheet 5: Appendix (Detailed tier only) =====
    if (assessment.type === 'detailed') {
      const appendixSheet = workbook.addWorksheet('Appendix');
      appendixSheet.columns = [{ width: 100 }];
      
      // Fetch detailed assessment request data
      const detailedRequests = await query(
        'SELECT * FROM detailed_assessment_requests WHERE assessment_id = ?',
        [assessmentId]
      );
      const detailedRequest = detailedRequests.length > 0 ? (detailedRequests[0] as any) : null;

      appendixSheet.addRow(['Appendix']);
      appendixSheet.addRow([]);
      
      // Manual Review Notes
      appendixSheet.addRow(['Manual Review Notes']);
      appendixSheet.addRow([]);
      if (detailedRequest?.manual_review_notes) {
        appendixSheet.addRow([detailedRequest.manual_review_notes]);
      } else {
        appendixSheet.addRow(['No manual review notes recorded for this assessment.']);
      }
      appendixSheet.addRow([]);

      // Supporting Documents
      appendixSheet.addRow(['Supporting Documents']);
      appendixSheet.addRow([]);
      const supportingDocs = detailedRequest?.supporting_docs ? JSON.parse(detailedRequest.supporting_docs) : [];
      if (supportingDocs.length > 0) {
        for (const docItem of supportingDocs) {
          appendixSheet.addRow([`  - ${docItem.name || docItem.filename || 'Unnamed document'}`]);
        }
      } else {
        appendixSheet.addRow(['No supporting documents were submitted for this assessment.']);
      }
      appendixSheet.addRow([]);

      // Assessor Sign-off
      appendixSheet.addRow(['Assessor Sign-off']);
      appendixSheet.addRow([]);
      if (detailedRequest?.assessor_signature) {
        appendixSheet.addRow([`Assessor: ${detailedRequest.assessor_signature}`]);
      } else {
        appendixSheet.addRow(['Assessor: _________________________']);
      }
      if (detailedRequest?.assessor_sign_off_date) {
        appendixSheet.addRow([`Date: ${new Date(detailedRequest.assessor_sign_off_date).toLocaleDateString()}`]);
      } else {
        appendixSheet.addRow(['Date: ____________________']);
      }
    }

    const filename = `report-${assessmentId}-${Date.now()}.xlsx`;
    const filepath = path.join(STORAGE_PATH, filename);

    await workbook.xlsx.writeFile(filepath);

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

    res.download(filepath, `aegis-report-${assessmentId}.xlsx`);
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
    const { assessmentId } = req.params;
    const data = shareReportSchema.parse(req.body);
    const { emails, message, includeFindings, includeModules } = data;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one email is required' });
    }

    // Verify assessment exists and user has access
    const assessments = await query(
      'SELECT * FROM assessments WHERE id = ? AND organization_id = ?',
      [assessmentId, req.user!.organizationId!]
    );
    if (assessments.length === 0) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    const assessment = assessments[0] as any;

    // Generate shareable link (in production, this would be a secure token-based link)
    const shareToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Link expires in 30 days

    await query(
      'INSERT INTO report_shares (id, assessment_id, shared_by, share_token, emails, message, include_findings, include_modules, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), assessmentId, req.user!.id, shareToken, JSON.stringify(emails), message || '', includeFindings ? 1 : 0, includeModules ? 1 : 0, expiresAt]
    );

    // In production, send email notifications here
    // For now, we'll just return the share link
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

    // Fetch modules and findings if requested
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
