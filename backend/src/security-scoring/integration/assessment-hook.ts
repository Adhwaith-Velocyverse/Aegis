import { query } from '../../db/connection';
import { calculateSecurityScore } from '../scoring/scoring-engine';
import { generateRecommendations } from '../recommendations/recommendation-engine';
import { getAssessmentData } from '../assessment/assessment-data-adapter';
import { saveSecurityScore } from '../persistence/score-repository';
import type { SecurityScoreResult } from '../types';

export async function processAssessmentScore(assessmentId: string): Promise<SecurityScoreResult | null> {
  try {
    console.info(`[Scoring] started assessmentId=${assessmentId}`);

    const assessment = await getAssessmentData(assessmentId);
    if (!assessment) {
      console.warn(`[Scoring] assessment not found assessmentId=${assessmentId}`);
      return null;
    }

    console.info(`[Scoring] assessment loaded assessmentId=${assessmentId} status=${assessment.status} controls=${assessment.controls.length}`);

    if (!['completed', 'partial'].includes(assessment.status)) {
      console.warn(`[Scoring] skipped due to status assessmentId=${assessmentId} status=${assessment.status}`);
      return null;
    }

    const scoreResult = calculateSecurityScore(assessment);
    console.info(`[Scoring] score calculated assessmentId=${assessmentId} score=${scoreResult.overallScore}`);

    const recommendations = await generateRecommendations(assessment, scoreResult);
    console.info(`[Scoring] recommendations generated assessmentId=${assessmentId} count=${recommendations.length}`);

    const finalResult = { ...scoreResult, recommendations, assessmentStatus: assessment.status };

    await saveSecurityScore(finalResult);
    console.info(`[Scoring] score persisted assessmentId=${assessmentId}`);

    return finalResult;
  } catch (error) {
    console.error(`[Scoring] failed assessmentId=${assessmentId} error=${(error as Error).message}`);
    return null;
  }
}

export async function getScoreForAssessment(assessmentId: string): Promise<SecurityScoreResult | null> {
  try {
    const rows = await query(
      'SELECT * FROM security_scores WHERE assessment_id = ? LIMIT 1',
      [assessmentId]
    );

    if (rows.length === 0) return null;
    const row = rows[0] as any;
    const overallScore = row.overall_score;
    if (overallScore === null || overallScore === undefined) return null;

    return {
      assessmentId: row.assessment_id,
      tenantId: row.tenant_id,
      calculatedAt: row.calculated_at,
      overallScore,
      securityRating: row.security_rating,
      summary: parseJsonField(row.summary),
      severityBreakdown: parseJsonField(row.severity_breakdown),
      categoryScores: parseJsonField(row.category_scores),
      failedControls: parseJsonField(row.failed_controls),
      recommendations: parseJsonField(row.recommendations),
      assessmentType: row.assessment_type || 'quick',
      assessmentStatus: row.assessment_status || 'completed',
    };
  } catch (error) {
    console.error(`[Scoring] load failed assessmentId=${assessmentId} error=${(error as Error).message}`);
    return null;
  }
}

function parseJsonField(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
