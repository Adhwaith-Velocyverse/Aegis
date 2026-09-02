import { query } from '../../db/connection';
import { calculateSecurityScore } from '../scoring/scoring-engine';
import { generateRecommendations } from '../recommendations/recommendation-engine';
import { getAssessmentData } from '../assessment/assessment-data-adapter';
import { saveSecurityScore, getScoreByAssessmentId } from '../persistence/score-repository';
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
    return await getScoreByAssessmentId(assessmentId);
  } catch (error) {
    console.error(`[Scoring] load failed assessmentId=${assessmentId} error=${(error as Error).message}`);
    return null;
  }
}
