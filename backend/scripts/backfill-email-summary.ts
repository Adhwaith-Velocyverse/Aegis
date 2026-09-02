import fs from 'fs';
import path from 'path';
import { EMAIL_SECURITY_CONTROLS } from '../src/services/emailSecurityControlDefinitions';

interface RawResponse {
  endpoint: string;
  timestamp: string;
  status: 'success' | 'error';
  data?: any;
  error?: string;
  durationMs?: number;
}

const REQUIRED_ENDPOINTS_BY_CONTROL: Record<string, string[]> = {
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

const FLAT_TO_NESTED: Array<{ flat: string; nested: string }> = [
  { flat: 'anti-phish-policy', nested: 'antiPhishing.policies' },
  { flat: 'anti-phish-rule', nested: 'antiPhishing.rules' },
  { flat: 'hosted-content-filter-policy', nested: 'antiSpam.inboundPolicies' },
  { flat: 'hosted-content-filter-rule', nested: 'antiSpam.inboundRules' },
  { flat: 'hosted-outbound-spam-filter-policy', nested: 'antiSpam.outboundPolicies' },
  { flat: 'hosted-outbound-spam-filter-rule', nested: 'antiSpam.outboundRules' },
  { flat: 'malware-filter-policy', nested: 'antiMalware.policies' },
  { flat: 'malware-filter-rule', nested: 'antiMalware.rules' },
  { flat: 'safe-links-policy', nested: 'safeLinks.policies' },
  { flat: 'safe-links-rule', nested: 'safeLinks.rules' },
  { flat: 'safe-attachment-policy', nested: 'safeAttachments.policies' },
  { flat: 'safe-attachment-rule', nested: 'safeAttachments.rules' },
  { flat: 'accepted-domain', nested: 'mailFlow.acceptedDomains' },
  { flat: 'transport-config', nested: 'mailFlow.transportConfig' },
  { flat: 'exo-cas-mailbox', nested: 'mailFlow.popImapStatus' },
  { flat: 'inbound-connector', nested: 'mailFlow.inboundConnectors' },
  { flat: 'outbound-connector', nested: 'mailFlow.outboundConnectors' },
  { flat: 'transport-rule', nested: 'mailFlow.transportRules' },
  { flat: 'exo-mailbox', nested: 'mailboxes.all' },
  { flat: 'tenant-allow-block-list-items', nested: 'security.tenantAllowBlockList' },
  { flat: 'graph-users', nested: 'users' },
  { flat: 'graph-directory-roles', nested: 'directoryRoles' },
  { flat: 'graph-security-alerts', nested: 'security.alerts' },
  { flat: 'graph-security-incidents', nested: 'security.incidents' },
];

function setNested(obj: any, dotted: string, value: any) {
  const parts = dotted.split('.');
  let cur: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function normalizeForEvaluator(raw: Record<string, any>): Record<string, any> {
  const flat: Record<string, any> = { ...raw };
  for (const m of FLAT_TO_NESTED) {
    if (flat[m.flat] == null) {
      const parts = m.nested.split('.');
      let cur: any = flat;
      for (const p of parts) {
        if (cur == null) break;
        cur = cur[p];
      }
      if (cur != null) flat[m.flat] = cur;
    }
  }
  return flat;
}

function getCategoryForEndpoint(endpointId: string): string {
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

function rebuildSummary(baseDir: string, assessmentId: string): boolean {
  if (!fs.existsSync(baseDir)) return false;
  const rawResponses: RawResponse[] = [];
  const flatData: Record<string, any> = {};
  const successfulEndpointData: Record<string, any> = {};

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.json') || entry.name === '_summary.json') continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(full, 'utf-8'));
        if (parsed && typeof parsed === 'object' && parsed.endpoint) {
          rawResponses.push(parsed);
          const ep = parsed.endpoint as string;
          if (parsed.status === 'success' && parsed.data !== undefined) {
            flatData[ep] = parsed.data;
            successfulEndpointData[ep] = parsed.data;
          }
        }
      } catch {
      }
    }
  };
  walk(baseDir);

  if (rawResponses.length === 0) return false;

  const assessmentType: 'quick' | 'detailed' = (() => {
    const hasDetailedOnly = rawResponses.some((r) =>
      ['distribution-group', 'dynamic-distribution-group', 'unified-group',
        'graph-security-alerts-by-status', 'graph-security-incidents-by-status'
      ].includes(r.endpoint)
    );
    return hasDetailedOnly ? 'detailed' : 'quick';
  })();

  const nestedData: Record<string, any> = {};
  for (const m of FLAT_TO_NESTED) {
    if (flatData[m.flat] !== undefined) setNested(nestedData, m.nested, flatData[m.flat]);
  }

  const mergedTABL: any[] = [];
  const tag = (items: any[] | undefined, listType: string) => {
    if (!Array.isArray(items)) return;
    for (const it of items) mergedTABL.push({ ...it, ListType: it?.ListType || listType });
  };
  tag(flatData['tenant-allow-block-list-urls'], 'Url');
  tag(flatData['tenant-allow-block-list-senders'], 'Sender');
  tag(flatData['tenant-allow-block-list-filehashes'], 'FileHash');
  if (mergedTABL.length > 0) {
    flatData['tenant-allow-block-list-items'] = mergedTABL;
  }

  const controls: any[] = [];
  let evaluated = 0, inScope = 0, skipped = 0;
  const collectedEndpoints = new Set(rawResponses.map((r) => r.endpoint));

  for (const ctl of EMAIL_SECURITY_CONTROLS) {
    const isInScope =
      ctl.scope === 'both' ||
      (ctl.scope === 'quick' && assessmentType === 'quick') ||
      (ctl.scope === 'detailed' && assessmentType === 'detailed');

    if (!isInScope) {
      skipped++;
      controls.push({
        id: ctl.id, area: ctl.area, title: ctl.title,
        controlType: ctl.controlType, scope: ctl.scope,
        validationRule: ctl.validationRule, inScope: false,
        skipReason: `Control scope '${ctl.scope}' not applicable to '${assessmentType}' assessment`,
        collectedData: null, evaluation: null,
      });
      continue;
    }

    inScope++;
    const required = REQUIRED_ENDPOINTS_BY_CONTROL[ctl.id] || [];
    const missing = required.filter((ep) => !collectedEndpoints.has(ep));
    const collectedData: Record<string, any> = {};
    for (const ep of required) {
      if (successfulEndpointData[ep] !== undefined) collectedData[ep] = successfulEndpointData[ep];
    }

    const normalized = normalizeForEvaluator(flatData);
    let evaluation: any;
    try {
      evaluation = ctl.evaluate(normalized, rawResponses as any);
    } catch (err: any) {
      evaluation = {
        result: 'error',
        evidence: `Evaluation failed: ${err.message}`,
        recommendation: 'Review raw data for this control',
        error: { type: 'evaluation_error', message: err.message },
      };
    }
    evaluated++;
    controls.push({
      id: ctl.id, area: ctl.area, title: ctl.title,
      controlType: ctl.controlType, scope: ctl.scope,
      validationRule: ctl.validationRule, inScope: true,
      requiredEndpoints: required, missingEndpoints: missing,
      collectedData, evaluation,
    });
  }

  const successful = rawResponses.filter((r) => r.status === 'success').length;
  const failed = rawResponses.length - successful;
  const collectedAt = rawResponses
    .map((r) => r.timestamp)
    .filter(Boolean)
    .sort()
    .pop() || new Date().toISOString();

  const errors = rawResponses
    .filter((r) => r.status === 'error')
    .map((r) => ({ endpoint: r.endpoint, error: r.error || 'unknown', type: 'command_error' }));

  const summary = {
    assessmentId,
    assessmentType,
    collectedAt,
    status: failed === 0 ? 'completed' : successful === 0 ? 'failed' : 'partial',
    metrics: {
      totalEndpoints: rawResponses.length,
      successfulEndpoints: successful,
      failedEndpoints: failed,
      controlsPass: controls.filter((c) => c.evaluation?.result === 'pass').length,
      controlsFail: controls.filter((c) => c.evaluation?.result === 'fail').length,
      controlsInfo: controls.filter((c) => c.evaluation?.result === 'info').length,
      controlsError: controls.filter((c) => c.evaluation?.result === 'error').length,
      controlsEvaluated: evaluated,
      controlsInScope: inScope,
      controlsSkipped: skipped,
    },
    errors,
    collectedEndpoints: rawResponses.map((r) => ({
      endpoint: r.endpoint,
      status: r.status,
      durationMs: r.durationMs,
      recordCount: Array.isArray(r.data)
        ? r.data.length
        : r.data && typeof r.data === 'object'
          ? Object.keys(r.data).length
          : r.data != null ? 1 : 0,
    })),
    controls,
  };

  fs.writeFileSync(path.join(baseDir, '_summary.json'), JSON.stringify(summary, null, 2));
  return true;
}

function main() {
  const root = path.join(__dirname, '..', 'assessment-data');
  if (!fs.existsSync(root)) {
    console.log('No assessment-data folder at', root);
    return;
  }
  const assessments = fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let rebuilt = 0, skipped = 0, failed = 0;
  for (const id of assessments) {
    const emailDir = path.join(root, id, 'email-security');
    if (!fs.existsSync(emailDir)) { skipped++; continue; }
    try {
      if (rebuildSummary(emailDir, id)) rebuilt++;
      else { skipped++; }
    } catch (err: any) {
      console.error(`Failed for ${id}:`, err.message);
      failed++;
    }
  }
  console.log(`Rebuilt: ${rebuilt}, Skipped: ${skipped}, Failed: ${failed}, Total: ${assessments.length}`);
}

main();
