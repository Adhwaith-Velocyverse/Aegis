import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sendEmail } from '../services/notifications';

const router = express.Router();

// In-memory store for password reset tokens (in production, use Redis with TTL)
const resetTokenStore = new Map<string, { userId: string; expiresAt: Date }>();

// Request password reset
router.post('/request', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
    });
    const { email } = schema.parse(req.body);

    const users = await query('SELECT id, email, full_name FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      // Don't reveal whether email exists (security best practice)
      return res.json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.',
      });
    }

    const user = users[0] as any;
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    resetTokenStore.set(token, {
      userId: user.id,
      expiresAt,
    });

    // Send email with reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    console.log(`Password reset for ${user.email}: ${resetLink}`);

    await sendEmail(
      user.email,
      'Reset Your Aegis Password',
      `<p>Hi ${user.full_name},</p>
       <p>You requested a password reset. Click the link below to reset your password:</p>
       <p><a href="${resetLink}">Reset Password</a></p>
       <p>This link will expire in 1 hour.</p>
       <p>If you didn't request this, please ignore this email.</p>`
    );

    res.json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Password reset request error:', error);
    res.status(500).json({ success: false, error: 'Failed to process password reset request' });
  }
});

// Reset password with token
router.post('/reset', async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    });
    const { token, password } = schema.parse(req.body);

    const resetRecord = resetTokenStore.get(token);

    if (!resetRecord) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    if (new Date() > resetRecord.expiresAt) {
      resetTokenStore.delete(token);
      return res.status(400).json({ success: false, error: 'Reset token expired. Please request a new one.' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, resetRecord.userId]);

    // Clear reset token
    resetTokenStore.delete(token);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

export default router;
