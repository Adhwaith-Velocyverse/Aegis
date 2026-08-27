import { DataNormalizationResult, TenantInfo, User, Group, DirectoryRole, RoleAssignment, ConditionalAccessPolicy, AuthenticationMethodPolicy, AccessReview, Application, ServicePrincipal, AuditEvent, RiskDetection, AntiPhishPolicy, AntiPhishRule, AntiSpamPolicy, AntiSpamRule, AntiMalwarePolicy, AntiMalwareRule, SafeLinksPolicy, SafeLinksRule, SafeAttachmentPolicy, SafeAttachmentRule, ExchangeConnector, TransportRule, Mailbox, DistributionGroup } from '../types/m365';

export class DataNormalizationService {
  normalizeTenantInfo(raw: any): DataNormalizationResult<TenantInfo> {
    const normalized: TenantInfo = {
      id: raw.id,
      displayName: raw.displayName,
      verifiedDomains: raw.verifiedDomains || [],
      tenantId: raw.id,
    };
    return {
      normalized: [normalized],
      rawResponse: raw,
      metadata: { tenantId: raw.id, source: 'graph', sourceEndpoint: '/organization', retrievedAt: new Date().toISOString(), recordCount: 1 },
    };
  }

  normalizeUsers(raw: any[]): DataNormalizationResult<User> {
    const normalized: User[] = raw.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      userPrincipalName: u.userPrincipalName,
      mail: u.mail,
      userType: u.userType === 'Guest' ? 'Guest' : 'Member',
      accountEnabled: u.accountEnabled,
      onPremisesSyncEnabled: u.onPremisesSyncEnabled,
      onPremisesImmutableId: u.onPremisesImmutableId,
      createdDateTime: u.createdDateTime,
      lastSignInDateTime: u.lastSignInDateTime,
      memberOf: [],
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'graph', sourceEndpoint: '/users', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeGroups(raw: any[]): DataNormalizationResult<Group> {
    const normalized: Group[] = raw.map((g) => ({
      id: g.id,
      displayName: g.displayName,
      description: g.description,
      mailEnabled: g.mailEnabled,
      securityEnabled: g.securityEnabled,
      groupTypes: g.groupTypes || [],
      memberCount: g.membersCount || g.members?.length || 0,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'graph', sourceEndpoint: '/groups', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeDirectoryRoles(raw: any[]): DataNormalizationResult<DirectoryRole> {
    const normalized: DirectoryRole[] = raw.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      description: r.description,
      members: (r.members || []).map((m: any) => m.id),
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'graph', sourceEndpoint: '/directoryRoles', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeConditionalAccessPolicies(raw: any[]): DataNormalizationResult<ConditionalAccessPolicy> {
    const normalized: ConditionalAccessPolicy[] = raw.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      state: p.state,
      conditions: {
        users: p.conditions?.users,
        locations: p.conditions?.locations,
        clientAppTypes: p.conditions?.clientAppTypes,
        servicePrincipalRiskLevels: p.conditions?.servicePrincipalRiskLevels,
        signInRiskLevels: p.conditions?.signInRiskLevels,
      },
      grantControls: {
        operator: p.grantControls?.operator || 'OR',
        builtInControls: p.grantControls?.builtInControls || [],
      },
      sessionControls: p.sessionControls,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'graph', sourceEndpoint: '/identity/conditionalAccess/policies', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeAuthenticationMethodPolicies(raw: any[]): DataNormalizationResult<AuthenticationMethodPolicy> {
    const normalized: AuthenticationMethodPolicy[] = raw.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      state: p.state,
      methodType: p.methodType || p.id,
      properties: p,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'graph', sourceEndpoint: '/policies/authenticationMethodsPolicy', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeAccessReviews(raw: any[]): DataNormalizationResult<AccessReview> {
    const normalized: AccessReview[] = raw.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      status: r.status,
      scope: r.scope,
      reviewType: r.reviewType,
      recurrencePattern: r.recurrencePattern,
      settings: {
        autoApplyDecisionsEnabled: r.settings?.autoApplyDecisionsEnabled || false,
        defaultDecisionEnabled: r.settings?.defaultDecisionEnabled || false,
        defaultDecision: r.settings?.defaultDecision || 'None',
        recurseCount: r.settings?.recurseCount,
      },
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'graph', sourceEndpoint: '/identityGovernance/accessReviews/definitions', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeApplications(raw: any[]): DataNormalizationResult<Application> {
    const normalized: Application[] = raw.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      appId: a.appId,
      signInAudience: a.signInAudience,
      createdDateTime: a.createdDateTime,
      web: a.web,
      spa: a.spa,
      requiredResourceAccess: a.requiredResourceAccess,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'graph', sourceEndpoint: '/applications', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeServicePrincipals(raw: any[]): DataNormalizationResult<ServicePrincipal> {
    const normalized: ServicePrincipal[] = raw.map((sp) => ({
      id: sp.id,
      displayName: sp.displayName,
      appId: sp.appId,
      servicePrincipalType: sp.servicePrincipalType,
      accountEnabled: sp.accountEnabled,
      tags: sp.tags || [],
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'graph', sourceEndpoint: '/servicePrincipals', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeAuditEvents(raw: any[]): DataNormalizationResult<AuditEvent> {
    const normalized: AuditEvent[] = raw.map((e) => ({
      id: e.id,
      category: e.category,
      activityDisplayName: e.activityDisplayName,
      result: e.result,
      loggedByService: e.loggedByService,
      initiatedBy: e.initiatedBy,
      createdDateTime: e.createdDateTime,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'graph', sourceEndpoint: '/auditLogs', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeRiskDetections(raw: any[]): DataNormalizationResult<RiskDetection> {
    const normalized: RiskDetection[] = raw.map((r) => ({
      id: r.id,
      riskType: r.riskType,
      riskLevel: r.riskLevel,
      riskState: r.riskState,
      source: r.source,
      targetUserDisplayName: r.targetUser?.displayName,
      detectedDateTime: r.detectedDateTime,
      lastUpdatedDateTime: r.lastUpdatedDateTime,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'graph', sourceEndpoint: '/identityProtection/riskDetections', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeAntiPhishPolicies(raw: any[]): DataNormalizationResult<AntiPhishPolicy> {
    const normalized: AntiPhishPolicy[] = raw.map((p) => ({
      name: p.Name || p.name,
      enabled: p.Enabled ?? p.enabled ?? false,
      phishThresholdLevel: p.PhishThresholdLevel ?? p.phishThresholdLevel ?? 3,
      allowlistIds: p.AllowlistIds || p.allowlistIds || [],
      blocklistIds: p.BlocklistIds || p.blocklistIds || [],
      impersonationProtectionState: p.ImpersonationProtectionState || p.impersonationProtectionState || 'Disabled',
      spoofIntelligenceProtectionState: p.SpoofIntelligenceProtectionState || p.spoofIntelligenceProtectionState || 'Disabled',
      dmarcPolicy: p.DmarcPolicy || p.dmarcPolicy || 'None',
      targetUsers: p.TargetUsers || p.targetUsers || [],
      targetDomains: p.TargetDomains || p.targetDomains || [],
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-AntiPhishPolicy', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeAntiPhishRules(raw: any[]): DataNormalizationResult<AntiPhishRule> {
    const normalized: AntiPhishRule[] = raw.map((r) => ({
      name: r.Name || r.name,
      priority: r.Priority ?? r.priority ?? 0,
      state: r.State || r.state || 'Disabled',
      policy: r.Policy || r.policy || '',
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-AntiPhishRule', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeAntiSpamPolicies(raw: any[]): DataNormalizationResult<AntiSpamPolicy> {
    const normalized: AntiSpamPolicy[] = raw.map((p) => ({
      name: p.Name || p.name,
      enabled: p.Enabled ?? p.enabled ?? false,
      highConfidenceSpamAction: p.HighConfidenceSpamAction || p.highConfidenceSpamAction || 'MoveToJmf',
      spamAction: p.SpamAction || p.spamAction || 'MoveToJmf',
      bulkSpamAction: p.BulkSpamAction || p.bulkSpamAction || 'MoveToJmf',
      phishingSpamAction: p.PhishingSpamAction || p.phishingSpamAction || 'MoveToJmf',
      zapEnabled: p.ZapEnabled ?? p.zapEnabled ?? false,
      deleteMessage: p.DeleteMessage ?? p.deleteMessage ?? false,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-HostedContentFilterPolicy', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeAntiSpamRules(raw: any[]): DataNormalizationResult<AntiSpamRule> {
    const normalized: AntiSpamRule[] = raw.map((r) => ({
      name: r.Name || r.name,
      priority: r.Priority ?? r.priority ?? 0,
      state: r.State || r.state || 'Disabled',
      policy: r.Policy || r.policy || '',
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-HostedContentFilterRule', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeAntiMalwarePolicies(raw: any[]): DataNormalizationResult<AntiMalwarePolicy> {
    const normalized: AntiMalwarePolicy[] = raw.map((p) => ({
      name: p.Name || p.name,
      enabled: p.Enabled ?? p.enabled ?? false,
      action: p.Action || p.action || 'Default',
      zapEnabled: p.ZapEnabled ?? p.zapEnabled ?? false,
      commonAttachmentTypesFilterEnabled: p.CommonAttachmentTypesFilterEnabled ?? p.commonAttachmentTypesFilterEnabled ?? false,
      notifySenderAction: p.NotifySenderAction || p.notifySenderAction || 'None',
      notifyRecipientAction: p.NotifyRecipientAction || p.notifyRecipientAction || 'None',
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-MalwareFilterPolicy', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeAntiMalwareRules(raw: any[]): DataNormalizationResult<AntiMalwareRule> {
    const normalized: AntiMalwareRule[] = raw.map((r) => ({
      name: r.Name || r.name,
      priority: r.Priority ?? r.priority ?? 0,
      state: r.State || r.state || 'Disabled',
      policy: r.Policy || r.policy || '',
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-MalwareFilterRule', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeSafeLinksPolicies(raw: any[]): DataNormalizationResult<SafeLinksPolicy> {
    const normalized: SafeLinksPolicy[] = raw.map((p) => ({
      name: p.Name || p.name,
      enabled: p.Enabled ?? p.enabled ?? false,
      urlScanningEnabled: p.UrlScanningEnabled ?? p.urlScanningEnabled ?? false,
      enableForInternalMail: p.EnableForInternalMail ?? p.enableForInternalMail ?? false,
      realTimeScanningEnabled: p.RealTimeScanningEnabled ?? p.realTimeScanningEnabled ?? false,
      trackClicks: p.TrackClicks ?? p.trackClicks ?? false,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-SafeLinksPolicy', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeSafeLinksRules(raw: any[]): DataNormalizationResult<SafeLinksRule> {
    const normalized: SafeLinksRule[] = raw.map((r) => ({
      name: r.Name || r.name,
      priority: r.Priority ?? r.priority ?? 0,
      state: r.State || r.state || 'Disabled',
      policy: r.Policy || r.policy || '',
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-SafeLinksRule', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeSafeAttachmentPolicies(raw: any[]): DataNormalizationResult<SafeAttachmentPolicy> {
    const normalized: SafeAttachmentPolicy[] = raw.map((p) => ({
      name: p.Name || p.name,
      enabled: p.Enabled ?? p.enabled ?? false,
      action: p.Action || p.action || 'Default',
      dynamicDeliveryEnabled: p.DynamicDeliveryEnabled ?? p.dynamicDeliveryEnabled ?? false,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-SafeAttachmentPolicy', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeSafeAttachmentRules(raw: any[]): DataNormalizationResult<SafeAttachmentRule> {
    const normalized: SafeAttachmentRule[] = raw.map((r) => ({
      name: r.Name || r.name,
      priority: r.Priority ?? r.priority ?? 0,
      state: r.State || r.state || 'Disabled',
      policy: r.Policy || r.policy || '',
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-SafeAttachmentRule', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeConnectors(raw: any[]): DataNormalizationResult<ExchangeConnector> {
    const normalized: ExchangeConnector[] = raw.map((c) => ({
      name: c.Name || c.name,
      connectorType: (c.ConnectorType || c.connectorType || 'Inbound') as 'Inbound' | 'Outbound',
      enabled: c.Enabled ?? c.enabled ?? false,
      requireTls: c.RequireTls ?? c.requireTls ?? false,
      trustedIPs: c.TrustedIPs || c.trustedIPs || [],
      tlsCertificate: c.TlsCertificate || c.tlsCertificate,
      comment: c.Comment || c.comment,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-InboundConnector / Get-OutboundConnector', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeTransportRules(raw: any[]): DataNormalizationResult<TransportRule> {
    const normalized: TransportRule[] = raw.map((r) => ({
      name: r.Name || r.name,
      state: r.State || r.state || 'Disabled',
      mode: r.Mode || r.mode || 'Enforce',
      priority: r.Priority ?? r.priority ?? 0,
      conditions: r.Conditions || r.conditions || {},
      exceptions: r.Exceptions || r.exceptions || {},
      actions: r.Actions || r.actions || {},
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-TransportRule', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeMailboxes(raw: any[]): DataNormalizationResult<Mailbox> {
    const normalized: Mailbox[] = raw.map((m) => ({
      identity: m.Identity || m.identity || m.PrimarySmtpAddress || m.primarySmtpAddress || '',
      displayName: m.DisplayName || m.displayName,
      primarySmtpAddress: m.PrimarySmtpAddress || m.primarySmtpAddress,
      recipientType: m.RecipientType || m.RecipientTypeDetails || m.recipientType,
      externalDirectoryObjectId: m.ExternalDirectoryObjectId || m.externalDirectoryObjectId,
      smtpAuthEnabled: m.SmtpAuthEnabled ?? m.smtpAuthEnabled,
      popEnabled: m.PopEnabled ?? m.popEnabled,
      imapEnabled: m.ImapEnabled ?? m.imapEnabled,
      isShared: m.IsShared ?? m.isShared ?? false,
      isResource: m.IsResource ?? m.isResource ?? false,
      isTeamSiteMailbox: m.IsTeamSiteMailbox ?? m.isTeamSiteMailbox ?? false,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-EXOMailbox', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }

  normalizeDistributionGroups(raw: any[]): DataNormalizationResult<DistributionGroup> {
    const normalized: DistributionGroup[] = raw.map((g) => ({
      identity: g.Identity || g.identity || g.PrimarySmtpAddress || g.primarySmtpAddress || '',
      displayName: g.DisplayName || g.displayName,
      primarySmtpAddress: g.PrimarySmtpAddress || g.primarySmtpAddress,
      groupType: (g.GroupType || g.groupType || 'Distribution') as DistributionGroup['groupType'],
      externalDirectoryObjectId: g.ExternalDirectoryObjectId || g.externalDirectoryObjectId,
      memberCount: g.MemberCount || g.memberCount || g.Members?.length || 0,
    }));
    return {
      normalized,
      rawResponse: raw,
      metadata: { tenantId: '', source: 'exchange', sourceEndpoint: 'Get-DistributionGroup', retrievedAt: new Date().toISOString(), recordCount: raw.length },
    };
  }
}
