// Shared types for Aegis platform

export type PlatformRole = 'client' | 'admin' | 'assessor';
export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';
export type AssessmentType = 'trial' | 'quick' | 'detailed';
export type AssessmentStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type ConnectionStatus = 'connected' | 'needs_attention' | 'disconnected';
export type ControlResult = 'pass' | 'fail' | 'not_applicable' | 'needs_manual_review' | 'error' | 'info';
export type FindingSource = 'automated' | 'manual';
export type DetailedRequestStatus = 'unassigned' | 'assigned' | 'in_review' | 'awaiting_client' | 'completed';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  platformRole: PlatformRole;
  orgRole?: OrgRole;
  organizationId?: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  industry?: string;
  companySize?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  email: string;
  fullName: string;
  role: PlatformRole;
  orgRole: OrgRole;
  createdAt: Date;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  role: PlatformRole;
  orgRole: OrgRole;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface TenantConnection {
  id: string;
  organizationId: string;
  tenantId: string;
  tenantName: string;
  consentedScopes: string[];
  connectionStatus: ConnectionStatus;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Assessment {
  id: string;
  organizationId: string;
  tenantConnectionId?: string;
  type: AssessmentType;
  status: AssessmentStatus;
  overallScore?: number;
  scoreBand?: string;
  controlsAssessed?: number;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  createdAt: Date;
  updatedAt: Date;
  tenantName?: string;
  assessmentOwner?: string;
}

export interface AssessmentModule {
  id: string;
  assessmentId: string;
  moduleName: string;
  collectionStatus: string;
  moduleScore?: number;
  passedCount?: number;
  failedCount?: number;
  notApplicableCount?: number;
  rawDataPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ControlCatalog {
  id: string;
  moduleName: string;
  controlName: string;
  description: string;
  weight: number;
  severity: string;
  frameworkRefs: string[];
  automatable: boolean;
  version: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Finding {
  id: string;
  assessmentModuleId: string;
  controlCatalogId: string;
  result: ControlResult;
  severity: string;
  evidence: string;
  recommendation: string;
  source: FindingSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: string;
  assessmentId: string;
  format: 'pdf' | 'excel';
  storagePath: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface DetailedAssessmentRequest {
  id: string;
  assessmentId: string;
  status: DetailedRequestStatus;
  assignedAssessorId?: string;
  requestedOn: Date;
  assignedOn?: Date;
  completedOn?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Assessor {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive';
  addedOn: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthly: number;
  includedTenantSlots: number;
  includedQuickCredits: number;
  includedDetailedCredits: number;
  seatLimit: number;
  features: Record<string, boolean>;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  addonTenantSlots: number;
  billingStatus: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageLedger {
  id: string;
  organizationId: string;
  subscriptionId: string;
  type: 'credit_grant' | 'credit_consumption' | 'tenant_slot';
  amount: number;
  description: string;
  createdAt: Date;
}

export interface DashboardTenantContext {
  id: string;
  tenantName: string;
  connectionStatus: 'connected' | 'needs_attention' | 'disconnected';
  lastHealthCheck?: string;
  lastAssessedAt?: string;
}

export interface DashboardLatestAssessment {
  id: string;
  type: 'trial' | 'quick' | 'detailed';
  status: string;
  overallScore: number | null;
  securityRating: string;
  scoreBand?: string;
  bandColor?: string;
  bandDescription?: string;
  completedAt?: string;
  calculatedAt?: string;
  summary: {
    totalControls: number;
    assessedControls: number;
    passedControls: number;
    failedControls: number;
    partialControls: number;
    notAssessedControls: number;
    technicalErrors: number;
  };
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryScores: Array<{
    name: string;
    score: number;
    totalControls: number;
    passedControls: number;
    failedControls: number;
    partialControls: number;
    notAssessedControls: number;
  }>;
}

export interface DashboardActiveAssessment {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percent: number;
  };
}

export interface DashboardFinding {
  id: string;
  controlName: string;
  moduleName: string;
  result: string;
  severity: string;
  evidence: string;
  recommendation: string;
}

export interface DashboardRecommendation {
  id: string;
  title: string;
  description: string;
  severity: string;
  priority: number;
  remediation?: string;
  affectedControls?: string[];
}

export interface DashboardRecentAssessment {
  id: string;
  type: string;
  status: string;
  overallScore?: number;
  scoreBand?: string;
  completedAt?: string;
  createdAt: string;
}

export interface DashboardTrend {
  trialScores: Array<{ date: string; score: number }>;
  postureScores: Array<{ date: string; score: number; type: string }>;
}

export interface DashboardSummary {
  tenant: DashboardTenantContext | null;
  latestAssessment: DashboardLatestAssessment | null;
  activeAssessment: DashboardActiveAssessment | null;
  priorityFindings: DashboardFinding[];
  recommendations: DashboardRecommendation[];
  recentAssessments: DashboardRecentAssessment[];
  trend: DashboardTrend;
}

export interface TrialQuestionnaire {
  id: string;
  question: string;
  category: string;
  weight: number;
  order: number;
}

export interface TrialAnswer {
  id: string;
  assessmentId: string;
  questionId: string;
  answer: 'yes' | 'no' | 'unsure';
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
