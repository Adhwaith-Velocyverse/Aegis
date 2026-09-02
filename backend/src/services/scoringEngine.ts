import { query } from '../db/connection';
import { ControlResult } from '@aegis/shared';

export interface ScoringResult {
  overallScore: number;
  scoreBand: string;
  bandColor: string;
  bandDescription: string;
  moduleScores: Record<string, number>;
  passedCount: number;
  failedCount: number;
  notApplicableCount: number;
  controlsAssessed: number;
  topFindings: any[];
}

export async function calculateAssessmentScore(assessmentId: string): Promise<ScoringResult> {
  // Get all modules for this assessment
  const modules = await query('SELECT * FROM assessment_modules WHERE assessment_id = ?', [assessmentId]);

  // Get assessment type and timing for threshold lookup and duration calculation
  const assessment = await query('SELECT type, started_at, completed_at FROM assessments WHERE id = ?', [assessmentId]);
  const assessmentType = (assessment[0] as any)?.type || 'quick';
  const startedAt = (assessment[0] as any)?.started_at;
  const completedAt = (assessment[0] as any)?.completed_at;

  // Calculate duration in milliseconds
  let durationMs = 0;
  if (startedAt && completedAt) {
    durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  }

  const moduleScores: Record<string, number> = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let passedCount = 0;
  let failedCount = 0;
  let notApplicableCount = 0;
  let controlsAssessed = 0;
  const allFindings: any[] = [];

  // Module weights for overall score calculation (tunable weighting scheme)
  const moduleWeights: Record<string, number> = {
    'Entra ID': 1.5,           // Identity is critical
    'M365 Admin Center': 1.0,  // Admin config
    'Purview': 1.2,            // Compliance
    'Email': 1.3,              // Email security
    'Intune': 1.2,             // Device management
    'Cloud Apps': 1.1,         // Cloud security
    'Teams': 1.0,              // Collaboration
    'SharePoint': 1.0,         // Content sharing
  };

  for (const module of modules) {
    const moduleId = (module as any).id;
    const moduleName = (module as any).module_name;

    // Get findings for this module
    const findings = await query(
      'SELECT f.*, cc.weight, cc.control_name, cc.severity FROM findings f JOIN control_catalog cc ON f.control_catalog_id = cc.id WHERE f.assessment_module_id = ?',
      [moduleId]
    );

    let moduleWeightedScore = 0;
    let moduleWeight = 0;
    let modulePassed = 0;
    let moduleFailed = 0;
    let moduleNA = 0;

    for (const finding of findings) {
      const f = finding as any;
      const weight = parseFloat(f.weight) || 1;
      controlsAssessed++;

      if (f.result === 'pass') {
        moduleWeightedScore += weight * 100;
        modulePassed++;
        passedCount++;
      } else if (f.result === 'fail') {
        moduleFailed++;
        failedCount++;
        allFindings.push({
          ...f,
          moduleName,
          severity: f.severity || 'medium',
        });
      } else if (f.result === 'not_applicable' || f.result === 'needs_manual_review' || f.result === 'error' || f.result === 'info') {
        moduleNA++;
        notApplicableCount++;
      }

      moduleWeight += weight;
    }

    const moduleScore = moduleWeight > 0 ? Math.round(moduleWeightedScore / moduleWeight) : 0;
    moduleScores[moduleName] = moduleScore;

    // Update module record
    await query(
      'UPDATE assessment_modules SET module_score = ?, passed_count = ?, failed_count = ?, not_applicable_count = ? WHERE id = ?',
      [moduleScore, modulePassed, moduleFailed, moduleNA, moduleId]
    );

    // Apply module weight to overall score
    const moduleWeightMultiplier = moduleWeights[moduleName] || 1.0;
    totalWeightedScore += moduleScore * moduleWeight * moduleWeightMultiplier;
    totalWeight += moduleWeight * moduleWeightMultiplier;
  }

  const overallScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;

  // Get configurable score band from database based on assessment type
  const thresholds = await query(
    `SELECT band_name, min_score, max_score, color, description FROM scoring_thresholds WHERE assessment_type = ? AND is_active = TRUE ORDER BY min_score ASC`,
    [assessmentType]
  );

  let scoreBand = 'Fair';
  let bandColor = 'yellow';
  let bandDescription = 'Some security controls in place but improvements needed.';

  for (const threshold of thresholds as any[]) {
    if (overallScore >= parseFloat(threshold.min_score) && overallScore <= parseFloat(threshold.max_score)) {
      scoreBand = threshold.band_name;
      bandColor = threshold.color;
      bandDescription = threshold.description;
      break;
    }
  }

  // Sort findings by severity for top findings
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  allFindings.sort((a, b) => (severityOrder[a.severity as string] || 2) - (severityOrder[b.severity as string] || 2));

  // Update assessment record with final scoring data
  await query(
    'UPDATE assessments SET overall_score = ?, score_band = ?, controls_assessed = ?, duration_ms = ? WHERE id = ?',
    [overallScore, scoreBand, controlsAssessed, durationMs, assessmentId]
  );

  return {
    overallScore,
    scoreBand,
    bandColor,
    bandDescription,
    moduleScores,
    passedCount,
    failedCount,
    notApplicableCount,
    controlsAssessed,
    topFindings: allFindings.slice(0, 10),
  };
}
