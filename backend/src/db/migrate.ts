import { query } from './connection';
import dotenv from 'dotenv';

dotenv.config();

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const rows = await query(
    'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [tableName, columnName]
  );
  return (rows as any[]).length > 0 && (rows as any[])[0].count > 0;
}

async function migrate() {
  console.log('Running database migrations...');

  const migrations = [
    // Organizations
    `CREATE TABLE IF NOT EXISTS organizations (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      company_size VARCHAR(50),
      industry VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // Users
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      full_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(50),
      platform_role ENUM('client', 'admin', 'assessor') NOT NULL DEFAULT 'client',
      org_role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
      organization_id VARCHAR(36),
      email_verified BOOLEAN DEFAULT FALSE,
      mfa_enabled BOOLEAN DEFAULT FALSE,
      mfa_secret VARCHAR(255),
      provider ENUM('local', 'google', 'microsoft') DEFAULT 'local',
      provider_id VARCHAR(255),
      deleted_at TIMESTAMP NULL,
      deletion_reason TEXT,
      last_activity TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
    )`,

    // Tenant Connections
    `CREATE TABLE IF NOT EXISTS tenant_connections (
      id VARCHAR(36) PRIMARY KEY,
      organization_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(255) NOT NULL,
      tenant_name VARCHAR(255) NOT NULL,
      consented_scopes JSON,
      connection_status ENUM('connected', 'needs_attention', 'disconnected') DEFAULT 'disconnected',
      refresh_token_encrypted TEXT,
      access_token_encrypted TEXT,
      token_expires_at TIMESTAMP NULL,
      last_health_check TIMESTAMP NULL,
      azure_tenant_id VARCHAR(255),
      azure_client_id VARCHAR(255),
      azure_client_secret_encrypted TEXT,
      certificate_thumbprint VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE KEY unique_org_tenant (organization_id, tenant_id)
    )`,

    // Subscription Plans
    `CREATE TABLE IF NOT EXISTS subscription_plans (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      price_monthly DECIMAL(10,2) DEFAULT 0,
      stripe_price_id VARCHAR(255),
      included_tenant_slots INT DEFAULT 0,
      included_quick_credits INT DEFAULT 0,
      included_detailed_credits INT DEFAULT 0,
      seat_limit INT DEFAULT 1,
      features JSON,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Subscriptions
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id VARCHAR(36) PRIMARY KEY,
      organization_id VARCHAR(36) NOT NULL,
      plan_id VARCHAR(36) NOT NULL,
      addon_tenant_slots INT DEFAULT 0,
      billing_status ENUM('active', 'past_due', 'canceled') DEFAULT 'active',
      stripe_customer_id VARCHAR(255),
      stripe_subscription_id VARCHAR(255),
      current_period_start TIMESTAMP,
      current_period_end TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    )`,

    // Usage Ledger
    `CREATE TABLE IF NOT EXISTS usage_ledger (
      id VARCHAR(36) PRIMARY KEY,
      organization_id VARCHAR(36) NOT NULL,
      subscription_id VARCHAR(36) NOT NULL,
      type ENUM('credit_grant', 'credit_consumption', 'tenant_slot') NOT NULL,
      amount INT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
    )`,

    // Assessments
    `CREATE TABLE IF NOT EXISTS assessments (
      id VARCHAR(36) PRIMARY KEY,
      organization_id VARCHAR(36) NOT NULL,
      tenant_connection_id VARCHAR(36),
      type ENUM('trial', 'quick', 'detailed') NOT NULL,
      status ENUM('pending', 'in_progress', 'completed', 'failed') DEFAULT 'pending',
      overall_score INT,
      score_band VARCHAR(50),
      controls_assessed INT DEFAULT 0,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      duration_ms BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_connection_id) REFERENCES tenant_connections(id) ON DELETE SET NULL
    )`,

    // Assessment Modules
    `CREATE TABLE IF NOT EXISTS assessment_modules (
      id VARCHAR(36) PRIMARY KEY,
      assessment_id VARCHAR(36) NOT NULL,
      module_name VARCHAR(100) NOT NULL,
      collection_status ENUM('pending', 'collecting', 'completed', 'failed', 'permission_denied') DEFAULT 'pending',
      module_score INT,
      passed_count INT DEFAULT 0,
      failed_count INT DEFAULT 0,
      not_applicable_count INT DEFAULT 0,
      raw_data_path VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
      UNIQUE KEY unique_assessment_module (assessment_id, module_name)
    )`,

    // Control Catalog
    `CREATE TABLE IF NOT EXISTS control_catalog (
      id VARCHAR(36) PRIMARY KEY,
      module_name VARCHAR(100) NOT NULL,
      control_name VARCHAR(255) NOT NULL,
      description TEXT,
      weight DECIMAL(5,2) DEFAULT 1.0,
      severity ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',
      framework_refs JSON,
      automatable BOOLEAN DEFAULT TRUE,
      version VARCHAR(50) DEFAULT '1.0',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // Findings
    `CREATE TABLE IF NOT EXISTS findings (
      id VARCHAR(36) PRIMARY KEY,
      assessment_module_id VARCHAR(36) NOT NULL,
      control_catalog_id VARCHAR(36) NOT NULL,
      result ENUM('pass', 'fail', 'not_applicable', 'needs_manual_review') NOT NULL,
      severity ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',
      evidence TEXT,
      recommendation TEXT,
      source ENUM('automated', 'manual') DEFAULT 'automated',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assessment_module_id) REFERENCES assessment_modules(id) ON DELETE CASCADE,
      FOREIGN KEY (control_catalog_id) REFERENCES control_catalog(id)
    )`,

    // Reports
    `CREATE TABLE IF NOT EXISTS reports (
      id VARCHAR(36) PRIMARY KEY,
      assessment_id VARCHAR(36) NOT NULL,
      format ENUM('pdf', 'excel') NOT NULL,
      storage_path VARCHAR(500) NOT NULL,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
    )`,

    // Report Shares
    `CREATE TABLE IF NOT EXISTS report_shares (
      id VARCHAR(36) PRIMARY KEY,
      assessment_id VARCHAR(36) NOT NULL,
      shared_by VARCHAR(36) NOT NULL,
      share_token VARCHAR(255) NOT NULL UNIQUE,
      emails JSON NOT NULL,
      message TEXT,
      include_findings BOOLEAN DEFAULT TRUE,
      include_modules BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_share_token (share_token),
      INDEX idx_assessment_id (assessment_id)
    )`,

    // Detailed Assessment Requests
    `CREATE TABLE IF NOT EXISTS detailed_assessment_requests (
      id VARCHAR(36) PRIMARY KEY,
      assessment_id VARCHAR(36) NOT NULL,
      status ENUM('unassigned', 'assigned', 'in_review', 'awaiting_client', 'completed') DEFAULT 'unassigned',
      assigned_assessor_id VARCHAR(36),
      requested_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      assigned_on TIMESTAMP NULL,
      completed_on TIMESTAMP NULL,
      due_date TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_assessor_id) REFERENCES users(id) ON DELETE SET NULL
    )`,

    // Assessors
    `CREATE TABLE IF NOT EXISTS assessors (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      status ENUM('active', 'inactive') DEFAULT 'active',
      added_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // Trial Questionnaires
    `CREATE TABLE IF NOT EXISTS trial_questionnaires (
      id VARCHAR(36) PRIMARY KEY,
      question TEXT NOT NULL,
      category VARCHAR(100) NOT NULL,
      weight DECIMAL(5,2) DEFAULT 1.0,
      order_num INT NOT NULL
    )`,

    // Trial Answers
    `CREATE TABLE IF NOT EXISTS trial_answers (
      id VARCHAR(36) PRIMARY KEY,
      assessment_id VARCHAR(36) NOT NULL,
      question_id VARCHAR(36) NOT NULL,
      answer ENUM('yes', 'no', 'unsure') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES trial_questionnaires(id)
    )`,

    // Audit Logs
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36),
      org_id VARCHAR(36),
      action VARCHAR(100) NOT NULL,
      resource VARCHAR(100) NOT NULL,
      resource_id VARCHAR(36),
      details JSON,
      ip_address VARCHAR(45),
      user_agent TEXT,
      status ENUM('success', 'failure') DEFAULT 'success',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_org_id (org_id),
      INDEX idx_created_at (created_at)
    )`,

    // Invitations
    `CREATE TABLE IF NOT EXISTS invitations (
      id VARCHAR(36) PRIMARY KEY,
      org_id VARCHAR(36) NOT NULL,
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      role ENUM('client', 'admin', 'assessor') DEFAULT 'client',
      org_role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_email (email)
    )`,

    // Notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      data JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // MFA OTPs
    `CREATE TABLE IF NOT EXISTS mfa_otps (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp VARCHAR(10) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email_otp (email, otp),
      INDEX idx_expires_at (expires_at)
    )`,

    // MFA Backup Codes
    `CREATE TABLE IF NOT EXISTS mfa_backup_codes (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      code VARCHAR(255) NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id)
    )`,

    // Password Reset Tokens
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_user_id (user_id)
    )`,

    // Assessment Metadata
    `CREATE TABLE IF NOT EXISTS assessment_metadata (
      id VARCHAR(36) PRIMARY KEY,
      assessment_id VARCHAR(36) NOT NULL,
      \`key\` VARCHAR(100) NOT NULL,
      value TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
      UNIQUE KEY unique_assessment_metadata (assessment_id, \`key\`)
    )`,

    // Scoring Thresholds
    `CREATE TABLE IF NOT EXISTS scoring_thresholds (
      id VARCHAR(36) PRIMARY KEY,
      assessment_type ENUM('trial', 'quick', 'detailed') NOT NULL,
      band_name VARCHAR(50) NOT NULL,
      min_score DECIMAL(5,2) NOT NULL,
      max_score DECIMAL(5,2) NOT NULL,
      color VARCHAR(20) DEFAULT 'gray',
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_type_band (assessment_type, band_name)
    )`,

    // Tenant Connection Modules (per-module consent toggles)
    `CREATE TABLE IF NOT EXISTS tenant_connection_modules (
      id VARCHAR(36) PRIMARY KEY,
      tenant_connection_id VARCHAR(36) NOT NULL,
      module_name VARCHAR(100) NOT NULL,
      is_enabled BOOLEAN DEFAULT TRUE,
      consented_scopes JSON,
      last_collected_at TIMESTAMP NULL,
      collection_status ENUM('pending', 'collecting', 'completed', 'failed', 'permission_denied') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_connection_id) REFERENCES tenant_connections(id) ON DELETE CASCADE,
      UNIQUE KEY unique_connection_module (tenant_connection_id, module_name)
    )`,

    // Add missing columns to existing users table
    `ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL`,
    `ALTER TABLE users ADD COLUMN deletion_reason TEXT`,
    `ALTER TABLE users ADD COLUMN last_activity TIMESTAMP NULL`,
    `ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN provider ENUM('local', 'google', 'microsoft') DEFAULT 'local'`,
    `ALTER TABLE users ADD COLUMN provider_id VARCHAR(255)`,
  ];

  // Run ALTER TABLE statements with column existence checks
  const alterStatements = [
    { sql: 'ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL', col: 'deleted_at', table: 'users' },
    { sql: 'ALTER TABLE users ADD COLUMN deletion_reason TEXT', col: 'deletion_reason', table: 'users' },
    { sql: 'ALTER TABLE users ADD COLUMN last_activity TIMESTAMP NULL', col: 'last_activity', table: 'users' },
    { sql: 'ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(255)', col: 'mfa_secret', table: 'users' },
    { sql: "ALTER TABLE users ADD COLUMN provider ENUM('local', 'google', 'microsoft') DEFAULT 'local'", col: 'provider', table: 'users' },
    { sql: 'ALTER TABLE users ADD COLUMN provider_id VARCHAR(255)', col: 'provider_id', table: 'users' },
    { sql: 'ALTER TABLE tenant_connections ADD COLUMN access_token_encrypted TEXT', col: 'access_token_encrypted', table: 'tenant_connections' },
    { sql: 'ALTER TABLE tenant_connections ADD COLUMN token_expires_at TIMESTAMP NULL', col: 'token_expires_at', table: 'tenant_connections' },
    { sql: 'ALTER TABLE tenant_connections ADD COLUMN certificate_thumbprint VARCHAR(255)', col: 'certificate_thumbprint', table: 'tenant_connections' },
    { sql: 'ALTER TABLE subscriptions ADD COLUMN stripe_customer_id VARCHAR(255)', col: 'stripe_customer_id', table: 'subscriptions' },
    { sql: 'ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id VARCHAR(255)', col: 'stripe_subscription_id', table: 'subscriptions' },
    { sql: 'ALTER TABLE subscription_plans ADD COLUMN stripe_price_id VARCHAR(255)', col: 'stripe_price_id', table: 'subscription_plans' },
    // Detailed Assessment Request appendix fields
    { sql: 'ALTER TABLE detailed_assessment_requests ADD COLUMN manual_review_notes TEXT', col: 'manual_review_notes', table: 'detailed_assessment_requests' },
    { sql: 'ALTER TABLE detailed_assessment_requests ADD COLUMN assessor_signature VARCHAR(255)', col: 'assessor_signature', table: 'detailed_assessment_requests' },
    { sql: 'ALTER TABLE detailed_assessment_requests ADD COLUMN assessor_sign_off_date TIMESTAMP NULL', col: 'assessor_sign_off_date', table: 'detailed_assessment_requests' },
    { sql: 'ALTER TABLE detailed_assessment_requests ADD COLUMN supporting_docs JSON', col: 'supporting_docs', table: 'detailed_assessment_requests' },
    { sql: 'ALTER TABLE control_catalog ADD COLUMN area VARCHAR(100)', col: 'area', table: 'control_catalog' },
    { sql: 'ALTER TABLE control_catalog ADD COLUMN control_type ENUM("pass/fail", "informational") DEFAULT "pass/fail"', col: 'control_type', table: 'control_catalog' },
    { sql: 'ALTER TABLE control_catalog ADD COLUMN scope ENUM("quick", "detailed", "both") DEFAULT "both"', col: 'scope', table: 'control_catalog' },
    { sql: 'ALTER TABLE control_catalog ADD COLUMN validation_rule TEXT', col: 'validation_rule', table: 'control_catalog' },
    { sql: 'ALTER TABLE control_catalog ADD COLUMN required_permissions JSON', col: 'required_permissions', table: 'control_catalog' },
    { sql: 'ALTER TABLE control_catalog ADD COLUMN commands_used JSON', col: 'commands_used', table: 'control_catalog' },
  ];

  for (const stmt of alterStatements) {
    const exists = await columnExists(stmt.table, stmt.col);
    if (!exists) {
      await query(stmt.sql);
      console.log(`Added column ${stmt.col} to ${stmt.table} table`);
    }
  }

  for (const migration of migrations) {
    try {
      await query(migration);
    } catch (error: any) {
      // Ignore "duplicate column" errors for ALTER TABLE statements
      if (!error.message?.includes('Duplicate column name')) {
        console.error('Migration error:', error.message);
        throw error;
      }
    }
  }

  // Update findings result ENUM to include error and info statuses for Email module
  try {
    await query("ALTER TABLE findings MODIFY COLUMN result ENUM('pass', 'fail', 'not_applicable', 'needs_manual_review', 'error', 'info') NOT NULL");
    console.log('Updated findings result ENUM to include error and info statuses');
  } catch (error: any) {
    if (error.message?.includes('Duplicate column name') || error.message?.includes('Unknown column')) {
      // ENUM already updated or table doesn't exist yet
    } else {
      console.error('Failed to update findings ENUM:', error.message);
    }
  }

  console.log('Migrations completed successfully');
}

migrate().catch(console.error);
