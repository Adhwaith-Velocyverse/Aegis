export { generatePdfReport } from './pdf/pdf-report.generator';
export { generateExcelReport } from './excel/excel-report.generator';
export { validateReportData } from './utils/validation';
export { buildReportDataFromScore, buildReportDataFromScoreAndControls, type ScoreResultLike, type ActualControlResult } from './builders/report-data.builder';
export { buildReportDataFromDatabase, type AssessmentDatabaseRow, type FindingRow, type ModuleRow, type MetadataRow, type ReportAdapterInput } from './builders/route-adapter';
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
