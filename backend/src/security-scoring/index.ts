export { calculateSecurityScore } from './scoring/scoring-engine';
export { generateRecommendations } from './recommendations/recommendation-engine';
export { processAssessmentScore } from './integration/assessment-hook';
export { getScoreForAssessment } from './integration/assessment-hook';
export { attachScoreToReport } from './integration/report-adapter';
export { sendScoreEmail } from './integration/email-adapter';
export { getAssessmentData } from './assessment/assessment-data-adapter';
export { saveSecurityScore, getLatestScore, getScoreByAssessmentId } from './persistence/score-repository';
export type {
  NormalizedAssessment,
  NormalizedControlResult,
  CategoryScore,
  ControlScore,
  Recommendation,
  SecurityScoreResult,
  ScoreRepository,
  AssessmentDataProvider,
  ReportDataProvider,
  EmailNotifier,
} from './types';
export { SCORING_CONFIG } from './config/scoring-config';
export { EMAIL_CONTROL_SCORING_RULES, EMAIL_CATEGORY_WEIGHTS, getEmailControlRule, getEmailCategoryWeight } from './config/email-scoring-config';
export type { EmailControlScoringRule, EmailControlCategory } from './config/email-scoring-config';
