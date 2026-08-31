import PDFDocument from 'pdfkit';
import type { SecurityAssessmentReportData } from '../types/report-data';
import { drawDonutChart } from '../charts/donut-chart';
import { formatDate, truncateText } from '../utils/formatting';

export interface PdfReportOptions {
  outputPath: string;
  title?: string;
  subtitle?: string;
  author?: string;
  subject?: string;
}

export async function generatePdfReport(data: SecurityAssessmentReportData, options: PdfReportOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const { outputPath, title = 'Security Assessment Report', subtitle = 'Executive Summary', author = 'Aegis Security Assessment Platform', subject = `Security Assessment Report - ${data.assessment.assessmentId}` } = options;

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = require('fs').createWriteStream(outputPath);
      doc.pipe(stream);

      doc.info['Title'] = title;
      doc.info['Author'] = author;
      doc.info['Subject'] = subject;
      doc.info['Creator'] = 'Aegis Reporting Module';
      doc.info['CreationDate'] = new Date();

      // ===== COVER PAGE =====
      doc.fontSize(24).font('Helvetica-Bold').text('Overall Security Posture', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).font('Helvetica').text(`${data.assessment.assessmentName || data.assessment.assessmentType} security assessment summary`, { align: 'center' });
      doc.moveDown(1);

      drawDonutChart(doc, data, {
        x: doc.page.width / 2,
        y: 180,
        radius: 120,
        innerRadius: 70,
      });

      doc.moveDown(180);
      doc.fontSize(10);
      doc.text(`Tenant: ${data.assessment.tenantName || 'N/A'}`, { align: 'center' });
      doc.text(`Assessment ID: ${data.assessment.assessmentId}`, { align: 'center' });
      doc.text(`Assessment Date: ${formatDate(data.assessment.assessmentDate)}`, { align: 'center' });

      // ===== PAGE 2: ASSESSMENT OVERVIEW =====
      doc.addPage();
      doc.fontSize(16).text('Assessment Overview', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);

      const overviewItems = [
        ['Total Actionable Controls', data.summary.actionableControls.toString()],
        ['Passed Controls', data.summary.passed.toString()],
        ['Failed Controls', data.summary.failed.toString()],
        ['Partial Controls', data.summary.partial.toString()],
        ['Manual Review', data.summary.manualReview.toString()],
        ['Not Applicable', data.summary.notApplicable.toString()],
        ['Overall Score', `${data.summary.totalScore}/${data.summary.maximumScore}`],
        ['Pass Rate', data.summary.percentage !== null ? `${data.summary.percentage.toFixed(1)}%` : 'N/A'],
        ['Security Posture', `${(data.summary.securityPosturePercentage ?? data.summary.percentage ?? 0).toFixed(1)}%`],
        ['Risk Exposure', `${(data.summary.riskExposurePercentage ?? (100 - (data.summary.percentage ?? 0))).toFixed(1)}%`],
      ];

      for (const [label, value] of overviewItems) {
        doc.text(`${label}: ${value}`, { continued: false });
      }

      doc.moveDown(1);

      // ===== EXECUTIVE SUMMARY =====
      doc.fontSize(16).text('Executive Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);

      const failedControls = data.controls.filter(c => c.result === 'FAILED');
      const passedControls = data.controls.filter(c => c.result === 'PASSED');

      doc.text(`This ${data.assessment.assessmentType} security assessment evaluated ${data.summary.totalControls} controls. ` +
        `${passedControls.length} controls passed, ${failedControls.length} failed, and ${data.summary.notApplicable} were not applicable.`);

      doc.moveDown(0.5);

      if (failedControls.length > 0) {
        doc.font('Helvetica-Bold').text('Key Strengths');
        doc.font('Helvetica');
        doc.moveDown(0.2);
        for (const control of passedControls.slice(0, 5)) {
          doc.text(`• ${control.name} (${control.severity})`, { indent: 10 });
        }
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').text('Areas for Improvement');
        doc.font('Helvetica');
        doc.moveDown(0.2);
        for (const control of failedControls.slice(0, 10)) {
          doc.text(`• ${control.name} (${control.severity}): ${truncateText(control.recommendation || 'No recommendation provided', 120)}`, { indent: 10 });
        }
      } else {
        doc.text('All evaluated controls passed. Continue monitoring and maintaining your security posture.');
      }

      doc.moveDown(1);

      // ===== CONTROL RESULTS =====
      doc.addPage();
      doc.fontSize(16).text('Control Results', { underline: true });
      doc.moveDown(0.5);

      for (const control of data.controls) {
        const statusColor = getStatusColor(control.result);
        doc.fontSize(11).font('Helvetica-Bold').text(`[${control.result}] ${control.name}`);
        doc.font('Helvetica').fontSize(9);
        doc.text(`Category: ${control.category || 'N/A'} | Severity: ${control.severity} | Score: ${control.score}${control.maximumScore ? `/${control.maximumScore}` : ''}`, { indent: 10 });
        if (control.evidence) {
          doc.text(`Evidence: ${truncateText(control.evidence, 200)}`, { indent: 10 });
        }
        if (control.recommendation) {
          doc.text(`Recommendation: ${truncateText(control.recommendation, 200)}`, { indent: 10 });
        }
        doc.moveDown(0.3);

        if (doc.y > 700) {
          doc.addPage();
        }
      }

      // ===== RECOMMENDATIONS =====
      if (data.recommendations && data.recommendations.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('Recommendations', { underline: true });
        doc.moveDown(0.5);

        for (const rec of data.recommendations) {
          doc.fontSize(11).font('Helvetica-Bold').text(`${rec.priority}. ${rec.title}`);
          doc.font('Helvetica').fontSize(9);
          doc.text(`Severity: ${rec.severity}`, { indent: 10 });
          doc.text(`Description: ${truncateText(rec.description, 200)}`, { indent: 10 });
          if (rec.remediation) {
            doc.text(`Remediation: ${truncateText(rec.remediation, 200)}`, { indent: 10 });
          }
          doc.moveDown(0.3);

          if (doc.y > 700) {
            doc.addPage();
          }
        }
      }

      // ===== INFORMATIONAL CONTROLS =====
      if (data.informationalControls && data.informationalControls.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('Informational Controls', { underline: true });
        doc.moveDown(0.5);

        for (const info of data.informationalControls) {
          doc.fontSize(10).font('Helvetica-Bold').text(info.title);
          doc.font('Helvetica').fontSize(9);
          doc.text(`Evidence: ${info.evidence}`, { indent: 10 });
          doc.moveDown(0.3);
        }
      }

      // ===== FAILED ENDPOINTS =====
      if (data.failedEndpoints && data.failedEndpoints.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('Data Collection Issues', { underline: true });
        doc.moveDown(0.5);

        for (const endpoint of data.failedEndpoints) {
          doc.fontSize(10).font('Helvetica-Bold').text(endpoint.endpoint);
          doc.font('Helvetica').fontSize(9);
          doc.text(`Type: ${endpoint.errorType}`, { indent: 10 });
          doc.text(`Error: ${endpoint.errorMessage}`, { indent: 10 });
          if (endpoint.description) {
            doc.text(`Description: ${endpoint.description}`, { indent: 10 });
          }
          if (endpoint.impact) {
            doc.text(`Impact: ${endpoint.impact}`, { indent: 10 });
          }
          doc.moveDown(0.3);
        }
      }

      // ===== CONCLUSION =====
      doc.addPage();
      doc.fontSize(16).text('Conclusion', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);

      if (data.summary.percentage === null) {
        doc.text('This assessment could not be scored due to insufficient evaluated controls. Review data collection issues and retry the assessment.');
      } else if (data.summary.percentage >= 80) {
        doc.text('The assessed environment demonstrates a strong security posture. Continue monitoring and maintaining existing security controls.');
      } else if (data.summary.percentage >= 50) {
        doc.text('The assessed environment has moderate security gaps that should be addressed. Prioritize the recommendations in this report to improve the overall security posture.');
      } else {
        doc.text('The assessed environment has significant security weaknesses that require immediate attention. Address the critical and high-severity recommendations in this report as a priority.');
      }

      // Footer
      doc.fontSize(8);
      doc.text('Generated by Aegis Security Assessment Platform', 50, doc.page.height - 30, { align: 'center' });
      doc.text(`Page ${doc.bufferedPageRange().start + 1}`, doc.page.width - 100, doc.page.height - 30, { align: 'right' });

      doc.end();

      stream.on('finish', () => {
        resolve();
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PASSED':
      return '#16a34a';
    case 'FAILED':
      return '#dc2626';
    case 'PARTIAL':
      return '#f59e0b';
    case 'MANUAL_REVIEW':
      return '#f97316';
    case 'NOT_APPLICABLE':
      return '#9ca3af';
    default:
      return '#374151';
  }
}
