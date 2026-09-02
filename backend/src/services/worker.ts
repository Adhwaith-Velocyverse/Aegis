import { Worker } from 'bullmq';
import { runAssessment } from './assessmentEngine';
import { getScoreForAssessment } from '../security-scoring/integration/assessment-hook';
import { sendScoreEmail } from '../security-scoring/integration/email-adapter';

const worker = new Worker('assessment-queue', async (job) => {
  const { assessmentId, type, tenantConnectionId } = job.data;

  try {
    console.info(`[Assessment] starting assessmentId=${assessmentId} type=${type}`);

    const result = await runAssessment(assessmentId, type, tenantConnectionId);
    console.info(`[Assessment] completed assessmentId=${assessmentId} status=completed score=${result.overallScore}`);

    const assessments = await require('../db/connection').query(
      'SELECT organization_id FROM assessments WHERE id = ?',
      [assessmentId]
    );

    if (assessments.length > 0) {
      const organizationId = (assessments[0] as any).organization_id;
      console.info(`[Email] organization resolved assessmentId=${assessmentId} organizationId=${organizationId}`);

      const users = await require('../db/connection').query(
        'SELECT id, email FROM users WHERE organization_id = ? AND platform_role = ?',
        [organizationId, 'client']
      );

      console.info(`[Email] client users found assessmentId=${assessmentId} count=${users.length}`);

      const securityScore = await getScoreForAssessment(assessmentId);
      if (securityScore) {
        console.info(`[Scoring] score returned assessmentId=${assessmentId} score=${securityScore.overallScore}`);
      } else {
        console.warn(`[Scoring] no score returned assessmentId=${assessmentId}`);
      }

      for (const user of users) {
        try {
          if (securityScore) {
            const maskedEmail = (user as any).email ? (user as any).email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'MISSING';
            console.info(`[Email] sending score email userId=${user.id} email=${maskedEmail} assessmentId=${assessmentId}`);
            await sendScoreEmail((user as any).id, assessmentId, securityScore);
          }
        } catch (error) {
          console.error(`[Email] skipped user userId=${user.id} assessmentId=${assessmentId} error=${(error as Error).message}`);
        }
      }
    } else {
      console.warn(`[Email] no organization found assessmentId=${assessmentId}`);
    }

    return result;
  } catch (error) {
    console.error(`Worker job failed assessmentId=${job.data?.assessmentId} error=${(error as Error).message}`);
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export default worker;
