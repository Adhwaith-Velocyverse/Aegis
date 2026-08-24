import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection';
import { User, PlatformRole } from '@aegis/shared';
import { recordFailedAttempt, clearFailedAttempts } from './security';

export interface AuthRequest extends Request {
  user?: User;
}

// Session management constants
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout
const REMEMBER_ME_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for "Remember me"

// JWT token blacklist (in-memory, use Redis in production)
const tokenBlacklist = new Set<string>();

export const blacklistToken = (token: string) => {
  tokenBlacklist.add(token);
  // Auto-cleanup after token expiry (7 days max)
  setTimeout(() => {
    tokenBlacklist.delete(token);
  }, 7 * 24 * 60 * 60 * 1000);
};

export const isTokenBlacklisted = (token: string): boolean => {
  return tokenBlacklist.has(token);
};

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[Auth] No token provided for', req.method, req.url);
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  console.log('[Auth] Token received for', req.method, req.url, ':', token ? token.substring(0, 20) + '...' : 'null');

  // Check if token is blacklisted
  if (isTokenBlacklisted(token)) {
    console.warn('[Auth] Token is blacklisted for', req.method, req.url);
    return res.status(401).json({ success: false, error: 'Token has been revoked' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; rememberMe?: boolean; mfaPending?: boolean };
    console.log('[Auth] Token decoded for', req.method, req.url, ':', decoded);

    // Fetch full user from DB to get organizationId and other fields
    const users = await query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      console.warn('[Auth] User not found for', req.method, req.url, 'userId:', decoded.userId);
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const dbUser = users[0] as any;
    console.log('[Auth] User found for', req.method, req.url, ':', dbUser.email, 'mfa_enabled:', dbUser.mfa_enabled, 'last_activity:', dbUser.last_activity);

    // Check for soft-deleted accounts
    if (dbUser.deleted_at) {
      return res.status(401).json({ success: false, error: 'Account has been deleted' });
    }

    // Check inactivity timeout (skip for "Remember me" sessions and MFA pending tokens)
    const skipSessionCheck = decoded.rememberMe || decoded.mfaPending;
    if (!skipSessionCheck && dbUser.last_activity) {
      const lastActivity = new Date(dbUser.last_activity);
      const now = new Date();
      const inactiveMs = now.getTime() - lastActivity.getTime();

      if (inactiveMs > SESSION_TIMEOUT_MS) {
        console.warn('[Auth] Session expired for', req.method, req.url, 'inactiveMs:', inactiveMs, 'timeout:', SESSION_TIMEOUT_MS);
        return res.status(401).json({ success: false, error: 'Session expired due to inactivity' });
      }
    }

    // Update last activity timestamp (skip for MFA pending tokens)
    if (!decoded.mfaPending) {
      await query('UPDATE users SET last_activity = NOW() WHERE id = ?', [decoded.userId]);
    }

    // Map snake_case DB columns to camelCase User type properties
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      fullName: dbUser.full_name,
      phoneNumber: dbUser.phone_number,
      platformRole: dbUser.platform_role,
      orgRole: dbUser.org_role,
      organizationId: dbUser.organization_id,
      emailVerified: dbUser.email_verified,
      mfaEnabled: dbUser.mfa_enabled,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
    } as User;
    next();
  } catch (error) {
    // Record failed attempt for potential brute force detection
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    recordFailedAttempt(ip);
    console.error('[Auth] Token verification failed for', req.method, req.url, ':', error);

    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

export function authorize(...allowedRoles: PlatformRole[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Fetch full user from DB to get current role
    const users = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0] as User;

    if (!user || !allowedRoles.includes(user.platformRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    req.user = user;
    next();
  };
}

// MFA enforcement middleware
export function requireMFA(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.mfaEnabled) {
    return res.status(403).json({
      success: false,
      error: 'Multi-factor authentication is required for this action',
      code: 'MFA_REQUIRED'
    });
  }
  next();
}

// Organization-level authorization
export function authorizeOrg(allowedOrgRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!req.user.orgRole || !allowedOrgRoles.includes(req.user.orgRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient organization permissions' });
    }

    next();
  };
}

// Clear failed attempts on successful login
export const clearIPAttempts = (req: Request) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  clearFailedAttempts(ip);
};
