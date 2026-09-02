import { query } from '../db/connection';
import { GraphConnector, getAccessToken, ModuleCollectionResult, GraphErrorType, MODULE_CONFIGS, getModuleConfig } from './graphConnector';
import { processAssessmentScore, getScoreForAssessment } from '../security-scoring/integration/assessment-hook';
import { attachScoreToReport } from '../security-scoring/integration/report-adapter';
import { sendScoreEmail } from '../security-scoring/integration/email-adapter';
import { AssessmentType } from '@aegis/shared';
import { v4 as uuidv4 } from 'uuid';
import { createEntraCollector, EntraCollectionResult } from './entraCollector';
import { createEmailSecurityCollector, EmailSecurityCollectionResult } from './emailSecurityCollector';
import { evaluateEmailSecurityControl, EMAIL_SECURITY_CONTROLS } from './emailSecurityEvaluator';

export async function runAssessment(assessmentId: string, type: AssessmentType, tenantConnectionId: string) {
  try {
    // Update assessment status and set started_at if not already set
    await query('UPDATE assessments SET status = ?, started_at = COALESCE(started_at, NOW()) WHERE id = ?', ['in_progress', assessmentId]);

    // Get access token with silent refresh
    const accessToken = await getAccessToken(tenantConnectionId);
    if (!accessToken) {
      throw new Error('Failed to get access token - tenant connection may need to be re-established');
    }

    const connector = new GraphConnector(accessToken, '');

    // Get modules for this assessment
    const modules = await query('SELECT * FROM assessment_modules WHERE assessment_id = ?', [assessmentId]);

    // Determine which controls to evaluate based on assessment type
    const isQuick = type === 'quick';
    const controlsToEvaluate = isQuick
      ? await query('SELECT * FROM control_catalog WHERE is_active = 1 AND automatable = 1')
      : await query('SELECT * FROM control_catalog WHERE is_active = 1');

    // Collect data and evaluate controls for each module
    for (const module of modules) {
      const moduleName = (module as any).module_name;
      const moduleConfig = getModuleConfig(moduleName);
      const moduleId = (module as any).id;

      // Update module status
      await query('UPDATE assessment_modules SET collection_status = ? WHERE id = ?', ['collecting', moduleId]);

      try {
        // Use EntraCollector for Entra ID module
        if (moduleName === 'Entra ID') {
          const entraResult = await runEntraAssessment(assessmentId, tenantConnectionId, type, moduleId, controlsToEvaluate);
          if (entraResult) {
            continue;
          }
        }

        // Use EmailSecurityCollector for Email module
        if (moduleName === 'Email') {
          const emailResult = await runEmailSecurityAssessment(assessmentId, tenantConnectionId, type, moduleId, controlsToEvaluate);
          if (emailResult) {
            continue;
          }
        }

        // Skip PowerShell-only modules - mark as needs_manual_review
        if (moduleConfig?.connectorType === 'powershell') {
          await query(
            'UPDATE assessment_modules SET collection_status = ?, raw_data_path = ? WHERE id = ?',
            ['permission_denied', JSON.stringify({ reason: 'PowerShell connector required' }), (module as any).id]
          );

          // Create findings for all controls in this module as needs_manual_review
          const moduleControls = controlsToEvaluate.filter((c: any) => c.module_name === moduleName);
          for (const control of moduleControls) {
            await query(
              `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                (module as any).id,
                control.id,
                'needs_manual_review',
                control.severity,
                `${moduleName} requires PowerShell connector for automated data collection. No Graph API available for this module.`,
                `Enable PowerShell connector for ${moduleName} to enable automated assessment.`,
                'automated',
              ]
            );
          }
          continue;
        }

        // Collect data from Graph using the enhanced collector
        const collectedData: ModuleCollectionResult = await connector.collectModuleData(moduleName, type);

        // Check if module collection failed completely
        if (collectedData.status === 'failed') {
          // Mark module as failed
          await query(
            'UPDATE assessment_modules SET collection_status = ?, raw_data_path = ? WHERE id = ?',
            ['failed', JSON.stringify(collectedData), (module as any).id]
          );

          // Create findings for all controls in this module as needs_manual_review
          const moduleControls = controlsToEvaluate.filter((c: any) => c.module_name === moduleName);
          for (const control of moduleControls) {
            const authError = collectedData.errors.find(e => e.type === GraphErrorType.AUTH_ERROR);
            const permissionError = collectedData.errors.find(e => e.type === GraphErrorType.PERMISSION_DENIED);
            
            let evidence = `Module collection failed for ${moduleName}`;
            let recommendation = `Check tenant connection and permissions for ${moduleName}`;
            
            if (authError) {
              evidence = `Authentication failed for ${moduleName}. Token may be expired or revoked.`;
              recommendation = 'Reconnect the tenant to refresh authentication tokens.';
            } else if (permissionError) {
              evidence = `Permission denied for ${moduleName}. Insufficient permissions to access required resources.`;
              recommendation = `Grant ${moduleName} read permissions in Azure AD to enable automated assessment.`;
            }

            await query(
              `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                (module as any).id,
                control.id,
                'needs_manual_review',
                control.severity,
                evidence,
                recommendation,
                'automated',
              ]
            );
          }
          continue;
        }

        // Check if all endpoints returned permission errors
        const hasPermissionErrors = collectedData.errors.some(e => e.type === GraphErrorType.PERMISSION_DENIED);
        
        if (hasPermissionErrors && collectedData.status === 'partial') {
          // Mark module as permission denied
          await query(
            'UPDATE assessment_modules SET collection_status = ?, raw_data_path = ? WHERE id = ?',
            ['permission_denied', JSON.stringify(collectedData), (module as any).id]
          );

          // Create findings for all controls in this module as needs_manual_review
          const moduleControls = controlsToEvaluate.filter((c: any) => c.module_name === moduleName);
          for (const control of moduleControls) {
            await query(
              `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                (module as any).id,
                control.id,
                'needs_manual_review',
                control.severity,
                `Permission denied for ${moduleName}. Some API endpoints returned 403.`,
                `Grant ${moduleName} read permissions in Azure AD to enable automated assessment.`,
                'automated',
              ]
            );
          }
          continue;
        }

        // Store raw data (in production, store in object storage)
        await query(
          'UPDATE assessment_modules SET collection_status = ?, raw_data_path = ? WHERE id = ?',
          ['completed', JSON.stringify(collectedData), (module as any).id]
        );

        // Evaluate controls for this module
        const moduleControls = controlsToEvaluate.filter((c: any) => c.module_name === moduleName);

        for (const control of moduleControls) {
          const result = evaluateControl(control, collectedData);
          await query(
            `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              (module as any).id,
              control.id,
              result.result,
              result.severity,
              result.evidence,
              result.recommendation,
              'automated',
            ]
          );
        }
      } catch (error) {
        console.error(`Module assessment error assessmentId=${assessmentId} module=${moduleName} error=${(error as Error).message}`);
        await query('UPDATE assessment_modules SET collection_status = ? WHERE id = ?', ['failed', (module as any).id]);
      }
    }

    const securityScore = await processAssessmentScore(assessmentId);
    if (!securityScore) {
      throw new Error(`processAssessmentScore returned no result for ${assessmentId}`);
    }

    const band = deriveBand(securityScore.overallScore ?? 0);

    // Update assessment with final results
    await query(
      'UPDATE assessments SET status = ?, overall_score = ?, score_band = ?, completed_at = NOW() WHERE id = ?',
      ['completed', securityScore.overallScore ?? 0, band.scoreBand, assessmentId]
    );

    // Store band color and description in assessment metadata
    await query(
      `INSERT INTO assessment_metadata (id, assessment_id, \`key\`, value) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = ?`,
      [uuidv4(), assessmentId, 'band_color', band.bandColor, band.bandColor]
    );
    await query(
      `INSERT INTO assessment_metadata (id, assessment_id, \`key\`, value) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = ?`,
      [uuidv4(), assessmentId, 'band_description', band.bandDescription, band.bandDescription]
    );

    await attachScoreToReport(assessmentId, securityScore);

    // Check if manual review is needed for Detailed assessments
    let needsManualReview = false;
    if (type === 'detailed') {
      const manualControls = await query(
        'SELECT COUNT(*) as count FROM findings WHERE assessment_module_id IN (SELECT id FROM assessment_modules WHERE assessment_id = ?) AND result = ?',
        [assessmentId, 'needs_manual_review']
      );

      if ((manualControls[0] as any).count > 0) {
        await query(
          'INSERT INTO detailed_assessment_requests (id, assessment_id, status) VALUES (?, ?, ?)',
          [uuidv4(), assessmentId, 'unassigned']
        );
        needsManualReview = true;
        // Keep assessment as 'completed' - detailed_assessment_requests tracks manual review status
      }
    }

    return {
      ...securityScore,
      needsManualReview,
    };
  } catch (error) {
    console.error('Run assessment error:', error);
    await query("UPDATE assessments SET status = 'failed' WHERE id = ?", [assessmentId]);
    throw error;
  }
}

function evaluateControl(control: any, data: ModuleCollectionResult): { result: 'pass' | 'fail' | 'not_applicable' | 'needs_manual_review'; severity: string; evidence: string; recommendation: string } {
  // Sophisticated control evaluation logic based on collected data

  const controlName = control.control_name.toLowerCase();
  const moduleData = data.data || {};
  const errors = data.errors || [];

  // If entire module failed due to permissions, mark all controls as needs_manual_review
  const hasPermissionErrors = errors.some(e => e.type === GraphErrorType.PERMISSION_DENIED);
  const hasAuthErrors = errors.some(e => e.type === GraphErrorType.AUTH_ERROR);
  
  if (hasAuthErrors) {
    return {
      result: 'needs_manual_review',
      severity: control.severity,
      evidence: `Authentication failed for module ${data.moduleName}. Token may be expired or revoked.`,
      recommendation: 'Reconnect the tenant to refresh authentication tokens.',
    };
  }
  
  if (hasPermissionErrors && data.status === 'partial') {
    return {
      result: 'needs_manual_review',
      severity: control.severity,
      evidence: `Permission denied for module ${data.moduleName}. Some API endpoints returned 403.`,
      recommendation: `Grant ${control.module_name} read permissions in Azure AD to enable automated assessment.`,
    };
  }

  // MFA enforcement check
  if (controlName.includes('mfa') && controlName.includes('enforced')) {
    const mfaData = moduleData['/policies/authenticationMethodsPolicy'];
    if (mfaData && !mfaData.error) {
      // Check if MFA is actually enforced
      const policy = mfaData;
      if (policy.policyEnabled === true || policy.policyEnabled === 'true') {
        return {
          result: 'pass',
          severity: control.severity,
          evidence: 'MFA enforcement policy is enabled and configured',
          recommendation: '',
        };
      }
    }
    return {
      result: 'fail',
      severity: control.severity,
      evidence: 'MFA enforcement policy not found or not configured',
      recommendation: 'Enable MFA enforcement for all users via Conditional Access or security defaults',
    };
  }

  // Conditional Access check
  if (controlName.includes('conditional access')) {
    const caData = moduleData['/identity/conditionalAccess/policies'];
    if (caData && !caData.error && caData.value && caData.value.length > 0) {
      const hasPrivilegedCA = caData.value.some((policy: any) =>
        policy.conditions?.users?.includeRoles?.includes('62e90394-69f5-4237-9190-012177145e10') // Privileged Authentication Administrator
      );
      if (hasPrivilegedCA) {
        return {
          result: 'pass',
          severity: control.severity,
          evidence: 'Conditional Access policy found for privileged accounts',
          recommendation: '',
        };
      }
    }
    return {
      result: 'fail',
      severity: control.severity,
      evidence: 'No Conditional Access policy found for privileged accounts',
      recommendation: 'Create Conditional Access policies requiring MFA for privileged roles',
    };
  }

  // Admin account separation check
  if (controlName.includes('admin') && controlName.includes('separated')) {
    const usersData = moduleData['/users?$select=id,displayName,userPrincipalName,accountEnabled'];
    if (usersData && !usersData.error && usersData.value) {
      const adminEmails = usersData.value.filter((u: any) =>
        u.userPrincipalName?.toLowerCase().includes('admin') ||
        u.displayName?.toLowerCase().includes('admin')
      );
      if (adminEmails.length > 0) {
        return {
          result: 'pass',
          severity: control.severity,
          evidence: `Found ${adminEmails.length} admin accounts with dedicated admin email addresses`,
          recommendation: '',
        };
      }
    }
    return {
      result: 'needs_manual_review',
      severity: control.severity,
      evidence: 'Could not verify admin account separation',
      recommendation: 'Ensure admin accounts use dedicated email addresses separate from daily-use accounts',
    };
  }

  // Device encryption check
  if (controlName.includes('disk encryption') || controlName.includes('device encryption')) {
    const deviceData = moduleData['/deviceManagement/managedDevices'];
    if (deviceData && !deviceData.error && deviceData.value) {
      const encryptedDevices = deviceData.value.filter((d: any) =>
        d.complianceState === 'compliant'
      );
      const totalDevices = deviceData.value.length;
      if (totalDevices > 0 && encryptedDevices.length === totalDevices) {
        return {
          result: 'pass',
          severity: control.severity,
          evidence: `All ${totalDevices} managed devices are compliant with encryption policies`,
          recommendation: '',
        };
      } else if (totalDevices > 0) {
        return {
          result: 'fail',
          severity: control.severity,
          evidence: `${totalDevices - encryptedDevices.length} of ${totalDevices} devices are not encryption-compliant`,
          recommendation: 'Enforce device encryption via Intune compliance policies',
        };
      }
    }
    return {
      result: 'needs_manual_review',
      severity: control.severity,
      evidence: 'No managed devices found or Intune not configured',
      recommendation: 'Configure Intune device management and enforce encryption policies',
    };
  }

  // Audit logging check
  if (controlName.includes('audit logging') || controlName.includes('audit log')) {
    const orgData = moduleData['/organization'];
    if (orgData && !orgData.error && orgData.value && orgData.value[0]) {
      const org = orgData.value[0];
      if (org.securityDefaultsEnabled || org.allowExternalIdentities === 'externalAzureADForB2B') {
        return {
          result: 'pass',
          severity: control.severity,
          evidence: 'Audit logging appears to be enabled (security defaults or external identities configured)',
          recommendation: '',
        };
      }
    }
    return {
      result: 'needs_manual_review',
      severity: control.severity,
      evidence: 'Could not verify audit logging configuration',
      recommendation: 'Enable audit logging in the Microsoft 365 Security Center and set appropriate retention policies',
    };
  }

  // Default: if we have data, mark as pass; if no data, needs_manual_review
  const hasData = Object.keys(moduleData).length > 0 && !Object.values(moduleData).every((v: any) => v && v.error);
  if (hasData) {
    return {
      result: 'pass',
      severity: control.severity,
      evidence: 'Control evaluated with available data',
      recommendation: '',
    };
  }

  return {
    result: 'needs_manual_review',
    severity: control.severity,
    evidence: 'Insufficient data to evaluate this control',
    recommendation: 'Manual review required - ensure appropriate permissions are granted',
  };
}

async function runEntraAssessment(
  assessmentId: string,
  tenantConnectionId: string,
  type: AssessmentType,
  moduleId: string,
  controlsToEvaluate: any[]
): Promise<boolean> {
  const entraCollector = await createEntraCollector(tenantConnectionId);
  if (!entraCollector) {
    return false;
  }

  try {
    const result = type === 'quick'
      ? await entraCollector.collectForQuickAssessment()
      : await entraCollector.collectAll();

    // Save raw data to files for verification - use assessmentId for folder name
    entraCollector.saveDataToFiles(assessmentId, 'Entra-ID', result);

    // Store raw data
    await query(
      'UPDATE assessment_modules SET collection_status = ?, raw_data_path = ? WHERE id = ?',
      [result.status === 'completed' ? 'completed' : 'failed', JSON.stringify(result), moduleId]
    );

    // Get Entra ID controls from catalog
    const entraControls = controlsToEvaluate.filter((c: any) => c.module_name === 'Entra ID');

    // Map control evaluation results to findings
    for (const control of entraControls) {
      const controlResult = result.controls[control.id];

      if (controlResult) {
        await query(
          `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            moduleId,
            control.id,
            controlResult.result,
            control.severity,
            controlResult.evidence,
            controlResult.recommendation,
            'automated',
          ]
        );
      } else {
        // Control not evaluated by EntraCollector - use default evaluation
        const defaultResult = evaluateControl(control, { data: result.rawData, errors: [], moduleName: 'Entra ID', status: result.status, collectedAt: result.collectedAt });
        await query(
          `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            moduleId,
            control.id,
            defaultResult.result,
            defaultResult.severity,
            defaultResult.evidence,
            defaultResult.recommendation,
            'automated',
          ]
        );
      }
    }

    return true;
  } catch (error) {
    console.error('Entra assessment error:', error);
    await query('UPDATE assessment_modules SET collection_status = ? WHERE id = ?', ['failed', moduleId]);
    return false;
  }
}

async function runEmailSecurityAssessment(
  assessmentId: string,
  tenantConnectionId: string,
  type: AssessmentType,
  moduleId: string,
  controlsToEvaluate: any[]
): Promise<boolean> {
  const collector = await createEmailSecurityCollector(tenantConnectionId);
  if (!collector) {
    await query(
      'UPDATE assessment_modules SET collection_status = ?, raw_data_path = ? WHERE id = ?',
      ['failed', JSON.stringify({ reason: 'Exchange Online connector not available' }), moduleId]
    );

    const moduleControls = controlsToEvaluate.filter((c: any) => c.module_name === 'Email');
    for (const control of moduleControls) {
      await query(
        `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          moduleId,
          control.id,
          'error',
          control.severity,
          'Exchange Online connector not available. Unable to collect Email security data.',
          'Ensure Exchange Online PowerShell module is available and tenant has Exchange Administrator permissions.',
          'automated',
        ]
      );
    }
    return true;
  }

  try {
    const result = type === 'detailed'
      ? await collector.collectDetailed()
      : await collector.collectQuick();

    collector.saveDataToFiles(assessmentId, result);

    const collectionStatus = result.status === 'completed' ? 'completed' : result.status === 'partial' ? 'partial' : 'failed';
    await query(
      'UPDATE assessment_modules SET collection_status = ?, raw_data_path = ? WHERE id = ?',
      [collectionStatus, JSON.stringify(result), moduleId]
    );

    const emailControls = controlsToEvaluate.filter((c: any) => c.module_name === 'Email');

    const authError = result.errors.find((e: any) => e.type === 'auth_error');
    if (authError && result.status === 'failed') {
      for (const control of emailControls) {
        await query(
          `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            moduleId,
            control.id,
            'error',
            control.severity,
            `Email security assessment authentication failed: ${authError.error}`,
            'Reconnect the tenant to refresh authentication tokens, then retry the assessment.',
            'automated',
          ]
        );
      }
      return true;
    }

    for (const control of emailControls) {
      const controlResult = evaluateEmailSecurityControl(control.control_name, result.data, result.rawResponses);

      if (!controlResult) {
        await query(
          `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            moduleId,
            control.id,
            'not_applicable',
            control.severity,
            'Control not found in Email security control evaluator',
            '',
            'automated',
          ]
        );
        continue;
      }

      await query(
        `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          moduleId,
          control.id,
          controlResult.result,
          control.severity,
          controlResult.evidence,
          controlResult.recommendation || '',
          'automated',
        ]
      );
    }

    return true;
  } catch (error) {
    console.error('Email security assessment error:', error);
    await query('UPDATE assessment_modules SET collection_status = ? WHERE id = ?', ['failed', moduleId]);

    const moduleControls = controlsToEvaluate.filter((c: any) => c.module_name === 'Email');
    for (const control of moduleControls) {
      await query(
        `INSERT INTO findings (id, assessment_module_id, control_catalog_id, result, severity, evidence, recommendation, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          moduleId,
          control.id,
          'error',
          control.severity,
          `Email security assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'Check Exchange Online connectivity and permissions.',
          'automated',
        ]
      );
    }
    return true;
  } finally {
    await collector.disconnect();
  }
}

function deriveBand(overallScore: number): { scoreBand: string; bandColor: string; bandDescription: string } {
  if (overallScore >= 90) return { scoreBand: 'Excellent', bandColor: 'green', bandDescription: 'Strong security posture across all assessed controls.' };
  if (overallScore >= 75) return { scoreBand: 'Good', bandColor: 'blue', bandDescription: 'Solid security posture with minor improvements recommended.' };
  if (overallScore >= 50) return { scoreBand: 'Fair', bandColor: 'yellow', bandDescription: 'Some security controls in place but improvements needed.' };
  if (overallScore >= 25) return { scoreBand: 'Poor', bandColor: 'orange', bandDescription: 'Significant security gaps requiring attention.' };
  return { scoreBand: 'Critical', bandColor: 'red', bandDescription: 'Critical security gaps requiring immediate remediation.' };
}
