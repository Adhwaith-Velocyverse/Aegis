import type {
  SecurityAssessmentReportData,
  SecurityControlResult,
  Recommendation,
  InformationalControl,
  FailedEndpoint,
} from '../types/report-data';

export interface ScoreResultLike {
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
  severityBreakdown: Record<string, number>;
  categoryScores: Array<{
    name: string;
    score: number;
    totalControls: number;
    passedControls: number;
    failedControls: number;
    partialControls: number;
    notAssessedControls: number;
  }>;
  failedControls: Array<{
    controlId: string;
    name: string;
    status: string;
    severity: string;
    weight: number;
    score: number;
    moduleName: string;
    category?: string;
  }>;
  recommendations: Array<{
    id: string;
    controlId: string;
    title: string;
    description: string;
    severity: string;
    priority: number;
    remediation?: string;
    reason?: string;
    affectedControls?: string[];
  }>;
  assessmentType: string;
  durationMs?: number;
}

export function buildReportDataFromScore(scoreResult: ScoreResultLike): SecurityAssessmentReportData {
  const overallScore = scoreResult.overallScore ?? 0;
  const maximumScore = 100;
  const percentage = scoreResult.overallScore;
  const securityPosturePercentage = percentage ?? 0;
  const riskExposurePercentage = 100 - securityPosturePercentage;

  const controls: SecurityControlResult[] = [];
  const controlSet = new Set<string>();

  for (const cat of scoreResult.categoryScores) {
    for (let i = 0; i < cat.passedControls; i++) {
      controls.push({
        id: `${cat.name}-passed-${controls.length}`,
        name: `${cat.name} - Passed Control`,
        category: cat.name,
        severity: 'MEDIUM',
        score: 100,
        maximumScore: 100,
        result: 'PASSED',
        evidence: 'Control passed assessment.',
        recommendation: '',
      });
    }
  }

  for (const fc of scoreResult.failedControls) {
    const key = `${fc.controlId}-${fc.status}`;
    if (!controlSet.has(key)) {
      controlSet.add(key);
      controls.push({
        id: fc.controlId,
        name: fc.name,
        category: fc.category || fc.moduleName,
        severity: (fc.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') || 'MEDIUM',
        score: fc.score,
        maximumScore: 100,
        result: fc.status === 'FAIL' ? 'FAILED' : fc.status === 'PARTIAL' ? 'PARTIAL' : 'MANUAL_REVIEW',
        evidence: `Control assessed as ${fc.status}.`,
        recommendation: 'Review control configuration and remediate findings.',
      });
    }
  }

  const recommendations: Recommendation[] = scoreResult.recommendations.map(r => ({
    id: r.id,
    controlId: r.controlId,
    title: r.title,
    description: r.description,
    severity: r.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
    priority: r.priority,
    remediation: r.remediation,
    reason: r.reason,
    affectedControls: r.affectedControls,
  }));

  const informationalControls: InformationalControl[] = [];
  const failedEndpoints: FailedEndpoint[] = [];

  return {
    assessment: {
      assessmentId: scoreResult.assessmentId,
      assessmentType: scoreResult.assessmentType,
      assessmentName: `${scoreResult.assessmentType} Security Assessment`,
      tenantName: scoreResult.tenantId,
      assessmentDate: scoreResult.calculatedAt,
      status: scoreResult.assessmentStatus,
      durationMs: scoreResult.durationMs,
    },
    summary: {
      totalControls: scoreResult.summary.totalControls,
      actionableControls: scoreResult.summary.assessedControls,
      passed: scoreResult.summary.passedControls,
      failed: scoreResult.summary.failedControls,
      partial: scoreResult.summary.partialControls,
      manualReview: scoreResult.summary.notAssessedControls,
      notApplicable: scoreResult.summary.notAssessedControls,
      totalScore: overallScore,
      maximumScore,
      percentage: percentage,
      riskExposurePercentage,
      securityPosturePercentage,
    },
    controls,
    recommendations,
    informationalControls,
    failedEndpoints,
    metadata: {
      severityBreakdown: scoreResult.severityBreakdown,
      categoryScores: scoreResult.categoryScores,
    },
  };
}
