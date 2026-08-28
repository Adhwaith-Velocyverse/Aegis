import { GraphHttpClient } from '../../services/graphHttpClient';
import { getAccessTokenForTenant } from '../../services/msalAuth';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import {
  getSeverityForControl,
  calculateControlScore,
  getRecommendationForControl,
} from './controlMetadata';

export interface EntraControlDefinition {
  id: string;
  category: string;
  controlName: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  weight: number;
  automatable: boolean;
  endpoints: string[];
  quickAssessment?: boolean;
  informational?: boolean;
  quickAssessmentInformational?: boolean;
  evaluate: (data: Record<string, any>) => ControlEvaluationResult;
}

export interface ControlEvaluationResult {
  result: 'pass' | 'fail' | 'not_applicable' | 'needs_manual_review' | 'informational' | 'partial';
  evidence: string;
  recommendation: string;
  failedItems?: string[];
}

export interface EntraCollectionResult {
  controls: Record<string, ControlEvaluationResult>;
  rawData: Record<string, any>;
  errors: EntraCollectionError[];
  collectedAt: string;
  status: 'completed' | 'partial' | 'failed';
}

export interface EntraCollectionError {
  endpoint: string;
  error: string;
  statusCode?: number;
}

const ENTRA_ENDPOINTS = {
  // Existing endpoints
  AUTH_METHODS_POLICY: '/policies/authenticationMethodsPolicy',
  SECURITY_DEFAULTS: '/policies/identitySecurityDefaultsEnforcementPolicy',
  CONDITIONAL_ACCESS_POLICIES: '/identity/conditionalAccess/policies',
  NAMED_LOCATIONS: '/identity/conditionalAccess/namedLocations',
  DIRECTORY_ROLES: '/directoryRoles',
  DIRECTORY_ROLE_MEMBERS: (roleId: string) => `/directoryRoles/${roleId}/members`,
  ROLE_ELIGIBILITY_SCHEDULES: '/roleManagement/directory/roleEligibilitySchedules',
  ROLE_ASSIGNMENT_SCHEDULES: '/roleManagement/directory/roleAssignmentSchedules',
  ROLE_MANAGEMENT_POLICIES: '/policies/roleManagementPolicies',
  MFA_REGISTRATION_DETAILS: '/reports/authenticationMethods/userRegistrationDetails',
  ACCESS_REVIEWS_DEFINITIONS: '/identityGovernance/accessReviews/definitions',
  GUEST_USERS: "/users?$filter=userType eq 'Guest'",
  SIGN_IN_LOGS: '/auditLogs/signIns?$top=1',
  DIRECTORY_AUDITS: '/auditLogs/directoryAudits?$top=1',
  PROVISIONING_LOGS: '/auditLogs/provisioning?$top=1',
  RISK_DETECTIONS: '/identityProtection/riskDetections?$top=1',
  // New endpoints for informational controls
  USERS_COUNT: '/users?$count=true',
  MEMBER_USERS_COUNT: "/users?$filter=userType eq 'Member'&$count=true",
  GUEST_USERS_COUNT: "/users?$filter=userType eq 'Guest'&$count=true",
  LICENSED_USERS_COUNT: "/users?$filter=assignedLicenses/$count ne 0&$count=true",
  UNLICENSED_USERS_COUNT: "/users?$filter=assignedLicenses/$count eq 0&$count=true",
  ACTIVE_USERS_COUNT: '/users?$filter=accountEnabled eq true&$count=true',
  INACTIVE_USERS_COUNT: '/users?$filter=accountEnabled eq false&$count=true',
  M365_GROUPS_COUNT: "/groups?$filter=groupTypes/any(c:c eq 'Unified')&$count=true",
  DYNAMIC_GROUPS_COUNT: "/groups?$filter=groupTypes/any(c:c eq 'DynamicMembership')&$count=true",
  DEVICE_GROUPS_COUNT: '/groups?$filter=securityEnabled eq true and mailEnabled eq false&$count=true',
  ADMINISTRATIVE_UNITS_COUNT: '/administrativeUnits',
  RISKY_USERS_COUNT: "/identityProtection/riskDetections?$filter=riskState eq 'atRisk'&$count=true",
  RISKY_SIGNINS_COUNT: "/auditLogs/signIns?$filter=riskState eq 'atRisk'&$count=true",
  CA_POLICIES_COUNT: '/identity/conditionalAccess/policies?$count=true',
  APP_REGISTRATIONS_COUNT: '/applications?$count=true',
  ENTERPRISE_APPS_COUNT: '/servicePrincipals?$count=true',
  ENTERPRISE_APPS_SSO_COUNT: '/servicePrincipals?$filter=ssoUrl ne null',
  APPLICATIONS: '/applications',
  SERVICE_PRINCIPALS: '/servicePrincipals',
   ORGANIZATION: '/organization',
   SECURE_SCORES: '/security/secureScores?$top=1',
  USERS: '/users',
  GROUPS: '/groups',
};

function generateControlId(category: string, name: string): string {
  return `entra-${category.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

export const ENTRA_CONTROLS: EntraControlDefinition[] = [
  // ==================== AUTHENTICATION & MFA ====================
  {
    id: generateControlId('AuthMFA', 'MFA enforced for all users'),
    category: 'Authentication & MFA',
    controlName: 'MFA enforced for all users via Security Defaults or Conditional Access',
    description: 'All users are required to perform multi-factor authentication',
    severity: 'critical',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.SECURITY_DEFAULTS, ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES, ENTRA_ENDPOINTS.MFA_REGISTRATION_DETAILS, ENTRA_ENDPOINTS.MEMBER_USERS_COUNT],
    evaluate: (data) => {
      const sd = data[ENTRA_ENDPOINTS.SECURITY_DEFAULTS];
      const ca = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES];

      const sdEnabled = sd?.value?.securityDefaultsEnabled === true || sd?.value?.isEnabled === true;
      const hasMfaPolicy = ca?.value?.some((p: any) =>
        p.state === 'enabled' && p.grantControls?.builtInControls?.includes('mfa') && p.conditions?.users?.includeUsers?.includes('All')
      );

      if (sdEnabled) return { result: 'pass', evidence: 'Security Defaults enabled', recommendation: '' };
      if (hasMfaPolicy) return { result: 'pass', evidence: 'CA policy requires MFA for all users', recommendation: '' };

      // Fall back to user-level MFA registration check
      const mfaData = data[ENTRA_ENDPOINTS.MFA_REGISTRATION_DETAILS]?.value || [];
      const totalMemberUsers = data[ENTRA_ENDPOINTS.MEMBER_USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.MEMBER_USERS_COUNT]?.['@odata.count'] || mfaData.length;
      const mfaRegisteredUsers = mfaData.filter((u: any) => u.isMfaRegistered === true).length;

      if (totalMemberUsers === 0) return { result: 'fail', evidence: 'MFA not enforced for all users', recommendation: 'Enable MFA for all users through Security Defaults or Conditional Access.' };
      if (mfaRegisteredUsers === 0) return { result: 'fail', evidence: 'No users have MFA registered', recommendation: 'Enable MFA for all users through Security Defaults or Conditional Access.' };
      if (mfaRegisteredUsers < totalMemberUsers) return { result: 'partial', evidence: `${mfaRegisteredUsers} of ${totalMemberUsers} users have MFA registered`, recommendation: 'Enforce MFA for remaining users who have not registered.' };

      return { result: 'fail', evidence: 'MFA not enforced for all users', recommendation: 'Enable MFA for all users through Security Defaults or Conditional Access.' };
    },
  },
  {
    id: generateControlId('AuthMFA', 'MFA enforced for privileged users'),
    category: 'Authentication & MFA',
    controlName: 'MFA enforced for all privileged users',
    description: 'MFA is enforced for all privileged users',
    severity: 'critical',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES, ENTRA_ENDPOINTS.DIRECTORY_ROLES],
    evaluate: (data) => {
      const ca = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES];
      const roles = data[ENTRA_ENDPOINTS.DIRECTORY_ROLES]?.value || [];
      const privRoleIds = roles.filter((r: any) => r.displayName?.includes('Administrator')).map((r: any) => r.id);

      if (privRoleIds.length === 0) return { result: 'not_applicable', evidence: 'No privileged roles found', recommendation: '' };

      // Check if there's a CA policy requiring MFA for privileged roles
      const hasMfaForAdmins = ca?.value?.some((p: any) =>
        p.state === 'enabled' && p.grantControls?.builtInControls?.includes('mfa') &&
        (p.conditions?.users?.includeRoles?.length > 0 || p.conditions?.users?.includeUsers?.includes('All'))
      );

      if (hasMfaForAdmins) return { result: 'pass', evidence: 'CA policy requires MFA for privileged roles', recommendation: '' };

      return { result: 'fail', evidence: 'No CA policy requires MFA for privileged users', recommendation: 'Require MFA for all privileged accounts immediately.' };
    },
  },
  {
    id: generateControlId('AuthMFA', 'Legacy authentication blocked'),
    category: 'Authentication & MFA',
    controlName: 'Legacy authentication blocked',
    description: 'Legacy authentication is blocked through CA policies',
    severity: 'critical',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.SECURITY_DEFAULTS, ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES],
    evaluate: (data) => {
      const sd = data[ENTRA_ENDPOINTS.SECURITY_DEFAULTS];
      const ca = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES];
      const sdEnabled = sd?.value?.securityDefaultsEnabled === true || sd?.value?.isEnabled === true;
      const hasBlock = ca?.value?.some((p: any) =>
        p.state === 'enabled' && p.conditions?.clientAppTypes?.includes('exchangeActiveSync') && p.grantControls?.builtInControls?.includes('block')
      );

      if (sdEnabled) return { result: 'pass', evidence: 'Security Defaults blocks legacy auth', recommendation: '' };
      if (hasBlock) return { result: 'pass', evidence: 'CA policy blocks legacy auth', recommendation: '' };
      return { result: 'fail', evidence: 'No policy blocks legacy authentication', recommendation: 'Block legacy authentication using Conditional Access policies.' };
    },
  },
  {
    id: generateControlId('AuthMFA', 'Microsoft Authenticator enabled'),
    category: 'Authentication & MFA',
    controlName: 'Microsoft Authenticator enabled',
    description: 'Microsoft Authenticator is enabled',
    severity: 'high',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.AUTH_METHODS_POLICY],
    evaluate: (data) => {
      const config = data[ENTRA_ENDPOINTS.AUTH_METHODS_POLICY]?.value?.authenticationMethodConfigurations?.find((m: any) => m.id === 'microsoftAuthenticator');
      if (config?.state === 'enabled') return { result: 'pass', evidence: 'Microsoft Authenticator enabled', recommendation: '' };
      return { result: 'fail', evidence: 'Microsoft Authenticator not enabled', recommendation: 'Enable Microsoft Authenticator as a primary authentication method.' };
    },
  },
  {
    id: generateControlId('AuthMFA', 'FIDO2 Security Keys enabled'),
    category: 'Authentication & MFA',
    controlName: 'FIDO2 Security Keys enabled',
    description: 'FIDO2 security keys are enabled',
    severity: 'medium',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.AUTH_METHODS_POLICY],
    evaluate: (data) => {
      const config = data[ENTRA_ENDPOINTS.AUTH_METHODS_POLICY]?.value?.authenticationMethodConfigurations?.find((m: any) => m.id === 'fido2');
      if (config?.state === 'enabled') return { result: 'pass', evidence: 'FIDO2 enabled', recommendation: '' };
      return { result: 'fail', evidence: 'FIDO2 not enabled', recommendation: 'Enable FIDO2 Security Keys in Authentication Methods.' };
    },
  },
  {
    id: generateControlId('AuthMFA', 'Passkeys enabled'),
    category: 'Authentication & MFA',
    controlName: 'Passkeys FIDO2 enabled',
    description: 'Passkeys (FIDO2) are enabled',
    severity: 'medium',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.AUTH_METHODS_POLICY],
    evaluate: (data) => {
      const config = data[ENTRA_ENDPOINTS.AUTH_METHODS_POLICY]?.value?.authenticationMethodConfigurations?.find((m: any) => m.id === 'passkey' || m.id === 'fido2');
      if (config?.state === 'enabled') return { result: 'pass', evidence: 'Passkeys enabled', recommendation: '' };
      return { result: 'fail', evidence: 'Passkeys not enabled', recommendation: 'Enable Passkeys (FIDO2) authentication.' };
    },
  },
  {
    id: generateControlId('AuthMFA', 'Temporary Access Pass enabled'),
    category: 'Authentication & MFA',
    controlName: 'Temporary Access Pass enabled',
    description: 'TAP is enabled',
    severity: 'low',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.AUTH_METHODS_POLICY],
    evaluate: (data) => {
      const config = data[ENTRA_ENDPOINTS.AUTH_METHODS_POLICY]?.value?.authenticationMethodConfigurations?.find((m: any) => m.id === 'temporaryAccessPass');
      if (config?.state === 'enabled') return { result: 'pass', evidence: 'TAP enabled', recommendation: '' };
      return { result: 'fail', evidence: 'TAP not enabled', recommendation: 'Enable Temporary Access Pass for secure onboarding and recovery.' };
    },
  },
  {
    id: generateControlId('AuthMFA', 'SMS Authentication disabled'),
    category: 'Authentication & MFA',
    controlName: 'SMS Authentication disabled',
    description: 'SMS authentication is disabled',
    severity: 'high',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.AUTH_METHODS_POLICY],
    evaluate: (data) => {
      const config = data[ENTRA_ENDPOINTS.AUTH_METHODS_POLICY]?.value?.authenticationMethodConfigurations?.find((m: any) => m.id === 'sms');
      if (!config || config.state === 'disabled' || config.state === 'notEnabled') return { result: 'pass', evidence: 'SMS auth disabled', recommendation: '' };
      return { result: 'fail', evidence: 'SMS auth enabled (less secure)', recommendation: 'Disable SMS authentication unless required by business.' };
    },
  },
  {
    id: generateControlId('AuthMFA', 'Voice Call Authentication disabled'),
    category: 'Authentication & MFA',
    controlName: 'Voice Call Authentication disabled',
    description: 'Voice call authentication is disabled',
    severity: 'high',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.AUTH_METHODS_POLICY],
    evaluate: (data) => {
      const config = data[ENTRA_ENDPOINTS.AUTH_METHODS_POLICY]?.value?.authenticationMethodConfigurations?.find((m: any) => m.id === 'voice');
      if (!config || config.state === 'disabled' || config.state === 'notEnabled') return { result: 'pass', evidence: 'Voice auth disabled', recommendation: '' };
      return { result: 'fail', evidence: 'Voice auth enabled (less secure)', recommendation: 'Disable voice call authentication where possible.' };
    },
  },
  {
    id: generateControlId('AuthMFA', 'SSPR enabled'),
    category: 'Authentication & MFA',
    controlName: 'SSPR enabled',
    description: 'Self-Service Password Reset is enabled',
    severity: 'medium',
    weight: 1,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.AUTH_METHODS_POLICY],
    evaluate: (data) => {
      const sspr = data[ENTRA_ENDPOINTS.AUTH_METHODS_POLICY]?.value?.registrationEnforcement?.authenticationMethodsRegistrationCampaign?.state === 'enabled';
      if (sspr) return { result: 'pass', evidence: 'SSPR enabled', recommendation: '' };
      return { result: 'fail', evidence: 'SSPR not enabled', recommendation: 'Enable Self-Service Password Reset.' };
    },
  },
  {
    id: generateControlId('AuthMFA', 'Smart Lockout configured'),
    category: 'Authentication & MFA',
    controlName: 'Password Protection Smart Lockout configured',
    description: 'Smart lockout is configured',
    severity: 'high',
    weight: 1,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.AUTH_METHODS_POLICY],
    evaluate: (data) => {
      const threshold = data[ENTRA_ENDPOINTS.AUTH_METHODS_POLICY]?.value?.lockoutSettings?.lockoutThreshold;
      if (threshold > 0) return { result: 'pass', evidence: `Smart lockout configured (threshold: ${threshold})`, recommendation: '' };
      return { result: 'fail', evidence: 'Smart lockout not configured', recommendation: 'Configure Smart Lockout with recommended settings.' };
    },
  },

  // ==================== CONDITIONAL ACCESS ====================
  {
    id: generateControlId('ConditionalAccess', 'CA policies configured'),
    category: 'Conditional Access',
    controlName: 'Conditional Access policies configured',
    description: 'CA policies are configured',
    severity: 'critical',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES],
    evaluate: (data) => {
      const enabled = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES]?.value?.filter((p: any) => p.state === 'enabled')?.length || 0;
      if (enabled > 0) return { result: 'pass', evidence: `${enabled} CA policies enabled`, recommendation: '' };
      return { result: 'fail', evidence: 'No enabled CA policies', recommendation: 'Configure Conditional Access policies based on organizational requirements.' };
    },
  },
  {
    id: generateControlId('ConditionalAccess', 'CA requires MFA for admins'),
    category: 'Conditional Access',
    controlName: 'Conditional Access requires MFA for administrators',
    description: 'CA requires MFA for administrators',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES],
    evaluate: (data) => {
      const hasPolicy = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES]?.value?.some((p: any) =>
        p.state === 'enabled' && p.grantControls?.builtInControls?.includes('mfa') &&
        (p.conditions?.users?.includeRoles?.length > 0 || p.conditions?.users?.includeUsers?.includes('All'))
      );
      if (hasPolicy) return { result: 'pass', evidence: 'CA policy requires MFA for admins', recommendation: '' };
      return { result: 'fail', evidence: 'No CA policy requires MFA for admins', recommendation: 'Configure Conditional Access to require MFA for administrators.' };
    },
  },
  {
    id: generateControlId('ConditionalAccess', 'CA for high-risk sign-ins'),
    category: 'Conditional Access',
    controlName: 'Conditional Access requires MFA for high-risk sign-ins',
    description: 'CA handles high-risk sign-ins',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES],
    evaluate: (data) => {
      const hasPolicy = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES]?.value?.some((p: any) =>
        p.state === 'enabled' &&
        (p.grantControls?.builtInControls?.includes('mfa') || p.grantControls?.builtInControls?.includes('block')) &&
        (p.conditions?.signInRiskLevels?.includes('high') || p.conditions?.signInRiskLevels?.includes('medium'))
      );
      if (hasPolicy) return { result: 'pass', evidence: 'CA policy handles high-risk sign-ins', recommendation: '' };
      return { result: 'fail', evidence: 'No CA policy for high-risk sign-ins', recommendation: 'Configure Conditional Access to require MFA for risky sign-ins.' };
    },
  },
  {
    id: generateControlId('ConditionalAccess', 'High user risk requires password reset'),
    category: 'Conditional Access',
    controlName: 'High user risk requires password reset or blocking',
    description: 'High user risk requires password reset or blocking',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES],
    evaluate: (data) => {
      const hasPolicy = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES]?.value?.some((p: any) =>
        p.state === 'enabled' &&
        (p.grantControls?.builtInControls?.includes('passwordReset') || p.grantControls?.builtInControls?.includes('block')) &&
        (p.conditions?.userRiskLevels?.includes('high') || p.conditions?.userRiskLevels?.includes('medium'))
      );
      if (hasPolicy) return { result: 'pass', evidence: 'CA policy handles high user risk', recommendation: '' };
      return { result: 'fail', evidence: 'No CA policy for high user risk', recommendation: 'Configure Identity Protection user-risk policies.' };
    },
  },
  {
    id: generateControlId('ConditionalAccess', 'Named Locations configured'),
    category: 'Conditional Access',
    controlName: 'Named Locations configured',
    description: 'Named locations are configured',
    severity: 'medium',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.NAMED_LOCATIONS],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.NAMED_LOCATIONS]?.value?.length || 0;
      if (count > 0) return { result: 'pass', evidence: `${count} named locations configured`, recommendation: '' };
      return { result: 'fail', evidence: 'No named locations configured', recommendation: 'Configure Named Locations for Conditional Access.' };
    },
  },
{
    id: generateControlId('ConditionalAccess', 'Access from high-risk locations blocked'),
    category: 'Conditional Access',
    controlName: 'Access from high-risk locations blocked',
    description: 'Access from high-risk locations is blocked',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES, ENTRA_ENDPOINTS.NAMED_LOCATIONS],
    evaluate: (data) => {
      const hasPolicy = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES]?.value?.some((p: any) =>
        p.state === 'enabled' &&
        (p.grantControls?.builtInControls?.includes('block') || p.grantControls?.builtInControls?.includes('mfa')) &&
        p.conditions?.locations?.includeLocations?.length > 0
      );
      if (hasPolicy) return { result: 'pass', evidence: 'CA policy restricts locations', recommendation: '' };
      return { result: 'fail', evidence: 'No CA policy restricts locations', recommendation: 'Configure Conditional Access to block risky locations.' };
    },
  },
  {
    id: generateControlId('ConditionalAccess', 'Sign-in frequency configured'),
    category: 'Conditional Access',
    controlName: 'Sign-in frequency session controls configured',
    description: 'Sign-in frequency is configured',
    severity: 'medium',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES],
    evaluate: (data) => {
      const hasPolicy = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES]?.value?.some((p: any) =>
        p.state === 'enabled' && p.sessionControls?.signInFrequency?.isEnabled === true
      );
      if (hasPolicy) return { result: 'pass', evidence: 'Sign-in frequency configured', recommendation: '' };
      return { result: 'fail', evidence: 'Sign-in frequency not configured', recommendation: 'Configure sign-in frequency session controls.' };
    },
  },
  {
    id: generateControlId('ConditionalAccess', 'Token Protection enabled'),
    category: 'Conditional Access',
    controlName: 'Token Protection enabled',
    description: 'Token protection is enabled',
    severity: 'high',
    weight: 1,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES],
    evaluate: (data) => {
      const hasPolicy = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES]?.value?.some((p: any) =>
        p.state === 'enabled' && p.sessionControls?.tokenProtection?.isEnabled === true
      );
      if (hasPolicy) return { result: 'pass', evidence: 'Token protection enabled', recommendation: '' };
      return { result: 'fail', evidence: 'Token protection not enabled', recommendation: 'Enable Token Protection for supported workloads.' };
    },
  },

  // ==================== PIM ====================
  {
    id: generateControlId('PIM', 'PIM enabled'),
    category: 'Privileged Identity Management',
    controlName: 'PIM enabled',
    description: 'PIM is enabled',
    severity: 'critical',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.ROLE_ELIGIBILITY_SCHEDULES, ENTRA_ENDPOINTS.ROLE_ASSIGNMENT_SCHEDULES],
    evaluate: (data) => {
      const elig = data[ENTRA_ENDPOINTS.ROLE_ELIGIBILITY_SCHEDULES]?.value?.length || 0;
      const assign = data[ENTRA_ENDPOINTS.ROLE_ASSIGNMENT_SCHEDULES]?.value?.length || 0;
      if (elig > 0 || assign > 0) return { result: 'pass', evidence: `PIM configured (${elig} eligible, ${assign} assigned)`, recommendation: '' };
      return { result: 'fail', evidence: 'PIM not configured', recommendation: 'Enable Microsoft Entra Privileged Identity Management.' };
    },
  },
  {
    id: generateControlId('PIM', 'JIT activation configured'),
    category: 'Privileged Identity Management',
    controlName: 'JIT activation configured',
    description: 'Just-In-Time activation is configured',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.ROLE_ELIGIBILITY_SCHEDULES],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.ROLE_ELIGIBILITY_SCHEDULES]?.value?.length || 0;
      if (count > 0) return { result: 'pass', evidence: `${count} eligible role assignments`, recommendation: '' };
      return { result: 'fail', evidence: 'No JIT activation configured', recommendation: 'Configure Just-In-Time activation using PIM.' };
    },
  },
  {
    id: generateControlId('PIM', 'PIM activation requires MFA'),
    category: 'Privileged Identity Management',
    controlName: 'PIM activation requires MFA',
    description: 'PIM activation requires MFA',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.ROLE_MANAGEMENT_POLICIES],
    evaluate: (data) => {
      const hasMfa = data[ENTRA_ENDPOINTS.ROLE_MANAGEMENT_POLICIES]?.value?.some((p: any) =>
        p.effectiveRules?.some((r: any) => r.id === 'MfaRule' || r.claimValue === 'MFA')
      );
      if (hasMfa) return { result: 'pass', evidence: 'MFA required during PIM activation', recommendation: '' };
      return { result: 'fail', evidence: 'MFA not required during PIM activation', recommendation: 'Require MFA for PIM activation.' };
    },
  },

  // ==================== PRIVILEGED ACCESS ====================
  {
    id: generateControlId('PrivilegedAccess', 'Global Admin count within limit'),
    category: 'Privileged Access & Administration',
    controlName: 'Global Administrator count within limit',
    description: 'Global Administrator accounts are not more than 5',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.DIRECTORY_ROLES],
    evaluate: (data) => {
      const roles = data[ENTRA_ENDPOINTS.DIRECTORY_ROLES]?.value || [];
      const gaRole = roles.find((r: any) => r.displayName === 'Global Administrator' || r.displayName === 'Company Administrator');
      if (!gaRole) return { result: 'not_applicable', evidence: 'Global Admin role not found', recommendation: '' };

      const members = data[ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(gaRole.id)]?.value || [];
      if (members.length <= 5) return { result: 'pass', evidence: `Global Admin count: ${members.length} (within limit)`, recommendation: '' };
      return { result: 'fail', evidence: `Global Admin count: ${members.length} (exceeds limit of 5)`, recommendation: 'Reduce the number of Global Administrators to the minimum required.', failedItems: members.map((m: any) => m.userPrincipalName || m.displayName) };
    },
  },
  {
    id: generateControlId('PrivilegedAccess', 'Guest accounts least privilege'),
    category: 'Privileged Access & Administration',
    controlName: 'Guest accounts follow least privilege principle',
    description: 'Guest accounts should follow least privilege principle - requires manual assessment as business justification is needed',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.GUEST_USERS, ENTRA_ENDPOINTS.DIRECTORY_ROLES],
    evaluate: (data) => {
      // Manual assessment required - cannot automate without business justification
      return { result: 'needs_manual_review', evidence: 'NA', recommendation: '' };
    },
  },
  {
    id: generateControlId('PrivilegedAccess', 'Cloud-native admin accounts'),
    category: 'Privileged Access & Administration',
    controlName: 'Cloud-native administrator accounts used',
    description: 'Admin accounts should be cloud-native (not federated)',
    severity: 'high',
    weight: 1,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.DIRECTORY_ROLES],
    evaluate: (data) => {
      const roles = data[ENTRA_ENDPOINTS.DIRECTORY_ROLES]?.value || [];
      const adminRoleIds = roles.filter((r: any) => r.displayName?.includes('Administrator')).map((r: any) => r.id);

      let totalAdmins = 0;
      let cloudNativeAdmins = 0;
      for (const roleId of adminRoleIds) {
        const members = data[ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(roleId)]?.value || [];
        for (const member of members) {
          totalAdmins++;
          if (!member.onPremisesSyncEnabled && !member.onPremisesUserPrincipalName) {
            cloudNativeAdmins++;
          }
        }
      }

      if (totalAdmins === 0) return { result: 'not_applicable', evidence: 'No admin accounts found', recommendation: '' };
      if (cloudNativeAdmins === totalAdmins) return { result: 'pass', evidence: `All ${totalAdmins} admin accounts are cloud-native`, recommendation: '' };
      return { result: 'fail', evidence: `${totalAdmins - cloudNativeAdmins} of ${totalAdmins} admin accounts are federated`, recommendation: 'Create dedicated cloud-native administrator accounts.' };
    },
  },

  // ==================== ACCESS REVIEWS ====================
  {
    id: generateControlId('AccessReviews', 'Guest access review configured'),
    category: 'Access Controls & Review',
    controlName: 'Access Review for guest users configured',
    description: 'Access Review for guest users is configured',
    severity: 'critical',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS],
    evaluate: (data) => {
      const hasReview = data[ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS]?.value?.some((d: any) =>
        d.displayName?.toLowerCase().includes('guest') || d.description?.toLowerCase().includes('guest')
      );
      if (hasReview) return { result: 'pass', evidence: 'Guest access review configured', recommendation: '' };
      return { result: 'fail', evidence: 'No guest access review found', recommendation: 'Configure Access Reviews for guest users.' };
    },
  },
  {
    id: generateControlId('AccessReviews', 'Privileged role access review configured'),
    category: 'Access Controls & Review',
    controlName: 'Access Reviews for privileged roles configured',
    description: 'Access Reviews for privileged roles are configured',
    severity: 'high',
    weight: 2,
    automatable: true,
    quickAssessment: true,
    endpoints: [ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS],
    evaluate: (data) => {
      const hasReview = data[ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS]?.value?.some((d: any) =>
        d.displayName?.toLowerCase().includes('admin') || d.displayName?.toLowerCase().includes('privileged')
      );
      if (hasReview) return { result: 'pass', evidence: 'Privileged role access review configured', recommendation: '' };
      return { result: 'fail', evidence: 'No privileged role access review found', recommendation: 'Configure Access Reviews for privileged roles.' };
    },
  },
  {
    id: generateControlId('AccessReviews', 'Recurring access review schedule'),
    category: 'Access Controls & Review',
    controlName: 'Access Reviews have recurring schedule',
    description: 'At least one Microsoft Entra Access Review for privileged roles or guest users is configured with a recurring schedule',
    severity: 'medium',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS],
    evaluate: (data) => {
      const hasRecurring = data[ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS]?.value?.some((d: any) => {
        // Check if recurrence type is not oneTime and not onDemand
        const hasRecurrence = d.recurrenceType !== 'oneTime' && d.recurrenceType !== 'onDemand';
        if (!hasRecurrence) return false;
        
        // Check if the review is for privileged roles or guest users
        const displayName = (d.displayName || '').toLowerCase();
        const description = (d.description || '').toLowerCase();
        const descriptionForReviewers = (d.descriptionForReviewers || '').toLowerCase();
        
        const isPrivilegedRole = displayName.includes('admin') || 
                                 displayName.includes('privileged') ||
                                 description.includes('admin') || 
                                 description.includes('privileged') ||
                                 descriptionForReviewers.includes('admin') || 
                                 descriptionForReviewers.includes('privileged');
                                 
        const isGuestUser = displayName.includes('guest') || 
                            description.includes('guest') ||
                            descriptionForReviewers.includes('guest');
        
        return isPrivilegedRole || isGuestUser;
      });
      if (hasRecurring) return { result: 'pass', evidence: 'Recurring access review configured for privileged roles or guest users', recommendation: '' };
      return { result: 'fail', evidence: 'No recurring access review found for privileged roles or guest users', recommendation: 'Configure recurring Access Reviews.' };
    },
  },
  {
    id: generateControlId('AccessReviews', 'Reminder notifications enabled'),
    category: 'Access Controls & Review',
    controlName: 'Access Reviews have reminder notifications',
    description: 'Reminder notifications are enabled for access reviews',
    severity: 'critical',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS],
    evaluate: (data) => {
      const hasReminder = data[ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS]?.value?.some((d: any) =>
        d.notificationEnabled === true || d.sendReminderNotifications === true
      );
      if (hasReminder) return { result: 'pass', evidence: 'Reminder notifications enabled', recommendation: '' };
      return { result: 'fail', evidence: 'No reminder notifications configured', recommendation: 'Enable reminder notifications for Access Reviews.' };
    },
  },
  {
    id: generateControlId('AccessReviews', 'Non-responders auto-handled'),
    category: 'Access Controls & Review',
    controlName: 'Non-responders automatically handled',
    description: 'Non-responders are automatically handled',
    severity: 'medium',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS],
    evaluate: (data) => {
      const hasAuto = data[ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS]?.value?.some((d: any) =>
        d.autoApplyDecisionEnabled === true || d.autoReviewEnabled === true
      );
      if (hasAuto) return { result: 'pass', evidence: 'Auto-handling for non-responders configured', recommendation: '' };
      return { result: 'fail', evidence: 'No auto-handling for non-responders', recommendation: 'Configure automatic actions for non-responders.' };
    },
  },

  // ==================== MONITORING ====================
  {
    id: generateControlId('Monitoring', 'Sign-in logs available'),
    category: 'Identity Monitoring & Logging',
    controlName: 'Sign-in logs available',
    description: 'Sign-in logs are available',
    severity: 'high',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.SIGN_IN_LOGS],
    evaluate: (data) => {
      const logs = data[ENTRA_ENDPOINTS.SIGN_IN_LOGS];
      if (logs && !logs.error) return { result: 'pass', evidence: 'Sign-in logs accessible', recommendation: '' };
      return { result: 'fail', evidence: 'Sign-in logs not accessible', recommendation: 'Enable sign-in log retention and monitoring.' };
    },
  },
  {
    id: generateControlId('Monitoring', 'Directory audit logs available'),
    category: 'Identity Monitoring & Logging',
    controlName: 'Directory audit logs available',
    description: 'Directory audit logs are available',
    severity: 'high',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.DIRECTORY_AUDITS],
    evaluate: (data) => {
      const logs = data[ENTRA_ENDPOINTS.DIRECTORY_AUDITS];
      if (logs && !logs.error) return { result: 'pass', evidence: 'Directory audit logs accessible', recommendation: '' };
      return { result: 'fail', evidence: 'Directory audit logs not accessible', recommendation: 'Enable directory audit logging.' };
    },
  },
  {
    id: generateControlId('Monitoring', 'Provisioning logs available'),
    category: 'Identity Monitoring & Logging',
    controlName: 'Provisioning logs available',
    description: 'Provisioning logs are available',
    severity: 'medium',
    weight: 1,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.PROVISIONING_LOGS],
    evaluate: (data) => {
      const logs = data[ENTRA_ENDPOINTS.PROVISIONING_LOGS];
      if (logs && !logs.error) return { result: 'pass', evidence: 'Provisioning logs accessible', recommendation: '' };
      return { result: 'fail', evidence: 'Provisioning logs not accessible', recommendation: 'Enable provisioning logs.' };
    },
  },
  {
    id: generateControlId('Monitoring', 'Identity Protection available'),
    category: 'Identity Monitoring & Logging',
    controlName: 'Identity Protection risk detections available',
    description: 'Identity Protection is available',
    severity: 'high',
    weight: 2,
    automatable: true,
    endpoints: [ENTRA_ENDPOINTS.RISK_DETECTIONS],
    evaluate: (data) => {
      const logs = data[ENTRA_ENDPOINTS.RISK_DETECTIONS];
      if (logs && !logs.error) return { result: 'pass', evidence: 'Identity Protection risk detections available', recommendation: '' };
      return { result: 'fail', evidence: 'Identity Protection not available', recommendation: 'Enable Microsoft Entra Identity Protection.' };
    },
  },
  // ==================== INFORMATIONAL CONTROLS ====================
  // These controls display tenant information without pass/fail evaluation
  {
    id: 'info-total-users',
    category: 'Informational',
    controlName: 'Total number of users',
    description: 'Total number of users in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.USERS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.USERS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} total users`, recommendation: '' };
    },
  },
  {
    id: 'info-member-users',
    category: 'Informational',
    controlName: 'Total number of member users',
    description: 'Total number of member users in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.MEMBER_USERS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.MEMBER_USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.MEMBER_USERS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} member users`, recommendation: '' };
    },
  },
  {
    id: 'info-guest-users',
    category: 'Informational',
    controlName: 'Total number of guest users',
    description: 'Total number of guest users in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.GUEST_USERS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.GUEST_USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.GUEST_USERS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} guest users`, recommendation: '' };
    },
  },
  {
    id: 'info-m365-groups',
    category: 'Informational',
    controlName: 'Total number of Microsoft 365 Groups',
    description: 'Total number of Microsoft 365 Groups in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.M365_GROUPS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.M365_GROUPS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.M365_GROUPS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} Microsoft 365 Groups`, recommendation: '' };
    },
  },
  {
    id: 'info-dynamic-groups',
    category: 'Informational',
    controlName: 'Total number of Dynamic Microsoft 365 Groups',
    description: 'Total number of Dynamic Microsoft 365 Groups in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.DYNAMIC_GROUPS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.DYNAMIC_GROUPS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.DYNAMIC_GROUPS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} Dynamic Groups`, recommendation: '' };
    },
  },
  {
    id: 'info-device-groups',
    category: 'Informational',
    controlName: 'Total number of Device Groups',
    description: 'Total number of Device Groups in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.DEVICE_GROUPS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.DEVICE_GROUPS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.DEVICE_GROUPS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} Device Groups`, recommendation: '' };
    },
  },
  {
    id: 'info-licensed-users',
    category: 'Informational',
    controlName: 'Total number of licensed users',
    description: 'Total number of licensed users in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.LICENSED_USERS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.LICENSED_USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.LICENSED_USERS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} licensed users`, recommendation: '' };
    },
  },
  {
    id: 'info-unlicensed-users',
    category: 'Informational',
    controlName: 'Total number of unlicensed users',
    description: 'Total number of unlicensed users in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.UNLICENSED_USERS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.UNLICENSED_USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.UNLICENSED_USERS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} unlicensed users`, recommendation: '' };
    },
  },
  {
    id: 'info-active-users',
    category: 'Informational',
    controlName: 'Total number of active users',
    description: 'Total number of active users in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.ACTIVE_USERS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.ACTIVE_USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.ACTIVE_USERS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} active users`, recommendation: '' };
    },
  },
  {
    id: 'info-inactive-users',
    category: 'Informational',
    controlName: 'Total number of inactive (disabled) users',
    description: 'Total number of inactive (disabled) users in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.INACTIVE_USERS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.INACTIVE_USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.INACTIVE_USERS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} inactive users`, recommendation: '' };
    },
  },
  {
    id: 'info-licensed-inactive-users',
    category: 'Informational',
    controlName: 'Total number of licensed inactive users',
    description: 'Total number of licensed inactive users in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.LICENSED_USERS_COUNT, ENTRA_ENDPOINTS.INACTIVE_USERS_COUNT],
    evaluate: (data) => {
      const licensed = data[ENTRA_ENDPOINTS.LICENSED_USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.LICENSED_USERS_COUNT]?.['@odata.count'] || 0;
      const inactive = data[ENTRA_ENDPOINTS.INACTIVE_USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.INACTIVE_USERS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${licensed} licensed users, ${inactive} inactive users`, recommendation: '' };
    },
  },
  {
    id: 'info-administrative-units',
    category: 'Informational',
    controlName: 'Total number of Administrative Units',
    description: 'Total number of Administrative Units in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.ADMINISTRATIVE_UNITS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.ADMINISTRATIVE_UNITS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.ADMINISTRATIVE_UNITS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} Administrative Units`, recommendation: '' };
    },
  },
  {
    id: 'info-risky-users',
    category: 'Informational',
    controlName: 'Total number of risky users',
    description: 'Total number of risky users in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.RISKY_USERS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.RISKY_USERS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.RISKY_USERS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} risky users`, recommendation: '' };
    },
  },
  {
    id: 'info-risky-signins',
    category: 'Informational',
    controlName: 'Total number of risky sign-ins',
    description: 'Total number of risky sign-ins in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.RISKY_SIGNINS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.RISKY_SIGNINS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.RISKY_SIGNINS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} risky sign-ins`, recommendation: '' };
    },
  },
  {
    id: 'info-privileged-admins',
    category: 'Informational',
    controlName: 'Total number of privileged administrator accounts',
    description: 'Total number of privileged administrator accounts in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.DIRECTORY_ROLES],
    evaluate: (data) => {
      const roles = data[ENTRA_ENDPOINTS.DIRECTORY_ROLES]?.value || [];
      const adminRoleIds = roles.filter((r: any) => r.displayName?.includes('Administrator')).map((r: any) => r.id);
      let totalAdmins = 0;
      for (const roleId of adminRoleIds) {
        const members = data[ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(roleId)]?.value || [];
        totalAdmins += members.length;
      }
      return { result: 'informational', evidence: `${totalAdmins} privileged administrator accounts`, recommendation: '' };
    },
  },
  {
    id: 'info-admin-roles-users',
    category: 'Informational',
    controlName: 'List of administrator roles and assigned users',
    description: 'List of administrator roles and assigned users in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.DIRECTORY_ROLES],
    evaluate: (data) => {
      const roles = data[ENTRA_ENDPOINTS.DIRECTORY_ROLES]?.value || [];
      const adminRoles = roles.filter((r: any) => r.displayName?.includes('Administrator'));
      const roleList = adminRoles.map((r: any) => {
        const members = data[ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(r.id)]?.value || [];
        return `${r.displayName}: ${members.length} users`;
      }).join(', ');
      return { result: 'informational', evidence: roleList || 'No administrator roles found', recommendation: '' };
    },
  },
  {
    id: 'info-ca-policies',
    category: 'Informational',
    controlName: 'Total number of Conditional Access policies',
    description: 'Total number of Conditional Access policies in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.CA_POLICIES_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.CA_POLICIES_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.CA_POLICIES_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} Conditional Access policies`, recommendation: '' };
    },
  },
  {
    id: 'info-mfa-protected',
    category: 'Informational',
    controlName: 'Total number of users protected by MFA',
    description: 'Total number of users protected by MFA in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.MFA_REGISTRATION_DETAILS],
    evaluate: (data) => {
      const mfaData = data[ENTRA_ENDPOINTS.MFA_REGISTRATION_DETAILS]?.value || [];
      const protectedUsers = mfaData.filter((u: any) => u.isMfaRegistered === true).length;
      return { result: 'informational', evidence: `${protectedUsers} users protected by MFA`, recommendation: '' };
    },
  },
  {
    id: 'info-mfa-unprotected',
    category: 'Informational',
    controlName: 'Total number of users without MFA',
    description: 'Total number of users without MFA in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.MFA_REGISTRATION_DETAILS],
    evaluate: (data) => {
      const mfaData = data[ENTRA_ENDPOINTS.MFA_REGISTRATION_DETAILS]?.value || [];
      const unprotectedUsers = mfaData.filter((u: any) => u.isMfaRegistered !== true).length;
      return { result: 'informational', evidence: `${unprotectedUsers} users without MFA`, recommendation: '' };
    },
  },
  {
    id: 'info-privileged-no-mfa',
    category: 'Informational',
    controlName: 'Total number of privileged users without MFA',
    description: 'Total number of privileged users without MFA in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.MFA_REGISTRATION_DETAILS, ENTRA_ENDPOINTS.DIRECTORY_ROLES],
    evaluate: (data) => {
      const roles = data[ENTRA_ENDPOINTS.DIRECTORY_ROLES]?.value || [];
      const privRoleIds = roles.filter((r: any) => r.displayName?.includes('Administrator')).map((r: any) => r.id);
      const privUsers = new Set<string>();
      for (const roleId of privRoleIds) {
        const members = data[ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(roleId)]?.value || [];
        members.forEach((m: any) => privUsers.add(m.userPrincipalName || m.id));
      }
      const mfaData = data[ENTRA_ENDPOINTS.MFA_REGISTRATION_DETAILS]?.value || [];
      const mfaUsers = new Set(mfaData.filter((u: any) => u.isMfaRegistered === true).map((u: any) => u.userPrincipalName || u.id));
      const noMfa = Array.from(privUsers).filter((u) => !mfaUsers.has(u)).length;
      return { result: 'informational', evidence: `${noMfa} privileged users without MFA`, recommendation: '' };
    },
  },
  {
    id: 'info-app-registrations',
    category: 'Informational',
    controlName: 'Total number of App Registrations',
    description: 'Total number of App Registrations in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.APP_REGISTRATIONS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.APP_REGISTRATIONS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.APP_REGISTRATIONS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} App Registrations`, recommendation: '' };
    },
  },
  {
    id: 'info-enterprise-apps',
    category: 'Informational',
    controlName: 'Total number of Enterprise Applications',
    description: 'Total number of Enterprise Applications in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.ENTERPRISE_APPS_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.ENTERPRISE_APPS_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.ENTERPRISE_APPS_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} Enterprise Applications`, recommendation: '' };
    },
  },
  {
    id: 'info-enterprise-apps-sso',
    category: 'Informational',
    controlName: 'Total number of Enterprise Applications using SSO',
    description: 'Total number of Enterprise Applications using SSO in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.ENTERPRISE_APPS_SSO_COUNT],
    evaluate: (data) => {
      const count = data[ENTRA_ENDPOINTS.ENTERPRISE_APPS_SSO_COUNT]?.value?.length || data[ENTRA_ENDPOINTS.ENTERPRISE_APPS_SSO_COUNT]?.['@odata.count'] || 0;
      return { result: 'informational', evidence: `${count} Enterprise Applications using SSO`, recommendation: '' };
    },
  },
  {
    id: 'info-app-credentials-expiring',
    category: 'Informational',
    controlName: 'Total number of application credentials nearing expiration',
    description: 'Total number of application credentials nearing expiration in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.APPLICATIONS],
    evaluate: (data) => {
      const apps = data[ENTRA_ENDPOINTS.APPLICATIONS]?.value || [];
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      let expiringCount = 0;
      for (const app of apps) {
        const credentials = app.passwordCredentials || [];
        for (const cred of credentials) {
          const endDate = new Date(cred.endDateTime);
          if (endDate <= thirtyDays && endDate > now) {
            expiringCount++;
          }
        }
      }
      return { result: 'informational', evidence: `${expiringCount} application credentials nearing expiration`, recommendation: '' };
    },
  },
  {
    id: 'info-ca-policies-list',
    category: 'Informational',
    controlName: 'List of Conditional Access policies and configurations',
    description: 'List of Conditional Access policies and configurations in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES],
    evaluate: (data) => {
      const policies = data[ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES]?.value || [];
      const policyList = policies.map((p: any) => `${p.displayName} (${p.state})`).join(', ');
      return { result: 'informational', evidence: policyList || 'No Conditional Access policies found', recommendation: '' };
    },
  },
  {
    id: 'info-auth-methods',
    category: 'Informational',
    controlName: 'Authentication methods configured in the tenant',
    description: 'Authentication methods configured in the tenant',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    endpoints: [ENTRA_ENDPOINTS.AUTH_METHODS_POLICY],
    evaluate: (data) => {
      const configs = data[ENTRA_ENDPOINTS.AUTH_METHODS_POLICY]?.value?.authenticationMethodConfigurations || [];
      const methods = configs.map((m: any) => `${m.id}: ${m.state}`).join(', ');
      return { result: 'informational', evidence: methods || 'No authentication methods configured', recommendation: '' };
    },
  },
  {
    id: 'info-secure-score',
    category: 'Informational',
    controlName: 'Current Microsoft Entra Identity Secure Score',
    description: 'Current Microsoft Entra Identity Secure Score',
    severity: 'informational',
    weight: 0,
    automatable: true,
    informational: true,
    quickAssessmentInformational: true,
    endpoints: [ENTRA_ENDPOINTS.SECURE_SCORES],
    evaluate: (data) => {
      const scores = data[ENTRA_ENDPOINTS.SECURE_SCORES]?.value || [];
      const latestScore = scores[0];
      if (latestScore) {
        return { result: 'informational', evidence: `Secure Score: ${latestScore.score} / ${latestScore.maxScore}`, recommendation: '' };
      }
      return { result: 'informational', evidence: 'No Secure Score data available', recommendation: '' };
    },
  },
];

export class EntraCollector {
  private client: GraphHttpClient;
  private tenantConnectionId: string;

  constructor(tenantConnectionId: string, accessToken: string) {
    this.tenantConnectionId = tenantConnectionId;
    this.client = new GraphHttpClient(accessToken, '');
  }

  /**
   * Get custom headers for specific endpoints
   */
  private getEndpointHeaders(endpoint: string): Record<string, string> | undefined {
    // roleManagementPolicies requires ConsistencyLevel: eventual header
    if (endpoint.includes('roleManagementPolicies')) {
      return { 'ConsistencyLevel': 'eventual' };
    }
    // $count parameter requires ConsistencyLevel: eventual header
    if (endpoint.includes('$count=true')) {
      return { 'ConsistencyLevel': 'eventual' };
    }
    return undefined;
  }

  /**
   * Save raw API response data to files for verification
   */
  saveDataToFiles(assessmentId: string, moduleName: string, result: EntraCollectionResult): void {
    const baseDir = path.join(__dirname, '..', '..', '..', 'assessment-data', assessmentId, moduleName.replace(/\s+/g, '-'));
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    // Save each endpoint response as a separate JSON file
    for (const [endpoint, data] of Object.entries(result.rawData)) {
      const filename = endpoint.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_') + '.json';
      const filepath = path.join(baseDir, filename);
      
      const fileContent = {
        endpoint: endpoint,
        timestamp: new Date().toISOString(),
        status: data?.error ? 'error' : 'success',
        data: data?.error ? { error: data.error } : data?.value || data,
      };
      
      fs.writeFileSync(filepath, JSON.stringify(fileContent, null, 2));
    }

    // Save summary file
    const summaryPath = path.join(baseDir, '_summary.json');
    const actionableControls = Object.entries(result.controls).filter(([id]) => {
      const controlDef = ENTRA_CONTROLS.find(c => c.id === id);
      return !controlDef?.informational;
    });
    const informationalControls = Object.entries(result.controls).filter(([id]) => {
      const controlDef = ENTRA_CONTROLS.find(c => c.id === id);
      return controlDef?.informational === true;
    });
    const summary = {
      assessmentId,
      moduleName,
      collectedAt: result.collectedAt,
      status: result.status,
      totalEndpoints: Object.keys(result.rawData).length,
      successfulEndpoints: Object.values(result.rawData).filter(d => !d?.error).length,
      failedEndpoints: result.errors.length,
      totalControls: actionableControls.length,
      controlsPass: actionableControls.filter(([, c]) => c.result === 'pass').length,
      controlsFail: actionableControls.filter(([, c]) => c.result === 'fail').length,
      controlsPartial: actionableControls.filter(([, c]) => c.result === 'partial').length,
      controlsManualReview: actionableControls.filter(([, c]) => c.result === 'needs_manual_review').length,
      controlsNotApplicable: actionableControls.filter(([, c]) => c.result === 'not_applicable').length,
      endpoints: Object.keys(result.rawData).map(endpoint => ({
        endpoint,
        status: result.rawData[endpoint]?.error ? 'error' : 'success',
        error: result.rawData[endpoint]?.error || null,
      })),
      controls: actionableControls.map(([id, control]) => {
        const controlDef = ENTRA_CONTROLS.find(c => c.id === id);
        const severity = getSeverityForControl(id);
        const score = calculateControlScore(severity, control.result);
        const recommendation = getRecommendationForControl(id, control.result) ?? control.recommendation;
        const output: any = {
          name: controlDef?.controlName || id,
          id,
          result: control.result,
          evidence: control.evidence,
          recommendation,
          severity: severity.charAt(0).toUpperCase() + severity.slice(1),
          score,
        };
        if (control.failedItems) {
          output.failedItems = control.failedItems;
        }
        return output;
      }),
      informationalControls: informationalControls.map(([id, control]) => {
        const controlDef = ENTRA_CONTROLS.find(c => c.id === id);
        const severity = getSeverityForControl(id);
        const score = calculateControlScore(severity, control.result);
        return {
          name: controlDef?.controlName || id,
          id,
          evidence: control.evidence,
          severity: severity.charAt(0).toUpperCase() + severity.slice(1),
          score,
        };
      }),
     };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    // Generate executive report PDF
    this.generateExecutiveReport(assessmentId, moduleName, result, summary);

    // Save errors file
    if (result.errors.length > 0) {
      const errorsPath = path.join(baseDir, '_errors.json');
      fs.writeFileSync(errorsPath, JSON.stringify(result.errors, null, 2));
     }
   }

  generateExecutiveReport(assessmentId: string, moduleName: string, result: EntraCollectionResult, summary: any): void {
    const baseDir = path.join(process.cwd(), 'assessment-data', assessmentId, moduleName.replace(/\s+/g, '-'));
    const filePath = path.join(baseDir, '_executive_report.pdf');

    const NAVY = '#0c2461';
    const DARK_BLUE = '#1e3a8a';
    const BLUE = '#2563eb';
    const LIGHT_BLUE = '#93c5fd';
    const BLACK = '#1f2937';
    const WHITE = '#ffffff';
    const GRAY_BORDER = '#e5e7eb';
    const GRAY_TEXT = '#6b7280';
    const GREEN = '#16a34a';
    const RED = '#dc2626';
    const ORANGE = '#ea580c';

    const orgData = result.rawData[ENTRA_ENDPOINTS.ORGANIZATION]?.value?.[0];
    const tenantName = orgData?.displayName || orgData?.tenantName || 'Unknown Tenant';

    const actionableControls = summary.controls;
    const informationalControls = summary.informationalControls;
    const failedEndpoints = summary.endpoints.filter((e: any) => e.status === 'error');

    const passCount = actionableControls.filter((c: any) => c.result === 'pass').length;
    const failCount = actionableControls.filter((c: any) => c.result === 'fail').length;
    const partialCount = actionableControls.filter((c: any) => c.result === 'partial').length;
    const naCount = actionableControls.filter((c: any) => c.result === 'not_applicable').length;
    const reviewCount = actionableControls.filter((c: any) => c.result === 'needs_manual_review').length;
    const totalActionable = actionableControls.length;
    const passRate = totalActionable > 0 ? Math.round((passCount / totalActionable) * 100) : 0;

    const totalScore = actionableControls.reduce((sum: number, c: any) => {
      const score = typeof c.score === 'number' ? c.score : 0;
      return sum + score;
    }, 0);
    const maxScore = totalActionable * 10;
    const scorePercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    const doc = new PDFDocument({ margin: 36 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    const ensureSpace = (required: number) => {
      const remaining = doc.page.height - doc.y - 36;
      if (remaining < required) {
        doc.addPage();
        doc.y = 50;
      }
    };

    const sectionHeader = (num: string, title: string) => {
      ensureSpace(80);
      doc.moveDown(0.6);
      doc.fillColor(NAVY).fontSize(18).font('Helvetica-Bold').text(`${num} ${title}`);
      doc.moveDown(0.15);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke(BLUE);
      doc.moveDown(0.5);
    };

    const subHeader = (title: string) => {
      ensureSpace(30);
      doc.moveDown(0.3);
      doc.fillColor(DARK_BLUE).fontSize(12).font('Helvetica-Bold').text(title);
      doc.moveDown(0.1);
    };

    const paragraph = (text: string) => {
      doc.fillColor(BLACK).fontSize(10).font('Helvetica').text(text, { align: 'justify', paragraphGap: 4, lineGap: 1 });
      doc.moveDown(0.4);
    };

    const infoRow = (label: string, value: string) => {
      const y = doc.y;
      doc.fillColor(DARK_BLUE).font('Helvetica-Bold').fontSize(10);
      doc.text(label, doc.page.margins.left, y);
      const labelWidth = doc.widthOfString(label);
      doc.fillColor(BLACK).font('Helvetica').fontSize(10).text(value, doc.page.margins.left + labelWidth + 12, y);
      doc.y = y + 16;
    };

    const getResultColor = (result: string): string => {
      switch (result) {
        case 'pass': return GREEN;
        case 'partial': return ORANGE;
        case 'fail': return RED;
        case 'needs_manual_review': return ORANGE;
        case 'not_applicable': return GRAY_TEXT;
        case 'informational': return GRAY_TEXT;
        default: return BLACK;
      }
    };

    const getResultLabel = (result: string): string => {
      switch (result) {
        case 'pass': return 'PASSED';
        case 'partial': return 'PARTIAL';
        case 'fail': return 'FAILED';
        case 'needs_manual_review': return 'MANUAL REVIEW';
        case 'not_applicable': return 'N/A';
        case 'informational': return 'INFORMATIONAL';
        default: return result.toUpperCase();
      }
    };

    doc.rect(0, 0, doc.page.width, 90).fill(BLUE);
    doc.fillColor(WHITE).fontSize(24).font('Helvetica-Bold').text('Entra ID Security Assessment', 0, 32, { align: 'center' });
    doc.fillColor(WHITE).fontSize(14).font('Helvetica').text('Executive Report', 0, 60, { align: 'center' });
    doc.y = 105;

    sectionHeader('1.', 'Tenant Information');
    infoRow('Tenant Name', tenantName);
    infoRow('Assessment ID', assessmentId);
    infoRow('Assessment Date', new Date(result.collectedAt).toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    infoRow('Total Endpoints Collected', String(summary.totalEndpoints));
    infoRow('Total Actionable Controls', String(totalActionable));
    infoRow('Controls Passed', String(passCount));
    infoRow('Controls Failed', String(failCount));
    infoRow('Controls Partial', String(partialCount));
    infoRow('Needs Manual Review', String(reviewCount));
    infoRow('Not Applicable', String(naCount));
    infoRow('Overall Pass Rate', `${passRate}%`);

    sectionHeader('2.', 'Overall Assessment Score');

    doc.fillColor(BLACK).fontSize(16).font('Helvetica').text(`${totalScore} / ${maxScore} points (${scorePercentage}%)`, { align: 'center' });
    doc.moveDown(0.8);

    const barWidth = Math.min(420, doc.page.width - 100);
    const barHeight = 20;
    const barX = (doc.page.width - barWidth) / 2;
    const barY = doc.y;

    doc.rect(barX, barY, barWidth, barHeight).fill(GRAY_BORDER);
    const fillWidth = Math.max(0, (scorePercentage / 100) * barWidth);
    const barFillColor = scorePercentage >= 70 ? GREEN : scorePercentage >= 40 ? ORANGE : RED;
    doc.rect(barX, barY, fillWidth, barHeight).fill(barFillColor);
    doc.rect(barX, barY, barWidth, barHeight).stroke(NAVY);

    doc.fillColor(WHITE).fontSize(11).font('Helvetica-Bold');
    const pctText = `${scorePercentage}%`;
    const pctWidth = doc.widthOfString(pctText);
    doc.text(pctText, barX + (barWidth - pctWidth) / 2, barY + 14);
    doc.y = barY + barHeight + 18;

    paragraph(
      `The tenant ${tenantName} achieved a security score of ${totalScore} out of ${maxScore} possible points (${scorePercentage}%). ` +
      `This score is calculated based on the severity-weighted compliance of ${totalActionable} actionable security controls. ` +
      `Each control can earn up to 10 points based on its result (pass = 10 points, partial = varies by severity, fail = 0 points).`
    );

    subHeader('Score Breakdown:');
    const partialScore = actionableControls.filter((c: any) => c.result === 'partial').reduce((s: number, c: any) => s + (typeof c.score === 'number' ? c.score : 0), 0);
    const reviewScore = actionableControls.filter((c: any) => c.result === 'needs_manual_review').reduce((s: number, c: any) => s + (typeof c.score === 'number' ? c.score : 0), 0);

    doc.fillColor(BLACK).fontSize(10).font('Helvetica');
    doc.text(`  - Passed controls (${passCount} \u00d7 10): ${passCount * 10} points`);
    doc.text(`  - Partial controls (${partialCount} \u00d7 variable): ${partialScore} points`);
    doc.text(`  - Failed controls (${failCount} \u00d7 0): 0 points`);
    doc.text(`  - Manual review (${reviewCount} \u00d7 variable): ${reviewScore} points`);
    doc.text(`  - Not applicable (${naCount} \u00d7 0): 0 points`);
    doc.moveDown(0.6);

    sectionHeader('3.', 'Executive Summary');

    const passedControls = actionableControls.filter((c: any) => c.result === 'pass' || c.result === 'partial');
    const failedControls = actionableControls.filter((c: any) => c.result === 'fail' || c.result === 'needs_manual_review');

    subHeader('Key Strengths:');
    paragraph(
      `The tenant ${tenantName} currently has ${passedControls.length} control(s) that are properly configured out of ${totalActionable} total actionable controls. ` +
      `The following configurations are in place and functioning correctly: ` +
      `${passedControls.map((c: any) => `${c.name} (${c.evidence})`).join(', ')}. ` +
      `Notably, ${passCount} control(s) passed fully and ${partialCount} control(s) showed partial compliance. ` +
      `The overall security posture demonstrates a pass rate of ${passRate}%, indicating areas of strength in the tenant's identity security configuration.`
    );

    subHeader('Areas for Improvement:');
    paragraph(
      `The following ${failedControls.length} control(s) have not been fully addressed: ` +
      `${failedControls.map((c: any) => `${c.name} ${c.recommendation ? '\u2014 ' + c.recommendation : ''}`).join('. ')}. ` +
      `These gaps represent areas where the tenant is at risk or falling short of recommended security practices. ` +
      `Immediate remediation is recommended for ${failCount} failed control(s) and ${reviewCount} control(s) requiring manual review. ` +
      `Key risks include potential unauthorized access, privilege escalation, and exposure to modern authentication threats.`
    );

    sectionHeader('4.', 'Control Results');

    doc.moveDown(0.3);
    doc.fillColor(BLACK).fontSize(9).font('Helvetica');
    const legend = [
      { label: 'PASSED', color: GREEN },
      { label: 'PARTIAL', color: ORANGE },
      { label: 'FAILED', color: RED },
      { label: 'MANUAL REVIEW', color: ORANGE },
      { label: 'N/A', color: GRAY_TEXT },
    ];
    let legendX = doc.page.margins.left;
    const legendY = doc.y;
    for (const item of legend) {
      doc.rect(legendX, legendY, 10, 10).fill(item.color);
      doc.fillColor(BLACK).font('Helvetica').text(item.label, legendX + 15, legendY - 1);
      legendX += doc.widthOfString(item.label) + 38;
    }
    doc.y = legendY + 18;
    doc.moveDown(0.5);

    for (const control of actionableControls) {
      ensureSpace(70);

      const color = getResultColor(control.result);
      const label = getResultLabel(control.result);
      const severityLabel = control.severity.charAt(0).toUpperCase() + control.severity.slice(1);

      doc.fillColor(DARK_BLUE).fontSize(11).font('Helvetica-Bold').text(control.name);
      doc.moveDown(0.1);
      doc.fillColor(GRAY_TEXT).fontSize(9).font('Helvetica').text(`Severity: ${severityLabel}`, { continued: true });
      doc.fillColor(BLACK).text(` | Score: ${control.score}`, { continued: true });
      doc.fillColor(color).font('Helvetica-Bold').text(` | Result: ${label}`);
      doc.moveDown(0.1);
      doc.fillColor(GRAY_TEXT).fontSize(8).font('Helvetica-Oblique').text(`Evidence: ${control.evidence}`);
      doc.moveDown(0.1);
      if (control.recommendation) {
        doc.fillColor(BLACK).fontSize(9).font('Helvetica').text(`Recommendation: ${control.recommendation}`);
        doc.moveDown(0.1);
      }
      if (control.failedItems && control.failedItems.length > 0) {
        doc.fillColor(BLACK).fontSize(9).font('Helvetica').text(`Failed Items: ${control.failedItems.join(', ')}`);
        doc.moveDown(0.1);
      }
      doc.moveDown(0.3);
    }

    sectionHeader('5.', 'Informational Controls');
    for (const control of informationalControls) {
      ensureSpace(40);
      doc.fillColor(DARK_BLUE).fontSize(10).font('Helvetica-Bold').text(control.name);
      doc.fillColor(GRAY_TEXT).fontSize(8).font('Helvetica-Oblique').text(`Evidence: ${control.evidence}`);
      doc.moveDown(0.2);
    }

    sectionHeader('6.', 'Failed Endpoints');
    if (failedEndpoints.length === 0) {
      paragraph('No failed endpoints were encountered during the assessment. All API endpoints were successfully queried.');
    } else {
      for (const endpoint of failedEndpoints) {
        ensureSpace(50);
        doc.fillColor(RED).fontSize(10).font('Helvetica-Bold').text(endpoint.endpoint);
        doc.fillColor(BLACK).fontSize(9).font('Helvetica').text(`Error: ${endpoint.error || 'Unknown error'}`);
        doc.moveDown(0.3);
      }
    }

    sectionHeader('7.', 'Conclusion');
    paragraph(
      `Based on the assessment of ${tenantName}, ${passCount} of ${totalActionable} security controls passed, ` +
      `with ${failCount} failing and ${partialCount} showing partial compliance. The tenant's ${passRate}% pass rate ` +
      `indicates the following priority actions: address the ${failCount} failed controls immediately, ` +
      `implement the recommended remediation steps to reduce security risks, and establish ongoing monitoring ` +
      `to maintain and improve the identity security posture over time.`
    );

    ensureSpace(20);
    doc.y = doc.page.height - 30;
    doc.fillColor(GRAY_TEXT).fontSize(8).font('Helvetica')
      .text(`Report generated on ${new Date().toLocaleString()} | Aegis Security Assessment Tool`,
        doc.page.margins.left, doc.y);

    doc.end();

    writeStream.on('finish', () => {
      console.log(`Executive report generated: ${filePath}`);
    });
  }

  async collectAll(): Promise<EntraCollectionResult> {
    const rawData: Record<string, any> = {};
    const errors: EntraCollectionError[] = [];

    const uniqueEndpoints = [...new Set(ENTRA_CONTROLS.flatMap((c) => c.endpoints))];
    uniqueEndpoints.push(ENTRA_ENDPOINTS.ORGANIZATION);

    for (const endpoint of uniqueEndpoints) {
      try {
        // Some endpoints don't support $top parameter, so we don't pass it
        const headers = this.getEndpointHeaders(endpoint);
        const data = await this.client.request({
          tenantConnectionId: this.tenantConnectionId,
          endpoint,
          headers,
        });
        rawData[endpoint] = { value: data.value || data };
      } catch (error: any) {
        errors.push({ endpoint, error: error.message || 'Unknown error', statusCode: error.statusCode });
        rawData[endpoint] = { error: error.message };
      }
    }

    // Fetch directory role members for all roles (needed for several controls)
    const roles = rawData[ENTRA_ENDPOINTS.DIRECTORY_ROLES]?.value || [];
    for (const role of roles) {
      try {
        const memberEndpoint = ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(role.id);
        const data = await this.client.request({ tenantConnectionId: this.tenantConnectionId, endpoint: memberEndpoint });
        rawData[memberEndpoint] = { value: data.value || data };
      } catch (error: any) {
        errors.push({ endpoint: ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(role.id), error: error.message || 'Unknown error', statusCode: error.statusCode });
        rawData[ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(role.id)] = { error: error.message };
      }
    }

    const controls: Record<string, ControlEvaluationResult> = {};
    for (const control of ENTRA_CONTROLS) {
      try {
        controls[control.id] = control.evaluate(rawData);
      } catch (error: any) {
        controls[control.id] = { result: 'needs_manual_review', evidence: `Error: ${error.message}`, recommendation: 'Manual review required.' };
      }
    }

    const status = errors.length === 0 ? 'completed' : Object.keys(controls).length > 0 ? 'partial' : 'failed';

    return { controls, rawData, errors, collectedAt: new Date().toISOString(), status };
  }

  async collectForQuickAssessment(): Promise<EntraCollectionResult> {
    const quickEndpoints = [
      ENTRA_ENDPOINTS.AUTH_METHODS_POLICY,
      ENTRA_ENDPOINTS.SECURITY_DEFAULTS,
      ENTRA_ENDPOINTS.CONDITIONAL_ACCESS_POLICIES,
      ENTRA_ENDPOINTS.NAMED_LOCATIONS,
      ENTRA_ENDPOINTS.DIRECTORY_ROLES,
      ENTRA_ENDPOINTS.ROLE_ELIGIBILITY_SCHEDULES,
      ENTRA_ENDPOINTS.ROLE_ASSIGNMENT_SCHEDULES,
      ENTRA_ENDPOINTS.ROLE_MANAGEMENT_POLICIES,
      ENTRA_ENDPOINTS.GUEST_USERS,
      ENTRA_ENDPOINTS.ACCESS_REVIEWS_DEFINITIONS,
      // Quick assessment informational controls endpoints
      ENTRA_ENDPOINTS.USERS_COUNT,
      ENTRA_ENDPOINTS.GUEST_USERS_COUNT,
      ENTRA_ENDPOINTS.M365_GROUPS_COUNT,
      ENTRA_ENDPOINTS.LICENSED_USERS_COUNT,
      ENTRA_ENDPOINTS.UNLICENSED_USERS_COUNT,
      ENTRA_ENDPOINTS.ADMINISTRATIVE_UNITS_COUNT,
      ENTRA_ENDPOINTS.RISKY_USERS_COUNT,
      ENTRA_ENDPOINTS.CA_POLICIES_COUNT,
      ENTRA_ENDPOINTS.MFA_REGISTRATION_DETAILS,
      ENTRA_ENDPOINTS.SECURE_SCORES,
      ENTRA_ENDPOINTS.ORGANIZATION,
    ];

    const rawData: Record<string, any> = {};
    const errors: EntraCollectionError[] = [];

    // Fetch all endpoints first
    for (const endpoint of quickEndpoints) {
      try {
        // Some endpoints don't support $top parameter, so we don't pass it
        const headers = this.getEndpointHeaders(endpoint);
        const data = await this.client.request({ tenantConnectionId: this.tenantConnectionId, endpoint, headers });
        rawData[endpoint] = { value: data.value || data };
      } catch (error: any) {
        errors.push({ endpoint, error: error.message || 'Unknown error', statusCode: error.statusCode });
        rawData[endpoint] = { error: error.message };
      }
    }

    // Fetch directory role members for all roles (needed for several controls)
    const roles = rawData[ENTRA_ENDPOINTS.DIRECTORY_ROLES]?.value || [];
    for (const role of roles) {
      try {
        const memberEndpoint = ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(role.id);
        const data = await this.client.request({ tenantConnectionId: this.tenantConnectionId, endpoint: memberEndpoint });
        rawData[memberEndpoint] = { value: data.value || data };
      } catch (error: any) {
        errors.push({ endpoint: ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(role.id), error: error.message || 'Unknown error', statusCode: error.statusCode });
        rawData[ENTRA_ENDPOINTS.DIRECTORY_ROLE_MEMBERS(role.id)] = { error: error.message };
      }
    }

    const quickControls = ENTRA_CONTROLS.filter((c) => c.quickAssessment === true);
    const quickInfoControls = ENTRA_CONTROLS.filter((c) => c.quickAssessmentInformational === true);
    const controls: Record<string, ControlEvaluationResult> = {};

    for (const control of quickControls) {
      try {
        controls[control.id] = control.evaluate(rawData);
      } catch (error: any) {
        controls[control.id] = { result: 'needs_manual_review', evidence: `Error: ${error.message}`, recommendation: 'Manual review required.' };
      }
    }

    for (const control of quickInfoControls) {
      try {
        controls[control.id] = control.evaluate(rawData);
      } catch (error: any) {
        controls[control.id] = { result: 'informational', evidence: 'Data not available', recommendation: '' };
      }
    }

    const status = errors.length === 0 ? 'completed' : Object.keys(controls).length > 0 ? 'partial' : 'failed';
    return { controls, rawData, errors, collectedAt: new Date().toISOString(), status };
  }
}

export async function createEntraCollector(tenantConnectionId: string): Promise<EntraCollector | null> {
  try {
    const accessToken = await getAccessTokenForTenant(tenantConnectionId);
    return new EntraCollector(tenantConnectionId, accessToken);
  } catch (error: any) {
    if (error instanceof AuthenticationError) {
      console.error(`Entra authentication failed for ${tenantConnectionId}: ${error.message}`);
    } else {
      console.error(`Failed to get access token for Entra collector ${tenantConnectionId}:`, error);
    }
    return null;
  }
}
