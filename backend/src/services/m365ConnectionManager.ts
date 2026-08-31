import { query } from '../db/connection';
import { getAccessTokenForTenant } from './msalAuth';
import { GraphHttpClient, getGraphClient } from './graphHttpClient';
import { GraphPowerShellService, getGraphPowerShellService } from './graphPowerShellService';
import { ExchangeOnlineService, getExchangeOnlineService } from './exchangeOnlineService';
import { TenantValidator, PermissionValidator, ConnectionHealthService } from './connectionValidator';
import { DataNormalizationService } from './dataNormalizationService';
import { M365ConnectionState, AuthenticationMode, AuthenticationError, HealthCheckResult, ConnectionMetadata, CollectionError } from '../types/m365';
import { auditLog } from '../middleware/audit';

export class Microsoft365ConnectionManager {
  private tenantConnectionId: string;
  private tenantId!: string;
  private tenantName!: string;
  private organizationId!: string;
  private authMode!: AuthenticationMode;
  private graphClient: GraphHttpClient | null = null;
  private graphPsService: GraphPowerShellService | null = null;
  private exchangeService: ExchangeOnlineService | null = null;
  private state: M365ConnectionState = M365ConnectionState.PENDING;
  private normalizer = new DataNormalizationService();
  private tenantValidator = new TenantValidator();
  private permissionValidator = new PermissionValidator();
  private healthService = new ConnectionHealthService();
  private graphPsFailureCount = 0;
  private exchangeFailureCount = 0;
  private graphPsCircuitOpenUntil = 0;
  private exchangeCircuitOpenUntil = 0;

  constructor(tenantConnectionId: string) {
    this.tenantConnectionId = tenantConnectionId;
  }

  async initialize(): Promise<ConnectionMetadata> {
    await auditLog({
      userId: undefined,
      orgId: undefined,
      action: 'm365_connection_init',
      resource: 'tenant_connection',
      resourceId: this.tenantConnectionId,
      status: 'success',
      details: { connectionId: this.tenantConnectionId },
    });

    const connections = await query('SELECT * FROM tenant_connections WHERE id = ?', [this.tenantConnectionId]);
    if (connections.length === 0) {
      throw new Error('Tenant connection not found');
    }

    const conn = connections[0] as any;
    this.tenantId = conn.tenant_id;
    this.tenantName = conn.tenant_name;
    this.organizationId = conn.organization_id;
    this.authMode = (conn.certificate_thumbprint || conn.azure_client_secret_encrypted)
      ? AuthenticationMode.APPLICATION
      : AuthenticationMode.DELEGATED;

    if (this.authMode === AuthenticationMode.APPLICATION) {
      if (!conn.azure_client_id || !conn.azure_tenant_id) {
        throw new Error('Application connection requires azure_client_id and azure_tenant_id');
      }
      if (!conn.certificate_thumbprint && !conn.azure_client_secret_encrypted) {
        throw new Error('Application connection requires either certificate_thumbprint or client_secret');
      }
    }

    await this.updateState(M365ConnectionState.VALIDATING);
    await this.updateState(M365ConnectionState.AUTHENTICATING);
    await this.authenticate();
    await this.updateState(M365ConnectionState.CONNECTED);

    const health = await this.healthService.performFullHealthCheck(this.graphClient, this.exchangeService, this.tenantId);
    if (health.status === M365ConnectionState.HEALTHY) {
      await this.updateState(M365ConnectionState.HEALTHY);
    } else if (health.status === M365ConnectionState.DEGRADED) {
      await this.updateState(M365ConnectionState.DEGRADED);
    } else {
      await this.updateState(M365ConnectionState.ERROR);
    }

    await auditLog({
      userId: undefined,
      orgId: this.organizationId,
      action: 'm365_connection_initialized',
      resource: 'tenant_connection',
      resourceId: this.tenantConnectionId,
      status: 'success',
      details: { state: this.state, graphAvailable: health.graphAvailable, exchangeAvailable: health.exchangeAvailable },
    });

    return this.getMetadata();
  }

  async authenticate(): Promise<void> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      await this.updateState(M365ConnectionState.AUTHENTICATION_FAILED);
      throw new Error('Failed to acquire access token for Microsoft 365 connection');
    }

    this.graphClient = new GraphHttpClient(accessToken, this.tenantId);

    const tenantResult = await this.tenantValidator.validateTenant(this.graphClient, this.tenantId);
    if (!tenantResult.valid) {
      await this.updateState(M365ConnectionState.TENANT_VALIDATION_FAILED);
      throw new Error(tenantResult.error || 'Tenant validation failed');
    }

    const graphPs = await getGraphPowerShellService(this.tenantConnectionId);
    if (graphPs) {
      this.graphPsService = graphPs;
      await graphPs.connect();
    }

    const exchange = await getExchangeOnlineService(this.tenantConnectionId);
    if (exchange) {
      this.exchangeService = exchange;
      await exchange.connect();
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      return await getAccessTokenForTenant(this.tenantConnectionId);
    } catch (error: any) {
      if (error instanceof AuthenticationError) {
        console.error(`M365 authentication failed for ${this.tenantConnectionId}: ${error.message}`);
      } else {
        console.error(`Failed to get access token for M365 connection ${this.tenantConnectionId}:`, error);
      }
      return null;
    }
  }

  getGraphClient(): GraphHttpClient | null {
    return this.graphClient;
  }

  getGraphPowerShellService(): GraphPowerShellService | null {
    return this.graphPsService;
  }

  getExchangeOnlineService(): ExchangeOnlineService | null {
    return this.exchangeService;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const graphClient = this.graphClient || await this.ensureGraphClient();
    return this.healthService.performFullHealthCheck(graphClient, this.exchangeService, this.tenantId);
  }

  async disconnect(): Promise<void> {
    if (this.graphPsService) {
      await this.graphPsService.disconnect();
    }
    if (this.exchangeService) {
      await this.exchangeService.disconnect();
    }
    this.graphClient = null;
    this.graphPsService = null;
    this.exchangeService = null;
    await this.updateState(M365ConnectionState.DISCONNECTED);
  }

  async collectGraphData<T = any>(endpoint: string, options?: { maxPages?: number }): Promise<{ data: T[]; errors: CollectionError[]; status: 'completed' | 'partial' | 'failed' }> {
    const client = this.graphClient || await this.ensureGraphClient();
    if (!client) {
      return { data: [], errors: [{ type: 'auth_error', message: 'No Graph client available', operation: endpoint, retryable: false }], status: 'failed' };
    }

    try {
      const data = await client.paginatedRequest<T>({
        tenantConnectionId: this.tenantConnectionId,
        endpoint,
        maxPages: options?.maxPages || 50,
      });
      return { data, errors: [], status: 'completed' };
    } catch (error: any) {
      const err: CollectionError = {
        type: error.type || 'api_error',
        message: error.message || 'Graph collection failed',
        operation: endpoint,
        statusCode: error.statusCode,
        retryable: error.retryable || false,
      };
      return { data: [], errors: [err], status: 'failed' };
    }
  }

  async collectGraphPowerShellData<T = any>(cmdlet: string, parameters: Record<string, any> = {}): Promise<{ data: T[]; errors: CollectionError[]; status: 'completed' | 'partial' | 'failed' }> {
    if (Date.now() < this.graphPsCircuitOpenUntil) {
      return { data: [], errors: [{ type: 'api_error', message: 'Graph PowerShell circuit is open due to repeated failures', operation: cmdlet, retryable: false }], status: 'failed' };
    }

    if (!this.graphPsService) {
      const svc = await getGraphPowerShellService(this.tenantConnectionId);
      if (svc) {
        this.graphPsService = svc;
        await svc.connect();
      } else {
        return { data: [], errors: [{ type: 'api_error', message: 'Graph PowerShell service unavailable', operation: cmdlet, retryable: false }], status: 'failed' };
      }
    }

    try {
      const data = await this.graphPsService.executeCommand(cmdlet, parameters);
      this.graphPsFailureCount = 0;
      return { data: data as T[], errors: [], status: 'completed' };
    } catch (error: any) {
      this.graphPsFailureCount++;
      if (this.graphPsFailureCount >= 5) {
        this.graphPsCircuitOpenUntil = Date.now() + 5 * 60 * 1000;
      }
      const err: CollectionError = {
        type: 'api_error',
        message: error.message || `Graph PowerShell ${cmdlet} failed`,
        operation: cmdlet,
        retryable: false,
      };
      return { data: [], errors: [err], status: 'failed' };
    }
  }

  async collectExchangeData<T = any>(cmdlet: string, parameters: Record<string, any> = {}): Promise<{ data: T[]; errors: CollectionError[]; status: 'completed' | 'partial' | 'failed' }> {
    if (Date.now() < this.exchangeCircuitOpenUntil) {
      return { data: [], errors: [{ type: 'api_error', message: 'Exchange Online circuit is open due to repeated failures', operation: cmdlet, retryable: false }], status: 'failed' };
    }

    if (!this.exchangeService) {
      const svc = await getExchangeOnlineService(this.tenantConnectionId);
      if (svc) {
        this.exchangeService = svc;
        await svc.connect();
      } else {
        return { data: [], errors: [{ type: 'api_error', message: 'Exchange Online service unavailable', operation: cmdlet, retryable: false }], status: 'failed' };
      }
    }

    try {
      const data = await this.exchangeService.executeCommand(cmdlet, parameters);
      this.exchangeFailureCount = 0;
      return { data: data as T[], errors: [], status: 'completed' };
    } catch (error: any) {
      this.exchangeFailureCount++;
      if (this.exchangeFailureCount >= 5) {
        this.exchangeCircuitOpenUntil = Date.now() + 5 * 60 * 1000;
      }
      const err: CollectionError = {
        type: 'api_error',
        message: error.message || `Exchange ${cmdlet} failed`,
        operation: cmdlet,
        retryable: false,
      };
      return { data: [], errors: [err], status: 'failed' };
    }
  }

  getMetadata(): ConnectionMetadata {
    return {
      connectionId: this.tenantConnectionId,
      tenantId: this.tenantId,
      tenantName: this.tenantName,
      organizationId: this.organizationId,
      authenticationMode: this.authMode,
      graphConnected: !!this.graphClient,
      exchangeConnected: !!this.exchangeService,
      permissionsValidated: this.state === M365ConnectionState.HEALTHY || this.state === M365ConnectionState.DEGRADED,
      lastHealthCheck: new Date(),
      state: this.state,
      consentedScopes: [],
      supportedModules: ['Entra ID', 'M365 Admin Center', 'Email', 'Intune', 'SharePoint', 'Teams', 'Purview', 'Cloud Apps'],
    };
  }

  getState(): M365ConnectionState {
    return this.state;
  }

  private async ensureGraphClient(): Promise<GraphHttpClient | null> {
    if (this.graphClient) return this.graphClient;
    const client = await getGraphClient(this.tenantConnectionId);
    if (client) {
      this.graphClient = client;
      await this.authenticate();
    }
    return client;
  }

  private async updateState(newState: M365ConnectionState): Promise<void> {
    this.state = newState;
    try {
      await query('UPDATE tenant_connections SET connection_status = ? WHERE id = ?', [newState, this.tenantConnectionId]);
    } catch (error) {
      console.error('Failed to update connection state:', error);
    }
  }
}

const MAX_CACHE_SIZE = 100;

let connectionManagerCache = new Map<string, Microsoft365ConnectionManager>();

export async function getConnectionManager(tenantConnectionId: string): Promise<Microsoft365ConnectionManager> {
  let manager = connectionManagerCache.get(tenantConnectionId);
  if (!manager) {
    if (connectionManagerCache.size >= MAX_CACHE_SIZE) {
      const firstKey = connectionManagerCache.keys().next().value;
      if (firstKey) {
        connectionManagerCache.delete(firstKey);
      }
    }
    manager = new Microsoft365ConnectionManager(tenantConnectionId);
    connectionManagerCache.set(tenantConnectionId, manager);
  }
  return manager;
}

export function clearConnectionManagerCache(tenantConnectionId?: string): void {
  if (tenantConnectionId) {
    connectionManagerCache.delete(tenantConnectionId);
  } else {
    connectionManagerCache.clear();
  }
}
