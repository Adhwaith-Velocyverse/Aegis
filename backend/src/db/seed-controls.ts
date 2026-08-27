import { query } from './connection';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const CONTROLS = [
  // ==================== ENTRA ID (20 controls) ====================
  { moduleName: 'Entra ID', controlName: 'MFA is enforced for all users', description: 'Multi-factor authentication should be enforced for all users including privileged roles', weight: 2, severity: 'critical', frameworkRefs: ['CIS 1.1'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Legacy authentication protocols are disabled', description: 'Legacy authentication protocols (POP, IMAP, SMTP AUTH) should be blocked', weight: 2, severity: 'high', frameworkRefs: ['CIS 1.3'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Conditional Access exceptions are business-justified', description: 'Any Conditional Access exceptions should have documented business justification', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.4'], automatable: false },
  { moduleName: 'Entra ID', controlName: 'Password protection is enabled', description: 'Password protection should block common passwords and custom banned passwords', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.2'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Guest user access is restricted', description: 'Guest user access should be limited and monitored', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.5'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Privileged role assignments are reviewed', description: 'Privileged role assignments should be reviewed regularly (PIM)', weight: 2, severity: 'high', frameworkRefs: ['CIS 1.6'], automatable: false },
  { moduleName: 'Entra ID', controlName: 'Security defaults are enabled', description: 'Security defaults should be enabled for basic protection', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.0'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Conditional Access policies are configured', description: 'Conditional Access policies should be configured for all users', weight: 2, severity: 'high', frameworkRefs: ['CIS 1.4'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Identity Protection is enabled', description: 'Identity Protection should be enabled for risk detection', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.7'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Access reviews are conducted', description: 'Access reviews should be conducted for privileged roles', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.8'], automatable: false },
  { moduleName: 'Entra ID', controlName: 'Password expiration policy is configured', description: 'Password expiration policy should be configured appropriately', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.2'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Account lockout policy is configured', description: 'Account lockout threshold and duration should be configured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.2'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Named locations are configured', description: 'Named locations should be configured for Conditional Access', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.4'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Device-based Conditional Access is enabled', description: 'Device-based Conditional Access policies should be configured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.4'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'SSPR is configured for all users', description: 'Self-service password reset should be configured for all users', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.2'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Entra ID Protection policies are configured', description: 'Identity Protection risk policies should be configured', weight: 1, severity: 'high', frameworkRefs: ['CIS 1.7'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Privileged Identity Management is enabled', description: 'PIM should be enabled for just-in-time privileged access', weight: 2, severity: 'high', frameworkRefs: ['CIS 1.6'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Emergency access accounts are configured', description: 'Emergency access (break-glass) accounts should be configured', weight: 2, severity: 'high', frameworkRefs: ['CIS 1.6'], automatable: false },
  { moduleName: 'Entra ID', controlName: 'User consent for apps is restricted', description: 'User consent for apps should be restricted to approved publishers', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.5'], automatable: true },
  { moduleName: 'Entra ID', controlName: 'Consent policy is configured', description: 'Consent policy should be configured to require admin approval', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.5'], automatable: true },

  // ==================== M365 ADMIN CENTER (15 controls) ====================
  { moduleName: 'M365 Admin Center', controlName: 'Audit logging is enabled', description: 'Audit logging should be enabled for all services', weight: 2, severity: 'critical', frameworkRefs: ['CIS 2.1'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'Secure Score is reviewed regularly', description: 'Secure Score should be reviewed and acted upon regularly', weight: 1, severity: 'medium', frameworkRefs: ['CIS 2.2'], automatable: false },
  { moduleName: 'M365 Admin Center', controlName: 'Service health is monitored', description: 'Service health should be monitored for incidents', weight: 1, severity: 'low', frameworkRefs: ['CIS 2.3'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'License assignments are reviewed', description: 'License assignments should be reviewed for optimization', weight: 1, severity: 'low', frameworkRefs: ['CIS 2.4'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'Organization settings are secured', description: 'Organization settings should be reviewed and secured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 2.5'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'Multi-factor authentication is enforced', description: 'MFA should be enforced for all users at tenant level', weight: 2, severity: 'critical', frameworkRefs: ['CIS 2.1'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'Password expiration policy is set', description: 'Password expiration policy should be configured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 2.5'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'User consent for apps is disabled', description: 'User consent for apps should be disabled or restricted', weight: 1, severity: 'medium', frameworkRefs: ['CIS 2.5'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'External sharing is restricted', description: 'External sharing should be restricted by default', weight: 1, severity: 'medium', frameworkRefs: ['CIS 2.5'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'Azure AD Connect is secured', description: 'Azure AD Connect should be secured and monitored', weight: 1, severity: 'high', frameworkRefs: ['CIS 2.5'], automatable: false },
  { moduleName: 'M365 Admin Center', controlName: 'Privileged access is managed', description: 'Privileged access should be managed with PIM', weight: 2, severity: 'high', frameworkRefs: ['CIS 2.5'], automatable: false },
  { moduleName: 'M365 Admin Center', controlName: 'Security defaults are enabled', description: 'Security defaults should be enabled for basic protection', weight: 1, severity: 'medium', frameworkRefs: ['CIS 2.5'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'Conditional Access is configured', description: 'Conditional Access should be configured for all users', weight: 2, severity: 'high', frameworkRefs: ['CIS 2.5'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'Device management is configured', description: 'Device management (Intune) should be configured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 2.5'], automatable: true },
  { moduleName: 'M365 Admin Center', controlName: 'Information protection is configured', description: 'Information protection policies should be configured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 2.5'], automatable: true },

  // ==================== PURVIEW (20 controls) ====================
  { moduleName: 'Purview', controlName: 'DLP policies are configured', description: 'Data Loss Prevention policies should be configured', weight: 2, severity: 'high', frameworkRefs: ['CIS 8.1'], automatable: false },
  { moduleName: 'Purview', controlName: 'Sensitivity labels are applied', description: 'Sensitivity labels should be applied to sensitive data', weight: 2, severity: 'high', frameworkRefs: ['CIS 8.2'], automatable: false },
  { moduleName: 'Purview', controlName: 'Retention policies are configured', description: 'Retention policies should be configured for compliance', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.3'], automatable: true },
  { moduleName: 'Purview', controlName: 'eDiscovery is configured', description: 'eDiscovery should be configured for legal holds', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.4'], automatable: true },
  { moduleName: 'Purview', controlName: 'Compliance manager is reviewed', description: 'Compliance manager should be reviewed regularly', weight: 1, severity: 'low', frameworkRefs: ['CIS 8.5'], automatable: false },
  { moduleName: 'Purview', controlName: 'Information barriers are configured', description: 'Information barriers should be configured where needed', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.6'], automatable: false },
  { moduleName: 'Purview', controlName: 'Communication compliance is enabled', description: 'Communication compliance should be enabled for policy monitoring', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.7'], automatable: true },
  { moduleName: 'Purview', controlName: 'Audit log search is configured', description: 'Audit log search should be configured and retention set', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.8'], automatable: true },
  { moduleName: 'Purview', controlName: 'Data classification is configured', description: 'Data classification should be configured with sensitivity labels', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.2'], automatable: true },
  { moduleName: 'Purview', controlName: 'Auto-labeling policies are configured', description: 'Auto-labeling policies should be configured for sensitive data', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.2'], automatable: true },
  { moduleName: 'Purview', controlName: 'DLP policy tips are enabled', description: 'DLP policy tips should be enabled for user education', weight: 1, severity: 'low', frameworkRefs: ['CIS 8.1'], automatable: true },
  { moduleName: 'Purview', controlName: 'Retention labels are applied', description: 'Retention labels should be applied to content', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.3'], automatable: true },
  { moduleName: 'Purview', controlName: 'eDiscovery cases are reviewed', description: 'eDiscovery cases should be reviewed regularly', weight: 1, severity: 'low', frameworkRefs: ['CIS 8.4'], automatable: false },
  { moduleName: 'Purview', controlName: 'Compliance score is reviewed', description: 'Compliance score should be reviewed and acted upon', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.5'], automatable: false },
  { moduleName: 'Purview', controlName: 'Data loss prevention alerts are reviewed', description: 'DLP alerts should be reviewed and acted upon', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.1'], automatable: false },
  { moduleName: 'Purview', controlName: 'Sensitivity label policies are published', description: 'Sensitivity label policies should be published to users', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.2'], automatable: true },
  { moduleName: 'Purview', controlName: 'Retention policy settings are reviewed', description: 'Retention policy settings should be reviewed regularly', weight: 1, severity: 'low', frameworkRefs: ['CIS 8.3'], automatable: true },
  { moduleName: 'Purview', controlName: 'Communication compliance policies are configured', description: 'Communication compliance policies should be configured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.7'], automatable: true },
  { moduleName: 'Purview', controlName: 'Information barrier policies are reviewed', description: 'Information barrier policies should be reviewed regularly', weight: 1, severity: 'low', frameworkRefs: ['CIS 8.6'], automatable: false },
  { moduleName: 'Purview', controlName: 'Audit log retention is configured', description: 'Audit log retention should be configured for compliance', weight: 1, severity: 'medium', frameworkRefs: ['CIS 8.8'], automatable: true },

  // ==================== EMAIL CONTROLS ====================
  // Email controls are now seeded separately in seed-email-controls.ts

  // ==================== INTUNE (20 controls) ====================
  { moduleName: 'Intune', controlName: 'Device encryption is enforced', description: 'BitLocker or equivalent encryption should be enforced via compliance policy', weight: 2, severity: 'high', frameworkRefs: ['CIS 9.1'], automatable: true },
  { moduleName: 'Intune', controlName: 'Device compliance policies are configured', description: 'Device compliance policies should be configured', weight: 2, severity: 'high', frameworkRefs: ['CIS 9.2'], automatable: true },
  { moduleName: 'Intune', controlName: 'App protection policies are configured', description: 'App protection policies should be configured for mobile apps', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.3'], automatable: true },
  { moduleName: 'Intune', controlName: 'Device enrollment is restricted', description: 'Device enrollment should be restricted to authorized users', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.4'], automatable: true },
  { moduleName: 'Intune', controlName: 'Windows Hello is configured', description: 'Windows Hello for Business should be configured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.5'], automatable: true },
  { moduleName: 'Intune', controlName: 'Antivirus is enabled', description: 'Antivirus should be enabled and up to date on all devices', weight: 2, severity: 'high', frameworkRefs: ['CIS 9.6'], automatable: true },
  { moduleName: 'Intune', controlName: 'Firewall is enabled', description: 'Firewall should be enabled on all devices', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.7'], automatable: true },
  { moduleName: 'Intune', controlName: 'Software updates are enforced', description: 'Software updates should be enforced via policies', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.8'], automatable: true },
  { moduleName: 'Intune', controlName: 'Remote wipe is configured', description: 'Remote wipe should be configured for lost devices', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.9'], automatable: true },
  { moduleName: 'Intune', controlName: 'Device inventory is maintained', description: 'Device inventory should be maintained and reviewed', weight: 1, severity: 'low', frameworkRefs: ['CIS 9.10'], automatable: true },
  { moduleName: 'Intune', controlName: 'Conditional Access is configured', description: 'Conditional Access should be configured for device compliance', weight: 2, severity: 'high', frameworkRefs: ['CIS 9.2'], automatable: true },
  { moduleName: 'Intune', controlName: 'Compliance policies are assigned', description: 'Compliance policies should be assigned to all users', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.2'], automatable: true },
  { moduleName: 'Intune', controlName: 'Configuration profiles are deployed', description: 'Configuration profiles should be deployed to devices', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.2'], automatable: true },
  { moduleName: 'Intune', controlName: 'Device categories are configured', description: 'Device categories should be configured for management', weight: 1, severity: 'low', frameworkRefs: ['CIS 9.4'], automatable: true },
  { moduleName: 'Intune', controlName: 'Enrollment restrictions are configured', description: 'Enrollment restrictions should be configured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.4'], automatable: true },
  { moduleName: 'Intune', controlName: 'Windows Defender is configured', description: 'Windows Defender should be configured and up to date', weight: 2, severity: 'high', frameworkRefs: ['CIS 9.6'], automatable: true },
  { moduleName: 'Intune', controlName: 'Windows Update is configured', description: 'Windows Update should be configured via Intune', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.8'], automatable: true },
  { moduleName: 'Intune', controlName: 'Device compliance is monitored', description: 'Device compliance should be monitored and reported', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.2'], automatable: true },
  { moduleName: 'Intune', controlName: 'Non-compliant devices are blocked', description: 'Non-compliant devices should be blocked from accessing resources', weight: 1, severity: 'high', frameworkRefs: ['CIS 9.2'], automatable: true },
  { moduleName: 'Intune', controlName: 'Device retirement is configured', description: 'Device retirement/wipe should be configured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 9.9'], automatable: true },

  // ==================== CLOUD APPS (15 controls) ====================
  { moduleName: 'Cloud Apps', controlName: 'Cloud app discovery is enabled', description: 'Cloud app discovery should be enabled to identify shadow IT', weight: 1, severity: 'medium', frameworkRefs: ['CIS 11.1'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Sanctioned apps are defined', description: 'Sanctioned apps should be defined and enforced', weight: 1, severity: 'medium', frameworkRefs: ['CIS 11.2'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Session policies are configured', description: 'Session policies should be configured for risky apps', weight: 1, severity: 'medium', frameworkRefs: ['CIS 11.3'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'App connectors are configured', description: 'App connectors should be configured for visibility', weight: 1, severity: 'low', frameworkRefs: ['CIS 11.4'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Anomaly detection is enabled', description: 'Anomaly detection should be enabled for threat detection', weight: 2, severity: 'high', frameworkRefs: ['CIS 11.5'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Access controls are enforced', description: 'Access controls should be enforced based on risk', weight: 1, severity: 'medium', frameworkRefs: ['CIS 11.6'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Cloud app catalog is reviewed', description: 'Cloud app catalog should be reviewed regularly', weight: 1, severity: 'medium', frameworkRefs: ['CIS 11.1'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'App governance is configured', description: 'App governance should be configured for OAuth apps', weight: 1, severity: 'high', frameworkRefs: ['CIS 11.6'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'OAuth app policies are configured', description: 'OAuth app policies should be configured', weight: 1, severity: 'high', frameworkRefs: ['CIS 11.6'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Session controls are reviewed', description: 'Session controls should be reviewed regularly', weight: 1, severity: 'medium', frameworkRefs: ['CIS 11.3'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Discovery alerts are reviewed', description: 'Discovery alerts should be reviewed regularly', weight: 1, severity: 'medium', frameworkRefs: ['CIS 11.1'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Policy templates are used', description: 'Policy templates should be used for consistent configuration', weight: 1, severity: 'low', frameworkRefs: ['CIS 11.3'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Activity logs are reviewed', description: 'Activity logs should be reviewed regularly', weight: 1, severity: 'medium', frameworkRefs: ['CIS 11.5'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Cloud discovery is configured', description: 'Cloud discovery should be configured for all users', weight: 1, severity: 'medium', frameworkRefs: ['CIS 11.1'], automatable: true },
  { moduleName: 'Cloud Apps', controlName: 'Risk scoring is configured', description: 'Risk scoring should be configured for cloud apps', weight: 1, severity: 'medium', frameworkRefs: ['CIS 11.5'], automatable: true },

  // ==================== TEAMS (15 controls) ====================
  { moduleName: 'Teams', controlName: 'Guest access is restricted', description: 'Guest access should be restricted and monitored', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.1'], automatable: true },
  { moduleName: 'Teams', controlName: 'External access is configured', description: 'External access should be configured appropriately', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.2'], automatable: true },
  { moduleName: 'Teams', controlName: 'Meeting policies are secured', description: 'Meeting policies should be configured for security', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.3'], automatable: true },
  { moduleName: 'Teams', controlName: 'Messaging policies are configured', description: 'Messaging policies should be configured appropriately', weight: 1, severity: 'low', frameworkRefs: ['CIS 12.4'], automatable: true },
  { moduleName: 'Teams', controlName: 'Teams settings are reviewed', description: 'Teams settings should be reviewed regularly', weight: 1, severity: 'low', frameworkRefs: ['CIS 12.5'], automatable: true },
  { moduleName: 'Teams', controlName: 'Recording and transcription are secured', description: 'Recording and transcription settings should be secured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.6'], automatable: true },
  { moduleName: 'Teams', controlName: 'Meeting attendance reports are restricted', description: 'Meeting attendance reports should be restricted', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.3'], automatable: true },
  { moduleName: 'Teams', controlName: 'Lobby settings are configured', description: 'Lobby settings should be configured for meeting security', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.3'], automatable: true },
  { moduleName: 'Teams', controlName: 'Presenters are restricted', description: 'Presenters should be restricted in meetings', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.3'], automatable: true },
  { moduleName: 'Teams', controlName: 'Chat settings are secured', description: 'Chat settings should be secured appropriately', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.4'], automatable: true },
  { moduleName: 'Teams', controlName: 'File sharing is restricted', description: 'File sharing in Teams should be restricted', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.5'], automatable: true },
  { moduleName: 'Teams', controlName: 'App permissions are reviewed', description: 'App permissions in Teams should be reviewed', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.5'], automatable: true },
  { moduleName: 'Teams', controlName: 'Teams usage is reviewed', description: 'Teams usage should be reviewed regularly', weight: 1, severity: 'low', frameworkRefs: ['CIS 12.5'], automatable: true },
  { moduleName: 'Teams', controlName: 'External domains are restricted', description: 'External domains should be restricted for communication', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.2'], automatable: true },
  { moduleName: 'Teams', controlName: 'Federation is configured', description: 'Federation should be configured appropriately', weight: 1, severity: 'medium', frameworkRefs: ['CIS 12.2'], automatable: true },

  // ==================== SHAREPOINT (15 controls) ====================
  { moduleName: 'SharePoint', controlName: 'External sharing is restricted', description: 'External sharing should be restricted to approved use cases', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.1'], automatable: false },
  { moduleName: 'SharePoint', controlName: 'Anonymous access is disabled', description: 'Anonymous access should be disabled unless required', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.2'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'Site permissions are reviewed', description: 'Site permissions should be reviewed regularly', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.3'], automatable: false },
  { moduleName: 'SharePoint', controlName: 'Versioning is enabled', description: 'Versioning should be enabled for important libraries', weight: 1, severity: 'low', frameworkRefs: ['CIS 10.4'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'Access requests are configured', description: 'Access requests should be configured and monitored', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.5'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'Sharing links are secured', description: 'Sharing links should use secure settings', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.6'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'Site collections are audited', description: 'Site collections should be audited regularly', weight: 1, severity: 'low', frameworkRefs: ['CIS 10.7'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'External sharing is limited by domain', description: 'External sharing should be limited by domain', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.1'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'Sharing expiration is configured', description: 'Sharing expiration should be configured for external links', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.1'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'Default sharing link type is secure', description: 'Default sharing link type should be set to secure option', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.6'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'Site usage is reviewed', description: 'Site usage should be reviewed regularly', weight: 1, severity: 'low', frameworkRefs: ['CIS 10.7'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'Site policies are configured', description: 'Site policies should be configured for compliance', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.3'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'Hub sites are secured', description: 'Hub sites should be secured and managed', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.3'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'Site templates are reviewed', description: 'Site templates should be reviewed for security', weight: 1, severity: 'low', frameworkRefs: ['CIS 10.3'], automatable: true },
  { moduleName: 'SharePoint', controlName: 'SharePoint admin center is secured', description: 'SharePoint admin center should be secured', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.3'], automatable: true },
];

async function seedControls() {
  console.log('Seeding control catalog...');

  for (const control of CONTROLS) {
    await query(
      `INSERT IGNORE INTO control_catalog (id, module_name, control_name, description, weight, severity, framework_refs, automatable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), control.moduleName, control.controlName, control.description, control.weight, control.severity, JSON.stringify(control.frameworkRefs), control.automatable]
    );
  }

  console.log(`Seeded ${CONTROLS.length} controls successfully`);
}

seedControls().catch(console.error);
