import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateAuthUrl, exchangeCodeForTokens, storeTokens, OAUTH_SCOPES, getAccessTokenForTenant, getAuthorityUrl, mergeConsentedScopes } from '../services/msalAuth';
import { z } from 'zod';
import { getAccessToken } from '../services/graphConnector';
import { auditLog } from '../middleware/audit';
import { Microsoft365ConnectionManager, getConnectionManager, clearConnectionManagerCache } from '../services/m365ConnectionManager';
import { M365ConnectionState, AuthenticationError } from '../types/m365';

// Module-to-scope mapping per Section 16.2 (verified)
export const MODULE_SCOPE_MAP: Record<string, { scopes: string[]; connectorType: 'graph' | 'powershell' }> = {
  'Entra ID': {
    scopes: ['Policy.Read.All', 'Directory.Read.All', 'AuditLog.Read.All', 'RoleManagement.Read.Directory'],
    connectorType: 'graph',
  },
  'M365 Admin Center': {
    scopes: ['Organization.Read.All', 'Directory.Read.All'],
    connectorType: 'graph',
  },
  'Purview': {
    scopes: [], // PowerShell-only — no Graph scopes
    connectorType: 'powershell',
  },
  'Email': {
    scopes: [], // PowerShell-only — no Graph scopes
    connectorType: 'powershell',
  },
  'Intune': {
    scopes: ['DeviceManagementConfiguration.Read.All', 'DeviceManagementManagedDevices.Read.All'],
    connectorType: 'graph',
  },
  'Cloud Apps': {
    scopes: ['CloudApp-Discovery.Read.All'], // Beta-only, limited coverage
    connectorType: 'graph',
  },
  'Teams': {
    scopes: ['Policy.Read.All'], // Directory-level guest access only
    connectorType: 'graph',
  },
  'SharePoint': {
    scopes: ['SharePointTenantSettings.Read.All', 'Sites.Read.All'],
    connectorType: 'graph',
  },
};

// Quick Assessment critical-control subset (Graph-reachable modules only)
export const QUICK_ASSESSMENT_MODULES = ['Entra ID', 'M365 Admin Center', 'Intune', 'SharePoint', 'Teams'];

// Detailed Assessment full module set
export const DETAILED_ASSESSMENT_MODULES = Object.keys(MODULE_SCOPE_MAP);

const router = express.Router();

// In-memory state store for OAuth (in production, use Redis or database)
interface OAuthStateData {
  connectionId: string;
  organizationId: string;
  selectedModules?: string[];
  assessmentType?: 'quick' | 'detailed';
  isIncremental?: boolean;
}
const oauthStateStore = new Map<string, OAuthStateData>();

// Validation schemas
const connectTenantSchema = z.object({
  tenantId: z.string().min(1),
  tenantName: z.string().min(1),
  connectionMethod: z.enum(['oauth', 'direct']),
  azureTenantId: z.string().optional(),
  azureClientId: z.string().optional(),
  azureClientSecret: z.string().optional(),
  modules: z.array(z.object({
    name: z.string(),
    isEnabled: z.boolean(),
  })).optional(),
}).refine((data) => {
  if (data.connectionMethod === 'direct') {
    return data.azureTenantId && data.azureClientId && data.azureClientSecret;
  }
  return true;
}, {
  message: 'Direct connection requires azureTenantId, azureClientId, and azureClientSecret',
});

const updateModuleSchema = z.object({
  isEnabled: z.boolean(),
});

// Get consent status for a connection (which modules are already consented)
router.get('/:id/consent-status', authenticate, async (req: AuthRequest, res) => {
  try {
    const connections = await query(
      'SELECT consented_scopes FROM tenant_connections WHERE id = ? AND organization_id = ?',
      [req.params.id, req.user!.organizationId!]
    );

    if (connections.length === 0) {
      return res.status(404).json({ success: false, error: 'Tenant connection not found' });
    }

    const connection = connections[0] as any;
    const consentedScopes: string[] = [];
    try {
      if (connection.consented_scopes) {
        const parsed = JSON.parse(connection.consented_scopes);
        consentedScopes.push(...parsed);
      }
    } catch {
      // Ignore parse errors
    }

    // Determine which modules are fully consented (all their scopes are present)
    const moduleStatus: Record<string, { consented: boolean; missingScopes: string[]; connectorType: string }> = {};
    for (const [moduleName, config] of Object.entries(MODULE_SCOPE_MAP)) {
      const missingScopes = config.scopes.filter(scope => !consentedScopes.includes(scope));
      moduleStatus[moduleName] = {
        consented: missingScopes.length === 0,
        missingScopes,
        connectorType: config.connectorType,
      };
    }

    res.json({
      success: true,
      data: {
        consentedScopes,
        moduleStatus,
        isFullyConsented: Object.values(moduleStatus).every(m => m.consented || m.connectorType === 'powershell'),
      },
    });
  } catch (error) {
    console.error('Get consent status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get consent status' });
  }
});

// Initiate incremental consent — only requests scopes not yet granted
router.post('/consent/incremental', authenticate, async (req: AuthRequest, res) => {
  try {
    const { connectionId, modules, assessmentType } = req.body as {
      connectionId: string;
      modules: string[];
      assessmentType?: 'quick' | 'detailed';
    };

    if (!connectionId || !modules || !Array.isArray(modules)) {
      return res.status(400).json({ success: false, error: 'connectionId and modules array are required' });
    }

    // Verify connection belongs to org
    const connections = await query(
      'SELECT * FROM tenant_connections WHERE id = ? AND organization_id = ?',
      [connectionId, req.user!.organizationId!]
    );
    if (connections.length === 0) {
      return res.status(404).json({ success: false, error: 'Tenant connection not found' });
    }

    const connection = connections[0] as any;

    // Get already-consented scopes
    const existingScopes: string[] = [];
    try {
      if (connection.consented_scopes) {
        existingScopes.push(...JSON.parse(connection.consented_scopes));
      }
    } catch {
      // Ignore parse errors
    }

    // Build scopes for selected modules, filtering out already-consented ones
    const newScopes = new Set<string>();
    const moduleConsentDetails: Record<string, { newScopes: string[]; alreadyConsented: boolean; connectorType: string }> = {};

    for (const moduleName of modules) {
      const config = MODULE_SCOPE_MAP[moduleName];
      if (!config) continue;

      const missingScopes = config.scopes.filter(scope => !existingScopes.includes(scope));
      const alreadyConsented = missingScopes.length === 0;

      if (!alreadyConsented) {
        missingScopes.forEach(scope => newScopes.add(scope));
      }

      moduleConsentDetails[moduleName] = {
        newScopes: missingScopes,
        alreadyConsented,
        connectorType: config.connectorType,
      };
    }

    // Add offline_access for refresh token if not already present
    if (!existingScopes.includes('offline_access')) {
      newScopes.add('offline_access');
    }

    // If no new scopes needed, all modules are already consented
    if (newScopes.size === 0) {
      return res.status(200).json({
        success: true,
        data: {
          connectionId,
          requiresConsent: false,
          message: 'All selected modules are already consented',
          moduleConsentDetails,
          scopes: [],
        },
      });
    }

    // Generate state for CSRF protection
    const state = uuidv4();
    oauthStateStore.set(state, {
      connectionId,
      organizationId: req.user!.organizationId!,
      selectedModules: modules,
      assessmentType: assessmentType || 'quick',
      isIncremental: true,
    });

    // Build Microsoft OAuth2 authorization URL with ONLY the new scopes (incremental)
    const authority = getAuthorityUrl(process.env.AZURE_AUTHORITY || 'common');
    const authUrl = new URL(`${authority}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', process.env.AZURE_CLIENT_ID!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', process.env.AZURE_REDIRECT_URI!);
    authUrl.searchParams.set('scope', Array.from(newScopes).join(' '));
    authUrl.searchParams.set('state', state);
    // Use 'consent' for incremental — Microsoft will only show the new scopes
    authUrl.searchParams.set('prompt', 'consent');

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'incremental_consent_initiated',
      resource: 'tenant_connection',
      resourceId: connectionId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        modules_requested: modules,
        new_scopes: Array.from(newScopes),
        existing_scopes_count: existingScopes.length,
        assessment_type: assessmentType || 'quick',
      },
      status: 'success',
    });

    res.status(201).json({
      success: true,
      data: {
        connectionId,
        requiresConsent: true,
        authUrl: authUrl.toString(),
        scopes: Array.from(newScopes),
        modules,
        moduleConsentDetails,
        isIncremental: true,
      },
    });
  } catch (error) {
    console.error('Incremental consent error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate incremental consent' });
  }
});

// Initiate consent with selected modules (legacy — kept for backward compatibility)
router.post('/consent', authenticate, async (req: AuthRequest, res) => {
  try {
    const { connectionId, modules } = req.body as { connectionId: string; modules: string[] };

    if (!connectionId || !modules || !Array.isArray(modules)) {
      return res.status(400).json({ success: false, error: 'connectionId and modules array are required' });
    }

    // Verify connection belongs to org
    const connections = await query(
      'SELECT * FROM tenant_connections WHERE id = ? AND organization_id = ?',
      [connectionId, req.user!.organizationId!]
    );
    if (connections.length === 0) {
      return res.status(404).json({ success: false, error: 'Tenant connection not found' });
    }

    const connection = connections[0] as any;

    // Build scopes for selected modules using the verified MODULE_SCOPE_MAP
    const selectedScopes = new Set<string>();
    for (const moduleName of modules) {
      const config = MODULE_SCOPE_MAP[moduleName];
      if (config) {
        config.scopes.forEach(scope => selectedScopes.add(scope));
      }
    }

    // Add offline_access for refresh token
    selectedScopes.add('offline_access');

    // Generate state for CSRF protection
    const state = uuidv4();
    oauthStateStore.set(state, {
      connectionId,
      organizationId: req.user!.organizationId!,
      selectedModules: modules,
    });

    // Build Microsoft OAuth2 authorization URL
    const authority = getAuthorityUrl(process.env.AZURE_AUTHORITY || 'common');
    const authUrl = new URL(`${authority}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', process.env.AZURE_CLIENT_ID!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', process.env.AZURE_REDIRECT_URI!);
    authUrl.searchParams.set('scope', Array.from(selectedScopes).join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'consent');

    res.status(201).json({
      success: true,
      data: {
        connectionId,
        authUrl: authUrl.toString(),
        scopes: Array.from(selectedScopes),
        modules,
      },
    });
  } catch (error) {
    console.error('Consent error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate consent' });
  }
});

// Get tenant connections
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const connections = await query(
      'SELECT id, organization_id AS organizationId, tenant_id AS tenantId, tenant_name AS tenantName, connection_status AS connectionStatus, last_health_check AS lastHealthCheck, created_at AS createdAt, updated_at AS updatedAt, consented_scopes AS consentedScopes FROM tenant_connections WHERE organization_id = ?',
      [req.user!.organizationId!]
    );
    res.json({ success: true, data: connections });
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tenant connections' });
  }
});

// Connect tenant (initiate OAuth flow or direct credentials)
router.post('/connect', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = connectTenantSchema.parse(req.body);
    const { tenantId, tenantName, connectionMethod, azureTenantId, azureClientId, azureClientSecret } = data;

    // Check if connection already exists
    const existing = await query(
      'SELECT id FROM tenant_connections WHERE organization_id = ? AND tenant_id = ?',
      [req.user!.organizationId!, tenantId]
    );

    let connectionId: string;
    if (existing.length > 0) {
      connectionId = (existing[0] as any).id;
    } else {
      connectionId = uuidv4();
    }

    if (connectionMethod === 'direct' && azureTenantId && azureClientId && azureClientSecret) {
      const encryptedSecret = Buffer.from(azureClientSecret).toString('base64');
      await query(
        `INSERT INTO tenant_connections (id, organization_id, tenant_id, tenant_name, connection_status,
         azure_tenant_id, azure_client_id, azure_client_secret_encrypted)
         VALUES (?, ?, ?, ?, 'connected', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         connection_status = 'connected',
         azure_tenant_id = VALUES(azure_tenant_id),
         azure_client_id = VALUES(azure_client_id),
         azure_client_secret_encrypted = VALUES(azure_client_secret_encrypted)`,
        [connectionId, req.user!.organizationId!, tenantId, tenantName, azureTenantId, azureClientId, encryptedSecret]
      );

      const defaultModules = [
        'Entra ID', 'M365 Admin Center', 'Purview', 'Email', 'Intune', 'Cloud Apps', 'Teams', 'SharePoint'
      ];
      for (const moduleName of defaultModules) {
        await query(
          `INSERT IGNORE INTO tenant_connection_modules (id, tenant_connection_id, module_name, is_enabled)
           VALUES (?, ?, ?, ?)`,
          [uuidv4(), connectionId, moduleName, true]
        );
      }

      await auditLog({
        userId: req.user!.id,
        orgId: req.user!.organizationId,
        action: 'tenant_connected',
        resource: 'tenant_connection',
        resourceId: connectionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          tenant_id: tenantId,
          tenant_name: tenantName,
          connection_method: connectionMethod,
        },
        status: 'success',
      });

      try {
        const manager = new Microsoft365ConnectionManager(connectionId);
        const metadata = await manager.initialize();
        res.status(201).json({
          success: true,
          data: {
            connectionId,
            method: 'direct',
            message: 'Tenant connected successfully',
            state: metadata.state,
            graphConnected: metadata.graphConnected,
            exchangeConnected: metadata.exchangeConnected,
            permissionsValidated: metadata.permissionsValidated,
          },
        });
      } catch (initError: any) {
        await query('UPDATE tenant_connections SET connection_status = ? WHERE id = ?', ['error', connectionId]);
        res.status(502).json({
          success: false,
          error: 'Connection validation failed. Please check your credentials and try again.',
          data: {
            connectionId,
            state: M365ConnectionState.ERROR,
            graphConnected: false,
            exchangeConnected: false,
            permissionsValidated: false,
          },
        });
      }
    } else {
      // OAuth flow - create/update connection and return auth URL
      await query(
        `INSERT INTO tenant_connections (id, organization_id, tenant_id, tenant_name, connection_status)
         VALUES (?, ?, ?, ?, 'disconnected')
         ON DUPLICATE KEY UPDATE connection_status = 'disconnected'`,
        [connectionId, req.user!.organizationId!, tenantId, tenantName]
      );

      // Initialize default modules for this connection
      const defaultModules = [
        'Entra ID', 'M365 Admin Center', 'Purview', 'Email', 'Intune', 'Cloud Apps', 'Teams', 'SharePoint'
      ];
      for (const moduleName of defaultModules) {
        await query(
          `INSERT IGNORE INTO tenant_connection_modules (id, tenant_connection_id, module_name, is_enabled)
           VALUES (?, ?, ?, ?)`,
          [uuidv4(), connectionId, moduleName, true]
        );
      }

      // Generate state for CSRF protection
      const state = uuidv4();
      oauthStateStore.set(state, {
        connectionId,
        organizationId: req.user!.organizationId!,
      });

      // Build Microsoft OAuth2 authorization URL
      const authUrl = generateAuthUrl(tenantId, state);

      await auditLog({
        userId: req.user!.id,
        orgId: req.user!.organizationId,
        action: 'tenant_connection_initiated',
        resource: 'tenant_connection',
        resourceId: connectionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          tenant_id: tenantId,
          tenant_name: tenantName,
          connection_method: 'oauth',
        },
        status: 'success',
      });

      res.status(201).json({
        success: true,
        data: {
          connectionId,
          authUrl,
          method: 'oauth',
          scopes: OAUTH_SCOPES,
        },
      });
    }
  } catch (error) {
    console.error('Connect tenant error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate tenant connection' });
  }
});

// Verify tenant connection
router.post('/verify/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const connections = await query(
      'SELECT * FROM tenant_connections WHERE id = ? AND organization_id = ?',
      [req.params.id, req.user!.organizationId!]
    );

    if (connections.length === 0) {
      return res.status(404).json({ success: false, error: 'Tenant connection not found' });
    }

    try {
      const manager = new Microsoft365ConnectionManager(req.params.id);
      const metadata = await manager.initialize();
      await auditLog({
        userId: req.user!.id,
        orgId: req.user!.organizationId,
        action: 'tenant_connection_verified',
        resource: 'tenant_connection',
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          connection_id: req.params.id,
          state: metadata.state,
          graph_connected: metadata.graphConnected,
          exchange_connected: metadata.exchangeConnected,
        },
        status: 'success',
      });

      res.json({
        success: true,
        data: {
          status: metadata.state,
          graphConnected: metadata.graphConnected,
          exchangeConnected: metadata.exchangeConnected,
          permissionsValidated: metadata.permissionsValidated,
        },
      });
    } catch (verifyError: any) {
      await query(
        'UPDATE tenant_connections SET connection_status = ? WHERE id = ?',
        ['error', req.params.id]
      );
      res.status(500).json({ success: false, error: `Verification failed: ${verifyError.message}` });
    }
  } catch (error) {
    console.error('Verify tenant error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify tenant connection' });
  }
});

// Perform health check on a tenant connection
router.post('/:id/health-check', authenticate, async (req: AuthRequest, res) => {
  try {
    const connections = await query(
      'SELECT * FROM tenant_connections WHERE id = ? AND organization_id = ?',
      [req.params.id, req.user!.organizationId!]
    );

    if (connections.length === 0) {
      return res.status(404).json({ success: false, error: 'Tenant connection not found' });
    }

    const manager = new Microsoft365ConnectionManager(req.params.id);
    await manager.initialize();
    const health = await manager.healthCheck();

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'tenant_health_check',
      resource: 'tenant_connection',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        status: health.status,
        graph_available: health.graphAvailable,
        exchange_available: health.exchangeAvailable,
        tenant_validated: health.tenantValidated,
        permissions_validated: health.permissionsValidated,
      },
      status: health.status === M365ConnectionState.HEALTHY ? 'success' : 'failure',
    });

    res.json({
      success: true,
      data: {
        status: health.status,
        graphAvailable: health.graphAvailable,
        exchangeAvailable: health.exchangeAvailable,
        tenantValidated: health.tenantValidated,
        permissionsValidated: health.permissionsValidated,
        checkedAt: health.checkedAt,
        details: health.details,
        errors: health.errors,
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ success: false, error: 'Failed to perform health check' });
  }
});

// Disconnect tenant
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const connectionId = req.params.id;
    
    // Get tenant info before deletion for audit log
    const connections = await query(
      'SELECT tenant_id, tenant_name FROM tenant_connections WHERE id = ? AND organization_id = ?',
      [connectionId, req.user!.organizationId!]
    );

    await query(
      'DELETE FROM tenant_connections WHERE id = ? AND organization_id = ?',
      [connectionId, req.user!.organizationId!]
    );

    await auditLog({
      userId: req.user!.id,
      orgId: req.user!.organizationId,
      action: 'tenant_disconnected',
      resource: 'tenant_connection',
      resourceId: connectionId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        tenant_id: connections.length > 0 ? (connections[0] as any).tenant_id : null,
        tenant_name: connections.length > 0 ? (connections[0] as any).tenant_name : null,
      },
      status: 'success',
    });

    clearConnectionManagerCache(connectionId);

    res.json({ success: true, message: 'Tenant disconnected' });
  } catch (error) {
    console.error('Disconnect tenant error:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect tenant' });
  }
});

// Get OAuth state for a connection (used by frontend to verify callback)
router.get('/oauth-state/:connectionId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { connectionId } = req.params;
    
    // Find the state associated with this connection
    for (const [state, data] of oauthStateStore.entries()) {
      if (data.connectionId === connectionId && data.organizationId === req.user!.organizationId) {
        res.json({ success: true, data: { state } });
        return;
      }
    }
    
    res.status(404).json({ success: false, error: 'OAuth state not found' });
  } catch (error) {
    console.error('Get OAuth state error:', error);
    res.status(500).json({ success: false, error: 'Failed to get OAuth state' });
  }
});

// Get tenant connection modules
router.get('/:id/modules', authenticate, async (req: AuthRequest, res) => {
  try {
    const modules = await query(
      'SELECT id, tenant_connection_id AS tenantConnectionId, module_name AS moduleName, is_enabled AS isEnabled, collection_status AS collectionStatus FROM tenant_connection_modules WHERE tenant_connection_id = ?',
      [req.params.id]
    );
    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch modules' });
  }
});

// Update tenant connection module
router.patch('/:id/modules/:moduleName', authenticate, async (req: AuthRequest, res) => {
  try {
    const { moduleName } = req.params;
    const { isEnabled } = updateModuleSchema.parse(req.body);
    const connectionId = req.params.id;

    // Verify connection belongs to org
    const connections = await query(
      'SELECT id FROM tenant_connections WHERE id = ? AND organization_id = ?',
      [connectionId, req.user!.organizationId!]
    );
    if (connections.length === 0) {
      return res.status(404).json({ success: false, error: 'Tenant connection not found' });
    }

    await query(
      `INSERT INTO tenant_connection_modules (id, tenant_connection_id, module_name, is_enabled)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_enabled = ?, updated_at = NOW()`,
      [uuidv4(), connectionId, moduleName, isEnabled, isEnabled]
    );

    res.json({ success: true, data: { moduleName, isEnabled } });
  } catch (error) {
    console.error('Update module error:', error);
    res.status(500).json({ success: false, error: 'Failed to update module' });
  }
});

// Health check for tenant connection
router.post('/:id/health-check', authenticate, async (req: AuthRequest, res) => {
  try {
    const connectionId = req.params.id;

    // Verify connection belongs to org
    const connections = await query(
      'SELECT * FROM tenant_connections WHERE id = ? AND organization_id = ?',
      [connectionId, req.user!.organizationId!]
    );
    if (connections.length === 0) {
      return res.status(404).json({ success: false, error: 'Tenant connection not found' });
    }

    const connection = connections[0] as any;

    // Try to get an access token to verify the connection
    let accessToken;
    try {
      accessToken = await getAccessTokenForTenant(connectionId);
    } catch (error: any) {
      if (error instanceof AuthenticationError) {
        await query(
          'UPDATE tenant_connections SET connection_status = ? WHERE id = ?',
          ['needs_attention', connectionId]
        );
        return res.json({ success: true, data: { status: 'needs_attention', lastChecked: new Date(), reason: error.message } });
      }
      throw error;
    }

    if (accessToken) {
      // Update health check timestamp and status
      await query(
        'UPDATE tenant_connections SET connection_status = ?, last_health_check = NOW() WHERE id = ?',
        ['connected', connectionId]
      );
      res.json({ success: true, data: { status: 'connected', lastChecked: new Date() } });
    } else {
      await query(
        'UPDATE tenant_connections SET connection_status = ? WHERE id = ?',
        ['needs_attention', connectionId]
      );
      res.json({ success: true, data: { status: 'needs_attention', lastChecked: new Date() } });
    }
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ success: false, error: 'Failed to perform health check' });
  }
});

// Clean up expired OAuth states (run periodically in production)
export function cleanupExpiredStates() {
  // In production, add timestamps and clean up states older than 10 minutes
  const now = Date.now();
  for (const [state, data] of oauthStateStore.entries()) {
    // Simple cleanup - remove states older than 10 minutes
    // In production, store timestamps and check them
    if (oauthStateStore.size > 1000) {
      const firstKey = oauthStateStore.keys().next().value;
      if (firstKey) oauthStateStore.delete(firstKey);
    }
  }
}

export { oauthStateStore };
export default router;
