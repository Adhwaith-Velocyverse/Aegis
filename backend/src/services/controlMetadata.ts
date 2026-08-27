export type ControlSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type ControlResult = 'pass' | 'fail' | 'not_applicable' | 'needs_manual_review' | 'informational' | 'partial';
export type ControlScore = number | 'NA';

export interface ControlRecommendation {
  pass: string;
  fail: string;
}

const CONTROL_RULE_MAP: Record<string, string> = {
  'entra-authmfa-mfa-enforced-for-all-users': 'IS_001',
  'entra-authmfa-mfa-enforced-for-privileged-users': 'IS_002',
  'entra-authmfa-legacy-authentication-blocked': 'IS_003',
  'entra-authmfa-microsoft-authenticator-enabled': 'IS_004',
  'entra-authmfa-fido2-security-keys-enabled': 'IS_005',
  'entra-authmfa-passkeys-enabled': 'IS_006',
  'entra-authmfa-temporary-access-pass-enabled': 'IS_007',
  'entra-authmfa-sms-authentication-disabled': 'IS_008',
  'entra-authmfa-voice-call-authentication-disabled': 'IS_009',
  'entra-authmfa-sspr-enabled': 'IS_010',
  'entra-authmfa-smart-lockout-configured': 'IS_011',
  'entra-conditionalaccess-ca-policies-configured': 'IS_012',
  'entra-conditionalaccess-ca-requires-mfa-for-admins': 'IS_013',
  'entra-conditionalaccess-ca-for-high-risk-sign-ins': 'IS_014',
  'entra-conditionalaccess-high-user-risk-requires-password-reset': 'IS_015',
  'entra-conditionalaccess-named-locations-configured': 'IS_016',
  'entra-conditionalaccess-access-from-high-risk-locations-blocked': 'IS_017',
  'entra-conditionalaccess-sign-in-frequency-configured': 'IS_018',
  'entra-conditionalaccess-token-protection-enabled': 'IS_019',
  'entra-pim-pim-enabled': 'IS_020',
  'entra-pim-jit-activation-configured': 'IS_021',
  'entra-pim-pim-activation-requires-mfa': 'IS_022',
  'entra-privilegedaccess-global-admin-count-within-limit': 'IS_023',
  'entra-accessreviews-guest-access-review-configured': 'IS_024',
  'entra-privilegedaccess-guest-accounts-least-privilege': 'IS_025',
  'entra-privilegedaccess-cloud-native-admin-accounts': 'IS_026',
  'entra-accessreviews-privileged-role-access-review-configured': 'IS_027',
  'entra-accessreviews-access-reviews-have-recurring-schedule': 'IS_028',
  'entra-accessreviews-access-reviews-have-reminder-notifications': 'IS_029',
  'entra-accessreviews-non-responders-auto-handled': 'IS_030',
  'entra-monitoring-sign-in-logs-available': 'IS_031',
  'entra-monitoring-directory-audit-logs-available': 'IS_032',
  'entra-monitoring-provisioning-logs-available': 'IS_033',
  'entra-monitoring-identity-protection-available': 'IS_034',
  'info-total-users': 'IS_035',
  'info-member-users': 'IS_036',
  'info-guest-users': 'IS_037',
  'info-m365-groups': 'IS_038',
  'info-dynamic-groups': 'IS_039',
  'info-device-groups': 'IS_040',
  'info-licensed-users': 'IS_041',
  'info-unlicensed-users': 'IS_042',
  'info-active-users': 'IS_043',
  'info-inactive-users': 'IS_044',
  'info-licensed-inactive-users': 'IS_045',
  'info-administrative-units': 'IS_046',
  'info-risky-users': 'IS_047',
  'info-risky-signins': 'IS_048',
  'info-privileged-admins': 'IS_049',
  'info-admin-roles-users': 'IS_050',
  'info-ca-policies': 'IS_051',
  'info-mfa-protected': 'IS_052',
  'info-mfa-unprotected': 'IS_053',
  'info-privileged-no-mfa': 'IS_054',
  'info-app-registrations': 'IS_055',
  'info-enterprise-apps': 'IS_056',
  'info-enterprise-apps-sso': 'IS_057',
  'info-app-credentials-expiring': 'IS_058',
  'info-ca-policies-list': 'IS_059',
  'info-auth-methods': 'IS_060',
  'info-secure-score': 'IS_061',
};

const SEVERITY_MAP: Record<string, ControlSeverity> = {
  IS_001: 'critical',
  IS_002: 'critical',
  IS_003: 'critical',
  IS_004: 'high',
  IS_005: 'medium',
  IS_006: 'medium',
  IS_007: 'low',
  IS_008: 'high',
  IS_009: 'high',
  IS_010: 'medium',
  IS_011: 'high',
  IS_012: 'critical',
  IS_013: 'high',
  IS_014: 'high',
  IS_015: 'high',
  IS_016: 'medium',
  IS_017: 'high',
  IS_018: 'medium',
  IS_019: 'high',
  IS_020: 'critical',
  IS_021: 'high',
  IS_022: 'high',
  IS_023: 'high',
  IS_024: 'critical',
  IS_025: 'high',
  IS_026: 'high',
  IS_027: 'high',
  IS_028: 'high',
  IS_029: 'critical',
  IS_030: 'medium',
  IS_031: 'high',
  IS_032: 'high',
  IS_033: 'medium',
  IS_034: 'high',
  IS_035: 'informational',
  IS_036: 'informational',
  IS_037: 'informational',
  IS_038: 'informational',
  IS_039: 'informational',
  IS_040: 'informational',
  IS_041: 'informational',
  IS_042: 'informational',
  IS_043: 'informational',
  IS_044: 'informational',
  IS_045: 'informational',
  IS_046: 'informational',
  IS_047: 'informational',
  IS_048: 'informational',
  IS_049: 'informational',
  IS_050: 'informational',
  IS_051: 'informational',
  IS_052: 'informational',
  IS_053: 'informational',
  IS_054: 'informational',
  IS_055: 'informational',
  IS_056: 'informational',
  IS_057: 'informational',
  IS_058: 'informational',
  IS_059: 'informational',
  IS_060: 'informational',
  IS_061: 'informational',
};

const SCORE_MATRIX: Record<ControlSeverity, Record<string, ControlScore>> = {
  critical: { pass: 10, fail: 0, partial: 1, needs_manual_review: 1, not_applicable: 'NA', informational: 'NA' },
  high: { pass: 10, fail: 0, partial: 3, needs_manual_review: 3, not_applicable: 'NA', informational: 'NA' },
  medium: { pass: 10, fail: 0, partial: 5, needs_manual_review: 5, not_applicable: 'NA', informational: 'NA' },
  low: { pass: 10, fail: 0, partial: 7, needs_manual_review: 7, not_applicable: 'NA', informational: 'NA' },
  informational: { pass: 'NA', fail: 'NA', partial: 'NA', needs_manual_review: 'NA', not_applicable: 'NA', informational: 'NA' },
};

const RECOMMENDATIONS_MAP: Record<string, ControlRecommendation> = {
  IS_001: {
    pass: 'No action required. Continue monitoring MFA coverage.',
    fail: 'Enable MFA for all users through Security Defaults or Conditional Access.',
  },
  IS_002: {
    pass: 'No action required. Continue reviewing privileged accounts.',
    fail: 'Require MFA for all privileged accounts immediately.',
  },
  IS_003: {
    pass: 'No action required. Continue monitoring legacy protocols.',
    fail: 'Block legacy authentication using Conditional Access policies.',
  },
  IS_004: {
    pass: 'No action required. Continue promoting secure authentication.',
    fail: 'Enable Microsoft Authenticator as a primary authentication method.',
  },
  IS_005: {
    pass: 'No action required. Continue supporting phishing-resistant authentication.',
    fail: 'Enable FIDO2 Security Keys in Authentication Methods.',
  },
  IS_006: {
    pass: 'No action required. Continue monitoring adoption.',
    fail: 'Enable Passkeys (FIDO2) authentication.',
  },
  IS_007: {
    pass: 'No action required. Review Temporary Access Pass usage periodically.',
    fail: 'Enable Temporary Access Pass for secure onboarding and recovery.',
  },
  IS_008: {
    pass: 'No action required. Continue enforcing stronger authentication methods.',
    fail: 'Disable SMS authentication unless required by business.',
  },
  IS_009: {
    pass: 'No action required. Continue using stronger authentication methods.',
    fail: 'Disable voice call authentication where possible.',
  },
  IS_010: {
    pass: 'No action required. Continue monitoring SSPR registrations.',
    fail: 'Enable Self-Service Password Reset.',
  },
  IS_011: {
    pass: 'No action required. Review lockout thresholds periodically.',
    fail: 'Configure Smart Lockout with recommended settings.',
  },
  IS_012: {
    pass: 'No action required. Continue reviewing policies.',
    fail: 'Configure Conditional Access policies based on organizational requirements.',
  },
  IS_013: {
    pass: 'No action required. Continue validating administrator access.',
    fail: 'Configure Conditional Access to require MFA for administrators.',
  },
  IS_014: {
    pass: 'No action required. Continue monitoring Identity Protection.',
    fail: 'Configure Conditional Access to require MFA for risky sign-ins.',
  },
  IS_015: {
    pass: 'No action required. Continue monitoring user risk.',
    fail: 'Configure Identity Protection user-risk policies.',
  },
  IS_016: {
    pass: 'No action required. Review trusted locations periodically.',
    fail: 'Configure Named Locations for Conditional Access.',
  },
  IS_017: {
    pass: 'No action required. Continue monitoring location policies.',
    fail: 'Configure Conditional Access to block risky locations.',
  },
  IS_018: {
    pass: 'No action required. Review session policies periodically.',
    fail: 'Configure sign-in frequency session controls.',
  },
  IS_019: {
    pass: 'No action required. Continue protecting access tokens.',
    fail: 'Enable Token Protection for supported workloads.',
  },
  IS_020: {
    pass: 'No action required. Continue reviewing eligible assignments.',
    fail: 'Enable Microsoft Entra Privileged Identity Management.',
  },
  IS_021: {
    pass: 'No action required. Continue auditing activations.',
    fail: 'Configure Just-In-Time activation using PIM.',
  },
  IS_022: {
    pass: 'No action required. Continue enforcing secure activation.',
    fail: 'Require MFA for PIM activation.',
  },
  IS_023: {
    pass: 'No action required. Continue reviewing administrator roles.',
    fail: 'Reduce the number of Global Administrators to the minimum required.',
  },
  IS_024: {
    pass: 'No action required. Continue reviewing guest access.',
    fail: 'Configure Access Reviews for guest users.',
  },
  IS_025: {
    pass: 'No action required. Continue reviewing guest permissions.',
    fail: 'Reduce guest permissions to least privilege.',
  },
  IS_026: {
    pass: 'No action required. Continue protecting emergency accounts.',
    fail: 'Create dedicated cloud-native administrator accounts.',
  },
  IS_027: {
    pass: 'No action required. Continue reviewing privileged assignments.',
    fail: 'Configure Access Reviews for privileged roles.',
  },
  IS_028: {
    pass: 'No action required. Continue recurring reviews.',
    fail: 'Configure recurring Access Reviews.',
  },
  IS_029: {
    pass: 'No action required. Continue notifying reviewers.',
    fail: 'Enable reminder notifications for Access Reviews.',
  },
  IS_030: {
    pass: 'No action required. Continue reviewing review outcomes.',
    fail: 'Configure automatic actions for non-responders.',
  },
  IS_031: {
    pass: 'No action required. Continue monitoring sign-in logs.',
    fail: 'Enable sign-in log retention and monitoring.',
  },
  IS_032: {
    pass: 'No action required. Continue reviewing audit logs.',
    fail: 'Enable directory audit logging.',
  },
  IS_033: {
    pass: 'No action required. Continue monitoring provisioning events.',
    fail: 'Enable provisioning logs.',
  },
  IS_034: {
    pass: 'No action required. Continue monitoring Identity Protection.',
    fail: 'Enable Microsoft Entra Identity Protection.',
  },
};

export function getRuleIdForControl(controlId: string): string | undefined {
  return CONTROL_RULE_MAP[controlId];
}

export function getSeverityForControl(controlId: string): ControlSeverity {
  const ruleId = CONTROL_RULE_MAP[controlId];
  if (!ruleId) return 'medium';
  return SEVERITY_MAP[ruleId] || 'medium';
}

export function getSeverityForRuleId(ruleId: string): ControlSeverity {
  return SEVERITY_MAP[ruleId] || 'medium';
}

export function calculateControlScore(severity: ControlSeverity, result: ControlResult): ControlScore {
  const severityKey = severity as keyof typeof SCORE_MATRIX;
  const resultKey = result as string;
  const score = SCORE_MATRIX[severityKey]?.[resultKey];
  return score !== undefined ? score : 'NA';
}

export function getRecommendationForControl(controlId: string, result: ControlResult): string | undefined {
  const ruleId = CONTROL_RULE_MAP[controlId];
  if (!ruleId) return undefined;

  const recs = RECOMMENDATIONS_MAP[ruleId];
  if (!recs) return undefined;

  if (result === 'pass') return recs.pass;
  if (result === 'fail') return recs.fail;
  if (result === 'needs_manual_review') return recs.fail;
  return undefined;
}
