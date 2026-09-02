import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { query } from '../db/connection';
import { getAccessTokenForTenant, getExchangeOnlineAccessTokenForTenant } from './msalAuth';
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

interface CommandResult {
  data: any;
  errors: CollectionError[];
}

export class ExchangeOnlineService {
  private tenantConnectionId: string;
  private tenantId: string;
  private clientId: string;
  private authMode: AuthenticationMode;
  private certificateThumbprint?: string;
  private connected = false;
  private connectionPromise: Promise<void> | null = null;
  private psProcess: ChildProcess | null = null;
  private commandId = 0;
  private commandQueue: Promise<CommandResult> = Promise.resolve({ data: null, errors: [] });

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

    this.connectionPromise = this.ensureProcess();
    return this.connectionPromise;
  }

  private async ensureProcess(): Promise<void> {
    if (this.psProcess && !this.psProcess.killed && this.psProcess.exitCode === null) {
      return;
    }

    if (this.psProcess) {
      try { this.psProcess.kill('SIGTERM'); } catch {}
      this.psProcess = null;
    }

    const ps = spawn('powershell.exe', ['-NoProfile', '-Command', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.psProcess = ps;
    this.sharedStdout = '';
    this.sharedStderr = '';
    this.psOutputListenerInstalled = false;
    this.psErrorListenerInstalled = false;
    this.pendingCalls.clear();

    ps.on('exit', (code) => {
      this.psProcess = null;
      this.connected = false;
      const err = new Error(`PowerShell process exited unexpectedly (code ${code})`);
      for (const [, entry] of this.pendingCalls) {
        clearTimeout(entry.timer);
        entry.reject(err);
      }
      this.pendingCalls.clear();
      if (code !== 0 && code !== null) {
        console.error(`[ExchangePS] Process exited with code ${code}`);
      }
    });

    await this.runBootstrapCommand('Import-Module ExchangeOnlineManagement -ErrorAction Stop');

    const accessToken = await getExchangeOnlineAccessTokenForTenant(this.tenantConnectionId);
    const userPrincipalName = await this.resolveUserPrincipalName(accessToken);

    if (this.authMode === AuthenticationMode.APPLICATION && this.certificateThumbprint) {
      await this.runBootstrapCommand(
        `Connect-ExchangeOnline -AppId "${this.clientId}" -CertificateThumbprint "${this.certificateThumbprint}" -Organization "${this.tenantId}"`
      );
    } else {
      await this.runBootstrapCommand(
        `Connect-ExchangeOnline -UserPrincipalName "${userPrincipalName}" -AccessToken "${accessToken}"`
      );
    }

    this.connected = true;
  }

  private async runBootstrapCommand(script: string): Promise<void> {
    const marker = `<<<EXO_BOOT_${this.commandId++}>>>`;
    const wrapped = `${script}\nWrite-Output "${marker}"\n`;

    const result = await this.writeToProcess(wrapped, marker);
    if (result.errors.length > 0) {
      const message = result.errors[0].message;
      if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('authorization') || message.toLowerCase().includes('403')) {
        throw new AuthenticationError('AUTHORIZATION_ERROR', `Exchange Online connection failed: ${message}`);
      }
      if (message.toLowerCase().includes('authentication') || message.toLowerCase().includes('unauthorized')) {
        throw new AuthenticationError('AUTHENTICATION_ERROR', `Exchange Online authentication failed: ${message}`);
      }
      throw new AuthenticationError('COMMAND_ERROR', `Exchange Online connection failed: ${message}`);
    }
  }

  private pendingCalls: Map<string, { resolve: (r: CommandResult) => void; reject: (e: Error) => void; timer: NodeJS.Timeout; stderr: string }> = new Map();
  private sharedStdout = '';
  private sharedStderr = '';
  private psOutputListenerInstalled = false;
  private psErrorListenerInstalled = false;

  private async writeToProcess(script: string, marker: string): Promise<CommandResult> {
    await this.ensureProcess();
    const ps = this.psProcess!;

    if (!this.psOutputListenerInstalled) {
      ps.stdout!.setEncoding('utf8');
      ps.stdout!.on('data', (chunk: string) => this.handleOutput(chunk));
      this.psOutputListenerInstalled = true;
    }
    if (!this.psErrorListenerInstalled) {
      ps.stderr!.setEncoding('utf8');
      ps.stderr!.on('data', (chunk: string) => {
        this.sharedStderr += chunk;
      });
      this.psErrorListenerInstalled = true;
    }

    return new Promise<CommandResult>((resolve, reject) => {
      const callId = marker;
      const timer = setTimeout(() => {
        const entry = this.pendingCalls.get(callId);
        if (!entry) return;
        this.pendingCalls.delete(callId);
        reject(new Error('PowerShell execution timed out after 30s'));
      }, 30000);

      this.pendingCalls.set(callId, {
        resolve: (r) => { clearTimeout(timer); resolve(r); },
        reject: (e) => { clearTimeout(timer); reject(e); },
        timer,
        stderr: '',
      });

      try {
        ps.stdin!.write(script);
      } catch (err: any) {
        this.pendingCalls.delete(callId);
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  private handleOutput(chunk: string): void {
    this.sharedStdout += chunk;

    for (const [marker, entry] of this.pendingCalls) {
      if (this.sharedStdout.includes(marker)) {
        const idx = this.sharedStdout.indexOf(marker);
        const before = this.sharedStdout.substring(0, idx).trim();
        const after = this.sharedStdout.substring(idx + marker.length);

        let parsed: any = null;
        if (before) {
          try { parsed = JSON.parse(before); } catch { parsed = before; }
        }

        const errors = this.parseErrors(this.sharedStderr);
        this.sharedStdout = after;
        this.sharedStderr = '';
        this.pendingCalls.delete(marker);
        entry.resolve({ data: parsed, errors });
      }
    }
  }

  private parseErrors(stderr: string): CollectionError[] {
    const errors: CollectionError[] = [];
    if (!stderr || !stderr.trim()) return errors;

    const trimmedStderr = stderr.trim().substring(0, 2000);
    const lower = stderr.toLowerCase();
    if (lower.includes('permission') || lower.includes('authorization') || lower.includes('403')) {
      errors.push({
        type: 'permission_denied',
        message: `Exchange Online permission denied: ${trimmedStderr}`,
        operation: 'PowerShellExecute',
        statusCode: 403,
        retryable: false,
      });
    } else if (lower.includes('connect') || lower.includes('authentication') || lower.includes('unauthorized')) {
      errors.push({
        type: 'auth_error',
        message: `Exchange Online authentication failed: ${trimmedStderr}`,
        operation: 'PowerShellExecute',
        statusCode: 401,
        retryable: false,
      });
    } else {
      errors.push({
        type: 'api_error',
        message: trimmedStderr,
        operation: 'PowerShellExecute',
        retryable: false,
      });
    }
    return errors;
  }

  async executeCommand(cmdlet: string, parameters: Record<string, string | number | boolean | string[]> = {}): Promise<any[]> {
    if (!EXCHANGE_PS_ALLOWLIST.has(cmdlet)) {
      throw new Error(`Cmdlet ${cmdlet} is not allowlisted for Exchange Online`);
    }

    if (cmdlet === 'Disconnect-ExchangeOnline') {
      const script = `${cmdlet} -Confirm:$false | ConvertTo-Json -Depth 3`;
      const marker = `<<<EXO_DISC_${this.commandId++}>>>`;
      const wrapped = `${script}\nWrite-Output "${marker}"\n`;

      try {
        await this.writeToProcess(wrapped, marker);
      } catch {
        // ignore disconnect errors
      }

      this.connected = false;
      this.connectionPromise = null;

      if (this.psProcess && !this.psProcess.killed) {
        this.psProcess.kill('SIGTERM');
        this.psProcess = null;
      }

      return [];
    }

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

    const supportsAllAndResultSize = new Set([
      'Get-Mailbox',
      'Get-CASMailbox',
      'Get-DistributionGroup',
    ]);

    const supportsResultSizeOnly = new Set([
      'Get-EXOMailbox',
      'Get-EXOCASMailbox',
      'Get-UnifiedGroup',
      'Get-DynamicDistributionGroup',
    ]);

    let commandScript = `${cmdlet} ${paramStrings}`.trim();
    if (supportsAllAndResultSize.has(cmdlet)) {
      commandScript += ' -All -ResultSize Unlimited';
    } else if (supportsResultSizeOnly.has(cmdlet)) {
      commandScript += ' -ResultSize Unlimited';
    }
    commandScript += ' | ConvertTo-Json -Depth 10';

    const marker = `<<<EXO_${this.commandId++}>>>`;
    const wrapped = `${commandScript}; Write-Output "${marker}"\n`;

    const result = await this.writeToProcess(wrapped, marker);

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

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      const script = `Disconnect-ExchangeOnline -Confirm:$false | ConvertTo-Json -Depth 3`;
      const marker = `<<<EXO_DISC_${this.commandId++}>>>`;
      const wrapped = `${script}\nWrite-Output "${marker}"\n`;
      await this.writeToProcess(wrapped, marker);
    } catch {
      // ignore disconnect errors
    }

    this.connected = false;
    this.connectionPromise = null;

    if (this.psProcess && !this.psProcess.killed) {
      this.psProcess.kill('SIGTERM');
      this.psProcess = null;
    }
  }

  private async resolveUserPrincipalName(_accessToken: string): Promise<string> {
    const conn = await query('SELECT tenant_id FROM tenant_connections WHERE id = ?', [this.tenantConnectionId]);
    const tenantDomain = (conn[0] as any)?.tenant_id || this.tenantId;
    return `admin@${tenantDomain}`;
  }
}

export async function getExchangeOnlineService(tenantConnectionId: string): Promise<ExchangeOnlineService | null> {
  const connections = await query('SELECT * FROM tenant_connections WHERE id = ?', [tenantConnectionId]);
  if (connections.length === 0) return null;

  const conn = connections[0] as any;
  const tenantId = conn.tenant_id;
  const clientId = conn.azure_client_id;

  if (conn.certificate_thumbprint) {
    return new ExchangeOnlineService(tenantConnectionId, tenantId, clientId, AuthenticationMode.APPLICATION, conn.certificate_thumbprint);
  }

  if (conn.azure_client_secret_encrypted) {
    return new ExchangeOnlineService(tenantConnectionId, tenantId, clientId, AuthenticationMode.APPLICATION);
  }

  if (conn.refresh_token_encrypted) {
    return new ExchangeOnlineService(tenantConnectionId, tenantId, clientId, AuthenticationMode.DELEGATED);
  }

  throw new AuthenticationError(
    'AUTHENTICATION_ERROR',
    'No valid authentication method available for Exchange Online. Configure certificate-based app-only auth, client secret app-only auth, or delegated OAuth with Exchange Online scopes.',
    true
  );
}
