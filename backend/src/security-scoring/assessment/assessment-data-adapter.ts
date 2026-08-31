import { query } from '../../db/connection';
import type { NormalizedAssessment, NormalizedControlResult } from '../types';

export async function getAssessmentData(assessmentId: string): Promise<NormalizedAssessment | null> {
  const assessmentRows = await query(
    'SELECT id, organization_id, tenant_connection_id, type, status, created_at, completed_at FROM assessments WHERE id = ?',
    [assessmentId]
  );

  if (assessmentRows.length === 0) return null;

  const assessment = assessmentRows[0] as any;
  const tenantConnectionId = assessment.tenant_connection_id;

  const tenantRows = await query(
    'SELECT tenant_id FROM tenant_connections WHERE id = ?',
    [tenantConnectionId]
  );

  if (tenantRows.length === 0) {
    throw new Error(`Tenant connection ${tenantConnectionId} not found for assessment ${assessmentId}`);
  }

  const tenantId = (tenantRows[0] as any).tenant_id;

  const moduleRows = await query(
    'SELECT id, module_name FROM assessment_modules WHERE assessment_id = ?',
    [assessmentId]
  );

  const moduleIds = (moduleRows as any[]).map((m) => m.id);

  let findings: NormalizedControlResult[] = [];
  if (moduleIds.length > 0) {
    const placeholders = moduleIds.map(() => '?').join(',');
    const findingsRows = await query(
      `SELECT f.control_catalog_id, f.result, f.severity, f.evidence, f.recommendation, cc.control_name, cc.module_name, cc.weight
       FROM findings f
       JOIN control_catalog cc ON f.control_catalog_id = cc.id
       WHERE f.assessment_module_id IN (${placeholders})`,
      moduleIds
    );

    findings = (findingsRows as any[]).map((f) => ({
      controlId: f.control_catalog_id,
      name: f.control_name || 'Unknown',
      moduleName: f.module_name || 'Unknown',
      status: f.result || 'NOT_ASSESSED',
      severity: f.severity || 'medium',
      weight: parseFloat(f.weight) || 1,
      evidence: f.evidence,
      recommendation: f.recommendation,
      description: f.control_name,
    }));
  }

  return {
    assessmentId,
    tenantId,
    organizationId: assessment.organization_id,
    assessmentType: assessment.type || 'quick',
    collectedAt: assessment.completed_at || assessment.created_at || new Date().toISOString(),
    status: assessment.status || 'unknown',
    controls: findings,
    moduleNames: (moduleRows as any[]).map((m) => m.module_name),
  };
}

export async function getLatestCompletedAssessment(tenantId: string): Promise<NormalizedAssessment | null> {
  const tenantConnections = await query(
    'SELECT id FROM tenant_connections WHERE tenant_id = ?',
    [tenantId]
  );

  if (tenantConnections.length === 0) return null;

  const connectionIds = (tenantConnections as any[]).map((c) => c.id);

  const assessments = await query(
    `SELECT a.id, a.organization_id, a.tenant_connection_id, a.type, a.status, a.created_at, a.completed_at
     FROM assessments a
     WHERE a.tenant_connection_id IN (?) AND a.status IN ('completed', 'partial')
     ORDER BY a.completed_at DESC, a.created_at DESC
     LIMIT 1`,
    [connectionIds]
  );

  if (assessments.length === 0) return null;

  const assessment = assessments[0] as any;
  return getAssessmentData(assessment.id);
}
