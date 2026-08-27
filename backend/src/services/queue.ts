import { Queue } from 'bullmq';

export const assessmentQueue = new Queue('assessment-queue', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export async function enqueueAssessment(assessmentId: string, type: 'quick' | 'detailed', tenantConnectionId: string) {
  await assessmentQueue.add('run-assessment', {
    assessmentId,
    type,
    tenantConnectionId,
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}
