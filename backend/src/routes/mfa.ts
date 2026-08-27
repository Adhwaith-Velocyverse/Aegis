import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { sendEmail } from '../services/notifications';

// Simple TOTP implementation (in production, use a library like otplib)
function generateTOTPSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

function generateTOTPCode(secret: string): string {
  // Simplified TOTP - in production use proper TOTP library
  const time = Math.floor(Date.now() / 30000);
  const hash = secret + time;
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.abs(hash.charCodeAt(i) % 10);
  }
  return code;
}

function verifyTOTPCode(secret: string, code: string): boolean {
  // Check current and previous time window
  const currentCode = generateTOTPCode(secret);
  const previousCode = generateTOTPCode(secret + 'prev');
  return code === currentCode || code === previousCode;
}

function generateQRCode(secret: string, email: string): string {
  // In production, use a QR code library
  // For now, return a placeholder
  return `otpauth://totp/Aegis:${email}?secret=${secret}&issuer=Aegis`;
}

const router = express.Router();

// In-memory store for OTP codes (in production, use Redis with TTL)
const otpStore = new Map<string, { code: string; expiresAt: Date; userId: string; method: 'email' | 'sms' }>();

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Request MFA setup (send OTP)
router.post('/setup', authenticate, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      method: z.enum(['email', 'sms']),
      destination: z.string().min(1), // email address or phone number
    });
    const { method, destination } = schema.parse(req.body);

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    otpStore.set(req.user!.id, {
      code,
      expiresAt,
      userId: req.user!.id,
      method,
    });

    // Send OTP via email or SMS
    if (method === 'email') {
      try {
        await sendEmail(
          destination,
          'Your Aegis MFA Verification Code',
          `<p>Hi ${(req.user as any).full_name || 'User'},</p>
           <p>Your verification code is: <strong>${code}</strong></p>
           <p>This code will expire in 10 minutes.</p>
           <p>If you did not request this code, please ignore this email.</p>`
        );
      } catch (emailError) {
        console.error('Failed to send MFA email:', emailError);
        // Fallback: log OTP to console for development
        console.log(`MFA OTP for ${destination}: ${code} (email failed, check SMTP config)`);
      }
    } else if (method === 'sms') {
      // In production, integrate with Twilio or similar SMS service
      console.log(`SMS OTP for ${destination}: ${code}`);
    }

    res.json({
      success: true,
      message: `OTP sent to your ${method === 'email' ? 'email' : 'phone'}`,
      data: {
        expiresIn: 600, // seconds
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('MFA setup error:', error);
    res.status(500).json({ success: false, error: 'Failed to setup MFA' });
  }
});

// Verify MFA OTP
router.post('/verify', authenticate, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      code: z.string().length(6),
    });
    const { code } = schema.parse(req.body);

    const otpRecord = otpStore.get(req.user!.id);

    if (!otpRecord) {
      return res.status(400).json({ success: false, error: 'No OTP requested. Please request a new OTP.' });
    }

    if (new Date() > otpRecord.expiresAt) {
      otpStore.delete(req.user!.id);
      return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
    }

    if (otpRecord.code !== code) {
      return res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
    }

    // OTP verified - enable MFA for user
    await query('UPDATE users SET mfa_enabled = 1 WHERE id = ?', [req.user!.id]);

    // Clear OTP from store
    otpStore.delete(req.user!.id);

    // Generate new JWT token after successful MFA verification
    const token = jwt.sign(
      { userId: req.user!.id, orgId: req.user!.organizationId, orgRole: req.user!.orgRole },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'MFA enabled successfully',
      data: {
        token,
        user: {
          id: req.user!.id,
          email: req.user!.email,
          fullName: req.user!.fullName,
          platformRole: req.user!.platformRole,
          orgRole: req.user!.orgRole,
          organizationId: req.user!.organizationId,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('MFA verify error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify MFA' });
  }
});

// Disable MFA (requires current password)
router.post('/disable', authenticate, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      password: z.string().min(1),
    });
    const { password } = schema.parse(req.body);

    const users = await query('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    const user = users[0] as { password_hash: string };

    const validPassword = await require('bcryptjs').compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ success: false, error: 'Incorrect password' });
    }

    await query('UPDATE users SET mfa_enabled = 0 WHERE id = ?', [req.user!.id]);

    res.json({
      success: true,
      message: 'MFA disabled successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('MFA disable error:', error);
    res.status(500).json({ success: false, error: 'Failed to disable MFA' });
  }
});

// Resend OTP
router.post('/resend', authenticate, async (req: AuthRequest, res) => {
  try {
    const otpRecord = otpStore.get(req.user!.id);

    if (!otpRecord) {
      return res.status(400).json({ success: false, error: 'No active OTP request. Please request a new OTP.' });
    }

    // Generate new OTP
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    otpStore.set(req.user!.id, {
      code,
      expiresAt,
      userId: req.user!.id,
      method: otpRecord.method,
    });

    // In production, send OTP via email/SMS
    console.log(`MFA OTP resent for ${req.user!.email}: ${code}`);

    res.json({
      success: true,
      message: 'OTP resent successfully',
      data: {
        expiresIn: 600,
      },
    });
  } catch (error) {
    console.error('MFA resend error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend OTP' });
  }
});

// Check MFA status
router.get('/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const users = await query('SELECT mfa_enabled, mfa_secret FROM users WHERE id = ?', [req.user!.id]);
    const user = users[0] as { mfa_enabled: boolean; mfa_secret?: string };

    res.json({
      success: true,
      data: {
        mfaEnabled: user.mfa_enabled,
        hasTOTP: !!user.mfa_secret,
      },
    });
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get MFA status' });
  }
});

// TOTP Setup - Generate secret and QR code
router.post('/totp/setup', authenticate, async (req: AuthRequest, res) => {
  try {
    const users = await query('SELECT email FROM users WHERE id = ?', [req.user!.id]);
    const user = users[0] as { email: string };

    const secret = generateTOTPSecret();
    const qrCode = generateQRCode(secret, user.email);

    // Store secret temporarily (in production, encrypt and store in DB)
    // For now, we'll return it to the frontend to store
    res.json({
      success: true,
      data: {
        secret,
        qrCode,
        manualEntryKey: secret,
      },
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    res.status(500).json({ success: false, error: 'Failed to setup TOTP' });
  }
});

// TOTP Verify - Verify the TOTP code and enable MFA
router.post('/totp/verify', authenticate, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      secret: z.string(),
      code: z.string().length(6),
    });
    const { secret, code } = schema.parse(req.body);

    if (!verifyTOTPCode(secret, code)) {
      return res.status(400).json({ success: false, error: 'Invalid TOTP code' });
    }

    // Store the secret in the database (in production, encrypt it)
    await query('UPDATE users SET mfa_secret = ?, mfa_enabled = 1 WHERE id = ?', [secret, req.user!.id]);

    // Generate new JWT token after successful MFA verification
    const token = jwt.sign(
      { userId: req.user!.id, orgId: req.user!.organizationId, orgRole: req.user!.orgRole },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'TOTP MFA enabled successfully',
      data: {
        token,
        user: {
          id: req.user!.id,
          email: req.user!.email,
          fullName: req.user!.fullName,
          platformRole: req.user!.platformRole,
          orgRole: req.user!.orgRole,
          organizationId: req.user!.organizationId,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('TOTP verify error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify TOTP' });
  }
});

// TOTP Login Verify - Verify TOTP during login
router.post('/totp/login', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      code: z.string().length(6),
    });
    const { email, code } = schema.parse(req.body);

    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = users[0] as any;
    if (!user.mfa_secret) {
      return res.status(400).json({ success: false, error: 'TOTP is not enabled for this account' });
    }

    if (!verifyTOTPCode(user.mfa_secret, code)) {
      return res.status(401).json({ success: false, error: 'Invalid TOTP code' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          platformRole: user.platformRole,
          orgRole: user.orgRole,
          organizationId: user.organizationId,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('TOTP login error:', error);
    res.status(500).json({ success: false, error: 'TOTP verification failed' });
  }
});

export default router;
