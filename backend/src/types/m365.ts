export enum M365ConnectionState {
  PENDING = 'PENDING',
  AUTHENTICATING = 'AUTHENTICATING',
  CONNECTED = 'CONNECTED',
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  PERMISSION_FAILED = 'PERMISSION_FAILED',
  TENANT_VALIDATION_FAILED = 'TENANT_VALIDATION_FAILED',
  CERTIFICATE_EXPIRED = 'CERTIFICATE_EXPIRED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

export enum AuthenticationMode {
  DELEGATED = 'DELEGATED',
  APPLICATION = 'APPLICATION',
}

export interface ConnectionMetadata {
  connectionId: string;
  tenantId: string;
  tenantName: string;
  organizationId: string;
  authenticationMode: AuthenticationMode;
  graphConnected: boolean;
  exchangeConnected: boolean;
  permissionsValidated: boolean;
  lastHealthCheck?: Date;
  state: M365ConnectionState;
  consentedScopes: string[];
  supportedModules: string[];
}

export interface HealthCheckResult {
  status: M365ConnectionState;
  graphAvailable: boolean;
  exchangeAvailable: boolean;
  tenantValidated: boolean;
  permissionsValidated: boolean;
  checkedAt: Date;
  details: string[];
  errors: string[];
}

export interface TenantInfo {
  id: string;
  displayName: string;
  verifiedDomains: { name: string; type: string }[];
  tenantId: string;
}

export interface User {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
  userType: 'Member' | 'Guest';
  accountEnabled: boolean;
  onPremisesSyncEnabled?: boolean;
  onPremisesImmutableId?: string;
  createdDateTime?: string;
  lastSignInDateTime?: string;
  memberOf: string[];
}

export interface Group {
  id: string;
  displayName: string;
  description?: string;
  mailEnabled: boolean;
  securityEnabled: boolean;
  groupTypes: string[];
  memberCount: number;
}

export interface DirectoryRole {
  id: string;
  displayName: string;
  description?: string;
  members: string[];
}

export interface RoleAssignment {
  id: string;
  principalId: string;
  principalType: 'User' | 'ServicePrincipal';
  roleDefinitionId: string;
  roleDefinitionDisplayName: string;
  directoryScopeId: string;
  assignmentType: 'Assigned' | 'Eligible' | 'Activated';
  startDateTime?: string;
  endDateTime?: string;
}

export interface ConditionalAccessPolicy {
  id: string;
  displayName: string;
  state: 'enabled' | 'disabled' | 'enabledForReportingButNotEnforced';
  conditions: {
    users?: { includeRoles?: string[]; excludeRoles?: string[] };
    locations?: { includeLocations?: string[]; excludeLocations?: string[] };
    clientAppTypes?: string[];
    servicePrincipalRiskLevels?: string[];
    signInRiskLevels?: string[];
  };
  grantControls: { operator: string; builtInControls: string[] };
  sessionControls?: { signInFrequency?: any; persistentBrowser?: any };
}

export interface AuthenticationMethodPolicy {
  id: string;
  displayName: string;
  state: 'enabled' | 'disabled';
  methodType: string;
  properties: Record<string, any>;
}

export interface AccessReview {
  id: string;
  displayName: string;
  status: string;
  scope: string;
  reviewType: string;
  recurrencePattern?: { type: string; interval: number };
  settings: {
    autoApplyDecisionsEnabled: boolean;
    defaultDecisionEnabled: boolean;
    defaultDecision: string;
    recurseCount?: number;
  };
}

export interface Application {
  id: string;
  displayName: string;
  appId: string;
  signInAudience: string;
  createdDateTime: string;
  web?: { redirectUris: string[] };
  spa?: { redirectUris: string[] };
  requiredResourceAccess?: { resourceAppId: string; resourceAccess: { id: string; type: string }[] }[];
}

export interface ServicePrincipal {
  id: string;
  displayName: string;
  appId: string;
  servicePrincipalType: string;
  accountEnabled: boolean;
  tags: string[];
}

export interface AuditEvent {
  id: string;
  category: string;
  activityDisplayName: string;
  result: string;
  loggedByService: string;
  initiatedBy?: { user?: { displayName?: string; id?: string } };
  createdDateTime: string;
}

export interface RiskDetection {
  id: string;
  riskType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'hidden';
  riskState: string;
  source: string;
  targetUserDisplayName?: string;
  detectedDateTime: string;
  lastUpdatedDateTime: string;
}

export interface AntiPhishPolicy {
  name: string;
  enabled: boolean;
  phishThresholdLevel: number;
  allowlistIds: string[];
  blocklistIds: string[];
  impersonationProtectionState: string;
  spoofIntelligenceProtectionState: string;
  dmarcPolicy: string;
  targetUsers?: string[];
  targetDomains?: string[];
}

export interface AntiPhishRule {
  name: string;
  priority: number;
  state: string;
  policy: string;
}

export interface AntiSpamPolicy {
  name: string;
  enabled: boolean;
  highConfidenceSpamAction: string;
  spamAction: string;
  bulkSpamAction: string;
  phishingSpamAction: string;
  zapEnabled: boolean;
  deleteMessage: boolean;
}

export interface AntiSpamRule {
  name: string;
  priority: number;
  state: string;
  policy: string;
}

export interface AntiMalwarePolicy {
  name: string;
  enabled: boolean;
  action: string;
  zapEnabled: boolean;
  commonAttachmentTypesFilterEnabled: boolean;
  notifySenderAction: string;
  notifyRecipientAction: string;
}

export interface AntiMalwareRule {
  name: string;
  priority: number;
  state: string;
  policy: string;
}

export interface SafeLinksPolicy {
  name: string;
  enabled: boolean;
  urlScanningEnabled: boolean;
  enableForInternalMail: boolean;
  realTimeScanningEnabled: boolean;
  trackClicks: boolean;
}

export interface SafeLinksRule {
  name: string;
  priority: number;
  state: string;
  policy: string;
}

export interface SafeAttachmentPolicy {
  name: string;
  enabled: boolean;
  action: string;
  dynamicDeliveryEnabled: boolean;
}

export interface SafeAttachmentRule {
  name: string;
  priority: number;
  state: string;
  policy: string;
}

export interface ExchangeConnector {
  name: string;
  connectorType: 'Inbound' | 'Outbound';
  enabled: boolean;
  requireTls: boolean;
  trustedIPs: string[];
  tlsCertificate?: { subject: string; issuer: string };
  comment?: string;
}

export interface TransportRule {
  name: string;
  state: string;
  mode: string;
  priority: number;
  conditions: Record<string, any>;
  exceptions: Record<string, any>;
  actions: Record<string, any>;
}

export interface Mailbox {
  identity: string;
  displayName?: string;
  primarySmtpAddress?: string;
  recipientType?: string;
  externalDirectoryObjectId?: string;
  smtpAuthEnabled?: boolean;
  popEnabled?: boolean;
  imapEnabled?: boolean;
  isShared?: boolean;
  isResource?: boolean;
  isTeamSiteMailbox?: boolean;
}

export interface DistributionGroup {
  identity: string;
  displayName?: string;
  primarySmtpAddress?: string;
  groupType: 'Distribution' | 'MailEnabledSecurity' | 'DynamicDistribution';
  externalDirectoryObjectId?: string;
  memberCount?: number;
}

export interface ModuleCollectionResult<T = any> {
  moduleName: string;
  connectorType: 'graph' | 'powershell';
  collectedAt: string;
  data: T[];
  rawData?: any;
  errors: CollectionError[];
  status: 'completed' | 'partial' | 'failed';
  metadata: { recordCount: number; durationMs: number };
}

export interface CollectionError {
  type: string;
  message: string;
  operation: string;
  statusCode?: number;
  retryable: boolean;
  retryAfter?: number;
}

export interface DataNormalizationResult<T> {
  normalized: T[];
  rawResponse: any;
  metadata: {
    tenantId: string;
    source: string;
    sourceEndpoint: string;
    retrievedAt: string;
    recordCount: number;
  };
}
