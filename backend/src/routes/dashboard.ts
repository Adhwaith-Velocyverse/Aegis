import express from 'express';
import { query } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getScoreForAssessment } from '../security-scoring/integration/assessment-hook';
import type { SecurityScoreResult } from '../security-scoring/types';

const router = express.Router();

interface DashboardTenantContext {
  id: string;
  tenantName: string;
  connectionStatus: string;
  lastHealthCheck?: string;
  lastAssessedAt?: string;
}

interface DashboardLatestAssessment {
  id: string;
  type: string;
  status: string;
  overallScore: number | null;
  securityRating: string;
  scoreBand?: string;
  bandColor?: string;
  bandDescription?: string;
  completedAt?: string;
  calculatedAt?: string;
  summary: {
    totalControls: number;
    assessedControls: number;
    passedControls: number;
    failedControls: number;
    partialControls: number;
    notAssessedControls: number;
    technicalErrors: number;
  };
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryScores: Array<{
    name: string;
    score: number;
    totalControls: number;
    passedControls: number;
    failedControls: number;
    partialControls: number;
    notAssessedControls: number;
  }>;
}

interface DashboardActiveAssessment {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percent: number;
  };
}

interface DashboardFinding {
  id: string;
  controlName: string;
  moduleName: string;
  result: string;
  severity: string;
  evidence: string;
  recommendation: string;
  category?: string;
}

interface DashboardRecommendation {
  id: string;
  title: string;
  description: string;
  severity: string;
  priority: number;
  remediation?: string;
  affectedControls?: string[];
}

interface DashboardRecentAssessment {
  id: string;
  type: string;
  status: string;
  overallScore?: number;
  scoreBand?: string;
  completedAt?: string;
  createdAt: string;
}

interface DashboardTrend {
  trialScores: Array<{ date: string; score: number }>;
  postureScores: Array<{ date: string; score: number; type: string }>;
}

interface DashboardSummary {
  tenant: DashboardTenantContext | null;
  latestAssessment: DashboardLatestAssessment | null;
  activeAssessment: DashboardActiveAssessment | null;
  priorityFindings: DashboardFinding[];
  recommendations: DashboardRecommendation[];
  recentAssessments: DashboardRecentAssessment[];
  trend: DashboardTrend;
}

function parseJsonField<T>(value: any): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

router.get('/summary', authenticate, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId!;

    // 1. Tenant context: most recently health-checked connected tenant for this org
    const tenantRows = await query(
      `SELECT tc.id, tc.tenant_name, tc.connection_status, tc.last_health_check,
              MAX(a.completed_at) as last_assessed_at
       FROM tenant_connections tc
       LEFT JOIN assessments a ON a.tenant_connection_id = tc.id AND a.organization_id = ?
       WHERE tc.organization_id = ? AND tc.connection_status = 'connected'
       GROUP BY tc.id
       ORDER BY tc.last_health_check DESC, tc.created_at DESC
       LIMIT 1`,
      [orgId, orgId]
    );

    const tenant: DashboardTenantContext | null = tenantRows.length > 0 ? {
      id: (tenantRows[0] as any).id,
      tenantName: (tenantRows[0] as any).tenant_name,
      connectionStatus: (tenantRows[0] as any).connection_status,
      lastHealthCheck: (tenantRows[0] as any).last_health_check ? new Date((tenantRows[0] as any).last_health_check).toISOString() : undefined,
      lastAssessedAt: (tenantRows[0] as any).last_assessed_at ? new Date((tenantRows[0] as any).last_assessed_at).toISOString() : undefined,
    } : null;

    // 2. Latest completed assessment for this org
    const latestAssessmentRows = await query(
      `SELECT a.*, tc.tenant_name
       FROM assessments a
       LEFT JOIN tenant_connections tc ON a.tenant_connection_id = tc.id
       WHERE a.organization_id = ? AND a.status = 'completed'
       ORDER BY a.completed_at DESC
       LIMIT 1`,
      [orgId]
    );

    let latestAssessment: DashboardLatestAssessment | null = null;
    let latestAssessmentId: string | null = null;

    if (latestAssessmentRows.length > 0) {
      const row = latestAssessmentRows[0] as any;
      latestAssessmentId = row.id;

      // Load score from security_scores (authoritative for quick/detailed)
      let scoreResult: SecurityScoreResult | null = null;
      const type = row.type;
      if (type === 'quick' || type === 'detailed') {
        scoreResult = await getScoreForAssessment(row.id);
      }

      // Fallback: for trial or if security_scores missing, use assessments table fields
      const overallScore = scoreResult?.overallScore ?? row.overall_score ?? null;
      const securityRating = scoreResult?.securityRating ?? (overallScore === null ? 'No Data' : deriveRating(overallScore));
      const scoreBand = scoreResult ? undefined : row.score_band;
      const bandColor = scoreResult ? undefined : deriveBandColor(overallScore);
      const bandDescription = scoreResult ? undefined : deriveBandDescription(overallScore);
      const calculatedAt = scoreResult?.calculatedAt ? new Date(scoreResult.calculatedAt).toISOString() : (row.completed_at ? new Date(row.completed_at).toISOString() : undefined);

      latestAssessment = {
        id: row.id,
        type: row.type,
        status: row.status,
        overallScore,
        securityRating,
        scoreBand,
        bandColor,
        bandDescription,
        completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
        calculatedAt,
        summary: scoreResult?.summary ?? {
          totalControls: 0,
          assessedControls: 0,
          passedControls: 0,
          failedControls: 0,
          partialControls: 0,
          notAssessedControls: 0,
          technicalErrors: 0,
        },
        severityBreakdown: scoreResult?.severityBreakdown ?? { critical: 0, high: 0, medium: 0, low: 0 },
        categoryScores: scoreResult?.categoryScores ?? [],
      };
    }

    // 3. Active/in-progress assessment
    const activeRows = await query(
      `SELECT a.*, tc.tenant_name
       FROM assessments a
       LEFT JOIN tenant_connections tc ON a.tenant_connection_id = tc.id
       WHERE a.organization_id = ? AND a.status = 'in_progress'
       ORDER BY a.started_at DESC
       LIMIT 1`,
      [orgId]
    );

    let activeAssessment: DashboardActiveAssessment | null = null;
    if (activeRows.length > 0) {
      const active = activeRows[0] as any;
      const modules = await query('SELECT * FROM assessment_modules WHERE assessment_id = ?', [active.id]);
      const totalModules = modules.length;
      const completedModules = (modules as any[]).filter((m: any) => m.collection_status === 'completed').length;
      const failedModules = (modules as any[]).filter((m: any) => m.collection_status === 'failed' || m.collection_status === 'permission_denied').length;
      const progress = totalModules > 0 ? Math.round(((completedModules + failedModules) / totalModules) * 100) : 0;

      activeAssessment = {
        id: active.id,
        type: active.type,
        status: active.status,
        startedAt: active.started_at ? new Date(active.started_at).toISOString() : new Date(active.created_at).toISOString(),
        progress: {
          total: totalModules,
          completed: completedModules,
          failed: failedModules,
          percent: progress,
        },
      };
    }

    // 4. Priority findings from latest completed assessment
    let priorityFindings: DashboardFinding[] = [];
    if (latestAssessmentId) {
      const findingsRows = await query(
        `SELECT f.id, f.result, f.severity, f.evidence, f.recommendation,
                cc.control_name, cc.module_name
         FROM findings f
         JOIN control_catalog cc ON f.control_catalog_id = cc.id
         JOIN assessment_modules am ON f.assessment_module_id = am.id
         WHERE am.assessment_id = ?
         ORDER BY CASE f.severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END
         LIMIT 10`,
        [latestAssessmentId]
      );
      priorityFindings = (findingsRows as any[]).map((f) => ({
        id: f.id,
        controlName: f.control_name,
        moduleName: f.module_name,
        result: f.result,
        severity: f.severity,
        evidence: f.evidence,
        recommendation: f.recommendation,
      }));
    }

    // 5. Recommendations from latest completed assessment (security_scores)
    let recommendations: DashboardRecommendation[] = [];
    if (latestAssessmentId && latestAssessment && (latestAssessment.type === 'quick' || latestAssessment.type === 'detailed')) {
      const scoreRow = await query('SELECT recommendations FROM security_scores WHERE assessment_id = ?', [latestAssessmentId]);
      if (scoreRow.length > 0) {
        const recs = parseJsonField<DashboardRecommendation[]>((scoreRow[0] as any).recommendations);
        if (recs) {
          recommendations = recs;
        }
      }
    }

    // 6. Recent assessments list
    const recentRows = await query(
      `SELECT a.id, a.type, a.status, a.overall_score, a.score_band, a.completed_at, a.created_at
       FROM assessments a
       WHERE a.organization_id = ?
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [orgId]
    );
    const recentAssessments: DashboardRecentAssessment[] = (recentRows as any[]).map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      overallScore: r.overall_score ?? undefined,
      scoreBand: r.score_band ?? undefined,
      completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : undefined,
      createdAt: new Date(r.created_at).toISOString(),
    }));

    // 7. Trend data — keep trial separate from quick/detailed posture scores
    const trialTrendRows = await query(
      `SELECT completed_at as date, overall_score as score
       FROM assessments
       WHERE organization_id = ? AND type = 'trial' AND status = 'completed' AND overall_score IS NOT NULL
       ORDER BY completed_at DESC
       LIMIT 20`,
      [orgId]
    );
    const trialScores = (trialTrendRows as any[]).map((r) => ({
      date: new Date(r.date).toISOString(),
      score: r.score,
    }));

    const postureTrendRows = await query(
      `SELECT a.completed_at as date, ss.overall_score as score, a.type
       FROM security_scores ss
       JOIN assessments a ON ss.assessment_id = a.id
       WHERE a.organization_id = ? AND a.type IN ('quick', 'detailed') AND ss.overall_score IS NOT NULL
       ORDER BY a.completed_at DESC
       LIMIT 20`,
      [orgId]
    );
    const postureScores = (postureTrendRows as any[]).map((r) => ({
      date: new Date(r.date).toISOString(),
      score: r.score,
      type: r.type,
    }));

    const summary: DashboardSummary = {
      tenant,
      latestAssessment,
      activeAssessment,
      priorityFindings,
      recommendations,
      recentAssessments,
      trend: {
        trialScores,
        postureScores,
      },
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard summary' });
  }
});

function deriveRating(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 25) return 'Poor';
  return 'Critical';
}

function deriveBandColor(score: number | null): string | undefined {
  if (score === null) return undefined;
  if (score >= 90) return 'green';
  if (score >= 75) return 'blue';
  if (score >= 50) return 'yellow';
  if (score >= 25) return 'orange';
  return 'red';
}

function deriveBandDescription(score: number | null): string | undefined {
  if (score === null) return undefined;
  if (score >= 90) return 'Strong security posture across all assessed controls.';
  if (score >= 75) return 'Solid security posture with minor improvements recommended.';
  if (score >= 50) return 'Some security controls in place but improvements needed.';
  if (score >= 25) return 'Significant security gaps requiring attention.';
  return 'Critical security gaps requiring immediate remediation.';
}

export default router;
