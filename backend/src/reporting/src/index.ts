export { generatePdfReport } from './pdf/pdf-report.generator';
export { generateExcelReport } from './excel/excel-report.generator';
export { validateReportData } from './utils/validation';
export { buildReportDataFromScore } from './builders/report-data.builder';
export { drawDonutChart } from './charts/donut-chart';
export type {
  SecurityAssessmentReportData,
  AssessmentInfo,
  AssessmentSummary,
  SecurityControlResult,
  Recommendation,
  InformationalControl,
  FailedEndpoint,
  ReportGenerationOptions,
  GeneratedReport,
  ControlResultStatus,
} from './types/report-data';
