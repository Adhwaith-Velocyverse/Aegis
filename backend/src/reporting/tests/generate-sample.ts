import { generatePdfReport, generateExcelReport, validateReportData } from '../src';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const samplePath = join(__dirname, 'sample-email-security-report.json');
  const rawData = readFileSync(samplePath, 'utf-8');
  const reportData = JSON.parse(rawData);

  validateReportData(reportData);

  const pdfPath = join(__dirname, 'sample-email-security-assessment.pdf');
  const excelPath = join(__dirname, 'sample-email-security-assessment.xlsx');

  console.log('Generating PDF report...');
  await generatePdfReport(reportData, {
    outputPath: pdfPath,
    title: 'Email Security Assessment Report',
    subtitle: 'Executive Summary',
  });
  console.log(`PDF generated: ${pdfPath}`);

  console.log('Generating Excel report...');
  await generateExcelReport(reportData, excelPath);
  console.log(`Excel generated: ${excelPath}`);

  console.log('Done.');
}

main().catch((err) => {
  console.error('Report generation failed:', err);
  process.exit(1);
});
