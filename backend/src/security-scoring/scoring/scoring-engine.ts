import { SCORING_CONFIG } from '../config/scoring-config';
import type {
  NormalizedAssessment,
  NormalizedControlResult,
  CategoryScore,
  ControlScore,
  SecurityScoreResult,
} from '../types';

export function calculateSecurityScore(assessment: NormalizedAssessment): SecurityScoreResult {
  const controls = assessment.controls || [];
  const now = new Date().toISOString();

  let totalWeightedScore = 0;
  let totalWeight = 0;
  let passedControls = 0;
  let failedControls = 0;
  let partialControls = 0;
  let notAssessedControls = 0;
  let technicalErrors = 0;
  let assessedControls = 0;

  const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
  const categoryMap = new Map<string, { controls: NormalizedControlResult[] }>();
  const failedControlScores: ControlScore[] = [];

  for (const control of controls) {
    const status = mapStatus(control.status);
    const severity = mapSeverity(control.severity);
    const weight = control.weight || 1;
    const statusWeight = SCORING_CONFIG.statusWeights[status] ?? 0;
    const severityWeight = SCORING_CONFIG.severityWeights[severity] ?? 1;

    if (['PASS', 'PARTIAL', 'FAIL'].includes(status)) {
      totalWeightedScore += statusWeight * severityWeight * weight;
      totalWeight += severityWeight * weight;
      assessedControls++;
    }

    if (status === 'PASS') passedControls++;
    else if (status === 'FAIL') {
      failedControls++;
      failedControlScores.push({
        controlId: control.controlId,
        name: control.name,
        status,
        severity,
        weight,
        score: 0,
        moduleName: control.moduleName,
        category: control.category,
      });
    } else if (status === 'PARTIAL') partialControls++;
    else if (status === 'NOT_ASSESSED') notAssessedControls++;
    else if (['ERROR', 'INFO'].includes(status)) {
      notAssessedControls++;
      technicalErrors++;
    }

    severityBreakdown[severity.toLowerCase() as keyof typeof severityBreakdown]++;

    const categoryKey = control.category || control.moduleName || 'General';
    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, { controls: [] });
    }
    categoryMap.get(categoryKey)!.controls.push(control);
  }

  const overallScore = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 100) : null;
  const ratingResult = overallScore === null ? { rating: 'No Data', color: 'gray' } : getRating(overallScore);

  const categoryScores: CategoryScore[] = [];
  for (const [name, group] of categoryMap) {
    let catWeighted = 0;
    let catWeight = 0;
    let catPassed = 0;
    let catFailed = 0;
    let catPartial = 0;
    let catNA = 0;

    for (const c of group.controls) {
      const s = mapStatus(c.status);
      const sv = mapSeverity(c.severity);
      const w = c.weight || 1;
      const sw = SCORING_CONFIG.severityWeights[sv] ?? 1;

      if (['PASS', 'PARTIAL', 'FAIL'].includes(s)) {
        catWeighted += (SCORING_CONFIG.statusWeights[s] ?? 0) * sw * w;
        catWeight += sw * w;
      }

      if (s === 'PASS') catPassed++;
      else if (s === 'FAIL') catFailed++;
      else if (s === 'PARTIAL') catPartial++;
      else catNA++;
    }

    categoryScores.push({
      name,
      score: catWeight > 0 ? Math.round((catWeighted / catWeight) * 100) : 0,
      totalControls: group.controls.length,
      passedControls: catPassed,
      failedControls: catFailed,
      partialControls: catPartial,
      notAssessedControls: catNA,
    });
  }

  categoryScores.sort((a, b) => a.name.localeCompare(b.name));
  failedControlScores.sort((a, b) => {
    const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });

  return {
    assessmentId: assessment.assessmentId,
    tenantId: assessment.tenantId,
    calculatedAt: now,
    overallScore,
    securityRating: ratingResult.rating,
    assessmentStatus: assessment.status,
    summary: {
      totalControls: controls.length,
      assessedControls,
      passedControls,
      failedControls,
      partialControls,
      notAssessedControls,
      technicalErrors,
    },
    severityBreakdown,
    categoryScores,
    failedControls: failedControlScores,
    recommendations: [],
    assessmentType: assessment.assessmentType,
  };
}

function mapStatus(status: string): string {
  const upper = status.toUpperCase();
  if (['PASS', 'FAIL', 'PARTIAL', 'NOT_ASSESSED', 'ERROR', 'INFO'].includes(upper)) {
    return upper;
  }
  return 'NOT_ASSESSED';
}

function mapSeverity(severity: string): string {
  const upper = severity.toUpperCase();
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(upper)) {
    return upper;
  }
  return 'MEDIUM';
}

function getRating(score: number): { rating: string; color: string } {
  for (const threshold of SCORING_CONFIG.ratingThresholds) {
    if (score >= threshold.min && score <= threshold.max) {
      return { rating: threshold.rating, color: threshold.color };
    }
  }
  return { rating: 'Critical', color: 'red' };
}
