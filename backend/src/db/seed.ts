import { query } from './connection';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('Seeding database...');

  // Seed admin user - use ON DUPLICATE KEY UPDATE to ensure role is set correctly
  const adminUserId = uuidv4();
  const adminOrgId = uuidv4();
  await query(
    `INSERT IGNORE INTO organizations (id, name) VALUES (?, ?)`,
    [adminOrgId, 'Aegis Admin Organization']
  );
  // First try to insert, then update role if user already exists
  try {
    await query(
      `INSERT INTO users (id, email, password_hash, full_name, platform_role, organization_id, email_verified, mfa_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [adminUserId, 'suseenataraj@gmail.com', '$2a$12$HMhC4HOdNeK2XTwDgVgliOxFQfu5E38voSlexNRdCMRYkSJb25vg.', 'Suseena Taraj', 'admin', adminOrgId, true, false]
    );
    console.log('Admin user created: suseenataraj@gmail.com');
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') {
      await query(
        `UPDATE users SET platform_role = 'admin', full_name = 'Suseena Taraj', password_hash = ?, mfa_enabled = FALSE, mfa_secret = NULL WHERE email = ?`,
        ['$2a$12$HMhC4HOdNeK2XTwDgVgliOxFQfu5E38voSlexNRdCMRYkSJb25vg.', 'suseenataraj@gmail.com']
      );
      console.log('Admin user updated: suseenataraj@gmail.com');
    } else {
      throw e;
    }
  }

  // Seed subscription plans
  const plans = [
    {
      id: uuidv4(),
      name: 'Free',
      priceMonthly: 0,
      stripePriceId: null,
      includedTenantSlots: 0,
      includedQuickCredits: 0,
      includedDetailedCredits: 0,
      seatLimit: 1,
      features: { trial: true, quick: false, detailed: false },
    },
    {
      id: uuidv4(),
      name: 'Starter',
      priceMonthly: 0,
      stripePriceId: null,
      includedTenantSlots: 1,
      includedQuickCredits: 0,
      includedDetailedCredits: 0,
      seatLimit: 3,
      features: { trial: true, quick: true, detailed: true },
    },
    {
      id: uuidv4(),
      name: 'Professional',
      priceMonthly: 99,
      stripePriceId: null,
      includedTenantSlots: 5,
      includedQuickCredits: 10,
      includedDetailedCredits: 2,
      seatLimit: 10,
      features: { trial: true, quick: true, detailed: true, scheduledReassessment: true },
    },
    {
      id: uuidv4(),
      name: 'Business',
      priceMonthly: 299,
      stripePriceId: null,
      includedTenantSlots: 5,
      includedQuickCredits: 30,
      includedDetailedCredits: 8,
      seatLimit: 999,
      features: { trial: true, quick: true, detailed: true, whiteLabel: true, apiAccess: true },
    },
    {
      id: uuidv4(),
      name: 'Enterprise',
      priceMonthly: 0,
      stripePriceId: null,
      includedTenantSlots: 999,
      includedQuickCredits: 999,
      includedDetailedCredits: 999,
      seatLimit: 999,
      features: { trial: true, quick: true, detailed: true, sso: true, customFramework: true },
    },
  ];

  for (const plan of plans) {
    await query(
      `INSERT IGNORE INTO subscription_plans (id, name, price_monthly, stripe_price_id, included_tenant_slots, included_quick_credits, included_detailed_credits, seat_limit, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [plan.id, plan.name, plan.priceMonthly, plan.stripePriceId, plan.includedTenantSlots, plan.includedQuickCredits, plan.includedDetailedCredits, plan.seatLimit, JSON.stringify(plan.features)]
    );
  }

  // Seed trial questionnaire - 12 highest-signal security controls
  const questions = [
    { id: uuidv4(), question: 'Is MFA enforced for all users in your tenant?', category: 'Identity', weight: 2, order: 1 },
    { id: uuidv4(), question: 'Is Defender for Office 365 enabled and configured?', category: 'Email Security', weight: 2, order: 2 },
    { id: uuidv4(), question: 'Are admin accounts separated from daily-use accounts?', category: 'Identity', weight: 2, order: 3 },
    { id: uuidv4(), question: 'Is Conditional Access configured for privileged accounts?', category: 'Identity', weight: 2, order: 4 },
    { id: uuidv4(), question: 'Is Intune device management configured for endpoint protection?', category: 'Endpoint', weight: 1, order: 5 },
    { id: uuidv4(), question: 'Is disk encryption enforced on all managed devices?', category: 'Endpoint', weight: 1, order: 6 },
    { id: uuidv4(), question: 'Is privileged access hygiene practiced (PIM, just-in-time access)?', category: 'Identity', weight: 2, order: 7 },
    { id: uuidv4(), question: 'Is a strong password policy enforced (complexity, expiration, lockout)?', category: 'Identity', weight: 1, order: 8 },
    { id: uuidv4(), question: 'Is audit logging enabled and retained for compliance?', category: 'Compliance', weight: 2, order: 9 },
    { id: uuidv4(), question: 'Is DLP configured to protect sensitive data?', category: 'Data Protection', weight: 2, order: 10 },
    { id: uuidv4(), question: 'Are backups configured and tested for critical data?', category: 'Resilience', weight: 1, order: 11 },
    { id: uuidv4(), question: 'Is security awareness training conducted regularly?', category: 'Governance', weight: 1, order: 12 },
  ];

  for (const q of questions) {
    await query(
      `INSERT INTO trial_questionnaires (id, question, category, weight, order_num) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE question = VALUES(question), category = VALUES(category), weight = VALUES(weight)`,
      [q.id, q.question, q.category, q.weight, q.order]
    );
  }

  // Seed sample control catalog entries
  const controls = [
    { moduleName: 'Entra ID', controlName: 'MFA is enforced for all users', description: 'Multi-factor authentication should be enforced for all users including privileged roles', weight: 2, severity: 'critical', frameworkRefs: ['CIS 1.1'], automatable: true },
    { moduleName: 'Entra ID', controlName: 'Legacy authentication protocols are disabled', description: 'Legacy authentication protocols should be blocked', weight: 2, severity: 'high', frameworkRefs: ['CIS 1.3'], automatable: true },
    { moduleName: 'Entra ID', controlName: 'Conditional Access exceptions are business-justified', description: 'Any Conditional Access exceptions should have documented business justification', weight: 1, severity: 'medium', frameworkRefs: ['CIS 1.4'], automatable: false },
    { moduleName: 'Email', controlName: 'Anti-phishing policy is enabled tenant-wide', description: 'Anti-phishing policies should be configured and enabled', weight: 2, severity: 'critical', frameworkRefs: ['CIS 7.1'], automatable: true },
    { moduleName: 'Email', controlName: 'External email forwarding is restricted', description: 'External email forwarding rules should be reviewed and restricted', weight: 1, severity: 'medium', frameworkRefs: ['CIS 7.5'], automatable: true },
    { moduleName: 'Purview', controlName: 'DLP policy scope matches data footprint', description: 'DLP policies should cover all sensitive data types relevant to the organization', weight: 2, severity: 'high', frameworkRefs: ['CIS 8.1'], automatable: false },
    { moduleName: 'Intune', controlName: 'Device encryption is enforced', description: 'BitLocker or equivalent encryption should be enforced via compliance policy', weight: 2, severity: 'high', frameworkRefs: ['CIS 9.1'], automatable: true },
    { moduleName: 'SharePoint', controlName: 'Anonymous sharing is restricted', description: 'Anonymous/external sharing should be limited to approved use cases', weight: 1, severity: 'medium', frameworkRefs: ['CIS 10.1'], automatable: false },
  ];

  for (const c of controls) {
    await query(
      `INSERT IGNORE INTO control_catalog (id, module_name, control_name, description, weight, severity, framework_refs, automatable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), c.moduleName, c.controlName, c.description, c.weight, c.severity, JSON.stringify(c.frameworkRefs), c.automatable]
    );
  }

  // Seed scoring thresholds
  const thresholds = [
    { id: uuidv4(), assessmentType: 'trial', bandName: 'Poor', minScore: 0, maxScore: 39, color: 'red', description: 'Significant security gaps identified. Immediate action required.' },
    { id: uuidv4(), assessmentType: 'trial', bandName: 'Fair', minScore: 40, maxScore: 69, color: 'yellow', description: 'Some security controls in place but improvements needed.' },
    { id: uuidv4(), assessmentType: 'trial', bandName: 'Good', minScore: 70, maxScore: 89, color: 'blue', description: 'Solid security posture with room for enhancement.' },
    { id: uuidv4(), assessmentType: 'trial', bandName: 'Excellent', minScore: 90, maxScore: 100, color: 'green', description: 'Strong security posture. Maintain and monitor continuously.' },
  ];

  for (const t of thresholds) {
    await query(
      `INSERT IGNORE INTO scoring_thresholds (id, assessment_type, band_name, min_score, max_score, color, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.assessmentType, t.bandName, t.minScore, t.maxScore, t.color, t.description]
    );
  }

  console.log('Database seeded successfully');
}

seed().catch(console.error);
