export interface EmailControlEvaluationResult {
  result: 'pass' | 'fail' | 'info' | 'error';
  evidence: string;
  recommendation?: string;
  details?: any;
  error?: { type: string; message: string };
}

export interface EmailControlDefinition {
  id: string;
  area: string;
  title: string;
  controlType: 'pass/fail' | 'informational';
  scope: 'quick' | 'detailed' | 'both';
  validationRule: string;
  evaluate: (data: Record<string, any>, rawResponses: any[]) => EmailControlEvaluationResult;
}

const enabled = (x: any) => x && (x.Enabled === true || x.Enabled === 'True' || x.IsEnabled === true || x.IsEnabled === 'True' || x.Enable === true || x.Enable === 'True');
const truthy = (v: any) => v === true || v === 'True' || v === 'true' || v === 'On' || v === 'on' || v === 1;

export const EMAIL_SECURITY_CONTROLS: EmailControlDefinition[] = [
  // ==================== ANTI-PHISHING POLICIES ====================
  {
    id: 'email-ap-01',
    area: 'Anti-Phishing',
    title: 'Anti-phishing policy exists and enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if at least one anti-phishing policy exists and is enabled.',
    evaluate: (data) => {
      const policies = (data['anti-phish-policy'] || []).filter(enabled);
      if (policies.length > 0) return { result: 'pass', evidence: `Found ${policies.length} enabled anti-phishing policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: 'No enabled anti-phishing policy found', recommendation: 'Create and enable at least one anti-phishing policy in the Microsoft Defender portal.' };
    }
  },
  {
    id: 'email-ap-02',
    area: 'Anti-Phishing',
    title: 'All users covered by at least one enabled MDO Anti-Phishing policy',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if every applicable user is covered by at least one enabled anti-phishing policy.',
    evaluate: (data) => {
      const policies = (data['anti-phish-policy'] || []).filter(enabled);
      const rules = (data['anti-phish-rule'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-phishing policies found', recommendation: 'Create and enable anti-phishing policies.' };
      const hasDefault = policies.some((p: any) => p.IsDefault === true || p.IsDefault === 'True');
      const hasAssignment = rules.some((r: any) => (r.SentTo && r.SentTo.length > 0) || (r.RecipientDomainIs && r.RecipientDomainIs.length > 0));
      if (hasDefault || hasAssignment) return { result: 'pass', evidence: `Coverage via ${policies.length} policy(ies)${hasDefault ? ' (default)' : ''} and ${rules.length} rule(s)`, details: { policies: policies.length, rules: rules.length, hasDefault, hasAssignment } };
      return { result: 'fail', evidence: 'No assignment rules or default policy coverage found', recommendation: 'Ensure a default policy or assignment rules cover all recipients.' };
    }
  },
  {
    id: 'email-ap-03',
    area: 'Anti-Phishing',
    title: 'Mailbox Intelligence enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if EnableMailboxIntelligence = True for all applicable enabled anti-phishing policies.',
    evaluate: (data) => {
      const policies = (data['anti-phish-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-phishing policies found', recommendation: 'Enable anti-phishing policies.' };
      const disabled = policies.filter((p: any) => p.EnableMailboxIntelligence === false || p.EnableMailboxIntelligence === 'False');
      if (disabled.length === 0) return { result: 'pass', evidence: `Mailbox Intelligence enabled in all ${policies.length} applicable policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Mailbox Intelligence disabled in ${disabled.length} of ${policies.length} policies`, recommendation: 'Enable Mailbox Intelligence in all anti-phishing policies.' };
    }
  },
  {
    id: 'email-ap-04',
    area: 'Anti-Phishing',
    title: 'User impersonation protection enabled and action configured',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if user impersonation protection is enabled in all applicable anti-phishing policies.',
    evaluate: (data) => {
      const policies = (data['anti-phish-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-phishing policies found', recommendation: 'Enable anti-phishing policies.' };
      const noUsers = policies.filter((p: any) => !p.TargetedUsersToProtect || (Array.isArray(p.TargetedUsersToProtect) && p.TargetedUsersToProtect.length === 0));
      const noAction = policies.filter((p: any) => !p.TargetedUserProtectionAction || p.TargetedUserProtectionAction === 'NoAction' || p.TargetedUserProtectionAction === 'NoActionAction');
      if (noUsers.length > 0 || noAction.length > 0) {
        return { result: 'fail', evidence: `User impersonation not configured in ${noUsers.length} policy(ies) or action missing in ${noAction.length} policy(ies)`, recommendation: 'Add protected users and configure TargetedUserProtectionAction in all applicable policies.' };
      }
      return { result: 'pass', evidence: `User impersonation protection enabled with action in all ${policies.length} policy(ies)`, details: { count: policies.length } };
    }
  },
  {
    id: 'email-ap-05',
    area: 'Anti-Phishing',
    title: 'Domain impersonation protection enabled and action configured',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if domain impersonation protection is enabled and the protection action is configured in all applicable enabled anti-phishing policies.',
    evaluate: (data) => {
      const policies = (data['anti-phish-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-phishing policies found', recommendation: 'Enable anti-phishing policies.' };
      const missing = policies.filter((p: any) => (p.EnableTargetedDomainsProtection === false || p.EnableTargetedDomainsProtection === 'False') && (p.EnableOrganizationDomainsProtection === false || p.EnableOrganizationDomainsProtection === 'False'));
      const noAction = policies.filter((p: any) => !p.TargetedDomainProtectionAction || p.TargetedDomainProtectionAction === 'NoAction' || p.TargetedDomainProtectionAction === 'NoActionAction');
      if (missing.length > 0 || noAction.length > 0) {
        return { result: 'fail', evidence: `Domain impersonation not enabled in ${missing.length} policy(ies) or action missing in ${noAction.length} policy(ies)`, recommendation: 'Enable Targeted/Organization domains protection and configure TargetedDomainProtectionAction in all applicable policies.' };
      }
      return { result: 'pass', evidence: `Domain impersonation protection enabled with action in all ${policies.length} policy(ies)`, details: { count: policies.length } };
    }
  },
  {
    id: 'email-ap-06',
    area: 'Anti-Phishing',
    title: 'Spoof Intelligence enabled and action configured',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if Spoof Intelligence is enabled and a protection action is configured in all applicable enabled anti-phishing policies.',
    evaluate: (data) => {
      const policies = (data['anti-phish-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-phishing policies found', recommendation: 'Enable anti-phishing policies.' };
      const disabled = policies.filter((p: any) => p.EnableSpoofIntelligence === false || p.EnableSpoofIntelligence === 'False');
      const noAction = policies.filter((p: any) => !p.AuthenticationFailAction || p.AuthenticationFailAction === 'NoAction' || p.AuthenticationFailAction === 'NoActionAction');
      if (disabled.length > 0 || noAction.length > 0) {
        return { result: 'fail', evidence: `Spoof Intelligence disabled in ${disabled.length} policy(ies) or action missing in ${noAction.length} policy(ies)`, recommendation: 'Enable Spoof Intelligence and configure AuthenticationFailAction in all applicable policies.' };
      }
      return { result: 'pass', evidence: `Spoof Intelligence enabled with action in all ${policies.length} policy(ies)`, details: { count: policies.length } };
    }
  },
  {
    id: 'email-ap-07',
    area: 'Anti-Phishing',
    title: 'Honor DMARC enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if Honor DMARC = Enabled for all applicable enabled anti-phishing policies.',
    evaluate: (data) => {
      const policies = (data['anti-phish-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-phishing policies found', recommendation: 'Enable anti-phishing policies.' };
      const disabled = policies.filter((p: any) => p.HonorDmarcPolicy === false || p.HonorDmarcPolicy === 'False');
      if (disabled.length === 0) return { result: 'pass', evidence: `Honor DMARC enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Honor DMARC disabled in ${disabled.length} of ${policies.length} policies`, recommendation: 'Enable Honor DMARC in all anti-phishing policies.' };
    }
  },
  {
    id: 'email-ap-08',
    area: 'Anti-Phishing',
    title: 'Via Tag enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if Via Tag = Enabled for all applicable enabled anti-phishing policies.',
    evaluate: (data) => {
      const policies = (data['anti-phish-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-phishing policies found', recommendation: 'Enable anti-phishing policies.' };
      const disabled = policies.filter((p: any) => p.EnableViaTag === false || p.EnableViaTag === 'False');
      if (disabled.length === 0) return { result: 'pass', evidence: `Via Tag enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Via Tag disabled in ${disabled.length} of ${policies.length} policies`, recommendation: 'Enable Via Tag in all anti-phishing policies.' };
    }
  },
  {
    id: 'email-ap-09',
    area: 'Anti-Phishing',
    title: 'Show "?" for unauthenticated senders enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if Show "?" for unauthenticated senders = Enabled for all applicable enabled anti-phishing policies.',
    evaluate: (data) => {
      const policies = (data['anti-phish-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-phishing policies found', recommendation: 'Enable anti-phishing policies.' };
      const disabled = policies.filter((p: any) => p.EnableUnauthenticatedSender === false || p.EnableUnauthenticatedSender === 'False');
      if (disabled.length === 0) return { result: 'pass', evidence: `Unauthenticated sender "?" enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Unauthenticated sender "?" disabled in ${disabled.length} of ${policies.length} policies`, recommendation: 'Enable unauthenticated sender indicator in all anti-phishing policies.' };
    }
  },
  {
    id: 'email-ap-10',
    area: 'Anti-Phishing',
    title: 'First Contact Safety Tip enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if First Contact Safety tip = Enabled for all applicable enabled anti-phishing policies.',
    evaluate: (data) => {
      const policies = (data['anti-phish-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-phishing policies found', recommendation: 'Enable anti-phishing policies.' };
      const disabled = policies.filter((p: any) => p.EnableFirstContactSafetyTip === false || p.EnableFirstContactSafetyTip === 'False');
      if (disabled.length === 0) return { result: 'pass', evidence: `First Contact Safety tip enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail',     evidence: `First Contact Safety tip disabled in ${disabled.length} of ${policies.length} policies`, recommendation: 'Enable First Contact Safety tip in all anti-phishing policies.' };
    }
  },
  // ==================== ANTI-SPAM POLICIES (INBOUND) ====================
  {
    id: 'email-as-01',
    area: 'Anti-Spam Inbound',
    title: 'Inbound anti-spam policy exists and enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if at least one inbound anti-spam policy exists, is enabled, and is assigned through an active inbound anti-spam rule.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      const rules = (data['hosted-content-filter-rule'] || []).filter(enabled);
      if (policies.length > 0 && rules.length > 0) return { result: 'pass', evidence: `Found ${policies.length} policy(ies) with ${rules.length} active rule(s)`, details: { policies: policies.length, rules: rules.length } };
      if (policies.length > 0) return { result: 'fail', evidence: 'No active inbound anti-spam rules found', recommendation: 'Create active inbound anti-spam rules to assign policies.' };
      return { result: 'fail', evidence: 'No enabled inbound anti-spam policy found', recommendation: 'Enable at least one inbound anti-spam policy.' };
    }
  },
  {
    id: 'email-as-02',
    area: 'Anti-Spam Inbound',
    title: 'All users covered by at least one enabled inbound Anti-Spam policy',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if every applicable user is covered by at least one enabled inbound anti-spam policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      const rules = (data['hosted-content-filter-rule'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const hasDefault = policies.some((p: any) => p.IsDefault === true || p.IsDefault === 'True');
      const hasAssignment = rules.some((r: any) => (r.SentTo && r.SentTo.length > 0) || (r.RecipientDomainIs && r.RecipientDomainIs.length > 0));
      if (hasDefault || hasAssignment) return { result: 'pass', evidence: 'Inbound anti-spam policy coverage configured', details: { hasDefault, hasAssignment } };
      return { result: 'fail', evidence: 'No assignment rules or default policy coverage found', recommendation: 'Create rules to assign inbound anti-spam policies.' };
    }
  },
  {
    id: 'email-as-03',
    area: 'Anti-Spam Inbound',
    title: 'Image links to remote websites enabled',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: IncreaseScoreWithImageLinks = On in all applicable enabled inbound anti-spam policies. Fail: The setting is Off in any applicable policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.IncreaseScoreWithImageLinks === false || p.IncreaseScoreWithImageLinks === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Image links to remote websites enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable IncreaseScoreWithImageLinks in all applicable policies.' };
    }
  },
  {
    id: 'email-as-04',
    area: 'Anti-Spam Inbound',
    title: 'Numeric IP address in URL enabled',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: IncreaseScoreWithNumericIps = On in all applicable enabled inbound anti-spam policies. Fail: The setting is Off in any applicable policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.IncreaseScoreWithNumericIps === false || p.IncreaseScoreWithNumericIps === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Numeric IP URL filtering enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable IncreaseScoreWithNumericIps in all applicable policies.' };
    }
  },
  {
    id: 'email-as-05',
    area: 'Anti-Spam Inbound',
    title: 'URL redirect to other port enabled',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: IncreaseScoreWithRedirectToOtherPort = On in all applicable enabled inbound anti-spam policies. Fail: The setting is Off in any applicable policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.IncreaseScoreWithRedirectToOtherPort === false || p.IncreaseScoreWithRedirectToOtherPort === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `URL redirect port filtering enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable IncreaseScoreWithRedirectToOtherPort in all applicable policies.' };
    }
  },
  {
    id: 'email-as-06',
    area: 'Anti-Spam Inbound',
    title: 'Empty messages marked as spam',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: MarkAsSpamEmptyMessages = On in all applicable enabled inbound anti-spam policies. Fail: The setting is Off in any applicable policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.MarkAsSpamEmptyMessages === false || p.MarkAsSpamEmptyMessages === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Empty messages marked as spam in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable MarkAsSpamEmptyMessages in all applicable policies.' };
    }
  },
  {
    id: 'email-as-07',
    area: 'Anti-Spam Inbound',
    title: 'Embedded tags in HTML marked as spam',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: MarkAsSpamEmbedTagsInHtml = On in all applicable enabled inbound anti-spam policies. Fail: The setting is Off in any applicable policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.MarkAsSpamEmbedTagsInHtml === false || p.MarkAsSpamEmbedTagsInHtml === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Embedded tags in HTML marked as spam in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable MarkAsSpamEmbedTagsInHtml in all applicable policies.' };
    }
  },
  {
    id: 'email-as-08',
    area: 'Anti-Spam Inbound',
    title: 'JavaScript or VBScript in HTML marked as spam',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: MarkAsSpamJavaScriptInHtml / MarkAsSpamVbScriptInHtml is set appropriately.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.MarkAsSpamJavaScriptInHtml === false || p.MarkAsSpamJavaScriptInHtml === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `JavaScript/VBScript HTML filtering enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable JavaScript/VBScript HTML filtering in all applicable policies.' };
    }
  },
  {
    id: 'email-as-09',
    area: 'Anti-Spam Inbound',
    title: 'Form tags in HTML marked as spam',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: MarkAsSpamFormTagsInHtml = On in all applicable enabled inbound anti-spam policies. Fail: The setting is Off in any applicable policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.MarkAsSpamFormTagsInHtml === false || p.MarkAsSpamFormTagsInHtml === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Form tags in HTML marked as spam in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable MarkAsSpamFormTagsInHtml in all applicable policies.' };
    }
  },
  {
    id: 'email-as-10',
    area: 'Anti-Spam Inbound',
    title: 'Frame or iframe tags in HTML marked as spam',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: MarkAsSpamFramesInHtml = On in all applicable enabled inbound anti-spam policies. Fail: The setting is Off in any applicable policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.MarkAsSpamFramesInHtml === false || p.MarkAsSpamFramesInHtml === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Frame/iframe tag filtering enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable MarkAsSpamFramesInHtml in all applicable policies.' };
    }
  },
  {
    id: 'email-as-11',
    area: 'Anti-Spam Inbound',
    title: 'Web bugs in HTML marked as spam',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: MarkAsSpamWebBugsInHtml = On in all applicable enabled inbound anti-spam policies. Fail: The setting is Off in any applicable policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.MarkAsSpamWebBugsInHtml === false || p.MarkAsSpamWebBugsInHtml === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Web bug filtering enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable MarkAsSpamWebBugsInHtml in all applicable policies.' };
    }
  },
  {
    id: 'email-as-12',
    area: 'Anti-Spam Inbound',
    title: 'SPF record hard fail enabled',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: MarkAsSpamSpfRecordHardFail = On in all applicable enabled inbound anti-spam policies. Fail: The setting is Off in any applicable policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.MarkAsSpamSpfRecordHardFail === false || p.MarkAsSpamSpfRecordHardFail === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `SPF hard fail enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable MarkAsSpamSpfRecordHardFail in all applicable policies.' };
    }
  },
  {
    id: 'email-as-13',
    area: 'Anti-Spam Inbound',
    title: 'Backscatter detection enabled',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass: MarkAsSpamBackscatter = On in all applicable enabled inbound anti-spam policies. Fail: The setting is Off in any applicable policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.MarkAsSpamBackscatter === false || p.MarkAsSpamBackscatter === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Backscatter detection enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Setting is Off in ${off.length} of ${policies.length} policies`, recommendation: 'Enable MarkAsSpamBackscatter in all applicable policies.' };
    }
  },
  {
    id: 'email-as-14',
    area: 'Anti-Spam Inbound',
    title: 'Spam action configured',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if SpamAction is configured in all applicable enabled inbound anti-spam policies. Fail if no Spam action is configured.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const missing = policies.filter((p: any) => !p.SpamAction || p.SpamAction === 'NoAction' || p.SpamAction === 'NoActionAction');
      if (missing.length === 0) return { result: 'pass', evidence: `Spam action configured in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Spam action not configured in ${missing.length} of ${policies.length} policies`, recommendation: 'Configure SpamAction in all applicable policies.' };
    }
  },
  {
    id: 'email-as-15',
    area: 'Anti-Spam Inbound',
    title: 'High Confidence Spam action configured',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if HighConfidenceSpamAction = Configured in all applicable enabled inbound anti-spam policies. Fail if any other / no spam action is configured.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const missing = policies.filter((p: any) => !p.HighConfidenceSpamAction || p.HighConfidenceSpamAction === 'NoAction' || p.HighConfidenceSpamAction === 'NoActionAction');
      if (missing.length === 0) return { result: 'pass', evidence: `High Confidence Spam action configured in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `High Confidence Spam action not configured in ${missing.length} of ${policies.length} policies`, recommendation: 'Configure HighConfidenceSpamAction (recommended: Quarantine) in all applicable policies.' };
    }
  },
  {
    id: 'email-as-16',
    area: 'Anti-Spam Inbound',
    title: 'Bulk email action configured',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if BulkSpamAction is configured in all applicable enabled inbound anti-spam policies. Fail if no action is configured.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const missing = policies.filter((p: any) => !p.BulkSpamAction || p.BulkSpamAction === 'NoAction' || p.BulkSpamAction === 'NoActionAction');
      if (missing.length === 0) return { result: 'pass', evidence: `Bulk email action configured in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Bulk email action not configured in ${missing.length} of ${policies.length} policies`, recommendation: 'Configure BulkSpamAction in all applicable policies.' };
    }
  },
  {
    id: 'email-as-17',
    area: 'Anti-Spam Inbound',
    title: 'Phishing messages action configured',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if Phishing message action is configured in all applicable enabled inbound anti-spam policies. Fail if any other / no action is configured.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const missing = policies.filter((p: any) => !p.PhishSpamAction || p.PhishSpamAction === 'NoAction' || p.PhishSpamAction === 'NoActionAction');
      if (missing.length === 0) return { result: 'pass', evidence: `Phishing action configured in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Phishing action not configured in ${missing.length} of ${policies.length} policies`, recommendation: 'Configure PhishSpamAction (recommended: Quarantine) in all applicable policies.' };
    }
  },
  {
    id: 'email-as-18',
    area: 'Anti-Spam Inbound',
    title: 'High Confidence Phishing action configured',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if High confidence Phishing message action is configured in all applicable enabled inbound anti-spam policies. Fail if any other / no action is configured.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const missing = policies.filter((p: any) => !p.HighConfidencePhishSpamAction || p.HighConfidencePhishSpamAction === 'NoAction' || p.HighConfidencePhishSpamAction === 'NoActionAction');
      if (missing.length === 0) return { result: 'pass', evidence: `High Confidence Phishing action configured in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `High Confidence Phishing action not configured in ${missing.length} of ${policies.length} policies`, recommendation: 'Configure HighConfidencePhishSpamAction (recommended: Quarantine) in all applicable policies.' };
    }
  },
  {
    id: 'email-as-19',
    area: 'Anti-Spam Inbound',
    title: 'Enable ZAP (Zero-hour Auto Purge)',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if Zero-hour Auto Purge (ZAP) = Enabled for all applicable enabled inbound anti-spam policies. Fail if ZAP is disabled in any applicable enabled policy.',
    evaluate: (data) => {
      const policies = (data['hosted-content-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled inbound anti-spam policies found', recommendation: 'Enable inbound anti-spam policies.' };
      const off = policies.filter((p: any) => p.ZapEnabled === false || p.ZapEnabled === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `ZAP enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `ZAP disabled in ${off.length} of ${policies.length} policies`, recommendation: 'Enable ZAP in all applicable policies.' };
    }
  },
  // ==================== ANTI-SPAM OUTBOUND ====================
  {
    id: 'email-os-01',
    area: 'Anti-Spam Outbound',
    title: 'Outbound spam policy exists and enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if at least one outbound anti-spam policy exists and is enabled.',
    evaluate: (data) => {
      const policies = (data['hosted-outbound-spam-filter-policy'] || []).filter(enabled);
      if (policies.length > 0) return { result: 'pass', evidence: `Found ${policies.length} enabled outbound anti-spam policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: 'No enabled outbound anti-spam policy found', recommendation: 'Enable at least one outbound anti-spam policy.' };
    }
  },
  {
    id: 'email-os-02',
    area: 'Anti-Spam Outbound',
    title: 'Restriction placed on users who reach the message limit',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if the configured action for users who reach the outbound message limit is Block user from sending email in all applicable enabled outbound anti-spam policies. Fail if no restriction is configured (no action only alert).',
    evaluate: (data) => {
      const policies = (data['hosted-outbound-spam-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled outbound anti-spam policies found', recommendation: 'Enable outbound anti-spam policies.' };
      const blocking = policies.filter((p: any) => p.ActionWhenThresholdReached === 'BlockUser');
      if (blocking.length === policies.length) return { result: 'pass', evidence: `All ${policies.length} policy(ies) block users who reach the limit`, details: { count: policies.length } };
      if (blocking.length > 0) return { result: 'fail', evidence: `${blocking.length} of ${policies.length} policies block users at limit`, recommendation: 'Set ActionWhenThresholdReached to BlockUser in all applicable policies.' };
      return { result: 'fail', evidence: 'No policies block users who reach the limit', recommendation: 'Configure ActionWhenThresholdReached to BlockUser in all applicable policies.' };
    }
  },
  // ==================== ANTI-MALWARE ====================
  {
    id: 'email-am-01',
    area: 'Anti-Malware',
    title: 'Anti-malware policy exists and enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if at least one anti-malware policy exists, is enabled, and is assigned through an active anti-malware rule.',
    evaluate: (data) => {
      const policies = (data['malware-filter-policy'] || []).filter(enabled);
      const rules = (data['malware-filter-rule'] || []).filter(enabled);
      if (policies.length > 0 && rules.length > 0) return { result: 'pass', evidence: `Found ${policies.length} policy(ies) with ${rules.length} active rule(s)`, details: { policies: policies.length, rules: rules.length } };
      if (policies.length > 0) return { result: 'fail', evidence: 'No active anti-malware rules found', recommendation: 'Create active anti-malware rules to assign policies.' };
      return { result: 'fail', evidence: 'No enabled anti-malware policy found', recommendation: 'Enable at least one anti-malware policy.' };
    }
  },
  {
    id: 'email-am-02',
    area: 'Anti-Malware',
    title: 'All users assigned at least one Anti-Malware policy',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if every applicable user is covered by at least one enabled Anti-Malware policy.',
    evaluate: (data) => {
      const policies = (data['malware-filter-policy'] || []).filter(enabled);
      const rules = (data['malware-filter-rule'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-malware policies found', recommendation: 'Enable anti-malware policies.' };
      const hasDefault = policies.some((p: any) => p.IsDefault === true || p.IsDefault === 'True');
      const hasAssignment = rules.some((r: any) => (r.SentTo && r.SentTo.length > 0) || (r.RecipientDomainIs && r.RecipientDomainIs.length > 0));
      if (hasDefault || hasAssignment) return { result: 'pass', evidence: 'Anti-malware coverage configured', details: { hasDefault, hasAssignment } };
      return { result: 'fail', evidence: 'No assignment rules or default policy coverage found', recommendation: 'Create rules to assign anti-malware policies.' };
    }
  },
  {
    id: 'email-am-03',
    area: 'Anti-Malware',
    title: 'Zero-hour Auto Purge (ZAP) enabled for Anti-Malware',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if ZAP is enabled for anti-malware. Fail if ZAP is disabled in any applicable enabled policy.',
    evaluate: (data) => {
      const policies = (data['malware-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-malware policies found', recommendation: 'Enable anti-malware policies.' };
      const off = policies.filter((p: any) => p.ZapEnabled === false || p.ZapEnabled === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `ZAP enabled in all ${policies.length} anti-malware policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `ZAP disabled in ${off.length} of ${policies.length} policies`, recommendation: 'Enable ZAP for anti-malware in all applicable policies.' };
    }
  },
  {
    id: 'email-am-04',
    area: 'Anti-Malware',
    title: 'Common attachment type filter enabled',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if Common attachment filter = Enabled for all applicable enabled Anti-Malware policies. Fail if it is disabled in any applicable enabled policy.',
    evaluate: (data) => {
      const policies = (data['malware-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-malware policies found', recommendation: 'Enable anti-malware policies.' };
      const off = policies.filter((p: any) => p.EnableFileFilter === false || p.EnableFileFilter === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Common attachment filter enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Common attachment filter disabled in ${off.length} of ${policies.length} policies`, recommendation: 'Enable common attachment type filter in all applicable policies.' };
    }
  },
  {
    id: 'email-am-05',
    area: 'Anti-Malware',
    title: 'Notify the admin about undelivered messages (internal / external)',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if administrator notifications for both internal and external malware-detected undelivered messages are enabled. Fail if either notification is disabled or no notification recipient is configured.',
    evaluate: (data) => {
      const policies = (data['malware-filter-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled anti-malware policies found', recommendation: 'Enable anti-malware policies.' };
      const missing = policies.filter((p: any) => !p.AdminDisplayName || p.AdminDisplayName === '' || (p.NotifySenderOnInternal !== true && p.NotifySenderOnInternal !== 'True' && p.NotifySenderOnExternal !== true && p.NotifySenderOnExternal !== 'True'));
      if (missing.length === 0) return { result: 'pass', evidence: `Admin notifications configured in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Admin notifications missing in ${missing.length} of ${policies.length} policies`, recommendation: 'Configure admin notification recipient and enable internal/external notifications in all applicable policies.' };
    }
  },
  // ==================== SAFE LINKS ====================
  {
    id: 'email-sl-01',
    area: 'Safe Links',
    title: 'Safe Links policy exists and enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if at least one Safe Links policy exists, is enabled, and is assigned through an active Safe Links rule.',
    evaluate: (data) => {
      const policies = (data['safe-links-policy'] || []).filter(enabled);
      const rules = (data['safe-links-rule'] || []).filter(enabled);
      if (policies.length > 0 && rules.length > 0) return { result: 'pass', evidence: `Found ${policies.length} policy(ies) with ${rules.length} active rule(s)`, details: { policies: policies.length, rules: rules.length } };
      if (policies.length > 0) return { result: 'fail', evidence: 'No active Safe Links rules found', recommendation: 'Create active Safe Links rules to assign policies.' };
      return { result: 'fail', evidence: 'No enabled Safe Links policy found', recommendation: 'Enable at least one Safe Links policy.' };
    }
  },
  {
    id: 'email-sl-02',
    area: 'Safe Links',
    title: 'All applicable users covered by at least one enabled Safe Links policy',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if every applicable user is covered by at least one enabled Safe Links policy.',
    evaluate: (data) => {
      const policies = (data['safe-links-policy'] || []).filter(enabled);
      const rules = (data['safe-links-rule'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled Safe Links policies found', recommendation: 'Enable Safe Links policies.' };
      const hasDefault = policies.some((p: any) => p.IsDefault === true || p.IsDefault === 'True');
      const hasAssignment = rules.some((r: any) => (r.SentTo && r.SentTo.length > 0) || (r.RecipientDomainIs && r.RecipientDomainIs.length > 0));
      if (hasDefault || hasAssignment) return { result: 'pass', evidence: 'Safe Links coverage configured', details: { hasDefault, hasAssignment } };
      return { result: 'fail', evidence: 'No assignment rules or default policy coverage found', recommendation: 'Create rules to assign Safe Links policies.' };
    }
  },
  {
    id: 'email-sl-03',
    area: 'Safe Links',
    title: 'Email URL scanning enabled',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if Email URL scanning (Safe Links for email) = Enabled for all applicable enabled Safe Links policies. Fail if the setting is disabled in any applicable enabled policy.',
    evaluate: (data) => {
      const policies = (data['safe-links-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled Safe Links policies found', recommendation: 'Enable Safe Links policies.' };
      const off = policies.filter((p: any) => p.EnableSafeLinksForEmail === false || p.EnableSafeLinksForEmail === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Email URL scanning enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Email URL scanning disabled in ${off.length} of ${policies.length} policies`, recommendation: 'Enable Email URL scanning in all Safe Links policies.' };
    }
  },
  {
    id: 'email-sl-04',
    area: 'Safe Links',
    title: 'Safe Links protection enabled for internal email',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if Safe Links protection for internal email = Enabled for all applicable enabled Safe Links policies. Fail if the setting is disabled in any applicable enabled policy.',
    evaluate: (data) => {
      const policies = (data['safe-links-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled Safe Links policies found', recommendation: 'Enable Safe Links policies.' };
      const off = policies.filter((p: any) => p.ScanUrls === false || p.ScanUrls === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Safe Links for internal email enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Internal email protection disabled in ${off.length} of ${policies.length} policies`, recommendation: 'Enable Safe Links protection for internal email in all policies.' };
    }
  },
  {
    id: 'email-sl-05',
    area: 'Safe Links',
    title: 'Real-time URL scanning enabled and wait for URL scanning to complete before delivery',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if real-time URL scanning is enabled. Fail if the setting is disabled in any applicable enabled policy.',
    evaluate: (data) => {
      const policies = (data['safe-links-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled Safe Links policies found', recommendation: 'Enable Safe Links policies.' };
      const off = policies.filter((p: any) => p.DisableUrlRewrite === true || p.DisableUrlRewrite === 'True');
      if (off.length === 0) return { result: 'pass', evidence: `Real-time URL scanning enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `URL rewriting disabled in ${off.length} of ${policies.length} policies`, recommendation: 'Enable URL rewriting in all Safe Links policies.' };
    }
  },
  {
    id: 'email-sl-06',
    area: 'Safe Links',
    title: 'URL rewriting enabled',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if URL rewriting is enabled for all applicable enabled Safe Links policies. Fail if URL rewriting is disabled in any applicable enabled policy.',
    evaluate: (data) => {
      const policies = (data['safe-links-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled Safe Links policies found', recommendation: 'Enable Safe Links policies.' };
      const off = policies.filter((p: any) => p.DisableUrlRewrite === true || p.DisableUrlRewrite === 'True');
      if (off.length === 0) return { result: 'pass', evidence: `URL rewriting enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `URL rewriting disabled in ${off.length} of ${policies.length} policies`, recommendation: 'Enable URL rewriting in all Safe Links policies.' };
    }
  },
  {
    id: 'email-sl-07',
    area: 'Safe Links',
    title: 'Safe Links protection for Teams and Office 365 / M365 Apps enabled',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if Safe Links protection for Microsoft Teams and Microsoft 365 Apps is enabled for all applicable enabled Safe Links policies. Fail if either setting is disabled in any applicable enabled policy.',
    evaluate: (data) => {
      const policies = (data['safe-links-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled Safe Links policies found', recommendation: 'Enable Safe Links policies.' };
      const off = policies.filter((p: any) => p.EnableSafeLinksForTeams === false || p.EnableSafeLinksForTeams === 'False' || p.EnableSafeLinksForOffice === false || p.EnableSafeLinksForOffice === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `Safe Links for Teams and Office 365 enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Teams/Office 365 protection disabled in ${off.length} of ${policies.length} policies`, recommendation: 'Enable Safe Links for Teams and Office 365 Apps in all policies.' };
    }
  },
  {
    id: 'email-sl-08',
    area: 'Safe Links',
    title: 'User click tracking enabled',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if Track User Clicks = Enabled for all applicable enabled Safe Links policies. Fail if user click tracking is disabled in any applicable enabled policy.',
    evaluate: (data) => {
      const policies = (data['safe-links-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled Safe Links policies found', recommendation: 'Enable Safe Links policies.' };
      const off = policies.filter((p: any) => p.TrackClicks === false || p.TrackClicks === 'False');
      if (off.length === 0) return { result: 'pass', evidence: `User click tracking enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `Click tracking disabled in ${off.length} of ${policies.length} policies`, recommendation: 'Enable user click tracking in all Safe Links policies.' };
    }
  },
  // ==================== SAFE ATTACHMENTS ====================
  {
    id: 'email-sa-01',
    area: 'Safe Attachments',
    title: 'Safe Attachments policy exists and enabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if at least one Safe Attachments policy exists, is enabled, and is assigned through an active Safe Attachments rule.',
    evaluate: (data) => {
      const policies = (data['safe-attachment-policy'] || []).filter(enabled);
      const rules = (data['safe-attachment-rule'] || []).filter(enabled);
      if (policies.length > 0 && rules.length > 0) return { result: 'pass', evidence: `Found ${policies.length} policy(ies) with ${rules.length} active rule(s)`, details: { policies: policies.length, rules: rules.length } };
      if (policies.length > 0) return { result: 'fail', evidence: 'No active Safe Attachments rules found', recommendation: 'Create active Safe Attachments rules to assign policies.' };
      return { result: 'fail', evidence: 'No enabled Safe Attachments policy found', recommendation: 'Enable at least one Safe Attachments policy.' };
    }
  },
  {
    id: 'email-sa-02',
    area: 'Safe Attachments',
    title: 'All applicable users covered by at least one enabled Safe Attachments policy',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if every applicable user is covered by at least one enabled Safe Attachments policy.',
    evaluate: (data) => {
      const policies = (data['safe-attachment-policy'] || []).filter(enabled);
      const rules = (data['safe-attachment-rule'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled Safe Attachments policies found', recommendation: 'Enable Safe Attachments policies.' };
      const hasDefault = policies.some((p: any) => p.IsDefault === true || p.IsDefault === 'True');
      const hasAssignment = rules.some((r: any) => (r.SentTo && r.SentTo.length > 0) || (r.RecipientDomainIs && r.RecipientDomainIs.length > 0));
      if (hasDefault || hasAssignment) return { result: 'pass', evidence: 'Safe Attachments coverage configured', details: { hasDefault, hasAssignment } };
      return { result: 'fail', evidence: 'No assignment rules or default policy coverage found', recommendation: 'Create rules to assign Safe Attachments policies.' };
    }
  },
  {
    id: 'email-sa-03',
    area: 'Safe Attachments',
    title: 'Dynamic Delivery enabled for unknown malware attachments',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'Pass if the Safe Attachments action for unknown malware is configured as Dynamic Delivery in all applicable enabled Safe Attachments policies. Fail if any applicable policy is configured with a different action.',
    evaluate: (data) => {
      const policies = (data['safe-attachment-policy'] || []).filter(enabled);
      if (policies.length === 0) return { result: 'fail', evidence: 'No enabled Safe Attachments policies found', recommendation: 'Enable Safe Attachments policies.' };
      const wrong = policies.filter((p: any) => p.Action !== 'DynamicDelivery' && p.Action !== 1);
      if (wrong.length === 0) return { result: 'pass', evidence: `Dynamic Delivery enabled in all ${policies.length} policy(ies)`, details: { count: policies.length } };
      return { result: 'fail', evidence: `${wrong.length} of ${policies.length} policies not set to Dynamic Delivery`, recommendation: 'Set Safe Attachments action to Dynamic Delivery in all applicable policies.' };
    }
  },
  // ==================== PERMISSIONS & RBAC ====================
  {
    id: 'email-rbac-01',
    area: 'Permissions & RBAC',
    title: 'Directory Based Edge Blocking (DBEB) enabled for accepted domains',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if DBEB is enabled for all applicable Authoritative accepted domains. Exclude Internal Relay and External Relay domains from the evaluation unless organizational policy requires otherwise. Fail if DBEB is disabled for any applicable Authoritative accepted domain.',
    evaluate: (data) => {
      const domains = (data['accepted-domain'] || []).filter((d: any) => d.DomainType === 'Authoritative');
      if (domains.length === 0) return { result: 'fail', evidence: 'No Authoritative accepted domains found', recommendation: 'Configure Authoritative accepted domains.' };
      const disabled = domains.filter((d: any) => d.DirectoryBasedEdgeBlockingEnabled === false || d.DirectoryBasedEdgeBlockingEnabled === 'False');
      if (disabled.length === 0) return { result: 'pass', evidence: `DBEB enabled for all ${domains.length} Authoritative domain(s)`, details: { count: domains.length } };
      return { result: 'fail', evidence: `DBEB disabled for ${disabled.length} of ${domains.length} Authoritative domain(s)`, recommendation: 'Enable DBEB for all Authoritative accepted domains.' };
    }
  },
  {
    id: 'email-rbac-02',
    area: 'Permissions & RBAC',
    title: 'Exchange Administrator role assigned to at least one approved user or group',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Check if the Exchange Administrator role is assigned to at least one user or group.',
    evaluate: (data) => {
      const rawRoles = data['graph-directory-roles'];
      const roles: any[] = Array.isArray(rawRoles) ? rawRoles : Array.isArray(rawRoles?.value) ? rawRoles.value : [];
      const role = roles.find((r: any) => r.displayName === 'Exchange Administrator' || r.displayName === 'Exchange Service Administrator');
      if (!role) return { result: 'fail', evidence: 'Exchange Administrator role not found', recommendation: 'Ensure Exchange Administrator role exists in the directory.' };
      const members = role.members || [];
      if (members.length > 0) return { result: 'pass', evidence: `Exchange Administrator role assigned to ${members.length} member(s)`, details: { count: members.length } };
      return { result: 'fail', evidence: 'Exchange Administrator role has no members', recommendation: 'Assign at least one approved user or group to the Exchange Administrator role.' };
    }
  },
  // ==================== SMTP AUTH ====================
  {
    id: 'email-smtp-01',
    area: 'SMTP AUTH',
    title: 'SMTP AUTH disabled globally',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if SmtpClientAuthenticationDisabled = True at the tenant level. Optionally report any mailbox-level SMTP AUTH exceptions for review. Fail if SMTP AUTH is enabled globally.',
    evaluate: (data) => {
      const tc = data['transport-config'];
      if (tc && (tc.SmtpClientAuthenticationDisabled === true || tc.SmtpClientAuthenticationDisabled === 'True')) return { result: 'pass', evidence: 'SMTP AUTH is disabled globally', details: { smtpClientAuthenticationDisabled: tc.SmtpClientAuthenticationDisabled } };
      return { result: 'fail', evidence: 'SMTP AUTH is enabled globally', recommendation: 'Disable SMTP AUTH at the tenant level.' };
    }
  },
  // ==================== POP AND IMAP ====================
  {
    id: 'email-pop-01',
    area: 'POP and IMAP',
    title: 'POP and IMAP disabled',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'Pass if PopEnabled = False and ImapEnabled = False for all applicable Exchange Online mailboxes. Fail if either protocol is enabled for any applicable mailbox.',
    evaluate: (data) => {
      const m = data['exo-cas-mailbox'] || [];
      const pop = m.filter((x: any) => x.PopEnabled === true || x.PopEnabled === 'True');
      const imap = m.filter((x: any) => x.ImapEnabled === true || x.ImapEnabled === 'True');
      if (pop.length === 0 && imap.length === 0) return { result: 'pass', evidence: `POP and IMAP disabled for all ${m.length} mailbox(ies)`, details: { total: m.length } };
      const issues: string[] = [];
      if (pop.length > 0) issues.push(`${pop.length} mailbox(ies) have POP enabled`);
      if (imap.length > 0) issues.push(`${imap.length} mailbox(ies) have IMAP enabled`);
      return { result: 'fail', evidence: issues.join('; '), recommendation: 'Disable POP and IMAP for all Exchange Online mailboxes.' };
    }
  },
  // ==================== CONNECTORS ====================
  {
    id: 'email-conn-01',
    area: 'Connectors',
    title: 'Inbound connectors require TLS encryption',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'PASS: Every enabled inbound connector has RequireTLS = True. FAIL: One or more enabled inbound connectors have RequireTLS = False.',
    evaluate: (data) => {
      const c = (data['inbound-connector'] || []).filter(enabled);
      if (c.length === 0) return { result: 'pass', evidence: 'No enabled inbound connectors found', details: { count: 0 } };
      const nonTls = c.filter((x: any) => x.RequireTLS === false || x.RequireTLS === 'False');
      if (nonTls.length === 0) return { result: 'pass', evidence: `All ${c.length} enabled inbound connector(s) require TLS`, details: { count: c.length } };
      return { result: 'fail', evidence: `${nonTls.length} enabled inbound connector(s) do not require TLS`, recommendation: 'Enable RequireTLS for all inbound connectors.' };
    }
  },
  {
    id: 'email-conn-02',
    area: 'Connectors',
    title: 'Outbound connectors require TLS encryption',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'PASS: Every enabled outbound connector has RequireTLS = True. FAIL: One or more enabled outbound connectors have RequireTLS = False.',
    evaluate: (data) => {
      const c = (data['outbound-connector'] || []).filter(enabled);
      if (c.length === 0) return { result: 'pass', evidence: 'No enabled outbound connectors found', details: { count: 0 } };
      const nonTls = c.filter((x: any) => x.RequireTLS === false || x.RequireTLS === 'False');
      if (nonTls.length === 0) return { result: 'pass', evidence: `All ${c.length} enabled outbound connector(s) require TLS`, details: { count: c.length } };
      return { result: 'fail', evidence: `${nonTls.length} enabled outbound connector(s) do not require TLS`, recommendation: 'Enable RequireTLS for all outbound connectors.' };
    }
  },
  {
    id: 'email-conn-03',
    area: 'Connectors',
    title: 'Inbound connectors restricted to trusted IP addresses or certificates',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'PASS: Every enabled inbound connector is restricted by at least one trusted authentication method (trusted IP addresses and/or trusted TLS certificate). FAIL: One or more enabled inbound connectors do not use trusted IP address or certificate restrictions.',
    evaluate: (data) => {
      const c = (data['inbound-connector'] || []).filter(enabled);
      if (c.length === 0) return { result: 'pass', evidence: 'No enabled inbound connectors found', details: { count: 0 } };
      const restricted = c.filter((x: any) => x.TlsCertificate || (x.IpAddresses && Array.isArray(x.IpAddresses) && x.IpAddresses.length > 0));
      if (restricted.length === c.length) return { result: 'pass', evidence: `All ${c.length} enabled inbound connector(s) restricted to trusted IPs/certificates`, details: { count: c.length } };
      return { result: 'fail', evidence: `${c.length - restricted.length} enabled inbound connector(s) not restricted`, recommendation: 'Restrict inbound connectors to trusted IP addresses or TLS certificates.' };
    }
  },
  {
    id: 'email-conn-04',
    area: 'Connectors',
    title: 'Partner connectors validate sender certificates or domains',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'PASS: Every enabled Partner inbound connector validates the sending organization using a trusted TLS certificate and/or configured sender domains. FAIL: One or more enabled Partner inbound connectors do not validate sender certificates or configured domains.',
    evaluate: (data) => {
      const c = (data['inbound-connector'] || []).filter(enabled);
      if (c.length === 0) return { result: 'pass', evidence: 'No enabled inbound connectors found', details: { count: 0 } };
      const partner = c.filter((x: any) => x.ConnectorType === 'Partner' || x.ConnectorType === 2);
      if (partner.length === 0) return { result: 'pass', evidence: 'No partner inbound connectors found', details: { count: 0 } };
      const validated = partner.filter((x: any) => x.TlsCertificate || (x.SenderDomains && x.SenderDomains.length > 0));
      if (validated.length === partner.length) return { result: 'pass', evidence: `All ${partner.length} partner connector(s) validate sender certificates/domains`, details: { count: partner.length } };
      return { result: 'fail', evidence: `${partner.length - validated.length} of ${partner.length} partner connector(s) do not validate sender certificates/domains`, recommendation: 'Configure partner connectors to validate sender certificates or sender domains.' };
    }
  },
  {
    id: 'email-conn-05',
    area: 'Connectors',
    title: 'SMTP relay connectors require authenticated and encrypted mail flow',
    controlType: 'pass/fail',
    scope: 'detailed',
    validationRule: 'PASS: Every enabled SMTP relay connector requires TLS and authenticates trusted sending systems using IP restrictions and/or TLS certificates. FAIL: One or more enabled SMTP relay connectors do not require TLS or lack trusted authentication restrictions.',
    evaluate: (data) => {
      const c = (data['inbound-connector'] || []).filter(enabled);
      if (c.length === 0) return { result: 'pass', evidence: 'No enabled inbound connectors found', details: { count: 0 } };
      const relay = c.filter((x: any) => x.ConnectorType === 'SmtpRelay' || x.ConnectorType === 3);
      if (relay.length === 0) return { result: 'pass', evidence: 'No SMTP relay connectors found', details: { count: 0 } };
      const ok = relay.filter((x: any) => (x.RequireTLS === true || x.RequireTLS === 'True') && (x.TlsCertificate || (x.IpAddresses && x.IpAddresses.length > 0)));
      if (ok.length === relay.length) return { result: 'pass', evidence: `All ${relay.length} SMTP relay connector(s) require TLS and authentication`, details: { count: relay.length } };
      return { result: 'fail', evidence: `${relay.length - ok.length} of ${relay.length} SMTP relay connector(s) missing TLS or auth restrictions`, recommendation: 'Configure SMTP relay connectors to require TLS and authenticate by IP/certificates.' };
    }
  },
  // ==================== TRANSPORT RULES ====================
  {
    id: 'email-tr-01',
    area: 'Transport Rules',
    title: 'Transport rules enabled where configured',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'PASS: At least one of the configured transport rules is enabled and operating in Enforce mode. FAIL: None of the configured transport rules are enabled or operating only in Test mode.',
    evaluate: (data) => {
      const rules = data['transport-rule'] || [];
      const enforced = rules.filter((r: any) => r.State === 'Enabled' && (r.Mode === 'Enforce' || r.Mode === 'Enforced'));
      if (enforced.length > 0) return { result: 'pass', evidence: `${enforced.length} transport rule(s) are enabled and in Enforce mode`, details: { enforced: enforced.length, total: rules.length } };
      const enabledRules = rules.filter((r: any) => r.State === 'Enabled');
      if (enabledRules.length > 0) return { result: 'fail', evidence: `${enabledRules.length} transport rule(s) are enabled but not in Enforce mode`, recommendation: 'Set transport rules to Enforce mode.' };
      return { result: 'fail', evidence: 'No enabled transport rules found', recommendation: 'Create and enable transport rules in Enforce mode.' };
    }
  },
  {
    id: 'email-tr-02',
    area: 'Transport Rules',
    title: 'Transport rules prevent automatic forwarding to external recipients',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'PASS: At least one enabled transport rule blocks or rejects automatic forwarding to external recipients. FAIL: No enabled transport rule exists to prevent automatic forwarding.',
    evaluate: (data) => {
      const rules = (data['transport-rule'] || []).filter((r: any) => r.State === 'Enabled');
      const blocking = rules.filter((r: any) => {
        const c = JSON.stringify(r.Conditions || {}).toLowerCase();
        const a = JSON.stringify(r.Actions || {}).toLowerCase();
        return c.includes('forward') || c.includes('redirect') || c.includes('external') || a.includes('reject') || a.includes('delete') || a.includes('block');
      });
      if (blocking.length > 0) return { result: 'pass', evidence: `${blocking.length} transport rule(s) block/restrict automatic forwarding`, details: { count: blocking.length } };
      return { result: 'fail', evidence: 'No transport rules block automatic forwarding to external recipients', recommendation: 'Create a transport rule to block or restrict automatic forwarding to external recipients.' };
    }
  },
  {
    id: 'email-tr-03',
    area: 'Transport Rules',
    title: 'Transport rules prepend warning banners for external emails',
    controlType: 'pass/fail',
    scope: 'both',
    validationRule: 'PASS: At least one enabled transport rule prepends a warning banner/disclaimer for external senders. FAIL: No transport rules add external sender warning banners.',
    evaluate: (data) => {
      const rules = (data['transport-rule'] || []).filter((r: any) => r.State === 'Enabled');
      const banners = rules.filter((r: any) => {
        const a = JSON.stringify(r.Actions || {}).toLowerCase();
        const n = (r.Name || '').toLowerCase();
        return a.includes('prepend') || a.includes('disclaimer') || a.includes('banner') || n.includes('external') || n.includes('warning');
      });
      if (banners.length > 0) return { result: 'pass', evidence: `${banners.length} transport rule(s) add external sender warning banners`, details: { count: banners.length } };
      return { result: 'fail', evidence: 'No transport rules add external sender warning banners', recommendation: 'Create a transport rule to prepend a warning banner for external emails.' };
    }
  },
  {
    id: 'email-tr-04',
    area: 'Transport Rules',
    title: 'List of all transport rules present',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const rules = data['transport-rule'] || [];
      return { result: 'info', evidence: `Total transport rules: ${rules.length}`, details: { count: rules.length, names: rules.map((r: any) => r.Name).filter(Boolean) } };
    }
  },
  // ==================== COMMON METRICS (INFORMATIONAL) ====================
  {
    id: 'email-cm-01',
    area: 'Common Metrics',
    title: 'Total number of mailboxes',
    controlType: 'informational',
    scope: 'both',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['exo-mailbox'] || []).length;
      return { result: 'info', evidence: `Total mailboxes: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-02',
    area: 'Common Metrics',
    title: 'User mailboxes',
    controlType: 'informational',
    scope: 'both',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['exo-mailbox'] || []).filter((m: any) => m.RecipientTypeDetails === 'UserMailbox').length;
      return { result: 'info', evidence: `User mailboxes: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-03',
    area: 'Common Metrics',
    title: 'Shared mailboxes',
    controlType: 'informational',
    scope: 'both',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['exo-mailbox'] || []).filter((m: any) => m.RecipientTypeDetails === 'SharedMailbox').length;
      return { result: 'info', evidence: `Shared mailboxes: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-04',
    area: 'Common Metrics',
    title: 'Distribution lists',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['distribution-group'] || []).length;
      return { result: 'info', evidence: `Distribution lists: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-05',
    area: 'Common Metrics',
    title: 'Dynamic distribution lists',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['dynamic-distribution-group'] || []).length;
      return { result: 'info', evidence: `Dynamic distribution lists: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-06',
    area: 'Common Metrics',
    title: 'Microsoft 365 Groups',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['unified-group'] || []).length;
      return { result: 'info', evidence: `Microsoft 365 Groups: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-07',
    area: 'Common Metrics',
    title: 'Mail-enabled security groups',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['distribution-group'] || []).filter((g: any) => g.GroupType === 'MailEnabledSecurity').length;
      return { result: 'info', evidence: `Mail-enabled security groups: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-08',
    area: 'Common Metrics',
    title: 'Resource mailboxes',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['exo-mailbox'] || []).filter((m: any) => m.RecipientTypeDetails === 'RoomMailbox' || m.RecipientTypeDetails === 'EquipmentMailbox').length;
      return { result: 'info', evidence: `Resource mailboxes: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-09',
    area: 'Common Metrics',
    title: 'Total number of alerts',
    controlType: 'informational',
    scope: 'both',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['graph-security-alerts'] || []).length;
      return { result: 'info', evidence: `Total alerts: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-10',
    area: 'Common Metrics',
    title: 'Open/Resolved/In-progress alerts',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const alerts = data['graph-security-alerts'] || [];
      const statuses = alerts.reduce((acc: any, a: any) => {
        const s = (a.status || a.Status || 'unknown').toLowerCase();
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});
      return { result: 'info', evidence: `Alerts by status: ${JSON.stringify(statuses)}`, details: statuses };
    }
  },
  {
    id: 'email-cm-11',
    area: 'Common Metrics',
    title: 'Total number of incidents',
    controlType: 'informational',
    scope: 'both',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['graph-security-incidents'] || []).length;
      return { result: 'info', evidence: `Total incidents: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-12',
    area: 'Common Metrics',
    title: 'Open/Resolved/In-progress incidents',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const incidents = data['graph-security-incidents'] || [];
      const statuses = incidents.reduce((acc: any, i: any) => {
        const s = (i.status || i.Status || 'unknown').toLowerCase();
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});
      return { result: 'info', evidence: `Incidents by status: ${JSON.stringify(statuses)}`, details: statuses };
    }
  },
  {
    id: 'email-cm-13',
    area: 'Common Metrics',
    title: 'Tenant Allow/Block List items',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const count = (data['tenant-allow-block-list-items'] || []).length;
      return { result: 'info', evidence: `Tenant Allow/Block List items: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-14',
    area: 'Common Metrics',
    title: 'Tenant Allow/Block List - URLs',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const items = (data['tenant-allow-block-list-urls'] || []).filter(
        (it: any) => (it?.ListType || 'Url') === 'Url'
      );
      const count = items.length;
      return { result: 'info', evidence: `Tenant Allow/Block List URLs: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-15',
    area: 'Common Metrics',
    title: 'Tenant Allow/Block List - Senders',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const items = (data['tenant-allow-block-list-senders'] || []).filter(
        (it: any) => (it?.ListType || 'Sender') === 'Sender'
      );
      const count = items.length;
      return { result: 'info', evidence: `Tenant Allow/Block List Senders: ${count}`, details: { count } };
    }
  },
  {
    id: 'email-cm-17',
    area: 'Common Metrics',
    title: 'Tenant Allow/Block List - File hashes',
    controlType: 'informational',
    scope: 'detailed',
    validationRule: 'NA - informational only',
    evaluate: (data) => {
      const items = (data['tenant-allow-block-list-filehashes'] || []).filter(
        (it: any) => (it?.ListType || 'FileHash') === 'FileHash'
      );
      const count = items.length;
      return { result: 'info', evidence: `Tenant Allow/Block List File hashes: ${count}`, details: { count } };
    }
  },
];




