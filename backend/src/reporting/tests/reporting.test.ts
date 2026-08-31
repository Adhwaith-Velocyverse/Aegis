import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateReportData, buildReportDataFromScore } from '../src';
import type { SecurityScoreResult } from '../../security-scoring/types';

const mockScoreResult: SecurityScoreResult = {
  assessmentId: 'test-123',
  tenantId: 'tenant-456',
  calculatedAt: '2024-01-15T10:00:00.000Z',
  overallScore: 72,
  securityRating: 'Good',
  assessmentStatus: 'completed',
  summary: {
    totalControls: 20,
    assessedControls: 18,
    passedControls: 12,
    failedControls: 4,
    partialControls: 2,
    notAssessedControls: 2,
    technicalErrors: 0,
  },
  severityBreakdown: {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  },
  categoryScores: [
    {
      name: 'Email Security',
      score: 65,
      totalControls: 10,
      passedControls: 6,
      failedControls: 2,
      partialControls: 2,
      notAssessedControls: 0,
    },
  ],
  failedControls: [
    {
      controlId: 'email-1',
      name: 'Anti-phishing policy',
      status: 'FAIL',
      severity: 'HIGH',
      weight: 1,
      score: 0,
      moduleName: 'Email',
      category: 'Email Security',
    },
  ],
  recommendations: [
    {
      id: 'rec-1',
      controlId: 'email-1',
      title: 'Enable anti-phishing policy',
      description: 'Enable anti-phishing policy',
      severity: 'HIGH',
      priority: 1,
      remediation: 'Enable the policy',
      reason: 'Policy is disabled',
      affectedControls: ['email-1'],
    },
  ],
  assessmentType: 'quick',
  durationMs: 120000,
};

describe('Reporting Module', () => {
  describe('validateReportData', () => {
    it('accepts valid report data', () => {
      const data = buildReportDataFromScore(mockScoreResult);
      expect(() => validateReportData(data)).not.toThrow();
    });

    it('rejects missing assessment', () => {
      expect(() => validateReportData({} as any)).toThrow('Report data must contain an assessment object');
    });

    it('rejects missing assessment object', () => {
      expect(() => validateReportData({ controls: [], recommendations: [] } as any)).toThrow('Report data must contain an assessment object');
    });

    it('rejects missing summary', () => {
      expect(() => validateReportData({ assessment: {}, controls: [], recommendations: [] } as any)).toThrow('assessment.assessmentId is required');
    });

    it('rejects missing totalScore', () => {
      expect(() => validateReportData({ assessment: { assessmentId: '1', assessmentType: 'quick', assessmentDate: '2024-01-01' }, summary: {}, controls: [], recommendations: [] } as any)).toThrow('summary.totalScore is required');
    });

    it('rejects missing maximumScore', () => {
      expect(() => validateReportData({ assessment: { assessmentId: '1', assessmentType: 'quick', assessmentDate: '2024-01-01' }, summary: { totalScore: 50 }, controls: [], recommendations: [] } as any)).toThrow('summary.maximumScore is required and must be a number');
    });

    it('rejects non-array controls', () => {
      expect(() => validateReportData({ assessment: { assessmentId: '1', assessmentType: 'quick', assessmentDate: '2024-01-01' }, summary: { totalScore: 50, maximumScore: 100, percentage: 50 }, controls: 'invalid', recommendations: [] } as any)).toThrow('Report data must contain a controls array');
    });

    it('rejects non-array recommendations', () => {
      expect(() => validateReportData({ assessment: { assessmentId: '1', assessmentType: 'quick', assessmentDate: '2024-01-01' }, summary: { totalScore: 50, maximumScore: 100, percentage: 50 }, controls: [], recommendations: 'invalid' } as any)).toThrow('Report data must contain a recommendations array');
    });
  });

  describe('buildReportDataFromScore', () => {
    it('builds valid report data from score result', () => {
      const reportData = buildReportDataFromScore(mockScoreResult);
      expect(reportData.assessment.assessmentId).toBe('test-123');
      expect(reportData.assessment.assessmentType).toBe('quick');
      expect(reportData.summary.totalScore).toBe(72);
      expect(reportData.summary.maximumScore).toBe(100);
      expect(reportData.summary.percentage).toBe(72);
      expect(reportData.summary.securityPosturePercentage).toBe(72);
      expect(reportData.summary.riskExposurePercentage).toBe(28);
      expect(reportData.controls.length).toBeGreaterThan(0);
      expect(reportData.recommendations.length).toBe(1);
    });

    it('handles null overall score', () => {
      const nullScore = { ...mockScoreResult, overallScore: null };
      const reportData = buildReportDataFromScore(nullScore);
      expect(reportData.summary.totalScore).toBe(0);
      expect(reportData.summary.percentage).toBeNull();
      expect(reportData.summary.securityPosturePercentage).toBe(0);
      expect(reportData.summary.riskExposurePercentage).toBe(100);
    });

    it('maps failed controls correctly', () => {
      const reportData = buildReportDataFromScore(mockScoreResult);
      const failedControl = reportData.controls.find((c: { result: string }) => c.result === 'FAILED');
      expect(failedControl).toBeDefined();
      expect(failedControl!.name).toBe('Anti-phishing policy');
      expect(failedControl!.severity).toBe('HIGH');
    });

    it('maps recommendations correctly', () => {
      const reportData = buildReportDataFromScore(mockScoreResult);
      expect(reportData.recommendations[0].title).toBe('Enable anti-phishing policy');
      expect(reportData.recommendations[0].severity).toBe('HIGH');
    });
  });
});
