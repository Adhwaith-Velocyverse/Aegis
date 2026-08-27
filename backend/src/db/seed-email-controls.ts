import { query } from './connection';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const EMAIL_CONTROLS = [
  // Anti-Phishing
  { id: 'email-anti-phish-001', controlName: 'Anti-phishing policy is enabled', description: 'At least one enabled anti-phishing policy exists and is assigned through an active rule', weight: 2, severity: 'critical', frameworkRefs: ['CIS 7.1'], automatable: true },
  { id: 'email-anti-phish-002', controlName: 'Anti-phishing covers all users', description: 'Anti-phishing policy provides coverage for all applicable users', weight: 2, severity: 'high', frameworkRefs: ['CIS 7.1'], automatable: true },
  { id: 'email-anti-phish-003', controlName: 'Anti-phishing impersonation protection is enabled', description: 'User and domain impersonation protection is enabled in anti-phishing policy', weight: 2, severity: 'high', frameworkRefs: ['CIS 7.1'], automatable: true },
  { id: 'email-anti-phish-004', controlName: 'Anti-phishing spoof intelligence is enabled', description: 'Spoof Intelligence protection is enabled', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.1'], automatable: true },
  { id: 'email-anti-phish-005', controlName: 'Anti-phishing honors DMARC', description: 'DMARC policy is set to quarantine or reject', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.1'], automatable: true },
  { id: 'email-anti-phish-006', controlName: 'Anti-phishing first contact safety tip is enabled', description: 'First Contact Safety Tip is enabled', weight: 1, severity: 'low', frameworkRefs: ['CIS 7.1'], automatable: true },

  // Anti-Spam
  { id: 'email-anti-spam-001', controlName: 'Inbound anti-spam policy is enabled', description: 'At least one enabled inbound anti-spam policy exists and is assigned through an active rule', weight: 2, severity: 'high', frameworkRefs: ['CIS 7.7'], automatable: true },
  { id: 'email-anti-spam-002', controlName: 'Anti-spam policy covers all users', description: 'Anti-spam policy provides coverage for all users', weight: 2, severity: 'high', frameworkRefs: ['CIS 7.7'], automatable: true },
  { id: 'email-anti-spam-003', controlName: 'Anti-spam spam action is configured', description: 'Spam action is set to quarantine or delete', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.7'], automatable: true },
  { id: 'email-anti-spam-004', controlName: 'Anti-spam high-confidence phishing action is configured', description: 'High-confidence phishing action is set to quarantine or delete', weight: 2, severity: 'critical', frameworkRefs: ['CIS 7.7'], automatable: true },
  { id: 'email-anti-spam-005', controlName: 'Outbound spam policy is configured', description: 'At least one enabled outbound spam policy exists', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.9'], automatable: true },

  // Anti-Malware
  { id: 'email-anti-malware-001', controlName: 'Anti-malware policy is enabled', description: 'At least one enabled anti-malware policy exists and is assigned through an active rule', weight: 2, severity: 'critical', frameworkRefs: ['CIS 7.2'], automatable: true },
  { id: 'email-anti-malware-002', controlName: 'Anti-malware policy covers all users', description: 'Anti-malware policy provides coverage for all users', weight: 2, severity: 'high', frameworkRefs: ['CIS 7.2'], automatable: true },
  { id: 'email-anti-malware-003', controlName: 'Zero-hour Auto Purge is enabled', description: 'ZAP is enabled for anti-malware policy', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.2'], automatable: true },

  // Safe Links
  { id: 'email-safe-links-001', controlName: 'Safe Links policy is enabled', description: 'At least one enabled Safe Links policy exists and is assigned through an active rule', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.3'], automatable: true },
  { id: 'email-safe-links-002', controlName: 'Safe Links covers all users', description: 'Safe Links policy provides coverage for all users', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.3'], automatable: true },

  // Safe Attachments
  { id: 'email-safe-attachments-001', controlName: 'Safe Attachments policy is enabled', description: 'At least one enabled Safe Attachments policy exists and is assigned through an active rule', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.4'], automatable: true },
  { id: 'email-safe-attachments-002', controlName: 'Safe Attachments covers all users', description: 'Safe Attachments policy provides coverage for all users', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.4'], automatable: true },

  // Mail Flow
  { id: 'email-mailflow-001', controlName: 'DBEB is enabled for authoritative domains', description: 'Directory Based Edge Blocking is enabled for authoritative domains', weight: 2, severity: 'high', frameworkRefs: ['CIS 7.5'], automatable: true },
  { id: 'email-mailflow-002', controlName: 'SMTP AUTH is disabled globally', description: 'SMTP AUTH is disabled at tenant level', weight: 2, severity: 'critical', frameworkRefs: ['CIS 7.8'], automatable: true },
  { id: 'email-mailflow-003', controlName: 'POP and IMAP are disabled for all mailboxes', description: 'POP and IMAP are disabled for all applicable mailboxes', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.8'], automatable: true },
  { id: 'email-mailflow-004', controlName: 'Inbound connectors require TLS', description: 'All enabled inbound connectors require TLS', weight: 2, severity: 'high', frameworkRefs: ['CIS 7.5'], automatable: true },
  { id: 'email-mailflow-005', controlName: 'Transport rules are configured', description: 'At least one transport rule is configured in Enforce mode', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.5'], automatable: true },

  // Informational
  { id: 'email-info-001', controlName: 'Total mailboxes', description: 'Total number of mailboxes in the tenant', weight: 0, severity: 'low', frameworkRefs: [], automatable: true },
  { id: 'email-info-002', controlName: 'Total distribution groups', description: 'Total number of distribution groups in the tenant', weight: 0, severity: 'low', frameworkRefs: [], automatable: true },
  { id: 'email-info-003', controlName: 'Defender alerts count', description: 'Total number of Defender for Office 365 alerts', weight: 0, severity: 'low', frameworkRefs: [], automatable: true },
  { id: 'email-info-004', controlName: 'Total Microsoft 365 Groups', description: 'Total number of Microsoft 365 Groups', weight: 0, severity: 'low', frameworkRefs: [], automatable: true },
];

async function seedEmailControls() {
  console.log('Seeding Email control catalog...');

  for (const control of EMAIL_CONTROLS) {
    await query(
      `INSERT IGNORE INTO control_catalog (id, module_name, control_name, description, weight, severity, framework_refs, automatable, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [control.id, 'Email', control.controlName, control.description, control.weight, control.severity, JSON.stringify(control.frameworkRefs), control.automatable, '1.0']
    );
  }

  console.log(`Seeded ${EMAIL_CONTROLS.length} Email controls successfully`);
}

seedEmailControls().catch(console.error);
