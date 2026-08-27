import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { query } from '../db/connection';
import { getAccessTokenForTenant } from './msalAuth';
import { maskPII } from './encryption';
import { AuthenticationMode, CollectionError, AuthenticationError } from '../types/m365';

const exec = promisify(require('child_process').exec);

export const EXCHANGE_PS_ALLOWLIST = new Set([
  'Connect-ExchangeOnline',
  'Disconnect-ExchangeOnline',
  'Get-AntiPhishPolicy',
  'Get-AntiPhishRule',
  'Get-HostedContentFilterPolicy',
  'Get-HostedContentFilterRule',
  'Get-HostedOutboundSpamFilterPolicy',
  'Get-HostedOutboundSpamFilterRule',
  'Get-MalwareFilterPolicy',
  'Get-MalwareFilterRule',
  'Get-SafeLinksPolicy',
  'Get-SafeLinksRule',
  'Get-SafeAttachmentPolicy',
  'Get-SafeAttachmentRule',
  'Get-AcceptedDomain',
  'Get-TransportConfig',
  'Get-CASMailbox',
  'Get-EXOCASMailbox',
  'Get-InboundConnector',
  'Get-OutboundConnector',
  'Get-TransportRule',
  'Get-EXOMailbox',
  'Get-DistributionGroup',
  'Get-DynamicDistributionGroup',
  'Get-UnifiedGroup',
  'Get-TenantAllowBlockListItems',
]);

export interface ExchangePSCommand {
  cmdlet: string;
  parameters: Record<string, string | number | boolean | string[]>;
}

export class ExchangeOnlineService {
  private tenantConnectionId: string;
  private tenantId: string;
  private clientId: string;
  private authMode: AuthenticationMode;
  private certificateThumbprint?: string;
  private connected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(
    tenantConnectionId: string,
    tenantId: string,
    clientId: string,
    authMode: AuthenticationMode,
    certificateThumbprint?: string
  ) {
    this.tenantConnectionId = tenantConnectionId;
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.authMode = authMode;
    this.certificateThumbprint = certificateThumbprint;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this.doConnect();
    return this.connectionPromise;
  }

  private async doConnect(): Promise<void> {
    const cmdlet = 'Connect-ExchangeOnline';
    if (!EXCHANGE_PS_ALLOWLIST.has(cmdlet)) {
      throw new Error(`Cmdlet ${cmdlet} is not allowed`);
    }

    let script = `Import-Module ExchangeOnlineManagement -ErrorAction Stop\n`;
    script += `Connect-ExchangeOnline -UserPrincipalName "app@${this.tenantId}.onmicrosoft.com"`;

    if (this.authMode === AuthenticationMode.APPLICATION && this.certificateThumbprint) {
      script += ` -AppId "${this.clientId}" -CertificateThumbprint "${this.certificateThumbprint}" -Organization "${this.tenantId}"`;
    } else {
      try {
        const accessToken = await getAccessTokenForTenant(this.tenantConnectionId);
        script += ` -AccessToken "${accessToken}"`;
      } catch (error: any) {
        if (error instanceof AuthenticationError) {
          throw error;
        }
        throw new AuthenticationError('AUTHENTICATION_ERROR', error?.message || 'Failed to obtain Exchange Online access token', true, error);
      }
    }

    const result = await this.executeScript(script);
    if (result.errors.length > 0) {
      const message = result.errors[0].message;
      if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('authorization') || message.toLowerCase().includes('403')) {
        throw new AuthenticationError('AUTHORIZATION_ERROR', `Exchange Online connection failed: ${message}`);
      }
      throw new AuthenticationError('COMMAND_ERROR', `Exchange Online connection failed: ${message}`);
    }
    this.connected = true;
  }

  async executeCommand(cmdlet: string, parameters: Record<string, string | number | boolean | string[]> = {}): Promise<any[]> {
    if (!EXCHANGE_PS_ALLOWLIST.has(cmdlet)) {
      throw new Error(`Cmdlet ${cmdlet} is not allowlisted for Exchange Online`);
    }

    if (cmdlet === 'Disconnect-ExchangeOnline') {
      const script = `${cmdlet} -Confirm:$false | ConvertTo-Json -Depth 3`;
      const result = await this.executeScript(script);
      this.connected = false;
      this.connectionPromise = null;
      return [];
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

    const needsAll = ['Get-EXOMailbox', 'Get-Mailbox', 'Get-CASMailbox', 'Get-EXOCASMailbox', 'Get-DistributionGroup', 'Get-TransportRule'].includes(cmdlet);
    let script = `${cmdlet} ${paramStrings}`;
    if (needsAll) {
      script += ' -All -ResultSize Unlimited';
    }
    script += ' | ConvertTo-Json -Depth 10';

    const result = await this.executeScript(script);
    if (result.errors.length > 0) {
      const message = result.errors[0].message;
      if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('authorization') || message.toLowerCase().includes('403')) {
        throw new AuthenticationError('AUTHORIZATION_ERROR', `Exchange Online command failed: ${message}`);
      }
      throw new AuthenticationError('COMMAND_ERROR', `Exchange Online command failed: ${message}`);
    }

    const output = result.data;
    if (Array.isArray(output)) return output;
    if (output && typeof output === 'object') return [output];
    return [];
  }

  async executeScript(script: string): Promise<{ data: any; errors: CollectionError[] }> {
    const startTime = Date.now();
    console.log(`[ExchangePS] Executing script (length ${script.length})`);

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
          reject(new Error('PowerShell execution timed out after 120s'));
        }, 120000);
      });

      await Promise.race([new Promise<void>((resolve) => ps.on('close', resolve)), timeout]);

      const durationMs = Date.now() - startTime;
      const errors: CollectionError[] = [];

      if (stderr && stderr.trim().length > 0) {
        const lower = stderr.toLowerCase();
        if (lower.includes('permission') || lower.includes('authorization') || lower.includes('403')) {
          errors.push({
            type: 'permission_denied',
            message: 'Permission denied in PowerShell execution',
            operation: 'PowerShellExecute',
            statusCode: 403,
            retryable: false,
          });
        } else if (lower.includes('connect') || lower.includes('authentication')) {
          errors.push({
            type: 'auth_error',
            message: 'Authentication failed in PowerShell execution',
            operation: 'PowerShellExecute',
            statusCode: 401,
            retryable: false,
          });
        } else {
          errors.push({
            type: 'api_error',
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

      console.log(`[ExchangePS] Completed in ${durationMs}ms, errors=${errors.length}`);
      return { data: parsed, errors };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[ExchangePS] Failed after ${durationMs}ms:`, maskPII(error.message));
      return {
        data: null,
        errors: [{
          type: 'api_error',
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
      await this.executeCommand('Disconnect-ExchangeOnline');
    } catch {
      // ignore disconnect errors
    }
    this.connected = false;
    this.connectionPromise = null;
  }
}

export async function getExchangeOnlineService(tenantConnectionId: string): Promise<ExchangeOnlineService | null> {
  const connections = await query('SELECT * FROM tenant_connections WHERE id = ?', [tenantConnectionId]);
  if (connections.length === 0) return null;

  const conn = connections[0] as any;
  const tenantId = conn.tenant_id;
  const clientId = conn.azure_client_id;
  const authMode = (conn.certificate_thumbprint || conn.azure_client_secret_encrypted)
    ? AuthenticationMode.APPLICATION
    : AuthenticationMode.DELEGATED;
  const certificateThumbprint = conn.certificate_thumbprint || undefined;

  return new ExchangeOnlineService(tenantConnectionId, tenantId, clientId, authMode, certificateThumbprint);
}
