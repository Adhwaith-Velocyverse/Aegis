import { z } from 'zod';
import { AntiPhishPolicy, AntiPhishRule, AntiSpamPolicy, AntiSpamRule, AntiMalwarePolicy, AntiMalwareRule, SafeLinksPolicy, SafeLinksRule, SafeAttachmentPolicy, SafeAttachmentRule, ExchangeConnector, TransportRule, Mailbox, DistributionGroup } from '../types/m365';
import { EmailCollectionError } from './emailCollector';

const emailSchema = z.object({
  module: z.literal('Email'),
  schemaVersion: z.string(),
  tenant: z.object({
    tenantId: z.string(),
    tenantName: z.string().optional(),
  }),
  collectedAt: z.string().datetime(),
  collector: z.object({
    type: z.string(),
    version: z.string().optional(),
  }),
  connection: z.object({
    status: z.enum(['connected', 'disconnected', 'error']),
    validatedAt: z.string().datetime().optional(),
  }),
  policies: z.object({
    antiPhishing: z.object({
      policies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        phishThresholdLevel: z.number().optional(),
        allowlistIds: z.array(z.string()).optional(),
        blocklistIds: z.array(z.string()).optional(),
        impersonationProtectionState: z.string().optional(),
        spoofIntelligenceProtectionState: z.string().optional(),
        dmarcPolicy: z.string().optional(),
        targetUsers: z.array(z.string()).optional(),
        targetDomains: z.array(z.string()).optional(),
      })),
      rules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
    }),
    antiSpam: z.object({
      inboundPolicies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        highConfidenceSpamAction: z.string().optional(),
        spamAction: z.string().optional(),
        bulkSpamAction: z.string().optional(),
        phishingSpamAction: z.string().optional(),
        zapEnabled: z.boolean().optional(),
        deleteMessage: z.boolean().optional(),
      })),
      inboundRules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
      outboundPolicies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        highConfidenceSpamAction: z.string().optional(),
        spamAction: z.string().optional(),
        bulkSpamAction: z.string().optional(),
        phishingSpamAction: z.string().optional(),
        zapEnabled: z.boolean().optional(),
        deleteMessage: z.boolean().optional(),
      })),
      outboundRules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
    }),
    antiMalware: z.object({
      policies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        action: z.string().optional(),
        zapEnabled: z.boolean().optional(),
        commonAttachmentTypesFilterEnabled: z.boolean().optional(),
        notifySenderAction: z.string().optional(),
        notifyRecipientAction: z.string().optional(),
      })),
      rules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
    }),
    safeLinks: z.object({
      policies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        urlScanningEnabled: z.boolean().optional(),
        enableForInternalMail: z.boolean().optional(),
        realTimeScanningEnabled: z.boolean().optional(),
        trackClicks: z.boolean().optional(),
      })),
      rules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
    }),
    safeAttachments: z.object({
      policies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        action: z.string().optional(),
        dynamicDeliveryEnabled: z.boolean().optional(),
      })),
      rules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
    }),
  }),
  mailFlow: z.object({
    acceptedDomains: z.array(z.object({
      name: z.string(),
      type: z.string(),
      isDefault: z.boolean().optional(),
    })),
    inboundConnectors: z.array(z.object({
      name: z.string(),
      connectorType: z.enum(['Inbound', 'Outbound']),
      enabled: z.boolean(),
      requireTls: z.boolean(),
      trustedIPs: z.array(z.string()).optional(),
      tlsCertificate: z.object({
        subject: z.string(),
        issuer: z.string(),
      }).optional(),
      comment: z.string().optional(),
    })),
    outboundConnectors: z.array(z.object({
      name: z.string(),
      connectorType: z.enum(['Inbound', 'Outbound']),
      enabled: z.boolean(),
      requireTls: z.boolean(),
      trustedIPs: z.array(z.string()).optional(),
      tlsCertificate: z.object({
        subject: z.string(),
        issuer: z.string(),
      }).optional(),
      comment: z.string().optional(),
    })),
    transportRules: z.array(z.object({
      name: z.string(),
      state: z.string(),
      mode: z.string().optional(),
      priority: z.number(),
      conditions: z.record(z.any()),
      exceptions: z.record(z.any()),
      actions: z.record(z.any()),
    })),
    transportConfig: z.object({
      smtpClientAuthenticationDisabled: z.boolean().optional(),
    }).optional(),
    smtpAuthDisabled: z.boolean().nullable().optional(),
    popImapStatus: z.array(z.object({
      popEnabled: z.boolean(),
      imapEnabled: z.boolean(),
    })).optional(),
  }),
  mailboxes: z.object({
    all: z.array(z.object({
      identity: z.string(),
      displayName: z.string().optional(),
      primarySmtpAddress: z.string().optional(),
      recipientType: z.string().optional(),
      smtpAuthEnabled: z.boolean().optional(),
      popEnabled: z.boolean().optional(),
      imapEnabled: z.boolean().optional(),
      isShared: z.boolean().optional(),
      isResource: z.boolean().optional(),
    })),
    user: z.array(z.object({
      identity: z.string(),
      primarySmtpAddress: z.string().optional(),
    })),
    shared: z.array(z.object({
      identity: z.string(),
      primarySmtpAddress: z.string().optional(),
    })),
    resource: z.array(z.object({
      identity: z.string(),
      primarySmtpAddress: z.string().optional(),
    })),
  }),
  groups: z.object({
    distribution: z.array(z.object({
      identity: z.string(),
      displayName: z.string().optional(),
      primarySmtpAddress: z.string().optional(),
      groupType: z.string(),
      memberCount: z.number().optional(),
    })),
    dynamicDistribution: z.array(z.object({
      identity: z.string(),
      displayName: z.string().optional(),
      primarySmtpAddress: z.string().optional(),
      groupType: z.string(),
      memberCount: z.number().optional(),
    })),
    microsoft365: z.array(z.object({
      id: z.string(),
      displayName: z.string().optional(),
      mail: z.string().optional(),
    })),
    mailEnabledSecurity: z.array(z.object({
      identity: z.string(),
      displayName: z.string().optional(),
      primarySmtpAddress: z.string().optional(),
      groupType: z.string(),
    })),
  }),
  security: z.object({
    alerts: z.array(z.any()),
    incidents: z.array(z.any()),
    tenantAllowBlockList: z.array(z.any()),
  }),
  metrics: z.object({
    totalMailboxes: z.number(),
    userMailboxes: z.number(),
    sharedMailboxes: z.number(),
    resourceMailboxes: z.number(),
    distributionGroups: z.number(),
    dynamicDistributionGroups: z.number(),
    m365Groups: z.number(),
    mailEnabledSecurityGroups: z.number(),
  }),
  collectionErrors: z.array(z.object({
    command: z.string(),
    type: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  })).optional(),
});

export interface EmailAssessmentData extends z.infer<typeof emailSchema> {}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: (string | number)[]; message: string }>;
  data?: any;
}

export function validateEmailAssessmentData(input: unknown): ValidationResult {
  try {
    const data = emailSchema.parse(input);
    return { valid: true, errors: [], data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error.errors.map(e => ({ path: e.path, message: e.message })), data: undefined };
    }
    return { valid: false, errors: [{ path: [], message: 'Unknown validation error' }], data: undefined };
  }
}

const collectorResultSchema = z.object({
  moduleName: z.literal('Email'),
  collectedAt: z.string().datetime(),
  status: z.enum(['completed', 'partial', 'failed']),
  data: z.object({
    antiPhishing: z.object({
      policies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        phishThresholdLevel: z.number().optional(),
        allowlistIds: z.array(z.string()).optional(),
        blocklistIds: z.array(z.string()).optional(),
        impersonationProtectionState: z.string().optional(),
        spoofIntelligenceProtectionState: z.string().optional(),
        dmarcPolicy: z.string().optional(),
        targetUsers: z.array(z.string()).optional(),
        targetDomains: z.array(z.string()).optional(),
      })),
      rules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
    }),
    antiSpam: z.object({
      inboundPolicies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        highConfidenceSpamAction: z.string().optional(),
        spamAction: z.string().optional(),
        bulkSpamAction: z.string().optional(),
        phishingSpamAction: z.string().optional(),
        zapEnabled: z.boolean().optional(),
        deleteMessage: z.boolean().optional(),
      })),
      inboundRules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
      outboundPolicies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        highConfidenceSpamAction: z.string().optional(),
        spamAction: z.string().optional(),
        bulkSpamAction: z.string().optional(),
        phishingSpamAction: z.string().optional(),
        zapEnabled: z.boolean().optional(),
        deleteMessage: z.boolean().optional(),
      })),
      outboundRules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
    }),
    antiMalware: z.object({
      policies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        action: z.string().optional(),
        zapEnabled: z.boolean().optional(),
        commonAttachmentTypesFilterEnabled: z.boolean().optional(),
        notifySenderAction: z.string().optional(),
        notifyRecipientAction: z.string().optional(),
      })),
      rules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
    }),
    safeLinks: z.object({
      policies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        urlScanningEnabled: z.boolean().optional(),
        enableForInternalMail: z.boolean().optional(),
        realTimeScanningEnabled: z.boolean().optional(),
        trackClicks: z.boolean().optional(),
      })),
      rules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
    }),
    safeAttachments: z.object({
      policies: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        action: z.string().optional(),
        dynamicDeliveryEnabled: z.boolean().optional(),
      })),
      rules: z.array(z.object({
        name: z.string(),
        priority: z.number(),
        state: z.string(),
        policy: z.string(),
      })),
    }),
    mailFlow: z.object({
      acceptedDomains: z.array(z.object({
        name: z.string(),
        type: z.string(),
        isDefault: z.boolean().optional(),
      })),
      inboundConnectors: z.array(z.object({
        name: z.string(),
        connectorType: z.enum(['Inbound', 'Outbound']),
        enabled: z.boolean(),
        requireTls: z.boolean(),
        trustedIPs: z.array(z.string()).optional(),
        tlsCertificate: z.object({
          subject: z.string(),
          issuer: z.string(),
        }).optional(),
        comment: z.string().optional(),
      })),
      outboundConnectors: z.array(z.object({
        name: z.string(),
        connectorType: z.enum(['Inbound', 'Outbound']),
        enabled: z.boolean(),
        requireTls: z.boolean(),
        trustedIPs: z.array(z.string()).optional(),
        tlsCertificate: z.object({
          subject: z.string(),
          issuer: z.string(),
        }).optional(),
        comment: z.string().optional(),
      })),
      transportRules: z.array(z.object({
        name: z.string(),
        state: z.string(),
        mode: z.string().optional(),
        priority: z.number(),
        conditions: z.record(z.any()),
        exceptions: z.record(z.any()),
        actions: z.record(z.any()),
      })),
      transportConfig: z.object({
        smtpClientAuthenticationDisabled: z.boolean().optional(),
      }).optional(),
      smtpAuthDisabled: z.boolean().nullable().optional(),
      popImapStatus: z.array(z.object({
        popEnabled: z.boolean(),
        imapEnabled: z.boolean(),
      })).optional(),
    }),
    mailboxes: z.object({
      all: z.array(z.object({
        identity: z.string(),
        displayName: z.string().optional(),
        primarySmtpAddress: z.string().optional(),
        recipientType: z.string().optional(),
        smtpAuthEnabled: z.boolean().optional(),
        popEnabled: z.boolean().optional(),
        imapEnabled: z.boolean().optional(),
        isShared: z.boolean().optional(),
        isResource: z.boolean().optional(),
      })),
      user: z.array(z.object({
        identity: z.string(),
        primarySmtpAddress: z.string().optional(),
      })),
      shared: z.array(z.object({
        identity: z.string(),
        primarySmtpAddress: z.string().optional(),
      })),
      resource: z.array(z.object({
        identity: z.string(),
        primarySmtpAddress: z.string().optional(),
      })),
    }),
    groups: z.object({
      distribution: z.array(z.object({
        identity: z.string(),
        displayName: z.string().optional(),
        primarySmtpAddress: z.string().optional(),
        groupType: z.string(),
        memberCount: z.number().optional(),
      })),
      dynamicDistribution: z.array(z.object({
        identity: z.string(),
        displayName: z.string().optional(),
        primarySmtpAddress: z.string().optional(),
        groupType: z.string(),
        memberCount: z.number().optional(),
      })),
      microsoft365: z.array(z.object({
        id: z.string(),
        displayName: z.string().optional(),
        mail: z.string().optional(),
      })),
      mailEnabledSecurity: z.array(z.object({
        identity: z.string(),
        displayName: z.string().optional(),
        primarySmtpAddress: z.string().optional(),
        groupType: z.string(),
      })),
    }),
    security: z.object({
      alerts: z.array(z.any()),
      incidents: z.array(z.any()),
      tenantAllowBlockList: z.array(z.any()),
    }),
    metrics: z.object({
      totalMailboxes: z.number(),
      userMailboxes: z.number(),
      sharedMailboxes: z.number(),
      resourceMailboxes: z.number(),
      distributionGroups: z.number(),
      dynamicDistributionGroups: z.number(),
      m365Groups: z.number(),
      mailEnabledSecurityGroups: z.number(),
    }),
  }),
  errors: z.array(z.object({
    command: z.string(),
    type: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  })).optional(),
  raw: z.record(z.any()).optional(),
});

export function validateEmailCollectionResult(result: any): ValidationResult {
  if (!result || typeof result !== 'object') {
    return { valid: false, errors: [{ path: [], message: 'Result must be an object' }], data: undefined };
  }

  try {
    const data = collectorResultSchema.parse(result);
    return { valid: true, errors: [], data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error.errors.map(e => ({ path: e.path, message: e.message })), data: undefined };
    }
    return { valid: false, errors: [{ path: [], message: 'Unknown validation error' }], data: undefined };
  }
}

export function hasCollectionErrors(result: EmailAssessmentData): boolean {
  return (result.collectionErrors?.length || 0) > 0;
}

export function getAffectedCommands(result: EmailAssessmentData): string[] {
  return result.collectionErrors?.map((e) => e.command) || [];
}
