import { EmailControlDefinition, EmailControlEvaluationResult, EMAIL_SECURITY_CONTROLS } from './emailSecurityControlDefinitions';

export { EmailControlEvaluationResult, EmailControlDefinition, EMAIL_SECURITY_CONTROLS };

function normalizeEmailSecurityData(data: Record<string, any>): Record<string, any> {
  const flat: Record<string, any> = { ...data };

  if (!flat['anti-phish-policy'] && data?.antiPhishing?.policies) {
    flat['anti-phish-policy'] = data.antiPhishing.policies;
  }
  if (!flat['anti-phish-rule'] && data?.antiPhishing?.rules) {
    flat['anti-phish-rule'] = data.antiPhishing.rules;
  }
  if (!flat['hosted-content-filter-policy'] && data?.antiSpam?.inboundPolicies) {
    flat['hosted-content-filter-policy'] = data.antiSpam.inboundPolicies;
  }
  if (!flat['hosted-content-filter-rule'] && data?.antiSpam?.inboundRules) {
    flat['hosted-content-filter-rule'] = data.antiSpam.inboundRules;
  }
  if (!flat['hosted-outbound-spam-filter-policy'] && data?.antiSpam?.outboundPolicies) {
    flat['hosted-outbound-spam-filter-policy'] = data.antiSpam.outboundPolicies;
  }
  if (!flat['hosted-outbound-spam-filter-rule'] && data?.antiSpam?.outboundRules) {
    flat['hosted-outbound-spam-filter-rule'] = data.antiSpam.outboundRules;
  }
  if (!flat['malware-filter-policy'] && data?.antiMalware?.policies) {
    flat['malware-filter-policy'] = data.antiMalware.policies;
  }
  if (!flat['malware-filter-rule'] && data?.antiMalware?.rules) {
    flat['malware-filter-rule'] = data.antiMalware.rules;
  }
  if (!flat['safe-links-policy'] && data?.safeLinks?.policies) {
    flat['safe-links-policy'] = data.safeLinks.policies;
  }
  if (!flat['safe-links-rule'] && data?.safeLinks?.rules) {
    flat['safe-links-rule'] = data.safeLinks.rules;
  }
  if (!flat['safe-attachment-policy'] && data?.safeAttachments?.policies) {
    flat['safe-attachment-policy'] = data.safeAttachments.policies;
  }
  if (!flat['safe-attachment-rule'] && data?.safeAttachments?.rules) {
    flat['safe-attachment-rule'] = data.safeAttachments.rules;
  }
  if (!flat['accepted-domain'] && data?.mailFlow?.acceptedDomains) {
    flat['accepted-domain'] = data.mailFlow.acceptedDomains;
  }
  if (!flat['transport-config'] && data?.mailFlow?.transportConfig) {
    flat['transport-config'] = data.mailFlow.transportConfig;
  }
  if (!flat['exo-cas-mailbox'] && data?.mailFlow?.popImapStatus) {
    flat['exo-cas-mailbox'] = data.mailFlow.popImapStatus;
  }
  if (!flat['inbound-connector'] && data?.mailFlow?.inboundConnectors) {
    flat['inbound-connector'] = data.mailFlow.inboundConnectors;
  }
  if (!flat['outbound-connector'] && data?.mailFlow?.outboundConnectors) {
    flat['outbound-connector'] = data.mailFlow.outboundConnectors;
  }
  if (!flat['transport-rule'] && data?.mailFlow?.transportRules) {
    flat['transport-rule'] = data.mailFlow.transportRules;
  }
  if (!flat['exo-mailbox'] && data?.mailboxes?.all) {
    flat['exo-mailbox'] = data.mailboxes.all;
  }
  if (!flat['graph-security-alerts'] && data?.security?.alerts) {
    flat['graph-security-alerts'] = data.security.alerts;
  }
  if (!flat['graph-security-incidents'] && data?.security?.incidents) {
    flat['graph-security-incidents'] = data.security.incidents;
  }
  if (!flat['tenant-allow-block-list-items'] && data?.security?.tenantAllowBlockList) {
    flat['tenant-allow-block-list-items'] = data.security.tenantAllowBlockList;
  }
  if (!flat['graph-directory-roles'] && data?.directoryRoles) {
    flat['graph-directory-roles'] = data.directoryRoles;
  }

  return flat;
}

export function evaluateEmailSecurityControl(controlName: string, data: Record<string, any>, rawResponses: any[]): EmailControlEvaluationResult | null {
  const normalizedData = normalizeEmailSecurityData(data);
  let control = EMAIL_SECURITY_CONTROLS.find((c) => c.title === controlName);
  if (!control) {
    control = EMAIL_SECURITY_CONTROLS.find((c) => c.id === controlName);
  }
  if (!control) {
    const normalized = controlName.toLowerCase().replace(/[^a-z0-9]/g, '');
    control = EMAIL_SECURITY_CONTROLS.find((c) => c.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized);
  }
  if (!control) {
    return null;
  }

  try {
    return control.evaluate(normalizedData, rawResponses);
  } catch (error: any) {
    return {
      result: 'error',
      evidence: `Evaluation failed: ${error.message}`,
      recommendation: 'Review raw data for this control',
      error: { type: 'evaluation_error', message: error.message },
    };
  }
}
