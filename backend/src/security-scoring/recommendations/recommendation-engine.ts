import type { NormalizedAssessment, Recommendation, SecurityScoreResult } from '../types';
import { getRecommendationForControl } from '../config/scoring-config';
import { SCORING_CONFIG } from '../config/scoring-config';
import { query } from '../../db/connection';

let controlNameMap: Map<string, string> | null = null;

async function getControlNameMap(): Promise<Map<string, string>> {
  if (!controlNameMap) {
    const rows = await query('SELECT id, control_name FROM control_catalog');
    controlNameMap = new Map((rows as any[]).map((r) => [r.id, r.control_name]));
  }
  return controlNameMap;
}

export async function generateRecommendations(
  assessment: NormalizedAssessment,
  scoreResult: SecurityScoreResult
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  const grouped = new Map<string, { title: string; description: string; remediation: string; controls: string[] }>();

  const controlNameMapLocal = await getControlNameMap();

  for (const control of assessment.controls) {
    if (control.status.toUpperCase() !== 'FAIL') continue;

    const controlName = controlNameMapLocal.get(control.controlId) || control.name;
    const rec = getRecommendationForControl(controlName);
    if (!rec) continue;

    if (!grouped.has(rec.title)) {
      grouped.set(rec.title, { ...rec, controls: [] });
    }
    grouped.get(rec.title)!.controls.push(control.controlId);
  }

  let priority = 1;
  for (const group of grouped.values()) {
    const severity = deriveSeverity(group.controls, assessment);
    const recommendation: Recommendation = {
      id: generateRecommendationId(group.controls[0]),
      controlId: group.controls[0],
      title: group.title,
      description: group.description,
      severity,
      priority,
      remediation: group.remediation,
      reason: `Failed controls: ${group.controls.join(', ')}`,
      affectedControls: group.controls,
    };
    recommendations.push(recommendation);
    priority++;
  }

  recommendations.sort((a, b) => {
    const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const cmp = (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
    if (cmp !== 0) return cmp;
    return a.priority - b.priority;
  });

  return recommendations.slice(0, SCORING_CONFIG.maxRecommendations);
}

function deriveSeverity(controlIds: string[], assessment: NormalizedAssessment): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  let maxSeverity = 'LOW';
  const order: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

  for (const c of assessment.controls) {
    if (controlIds.includes(c.controlId)) {
      const sev = mapSeverity(c.severity);
      if ((order[sev] ?? 0) > (order[maxSeverity] ?? 0)) {
        maxSeverity = sev;
      }
    }
  }

  return maxSeverity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

function mapSeverity(severity: string): string {
  const upper = severity.toUpperCase();
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(upper)) return upper;
  return 'MEDIUM';
}

function generateRecommendationId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return `REC-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}
