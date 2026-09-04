import type { Assessment } from '@aegis/shared';

export interface AssessmentRow {
  id: string;
  organization_id: string;
  tenant_connection_id?: string;
  type: string;
  status: string;
  overall_score?: number;
  score_band?: string;
  controls_assessed?: number;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  updated_at: string;
  tenant_name?: string;
  org_name?: string;
  [key: string]: any;
}

export function mapAssessmentRow(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    tenantConnectionId: row.tenant_connection_id,
    type: row.type as Assessment['type'],
    status: row.status as Assessment['status'],
    overallScore: row.overall_score ?? undefined,
    scoreBand: row.score_band ?? undefined,
    controlsAssessed: row.controls_assessed ?? undefined,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    durationMs: row.duration_ms ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    tenantName: row.tenant_name ?? undefined,
    assessmentOwner: row.assessmentOwner ?? undefined,
  };
}

export function mapAssessmentRows(rows: AssessmentRow[]): Assessment[] {
  return rows.map(mapAssessmentRow);
}
