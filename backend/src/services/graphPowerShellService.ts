import { exec as _exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { query } from '../db/connection';
import { getAccessTokenForTenant } from './msalAuth';
import { maskPII } from './encryption';
import { CollectionError, AuthenticationMode } from '../types/m365';
import { GraphErrorType } from './graphHttpClient';

const exec = promisify(_exec);

export const GRAPH_PS_ALLOWLIST = new Set([
  'Connect-MgGraph',
  'Get-MgContext',
  'Get-MgUser',
  'Get-MgGroup',
  'Get-MgDirectoryRole',
  'Get-MgDirectoryRoleMember',
  'Get-MgPolicyAuthenticationMethodPolicy',
  'Get-MgBetaPolicyAuthenticationMethodPolicy',
  'Get-MgConditionalAccessPolicy',
  'Get-MgNamedLocation',
  'Get-MgIdentitySecurityDefaultsEnforcementPolicy',
  'Get-MgRoleManagementDirectoryRoleEligibilitySchedule',
  'Get-MgRoleManagementDirectoryRoleAssignmentSchedule',
  'Get-MgPolicyRoleManagementPolicy',
  'Get-MgPolicyRoleManagementPolicyRule',
  'Get-MgIdentityGovernanceAccessReviewDefinition',
  'Get-MgAuditLogSignIn',
  'Get-MgAuditLogDirectoryAudit',
  'Get-MgIdentityProtectionRiskDetection',
  'Get-MgApplication',
  'Get-MgServicePrincipal',
  'Get-MgOrganization',
  'Get-MgSubscribedSku',
  'Get-MgDeviceManagementManagedDevice',
  'Get-MgDeviceManagementDeviceConfiguration',
  'Get-MgDeviceManagementDeviceCompliancePolicy',
]);

export interface GraphPSCommand {
  cmdlet: string;
  parameters: Record<string, string | number | boolean | string[]>;
}

export class GraphPowerShellService {
  private tenantId: string;
  private clientId: string;
  private certificateThumbprint?: string;
  private clientSecret?: string;
  private authMode: AuthenticationMode;
  private connected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(
    tenantId: string,
    clientId: string,
    authMode: AuthenticationMode,
    certificateThumbprint?: string,
    clientSecret?: string
  ) {
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.authMode = authMode;
    this.certificateThumbprint = certificateThumbprint;
    this.clientSecret = clientSecret;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this.doConnect();
    return this.connectionPromise;
  }

  private async doConnect(): Promise<void> {
    const cmdlet = 'Connect-MgGraph';
    if (!GRAPH_PS_ALLOWLIST.has(cmdlet)) {
      throw new Error(`Cmdlet ${cmdlet} is not allowed`);
    }

    let script = `Import-Module Microsoft.Graph -ErrorAction Stop\n`;
    script += `Connect-MgGraph -ClientId "${this.clientId}" -TenantId "${this.tenantId}"`;

    if (this.authMode === AuthenticationMode.APPLICATION && this.certificateThumbprint) {
      script += ` -CertificateThumbprint "${this.certificateThumbprint}"`;
    } else if (this.authMode === AuthenticationMode.DELEGATED) {
      const accessToken = await getAccessTokenForTenant(this.tenantId);
      if (!accessToken) throw new Error('No access token available for delegated Graph PowerShell connection');
      script += ` -AccessToken "${accessToken}"`;
    } else {
      throw new Error('Invalid Graph PowerShell authentication configuration');
    }

    const result = await this.executeScript(script);
    if (result.errors.length > 0) {
      throw new Error(`Graph PowerShell connection failed: ${result.errors[0].message}`);
    }
    this.connected = true;
  }

  async executeCommand(cmdlet: string, parameters: Record<string, string | number | boolean | string[]> = {}): Promise<any[]> {
    if (!GRAPH_PS_ALLOWLIST.has(cmdlet)) {
      throw new Error(`Cmdlet ${cmdlet} is not allowlisted for Graph PowerShell`);
    }

    await this.connect();

    const paramStrings = Object.entries(parameters)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          return `-${k} @(${v.map((x) => typeof x === 'string' ? `'${x.replace(/'/g, "''")}'` : x).join(',')})`;
        }
        if (typeof v === 'boolean') {
          return v ? `-${k}` : '';
        }
        if (typeof v === 'string') {
          return `-${k} '${v.replace(/'/g, "''")}'`;
        }
        return `-${k} ${v}`;
      })
      .filter(Boolean)
      .join(' ');

    let script = `${cmdlet} ${paramStrings} | ConvertTo-Json -Depth 10`;
    if (cmdlet === 'Get-MgUser' || cmdlet === 'Get-MgGroup' || cmdlet === 'Get-MgDirectoryRole') {
      script += ' -All';
    }

    const result = await this.executeScript(script);
    if (result.errors.length > 0) {
      throw new Error(`Graph PowerShell command failed: ${result.errors[0].message}`);
    }

    const output = result.data;
    if (Array.isArray(output)) return output;
    if (output && typeof output === 'object') return [output];
    return [];
  }

  async executeScript(script: string): Promise<{ data: any; errors: CollectionError[] }> {
    const startTime = Date.now();
    console.log(`[GraphPS] Executing script (length ${script.length})`);

    try {
      const ps = spawn('powershell.exe', ['-NoProfile', '-Command', script], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      ps.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ps.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          ps.kill();
          reject(new Error('PowerShell execution timed out after 60s'));
        }, 60000);
      });

      await Promise.race([new Promise<void>((resolve) => ps.on('close', resolve)), timeout]);

      const durationMs = Date.now() - startTime;
      const errors: CollectionError[] = [];

      if (stderr && stderr.trim().length > 0) {
        const lower = stderr.toLowerCase();
        if (lower.includes('permission') || lower.includes('authorization') || lower.includes('403')) {
          errors.push({
            type: GraphErrorType.PERMISSION_DENIED,
            message: 'Permission denied in PowerShell execution',
            operation: 'PowerShellExecute',
            statusCode: 403,
            retryable: false,
          });
        } else if (lower.includes('connect') || lower.includes('authentication')) {
          errors.push({
            type: GraphErrorType.AUTH_ERROR,
            message: 'Authentication failed in PowerShell execution',
            operation: 'PowerShellExecute',
            statusCode: 401,
            retryable: false,
          });
        } else {
          errors.push({
            type: GraphErrorType.API_ERROR,
            message: stderr.trim().substring(0, 500),
            operation: 'PowerShellExecute',
            retryable: false,
          });
        }
      }

      let parsed: any = null;
      if (stdout.trim()) {
        try {
          parsed = JSON.parse(stdout.trim());
        } catch {
          parsed = stdout.trim();
        }
      }

      console.log(`[GraphPS] Completed in ${durationMs}ms, errors=${errors.length}`);
      return { data: parsed, errors };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[GraphPS] Failed after ${durationMs}ms:`, maskPII(error.message));
      return {
        data: null,
        errors: [{
          type: GraphErrorType.API_ERROR,
          message: error.message || 'PowerShell execution failed',
          operation: 'PowerShellExecute',
          retryable: false,
        }],
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.executeCommand('Disconnect-MgGraph');
    } catch {
      // ignore disconnect errors
    }
    this.connected = false;
    this.connectionPromise = null;
  }
}

export async function getGraphPowerShellService(tenantConnectionId: string): Promise<GraphPowerShellService | null> {
  const connections = await query('SELECT * FROM tenant_connections WHERE id = ?', [tenantConnectionId]);
  if (connections.length === 0) return null;

  const conn = connections[0] as any;
  const tenantId = conn.tenant_id;
  const clientId = conn.azure_client_id;
  const authMode = conn.consented_scopes ? AuthenticationMode.APPLICATION : AuthenticationMode.DELEGATED;
  const certificateThumbprint = conn.certificate_thumbprint || undefined;

  return new GraphPowerShellService(tenantId, clientId, authMode, certificateThumbprint);
}
