import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { getExchangeOnlineService } from './exchangeOnlineService';
import { getGraphClient, GraphErrorType } from './graphHttpClient';
import { getAccessTokenForTenant } from './msalAuth';
import { AuthenticationError } from '../types/m365';
import { evaluateEmailSecurityControl, EMAIL_SECURITY_CONTROLS } from './emailSecurityEvaluator';

export interface EmailSecurityRawResponse {
  endpoint: string;
  timestamp: string;
  status: 'success' | 'error';
  data?: any;
  error?: string;
  durationMs?: number;
}

export interface EmailSecurityCollectionResult {
  assessmentType: 'quick' | 'detailed';
  collectedAt: string;
  status: 'completed' | 'partial' | 'failed';
  data: Record<string, any>;
  errors: Array<{ endpoint: string; error: string; type: string }>;
  rawResponses: EmailSecurityRawResponse[];
  metrics: {
    totalEndpoints: number;
    successfulEndpoints: number;
    failedEndpoints: number;
    controlsPass: number;
    controlsFail: number;
    controlsInfo: number;
    controlsError: number;
  };
}

const QUICK_ENDPOINTS = [
  { id: 'anti-phish-policy', category: 'anti-phishing', cmdlet: 'Get-AntiPhishPolicy', type: 'exo' },
  { id: 'anti-phish-rule', category: 'anti-phishing', cmdlet: 'Get-AntiPhishRule', type: 'exo' },
  { id: 'hosted-content-filter-policy', category: 'anti-spam', cmdlet: 'Get-HostedContentFilterPolicy', type: 'exo' },
  { id: 'hosted-content-filter-rule', category: 'anti-spam', cmdlet: 'Get-HostedContentFilterRule', type: 'exo' },
  { id: 'hosted-outbound-spam-filter-policy', category: 'anti-spam', cmdlet: 'Get-HostedOutboundSpamFilterPolicy', type: 'exo' },
  { id: 'hosted-outbound-spam-filter-rule', category: 'anti-spam', cmdlet: 'Get-HostedOutboundSpamFilterRule', type: 'exo' },
  { id: 'malware-filter-policy', category: 'anti-malware', cmdlet: 'Get-MalwareFilterPolicy', type: 'exo' },
  { id: 'malware-filter-rule', category: 'anti-malware', cmdlet: 'Get-MalwareFilterRule', type: 'exo' },
  { id: 'safe-links-policy', category: 'safe-links', cmdlet: 'Get-SafeLinksPolicy', type: 'exo' },
  { id: 'safe-links-rule', category: 'safe-links', cmdlet: 'Get-SafeLinksRule', type: 'exo' },
  { id: 'safe-attachment-policy', category: 'safe-attachments', cmdlet: 'Get-SafeAttachmentPolicy', type: 'exo' },
  { id: 'safe-attachment-rule', category: 'safe-attachments', cmdlet: 'Get-SafeAttachmentRule', type: 'exo' },
  { id: 'accepted-domain', category: 'permissions-rbac', cmdlet: 'Get-AcceptedDomain', type: 'exo' },
  { id: 'transport-config', category: 'smtp-auth', cmdlet: 'Get-TransportConfig', type: 'exo' },
  { id: 'exo-cas-mailbox', category: 'pop-imap', cmdlet: 'Get-EXOCASMailbox', type: 'exo' },
  { id: 'inbound-connector', category: 'connectors', cmdlet: 'Get-InboundConnector', type: 'exo' },
  { id: 'outbound-connector', category: 'connectors', cmdlet: 'Get-OutboundConnector', type: 'exo' },
  { id: 'transport-rule', category: 'transport-rules', cmdlet: 'Get-TransportRule', type: 'exo' },
  { id: 'exo-mailbox', category: 'common-metrics', cmdlet: 'Get-EXOMailbox', type: 'exo' },
  { id: 'tenant-allow-block-list-urls', category: 'common-metrics', cmdlet: 'Get-TenantAllowBlockListItems', type: 'exo', parameters: { ListType: 'Url' } },
  { id: 'tenant-allow-block-list-senders', category: 'common-metrics', cmdlet: 'Get-TenantAllowBlockListItems', type: 'exo', parameters: { ListType: 'Sender' } },
  { id: 'tenant-allow-block-list-filehashes', category: 'common-metrics', cmdlet: 'Get-TenantAllowBlockListItems', type: 'exo', parameters: { ListType: 'FileHash' } },
  { id: 'graph-users', category: 'permissions-rbac', endpoint: '/users', type: 'graph' },
  { id: 'graph-directory-roles', category: 'permissions-rbac', endpoint: '/directoryRoles', type: 'graph' },
  { id: 'graph-security-alerts', category: 'common-metrics', endpoint: '/security/alerts_v2', type: 'graph' },
  { id: 'graph-security-incidents', category: 'common-metrics', endpoint: '/security/incidents', type: 'graph' },
];

const DETAILED_ENDPOINTS = [
  ...QUICK_ENDPOINTS,
  { id: 'distribution-group', category: 'common-metrics', cmdlet: 'Get-DistributionGroup', type: 'exo' },
  { id: 'dynamic-distribution-group', category: 'common-metrics', cmdlet: 'Get-DynamicDistributionGroup', type: 'exo' },
  { id: 'unified-group', category: 'common-metrics', cmdlet: 'Get-UnifiedGroup', type: 'exo' },
  { id: 'graph-security-alerts-by-status', category: 'common-metrics', endpoint: '/security/alerts_v2', type: 'graph', filter: true },
  { id: 'graph-security-incidents-by-status', category: 'common-metrics', endpoint: '/security/incidents', type: 'graph', filter: true },
];

export class EmailSecurityCollector {
  private tenantConnectionId: string;
  private exchangeService: any = null;
  private graphClient: any = null;

  constructor(tenantConnectionId: string) {
    this.tenantConnectionId = tenantConnectionId;
  }

  private async getExchangeService(): Promise<any> {
    if (this.exchangeService) return this.exchangeService;
    this.exchangeService = await getExchangeOnlineService(this.tenantConnectionId);
    if (!this.exchangeService) {
      throw new AuthenticationError('AUTHENTICATION_ERROR', 'Exchange Online service not available for tenant connection', true);
    }
    return this.exchangeService;
  }

  private async getGraphClient(): Promise<any> {
    if (this.graphClient) return this.graphClient;
    this.graphClient = await getGraphClient(this.tenantConnectionId);
    if (!this.graphClient) {
      throw new AuthenticationError('AUTHENTICATION_ERROR', 'Graph client not available for tenant connection', true);
    }
    return this.graphClient;
  }

  async collectQuick(): Promise<EmailSecurityCollectionResult> {
    return this.collect(QUICK_ENDPOINTS, 'quick');
  }

  async collectDetailed(): Promise<EmailSecurityCollectionResult> {
    return this.collect(DETAILED_ENDPOINTS, 'detailed');
  }

  async disconnect(): Promise<void> {
    if (this.exchangeService) {
      try {
        await this.exchangeService.disconnect();
      } catch {
        // ignore
      }
      this.exchangeService = null;
    }
  }

  private async collect(endpoints: typeof QUICK_ENDPOINTS, assessmentType: 'quick' | 'detailed'): Promise<EmailSecurityCollectionResult> {
    const collectedAt = new Date().toISOString();
    const data: Record<string, any> = {};
    const errors: Array<{ endpoint: string; error: string; type: string }> = [];
    const rawResponses: EmailSecurityRawResponse[] = [];

    try {
      const exchange = await this.getExchangeService();
      await exchange.connect();

      const CONCURRENCY = 5;
      const batches: typeof QUICK_ENDPOINTS[] = [];
      for (let i = 0; i < endpoints.length; i += CONCURRENCY) {
        batches.push(endpoints.slice(i, i + CONCURRENCY));
      }

      for (const batch of batches) {
        const results = await Promise.all(
          batch.map(async (endpoint) => {
            const startTime = Date.now();
            try {
              let result: any;
              if (endpoint.type === 'exo') {
                result = await exchange.executeCommand(endpoint.cmdlet, (endpoint as any).parameters || {});
              } else if (endpoint.type === 'graph') {
                const graph = await this.getGraphClient();
                const endpointUrl = endpoint.endpoint || '';
                if ((endpoint as any).filter) {
                  result = await this.collectGraphWithFilter(graph, endpointUrl);
                } else {
                  result = await graph.get(endpointUrl);
                }
              } else {
                throw new Error(`Unknown endpoint type: ${(endpoint as any).type}`);
              }

              const durationMs = Date.now() - startTime;
              return { endpoint: endpoint.id, status: 'success' as const, result, durationMs, error: undefined, errorType: undefined };
            } catch (error: any) {
              const durationMs = Date.now() - startTime;
              return {
                endpoint: endpoint.id,
                status: 'error' as const,
                result: undefined,
                durationMs,
                error: error.message,
                errorType: this.categorizeError(error),
              };
            }
          })
        );

        for (const r of results) {
          if (r.status === 'success') {
            data[r.endpoint] = r.result;
            rawResponses.push({
              endpoint: r.endpoint,
              timestamp: new Date().toISOString(),
              status: 'success',
              data: r.result,
              durationMs: r.durationMs,
            });
          } else {
            errors.push({ endpoint: r.endpoint, error: r.error!, type: r.errorType! });
            rawResponses.push({
              endpoint: r.endpoint,
              timestamp: new Date().toISOString(),
              status: 'error',
              error: r.error,
              durationMs: r.durationMs,
            });
          }
        }
      }
    } catch (error: any) {
      errors.push({ endpoint: 'connection', error: error.message, type: 'auth_error' });
    }

    const status = errors.length === 0 ? 'completed' : errors.some(e => e.type === 'auth_error') ? 'failed' : 'partial';

    const merged = this.buildMergedTenantAllowBlockList(data, rawResponses);
    if (merged) {
      data['tenant-allow-block-list-items'] = merged.items;
      rawResponses.push(merged.response);
    }

    return {
      assessmentType,
      collectedAt,
      status,
      data,
      errors,
      rawResponses,
      metrics: {
        totalEndpoints: endpoints.length,
        successfulEndpoints: rawResponses.filter(r => r.status === 'success').length,
        failedEndpoints: errors.length,
        controlsPass: 0,
        controlsFail: 0,
        controlsInfo: 0,
        controlsError: 0,
      },
    };
  }

  private buildMergedTenantAllowBlockList(
    data: Record<string, any>,
    rawResponses: EmailSecurityRawResponse[]
  ): { items: any[]; response: EmailSecurityRawResponse } | null {
    const urls = data['tenant-allow-block-list-urls'];
    const senders = data['tenant-allow-block-list-senders'];
    const fileHashes = data['tenant-allow-block-list-filehashes'];

    const anyPresent =
      urls !== undefined || senders !== undefined || fileHashes !== undefined;
    if (!anyPresent) return null;

    const merged: any[] = [];
    const tag = (items: any[] | undefined, listType: string) => {
      if (!Array.isArray(items)) return;
      for (const it of items) merged.push({ ...it, ListType: it?.ListType || listType });
    };
    tag(urls, 'Url');
    tag(senders, 'Sender');
    tag(fileHashes, 'FileHash');

    const sourceEndpoints = rawResponses
      .filter((r) => r.status === 'success' && r.endpoint.startsWith('tenant-allow-block-list-') && r.endpoint !== 'tenant-allow-block-list-items')
      .map((r) => r.endpoint);

    return {
      items: merged,
      response: {
        endpoint: 'tenant-allow-block-list-items',
        timestamp: new Date().toISOString(),
        status: 'success',
        data: merged,
        durationMs: 0,
      },
    };
  }

  private async collectGraphWithFilter(graphClient: any, endpoint: string): Promise<any> {
    const filters = [
      "status eq 'new'",
      "status eq 'active'",
      "status eq 'inProgress'",
      "status eq 'resolved'",
    ];

    const results = await Promise.all(
      filters.map((filter) =>
        graphClient.get(`${endpoint}?$filter=${filter}`).then((data: any) => data?.value || []).catch(() => [])
      )
    );

    return results.flat();
  }

  private categorizeError(error: any): string {
    if (error instanceof AuthenticationError) {
      return error.type === 'AUTHENTICATION_ERROR' ? 'auth_error' :
             error.type === 'AUTHORIZATION_ERROR' ? 'permission_denied' : 'command_error';
    }
    const message = error?.message?.toLowerCase() || '';
    if (message.includes('permission') || message.includes('authorization') || message.includes('403')) {
      return 'permission_denied';
    }
    if (message.includes('auth') || message.includes('token') || message.includes('401')) {
      return 'auth_error';
    }
    return 'command_error';
  }

  private getAllCategoryFolders(): string[] {
    return [
      'anti-malware',
      'anti-phishing',
      'anti-spam',
      'common-metrics',
      'connectors',
      'permissions-rbac',
      'pop-imap',
      'safe-attachments',
      'safe-links',
      'smtp-auth',
      'transport-rules',
    ];
  }

  saveDataToFiles(assessmentId: string, result: EmailSecurityCollectionResult): void {
    const baseDir = path.join(__dirname, '..', '..', 'assessment-data', assessmentId, 'email-security');

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    for (const response of result.rawResponses) {
      const category = this.getCategoryForEndpoint(response.endpoint);
      const categoryDir = path.join(baseDir, category);
      if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
      }

      const filename = `${response.endpoint}.json`;
      const filepath = path.join(categoryDir, filename);
      const content = {
        endpoint: response.endpoint,
        timestamp: response.timestamp,
        status: response.status,
        data: response.status === 'success' ? response.data : undefined,
        error: response.status === 'error' ? response.error : undefined,
        durationMs: response.durationMs,
      };
      fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
    }

    if (result.status === 'failed' || result.rawResponses.length === 0) {
      for (const category of this.getAllCategoryFolders()) {
        const categoryDir = path.join(baseDir, category);
        if (!fs.existsSync(categoryDir)) {
          fs.mkdirSync(categoryDir, { recursive: true });
        }
        const errorFile = path.join(categoryDir, '_errors.json');
        fs.writeFileSync(
          errorFile,
          JSON.stringify(
            {
              status: 'failed',
              reason: result.status === 'failed'
                ? 'Assessment failed before any endpoint data could be collected.'
                : 'No raw responses were collected for this assessment.',
              errors: result.errors,
              collectedAt: result.collectedAt,
            },
            null,
            2,
          ),
        );
      }

      const topErrorFile = path.join(baseDir, '_errors.json');
      fs.writeFileSync(
        topErrorFile,
        JSON.stringify(
          {
            status: 'failed',
            reason: result.errors[0]?.error
              ?? 'Assessment failed before any endpoint data could be collected.',
            errors: result.errors,
            collectedAt: result.collectedAt,
          },
          null,
          2,
        ),
      );
    }

    const summaryPath = path.join(baseDir, '_summary.json');
    const controlsSection = this.buildControlsSummary(result);
    const summary = {
      assessmentId,
      assessmentType: result.assessmentType,
      collectedAt: result.collectedAt,
      status: result.status,
      metrics: {
        ...result.metrics,
        controlsEvaluated: controlsSection.summary.evaluated,
        controlsInScope: controlsSection.summary.inScope,
        controlsSkipped: controlsSection.summary.skipped,
      },
      errors: result.errors,
      collectedEndpoints: result.rawResponses.map((r) => ({
        endpoint: r.endpoint,
        status: r.status,
        durationMs: r.durationMs,
        recordCount: Array.isArray(r.data)
          ? r.data.length
          : r.data && typeof r.data === 'object'
            ? Object.keys(r.data).length
            : r.data != null
              ? 1
              : 0,
      })),
      controls: controlsSection.controls,
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  }

  private buildControlsSummary(result: EmailSecurityCollectionResult): {
    controls: any[];
    summary: { evaluated: number; inScope: number; skipped: number };
  } {
    const collectedEndpoints = new Set(result.rawResponses.map((r) => r.endpoint));
    const successfulEndpointData: Record<string, any> = {};
    for (const r of result.rawResponses) {
      if (r.status === 'success') {
        successfulEndpointData[r.endpoint] = r.data;
      }
    }

    const controls: any[] = [];
    let evaluated = 0;
    let inScope = 0;
    let skipped = 0;

    for (const ctl of EMAIL_SECURITY_CONTROLS) {
      const inAssessmentScope =
        ctl.scope === 'both' ||
        (ctl.scope === 'quick' && result.assessmentType === 'quick') ||
        (ctl.scope === 'detailed' && result.assessmentType === 'detailed');

      if (!inAssessmentScope) {
        skipped++;
        controls.push({
          id: ctl.id,
          area: ctl.area,
          title: ctl.title,
          controlType: ctl.controlType,
          scope: ctl.scope,
          validationRule: ctl.validationRule,
          inScope: false,
          skipReason: `Control scope '${ctl.scope}' not applicable to '${result.assessmentType}' assessment`,
          collectedData: null,
          evaluation: null,
        });
        continue;
      }

      inScope++;
      const collectedData = this.extractCollectedDataForControl(ctl, successfulEndpointData);
      const requiredEndpoints = this.getRequiredEndpointsForControl(ctl);
      const missingEndpoints = requiredEndpoints.filter((ep) => !collectedEndpoints.has(ep));

      let evaluation: any;
      try {
        evaluation = ctl.evaluate(result.data, result.rawResponses as any);
      } catch (error: any) {
        evaluation = {
          result: 'error',
          evidence: `Evaluation failed: ${error.message}`,
          recommendation: 'Review raw data for this control',
          error: { type: 'evaluation_error', message: error.message },
        };
      }

      evaluated++;
      controls.push({
        id: ctl.id,
        area: ctl.area,
        title: ctl.title,
        controlType: ctl.controlType,
        scope: ctl.scope,
        validationRule: ctl.validationRule,
        inScope: true,
        requiredEndpoints,
        missingEndpoints,
        collectedData,
        evaluation,
      });
    }

    return {
      controls,
      summary: { evaluated, inScope, skipped },
    };
  }

  private getRequiredEndpointsForControl(ctl: { id: string; area: string; title: string }): string[] {
    const endpointMap: Record<string, string[]> = {
      'email-ap-01': ['anti-phish-policy'],
      'email-ap-02': ['anti-phish-policy', 'anti-phish-rule'],
      'email-ap-03': ['anti-phish-policy'],
      'email-ap-04': ['anti-phish-policy'],
      'email-ap-05': ['anti-phish-policy'],
      'email-ap-06': ['anti-phish-policy'],
      'email-ap-07': ['anti-phish-policy'],
      'email-ap-08': ['anti-phish-policy', 'anti-phish-rule'],
      'email-ap-09': ['anti-phish-policy', 'anti-phish-rule'],
      'email-ap-10': ['anti-phish-policy', 'anti-phish-rule'],
      'email-as-in-01': ['hosted-content-filter-policy'],
      'email-as-in-02': ['hosted-content-filter-policy'],
      'email-as-in-03': ['hosted-content-filter-policy', 'hosted-content-filter-rule'],
      'email-as-in-04': ['hosted-content-filter-policy'],
      'email-as-in-05': ['hosted-content-filter-policy'],
      'email-as-in-06': ['hosted-content-filter-policy', 'hosted-content-filter-rule'],
      'email-as-in-07': ['hosted-content-filter-policy'],
      'email-as-in-08': ['hosted-content-filter-policy'],
      'email-as-in-09': ['hosted-content-filter-policy', 'hosted-content-filter-rule'],
      'email-as-in-10': ['hosted-content-filter-policy'],
      'email-as-in-11': ['hosted-content-filter-policy'],
      'email-as-in-12': ['hosted-content-filter-policy', 'hosted-content-filter-rule'],
      'email-as-in-13': ['hosted-content-filter-policy'],
      'email-as-in-14': ['hosted-content-filter-policy'],
      'email-as-in-15': ['hosted-content-filter-policy'],
      'email-as-in-16': ['hosted-content-filter-policy'],
      'email-as-in-17': ['hosted-content-filter-policy'],
      'email-as-in-18': ['hosted-content-filter-policy'],
      'email-as-in-19': ['hosted-content-filter-policy', 'hosted-content-filter-rule'],
      'email-as-out-01': ['hosted-outbound-spam-filter-policy'],
      'email-as-out-02': ['hosted-outbound-spam-filter-policy', 'hosted-outbound-spam-filter-rule'],
      'email-am-01': ['malware-filter-policy'],
      'email-am-02': ['malware-filter-policy', 'malware-filter-rule'],
      'email-am-03': ['malware-filter-policy'],
      'email-am-04': ['malware-filter-policy'],
      'email-am-05': ['malware-filter-policy', 'malware-filter-rule'],
      'email-sl-01': ['safe-links-policy'],
      'email-sl-02': ['safe-links-policy'],
      'email-sl-03': ['safe-links-policy', 'safe-links-rule'],
      'email-sl-04': ['safe-links-policy'],
      'email-sl-05': ['safe-links-policy'],
      'email-sl-06': ['safe-links-policy', 'safe-links-rule'],
      'email-sl-07': ['safe-links-policy'],
      'email-sl-08': ['safe-links-policy'],
      'email-sa-01': ['safe-attachment-policy'],
      'email-sa-02': ['safe-attachment-policy', 'safe-attachment-rule'],
      'email-sa-03': ['safe-attachment-policy'],
      'email-rbac-01': ['graph-users', 'graph-directory-roles'],
      'email-rbac-02': ['accepted-domain', 'graph-users'],
      'email-smtp-01': ['transport-config'],
      'email-pop-01': ['exo-cas-mailbox'],
      'email-conn-01': ['inbound-connector'],
      'email-conn-02': ['outbound-connector'],
      'email-conn-03': ['inbound-connector'],
      'email-conn-04': ['outbound-connector'],
      'email-conn-05': ['inbound-connector', 'outbound-connector'],
      'email-tr-01': ['transport-rule'],
      'email-tr-02': ['transport-rule'],
      'email-tr-03': ['transport-rule'],
      'email-tr-04': ['transport-rule'],
      'email-cm-01': ['exo-mailbox'],
      'email-cm-02': ['exo-mailbox'],
      'email-cm-03': ['exo-mailbox'],
      'email-cm-04': ['exo-mailbox'],
      'email-cm-05': ['tenant-allow-block-list-urls', 'tenant-allow-block-list-senders', 'tenant-allow-block-list-filehashes'],
      'email-cm-06': ['tenant-allow-block-list-urls', 'tenant-allow-block-list-senders', 'tenant-allow-block-list-filehashes'],
      'email-cm-07': ['graph-security-alerts'],
      'email-cm-08': ['graph-security-incidents'],
      'email-cm-09': ['graph-security-alerts', 'graph-security-incidents'],
      'email-cm-10': ['distribution-group', 'dynamic-distribution-group', 'unified-group'],
      'email-cm-11': ['exo-mailbox'],
      'email-cm-12': ['graph-users'],
      'email-cm-13': ['tenant-allow-block-list-urls', 'tenant-allow-block-list-senders', 'tenant-allow-block-list-filehashes'],
      'email-cm-14': ['tenant-allow-block-list-urls', 'tenant-allow-block-list-senders', 'tenant-allow-block-list-filehashes'],
      'email-cm-15': ['tenant-allow-block-list-senders'],
      'email-cm-17': ['tenant-allow-block-list-filehashes'],
    };
    return endpointMap[ctl.id] || [];
  }

  private extractCollectedDataForControl(
    ctl: { id: string; area: string; title: string },
    successfulEndpointData: Record<string, any>
  ): Record<string, any> {
    const endpoints = this.getRequiredEndpointsForControl(ctl);
    const slice: Record<string, any> = {};
    for (const ep of endpoints) {
      if (ep in successfulEndpointData) {
        slice[ep] = successfulEndpointData[ep];
      }
    }
    return slice;
  }

  private getCategoryForEndpoint(endpointId: string): string {
    const categoryMap: Record<string, string> = {
      'anti-phish-policy': 'anti-phishing',
      'anti-phish-rule': 'anti-phishing',
      'hosted-content-filter-policy': 'anti-spam',
      'hosted-content-filter-rule': 'anti-spam',
      'hosted-outbound-spam-filter-policy': 'anti-spam',
      'hosted-outbound-spam-filter-rule': 'anti-spam',
      'malware-filter-policy': 'anti-malware',
      'malware-filter-rule': 'anti-malware',
      'safe-links-policy': 'safe-links',
      'safe-links-rule': 'safe-links',
      'safe-attachment-policy': 'safe-attachments',
      'safe-attachment-rule': 'safe-attachments',
      'accepted-domain': 'permissions-rbac',
      'transport-config': 'smtp-auth',
      'exo-cas-mailbox': 'pop-imap',
      'inbound-connector': 'connectors',
      'outbound-connector': 'connectors',
      'transport-rule': 'transport-rules',
      'exo-mailbox': 'common-metrics',
      'distribution-group': 'common-metrics',
      'dynamic-distribution-group': 'common-metrics',
      'unified-group': 'common-metrics',
      'tenant-allow-block-list-items': 'common-metrics',
      'tenant-allow-block-list-urls': 'common-metrics',
      'tenant-allow-block-list-senders': 'common-metrics',
      'tenant-allow-block-list-filehashes': 'common-metrics',
      'graph-users': 'permissions-rbac',
      'graph-directory-roles': 'permissions-rbac',
      'graph-security-alerts': 'common-metrics',
      'graph-security-incidents': 'common-metrics',
      'graph-security-alerts-by-status': 'common-metrics',
      'graph-security-incidents-by-status': 'common-metrics',
    };
    return categoryMap[endpointId] || 'common-metrics';
  }
}

export async function createEmailSecurityCollector(tenantConnectionId: string): Promise<EmailSecurityCollector | null> {
  try {
    const accessToken = await getAccessTokenForTenant(tenantConnectionId);
    if (!accessToken) {
      return null;
    }
    return new EmailSecurityCollector(tenantConnectionId);
  } catch (error: any) {
    if (error instanceof AuthenticationError) {
      console.error(`Email security authentication failed for ${tenantConnectionId}: ${error.message}`);
    } else {
      console.error(`Failed to create Email security collector for ${tenantConnectionId}:`, error);
    }
    return null;
  }
}
