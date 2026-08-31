export const SCORING_CONFIG = {
  statusWeights: {
    PASS: 1,
    PARTIAL: 0.5,
    FAIL: 0,
  } as Record<string, number>,

  severityWeights: {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  } as Record<string, number>,

  ratingThresholds: [
    { min: 90, max: 100, rating: 'Excellent', color: 'green' },
    { min: 80, max: 89, rating: 'Good', color: 'blue' },
    { min: 70, max: 79, rating: 'Moderate', color: 'yellow' },
    { min: 50, max: 69, rating: 'Needs Improvement', color: 'orange' },
    { min: 0, max: 49, rating: 'Critical', color: 'red' },
  ],

  maxRecommendations: 10,
};

export const CONTROL_RECOMMENDATION_MAP: Record<string, { title: string; description: string; remediation: string }> = {
  'Anti-phishing policy exists and enabled': {
    title: 'Enable anti-phishing policy',
    description: 'At least one anti-phishing policy is missing or disabled.',
    remediation: 'Create and enable an anti-phishing policy in the Microsoft 365 Defender portal.',
  },
  'All users are covered by at least one enabled MDO Anti-Phishing policy': {
    title: 'Expand anti-phishing policy coverage',
    description: 'Not all users are covered by an enabled anti-phishing policy.',
    remediation: 'Assign the anti-phishing policy to all users, groups, or domains.',
  },
  'Inbound anti-spam policy exists and enabled': {
    title: 'Enable inbound anti-spam policy',
    description: 'No enabled inbound anti-spam policy is assigned.',
    remediation: 'Create or enable an inbound anti-spam policy and assign it to users.',
  },
  'All users are covered by at least one enabled inbound Anti-Spam policy': {
    title: 'Expand anti-spam coverage',
    description: 'Not all users are covered by an enabled inbound anti-spam policy.',
    remediation: 'Assign the inbound anti-spam policy to all intended recipients.',
  },
  'Outbound spam policy exists and enabled': {
    title: 'Enable outbound spam policy',
    description: 'No enabled outbound anti-spam policy is configured.',
    remediation: 'Create and enable an outbound anti-spam policy.',
  },
  'Anti-malware policy exists and enabled': {
    title: 'Enable anti-malware policy',
    description: 'No enabled anti-malware policy is assigned.',
    remediation: 'Create or enable an anti-malware policy and assign it to users.',
  },
  'All users are assigned at least one Anti-Malware policy': {
    title: 'Expand anti-malware coverage',
    description: 'Not all users are covered by an enabled anti-malware policy.',
    remediation: 'Assign the anti-malware policy to all intended recipients.',
  },
  'Safe Links policy exists and enabled': {
    title: 'Enable Safe Links policy',
    description: 'No enabled Safe Links policy is assigned.',
    remediation: 'Create or enable a Safe Links policy in Defender for Office 365.',
  },
  'All applicable users are covered by at least one enabled Safe Links policy': {
    title: 'Expand Safe Links coverage',
    description: 'Not all users are covered by an enabled Safe Links policy.',
    remediation: 'Assign the Safe Links policy to all intended recipients.',
  },
  'Safe Attachments policy exists and enabled': {
    title: 'Enable Safe Attachments policy',
    description: 'No enabled Safe Attachments policy is assigned.',
    remediation: 'Create or enable a Safe Attachments policy in Defender for Office 365.',
  },
  'All applicable users are covered by at least one enabled Safe Attachments policy': {
    title: 'Expand Safe Attachments coverage',
    description: 'Not all users are covered by an enabled Safe Attachments policy.',
    remediation: 'Assign the Safe Attachments policy to all intended recipients.',
  },
  'Directory Based Edge Blocking (DBEB) enabled for accepted domains': {
    title: 'Enable Directory Based Edge Blocking',
    description: 'DBEB is not enabled for all authoritative accepted domains.',
    remediation: 'Enable Directory Based Edge Blocking for each authoritative accepted domain.',
  },
  'Exchange Administrator role is assigned only to approved users and groups': {
    title: 'Review Exchange Administrator role membership',
    description: 'The Exchange Administrator role may have unapproved members.',
    remediation: 'Review and restrict Exchange Administrator role assignments to approved identities.',
  },
  'SMTP AUTH disabled globally': {
    title: 'Disable SMTP AUTH globally',
    description: 'SMTP AUTH is still enabled at the tenant level.',
    remediation: 'Disable SMTP AUTH globally in Exchange Online to block legacy authentication.',
  },
  'POP and IMAP disabled': {
    title: 'Disable POP and IMAP access',
    description: 'POP or IMAP is enabled for applicable mailboxes.',
    remediation: 'Disable POP and IMAP access for mailboxes unless explicitly required.',
  },
  'Inbound connectors require TLS encryption': {
    title: 'Require TLS for inbound connectors',
    description: 'One or more enabled inbound connectors do not require TLS.',
    remediation: 'Update inbound connectors to require TLS encryption.',
  },
  'Outbound connectors require TLS encryption': {
    title: 'Require TLS for outbound connectors',
    description: 'One or more enabled outbound connectors do not require TLS.',
    remediation: 'Update outbound connectors to require TLS encryption.',
  },
  'Transport rules are enabled where configured': {
    title: 'Enable transport rules',
    description: 'No transport rule is enabled and in Enforce mode.',
    remediation: 'Enable required transport rules and set them to Enforce mode.',
  },
  'Transport rules prevent automatic forwarding to external recipients': {
    title: 'Block automatic external forwarding',
    description: 'No transport rule blocks automatic forwarding to external recipients.',
    remediation: 'Create or enable a transport rule that blocks automatic forwarding to external recipients.',
  },
  'Transport rules prepend warning banners for external emails': {
    title: 'Add external email warning banners',
    description: 'No transport rule prepends a warning banner for external senders.',
    remediation: 'Create or enable a transport rule that prepends a disclaimer/warning for external email.',
  },
  'MFA enforcement policy exists and enabled': {
    title: 'Enable MFA enforcement',
    description: 'MFA is not enforced for users.',
    remediation: 'Configure Conditional Access or per-user MFA to require MFA for all users.',
  },
  'Conditional Access policy exists and enabled': {
    title: 'Enable Conditional Access policies',
    description: 'No Conditional Access policy is enabled.',
    remediation: 'Create and enable Conditional Access policies for privileged and standard user access.',
  },
  'Legacy authentication disabled': {
    title: 'Block legacy authentication',
    description: 'Legacy authentication protocols are still allowed.',
    remediation: 'Block legacy authentication protocols via Conditional Access or tenant settings.',
  },
  'Password protection enabled': {
    title: 'Enable password protection',
    description: 'Password protection or smart lockout is not enabled.',
    remediation: 'Enable password protection and smart lockout policies.',
  },
  'Guest users review and restriction': {
    title: 'Review guest user access',
    description: 'Guest user access may be overly permissive.',
    remediation: 'Review and restrict guest user permissions to the minimum required.',
  },
  'Privileged access review': {
    title: 'Review privileged access',
    description: 'Excessive privileged access was detected.',
    remediation: 'Review privileged roles and apply least-privilege access. Remove unnecessary permanent admin privileges.',
  },
};

export function getRecommendationForControl(controlName: string): { title: string; description: string; remediation: string } | undefined {
  return CONTROL_RECOMMENDATION_MAP[controlName];
}
