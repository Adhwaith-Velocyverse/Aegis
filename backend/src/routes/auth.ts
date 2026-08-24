import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { z } from 'zod';
import { User, Organization } from '@aegis/shared';
import { exchangeCodeForTokens, storeTokens, mergeConsentedScopes, OAUTH_SCOPES } from '../services/msalAuth';
import { oauthStateStore, MODULE_SCOPE_MAP } from './tenants';
import { authenticate, AuthRequest, clearIPAttempts, blacklistToken } from '../middleware/auth';
import { sendEmail } from '../services/notifications';
import { auditLog } from '../middleware/audit';
import axios from 'axios';

const router = express.Router();

const signupSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(1),
  companySize: z.string().optional(),
  phoneNumber: z.string().max(20).optional(),
  industry: z.string().optional(),
});

// Email validation with deliverability check
function validateEmailDeliverability(email: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for disposable email domains
  const disposableDomains = ['tempmail.com', 'throwaway.com', 'guerrillamail.com', 'mailinator.com', '10minutemail.com'];
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (domain && disposableDomains.includes(domain)) {
    errors.push('Disposable email addresses are not allowed');
  }
  
  // Check for common typos in popular domains
  const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'microsoft.com'];
  const typoDomains: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'outlok.com': 'outlook.com',
    'outlook.co': 'outlook.com',
    'hotmal.com': 'hotmail.com',
    'hotmail.co': 'hotmail.com',
  };
  
  if (domain && typoDomains[domain]) {
    errors.push(`Did you mean ${typoDomains[domain]}?`);
  }
  
  // Check for valid MX record (simplified - in production use a proper email validation service)
  // For now, we'll just check the format
  
  return { valid: errors.length === 0, errors };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().optional(),
});

const mfaLoginSchema = z.object({
  email: z.string().email(),
  mfaToken: z.string().length(6),
});

// Password complexity validation
export function validatePasswordComplexity(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return { valid: errors.length === 0, errors };
}

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const data = signupSchema.parse(req.body);

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = ?', [data.email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    // Create organization
    const orgId = uuidv4();
    await query('INSERT INTO organizations (id, name, company_size, industry) VALUES (?, ?, ?, ?)', [
      orgId,
      data.companyName,
      data.companySize || null,
      data.industry || null,
    ]);

    // Validate password complexity
    const passwordValidation = validatePasswordComplexity(data.password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ success: false, error: passwordValidation.errors.join(', ') });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const userId = uuidv4();
    await query(
      'INSERT INTO users (id, email, password_hash, full_name, phone_number, platform_role, organization_id, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, data.email, passwordHash, data.fullName, data.phoneNumber || null, 'client', orgId, true]
    );

    // Create Free subscription
    const plans = await query('SELECT id FROM subscription_plans WHERE name = ?', ['Free']);
    if (plans.length > 0) {
      const subscriptionId = uuidv4();
      await query(
        'INSERT INTO subscriptions (id, organization_id, plan_id, billing_status, current_period_start, current_period_end) VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH))',
        [subscriptionId, orgId, plans[0].id, 'active']
      );
    }

    // Generate JWT with org context
    const token = jwt.sign(
      { userId, orgId: orgId, orgRole: 'owner' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Clear failed attempts on successful signup
    clearIPAttempts(req);

    await auditLog({
      userId: userId,
      orgId: orgId,
      action: 'user_signed_up',
      resource: 'user',
      resourceId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        email: data.email,
        company_name: data.companyName,
        company_size: data.companySize,
      },
      status: 'success',
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: userId, email: data.email, fullName: data.fullName, platformRole: 'client', deletedAt: null },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Signup error:', error);
    res.status(500).json({ success: false, error: 'Failed to create account' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const users = await query('SELECT * FROM users WHERE email = ?', [data.email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = users[0] as any;
    const validPassword = await bcrypt.compare(data.password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Check if MFA is enabled
    if (user.mfa_enabled) {
      // Return a temporary token for MFA verification
      const mfaToken = jwt.sign({ userId: user.id, mfaPending: true }, process.env.JWT_SECRET!, { expiresIn: '5m' });
      return res.json({
        success: true,
        data: {
          mfaRequired: true,
          mfaToken,
        },
      });
    }

    const rememberMe = data.rememberMe || false;
    const tokenExpiry = rememberMe ? '30d' : '7d';
    const token = jwt.sign(
      { userId: user.id, orgId: user.organization_id, orgRole: user.org_role, rememberMe },
      process.env.JWT_SECRET!,
      { expiresIn: tokenExpiry }
    );

    // Clear failed attempts on successful login
    clearIPAttempts(req);

    // Update last activity to refresh the session
    await query('UPDATE users SET last_activity = NOW() WHERE id = ?', [user.id]);

    await auditLog({
      userId: user.id,
      orgId: user.organization_id,
      action: 'user_logged_in',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        email: user.email,
        mfa_used: false,
      },
      status: 'success',
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          platformRole: user.platform_role,
          orgRole: user.org_role,
          organizationId: user.organization_id,
          deletedAt: user.deleted_at,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Request MFA OTP for login
router.post('/login/mfa/request', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
    });
    const { email } = schema.parse(req.body);

    // Check if user exists and MFA is enabled
    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = users[0] as any;
    if (!user.mfa_enabled) {
      return res.status(400).json({ success: false, error: 'MFA is not enabled for this account' });
    }

    // Generate OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    const otpId = uuidv4();
    await query(
      'INSERT INTO mfa_otps (id, email, otp, expires_at) VALUES (?, ?, ?, ?)',
      [otpId, email, code, expiresAt]
    );

    // Send OTP via email
    try {
      await sendEmail(
        email,
        'Your Aegis MFA Verification Code',
        `<p>Hi ${user.full_name || 'User'},</p>
         <p>Your verification code is: <strong>${code}</strong></p>
         <p>This code will expire in 10 minutes.</p>
         <p>If you did not request this code, please ignore this email.</p>`
      );
    } catch (emailError) {
      console.error('Failed to send MFA email:', emailError);
      console.log(`MFA OTP for ${email}: ${code} (email failed, check SMTP config)`);
    }

    res.json({
      success: true,
      message: 'OTP sent to your email',
      data: {
        expiresIn: 600, // seconds
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('MFA request error:', error);
    res.status(500).json({ success: false, error: 'Failed to send MFA code' });
  }
});

// MFA Login
router.post('/login/mfa', async (req, res) => {
  try {
    const data = mfaLoginSchema.parse(req.body);

    // Verify MFA token
    const mfaResponse = await query('SELECT * FROM mfa_otps WHERE email = ? AND otp = ? AND expires_at > NOW() AND used = FALSE ORDER BY created_at DESC LIMIT 1', [data.email, data.mfaToken]);
    if (mfaResponse.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid or expired MFA code' });
    }

    // Mark OTP as used
    await query('UPDATE mfa_otps SET used = TRUE WHERE id = ?', [(mfaResponse[0] as any).id]);

    // Get user
    const users = await query('SELECT * FROM users WHERE email = ?', [data.email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = users[0] as any;
    const token = jwt.sign(
      { userId: user.id, orgId: user.organization_id, orgRole: user.org_role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    console.log('[Auth/MFA] Login successful for:', user.email, 'token:', token.substring(0, 20) + '...');

    // Clear failed attempts on successful MFA login
    clearIPAttempts(req);

    // Update last activity to refresh the session
    await query('UPDATE users SET last_activity = NOW() WHERE id = ?', [user.id]);

    await auditLog({
      userId: user.id,
      orgId: user.organization_id,
      action: 'user_logged_in',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        email: user.email,
        mfa_used: true,
      },
      status: 'success',
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          platformRole: user.platform_role,
          orgRole: user.org_role,
          organizationId: user.organization_id,
          deletedAt: user.deleted_at,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('MFA login error:', error);
    res.status(500).json({ success: false, error: 'MFA verification failed' });
  }
});

// OAuth callback handler for Microsoft tenant connection
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    console.log('[OAuth Callback] Received request with query:', JSON.stringify(req.query));
    console.log('[OAuth Callback] State store size:', oauthStateStore.size);
    console.log('[OAuth Callback] Headers:', JSON.stringify(req.headers));

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, error_description);
      return res.redirect(`${process.env.FRONTEND_URL}/connect-tenant?error=${encodeURIComponent(error_description as string || error as string)}`);
    }

    if (!code || typeof code !== 'string') {
      console.error('[OAuth Callback] Missing or invalid code');
      return res.redirect(`${process.env.FRONTEND_URL}/connect-tenant?error=missing_code`);
    }

    // Verify state parameter
    if (!state || typeof state !== 'string') {
      console.error('[OAuth Callback] Missing or invalid state');
      return res.redirect(`${process.env.FRONTEND_URL}/connect-tenant?error=missing_state`);
    }

    const stateData = oauthStateStore.get(state);
    if (!stateData) {
      console.error('[OAuth Callback] Invalid state - not found in store. Available states:', Array.from(oauthStateStore.keys()));
      return res.redirect(`${process.env.FRONTEND_URL}/connect-tenant?error=invalid_state`);
    }

    const { connectionId, selectedModules, isIncremental } = stateData;
    console.log('[OAuth Callback] State data found:', { connectionId, selectedModules, isIncremental });

    // Clear the state from store
    oauthStateStore.delete(state);

    // Exchange authorization code for tokens
    // For incremental consent, only request the new scopes (not all scopes)
    let scopesToRequest: string[] = OAUTH_SCOPES;
    if (isIncremental && selectedModules) {
      // Get existing scopes
      const connections = await query('SELECT consented_scopes FROM tenant_connections WHERE id = ?', [connectionId]);
      const existingScopes: string[] = [];
      if (connections.length > 0) {
        try {
          const parsed = JSON.parse((connections[0] as any).consented_scopes || '[]');
          existingScopes.push(...parsed);
        } catch {
          // Ignore parse errors
        }
      }

      // Calculate new scopes needed
      const newScopes = new Set<string>();
      for (const moduleName of selectedModules) {
        const config = MODULE_SCOPE_MAP[moduleName];
        if (config) {
          config.scopes.forEach(scope => {
            if (!existingScopes.includes(scope)) {
              newScopes.add(scope);
            }
          });
        }
      }
      if (!existingScopes.includes('offline_access')) {
        newScopes.add('offline_access');
      }

      scopesToRequest = Array.from(newScopes);
    }
    console.log('[OAuth Callback] Scopes to request:', scopesToRequest);

    let tokens: { accessToken: string; refreshToken: string; expiresIn: number } | null = null;
    try {
      console.log('[OAuth Callback] Exchanging code for tokens...');
      tokens = await exchangeCodeForTokens(code, '', scopesToRequest);
      console.log('[OAuth Callback] Token exchange successful');
    } catch (error: any) {
      console.error('Token exchange error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/connect-tenant?error=${encodeURIComponent(error.message || 'token_exchange_failed')}`);
      return;
    }

    if (!tokens) {
      console.error('[OAuth Callback] No tokens received');
      res.redirect(`${process.env.FRONTEND_URL}/connect-tenant?error=token_exchange_failed`);
      return;
    }

    // Determine which scopes were granted based on selected modules
    const consentedScopes = new Set<string>();
    const modules = selectedModules || Object.keys(MODULE_SCOPE_MAP);
    
    for (const moduleName of modules) {
      const config = MODULE_SCOPE_MAP[moduleName];
      if (config) {
        config.scopes.forEach(scope => consentedScopes.add(scope));
      }
    }
    consentedScopes.add('offline_access');

    // Store tokens in database with the consented scopes
    // For incremental consent, merge with existing scopes
    console.log('[OAuth Callback] Storing tokens for connection:', connectionId);
    await storeTokens(connectionId, tokens.accessToken, tokens.refreshToken, Array.from(consentedScopes), undefined, !isIncremental);
    console.log('[OAuth Callback] Tokens stored successfully');

    // Redirect to frontend with success
    console.log('[OAuth Callback] Redirecting to frontend');
    res.redirect(`${process.env.FRONTEND_URL}/connect-tenant?connected=true&connectionId=${connectionId}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/connect-tenant?error=callback_failed`);
  }
});

// OAuth login endpoint (for platform login with Google/Microsoft)
router.post('/oauth', async (req, res) => {
  try {
    const { provider, token } = req.body;

    if (!provider || !token) {
      return res.status(400).json({ success: false, error: 'Provider and token are required' });
    }

    let email: string;
    let fullName: string;
    let providerId: string;

    // Verify OAuth token with the provider
    if (provider === 'google') {
      try {
        const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
          params: { access_token: token },
        });
        email = response.data.email;
        fullName = response.data.name;
        providerId = response.data.sub;
      } catch (error) {
        console.error('Google token verification failed:', error);
        return res.status(401).json({ success: false, error: 'Invalid Google token' });
      }
    } else if (provider === 'microsoft') {
      try {
        const response = await axios.get('https://graph.microsoft.com/oidc/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        email = response.data.email || response.data.upn;
        fullName = response.data.name;
        providerId = response.data.oid || response.data.sub;
      } catch (error) {
        console.error('Microsoft token verification failed:', error);
        return res.status(401).json({ success: false, error: 'Invalid Microsoft token' });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported provider' });
    }

    // Check if user exists
    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    let user;
    let tokenJwt: string;

    if (users.length === 0) {
      // Create new user
      const userId = uuidv4();
      await query(
        'INSERT INTO users (id, email, full_name, platform_role, provider, provider_id, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, email, fullName, 'client', provider, providerId, true]
      );

      // Create Free subscription
      const plans = await query('SELECT id FROM subscription_plans WHERE name = ?', ['Free']);
      if (plans.length > 0) {
        const subscriptionId = uuidv4();
        await query(
          'INSERT INTO subscriptions (id, organization_id, plan_id, billing_status, current_period_start, current_period_end) VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH))',
          [subscriptionId, userId, plans[0].id, 'active']
        );
      }

      tokenJwt = jwt.sign(
        { userId, orgId: userId, orgRole: 'owner' },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      user = { id: userId, email, fullName, platformRole: 'client' as const };
    } else {
      // Existing user - update provider info
      user = users[0] as any;
      await query(
        'UPDATE users SET provider = ?, provider_id = ? WHERE id = ?',
        [provider, providerId, user.id]
      );
      tokenJwt = jwt.sign(
        { userId: user.id, orgId: user.organization_id, orgRole: user.org_role },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
    }

    // Clear failed attempts on successful OAuth login
    clearIPAttempts(req);

    // Update last activity to refresh the session
    await query('UPDATE users SET last_activity = NOW() WHERE id = ?', [user.id]);

    await auditLog({
      userId: user.id,
      orgId: user.organization_id,
      action: 'user_oauth_login',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        email: user.email,
        provider: provider,
      },
      status: 'success',
    });

    res.json({
      success: true,
      data: {
        token: tokenJwt,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          platformRole: user.platformRole,
          deletedAt: user.deleted_at,
        },
      },
    });
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ success: false, error: 'OAuth login failed' });
  }
});

// Google OAuth authorization endpoint
router.get('/oauth/google', (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = req.query.redirect_uri as string || `${process.env.FRONTEND_URL}/`;
    const scope = 'openid profile email';
    const state = uuidv4();
    
    // Store state for CSRF protection
    oauthStateStore.set(state, {
      connectionId: 'oauth-google',
      organizationId: 'oauth',
      selectedModules: ['google'],
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&access_type=offline&prompt=consent`;
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth init error:', error);
    res.redirect(`/?error=google_oauth_failed`);
  }
});

// Microsoft OAuth authorization endpoint
router.get('/oauth/microsoft', (req, res) => {
  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = req.query.redirect_uri as string || `${process.env.FRONTEND_URL}/`;
    const scope = 'openid profile email';
    const state = uuidv4();
    
    // Store state for CSRF protection
    oauthStateStore.set(state, {
      connectionId: 'oauth-microsoft',
      organizationId: 'oauth',
      selectedModules: ['microsoft'],
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft OAuth init error:', error);
    res.redirect(`/?error=microsoft_oauth_failed`);
  }
});

// OAuth callback handler (handles both Google and Microsoft)
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state, error, error_description, provider } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, error_description);
      return res.redirect(`/?error=${encodeURIComponent(error_description as string || error as string)}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect('/?error=missing_code');
    }

    // Determine provider from state or query param
    let oauthProvider = provider as string;
    if (!oauthProvider && state) {
      const stateData = oauthStateStore.get(state as string);
      if (stateData && stateData.selectedModules) {
        if (stateData.selectedModules.includes('google')) oauthProvider = 'google';
        else if (stateData.selectedModules.includes('microsoft')) oauthProvider = 'microsoft';
      }
      oauthStateStore.delete(state as string);
    }

    if (!oauthProvider) {
      return res.redirect('/?error=unknown_provider');
    }

    let accessToken = '';
    
    // Exchange authorization code for access token
    if (oauthProvider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = `${process.env.FRONTEND_URL}/`;
      
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });
      
      accessToken = tokenResponse.data.access_token;
    } else if (oauthProvider === 'microsoft') {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      const redirectUri = `${process.env.FRONTEND_URL}/`;
      
      const tokenResponse = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });
      
      accessToken = tokenResponse.data.access_token;
    }

    if (!accessToken) {
      return res.redirect('/?error=token_exchange_failed');
    }

    // Get user info from provider
    let email: string;
    let fullName: string;
    let providerId: string;

    if (oauthProvider === 'google') {
      const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      email = userResponse.data.email;
      fullName = userResponse.data.name;
      providerId = userResponse.data.id;
    } else {
      const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      email = userResponse.data.mail || userResponse.data.userPrincipalName;
      fullName = userResponse.data.displayName;
      providerId = userResponse.data.id;
    }

    // Check if user exists
    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    let user;
    let tokenJwt: string;

    if (users.length === 0) {
      // Create new user
      const userId = uuidv4();
      await query(
        'INSERT INTO users (id, email, full_name, platform_role, provider, provider_id, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, email, fullName, 'client', oauthProvider, providerId, true]
      );

      // Create Free subscription
      const plans = await query('SELECT id FROM subscription_plans WHERE name = ?', ['Free']);
      if (plans.length > 0) {
        const subscriptionId = uuidv4();
        await query(
          'INSERT INTO subscriptions (id, organization_id, plan_id, billing_status, current_period_start, current_period_end) VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH))',
          [subscriptionId, userId, plans[0].id, 'active']
        );
      }

      tokenJwt = jwt.sign(
        { userId, orgId: userId, orgRole: 'owner' },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      user = { id: userId, email, fullName, platformRole: 'client' as const };
    } else {
      // Existing user - update provider info
      user = users[0] as any;
      await query(
        'UPDATE users SET provider = ?, provider_id = ? WHERE id = ?',
        [oauthProvider, providerId, user.id]
      );
      tokenJwt = jwt.sign(
        { userId: user.id, orgId: user.organization_id, orgRole: user.org_role },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
    }

    // Update last activity
    await query('UPDATE users SET last_activity = NOW() WHERE id = ?', [user.id]);

    await auditLog({
      userId: user.id,
      orgId: user.organization_id,
      action: 'user_oauth_login',
      resource: 'user',
      resourceId: user.id,
      details: {
        email: user.email,
        provider: oauthProvider,
      },
      status: 'success',
    });

    // Redirect to frontend with token
    res.redirect(`/?provider=${oauthProvider}&token=${tokenJwt}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/?error=callback_failed');
  }
});

// Account deletion (soft-delete with 30-day grace period)
router.delete('/account', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { password, reason } = req.body;

    // Verify password
    const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0] as any;
    if (password) {
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ success: false, error: 'Invalid password' });
      }
    }

    // Check if user is the only owner of the organization
    const orgOwners = await query(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND org_role = ?',
      [user.organization_id, 'owner']
    );
    const ownerCount = (orgOwners[0] as any).count;

    if (user.org_role === 'owner' && ownerCount <= 1) {
      return res.status(400).json({
        success: false,
        error: 'You are the only owner of this organization. Please transfer ownership or delete the organization first.',
      });
    }

    // Soft delete: set deletion scheduled date
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30-day grace period

    await query(
      'UPDATE users SET deleted_at = ?, deletion_reason = ? WHERE id = ?',
      [deletionDate, reason || null, userId]
    );

    // Log the deletion request
    await query(
      'INSERT INTO audit_logs (id, user_id, org_id, action, resource, resource_id, details, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, user.organization_id, 'account_deletion_requested', 'user', userId, JSON.stringify({ reason, deletionDate }), 'success']
    );

    res.json({
      success: true,
      message: 'Account deletion scheduled. You have 30 days to cancel this request.',
      data: {
        deletionDate,
        gracePeriodDays: 30,
      },
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ success: false, error: 'Failed to schedule account deletion' });
  }
});

// Cancel account deletion
router.post('/account/cancel-deletion', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    await query(
      'UPDATE users SET deleted_at = NULL, deletion_reason = NULL WHERE id = ?',
      [userId]
    );

    // Log the cancellation
    await query(
      'INSERT INTO audit_logs (id, user_id, org_id, action, resource, resource_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, req.user!.organizationId, 'account_deletion_cancelled', 'user', userId, 'success']
    );

    res.json({
      success: true,
      message: 'Account deletion cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel deletion error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel account deletion' });
  }
});

// Get current user - re-fetch from database to get fresh role/data
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0] as any;
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          platformRole: user.platform_role,
          orgRole: user.org_role,
          organizationId: user.organization_id,
          phoneNumber: user.phone_number,
          emailVerified: user.email_verified,
          mfaEnabled: user.mfa_enabled,
          deletedAt: user.deleted_at,
        },
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user data' });
  }
});

// Logout - blacklist the token
router.post('/logout', authenticate, (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    blacklistToken(token);
  }

  res.json({ success: true, message: 'Logged out successfully' });
});

// Token refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as { userId: string; type: string };

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, error: 'Invalid token type' });
    }

    // Fetch user
    const users = await query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const user = users[0] as any;

    // Check for soft-deleted accounts
    if (user.deleted_at) {
      return res.status(401).json({ success: false, error: 'Account has been deleted' });
    }

    // Generate new access token
    const newToken = jwt.sign(
      { userId: user.id, orgId: user.organizationId, orgRole: user.orgRole },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token: newToken,
      },
    });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

// MFA Setup - Generate TOTP secret and show QR code
router.post('/mfa/setup', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { email } = req.body;

    // Get user
    const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0] as any;

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `Aegis (${user.email})`,
      issuer: 'Aegis',
    });

    // Store the secret temporarily (not enabled yet)
    await query(
      'UPDATE users SET mfa_secret = ? WHERE id = ?',
      [secret.base32, userId]
    );

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode: secret.otpauth_url,
      },
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ success: false, error: 'Failed to setup MFA' });
  }
});

// MFA Enable - Verify TOTP and enable MFA
router.post('/mfa/enable', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { token } = req.body;

    // Get user's MFA secret
    const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0] as any;
    if (!user.mfa_secret) {
      return res.status(400).json({ success: false, error: 'MFA setup not initiated' });
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: token,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    // Enable MFA
    await query(
      'UPDATE users SET mfa_enabled = TRUE, mfa_secret = ? WHERE id = ?',
      [user.mfa_secret, userId]
    );

    await auditLog({
      userId: userId,
      orgId: user.organization_id,
      action: 'mfa_enabled',
      resource: 'user',
      resourceId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        email: user.email,
      },
      status: 'success',
    });

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    // Store backup codes (in production, hash these)
    await query(
      'INSERT INTO mfa_backup_codes (id, user_id, code, used) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, backupCodes[0], false]
    );

    // Generate new JWT token after successful MFA enable
    const newToken = jwt.sign(
      { userId: user.id, orgId: user.organization_id, orgRole: user.org_role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'MFA enabled successfully',
      data: {
        token: newToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          platformRole: user.platform_role,
          orgRole: user.org_role,
          organizationId: user.organization_id,
        },
        backupCodes,
      },
    });
  } catch (error) {
    console.error('MFA enable error:', error);
    res.status(500).json({ success: false, error: 'Failed to enable MFA' });
  }
});

// MFA Disable
router.post('/mfa/disable', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { password } = req.body;

    // Verify password
    const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0] as any;
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }

    // Disable MFA
    await query(
      'UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL WHERE id = ?',
      [userId]
    );

    // Invalidate all backup codes
    await query('DELETE FROM mfa_backup_codes WHERE user_id = ?', [userId]);

    await auditLog({
      userId: userId,
      orgId: user.organization_id,
      action: 'mfa_disabled',
      resource: 'user',
      resourceId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        email: user.email,
      },
      status: 'success',
    });

    res.json({
      success: true,
      message: 'MFA disabled successfully',
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ success: false, error: 'Failed to disable MFA' });
  }
});

// Forgot Password - Send reset email
router.post('/password/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    const schema = z.object({ email: z.string().email() });
    const { email: validEmail } = schema.parse({ email });

    const users = await query('SELECT * FROM users WHERE email = ?', [validEmail]);
    if (users.length === 0) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    const user = users[0] as any;

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user.id, type: 'password_reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Store reset token
    await query(
      'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, resetToken, new Date(Date.now() + 60 * 60 * 1000)]
    );

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    try {
      await sendEmail(
        user.email,
        'Reset Your Aegis Password',
        `<p>Hi ${user.full_name || 'User'},</p>
         <p>Click the link below to reset your password:</p>
         <p><a href="${resetUrl}">${resetUrl}</a></p>
         <p>This link will expire in 1 hour.</p>
         <p>If you did not request this, please ignore this email.</p>`
      );
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      console.log(`Password reset token for ${user.email}: ${resetToken}`);
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Password reset request error:', error);
    res.status(500).json({ success: false, error: 'Failed to process password reset request' });
  }
});

// Reset Password
router.post('/password/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    const schema = z.object({
      token: z.string(),
      password: z.string().min(8),
    });
    const { token: resetToken, password: newPassword } = schema.parse({ token, password });

    // Verify reset token
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET!) as { userId: string; type: string };
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ success: false, error: 'Invalid reset token' });
    }

    // Check if token exists and is not expired
    const tokens = await query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND user_id = ? AND expires_at > NOW() AND used = FALSE',
      [resetToken, decoded.userId]
    );
    if (tokens.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    // Get user for audit log
    const resetUsers = await query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    const resetUser = resetUsers.length > 0 ? (resetUsers[0] as any) : null;

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, decoded.userId]);

    // Mark token as used
    await query('UPDATE password_reset_tokens SET used = TRUE WHERE id = ?', [(tokens[0] as any).id]);

    // Invalidate all existing sessions
    await query('DELETE FROM user_sessions WHERE user_id = ?', [decoded.userId]);

    await auditLog({
      userId: decoded.userId,
      orgId: resetUser?.organization_id,
      action: 'password_reset',
      resource: 'user',
      resourceId: decoded.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        email: resetUser?.email,
      },
      status: 'success',
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(400).json({ success: false, error: 'Reset token has expired' });
    }
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

export default router;
