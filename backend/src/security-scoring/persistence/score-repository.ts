import { query } from '../../db/connection';
import type { SecurityScoreResult } from '../types';

function toMySQLTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function saveSecurityScore(score: SecurityScoreResult): Promise<void> {
  const scoreId = require('uuid').v4();
  const calculatedAt = toMySQLTimestamp(score.calculatedAt);

  await query(
    `INSERT INTO security_scores (id, assessment_id, tenant_id, overall_score, security_rating, summary, severity_breakdown, category_scores, failed_controls, recommendations, assessment_type, assessment_status, calculated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       tenant_id = VALUES(tenant_id),
       overall_score = VALUES(overall_score),
       security_rating = VALUES(security_rating),
       summary = VALUES(summary),
       severity_breakdown = VALUES(severity_breakdown),
       category_scores = VALUES(category_scores),
       failed_controls = VALUES(failed_controls),
       recommendations = VALUES(recommendations),
       assessment_type = VALUES(assessment_type),
       assessment_status = VALUES(assessment_status),
       calculated_at = VALUES(calculated_at),
       updated_at = CURRENT_TIMESTAMP`,
    [
      scoreId,
      score.assessmentId,
      score.tenantId,
      score.overallScore,
      score.securityRating,
      JSON.stringify(score.summary),
      JSON.stringify(score.severityBreakdown),
      JSON.stringify(score.categoryScores),
      JSON.stringify(score.failedControls),
      JSON.stringify(score.recommendations),
      score.assessmentType,
      score.assessmentStatus,
      calculatedAt,
    ]
  );
}

export async function getLatestScore(tenantId: string): Promise<SecurityScoreResult | null> {
  const rows = await query(
    `SELECT * FROM security_scores WHERE tenant_id = ? ORDER BY calculated_at DESC LIMIT 1`,
    [tenantId]
  );

  if (rows.length === 0) return null;
  return parseScoreRow(rows[0] as any);
}

export async function getScoreByAssessmentId(assessmentId: string): Promise<SecurityScoreResult | null> {
  const rows = await query(
    `SELECT * FROM security_scores WHERE assessment_id = ? LIMIT 1`,
    [assessmentId]
  );

  if (rows.length === 0) return null;
  return parseScoreRow(rows[0] as any);
}

function parseScoreRow(row: any): SecurityScoreResult {
  return {
    assessmentId: row.assessment_id,
    tenantId: row.tenant_id,
    calculatedAt: row.calculated_at,
    overallScore: row.overall_score,
    securityRating: row.security_rating,
    summary: parseJsonField(row.summary),
    severityBreakdown: parseJsonField(row.severity_breakdown),
    categoryScores: parseJsonField(row.category_scores),
    failedControls: parseJsonField(row.failed_controls),
    recommendations: parseJsonField(row.recommendations),
    assessmentType: row.assessment_type || 'quick',
    assessmentStatus: row.assessment_status || 'completed',
  };
}

function parseJsonField(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
