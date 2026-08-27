import { query } from './connection';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const ENTRA_CONTROLS = [
  // ==================== AUTHENTICATION & MFA (12 controls) ====================
  { name: 'MFA enforced for all users via Security Defaults or Conditional Access', desc: 'All users are required to perform multi-factor authentication', severity: 'critical', weight: 2, automatable: true, category: 'Authentication & MFA' },
  { name: 'MFA enforced for all privileged users', desc: 'Multi-factor authentication is enforced for all privileged users', severity: 'critical', weight: 2, automatable: true, category: 'Authentication & MFA' },
  { name: 'Legacy authentication blocked', desc: 'Legacy authentication is blocked through Conditional Access policies', severity: 'high', weight: 2, automatable: true, category: 'Authentication & MFA' },
  { name: 'Microsoft Authenticator enabled', desc: 'Microsoft Authenticator is enabled for applicable users', severity: 'medium', weight: 1, automatable: true, category: 'Authentication & MFA' },
  { name: 'FIDO2 Security Keys enabled', desc: 'FIDO2 security keys are enabled for applicable users', severity: 'medium', weight: 1, automatable: true, category: 'Authentication & MFA' },
  { name: 'Passkeys FIDO2 enabled', desc: 'Passkeys (FIDO2) are enabled for applicable users', severity: 'medium', weight: 1, automatable: true, category: 'Authentication & MFA' },
  { name: 'Temporary Access Pass enabled', desc: 'Temporary Access Pass (TAP) is enabled', severity: 'medium', weight: 1, automatable: true, category: 'Authentication & MFA' },
  { name: 'SMS Authentication disabled', desc: 'SMS authentication is disabled for applicable users', severity: 'medium', weight: 1, automatable: true, category: 'Authentication & MFA' },
  { name: 'Voice Call Authentication disabled', desc: 'Voice call authentication is disabled for applicable users', severity: 'medium', weight: 1, automatable: true, category: 'Authentication & MFA' },
  { name: 'SSPR enabled', desc: 'Self-Service Password Reset (SSPR) is enabled', severity: 'medium', weight: 1, automatable: true, category: 'Authentication & MFA' },
  { name: 'Password Protection Smart Lockout configured', desc: 'Password protection smart lockout is configured', severity: 'medium', weight: 1, automatable: true, category: 'Authentication & MFA' },

  // ==================== CONDITIONAL ACCESS (9 controls) ====================
  { name: 'Conditional Access policies configured', desc: 'Conditional Access policies are configured', severity: 'high', weight: 2, automatable: true, category: 'Conditional Access' },
  { name: 'Conditional Access requires MFA for administrators', desc: 'Conditional Access requires MFA for administrators', severity: 'critical', weight: 2, automatable: true, category: 'Conditional Access' },
  { name: 'Conditional Access requires MFA for high-risk sign-ins', desc: 'Conditional Access requires MFA for high-risk sign-ins', severity: 'high', weight: 2, automatable: true, category: 'Conditional Access' },
  { name: 'High user risk requires password reset or blocking', desc: 'High user risk requires password reset or access blocking', severity: 'high', weight: 2, automatable: true, category: 'Conditional Access' },
  { name: 'Named Locations configured', desc: 'Named locations are configured for Conditional Access', severity: 'medium', weight: 1, automatable: true, category: 'Conditional Access' },
  { name: 'Access from high-risk locations blocked', desc: 'Access from high-risk locations is blocked or restricted', severity: 'high', weight: 2, automatable: true, category: 'Conditional Access' },
  { name: 'Sign-in frequency session controls configured', desc: 'Sign-in frequency session controls are configured', severity: 'medium', weight: 1, automatable: true, category: 'Conditional Access' },
  { name: 'Token Protection enabled', desc: 'Token protection is enabled for supported workloads', severity: 'medium', weight: 1, automatable: true, category: 'Conditional Access' },

  // ==================== PRIVILEGED IDENTITY MANAGEMENT (3 controls) ====================
  { name: 'PIM enabled', desc: 'Privileged Identity Management (PIM) is enabled', severity: 'high', weight: 2, automatable: true, category: 'Privileged Identity Management' },
  { name: 'JIT activation configured', desc: 'Just-In-Time (JIT) activation is configured', severity: 'high', weight: 2, automatable: true, category: 'Privileged Identity Management' },
  { name: 'PIM activation requires MFA', desc: 'PIM activation requires MFA', severity: 'critical', weight: 2, automatable: true, category: 'Privileged Identity Management' },

  // ==================== PRIVILEGED ACCESS & ADMINISTRATION (1 control) ====================
  { name: 'Global Administrator count within limit', desc: 'Global Administrator accounts are not more than 5', severity: 'critical', weight: 2, automatable: true, category: 'Privileged Access & Administration' },

  // ==================== ACCESS CONTROLS & REVIEW (5 controls) ====================
  { name: 'Access Review for guest users configured', desc: 'At least one Access Review is configured for guest users', severity: 'medium', weight: 1, automatable: true, category: 'Access Controls & Review' },
  { name: 'Access Reviews for privileged roles configured', desc: 'Access Reviews are configured for privileged roles', severity: 'high', weight: 2, automatable: true, category: 'Access Controls & Review' },
  { name: 'Access Reviews have recurring schedule', desc: 'At least one Access Review has a recurring schedule', severity: 'medium', weight: 1, automatable: true, category: 'Access Controls & Review' },
  { name: 'Access Reviews have reminder notifications', desc: 'At least one Access Review has reminder notifications enabled', severity: 'low', weight: 1, automatable: true, category: 'Access Controls & Review' },
  { name: 'Non-responders automatically handled', desc: 'Non-responders are automatically handled in Access Reviews', severity: 'medium', weight: 1, automatable: true, category: 'Access Controls & Review' },

  // ==================== IDENTITY MONITORING & LOGGING (4 controls) ====================
  { name: 'Sign-in logs available', desc: 'Sign-in logs are available for the tenant', severity: 'medium', weight: 1, automatable: true, category: 'Identity Monitoring & Logging' },
  { name: 'Directory audit logs available', desc: 'Directory audit logs are available for the tenant', severity: 'medium', weight: 1, automatable: true, category: 'Identity Monitoring & Logging' },
  { name: 'Provisioning logs available', desc: 'Provisioning logs are available for the tenant', severity: 'low', weight: 1, automatable: true, category: 'Identity Monitoring & Logging' },
  { name: 'Identity Protection risk detections available', desc: 'Identity Protection risk detections are available', severity: 'high', weight: 2, automatable: true, category: 'Identity Monitoring & Logging' },
];

async function seedEntraControls() {
  console.log('Seeding Entra ID controls (NIST CSF framework)...');

  for (const control of ENTRA_CONTROLS) {
    await query(
      `INSERT IGNORE INTO control_catalog (id, module_name, control_name, description, weight, severity, framework_refs, automatable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'Entra ID', control.name, control.desc, control.weight, control.severity, JSON.stringify(['NIST-CSF']), control.automatable]
    );
  }

  console.log(`Seeded ${ENTRA_CONTROLS.length} Entra ID controls successfully`);
}

seedEntraControls().catch(console.error);
