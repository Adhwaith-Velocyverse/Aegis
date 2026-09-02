# Security Scoring & Recommendation Engine

## Purpose

A standalone, reusable module that calculates security scores from assessment results and generates actionable recommendations. It integrates with the existing Aegis assessment lifecycle without modifying core assessment logic.

## Architecture

```
security-scoring/
├── index.ts                      # Public API exports
├── types/
│   └── index.ts                  # TypeScript interfaces
├── config/
│   └── scoring-config.ts         # Configurable weights, thresholds, recommendation mappings
├── scoring/
│   └── scoring-engine.ts         # Core score calculation logic
├── recommendations/
│   └── recommendation-engine.ts  # Rule-based recommendation generation
├── assessment/
│   └── assessment-data-adapter.ts # Normalizes DB/JSON assessment data
├── persistence/
│   └── score-repository.ts       # Database storage/retrieval
├── integration/
│   ├── assessment-hook.ts        # Triggered after assessment completion
│   ├── report-adapter.ts         # Attaches score to report metadata
│   └── email-adapter.ts          # Sends score email via existing notification system
└── README.md
```

## Input Data Contract

The module consumes `NormalizedAssessment`:

```typescript
interface NormalizedAssessment {
  assessmentId: string;
  tenantId: string;
  organizationId: string;
  assessmentType: string;
  collectedAt: string;
  status: string;
  controls: NormalizedControlResult[];
  moduleNames?: string[];
}
```

## Output Data Contract

Produces `SecurityScoreResult`:

```typescript
interface SecurityScoreResult {
  assessmentId: string;
  tenantId: string;
  calculatedAt: string;
  overallScore: number;
  securityRating: string;
  assessmentStatus: string;
  summary: {
    totalControls: number;
    assessedControls: number;
    passedControls: number;
    failedControls: number;
    partialControls: number;
    notAssessedControls: number;
    technicalErrors: number;
  };
  severityBreakdown: { critical, high, medium, low };
  categoryScores: CategoryScore[];
  failedControls: ControlScore[];
  recommendations: Recommendation[];
  assessmentType: string;
  durationMs?: number;
}
```

## Scoring Algorithm

Deterministic weighted control-based scoring:

```
controlScore = statusWeight × severityWeight × controlWeight
overallScore = Σ(controlScore) / Σ(severityWeight × controlWeight) × 100
```

Only `PASS`, `PARTIAL`, and `FAIL` contribute to the denominator. `NOT_ASSESSED`, `ERROR`, and `INFO` are excluded from scoring but counted separately.

Status weights: `PASS = 1`, `PARTIAL = 0.5`, `FAIL = 0`
Severity weights: `CRITICAL = 4`, `HIGH = 3`, `MEDIUM = 2`, `LOW = 1`

Rating thresholds (configurable):
- 90-100: Excellent
- 80-89: Good
- 70-79: Moderate
- 50-69: Needs Improvement
- 0-49: Critical

## Recommendation Engine

Rule-based recommendations mapped to actual control catalog entries. Recommendations are:
- Resolved via stable control IDs from `control_catalog`, with control name as fallback
- Grouped by title to avoid duplicates
- Sorted by severity then priority
- Linked to affected controls
- Configurable via `CONTROL_RECOMMENDATION_MAP`

## Integration Points

### Assessment Completion

After `calculateAssessmentScore()` in `assessmentEngine.ts`:

```typescript
const securityScore = await processAssessmentScore(assessmentId);
if (securityScore) {
  await attachScoreToReport(assessmentId, securityScore);
}
```

### Worker / Email

In `worker.ts`, after assessment completion:

```typescript
const securityScore = await getScoreForAssessment(assessmentId);
if (securityScore) {
  await sendScoreEmail(user.id, assessmentId, securityScore);
}
```

### Reporting

`attachScoreToReport()` stores score, category scores, and recommendations as JSON in `assessment_metadata` with keys:
- `security_score`
- `category_scores`
- `recommendations`

The report adapter uses a database transaction so these three metadata records stay consistent.

## Database

Requires `security_scores` table:

```sql
CREATE TABLE IF NOT EXISTS security_scores (
  id VARCHAR(36) PRIMARY KEY,
  assessment_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  overall_score INT NOT NULL,
  security_rating VARCHAR(50) NOT NULL,
  assessment_status VARCHAR(50),
  summary JSON,
  severity_breakdown JSON,
  category_scores JSON,
  failed_controls JSON,
  recommendations JSON,
  assessment_type VARCHAR(50),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_assessment (tenant_id, assessment_id),
  INDEX idx_calculated_at (calculated_at),
  UNIQUE KEY unique_assessment_score (assessment_id)
)
```

## Idempotency

One authoritative score per assessment is enforced by:
- A database `UNIQUE KEY` on `security_scores.assessment_id`
- `INSERT ... ON DUPLICATE KEY UPDATE` in the score repository
- Worker retries cannot create duplicate score records

## Email

Email delivery is handled exclusively by `sendScoreEmail()` in the security scoring module. It:
- Resolves recipient email from the `users` table
- Validates email format before sending
- Includes score, control summary, severity breakdown, and top recommendations
- Logs delivery success/failure without exposing credentials
- Does not send if no client users are found

## Portability

To copy this module into another backend:

1. Copy the entire `security-scoring/` folder
2. Implement adapters:
   - `AssessmentDataProvider` — fetch assessment/control data
   - `ScoreRepository` — persist scores
   - `EmailNotifier` — send notifications
   - `ReportDataProvider` — attach scores to reports
3. Call `processAssessmentScore(assessmentId)` after assessment completion
4. Run the included database migration

## Testing

Run tests:
```bash
cd backend && npm test
```

## Configuration

Edit `config/scoring-config.ts` to change:
- Status/severity weights
- Rating thresholds
- Recommendation mappings
- Maximum recommendations returned

## Status Handling

- `PASS` → contributes 100% to score
- `PARTIAL` → contributes 50% to score
- `FAIL` → contributes 0% to score
- `NOT_ASSESSED` → excluded from score, counted in summary
- `ERROR` → excluded from score, counted as technical error
- `INFO` → excluded from score, counted in summary

## Tenant Isolation

- Tenant ID is resolved from `tenant_connections` via `tenant_connection_id`
- Missing tenant connections throw an error instead of falling back to `'unknown'`
- All score queries are scoped by tenant or assessment ID
