import { EmailCollectionResult, EmailCollectionError } from './emailCollector';

export interface EmailControlEvaluationResult {
  result: 'pass' | 'fail' | 'error' | 'info' | 'not_applicable';
  evidence: string;
  recommendation: string;
  details?: any;
  error?: { type: string; message: string };
}

export interface EmailControlDefinition {
  id: string;
  controlName: string;
  category: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  weight: number;
  automatable: boolean;
  quickAssessment?: boolean;
  informational?: boolean;
  evaluate: (data: EmailCollectionResult) => EmailControlEvaluationResult;
}

function findCollectionError(errors: EmailCollectionError[], command: string): EmailCollectionError | undefined {
  return errors.find((e) => e.command === command);
}

function hasPermissionErrorForCommand(errors: EmailCollectionError[], command: string): boolean {
  const err = findCollectionError(errors, command);
  return err?.type === 'permission_denied' || err?.type === 'auth_error';
}

function isPolicyActive(policy: any, rule: any): boolean {
  if (!policy) return false;
  if (policy.enabled !== true) return false;
  if (rule && rule.state !== 'Enabled' && rule.state !== 'enabled') return false;
  return true;
}

function getEnabledPolicies(policies: any[], rules: any[]): any[] {
  const activeRulePolicyNames = new Set(
    rules.filter((r) => r.state === 'Enabled' || r.state === 'enabled').map((r) => r.policy)
  );
  return policies.filter((p) => {
    if (!p.enabled) return false;
    if (activeRulePolicyNames.size > 0 && !activeRulePolicyNames.has(p.name)) return false;
    return true;
  });
}

function getActiveRules(rules: any[]): any[] {
  return rules.filter((r) => r.state === 'Enabled' || r.state === 'enabled');
}

export const EMAIL_CONTROLS: EmailControlDefinition[] = [
  // ==================== ANTI-PHISHING ====================
  {
    id: 'email-anti-phish-001',
    controlName: 'Anti-phishing policy is enabled',
    category: 'Anti-Phishing',
    description: 'At least one enabled anti-phishing policy exists and is assigned through an active rule',
    severity: 'critical',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    evaluate: (data) => {
      const policies = data.data.antiPhishing.policies;
      const rules = data.data.antiPhishing.rules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-AntiPhishPolicy') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-AntiPhishRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not retrieve anti-phishing policies due to permission or authentication error',
          recommendation: 'Grant Exchange Administrator permissions to collect anti-phishing data',
          error: { type: 'collection_error', message: 'Permission denied for Get-AntiPhishPolicy or Get-AntiPhishRule' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, rules);
      if (enabledPolicies.length > 0) {
        return {
          result: 'pass',
          evidence: `${enabledPolicies.length} enabled anti-phishing policy(ies) with active rule assignment found`,
          recommendation: '',
          details: { policyNames: enabledPolicies.map((p: any) => p.name) },
        };
      }

      return {
        result: 'fail',
        evidence: 'No enabled anti-phishing policy with active rule assignment found',
        recommendation: 'Enable an anti-phishing policy and assign it through an active rule',
      };
    },
  },
  {
    id: 'email-anti-phish-002',
    controlName: 'Anti-phishing covers all users',
    category: 'Anti-Phishing',
    description: 'Anti-phishing policy provides coverage for all applicable users',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    evaluate: (data) => {
      const policies = data.data.antiPhishing.policies;
      const rules = data.data.antiPhishing.rules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-AntiPhishPolicy') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-AntiPhishRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify anti-phishing user coverage',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for anti-phishing collection' },
        };
      }

      const activeRules = getActiveRules(rules);
      if (activeRules.length === 0) {
        return {
          result: 'fail',
          evidence: 'No active anti-phishing rules found to determine coverage',
          recommendation: 'Enable an anti-phishing rule',
        };
      }

      const hasAllUsersCoverage = activeRules.some((r) => {
        const policy = policies.find((p: any) => p.name === r.policy);
        if (!policy) return false;
        const targetUsers = policy.targetUsers || [];
        const targetDomains = policy.targetDomains || [];
        return targetUsers.includes('All') || targetUsers.includes('AllOrganizationalUsers') || targetDomains.length > 0;
      });

      if (hasAllUsersCoverage) {
        return {
          result: 'pass',
          evidence: 'Anti-phishing policy covers all users',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'Anti-phishing policy does not cover all users',
        recommendation: 'Configure anti-phishing policy to cover all users',
      };
    },
  },
  {
    id: 'email-anti-phish-003',
    controlName: 'Anti-phishing impersonation protection is enabled',
    category: 'Anti-Phishing',
    description: 'User and domain impersonation protection is enabled in anti-phishing policy',
    severity: 'high',
    weight: 2,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.antiPhishing.policies;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-AntiPhishPolicy');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify impersonation protection',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Get-AntiPhishPolicy' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, []);
      const hasImpersonationProtection = enabledPolicies.some(
        (p) => p.impersonationProtectionState === 'Enabled' || p.impersonationProtectionState === 'enabled'
      );

      if (hasImpersonationProtection) {
        return {
          result: 'pass',
          evidence: 'Impersonation protection is enabled in anti-phishing policy',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'Impersonation protection is not enabled',
        recommendation: 'Enable user and domain impersonation protection in anti-phishing policy',
      };
    },
  },
  {
    id: 'email-anti-phish-004',
    controlName: 'Anti-phishing spoof intelligence is enabled',
    category: 'Anti-Phishing',
    description: 'Spoof Intelligence protection is enabled',
    severity: 'medium',
    weight: 1,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.antiPhishing.policies;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-AntiPhishPolicy');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify spoof intelligence',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Get-AntiPhishPolicy' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, []);
      const hasSpoofIntelligence = enabledPolicies.some(
        (p) => p.spoofIntelligenceProtectionState === 'Enabled' || p.spoofIntelligenceProtectionState === 'enabled'
      );

      if (hasSpoofIntelligence) {
        return {
          result: 'pass',
          evidence: 'Spoof Intelligence protection is enabled',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'Spoof Intelligence protection is not enabled',
        recommendation: 'Enable Spoof Intelligence protection in anti-phishing policy',
      };
    },
  },
  {
    id: 'email-anti-phish-005',
    controlName: 'Anti-phishing honors DMARC',
    category: 'Anti-Phishing',
    description: 'DMARC policy is set to quarantine or reject',
    severity: 'medium',
    weight: 1,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.antiPhishing.policies;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-AntiPhishPolicy');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify DMARC policy',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Get-AntiPhishPolicy' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, []);
      const hasDmarcQuarantineOrReject = enabledPolicies.some(
        (p) => p.dmarcPolicy === 'Quarantine' || p.dmarcPolicy === 'Reject'
      );

      if (hasDmarcQuarantineOrReject) {
        return {
          result: 'pass',
          evidence: 'DMARC policy is set to quarantine or reject',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'DMARC policy is not set to quarantine or reject',
        recommendation: 'Set DMARC policy to quarantine or reject in anti-phishing policy',
      };
    },
  },
  {
    id: 'email-anti-phish-006',
    controlName: 'Anti-phishing first contact safety tip is enabled',
    category: 'Anti-Phishing',
    description: 'First Contact Safety Tip is enabled',
    severity: 'low',
    weight: 1,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.antiPhishing.policies;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-AntiPhishPolicy');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify first contact safety tip',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Get-AntiPhishPolicy' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, []);
      const hasFirstContactSafetyTip = enabledPolicies.some(
        (p) => p.firstContactSafetyTipEnabled === true || p.firstContactSafetyTipEnabled === 'Enabled'
      );

      if (hasFirstContactSafetyTip) {
        return {
          result: 'pass',
          evidence: 'First Contact Safety Tip is enabled',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'First Contact Safety Tip is not enabled',
        recommendation: 'Enable First Contact Safety Tip in anti-phishing policy',
      };
    },
  },

  // ==================== ANTI-SPAM ====================
  {
    id: 'email-anti-spam-001',
    controlName: 'Inbound anti-spam policy is enabled',
    category: 'Anti-Spam',
    description: 'At least one enabled inbound anti-spam policy exists and is assigned through an active rule',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    evaluate: (data) => {
      const policies = data.data.antiSpam.inboundPolicies;
      const rules = data.data.antiSpam.inboundRules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-HostedContentFilterPolicy') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-HostedContentFilterRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not retrieve anti-spam policies',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for anti-spam collection' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, rules);
      if (enabledPolicies.length > 0) {
        return {
          result: 'pass',
          evidence: `${enabledPolicies.length} enabled inbound anti-spam policy(ies) with active rule assignment found`,
          recommendation: '',
          details: { policyNames: enabledPolicies.map((p: any) => p.name) },
        };
      }

      return {
        result: 'fail',
        evidence: 'No enabled inbound anti-spam policy with active rule assignment found',
        recommendation: 'Enable an inbound anti-spam policy and assign it through an active rule',
      };
    },
  },
  {
    id: 'email-anti-spam-002',
    controlName: 'Anti-spam policy covers all users',
    category: 'Anti-Spam',
    description: 'Anti-spam policy provides coverage for all users',
    severity: 'high',
    weight: 2,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.antiSpam.inboundPolicies;
      const rules = data.data.antiSpam.inboundRules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-HostedContentFilterPolicy') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-HostedContentFilterRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify anti-spam user coverage',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for anti-spam collection' },
        };
      }

      const activeRules = getActiveRules(rules);
      if (activeRules.length === 0) {
        return {
          result: 'fail',
          evidence: 'No active anti-spam rules found to determine coverage',
          recommendation: 'Enable an anti-spam rule',
        };
      }

      const hasAllUsersCoverage = activeRules.some((r) => {
        const policy = policies.find((p: any) => p.name === r.policy);
        return policy && policy.enabled;
      });

      if (hasAllUsersCoverage) {
        return {
          result: 'pass',
          evidence: 'Anti-spam policy covers all users',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'Anti-spam policy does not cover all users',
        recommendation: 'Configure anti-spam policy to cover all users',
      };
    },
  },
  {
    id: 'email-anti-spam-003',
    controlName: 'Anti-spam spam action is configured',
    category: 'Anti-Spam',
    description: 'Spam action is set to quarantine or delete',
    severity: 'medium',
    weight: 1,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.antiSpam.inboundPolicies;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-HostedContentFilterPolicy');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify spam action configuration',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Get-HostedContentFilterPolicy' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, []);
      const hasQuarantineOrDelete = enabledPolicies.some(
        (p) => p.spamAction === 'Quarantine' || p.spamAction === 'Delete' || p.spamAction === 'JunkEmail'
      );

      if (hasQuarantineOrDelete) {
        return {
          result: 'pass',
          evidence: 'Spam action is configured to quarantine or delete',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'Spam action is not properly configured',
        recommendation: 'Set spam action to quarantine or delete',
      };
    },
  },
  {
    id: 'email-anti-spam-004',
    controlName: 'Anti-spam high-confidence phishing action is configured',
    category: 'Anti-Spam',
    description: 'High-confidence phishing action is set to quarantine or delete',
    severity: 'critical',
    weight: 2,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.antiSpam.inboundPolicies;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-HostedContentFilterPolicy');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify high-confidence phishing action',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Get-HostedContentFilterPolicy' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, []);
      const hasQuarantineOrDelete = enabledPolicies.some(
        (p) => p.phishingSpamAction === 'Quarantine' || p.phishingSpamAction === 'Delete'
      );

      if (hasQuarantineOrDelete) {
        return {
          result: 'pass',
          evidence: 'High-confidence phishing action is set to quarantine or delete',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'High-confidence phishing action is not properly configured',
        recommendation: 'Set high-confidence phishing action to quarantine or delete',
      };
    },
  },
  {
    id: 'email-anti-spam-005',
    controlName: 'Outbound spam policy is configured',
    category: 'Anti-Spam',
    description: 'At least one enabled outbound spam policy exists',
    severity: 'medium',
    weight: 1,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.antiSpam.outboundPolicies;
      const rules = data.data.antiSpam.outboundRules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-HostedOutboundSpamFilterPolicy');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not retrieve outbound spam policies',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for outbound spam collection' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, rules);
      if (enabledPolicies.length > 0) {
        return {
          result: 'pass',
          evidence: `${enabledPolicies.length} enabled outbound spam policy(ies) found`,
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'No enabled outbound spam policy found',
        recommendation: 'Enable an outbound spam policy',
      };
    },
  },

  // ==================== ANTI-MALWARE ====================
  {
    id: 'email-anti-malware-001',
    controlName: 'Anti-malware policy is enabled',
    category: 'Anti-Malware',
    description: 'At least one enabled anti-malware policy exists and is assigned through an active rule',
    severity: 'critical',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    evaluate: (data) => {
      const policies = data.data.antiMalware.policies;
      const rules = data.data.antiMalware.rules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-MalwareFilterPolicy') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-MalwareFilterRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not retrieve anti-malware policies',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for anti-malware collection' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, rules);
      if (enabledPolicies.length > 0) {
        return {
          result: 'pass',
          evidence: `${enabledPolicies.length} enabled anti-malware policy(ies) with active rule assignment found`,
          recommendation: '',
          details: { policyNames: enabledPolicies.map((p: any) => p.name) },
        };
      }

      return {
        result: 'fail',
        evidence: 'No enabled anti-malware policy with active rule assignment found',
        recommendation: 'Enable an anti-malware policy and assign it through an active rule',
      };
    },
  },
  {
    id: 'email-anti-malware-002',
    controlName: 'Anti-malware policy covers all users',
    category: 'Anti-Malware',
    description: 'Anti-malware policy provides coverage for all users',
    severity: 'high',
    weight: 2,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.antiMalware.policies;
      const rules = data.data.antiMalware.rules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-MalwareFilterPolicy') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-MalwareFilterRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify anti-malware user coverage',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for anti-malware collection' },
        };
      }

      const activeRules = getActiveRules(rules);
      if (activeRules.length === 0) {
        return {
          result: 'fail',
          evidence: 'No active anti-malware rules found to determine coverage',
          recommendation: 'Enable an anti-malware rule',
        };
      }

      const hasAllUsersCoverage = activeRules.some((r) => {
        const policy = policies.find((p: any) => p.name === r.policy);
        return policy && policy.enabled;
      });

      if (hasAllUsersCoverage) {
        return {
          result: 'pass',
          evidence: 'Anti-malware policy covers all users',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'Anti-malware policy does not cover all users',
        recommendation: 'Configure anti-malware policy to cover all users',
      };
    },
  },
  {
    id: 'email-anti-malware-003',
    controlName: 'Zero-hour Auto Purge is enabled',
    category: 'Anti-Malware',
    description: 'ZAP is enabled for anti-malware policy',
    severity: 'medium',
    weight: 1,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.antiMalware.policies;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-MalwareFilterPolicy');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify ZAP configuration',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Get-MalwareFilterPolicy' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, []);
      const hasZap = enabledPolicies.some((p) => p.zapEnabled === true);

      if (hasZap) {
        return {
          result: 'pass',
          evidence: 'Zero-hour Auto Purge (ZAP) is enabled',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'Zero-hour Auto Purge (ZAP) is not enabled',
        recommendation: 'Enable ZAP in anti-malware policy',
      };
    },
  },

  // ==================== SAFE LINKS ====================
  {
    id: 'email-safe-links-001',
    controlName: 'Safe Links policy is enabled',
    category: 'Safe Links',
    description: 'At least one enabled Safe Links policy exists and is assigned through an active rule',
    severity: 'medium',
    weight: 1,
    automatable: true,
    quickAssessment: true,
    evaluate: (data) => {
      const policies = data.data.safeLinks.policies;
      const rules = data.data.safeLinks.rules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-SafeLinksPolicy') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-SafeLinksRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not retrieve Safe Links policies',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Safe Links collection' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, rules);
      if (enabledPolicies.length > 0) {
        return {
          result: 'pass',
          evidence: `${enabledPolicies.length} enabled Safe Links policy(ies) with active rule assignment found`,
          recommendation: '',
          details: { policyNames: enabledPolicies.map((p: any) => p.name) },
        };
      }

      return {
        result: 'fail',
        evidence: 'No enabled Safe Links policy with active rule assignment found',
        recommendation: 'Enable a Safe Links policy and assign it through an active rule',
      };
    },
  },
  {
    id: 'email-safe-links-002',
    controlName: 'Safe Links covers all users',
    category: 'Safe Links',
    description: 'Safe Links policy provides coverage for all users',
    severity: 'medium',
    weight: 1,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.safeLinks.policies;
      const rules = data.data.safeLinks.rules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-SafeLinksPolicy') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-SafeLinksRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify Safe Links user coverage',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Safe Links collection' },
        };
      }

      const activeRules = getActiveRules(rules);
      if (activeRules.length === 0) {
        return {
          result: 'fail',
          evidence: 'No active Safe Links rules found',
          recommendation: 'Enable a Safe Links rule',
        };
      }

      const hasAllUsersCoverage = activeRules.some((r) => {
        const policy = policies.find((p: any) => p.name === r.policy);
        return policy && policy.enabled;
      });

      if (hasAllUsersCoverage) {
        return {
          result: 'pass',
          evidence: 'Safe Links policy covers all users',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'Safe Links policy does not cover all users',
        recommendation: 'Configure Safe Links policy to cover all users',
      };
    },
  },

  // ==================== SAFE ATTACHMENTS ====================
  {
    id: 'email-safe-attachments-001',
    controlName: 'Safe Attachments policy is enabled',
    category: 'Safe Attachments',
    description: 'At least one enabled Safe Attachments policy exists and is assigned through an active rule',
    severity: 'medium',
    weight: 1,
    automatable: true,
    quickAssessment: true,
    evaluate: (data) => {
      const policies = data.data.safeAttachments.policies;
      const rules = data.data.safeAttachments.rules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-SafeAttachmentPolicy') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-SafeAttachmentRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not retrieve Safe Attachments policies',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Safe Attachments collection' },
        };
      }

      const enabledPolicies = getEnabledPolicies(policies, rules);
      if (enabledPolicies.length > 0) {
        return {
          result: 'pass',
          evidence: `${enabledPolicies.length} enabled Safe Attachments policy(ies) with active rule assignment found`,
          recommendation: '',
          details: { policyNames: enabledPolicies.map((p: any) => p.name) },
        };
      }

      return {
        result: 'fail',
        evidence: 'No enabled Safe Attachments policy with active rule assignment found',
        recommendation: 'Enable a Safe Attachments policy and assign it through an active rule',
      };
    },
  },
  {
    id: 'email-safe-attachments-002',
    controlName: 'Safe Attachments covers all users',
    category: 'Safe Attachments',
    description: 'Safe Attachments policy provides coverage for all users',
    severity: 'medium',
    weight: 1,
    automatable: true,
    evaluate: (data) => {
      const policies = data.data.safeAttachments.policies;
      const rules = data.data.safeAttachments.rules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-SafeAttachmentPolicy') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-SafeAttachmentRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify Safe Attachments user coverage',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Safe Attachments collection' },
        };
      }

      const activeRules = getActiveRules(rules);
      if (activeRules.length === 0) {
        return {
          result: 'fail',
          evidence: 'No active Safe Attachments rules found',
          recommendation: 'Enable a Safe Attachments rule',
        };
      }

      const hasAllUsersCoverage = activeRules.some((r) => {
        const policy = policies.find((p: any) => p.name === r.policy);
        return policy && policy.enabled;
      });

      if (hasAllUsersCoverage) {
        return {
          result: 'pass',
          evidence: 'Safe Attachments policy covers all users',
          recommendation: '',
        };
      }

      return {
        result: 'fail',
        evidence: 'Safe Attachments policy does not cover all users',
        recommendation: 'Configure Safe Attachments policy to cover all users',
      };
    },
  },

  // ==================== MAIL FLOW ====================
  {
    id: 'email-mailflow-001',
    controlName: 'DBEB is enabled for authoritative domains',
    category: 'Mail Flow',
    description: 'Directory Based Edge Blocking is enabled for authoritative domains',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    evaluate: (data) => {
      const domains = data.data.mailFlow.acceptedDomains;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-AcceptedDomain');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not retrieve accepted domains',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Get-AcceptedDomain' },
        };
      }

      const authoritativeDomains = domains.filter((d) => d.type === 'Authoritative');
      if (authoritativeDomains.length === 0) {
        return {
          result: 'not_applicable',
          evidence: 'No authoritative domains found',
          recommendation: '',
        };
      }

      const dbebEnabled = authoritativeDomains.every((d) => {
        const name = (d.name || '').toLowerCase();
        return name.includes('dbeb') || name.includes('directorybasededgeblocking');
      });

      if (dbebEnabled) {
        return {
          result: 'pass',
          evidence: 'DBEB is enabled for all authoritative domains',
          recommendation: '',
          details: { authoritativeDomains: authoritativeDomains.map((d) => d.name) },
        };
      }

      return {
        result: 'fail',
        evidence: 'DBEB is not enabled for all authoritative domains',
        recommendation: 'Enable Directory Based Edge Blocking for authoritative domains',
      };
    },
  },
  {
    id: 'email-mailflow-002',
    controlName: 'SMTP AUTH is disabled globally',
    category: 'Mail Flow',
    description: 'SMTP AUTH is disabled at tenant level',
    severity: 'critical',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    evaluate: (data) => {
      const transportConfig = data.data.mailFlow.transportConfig;
      const mailboxes = data.data.mailboxes.all;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-TransportConfig') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-EXOCASMailbox');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify SMTP AUTH status',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for SMTP AUTH collection' },
        };
      }

      const smtpAuthDisabled = data.data.mailFlow.smtpAuthDisabled;
      if (smtpAuthDisabled === true) {
        return {
          result: 'pass',
          evidence: 'SMTP AUTH is disabled globally',
          recommendation: '',
        };
      }

      if (smtpAuthDisabled === false) {
        const enabledMailboxes = mailboxes.filter((m) => m.smtpAuthEnabled === true);
        return {
          result: 'fail',
          evidence: `SMTP AUTH is enabled globally; ${enabledMailboxes.length} mailboxes have SMTP AUTH enabled`,
          recommendation: 'Disable SMTP AUTH globally via Set-TransportConfig -SmtpClientAuthenticationDisabled $true',
          details: { enabledMailboxCount: enabledMailboxes.length },
        };
      }

      return {
        result: 'fail',
        evidence: 'Could not determine SMTP AUTH status',
        recommendation: 'Verify SMTP AUTH is disabled globally',
      };
    },
  },
  {
    id: 'email-mailflow-003',
    controlName: 'POP and IMAP are disabled for all mailboxes',
    category: 'Mail Flow',
    description: 'POP and IMAP are disabled for all applicable mailboxes',
    severity: 'medium',
    weight: 1,
    automatable: true,
    quickAssessment: true,
    evaluate: (data) => {
      const mailboxes = data.data.mailboxes.all;
      const popImapStatus = data.data.mailFlow.popImapStatus;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-EXOCASMailbox') ||
                         hasPermissionErrorForCommand(data.errors, 'Get-CASMailbox');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not verify POP/IMAP status',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for POP/IMAP collection' },
        };
      }

      if (mailboxes.length === 0) {
        return {
          result: 'not_applicable',
          evidence: 'No mailboxes found',
          recommendation: '',
        };
      }

      const popEnabledCount = popImapStatus.filter((s) => s.popEnabled).length;
      const imapEnabledCount = popImapStatus.filter((s) => s.imapEnabled).length;

      if (popEnabledCount === 0 && imapEnabledCount === 0) {
        return {
          result: 'pass',
          evidence: 'POP and IMAP are disabled for all mailboxes',
          recommendation: '',
          details: { totalMailboxes: mailboxes.length },
        };
      }

      const affectedMailboxes = mailboxes.filter((m, i) => {
        const status = popImapStatus[i];
        return status && (status.popEnabled || status.imapEnabled);
      });

      return {
        result: 'fail',
        evidence: `${popEnabledCount} mailboxes have POP enabled, ${imapEnabledCount} have IMAP enabled`,
        recommendation: 'Disable POP and IMAP for all mailboxes',
        details: {
          popEnabledCount,
          imapEnabledCount,
          affectedMailboxes: affectedMailboxes.map((m) => m.primarySmtpAddress || m.identity),
        },
      };
    },
  },
  {
    id: 'email-mailflow-004',
    controlName: 'Inbound connectors require TLS',
    category: 'Mail Flow',
    description: 'All enabled inbound connectors require TLS',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    evaluate: (data) => {
      const connectors = data.data.mailFlow.inboundConnectors;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-InboundConnector');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not retrieve inbound connectors',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Get-InboundConnector' },
        };
      }

      const enabledConnectors = connectors.filter((c) => c.enabled);
      if (enabledConnectors.length === 0) {
        return {
          result: 'not_applicable',
          evidence: 'No enabled inbound connectors found',
          recommendation: '',
        };
      }

      const nonTlsConnectors = enabledConnectors.filter((c) => c.requireTls !== true);
      if (nonTlsConnectors.length === 0) {
        return {
          result: 'pass',
          evidence: 'All enabled inbound connectors require TLS',
          recommendation: '',
          details: { connectorCount: enabledConnectors.length },
        };
      }

      return {
        result: 'fail',
        evidence: `${nonTlsConnectors.length} enabled inbound connector(s) do not require TLS`,
        recommendation: 'Enable RequireTLS on all inbound connectors',
        details: { nonTlsConnectors: nonTlsConnectors.map((c) => c.name) },
      };
    },
  },
  {
    id: 'email-mailflow-005',
    controlName: 'Transport rules are configured',
    category: 'Mail Flow',
    description: 'At least one transport rule is configured in Enforce mode',
    severity: 'medium',
    weight: 1,
    automatable: true,
    evaluate: (data) => {
      const rules = data.data.mailFlow.transportRules;
      const cmdErrors = hasPermissionErrorForCommand(data.errors, 'Get-TransportRule');

      if (cmdErrors) {
        return {
          result: 'error',
          evidence: 'Could not retrieve transport rules',
          recommendation: 'Grant Exchange Administrator permissions',
          error: { type: 'collection_error', message: 'Permission denied for Get-TransportRule' },
        };
      }

      const activeRules = rules.filter((r) => r.state === 'Enabled' || r.state === 'enabled');
      if (activeRules.length === 0) {
        return {
          result: 'fail',
          evidence: 'No active transport rules found',
          recommendation: 'Configure transport rules for mail flow security',
        };
      }

      const enforceRules = activeRules.filter((r) => r.mode === 'Enforce' || !r.mode);
      if (enforceRules.length > 0) {
        return {
          result: 'pass',
          evidence: `${enforceRules.length} transport rule(s) in Enforce mode found`,
          recommendation: '',
          details: { ruleNames: enforceRules.map((r: any) => r.name) },
        };
      }

      return {
        result: 'fail',
        evidence: 'No transport rules in Enforce mode found',
        recommendation: 'Configure transport rules in Enforce mode',
      };
    },
  },

  // ==================== INFORMATIONAL ====================
  {
    id: 'email-info-001',
    controlName: 'Total mailboxes',
    category: 'Informational',
    description: 'Total number of mailboxes in the tenant',
    severity: 'low',
    weight: 0,
    automatable: true,
    informational: true,
    evaluate: (data) => {
      const total = data.data.metrics.totalMailboxes;
      return {
        result: 'info',
        evidence: `${total} total mailboxes`,
        recommendation: '',
      };
    },
  },
  {
    id: 'email-info-002',
    controlName: 'Total distribution groups',
    category: 'Informational',
    description: 'Total number of distribution groups in the tenant',
    severity: 'low',
    weight: 0,
    automatable: true,
    informational: true,
    evaluate: (data) => {
      const count = data.data.metrics.distributionGroups;
      return {
        result: 'info',
        evidence: `${count} distribution groups`,
        recommendation: '',
      };
    },
  },
  {
    id: 'email-info-003',
    controlName: 'Defender alerts count',
    category: 'Informational',
    description: 'Total number of Defender for Office 365 alerts',
    severity: 'low',
    weight: 0,
    automatable: true,
    informational: true,
    evaluate: (data) => {
      const count = data.data.security.alerts.length;
      return {
        result: 'info',
        evidence: `${count} Defender alerts`,
        recommendation: '',
      };
    },
  },
  {
    id: 'email-info-004',
    controlName: 'Total Microsoft 365 Groups',
    category: 'Informational',
    description: 'Total number of Microsoft 365 Groups',
    severity: 'low',
    weight: 0,
    automatable: true,
    informational: true,
    evaluate: (data) => {
      const count = data.data.groups.microsoft365.length;
      return {
        result: 'info',
        evidence: `${count} Microsoft 365 Groups`,
        recommendation: '',
      };
    },
  },
];

export function evaluateEmailControl(controlId: string, data: EmailCollectionResult): EmailControlEvaluationResult | null {
  const control = EMAIL_CONTROLS.find((c) => c.id === controlId);
  if (!control) return null;
  return control.evaluate(data);
}
