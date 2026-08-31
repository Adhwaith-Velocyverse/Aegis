import { describe, it, expect } from 'vitest';
import { evaluateEmailSecurityControl, EMAIL_SECURITY_CONTROLS } from '../emailSecurityEvaluator';

const NEW_FORMAT_DATA = {
  'anti-phish-policy': [{ Enabled: true, IsDefault: true }],
  'anti-phish-rule': [],
  'hosted-content-filter-policy': [{ Enabled: true, IsDefault: true }],
  'hosted-content-filter-rule': [{ Enabled: true }],
  'hosted-outbound-spam-filter-policy': [{ Enabled: true, ActionWhenThresholdReached: 'BlockUser' }],
  'hosted-outbound-spam-filter-rule': [{ Enabled: true }],
  'malware-filter-policy': [{ Enabled: true, IsDefault: true }],
  'malware-filter-rule': [{ Enabled: true }],
  'safe-links-policy': [{ IsEnabled: true, IsDefault: true }],
  'safe-links-rule': [{ Enabled: true }],
  'safe-attachment-policy': [{ Enable: true, IsDefault: true }],
  'safe-attachment-rule': [{ Enabled: true }],
  'accepted-domain': [{ DomainType: 'Authoritative', DirectoryBasedEdgeBlockingEnabled: true }],
  'graph-directory-roles': [{ displayName: 'Exchange Administrator', members: [{ id: '1' }] }],
  'transport-config': { SmtpClientAuthenticationDisabled: true },
  'exo-cas-mailbox': [],
  'inbound-connector': [{ Enabled: true, RequireTLS: true }],
  'outbound-connector': [],
  'transport-rule': [
    { State: 'Enabled', Mode: 'Enforce', Name: 'Block Auto-Forward External', Conditions: { SentToScope: 'External' }, Actions: { RejectMessage: true } },
    { State: 'Enabled', Mode: 'Enforce', Name: 'External Sender Warning', Conditions: { FromAddressContains: '@external.com' }, Actions: { PrependSubject: 'External: ', AddDisclaimer: true } },
  ],
  'exo-mailbox': [],
  'graph-security-alerts': [],
  'graph-security-incidents': [],
  'tenant-allow-block-list-items': [],
};

const OLD_FORMAT_DATA = {
  antiPhishing: { policies: [{ Enabled: true, IsDefault: true }], rules: [] },
  antiSpam: {
    inboundPolicies: [{ Enabled: true, IsDefault: true }],
    inboundRules: [{ Enabled: true }],
    outboundPolicies: [{ Enabled: true, ActionWhenThresholdReached: 'BlockUser' }],
    outboundRules: [{ Enabled: true }],
  },
  antiMalware: { policies: [{ Enabled: true, IsDefault: true }], rules: [{ Enabled: true }] },
  safeLinks: { policies: [{ IsEnabled: true, IsDefault: true }], rules: [{ Enabled: true }] },
  safeAttachments: { policies: [{ Enable: true, IsDefault: true }], rules: [{ Enabled: true }] },
  mailFlow: {
    acceptedDomains: [{ DomainType: 'Authoritative', DirectoryBasedEdgeBlockingEnabled: true }],
    inboundConnectors: [{ Enabled: true, RequireTLS: true }],
    outboundConnectors: [],
    transportRules: [
      { State: 'Enabled', Mode: 'Enforce', Name: 'Block Auto-Forward External', Conditions: { SentToScope: 'External' }, Actions: { RejectMessage: true } },
      { State: 'Enabled', Mode: 'Enforce', Name: 'External Sender Warning', Conditions: { FromAddressContains: '@external.com' }, Actions: { PrependSubject: 'External: ', AddDisclaimer: true } },
    ],
    transportConfig: { SmtpClientAuthenticationDisabled: true },
    popImapStatus: [],
  },
  mailboxes: { all: [] },
  security: { alerts: [], incidents: [], tenantAllowBlockList: [] },
};

describe('EmailSecurityEvaluator', () => {
  describe('evaluateEmailSecurityControl', () => {
    it('returns null for unknown control name', () => {
      const result = evaluateEmailSecurityControl('unknown-control', NEW_FORMAT_DATA, []);
      expect(result).toBeNull();
    });

    describe('Anti-Phishing', () => {
      it('passes when enabled policy exists (new format)', () => {
        const result = evaluateEmailSecurityControl('Anti-phishing policy exists and enabled', NEW_FORMAT_DATA, []);
        expect(result?.result).toBe('pass');
      });

      it('passes when enabled policy exists (old format)', () => {
        const result = evaluateEmailSecurityControl('Anti-phishing policy exists and enabled', OLD_FORMAT_DATA, []);
        expect(result?.result).toBe('pass');
      });

      it('fails when no enabled policy exists', () => {
        const data = { 'anti-phish-policy': [] };
        const result = evaluateEmailSecurityControl('Anti-phishing policy exists and enabled', data, []);
        expect(result?.result).toBe('fail');
      });
    });

    describe('SMTP AUTH', () => {
      it('passes when SMTP AUTH is disabled globally', () => {
        const result = evaluateEmailSecurityControl('SMTP AUTH disabled globally', NEW_FORMAT_DATA, []);
        expect(result?.result).toBe('pass');
      });

      it('passes with old format', () => {
        const result = evaluateEmailSecurityControl('SMTP AUTH disabled globally', OLD_FORMAT_DATA, []);
        expect(result?.result).toBe('pass');
      });

      it('fails when SMTP AUTH is enabled', () => {
        const data = { 'transport-config': { SmtpClientAuthenticationDisabled: false } };
        const result = evaluateEmailSecurityControl('SMTP AUTH disabled globally', data, []);
        expect(result?.result).toBe('fail');
      });
    });

    describe('Transport Rules', () => {
      it('passes for forwarding prevention with new format', () => {
        const result = evaluateEmailSecurityControl('Transport rules prevent automatic forwarding to external recipients', NEW_FORMAT_DATA, []);
        expect(result?.result).toBe('pass');
      });

      it('passes for forwarding prevention with old format', () => {
        const result = evaluateEmailSecurityControl('Transport rules prevent automatic forwarding to external recipients', OLD_FORMAT_DATA, []);
        expect(result?.result).toBe('pass');
      });

      it('passes for warning banner with new format', () => {
        const result = evaluateEmailSecurityControl('Transport rules prepend warning banners for external emails', NEW_FORMAT_DATA, []);
        expect(result?.result).toBe('pass');
      });

      it('passes for warning banner with old format', () => {
        const result = evaluateEmailSecurityControl('Transport rules prepend warning banners for external emails', OLD_FORMAT_DATA, []);
        expect(result?.result).toBe('pass');
      });

      it('fails when no transport rules exist', () => {
        const data = { 'transport-rule': [] };
        const result = evaluateEmailSecurityControl('Transport rules prevent automatic forwarding to external recipients', data, []);
        expect(result?.result).toBe('fail');
      });
    });

    describe('Informational controls', () => {
      it('returns info for total mailbox count', () => {
        const data = { 'exo-mailbox': [{ RecipientTypeDetails: 'UserMailbox' }, { RecipientTypeDetails: 'UserMailbox' }] };
        const result = evaluateEmailSecurityControl('Total number of mailboxes', data, []);
        expect(result?.result).toBe('info');
        expect(result?.evidence).toContain('2');
      });

      it('returns info for alert counts', () => {
        const data = { 'graph-security-alerts': [{ id: '1' }, { id: '2' }] };
        const result = evaluateEmailSecurityControl('Total number of alerts', data, []);
        expect(result?.result).toBe('info');
        expect(result?.evidence).toContain('2');
      });

      it('handles missing data for informational controls', () => {
        const result = evaluateEmailSecurityControl('Total number of mailboxes', {}, []);
        expect(result?.result).toBe('info');
        expect(result?.evidence).toContain('0');
      });
    });

    describe('Edge cases', () => {
      it('handles empty data object', () => {
        const result = evaluateEmailSecurityControl('Anti-phishing policy exists and enabled', {}, []);
        expect(result?.result).toBe('fail');
      });

      it('handles null/undefined transport config', () => {
        const data = { 'transport-config': null };
        const result = evaluateEmailSecurityControl('SMTP AUTH disabled globally', data, []);
        expect(result?.result).toBe('fail');
      });
    });
  });

  describe('EMAIL_SECURITY_CONTROLS registry', () => {
    it('contains all expected quick controls', () => {
      const quickControls = EMAIL_SECURITY_CONTROLS.filter(c => c.scope === 'quick' || c.scope === 'both');
      expect(quickControls.length).toBeGreaterThanOrEqual(21);
    });

    it('contains all expected detailed controls', () => {
      const detailedControls = EMAIL_SECURITY_CONTROLS.filter(c => c.scope === 'detailed' || c.scope === 'both');
      expect(detailedControls.length).toBeGreaterThanOrEqual(39);
    });

    it('contains informational controls', () => {
      const infoControls = EMAIL_SECURITY_CONTROLS.filter(c => c.controlType === 'informational');
      expect(infoControls.length).toBeGreaterThanOrEqual(6);
    });

    it('all controls have required fields', () => {
      for (const control of EMAIL_SECURITY_CONTROLS) {
        expect(control.id).toBeTruthy();
        expect(control.title).toBeTruthy();
        expect(control.controlType).toMatch(/^(pass\/fail|informational)$/);
        expect(control.scope).toMatch(/^(quick|detailed|both)$/);
        expect(typeof control.evaluate).toBe('function');
      }
    });
  });
});
