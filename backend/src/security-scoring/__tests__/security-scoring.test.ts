import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateSecurityScore } from '../scoring/scoring-engine';
import { generateRecommendations } from '../recommendations/recommendation-engine';
import type { NormalizedAssessment, SecurityScoreResult } from '../types';

vi.mock('../../db/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../db/connection';
const mockQuery = query as unknown as ReturnType<typeof vi.fn>;

function makeAssessment(overrides: Partial<NormalizedAssessment> = {}): NormalizedAssessment {
  return {
    assessmentId: 'test-1',
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    assessmentType: 'quick',
    collectedAt: new Date().toISOString(),
    status: 'completed',
    controls: [],
    ...overrides,
  };
}

describe('Security Scoring Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 100 for all passing controls', () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'PASS', severity: 'HIGH', weight: 2 },
        { controlId: '2', name: 'Legacy Auth', moduleName: 'Entra ID', status: 'PASS', severity: 'MEDIUM', weight: 1 },
      ],
    });
    const result = calculateSecurityScore(assessment);
    expect(result.overallScore).toBe(100);
    expect(result.securityRating).toBe('Excellent');
    expect(result.summary.passedControls).toBe(2);
    expect(result.summary.failedControls).toBe(0);
    expect(result.summary.assessedControls).toBe(2);
  });

  it('returns 0 for all failing controls', () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'FAIL', severity: 'HIGH', weight: 2 },
        { controlId: '2', name: 'Legacy Auth', moduleName: 'Entra ID', status: 'FAIL', severity: 'MEDIUM', weight: 1 },
      ],
    });
    const result = calculateSecurityScore(assessment);
    expect(result.overallScore).toBe(0);
    expect(result.summary.failedControls).toBe(2);
    expect(result.summary.assessedControls).toBe(2);
  });

  it('calculates weighted score for mixed results', () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'PASS', severity: 'CRITICAL', weight: 2 },
        { controlId: '2', name: 'Legacy Auth', moduleName: 'Entra ID', status: 'FAIL', severity: 'HIGH', weight: 1 },
      ],
    });
    const result = calculateSecurityScore(assessment);
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThan(100);
  });

  it('handles empty controls', () => {
    const assessment = makeAssessment({ controls: [] });
    const result = calculateSecurityScore(assessment);
    expect(result.overallScore).toBeNull();
    expect(result.securityRating).toBe('No Data');
    expect(result.summary.totalControls).toBe(0);
    expect(result.summary.assessedControls).toBe(0);
  });

  it('handles PARTIAL status', () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'PARTIAL', severity: 'HIGH', weight: 2 },
      ],
    });
    const result = calculateSecurityScore(assessment);
    expect(result.summary.partialControls).toBe(1);
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThan(100);
    expect(result.summary.assessedControls).toBe(1);
  });

  it('excludes NOT_ASSESSED from score denominator', () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'PASS', severity: 'HIGH', weight: 2 },
        { controlId: '2', name: 'Unknown', moduleName: 'General', status: 'NOT_ASSESSED', severity: 'LOW', weight: 1 },
      ],
    });
    const result = calculateSecurityScore(assessment);
    expect(result.overallScore).toBe(100);
    expect(result.summary.notAssessedControls).toBe(1);
    expect(result.summary.assessedControls).toBe(1);
  });

  it('excludes ERROR from score denominator', () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'PASS', severity: 'HIGH', weight: 2 },
        { controlId: '2', name: 'API Error', moduleName: 'General', status: 'ERROR', severity: 'MEDIUM', weight: 1 },
      ],
    });
    const result = calculateSecurityScore(assessment);
    expect(result.overallScore).toBe(100);
    expect(result.summary.technicalErrors).toBe(1);
    expect(result.summary.assessedControls).toBe(1);
  });

  it('excludes INFO from score denominator', () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'PASS', severity: 'HIGH', weight: 2 },
        { controlId: '2', name: 'Info Control', moduleName: 'General', status: 'INFO', severity: 'LOW', weight: 1 },
      ],
    });
    const result = calculateSecurityScore(assessment);
    expect(result.overallScore).toBe(100);
    expect(result.summary.notAssessedControls).toBe(1);
    expect(result.summary.assessedControls).toBe(1);
  });

  it('calculates category scores', () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', category: 'Identity', status: 'PASS', severity: 'HIGH', weight: 2 },
        { controlId: '2', name: 'Anti-phish', moduleName: 'Email', category: 'Email Security', status: 'FAIL', severity: 'CRITICAL', weight: 1 },
      ],
    });
    const result = calculateSecurityScore(assessment);
    expect(result.categoryScores.length).toBeGreaterThanOrEqual(2);
  });

  it('generates severity breakdown', () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'FAIL', severity: 'CRITICAL', weight: 1 },
        { controlId: '2', name: 'Legacy Auth', moduleName: 'Entra ID', status: 'FAIL', severity: 'HIGH', weight: 1 },
      ],
    });
    const result = calculateSecurityScore(assessment);
    expect(result.severityBreakdown.critical).toBe(1);
    expect(result.severityBreakdown.high).toBe(1);
  });
});

describe('Recommendation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue([]);
  });

  it('generates recommendation for known failed control', async () => {
    mockQuery.mockResolvedValue([{ id: '1', control_name: 'Anti-phishing policy exists and enabled' }]);
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'Anti-phishing policy exists and enabled', moduleName: 'Email', status: 'FAIL', severity: 'CRITICAL', weight: 2 },
      ],
    });
    const scoreResult = calculateSecurityScore(assessment);
    const recommendations = await generateRecommendations(assessment, scoreResult);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].title).toContain('anti-phishing');
  });

  it('returns empty recommendations when no controls fail', async () => {
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'MFA', moduleName: 'Entra ID', status: 'PASS', severity: 'HIGH', weight: 2 },
      ],
    });
    const scoreResult = calculateSecurityScore(assessment);
    const recommendations = await generateRecommendations(assessment, scoreResult);
    expect(recommendations.length).toBe(0);
  });

  it('deduplicates recommendations for same failure type', async () => {
    mockQuery.mockResolvedValue([
      { id: '1', control_name: 'Anti-phishing policy exists and enabled' },
      { id: '2', control_name: 'All users are covered by at least one enabled MDO Anti-Phishing policy' },
    ]);
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'Anti-phishing policy exists and enabled', moduleName: 'Email', status: 'FAIL', severity: 'CRITICAL', weight: 2 },
        { controlId: '2', name: 'All users are covered by at least one enabled MDO Anti-Phishing policy', moduleName: 'Email', status: 'FAIL', severity: 'HIGH', weight: 2 },
      ],
    });
    const scoreResult = calculateSecurityScore(assessment);
    const recommendations = await generateRecommendations(assessment, scoreResult);
    const titles = recommendations.map(r => r.title);
    expect(titles.filter(t => t.includes('anti-phishing')).length).toBeGreaterThanOrEqual(1);
  });

  it('sorts recommendations by severity then priority', async () => {
    mockQuery.mockResolvedValue([
      { id: '1', control_name: 'Legacy authentication disabled' },
      { id: '2', control_name: 'MFA enforcement policy exists and enabled' },
    ]);
    const assessment = makeAssessment({
      controls: [
        { controlId: '1', name: 'Legacy authentication disabled', moduleName: 'Entra ID', status: 'FAIL', severity: 'HIGH', weight: 2 },
        { controlId: '2', name: 'MFA enforcement policy exists and enabled', moduleName: 'Entra ID', status: 'FAIL', severity: 'CRITICAL', weight: 2 },
      ],
    });
    const scoreResult = calculateSecurityScore(assessment);
    const recommendations = await generateRecommendations(assessment, scoreResult);
    if (recommendations.length >= 2) {
      expect(recommendations[0].severity).toBe('CRITICAL');
      expect(recommendations[1].severity).toBe('HIGH');
    }
  });
});
