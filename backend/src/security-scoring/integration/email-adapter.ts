import { sendEmail, createNotification } from '../../services/notifications';
import { query } from '../../db/connection';
import type { SecurityScoreResult } from '../types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendScoreEmail(userId: string, assessmentId: string, score: SecurityScoreResult): Promise<void> {
  console.info(`[Email] preparing security score email assessmentId=${assessmentId} userId=${userId}`);

  const topRecommendations = score.recommendations.slice(0, 5);
  const recommendationsHtml = topRecommendations.length > 0
    ? `<ul>${topRecommendations.map(r => `<li>${escapeHtml(r.title)}: ${escapeHtml(r.description)}</li>`).join('')}</ul>`
    : '<p>No recommendations were identified.</p>';

  const html = `
    <h2>Security Assessment Completed</h2>
    <p><strong>Overall Security Score:</strong> ${escapeHtml(String(score.overallScore))}/100</p>
    <p><strong>Security Rating:</strong> ${escapeHtml(score.securityRating)}</p>
    <p><strong>Assessment Type:</strong> ${escapeHtml(score.assessmentType)}</p>
    <h3>Controls Summary</h3>
    <ul>
      <li>Passed: ${escapeHtml(String(score.summary.passedControls))}</li>
      <li>Partial: ${escapeHtml(String(score.summary.partialControls))}</li>
      <li>Failed: ${escapeHtml(String(score.summary.failedControls))}</li>
      <li>Not Assessed: ${escapeHtml(String(score.summary.notAssessedControls))}</li>
    </ul>
    <h3>Severity Breakdown</h3>
    <ul>
      <li>Critical Issues: ${escapeHtml(String(score.severityBreakdown.critical))}</li>
      <li>High Issues: ${escapeHtml(String(score.severityBreakdown.high))}</li>
      <li>Medium Issues: ${escapeHtml(String(score.severityBreakdown.medium))}</li>
      <li>Low Issues: ${escapeHtml(String(score.severityBreakdown.low))}</li>
    </ul>
    <h3>Top Recommendations</h3>
    ${recommendationsHtml}
    <p>The detailed report is available in the application.</p>
  `;

  await createNotification(
    userId,
    'assessment_score_detail',
    'Security Score & Recommendations',
    `Your security assessment scored ${score.overallScore}/100 (${score.securityRating}).`,
    { assessmentId, overallScore: score.overallScore, securityRating: score.securityRating }
  );
  console.info(`[Email] notification created userId=${userId} assessmentId=${assessmentId}`);

  const users = await query('SELECT email, full_name FROM users WHERE id = ?', [userId]);
  if (users.length > 0) {
    const user = users[0] as any;
    const recipient = user.email;
    if (!recipient || typeof recipient !== 'string' || !recipient.includes('@')) {
      console.warn(`[Email] skipped invalid recipient userId=${userId} assessmentId=${assessmentId}`);
      return;
    }

    const maskedRecipient = recipient.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    console.info(`[Email] recipient resolved userId=${userId} email=${maskedRecipient} assessmentId=${assessmentId}`);

    try {
      const result = await sendEmail(
        recipient,
        'Your Aegis Security Assessment Score & Recommendations',
        `<p>Hi ${escapeHtml(user.full_name || 'User')},</p>${html}`
      );
      console.info(`[Email] provider accepted message assessmentId=${assessmentId} userId=${userId} messageId=${result?.messageId}`);
    } catch (error: any) {
      console.error(`[Email] failed assessmentId=${assessmentId} userId=${userId} error=${error?.message || error}`);
      throw error;
    }
  } else {
    console.warn(`[Email] recipient not found userId=${userId} assessmentId=${assessmentId}`);
  }
}
