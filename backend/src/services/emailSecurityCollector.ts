import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { getExchangeOnlineService } from './exchangeOnlineService';
import { getGraphClient, GraphErrorType } from './graphHttpClient';
import { getAccessTokenForTenant } from './msalAuth';
import { AuthenticationError } from '../types/m365';

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
  { id: 'tenant-allow-block-list-items', category: 'common-metrics', cmdlet: 'Get-TenantAllowBlockListItems', type: 'exo' },
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
  { id: 'tenant-allow-block-list-urls', category: 'common-metrics', cmdlet: 'Get-TenantAllowBlockListItems', type: 'exo', parameters: { ListType: 'Url' } },
  { id: 'tenant-allow-block-list-senders', category: 'common-metrics', cmdlet: 'Get-TenantAllowBlockListItems', type: 'exo', parameters: { ListType: 'Sender' } },
  { id: 'tenant-allow-block-list-domains', category: 'common-metrics', cmdlet: 'Get-TenantAllowBlockListItems', type: 'exo', parameters: { ListType: 'Domain' } },
  { id: 'tenant-allow-block-list-filehashes', category: 'common-metrics', cmdlet: 'Get-TenantAllowBlockListItems', type: 'exo', parameters: { ListType: 'FileHash' } },
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

  private async collect(endpoints: typeof QUICK_ENDPOINTS, assessmentType: 'quick' | 'detailed'): Promise<EmailSecurityCollectionResult> {
    const collectedAt = new Date().toISOString();
    const data: Record<string, any> = {};
    const errors: Array<{ endpoint: string; error: string; type: string }> = [];
    const rawResponses: EmailSecurityRawResponse[] = [];

    try {
      const exchange = await this.getExchangeService();
      await exchange.connect();

      for (const endpoint of endpoints) {
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
          data[endpoint.id] = result;
          rawResponses.push({
            endpoint: endpoint.id,
            timestamp: new Date().toISOString(),
            status: 'success',
            data: result,
            durationMs,
          });
        } catch (error: any) {
          const durationMs = Date.now() - startTime;
          const errorType = this.categorizeError(error);
          errors.push({ endpoint: endpoint.id, error: error.message, type: errorType });
          rawResponses.push({
            endpoint: endpoint.id,
            timestamp: new Date().toISOString(),
            status: 'error',
            error: error.message,
            durationMs,
          });
        }
      }
    } catch (error: any) {
      errors.push({ endpoint: 'connection', error: error.message, type: 'auth_error' });
    }

    const status = errors.length === 0 ? 'completed' : errors.some(e => e.type === 'auth_error') ? 'failed' : 'partial';

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

  private async collectGraphWithFilter(graphClient: any, endpoint: string): Promise<any> {
    const filters = [
      "status eq 'new'",
      "status eq 'active'",
      "status eq 'inProgress'",
      "status eq 'resolved'",
    ];

    const results: any[] = [];
    for (const filter of filters) {
      try {
        const data = await graphClient.get(`${endpoint}?$filter=${filter}`);
        if (data && data.value) {
          results.push(...data.value);
        }
      } catch (error) {
        console.warn(`Graph filter ${filter} failed:`, error);
      }
    }
    return results;
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

    const summaryPath = path.join(baseDir, '_summary.json');
    const summary = {
      assessmentId,
      assessmentType: result.assessmentType,
      collectedAt: result.collectedAt,
      status: result.status,
      metrics: result.metrics,
      errors: result.errors,
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
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
      'tenant-allow-block-list-domains': 'common-metrics',
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
