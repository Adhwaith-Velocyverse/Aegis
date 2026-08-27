import { Worker } from 'bullmq';
import { runAssessment } from './assessmentEngine';
import { notifyAssessmentComplete } from './notifications';

const worker = new Worker('assessment-queue', async (job) => {
  const { assessmentId, type, tenantConnectionId } = job.data;

  try {
    const result = await runAssessment(assessmentId, type, tenantConnectionId);

    // Notify user
    const assessments = await require('../db/connection').query(
      'SELECT organization_id FROM assessments WHERE id = ?',
      [assessmentId]
    );

    if (assessments.length > 0) {
      const users = await require('../db/connection').query(
        'SELECT id FROM users WHERE organization_id = ? AND platform_role = ?',
        [(assessments[0] as any).organization_id, 'client']
      );

      for (const user of users) {
        await notifyAssessmentComplete((user as any).id, assessmentId, result.overallScore);
      }
    }

    return result;
  } catch (error) {
    console.error('Worker job failed:', error);
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

export default worker;
