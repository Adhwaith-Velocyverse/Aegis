import { query } from '../db/connection';
import { getAccessTokenForTenant } from './msalAuth';
import { GraphHttpClient } from './graphHttpClient';
import { AuthenticationError } from '../types/m365';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export enum GraphErrorType {
  AUTH_ERROR = 'auth_error',
  API_ERROR = 'api_error',
  NETWORK_ERROR = 'network_error',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  PERMISSION_DENIED = 'permission_denied',
  THROTTLE = 'throttle',
}

export interface GraphError {
  type: GraphErrorType;
  message: string;
  statusCode?: number;
  moduleName: string;
  endpoint: string;
  retryable: boolean;
  retryAfter?: number;
}

export interface ModuleCollectionResult {
  moduleName: string;
  collectedAt: string;
  data: Record<string, any>;
  errors: GraphError[];
  status: 'completed' | 'partial' | 'failed';
}

export interface ModuleConfig {
  name: string;
  displayName: string;
  description: string;
  scopes: string[];
  endpoints: string[];
  criticalControls: string[];
  connectorType: 'graph' | 'powershell';
  isActive: boolean;
}

// Configuration-driven MODULES registry (FR-5.1)
// This replaces hard-coded per-module logic with a data-driven approach
export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  'Entra ID': {
    name: 'Entra ID',
    displayName: 'Entra ID',
    description: 'Identity, access policies, conditional access, MFA',
    scopes: ['Policy.Read.All', 'Directory.Read.All', 'AuditLog.Read.All', 'RoleManagement.Read.Directory'],
    endpoints: [
      '/policies/authenticationMethodsPolicy',
      '/policies/authenticationFlowsPolicy',
      '/identity/conditionalAccess/policies',
      '/roleManagement/directory/roleAssignments',
      '/users?$select=id,displayName,userPrincipalName,accountEnabled',
      '/reports/authenticationMethods/userRegistrationDetails',
    ],
    criticalControls: ['/policies/authenticationMethodsPolicy', '/identity/conditionalAccess/policies', '/reports/authenticationMethods/userRegistrationDetails'],
    connectorType: 'graph',
    isActive: true,
  },
  'M365 Admin Center': {
    name: 'M365 Admin Center',
    displayName: 'M365 Admin Center',
    description: 'Organization settings, licenses, subscriptions',
    scopes: ['Organization.Read.All', 'Directory.Read.All'],
    endpoints: [
      '/organization',
      '/subscribedSkus',
    ],
    criticalControls: ['/organization'],
    connectorType: 'graph',
    isActive: true,
  },
  'Purview': {
    name: 'Purview',
    displayName: 'Purview',
    description: 'Compliance, DLP, data classification, retention — requires PowerShell connector (no Graph API for DLP policy definitions)',
    scopes: ['InformationProtectionPolicy.Read.All', 'SecurityEvents.Read.All'],
    endpoints: [],
    criticalControls: [],
    connectorType: 'powershell',
    isActive: true,
  },
  'Email': {
    name: 'Email',
    displayName: 'Email / Defender for Office 365',
    description: 'Anti-phishing, anti-malware, Safe Links, Safe Attachments, anti-spam',
    scopes: ['SecurityEvents.Read.All', 'Mail.Read', 'ThreatAssessment.Read.All'],
    endpoints: [
      '/security/alerts?$filter=source/name eq \'Office 365 Security & Compliance\'',
      '/me/mailFolders/inbox/messageRules',
    ],
    criticalControls: ['/security/alerts'],
    connectorType: 'powershell', // No Graph API - requires PowerShell connector
    isActive: true,
  },
  'Intune': {
    name: 'Intune',
    displayName: 'Intune',
    description: 'Device management, compliance, encryption, app protection',
    scopes: ['DeviceManagementConfiguration.Read.All', 'DeviceManagementManagedDevices.Read.All'],
    endpoints: [
      '/deviceManagement/deviceConfigurations',
      '/deviceManagement/managedDevices',
      '/deviceManagement/deviceCompliancePolicies',
    ],
    criticalControls: ['/deviceManagement/managedDevices', '/deviceManagement/deviceCompliancePolicies'],
    connectorType: 'graph',
    isActive: true,
  },
  'Cloud Apps': {
    name: 'Cloud Apps',
    displayName: 'Cloud Apps (Defender for Cloud Apps)',
    description: 'Cloud app discovery, shadow IT, sanctioned apps — beta Graph API only (CloudApp-Discovery.Read.All); full CASB policy config requires manual review',
    scopes: ['CloudApp-Discovery.Read.All', 'SecurityEvents.Read.All'],
    endpoints: [
      '/security/alerts?$filter=source/name eq \'Cloud App Security\'',
    ],
    criticalControls: ['/security/alerts'],
    connectorType: 'graph',
    isActive: true,
  },
  'Teams': {
    name: 'Teams',
    displayName: 'Teams',
    description: 'Teams settings, external access, meetings, messaging policies',
    scopes: ['TeamSettings.Read.All', 'Policy.Read.All'],
    endpoints: [
      '/teamwork/teamSettings',
      '/policies/authenticationMethodsPolicy',
    ],
    criticalControls: ['/teamwork/teamSettings'],
    connectorType: 'powershell', // Full Teams policies require PowerShell
    isActive: true,
  },
  'SharePoint': {
    name: 'SharePoint',
    displayName: 'SharePoint',
    description: 'Sharing, external access, permissions, site settings',
    scopes: ['Sites.Read.All', 'SharePointTenantSettings.Read.All'],
    endpoints: [
      '/sites/root',
      '/admin/sharepoint/settings',
    ],
    criticalControls: ['/admin/sharepoint/settings'],
    connectorType: 'graph',
    isActive: true,
  },
};

// Get all active module names
export function getActiveModuleNames(): string[] {
  return Object.entries(MODULE_CONFIGS)
    .filter(([_, config]) => config.isActive)
    .map(([name, _]) => name);
}

// Get module config by name
export function getModuleConfig(moduleName: string): ModuleConfig | undefined {
  return MODULE_CONFIGS[moduleName];
}

// Get modules by connector type
export function getModulesByConnectorType(type: 'graph' | 'powershell'): ModuleConfig[] {
  return Object.values(MODULE_CONFIGS).filter(config => config.connectorType === type && config.isActive);
}

// Get critical control endpoints for Quick assessment
export function getCriticalEndpoints(moduleName: string): string[] {
  const config = MODULE_CONFIGS[moduleName];
  return config?.criticalControls || [];
}

export class GraphConnector {
  private accessToken: string;
  private tenantId: string;
  private client: GraphHttpClient;

  constructor(accessToken: string, tenantId: string) {
    this.accessToken = accessToken;
    this.tenantId = tenantId;
    this.client = new GraphHttpClient(accessToken, tenantId);
  }

  async collectModuleData(moduleName: string, assessmentType: 'trial' | 'quick' | 'detailed' = 'detailed'): Promise<ModuleCollectionResult> {
    const config = MODULE_CONFIGS[moduleName];
    if (!config) {
      throw new Error(`Unknown module: ${moduleName}`);
    }

    if (config.connectorType === 'powershell') {
      return {
        moduleName,
        collectedAt: new Date().toISOString(),
        data: {},
        errors: [{
          type: GraphErrorType.PERMISSION_DENIED,
          message: `${moduleName} requires PowerShell connector (no Graph API available)`,
          moduleName,
          endpoint: 'N/A',
          retryable: false,
        }],
        status: 'failed',
      };
    }

    const results: Record<string, any> = {};
    const errors: GraphError[] = [];
    let successCount = 0;
    let failCount = 0;

    const endpointsToCollect = assessmentType === 'quick'
      ? config.endpoints.filter(e => config.criticalControls.includes(e))
      : config.endpoints;

    for (const endpoint of endpointsToCollect) {
      try {
        const data = await this.client.paginatedRequest<any>({
          tenantConnectionId: this.tenantId,
          endpoint,
          maxPages: 50,
        });
        results[endpoint] = { value: data };
        successCount++;
      } catch (error: any) {
        const graphError = this.classifyError(error, moduleName, endpoint);
        errors.push(graphError);
        failCount++;
      }
    }

    const status = failCount === 0 ? 'completed' : successCount > 0 ? 'partial' : 'failed';

    return {
      moduleName,
      collectedAt: new Date().toISOString(),
      data: results,
      errors,
      status,
    };
  }

  private classifyError(error: any, moduleName: string, endpoint: string): GraphError {
    // Handle 429 Rate Limit with Retry-After header
    if (error.response?.status === 429) {
      const retryAfterHeader = error.response.headers?.['retry-after'];
      let retryAfter: number | undefined;
      
      if (retryAfterHeader) {
        // Retry-After can be in seconds or a date
        const retryAfterSeconds = parseInt(retryAfterHeader);
        if (!isNaN(retryAfterSeconds)) {
          retryAfter = retryAfterSeconds;
        } else {
          const retryDate = new Date(retryAfterHeader);
          retryAfter = Math.max(1, Math.floor((retryDate.getTime() - Date.now()) / 1000));
        }
      }

      return {
        type: GraphErrorType.THROTTLE,
        message: `Rate limited. Retry after ${retryAfter || 'exponential backoff'} seconds`,
        statusCode: 429,
        moduleName,
        endpoint,
        retryable: true,
        retryAfter,
      };
    }

    if (error.response?.status === 401) {
      return {
        type: GraphErrorType.AUTH_ERROR,
        message: 'Authentication failed - token may be expired or revoked',
        statusCode: 401,
        moduleName,
        endpoint,
        retryable: false,
      };
    }

    if (error.response?.status === 403) {
      return {
        type: GraphErrorType.PERMISSION_DENIED,
        message: 'Insufficient permissions to access this resource',
        statusCode: 403,
        moduleName,
        endpoint,
        retryable: false,
      };
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        type: GraphErrorType.TIMEOUT,
        message: 'Request timed out',
        moduleName,
        endpoint,
        retryable: true,
      };
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        type: GraphErrorType.NETWORK_ERROR,
        message: 'Network error - unable to reach Microsoft Graph',
        moduleName,
        endpoint,
        retryable: true,
      };
    }

    return {
      type: GraphErrorType.API_ERROR,
      message: error.message || 'Unknown API error',
      statusCode: error.response?.status || 500,
      moduleName,
      endpoint,
      retryable: false,
    };
  }

  async validateScopes(moduleName: string): Promise<{ valid: boolean; missingScopes: string[] }> {
    const config = MODULE_CONFIGS[moduleName];
    if (!config) {
      return { valid: false, missingScopes: [] };
    }
    if (config.connectorType === 'powershell') {
      return { valid: false, missingScopes: config.scopes };
    }
    try {
      await this.client.request({
        tenantConnectionId: this.tenantId,
        endpoint: config.endpoints[0],
        top: 1,
      });
      return { valid: true, missingScopes: [] };
    } catch (error: any) {
      if (error.statusCode === 403) {
        return { valid: false, missingScopes: config.scopes };
      }
      return { valid: true, missingScopes: [] };
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.client.request({
        tenantConnectionId: this.tenantId,
        endpoint: '/organization',
        top: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}

export async function getAccessToken(tenantConnectionId: string): Promise<string | null> {
  try {
    return await getAccessTokenForTenant(tenantConnectionId);
  } catch (error: any) {
    if (error instanceof AuthenticationError) {
      console.error(`Graph authentication failed for ${tenantConnectionId}: ${error.message}`);
    } else {
      console.error(`Failed to get access token for Graph connector ${tenantConnectionId}:`, error);
    }
    return null;
  }
}
