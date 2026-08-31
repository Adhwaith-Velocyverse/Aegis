import nodemailer from 'nodemailer';
import { query } from '../db/connection';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

console.info('[Email] SMTP configuration:', {
  host: process.env.SMTP_HOST ? 'configured' : 'MISSING',
  port: process.env.SMTP_PORT || '587',
  user: process.env.SMTP_USER ? 'configured' : 'MISSING',
  pass: process.env.SMTP_PASS ? 'configured' : 'MISSING',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || 'MISSING',
});

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.info(`[Email] provider accepted message messageId=${result.messageId} to=${to.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`);
    return result;
  } catch (error) {
    console.error(`[Email] provider rejected message to=${to.replace(/(.{2})(.*)(@.*)/, '$1***$3')} error=${(error as Error).message}`);
    throw error;
  }
}

export async function createNotification(userId: string, type: string, title: string, message: string, data?: any) {
  await query(
    'INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?, ?)',
    [require('uuid').v4(), userId, type, title, message, JSON.stringify(data || {})]
  );
}

export async function notifyAssessmentComplete(userId: string, assessmentId: string, score: number) {
  await createNotification(
    userId,
    'assessment_complete',
    'Assessment Complete',
    `Your security assessment is complete. Overall score: ${score}/100`,
    { assessmentId }
  );

  // Send email
  const users = await query('SELECT email, full_name FROM users WHERE id = ?', [userId]);
  if (users.length > 0) {
    const user = users[0] as any;
    await sendEmail(
      user.email,
      'Your Aegis Security Assessment is Complete',
      `<p>Hi ${user.full_name},</p>
       <p>Your security assessment has been completed. Your overall score is <strong>${score}/100</strong>.</p>
       <p>Log in to view your detailed report.</p>`
    );
  }
}

export async function notifyAssessorAssigned(assessorId: string, assessmentId: string, clientName: string) {
  await createNotification(
    assessorId,
    'assessment_assigned',
    'New Assessment Assigned',
    `You have been assigned a new Detailed Assessment for ${clientName}`,
    { assessmentId }
  );
}

export async function notifyClientDocumentRequest(userId: string, message: string) {
  await createNotification(
    userId,
    'document_request',
    'Documents Requested',
    message,
    {}
  );
}

export async function notifySubscriptionExpiring(userId: string, daysLeft: number) {
  await createNotification(
    userId,
    'subscription_expiring',
    'Subscription Expiring Soon',
    `Your subscription will expire in ${daysLeft} days. Please renew to continue using the service.`,
    { daysLeft }
  );
}

export async function notifyAssessmentFailed(userId: string, assessmentId: string, error: string) {
  await createNotification(
    userId,
    'assessment_failed',
    'Assessment Failed',
    `Your assessment failed with error: ${error}`,
    { assessmentId }
  );
}

export async function notifyNewAssessorAdded(userId: string, assessorName: string) {
  await createNotification(
    userId,
    'assessor_added',
    'New Assessor Added',
    `${assessorName} has been added as an assessor to your organization`,
    {}
  );
}

export async function notifyAssessmentInProgress(userId: string, assessmentId: string, type: string) {
  await createNotification(
    userId,
    'assessment_in_progress',
    'Assessment In Progress',
    `Your ${type} assessment is now in progress. You will be notified when it's complete.`,
    { assessmentId }
  );
}
