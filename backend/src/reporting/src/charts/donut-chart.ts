import type { SecurityAssessmentReportData } from '../types/report-data';

export interface DonutChartOptions {
  x: number;
  y: number;
  radius: number;
  innerRadius: number;
  securityPosturePercentage: number;
  riskExposurePercentage: number;
  securityPostureColor: string;
  riskExposureColor: string;
}

export function drawDonutChart(
  doc: PDFKit.PDFDocument,
  data: SecurityAssessmentReportData,
  options: Partial<DonutChartOptions> = {}
): void {
  const securityPosturePercentage = data.summary.securityPosturePercentage ?? (data.summary.percentage ?? 0);
  const riskExposurePercentage = data.summary.riskExposurePercentage ?? (100 - securityPosturePercentage);

  const radius = options.radius ?? 120;
  const innerRadius = options.innerRadius ?? 70;
  const x = options.x ?? doc.page.width / 2;
  const y = options.y ?? doc.page.height / 2 - 50;

  const securityColor = options.securityPostureColor ?? '#16a34a';
  const riskColor = options.riskExposureColor ?? '#dc2626';

  doc.save();

  const startAngleSecurity = -90;
  const endAngleSecurity = startAngleSecurity + (securityPosturePercentage / 100) * 360;
  const startAngleRisk = endAngleSecurity;
  const endAngleRisk = startAngleRisk + (riskExposurePercentage / 100) * 360;

  if (riskExposurePercentage > 0) {
    drawDonutSegment(doc as any, x, y, radius, innerRadius, startAngleRisk, endAngleRisk, riskColor);
  }

  if (securityPosturePercentage > 0) {
    drawDonutSegment(doc as any, x, y, radius, innerRadius, startAngleSecurity, endAngleSecurity, securityColor);
  }

  doc.circle(x, y, innerRadius);
  doc.fillColor('#ffffff');
  doc.fill();

  doc.fillColor('#1f2937');
  doc.fontSize(11);
  doc.text('Risk Exposure Score', x - 80, y - 15, { width: 160, align: 'center' });
  doc.fontSize(18);
  doc.text(`${riskExposurePercentage.toFixed(1)}%`, x - 80, y + 5, { width: 160, align: 'center' });

  const legendY = y + radius + 30;
  doc.fontSize(10);
  doc.fillColor(riskColor);
  doc.text('■', x - 80, legendY);
  doc.fillColor('#374151');
  doc.text(`Risk Exposure: ${riskExposurePercentage.toFixed(1)}%`, x - 60, legendY);

  doc.fillColor(securityColor);
  doc.text('■', x - 80, legendY + 18);
  doc.fillColor('#374151');
  doc.text(`Security Posture: ${securityPosturePercentage.toFixed(1)}%`, x - 60, legendY + 18);

  doc.restore();
}

function drawDonutSegment(
  doc: any,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
  color: string
): void {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const outerStartX = cx + outerRadius * Math.cos(startRad);
  const outerStartY = cy + outerRadius * Math.sin(startRad);
  const outerEndX = cx + outerRadius * Math.cos(endRad);
  const outerEndY = cy + outerRadius * Math.sin(endRad);

  const innerStartX = cx + innerRadius * Math.cos(endRad);
  const innerStartY = cy + innerRadius * Math.sin(endRad);
  const innerEndX = cx + innerRadius * Math.cos(startRad);
  const innerEndY = cy + innerRadius * Math.sin(startRad);

  doc.save();
  doc.fillColor(color);
  doc.moveTo(outerStartX, outerStartY);
  doc.arc(cx, cy, outerRadius, startAngle, endAngle, false);
  doc.lineTo(innerStartX, innerStartY);
  doc.arc(cx, cy, innerRadius, endAngle, startAngle, true);
  doc.closePath();
  doc.fill();
  doc.restore();
}
