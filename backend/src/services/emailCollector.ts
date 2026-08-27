import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { getAccessTokenForTenant } from './msalAuth';
import { ExchangeOnlineService, getExchangeOnlineService } from './exchangeOnlineService';
import { DataNormalizationService } from './dataNormalizationService';
import {
  AntiPhishPolicy,
  AntiPhishRule,
  AntiSpamPolicy,
  AntiSpamRule,
  AntiMalwarePolicy,
  AntiMalwareRule,
  SafeLinksPolicy,
  SafeLinksRule,
  SafeAttachmentPolicy,
  SafeAttachmentRule,
  ExchangeConnector,
  TransportRule,
  Mailbox,
  DistributionGroup,
  CollectionError,
  AuthenticationError,
} from '../types/m365';

export interface EmailCollectionError {
  command: string;
  type: 'permission_denied' | 'auth_error' | 'api_error' | 'network_error' | 'timeout' | 'unknown';
  message: string;
  retryable: boolean;
}

export interface EmailCollectionAuthError {
  type: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'COMMAND_ERROR';
  message: string;
  requiresReauthentication: boolean;
  cause?: Error;
}

export interface EmailCollectionResult {
  moduleName: string;
  collectedAt: string;
  status: 'completed' | 'partial' | 'failed';
  data: {
    antiPhishing: { policies: AntiPhishPolicy[]; rules: AntiPhishRule[] };
    antiSpam: {
      inboundPolicies: AntiSpamPolicy[];
      inboundRules: AntiSpamRule[];
      outboundPolicies: AntiSpamPolicy[];
      outboundRules: AntiSpamRule[];
    };
    antiMalware: { policies: AntiMalwarePolicy[]; rules: AntiMalwareRule[] };
    safeLinks: { policies: SafeLinksPolicy[]; rules: SafeLinksRule[] };
    safeAttachments: { policies: SafeAttachmentPolicy[]; rules: SafeAttachmentRule[] };
    mailFlow: {
      acceptedDomains: any[];
      inboundConnectors: ExchangeConnector[];
      outboundConnectors: ExchangeConnector[];
      transportRules: TransportRule[];
      transportConfig: any;
      smtpAuthDisabled: boolean | null;
      popImapStatus: { popEnabled: boolean; imapEnabled: boolean }[];
    };
    mailboxes: { all: Mailbox[]; user: Mailbox[]; shared: Mailbox[]; resource: Mailbox[] };
    groups: {
      distribution: DistributionGroup[];
      dynamicDistribution: DistributionGroup[];
      microsoft365: any[];
      mailEnabledSecurity: DistributionGroup[];
    };
    security: {
      alerts: any[];
      incidents: any[];
      tenantAllowBlockList: any[];
    };
    metrics: {
      totalMailboxes: number;
      userMailboxes: number;
      sharedMailboxes: number;
      resourceMailboxes: number;
      distributionGroups: number;
      dynamicDistributionGroups: number;
      m365Groups: number;
      mailEnabledSecurityGroups: number;
    };
  };
  errors: EmailCollectionError[];
  raw: Record<string, { command: string; stdout: string; stderr: string; exitCode: number; durationMs: number }>;
}

const DATA_DIR = path.join(__dirname, '..', '..', 'assessment-data');

export class EmailCollector {
  private tenantConnectionId: string;
  private exchangeService: ExchangeOnlineService | null = null;
  private normalizationService: DataNormalizationService;
  private errors: EmailCollectionError[] = [];
  private rawEvidence: Record<string, { command: string; stdout: string; stderr: string; exitCode: number; durationMs: number }> = {};

  constructor(tenantConnectionId: string) {
    this.tenantConnectionId = tenantConnectionId;
    this.normalizationService = new DataNormalizationService();
  }

  private async getExchangeService(): Promise<ExchangeOnlineService | null> {
    if (this.exchangeService) return this.exchangeService;
    this.exchangeService = await getExchangeOnlineService(this.tenantConnectionId);
    return this.exchangeService;
  }

  async validateAuthentication(): Promise<EmailCollectionAuthError | null> {
    try {
      const service = await getExchangeOnlineService(this.tenantConnectionId);
      if (!service) {
        return {
          type: 'AUTHENTICATION_ERROR',
          message: 'Exchange Online service not available for tenant connection',
          requiresReauthentication: true,
        };
      }
      await service.connect();
      return null;
    } catch (error: any) {
      if (error instanceof AuthenticationError) {
        return {
          type: error.type,
          message: error.message,
          requiresReauthentication: error.requiresReauthentication,
          cause: error.cause || error,
        };
      }
      return {
        type: 'AUTHENTICATION_ERROR',
        message: error?.message || 'Unknown authentication error',
        requiresReauthentication: true,
        cause: error,
      };
    }
  }

  private recordError(command: string, error: any, defaultType: EmailCollectionError['type'] = 'unknown'): EmailCollectionError {
    const err: EmailCollectionError = {
      command,
      type: defaultType,
      message: error?.message || String(error),
      retryable: false,
    };
    this.errors.push(err);
    return err;
  }

  private async executeAndNormalize<T>(
    command: string,
    normalizer: (raw: any[]) => T[],
    params: Record<string, any> = {}
  ): Promise<T[]> {
    const service = await this.getExchangeService();
    if (!service) {
      this.recordError(command, { message: 'Exchange Online service not available' }, 'auth_error');
      return [];
    }

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      const result = await service.executeCommand(command, params);
      const durationMs = Date.now() - startTime;

      if (result && Array.isArray(result)) {
        const normalized = normalizer(result);
        this.rawEvidence[command] = {
          command,
          stdout: JSON.stringify(result),
          stderr: '',
          exitCode: 0,
          durationMs,
        };
        return normalized;
      }

      this.rawEvidence[command] = {
        command,
        stdout: JSON.stringify(result),
        stderr: '',
        exitCode: 0,
        durationMs,
      };
      return [];
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errType = error?.type === 'permission_denied' ? 'permission_denied' :
                      error?.type === 'AUTHENTICATION_ERROR' ? 'auth_error' :
                      error?.type === 'AUTHORIZATION_ERROR' ? 'permission_denied' :
                      error?.type === 'auth_error' ? 'auth_error' : 'api_error';
      this.recordError(command, error, errType);
      this.rawEvidence[command] = {
        command,
        stdout: '',
        stderr: error?.message || String(error),
        exitCode: 1,
        durationMs,
      };
      return [];
    }
  }

  async collectAll(): Promise<EmailCollectionResult> {
    const collectedAt = new Date().toISOString();
    this.errors = [];
    this.rawEvidence = {};

    const authError = await this.validateAuthentication();
    if (authError) {
      const err: EmailCollectionError = {
        command: 'Connect-ExchangeOnline',
        type: 'auth_error',
        message: authError.message,
        retryable: false,
      };
      this.errors.push(err);

      return {
        moduleName: 'Email',
        collectedAt,
        status: 'failed',
        data: {
          antiPhishing: { policies: [], rules: [] },
          antiSpam: { inboundPolicies: [], inboundRules: [], outboundPolicies: [], outboundRules: [] },
          antiMalware: { policies: [], rules: [] },
          safeLinks: { policies: [], rules: [] },
          safeAttachments: { policies: [], rules: [] },
          mailFlow: { acceptedDomains: [], inboundConnectors: [], outboundConnectors: [], transportRules: [], transportConfig: null, smtpAuthDisabled: null, popImapStatus: [] },
          mailboxes: { all: [], user: [], shared: [], resource: [] },
          groups: { distribution: [], dynamicDistribution: [], microsoft365: [], mailEnabledSecurity: [] },
          security: { alerts: [], incidents: [], tenantAllowBlockList: [] },
          metrics: { totalMailboxes: 0, userMailboxes: 0, sharedMailboxes: 0, resourceMailboxes: 0, distributionGroups: 0, dynamicDistributionGroups: 0, m365Groups: 0, mailEnabledSecurityGroups: 0 },
        },
        errors: this.errors,
        raw: this.rawEvidence,
      };
    }

    const [
      antiPhishingPolicies,
      antiPhishingRules,
      inboundSpamPolicies,
      inboundSpamRules,
      outboundSpamPolicies,
      outboundSpamRules,
      malwarePolicies,
      malwareRules,
      safeLinksPolicies,
      safeLinksRules,
      safeAttachmentPolicies,
      safeAttachmentRules,
      acceptedDomains,
      inboundConnectors,
      outboundConnectors,
      transportRules,
      transportConfig,
      smtpAuthMailboxes,
      allMailboxes,
      distributionGroups,
      dynamicDistributionGroups,
      unifiedGroups,
      tenantAllowBlockList,
    ] = await Promise.all([
      this.executeAndNormalize('Get-AntiPhishPolicy', (r) => this.normalizationService.normalizeAntiPhishPolicies(r).normalized),
      this.executeAndNormalize('Get-AntiPhishRule', (r) => this.normalizationService.normalizeAntiPhishRules(r).normalized),
      this.executeAndNormalize('Get-HostedContentFilterPolicy', (r) => this.normalizationService.normalizeAntiSpamPolicies(r).normalized),
      this.executeAndNormalize('Get-HostedContentFilterRule', (r) => this.normalizationService.normalizeAntiSpamRules(r).normalized),
      this.executeAndNormalize('Get-HostedOutboundSpamFilterPolicy', (r) => this.normalizationService.normalizeAntiSpamPolicies(r).normalized),
      this.executeAndNormalize('Get-HostedOutboundSpamFilterRule', (r) => this.normalizationService.normalizeAntiSpamRules(r).normalized),
      this.executeAndNormalize('Get-MalwareFilterPolicy', (r) => this.normalizationService.normalizeAntiMalwarePolicies(r).normalized),
      this.executeAndNormalize('Get-MalwareFilterRule', (r) => this.normalizationService.normalizeAntiMalwareRules(r).normalized),
      this.executeAndNormalize('Get-SafeLinksPolicy', (r) => this.normalizationService.normalizeSafeLinksPolicies(r).normalized),
      this.executeAndNormalize('Get-SafeLinksRule', (r) => this.normalizationService.normalizeSafeLinksRules(r).normalized),
      this.executeAndNormalize('Get-SafeAttachmentPolicy', (r) => this.normalizationService.normalizeSafeAttachmentPolicies(r).normalized),
      this.executeAndNormalize('Get-SafeAttachmentRule', (r) => this.normalizationService.normalizeSafeAttachmentRules(r).normalized),
      this.executeAndNormalize('Get-AcceptedDomain', (r) => this.normalizeAcceptedDomains(r)),
      this.executeAndNormalize('Get-InboundConnector', (r) => this.normalizationService.normalizeConnectors(r).normalized),
      this.executeAndNormalize('Get-OutboundConnector', (r) => this.normalizationService.normalizeConnectors(r).normalized),
      this.executeAndNormalize('Get-TransportRule', (r) => this.normalizationService.normalizeTransportRules(r).normalized),
      this.executeAndNormalize('Get-TransportConfig', (r) => this.normalizeTransportConfig(r)),
      this.executeAndNormalize('Get-EXOCASMailbox', (r) => this.normalizeSmtpAuthMailboxes(r)),
      this.executeAndNormalize('Get-EXOMailbox', (r) => this.normalizationService.normalizeMailboxes(r).normalized),
      this.executeAndNormalize('Get-DistributionGroup', (r) => this.normalizationService.normalizeDistributionGroups(r).normalized),
      this.executeAndNormalize('Get-DynamicDistributionGroup', (r) => this.normalizeDynamicDistributionGroups(r)),
      this.executeAndNormalize('Get-UnifiedGroup', (r) => this.normalizeUnifiedGroups(r)),
      this.executeAndNormalize('Get-TenantAllowBlockListItems', (r) => this.normalizeTenantAllowBlockListItems(r)),
    ]);

    const smtpAuthDisabled = this.determineSmtpAuthDisabled(transportConfig, smtpAuthMailboxes);
    const popImapStatus = this.determinePopImapStatus(allMailboxes);

    const userMailboxes = allMailboxes.filter((m) => !m.isShared && !m.isResource);
    const sharedMailboxes = allMailboxes.filter((m) => m.isShared);
    const resourceMailboxes = allMailboxes.filter((m) => m.isResource);

    const result: EmailCollectionResult = {
      moduleName: 'Email',
      collectedAt,
      status: this.errors.length === 0 ? 'completed' : 'partial',
      data: {
        antiPhishing: { policies: antiPhishingPolicies, rules: antiPhishingRules },
        antiSpam: {
          inboundPolicies: inboundSpamPolicies,
          inboundRules: inboundSpamRules,
          outboundPolicies: outboundSpamPolicies,
          outboundRules: outboundSpamRules,
        },
        antiMalware: { policies: malwarePolicies, rules: malwareRules },
        safeLinks: { policies: safeLinksPolicies, rules: safeLinksRules },
        safeAttachments: { policies: safeAttachmentPolicies, rules: safeAttachmentRules },
        mailFlow: {
          acceptedDomains,
          inboundConnectors,
          outboundConnectors,
          transportRules,
          transportConfig: transportConfig[0] || null,
          smtpAuthDisabled,
          popImapStatus,
        },
        mailboxes: {
          all: allMailboxes,
          user: userMailboxes,
          shared: sharedMailboxes,
          resource: resourceMailboxes,
        },
        groups: {
          distribution: distributionGroups,
          dynamicDistribution: dynamicDistributionGroups,
          microsoft365: unifiedGroups,
          mailEnabledSecurity: distributionGroups.filter((g) => g.groupType === 'MailEnabledSecurity'),
        },
        security: {
          alerts: [],
          incidents: [],
          tenantAllowBlockList,
        },
        metrics: {
          totalMailboxes: allMailboxes.length,
          userMailboxes: userMailboxes.length,
          sharedMailboxes: sharedMailboxes.length,
          resourceMailboxes: resourceMailboxes.length,
          distributionGroups: distributionGroups.length,
          dynamicDistributionGroups: dynamicDistributionGroups.length,
          m365Groups: unifiedGroups.length,
          mailEnabledSecurityGroups: distributionGroups.filter((g) => g.groupType === 'MailEnabledSecurity').length,
        },
      },
      errors: this.errors,
      raw: this.rawEvidence,
    };

    return result;
  }

  async collectForQuickAssessment(): Promise<EmailCollectionResult> {
    const collectedAt = new Date().toISOString();
    this.errors = [];
    this.rawEvidence = {};

    const authError = await this.validateAuthentication();
    if (authError) {
      const err: EmailCollectionError = {
        command: 'Connect-ExchangeOnline',
        type: 'auth_error',
        message: authError.message,
        retryable: false,
      };
      this.errors.push(err);

      return {
        moduleName: 'Email',
        collectedAt,
        status: 'failed',
        data: {
          antiPhishing: { policies: [], rules: [] },
          antiSpam: { inboundPolicies: [], inboundRules: [], outboundPolicies: [], outboundRules: [] },
          antiMalware: { policies: [], rules: [] },
          safeLinks: { policies: [], rules: [] },
          safeAttachments: { policies: [], rules: [] },
          mailFlow: { acceptedDomains: [], inboundConnectors: [], outboundConnectors: [], transportRules: [], transportConfig: null, smtpAuthDisabled: null, popImapStatus: [] },
          mailboxes: { all: [], user: [], shared: [], resource: [] },
          groups: { distribution: [], dynamicDistribution: [], microsoft365: [], mailEnabledSecurity: [] },
          security: { alerts: [], incidents: [], tenantAllowBlockList: [] },
          metrics: { totalMailboxes: 0, userMailboxes: 0, sharedMailboxes: 0, resourceMailboxes: 0, distributionGroups: 0, dynamicDistributionGroups: 0, m365Groups: 0, mailEnabledSecurityGroups: 0 },
        },
        errors: this.errors,
        raw: this.rawEvidence,
      };
    }

    const [
      antiPhishingPolicies,
      antiPhishingRules,
      inboundSpamPolicies,
      inboundSpamRules,
      outboundSpamPolicies,
      outboundSpamRules,
      malwarePolicies,
      malwareRules,
      safeLinksPolicies,
      safeLinksRules,
      safeAttachmentPolicies,
      safeAttachmentRules,
      acceptedDomains,
      inboundConnectors,
      outboundConnectors,
      transportRules,
      transportConfig,
      smtpAuthMailboxes,
      allMailboxes,
    ] = await Promise.all([
      this.executeAndNormalize('Get-AntiPhishPolicy', (r) => this.normalizationService.normalizeAntiPhishPolicies(r).normalized),
      this.executeAndNormalize('Get-AntiPhishRule', (r) => this.normalizationService.normalizeAntiPhishRules(r).normalized),
      this.executeAndNormalize('Get-HostedContentFilterPolicy', (r) => this.normalizationService.normalizeAntiSpamPolicies(r).normalized),
      this.executeAndNormalize('Get-HostedContentFilterRule', (r) => this.normalizationService.normalizeAntiSpamRules(r).normalized),
      this.executeAndNormalize('Get-HostedOutboundSpamFilterPolicy', (r) => this.normalizationService.normalizeAntiSpamPolicies(r).normalized),
      this.executeAndNormalize('Get-HostedOutboundSpamFilterRule', (r) => this.normalizationService.normalizeAntiSpamRules(r).normalized),
      this.executeAndNormalize('Get-MalwareFilterPolicy', (r) => this.normalizationService.normalizeAntiMalwarePolicies(r).normalized),
      this.executeAndNormalize('Get-MalwareFilterRule', (r) => this.normalizationService.normalizeAntiMalwareRules(r).normalized),
      this.executeAndNormalize('Get-SafeLinksPolicy', (r) => this.normalizationService.normalizeSafeLinksPolicies(r).normalized),
      this.executeAndNormalize('Get-SafeLinksRule', (r) => this.normalizationService.normalizeSafeLinksRules(r).normalized),
      this.executeAndNormalize('Get-SafeAttachmentPolicy', (r) => this.normalizationService.normalizeSafeAttachmentPolicies(r).normalized),
      this.executeAndNormalize('Get-SafeAttachmentRule', (r) => this.normalizationService.normalizeSafeAttachmentRules(r).normalized),
      this.executeAndNormalize('Get-AcceptedDomain', (r) => this.normalizeAcceptedDomains(r)),
      this.executeAndNormalize('Get-InboundConnector', (r) => this.normalizationService.normalizeConnectors(r).normalized),
      this.executeAndNormalize('Get-OutboundConnector', (r) => this.normalizationService.normalizeConnectors(r).normalized),
      this.executeAndNormalize('Get-TransportRule', (r) => this.normalizationService.normalizeTransportRules(r).normalized),
      this.executeAndNormalize('Get-TransportConfig', (r) => this.normalizeTransportConfig(r)),
      this.executeAndNormalize('Get-EXOCASMailbox', (r) => this.normalizeSmtpAuthMailboxes(r)),
      this.executeAndNormalize('Get-EXOMailbox', (r) => this.normalizationService.normalizeMailboxes(r).normalized),
    ]);

    const smtpAuthDisabled = this.determineSmtpAuthDisabled(transportConfig, smtpAuthMailboxes);
    const popImapStatus = this.determinePopImapStatus(allMailboxes);

    const userMailboxes = allMailboxes.filter((m) => !m.isShared && !m.isResource);
    const sharedMailboxes = allMailboxes.filter((m) => m.isShared);
    const resourceMailboxes = allMailboxes.filter((m) => m.isResource);

    const result: EmailCollectionResult = {
      moduleName: 'Email',
      collectedAt,
      status: this.errors.length === 0 ? 'completed' : 'partial',
      data: {
        antiPhishing: { policies: antiPhishingPolicies, rules: antiPhishingRules },
        antiSpam: {
          inboundPolicies: inboundSpamPolicies,
          inboundRules: inboundSpamRules,
          outboundPolicies: outboundSpamPolicies,
          outboundRules: outboundSpamRules,
        },
        antiMalware: { policies: malwarePolicies, rules: malwareRules },
        safeLinks: { policies: safeLinksPolicies, rules: safeLinksRules },
        safeAttachments: { policies: safeAttachmentPolicies, rules: safeAttachmentRules },
        mailFlow: {
          acceptedDomains,
          inboundConnectors,
          outboundConnectors,
          transportRules,
          transportConfig: transportConfig[0] || null,
          smtpAuthDisabled,
          popImapStatus,
        },
        mailboxes: {
          all: allMailboxes,
          user: userMailboxes,
          shared: sharedMailboxes,
          resource: resourceMailboxes,
        },
        groups: {
          distribution: [],
          dynamicDistribution: [],
          microsoft365: [],
          mailEnabledSecurity: [],
        },
        security: {
          alerts: [],
          incidents: [],
          tenantAllowBlockList: [],
        },
        metrics: {
          totalMailboxes: allMailboxes.length,
          userMailboxes: userMailboxes.length,
          sharedMailboxes: sharedMailboxes.length,
          resourceMailboxes: resourceMailboxes.length,
          distributionGroups: 0,
          dynamicDistributionGroups: 0,
          m365Groups: 0,
          mailEnabledSecurityGroups: 0,
        },
      },
      errors: this.errors,
      raw: this.rawEvidence,
    };

    return result;
  }

  private normalizeAcceptedDomains(raw: any[]): any[] {
    return raw.map((d) => ({
      name: d.Name || d.name || '',
      type: d.DomainType || d.domainType || d.Type || d.type || 'Authoritative',
      isDefault: d.IsDefault || d.isDefault || false,
    }));
  }

  private normalizeTransportConfig(raw: any[]): any[] {
    return raw.map((c) => ({
      smtpClientAuthenticationDisabled: c.SmtpClientAuthenticationDisabled ?? c.smtpClientAuthenticationDisabled ?? false,
    }));
  }

  private normalizeSmtpAuthMailboxes(raw: any[]): any[] {
    return raw.map((m) => ({
      identity: m.Identity || m.identity || '',
      primarySmtpAddress: m.PrimarySmtpAddress || m.primarySmtpAddress || '',
      smtpAuthEnabled: m.SmtpAuthEnabled ?? m.smtpAuthEnabled ?? false,
    }));
  }

  private normalizeDynamicDistributionGroups(raw: any[]): any[] {
    return raw.map((g) => ({
      identity: g.Identity || g.identity || g.PrimarySmtpAddress || g.primarySmtpAddress || '',
      displayName: g.DisplayName || g.displayName,
      primarySmtpAddress: g.PrimarySmtpAddress || g.primarySmtpAddress,
      groupType: 'DynamicDistribution' as const,
      externalDirectoryObjectId: g.ExternalDirectoryObjectId || g.externalDirectoryObjectId,
      memberCount: g.MemberCount || g.memberCount || g.Members?.length || 0,
    }));
  }

  private normalizeUnifiedGroups(raw: any[]): any[] {
    return raw.map((g) => ({
      id: g.Id || g.id || '',
      displayName: g.DisplayName || g.displayName,
      mail: g.Mail || g.mail,
      mailEnabled: g.MailEnabled ?? g.mailEnabled ?? true,
      securityEnabled: g.SecurityEnabled ?? g.securityEnabled ?? false,
      groupTypes: g.GroupTypes || g.groupTypes || ['Unified'],
    }));
  }

  private normalizeTenantAllowBlockListItems(raw: any[]): any[] {
    return raw.map((item) => ({
      id: item.Id || item.id || uuidv4(),
      entryType: item.EntryType || item.entryType || 'Allow',
      senderIdentity: item.SenderIdentity || item.senderIdentity || item.Identity || item.identity || '',
      senderDomain: item.SenderDomain || item.senderDomain || '',
      action: item.Action || item.action || 'Allow',
    }));
  }

  private determineSmtpAuthDisabled(transportConfig: any[], mailboxes: any[]): boolean | null {
    if (transportConfig.length > 0 && transportConfig[0]?.smtpClientAuthenticationDisabled === true) {
      return true;
    }
    if (mailboxes.some((m) => m.smtpAuthEnabled === true)) {
      return false;
    }
    if (transportConfig.length > 0 && transportConfig[0]?.smtpClientAuthenticationDisabled === false) {
      return false;
    }
    return null;
  }

  private determinePopImapStatus(mailboxes: any[]): { popEnabled: boolean; imapEnabled: boolean }[] {
    return mailboxes.map((m) => ({
      popEnabled: m.popEnabled === true,
      imapEnabled: m.imapEnabled === true,
    }));
  }

  saveDataToFiles(assessmentId: string, result: EmailCollectionResult): void {
    const assessmentDir = path.join(DATA_DIR, assessmentId, 'Email');
    if (!fs.existsSync(assessmentDir)) {
      fs.mkdirSync(assessmentDir, { recursive: true });
    }

    fs.writeFileSync(path.join(assessmentDir, '_summary.json'), JSON.stringify({
      assessmentId,
      moduleName: 'Email',
      collectedAt: result.collectedAt,
      status: result.status,
      totalCommands: Object.keys(this.rawEvidence).length,
      successfulCommands: Object.values(this.rawEvidence).filter((r) => r.exitCode === 0).length,
      failedCommands: Object.values(this.rawEvidence).filter((r) => r.exitCode !== 0).length,
      errors: result.errors,
      metrics: result.data.metrics,
    }, null, 2));

    fs.writeFileSync(path.join(assessmentDir, '_errors.json'), JSON.stringify(result.errors, null, 2));

    fs.writeFileSync(path.join(assessmentDir, 'collection.json'), JSON.stringify(result.data, null, 2));
  }
}

export async function createEmailCollector(tenantConnectionId: string): Promise<EmailCollector | null> {
  const service = await getExchangeOnlineService(tenantConnectionId);
  if (!service) {
    return null;
  }
  return new EmailCollector(tenantConnectionId);
}
