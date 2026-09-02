export type ControlStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_ASSESSED' | 'ERROR' | 'INFO';
export type ControlSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface NormalizedControlResult {
  controlId: string;
  name: string;
  moduleName: string;
  category?: string;
  status: ControlStatus;
  severity: ControlSeverity | string;
  weight: number;
  evidence?: unknown;
  recommendation?: string;
  description?: string;
}

export interface NormalizedAssessment {
  assessmentId: string;
  tenantId: string;
  organizationId: string;
  assessmentType: string;
  collectedAt: string;
  status: string;
  controls: NormalizedControlResult[];
  moduleNames?: string[];
}

export interface CategoryScore {
  name: string;
  score: number;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  partialControls: number;
  notAssessedControls: number;
}

export interface ControlScore {
  controlId: string;
  name: string;
  status: ControlStatus;
  severity: string;
  weight: number;
  score: number;
  moduleName: string;
  category?: string;
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

export interface SecurityScoreResult {
  assessmentId: string;
  tenantId: string;
  calculatedAt: string;
  overallScore: number | null;
  securityRating: string;
  assessmentStatus: string;
  summary: {
    totalControls: number;
    assessedControls: number;
    passedControls: number;
    failedControls: number;
    partialControls: number;
    notAssessedControls: number;
    technicalErrors: number;
  };
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryScores: CategoryScore[];
  failedControls: ControlScore[];
  recommendations: Recommendation[];
  assessmentType: string;
  durationMs?: number;
}

export interface ScoreRepository {
  saveScore(result: SecurityScoreResult): Promise<void>;
  getLatestScore(tenantId: string): Promise<SecurityScoreResult | null>;
  getScoreByAssessmentId(assessmentId: string): Promise<SecurityScoreResult | null>;
}

export interface AssessmentDataProvider {
  getLatestAssessment(tenantId: string): Promise<NormalizedAssessment | null>;
  getAssessmentById(assessmentId: string): Promise<NormalizedAssessment | null>;
}

export interface ReportDataProvider {
  attachSecurityScore(assessmentId: string, score: SecurityScoreResult): Promise<void>;
}

export interface EmailNotifier {
  sendSecurityScore(tenantId: string, score: SecurityScoreResult): Promise<void>;
}
