import ExcelJS from 'exceljs';
import type { SecurityAssessmentReportData } from '../types/report-data';
import { formatDate } from '../utils/formatting';

export async function generateExcelReport(data: SecurityAssessmentReportData, outputPath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Aegis';
  workbook.created = new Date();

  // ===== Sheet 1: Executive Summary =====
  const summarySheet = workbook.addWorksheet('Executive Summary');
  summarySheet.columns = [{ width: 35 }, { width: 50 }];

  summarySheet.addRow(['Aegis Security Assessment Report']);
  summarySheet.addRow([]);
  summarySheet.addRow(['Tenant', data.assessment.tenantName || 'N/A']);
  summarySheet.addRow(['Assessment ID', data.assessment.assessmentId]);
  summarySheet.addRow(['Assessment Type', data.assessment.assessmentType.toUpperCase()]);
  summarySheet.addRow(['Assessment Date', formatDate(data.assessment.assessmentDate)]);
  summarySheet.addRow(['Status', data.assessment.status || 'N/A']);
  summarySheet.addRow([]);
  summarySheet.addRow(['Overall Score', `${data.summary.totalScore}/${data.summary.maximumScore}`]);
  summarySheet.addRow(['Pass Rate', data.summary.percentage !== null ? `${data.summary.percentage.toFixed(1)}%` : 'N/A']);
  summarySheet.addRow(['Security Posture', `${(data.summary.securityPosturePercentage ?? data.summary.percentage ?? 0).toFixed(1)}%`]);
  summarySheet.addRow(['Risk Exposure', `${(data.summary.riskExposurePercentage ?? (100 - (data.summary.percentage ?? 0))).toFixed(1)}%`]);
  summarySheet.addRow([]);
  summarySheet.addRow(['Passed Controls', data.summary.passed]);
  summarySheet.addRow(['Failed Controls', data.summary.failed]);
  summarySheet.addRow(['Partial Controls', data.summary.partial]);
  summarySheet.addRow(['Manual Review', data.summary.manualReview]);
  summarySheet.addRow(['Not Applicable', data.summary.notApplicable]);

  // ===== Sheet 2: Control Results =====
  const controlsSheet = workbook.addWorksheet('Control Results');
  controlsSheet.columns = [
    { header: 'Control ID', width: 28 },
    { header: 'Control Name', width: 45 },
    { header: 'Category', width: 25 },
    { header: 'Severity', width: 12 },
    { header: 'Result', width: 15 },
    { header: 'Score', width: 10 },
    { header: 'Max Score', width: 12 },
    { header: 'Evidence', width: 60 },
    { header: 'Recommendation', width: 60 },
  ];

  const headerRow = controlsSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

  for (const control of data.controls) {
    controlsSheet.addRow([
      control.id,
      control.name,
      control.category || 'N/A',
      control.severity,
      control.result,
      control.score,
      control.maximumScore || control.score,
      control.evidence || '',
      control.recommendation || '',
    ]);
  }

  controlsSheet.views = [{ state: 'frozen' }];

  // ===== Sheet 3: Recommendations =====
  if (data.recommendations && data.recommendations.length > 0) {
    const recSheet = workbook.addWorksheet('Recommendations');
    recSheet.columns = [
      { header: 'Priority', width: 10 },
      { header: 'Title', width: 45 },
      { header: 'Severity', width: 12 },
      { header: 'Control', width: 28 },
      { header: 'Description', width: 60 },
      { header: 'Remediation', width: 60 },
      { header: 'Reason', width: 60 },
    ];

    const recHeaderRow = recSheet.getRow(1);
    recHeaderRow.font = { bold: true };
    recHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

    for (const rec of data.recommendations) {
      recSheet.addRow([
        rec.priority,
        rec.title,
        rec.severity,
        rec.controlId,
        rec.description,
        rec.remediation || '',
        rec.reason || '',
      ]);
    }

    recSheet.views = [{ state: 'frozen' }];
  }

  // ===== Sheet 4: Informational Controls =====
  if (data.informationalControls && data.informationalControls.length > 0) {
    const infoSheet = workbook.addWorksheet('Informational Controls');
    infoSheet.columns = [
      { header: 'ID', width: 28 },
      { header: 'Title', width: 45 },
      { header: 'Evidence', width: 70 },
    ];

    const infoHeaderRow = infoSheet.getRow(1);
    infoHeaderRow.font = { bold: true };
    infoHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

    for (const info of data.informationalControls) {
      infoSheet.addRow([
        info.id,
        info.title,
        info.evidence,
      ]);
    }

    infoSheet.views = [{ state: 'frozen' }];
  }

  // ===== Sheet 5: Failed Endpoints =====
  if (data.failedEndpoints && data.failedEndpoints.length > 0) {
    const endpointSheet = workbook.addWorksheet('Failed Endpoints');
    endpointSheet.columns = [
      { header: 'Endpoint', width: 30 },
      { header: 'Error Type', width: 25 },
      { header: 'Error Message', width: 70 },
      { header: 'Status Code', width: 15 },
      { header: 'Impact', width: 70 },
    ];

    const epHeaderRow = endpointSheet.getRow(1);
    epHeaderRow.font = { bold: true };
    epHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

    for (const endpoint of data.failedEndpoints) {
      endpointSheet.addRow([
        endpoint.endpoint,
        endpoint.errorType,
        endpoint.errorMessage,
        endpoint.statusCode || 'N/A',
        endpoint.impact || '',
      ]);
    }

    endpointSheet.views = [{ state: 'frozen' }];
  }

  await workbook.xlsx.writeFile(outputPath);
}
