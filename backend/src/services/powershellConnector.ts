import { query } from '../db/connection';
import { getAccessTokenForTenant } from './msalAuth';
import { GraphPowerShellService, getGraphPowerShellService, GRAPH_PS_ALLOWLIST } from './graphPowerShellService';
import { ExchangeOnlineService, getExchangeOnlineService, EXCHANGE_PS_ALLOWLIST } from './exchangeOnlineService';
import { AuthenticationMode } from '../types/m365';

export enum PowerShellErrorType {
  AUTH_ERROR = 'auth_error',
  MODULE_NOT_FOUND = 'module_not_found',
  API_ERROR = 'api_error',
  NETWORK_ERROR = 'network_error',
  THROTTLE = 'throttle',
  TIMEOUT = 'timeout',
  PERMISSION_DENIED = 'permission_denied',
}

export interface PowerShellError {
  type: PowerShellErrorType;
  message: string;
  moduleName: string;
  cmdlet: string;
  retryable: boolean;
}

export interface ModuleCollectionResult {
  moduleName: string;
  collectedAt: string;
  data: Record<string, any>;
  errors: PowerShellError[];
  status: 'completed' | 'partial' | 'failed';
}

export interface PowerShellModuleConfig {
  name: string;
  displayName: string;
  description: string;
  requiredRole: string;
  cmdlets: string[];
  connectorType: 'powershell';
  isActive: boolean;
}

export const POWERSHELL_MODULE_CONFIGS: Record<string, PowerShellModuleConfig> = {
  'Email': {
    name: 'Email',
    displayName: 'Email / Defender for Office 365',
    description: 'Anti-phishing, anti-malware, Safe Links, Safe Attachments, anti-spam policy config — requires Exchange Online PowerShell',
    requiredRole: 'Exchange Administrator',
    cmdlets: [
      'Get-AntiPhishPolicy',
      'Get-SafeLinksPolicy',
      'Get-SafeAttachmentPolicy',
      'Get-HostedContentFilterPolicy',
      'Get-MailFlowRule',
    ],
    connectorType: 'powershell',
    isActive: true,
  },
  'Purview': {
    name: 'Purview',
    displayName: 'Purview DLP',
    description: 'DLP policy/rule definitions — requires Security & Compliance PowerShell (no Graph API for policy definitions)',
    requiredRole: 'Compliance Administrator',
    cmdlets: [
      'Get-DlpCompliancePolicy',
      'Get-DlpComplianceRule',
      'Get-RetentionCompliancePolicy',
      'Get-RetentionComplianceRule',
    ],
    connectorType: 'powershell',
    isActive: true,
  },
  'Teams': {
    name: 'Teams',
    displayName: 'Teams Tenant Policies',
    description: 'External access, meeting, messaging policies — requires Microsoft Teams PowerShell module',
    requiredRole: 'Teams Service Administrator',
    cmdlets: [
      'Get-CsTeamsClientConfiguration',
      'Get-CsTeamsMeetingPolicy',
      'Get-CsTeamsMessagingPolicy',
      'Get-CsTeamsExternalAccessPolicy',
    ],
    connectorType: 'powershell',
    isActive: true,
  },
  'Cloud Apps': {
    name: 'Cloud Apps',
    displayName: 'Cloud Apps (Defender for Cloud Apps)',
    description: 'Full CASB policy config (sanctioned/risky app access, session policies) — requires Defender for Cloud Apps portal API; beta Graph API only covers Cloud Discovery',
    requiredRole: 'Cloud App Security Administrator',
    cmdlets: [
      'Get-CloudAppDiscoveryProfile',
      'Get-CloudAppConnector',
    ],
    connectorType: 'powershell',
    isActive: true,
  },
};

export class PowerShellConnector {
  private tenantConnectionId: string;
  private tenantId: string;
  private servicePrincipalId: string;
  private certificateThumbprint: string;

  constructor(tenantConnectionId: string, tenantId: string, servicePrincipalId: string, certificateThumbprint: string) {
    this.tenantConnectionId = tenantConnectionId;
    this.tenantId = tenantId;
    this.servicePrincipalId = servicePrincipalId;
    this.certificateThumbprint = certificateThumbprint;
  }

  async collectModuleData(moduleName: string): Promise<ModuleCollectionResult> {
    const config = POWERSHELL_MODULE_CONFIGS[moduleName];
    if (!config) {
      return {
        moduleName,
        collectedAt: new Date().toISOString(),
        data: {},
        errors: [{
          type: PowerShellErrorType.MODULE_NOT_FOUND,
          message: `Unknown PowerShell module: ${moduleName}`,
          moduleName,
          cmdlet: 'N/A',
          retryable: false,
        }],
        status: 'failed',
      };
    }

    const errors: PowerShellError[] = [];
    const data: Record<string, any> = {};

    if (moduleName === 'Email') {
      const exchange = await getExchangeOnlineService(this.tenantConnectionId);
      if (!exchange) {
        return {
          moduleName,
          collectedAt: new Date().toISOString(),
          data: {},
          errors: [{
            type: PowerShellErrorType.API_ERROR,
            message: `Exchange Online connector not yet fully implemented for ${moduleName}. Requires ${config.requiredRole} role.`,
            moduleName,
            cmdlet: config.cmdlets[0],
            retryable: false,
          }],
          status: 'failed',
        };
      }

      try {
        await exchange.connect();
        const policies: Record<string, any[]> = {};
        for (const cmdlet of config.cmdlets) {
          try {
            const result = await exchange.executeCommand(cmdlet);
            policies[cmdlet] = result;
            data[cmdlet] = { value: result };
          } catch (err: any) {
            errors.push({
              type: err.type === 'permission_denied' ? PowerShellErrorType.PERMISSION_DENIED : PowerShellErrorType.API_ERROR,
              message: err.message,
              moduleName,
              cmdlet,
              retryable: false,
            });
          }
        }
      } catch (err: any) {
        errors.push({
          type: PowerShellErrorType.API_ERROR,
          message: err.message,
          moduleName,
          cmdlet: config.cmdlets[0],
          retryable: false,
        });
      }
    } else if (moduleName === 'Teams' || moduleName === 'Purview' || moduleName === 'Cloud Apps') {
      const psService = await getGraphPowerShellService(this.tenantConnectionId);
      if (!psService) {
        return {
          moduleName,
          collectedAt: new Date().toISOString(),
          data: {},
          errors: [{
            type: PowerShellErrorType.API_ERROR,
            message: `Graph PowerShell connector not yet fully implemented for ${moduleName}. Requires ${config.requiredRole} role.`,
            moduleName,
            cmdlet: config.cmdlets[0],
            retryable: false,
          }],
          status: 'failed',
        };
      }

      try {
        await psService.connect();
        for (const cmdlet of config.cmdlets) {
          try {
            const result = await psService.executeCommand(cmdlet);
            data[cmdlet] = { value: result };
          } catch (err: any) {
            errors.push({
              type: PowerShellErrorType.API_ERROR,
              message: err.message,
              moduleName,
              cmdlet,
              retryable: false,
            });
          }
        }
      } catch (err: any) {
        errors.push({
          type: PowerShellErrorType.API_ERROR,
          message: err.message,
          moduleName,
          cmdlet: config.cmdlets[0],
          retryable: false,
        });
      }
    } else {
      return {
        moduleName,
        collectedAt: new Date().toISOString(),
        data: {},
        errors: [{
          type: PowerShellErrorType.API_ERROR,
          message: `PowerShell connector not yet implemented for ${moduleName}. Requires ${config.requiredRole} role and separate connector service.`,
          moduleName,
          cmdlet: config.cmdlets[0] || 'N/A',
          retryable: false,
        }],
        status: 'failed',
      };
    }

    const hasErrors = errors.some(e => e.type === PowerShellErrorType.PERMISSION_DENIED);
    const status = errors.length === 0 ? 'completed' : Object.keys(data).length > 0 ? 'partial' : 'failed';

    return {
      moduleName,
      collectedAt: new Date().toISOString(),
      data,
      errors,
      status,
    };
  }

  async validateRole(moduleName: string): Promise<{ valid: boolean; missingRole: string }> {
    const config = POWERSHELL_MODULE_CONFIGS[moduleName];
    if (!config) {
      return { valid: false, missingRole: 'Unknown module' };
    }
    return {
      valid: false,
      missingRole: config.requiredRole,
    };
  }

  static getActiveModuleNames(): string[] {
    return Object.entries(POWERSHELL_MODULE_CONFIGS)
      .filter(([_, config]) => config.isActive)
      .map(([name, _]) => name);
  }

  static getModuleConfig(moduleName: string): PowerShellModuleConfig | undefined {
    return POWERSHELL_MODULE_CONFIGS[moduleName];
  }
}
