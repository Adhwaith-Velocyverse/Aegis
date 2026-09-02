export type ControlResultStatus = 'PASSED' | 'FAILED' | 'PARTIAL' | 'MANUAL_REVIEW' | 'NOT_APPLICABLE';

export interface SecurityControlResult {
  id: string;
  name: string;
  category?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  maximumScore?: number;
  result: ControlResultStatus;
  evidence?: string;
  recommendation?: string;
}

export interface Recommendation {
  id: string;
  controlId: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priority: number;
  remediation?: string;
  reason?: string;
  affectedControls?: string[];
}

export interface InformationalControl {
  id: string;
  title: string;
  evidence: string;
  details?: Record<string, unknown>;
}

export interface FailedEndpoint {
  endpoint: string;
  errorType: string;
  errorMessage: string;
  statusCode?: number;
  description?: string;
  impact?: string;
}

export interface AssessmentInfo {
  assessmentId: string;
  assessmentType: string;
  assessmentName?: string;
  tenantName?: string;
  assessmentDate: string;
  status?: string;
  durationMs?: number;
}

export interface AssessmentSummary {
  totalControls: number;
  actionableControls: number;
  passed: number;
  failed: number;
  partial: number;
  manualReview: number;
  notApplicable: number;
  totalScore: number;
  maximumScore: number;
  percentage: number | null;
  riskExposurePercentage?: number;
  securityPosturePercentage?: number;
}

export interface SecurityAssessmentReportData {
  assessment: AssessmentInfo;
  summary: AssessmentSummary;
  controls: SecurityControlResult[];
  recommendations: Recommendation[];
  informationalControls?: InformationalControl[];
  failedEndpoints?: FailedEndpoint[];
  metadata?: Record<string, unknown>;
}

export interface ReportGenerationOptions {
  outputPath: string;
  filename?: string;
  includeInformationalControls?: boolean;
  includeFailedEndpoints?: boolean;
  includeRecommendations?: boolean;
}

export interface GeneratedReport {
  filename: string;
  filepath: string;
  format: 'pdf' | 'excel';
  sizeBytes: number;
  generatedAt: string;
}
