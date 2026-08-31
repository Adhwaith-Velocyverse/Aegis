import { ConfidentialClientApplication, LogLevel, AuthenticationResult } from '@azure/msal-node';
import { query } from '../db/connection';
import crypto from 'crypto';
import { AuthenticationError } from '../types/m365';

export function getAuthorityUrl(authority: string): string {
  // If it's already a full URL, return as-is
  if (authority.startsWith('https://')) {
    return authority;
  }
  // Otherwise, construct the full authority URL
  // Supports: 'common', 'organizations', or a specific tenant ID
  return `https://login.microsoftonline.com/${authority}`;
}

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    // Use 'common' for multi-tenant (any Azure AD tenant can sign in)
    // Use 'organizations' for work/school accounts only
    // Use specific tenant ID for single-tenant
    authority: getAuthorityUrl(process.env.AZURE_AUTHORITY || 'common'),
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel: LogLevel, message: string, containsPii: boolean) {
        console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: LogLevel.Info,
    },
  },
};

const cca = new ConfidentialClientApplication(msalConfig);

// Delegated permissions required for security assessments
// offline_access is required to receive a refresh token
export const OAUTH_SCOPES = [
  'offline_access',
  'User.Read',
  'Directory.Read.All',
  'Group.Read.All',
  'Policy.Read.All',
  'RoleManagement.Read.All',
  'Device.Read.All',
  'Application.Read.All',
  'SecurityEvents.Read.All',
];

export function generateAuthUrl(tenantId: string, state: string, scopes: string[] = OAUTH_SCOPES): string {
  // For multi-tenant apps, use 'common' so any Azure AD tenant can sign in
  // The tenantId from the user is stored for reference but the auth uses 'common'
  const authority = getAuthorityUrl(process.env.AZURE_AUTHORITY || 'common');
  const authUrl = new URL(`${authority}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', process.env.AZURE_CLIENT_ID!);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', process.env.AZURE_REDIRECT_URI!);
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('state', state);
  // Use 'consent' only for first-time consent, 'select_account' for incremental
  authUrl.searchParams.set('prompt', 'consent');
  return authUrl.toString();
}

export async function exchangeCodeForTokens(code: string, tenantId: string, scopes: string[] = OAUTH_SCOPES): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  try {
    const tokenResponse = await cca.acquireTokenByCode({
      code,
      scopes,
      redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:3001/api/auth/callback',
    });

    if (!tokenResponse) {
      throw new Error('No token response received from Microsoft');
    }

    // Access refreshToken and expiresIn from the response
    // These properties are available at runtime even if not fully typed
    const response = tokenResponse as any;
    const refreshToken = response.refreshToken || '';
    const expiresIn = response.expiresIn || 3600;

    return {
      accessToken: tokenResponse.accessToken,
      refreshToken,
      expiresIn,
    };
  } catch (error: any) {
    console.error('Failed to exchange code for tokens:', error);
    throw new Error(error.message || 'Token exchange failed');
  }
}

export async function getAccessTokenForTenant(tenantConnectionId: string): Promise<string> {
  return getAccessTokenForTenantAndResource(tenantConnectionId, 'https://graph.microsoft.com/.default');
}

export async function getExchangeOnlineAccessTokenForTenant(tenantConnectionId: string): Promise<string> {
  return getAccessTokenForTenantAndResource(tenantConnectionId, 'https://outlook.office365.com/.default');
}

async function getAccessTokenForTenantAndResource(tenantConnectionId: string, resource: string): Promise<string> {
  try {
    const connections = await query('SELECT * FROM tenant_connections WHERE id = ?', [tenantConnectionId]);
    if (connections.length === 0) {
      throw new AuthenticationError('AUTHENTICATION_ERROR', 'Tenant connection not found', true);
    }

    const connection = connections[0] as any;

    if (connection.azure_tenant_id && connection.azure_client_id && connection.azure_client_secret_encrypted) {
      const clientSecret = decryptToken(connection.azure_client_secret_encrypted);

      const tenantMsalConfig = {
        auth: {
          clientId: connection.azure_client_id,
          clientSecret: clientSecret,
          authority: `https://login.microsoftonline.com/${connection.azure_tenant_id}`,
        },
      };

      const tenantCca = new ConfidentialClientApplication(tenantMsalConfig);

      const tokenResponse = await tenantCca.acquireTokenByClientCredential({
        scopes: [resource],
      });

      if (!tokenResponse) {
        throw new AuthenticationError('AUTHENTICATION_ERROR', 'Failed to acquire application access token', true);
      }
      return tokenResponse.accessToken;
    }

    if (connection.access_token_encrypted && connection.token_expires_at) {
      const tokenExpiresAt = new Date(connection.token_expires_at);
      const now = new Date();

      if (now < tokenExpiresAt && (tokenExpiresAt.getTime() - now.getTime()) > 5 * 60 * 1000) {
        return decryptToken(connection.access_token_encrypted);
      }
    }

    if (connection.refresh_token_encrypted) {
      const refreshToken = decryptToken(connection.refresh_token_encrypted);

      try {
        const tokenResponse = await cca.acquireTokenByRefreshToken({
          refreshToken,
          scopes: [resource],
        });

        if (!tokenResponse) {
          throw new AuthenticationError('AUTHENTICATION_ERROR', 'Refresh token did not return a new access token', true);
        }

        const response = tokenResponse as any;
        const newRefreshToken = response.refreshToken || refreshToken;
        const expiresIn = response.expiresIn || 3600;

        await storeTokens(tenantConnectionId, tokenResponse.accessToken, newRefreshToken, [resource], expiresIn);

        return tokenResponse.accessToken;
      } catch (refreshError: any) {
        console.error('Refresh token rotation failed:', refreshError);

        if (refreshError.errorCode === 'bad_token' || refreshError.errorCode === 'interaction_required') {
          await query(
            'UPDATE tenant_connections SET connection_status = ? WHERE id = ?',
            ['needs_attention', tenantConnectionId]
          );
        }

        const message = refreshError.message || 'Refresh token rotation failed';
        throw new AuthenticationError('AUTHENTICATION_ERROR', message, true, refreshError);
      }
    }

    throw new AuthenticationError(
      'AUTHENTICATION_ERROR',
      `No refresh token available for tenant connection ${tenantConnectionId}. Re-authentication required.`,
      true
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    console.error('Failed to get access token:', error);
    throw new AuthenticationError('AUTHENTICATION_ERROR', error instanceof Error ? error.message : 'Failed to get access token', true, error instanceof Error ? error : undefined);
  }
}

export function mergeConsentedScopes(existingScopes: string[], newScopes: string[]): string[] {
  const merged = new Set(existingScopes);
  newScopes.forEach(scope => merged.add(scope));
  return Array.from(merged);
}

export async function storeTokens(tenantConnectionId: string, accessToken: string, refreshToken: string, newConsentedScopes: string[], expiresIn: number = 3600, mergeWithExisting: boolean = true) {
  const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : null;
  const encryptedAccessToken = accessToken ? encryptToken(accessToken) : null;
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

  let finalScopes = newConsentedScopes;
  if (mergeWithExisting) {
    // Get existing scopes and merge
    const connections = await query('SELECT consented_scopes FROM tenant_connections WHERE id = ?', [tenantConnectionId]);
    if (connections.length > 0) {
      const existingScopes = (connections[0] as any).consented_scopes;
      if (existingScopes) {
        try {
          const parsed = JSON.parse(existingScopes);
          finalScopes = mergeConsentedScopes(parsed, newConsentedScopes);
        } catch {
          // If parsing fails, use new scopes as-is
          finalScopes = newConsentedScopes;
        }
      }
    }
  }

  await query(
    `UPDATE tenant_connections
     SET refresh_token_encrypted = ?, access_token_encrypted = ?, consented_scopes = ?,
         connection_status = ?, token_expires_at = ?
     WHERE id = ?`,
    [encryptedRefreshToken, encryptedAccessToken, JSON.stringify(finalScopes), 'connected', tokenExpiresAt, tenantConnectionId]
  );
}

function encryptToken(token: string): string {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.JWT_SECRET!, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decryptToken(encryptedToken: string): string {
  if (!encryptedToken) return '';

  const parts = encryptedToken.split(':');

  // Handle legacy base64-encoded plaintext values (no colon separator)
  if (parts.length === 1) {
    try {
      return Buffer.from(encryptedToken, 'base64').toString('utf8');
    } catch {
      return encryptedToken;
    }
  }

  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.JWT_SECRET!, 'salt', 32);

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export { encryptToken as encryptTokenForStorage, decryptToken as decryptStoredToken };
