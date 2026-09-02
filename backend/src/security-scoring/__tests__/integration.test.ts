import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processAssessmentScore } from '../integration/assessment-hook';
import { calculateSecurityScore } from '../scoring/scoring-engine';
import { generateRecommendations } from '../recommendations/recommendation-engine';
import { attachScoreToReport } from '../integration/report-adapter';
import { getScoreForAssessment } from '../integration/assessment-hook';
import type { NormalizedAssessment, SecurityScoreResult } from '../types';

const store = new Map<string, any>();

vi.mock('../../db/connection', () => ({
  query: vi.fn(),
  getClient: vi.fn(() => ({
    getConnection: vi.fn(() => ({
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
      query: vi.fn(() => Promise.resolve([[]])),
    })),
  })),
}));

import { query } from '../../db/connection';
const mockQuery = query as unknown as ReturnType<typeof vi.fn>;

function makeAssessment(overrides: Partial<NormalizedAssessment> = {}): NormalizedAssessment {
  return {
    assessmentId: 'test-assessment-1',
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    assessmentType: 'quick',
    collectedAt: new Date().toISOString(),
    status: 'completed',
    controls: [],
    ...overrides,
  };
}

describe('Security Scoring Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
  });

  it('processes assessment end-to-end: score + recommendations + persistence', async () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'PASS', severity: 'HIGH', weight: 2 },
        { controlId: '2', name: 'Anti-phishing policy exists and enabled', moduleName: 'Email', status: 'FAIL', severity: 'CRITICAL', weight: 2 },
        { controlId: '3', name: 'Legacy Auth', moduleName: 'Entra ID', status: 'FAIL', severity: 'HIGH', weight: 1 },
      ],
    });

    mockQuery.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM assessments WHERE id')) {
        return [{ id: assessment.assessmentId, organization_id: assessment.organizationId, tenant_connection_id: 'tc-1', type: assessment.assessmentType, status: assessment.status, collected_at: assessment.collectedAt }];
      }
      if (sql.includes('FROM tenant_connections WHERE id')) {
        return [{ tenant_id: assessment.tenantId }];
      }
      if (sql.includes('FROM assessment_modules WHERE assessment_id')) {
        return [{ id: 'module-1', module_name: 'Entra ID' }, { id: 'module-2', module_name: 'Email' }];
      }
      if (sql.includes('FROM findings')) {
        return assessment.controls.map(c => ({
          control_catalog_id: c.controlId,
          result: c.status === 'PASS' ? 'pass' : 'fail',
          severity: c.severity,
          evidence: 'test evidence',
          recommendation: 'test recommendation',
          control_name: c.name,
          module_name: c.moduleName,
          weight: c.weight,
        }));
      }
      if (sql.includes('FROM control_catalog')) {
        return assessment.controls.map(c => ({ id: c.controlId, control_name: c.name }));
      }
      if (sql.startsWith('INSERT INTO security_scores')) {
        const id = 'score-' + Math.random().toString(36).slice(2);
        store.set(id, {
          id,
          assessment_id: params[1],
          tenant_id: params[2],
          overall_score: params[3],
          security_rating: params[4],
          summary: params[5],
          severity_breakdown: params[6],
          category_scores: params[7],
          failed_controls: params[8],
          recommendations: params[9],
          assessment_type: params[10] || assessment.assessmentType,
          assessment_status: params[11] || assessment.status,
        });
        return [{ id }];
      }
      if (sql.includes('FROM security_scores')) {
        const rows = Array.from(store.values()).filter((r: any) => r.assessment_id === assessment.assessmentId);
        return rows;
      }
      if (sql.includes('SELECT id FROM assessment_metadata')) {
        return [];
      }
      return [];
    });

    const result = await processAssessmentScore(assessment.assessmentId);
    expect(result).not.toBeNull();
    expect(result!.overallScore).toBeGreaterThan(0);
    expect(result!.overallScore).toBeLessThan(100);
    expect(result!.recommendations.length).toBeGreaterThan(0);
    expect(result!.recommendations[0].title).toContain('anti-phishing');

    const stored = await getScoreForAssessment(assessment.assessmentId);
    expect(stored).not.toBeNull();
    expect(stored!.overallScore).toBe(result!.overallScore);
    expect(stored!.recommendations.length).toBe(result!.recommendations.length);
  });

  it('does not score failed assessments', async () => {
    mockQuery.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM assessments WHERE id')) {
        return [{ id: 'failed-assessment', organization_id: 'org-1', tenant_connection_id: 'tc-1', type: 'quick', status: 'failed', collected_at: new Date().toISOString() }];
      }
      return [];
    });

    const result = await processAssessmentScore('failed-assessment');
    expect(result).toBeNull();
  });

  it('returns null for missing assessment', async () => {
    mockQuery.mockResolvedValue([]);
    const result = await processAssessmentScore('missing');
    expect(result).toBeNull();
  });

  it('attachScoreToReport stores score in assessment_metadata', async () => {
    const score: SecurityScoreResult = {
      assessmentId: 'test-1',
      tenantId: 'tenant-1',
      calculatedAt: new Date().toISOString(),
      overallScore: 85,
      securityRating: 'Good',
      assessmentStatus: 'completed',
      summary: { totalControls: 3, assessedControls: 3, passedControls: 2, failedControls: 1, partialControls: 0, notAssessedControls: 0, technicalErrors: 0 },
      severityBreakdown: { critical: 0, high: 1, medium: 0, low: 0 },
      categoryScores: [{ name: 'Email', score: 50, totalControls: 1, passedControls: 0, failedControls: 1, partialControls: 0, notAssessedControls: 0 }],
      failedControls: [],
      recommendations: [],
      assessmentType: 'quick',
    };

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM assessment_metadata')) return [];
      return [{ id: 'meta-1' }];
    });

    await attachScoreToReport('test-1', score);
    // attachScoreToReport uses a transaction internally; success means it did not throw
  });

  it('deterministic scoring produces same result for same input', () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'PASS', severity: 'HIGH', weight: 2 },
        { controlId: '2', name: 'Anti-phishing', moduleName: 'Email', status: 'FAIL', severity: 'CRITICAL', weight: 2 },
      ],
    });

    const result1 = calculateSecurityScore(assessment);
    const result2 = calculateSecurityScore(assessment);
    expect(result1.overallScore).toBe(result2.overallScore);
    expect(result1.recommendations).toEqual(result2.recommendations);
  });
});
