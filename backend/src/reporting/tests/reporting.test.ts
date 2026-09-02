import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateReportData, buildReportDataFromScore, buildReportDataFromScoreAndControls, buildReportDataFromDatabase } from '../src';
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

  describe('buildReportDataFromScoreAndControls', () => {
    it('merges actual controls with score result', () => {
      const actualControls = [
        { id: 'c1', name: 'Control 1', severity: 'HIGH', score: 100, maximumScore: 100, result: 'PASSED' as const, evidence: 'ok', recommendation: '' },
        { id: 'c2', name: 'Control 2', severity: 'CRITICAL', score: 0, maximumScore: 100, result: 'FAILED' as const, evidence: 'fail', recommendation: 'fix it' },
      ];

      const reportData = buildReportDataFromScoreAndControls(mockScoreResult, actualControls);
      expect(reportData.controls).toHaveLength(2);
      expect(reportData.controls[0].name).toBe('Control 1');
      expect(reportData.controls[0].result).toBe('PASSED');
      expect(reportData.controls[1].name).toBe('Control 2');
      expect(reportData.controls[1].result).toBe('FAILED');
      expect(reportData.controls[1].recommendation).toBe('fix it');
    });

    it('includes tenant name and assessment name from options', () => {
      const actualControls = [
        { id: 'c1', name: 'Control 1', severity: 'LOW', score: 100, maximumScore: 100, result: 'PASSED' as const },
      ];

      const reportData = buildReportDataFromScoreAndControls(mockScoreResult, actualControls, {
        tenantName: 'Contoso',
        assessmentName: 'Custom Assessment Name',
      });

      expect(reportData.assessment.tenantName).toBe('Contoso');
      expect(reportData.assessment.assessmentName).toBe('Custom Assessment Name');
    });

    it('handles 0% score', () => {
      const zeroScore = { ...mockScoreResult, overallScore: 0 };
      const reportData = buildReportDataFromScoreAndControls(zeroScore, []);
      expect(reportData.summary.totalScore).toBe(0);
      expect(reportData.summary.percentage).toBe(0);
      expect(reportData.summary.securityPosturePercentage).toBe(0);
      expect(reportData.summary.riskExposurePercentage).toBe(100);
    });

    it('handles 100% score', () => {
      const perfectScore = { ...mockScoreResult, overallScore: 100 };
      const reportData = buildReportDataFromScoreAndControls(perfectScore, []);
      expect(reportData.summary.totalScore).toBe(100);
      expect(reportData.summary.percentage).toBe(100);
      expect(reportData.summary.securityPosturePercentage).toBe(100);
      expect(reportData.summary.riskExposurePercentage).toBe(0);
    });

    it('preserves recommendations from score result', () => {
      const actualControls: any[] = [];
      const reportData = buildReportDataFromScoreAndControls(mockScoreResult, actualControls);
      expect(reportData.recommendations).toHaveLength(1);
      expect(reportData.recommendations[0].title).toBe('Enable anti-phishing policy');
    });

    it('includes informational controls and failed endpoints when provided', () => {
      const actualControls: any[] = [];
      const reportData = buildReportDataFromScoreAndControls(mockScoreResult, actualControls, {
        informationalControls: [
          { id: 'info-1', title: 'Test Info', evidence: 'Some evidence' },
        ],
        failedEndpoints: [
          { endpoint: '/api/test', errorType: 'auth_error', errorMessage: 'Token expired' },
        ],
      });

      expect(reportData.informationalControls).toHaveLength(1);
      expect(reportData.failedEndpoints).toHaveLength(1);
    });
  });

  describe('buildReportDataFromDatabase', () => {
    it('builds report data from database rows', () => {
      const input = {
        assessment: {
          id: 'assess-1',
          type: 'quick',
          status: 'completed',
          started_at: '2024-01-15T10:00:00.000Z',
          completed_at: '2024-01-15T10:02:00.000Z',
          tenant_name: 'contoso.onmicrosoft.com',
          org_name: 'Contoso Ltd',
        } as any,
        modules: [
          { id: 'mod-1', raw_data_path: JSON.stringify({ errors: [{ endpoint: 'test', type: 'auth_error', error: 'denied' }], metrics: { totalEndpoints: 10, successfulEndpoints: 8, failedEndpoints: 2 } }) },
        ],
        findings: [
          { control_catalog_id: 'cc-1', result: 'pass', severity: 'HIGH', evidence: 'ok', recommendation: '', control_name: 'Test Control', module_name: 'Email', weight: 1, category: 'Anti-Phishing' },
          { control_catalog_id: 'cc-2', result: 'fail', severity: 'CRITICAL', evidence: 'bad', recommendation: 'fix', control_name: 'Bad Control', module_name: 'Email', weight: 1, category: 'Anti-Malware' },
        ],
        metadata: [],
        scoreResult: mockScoreResult,
      };

      const reportData = buildReportDataFromDatabase(input);
      expect(reportData.controls).toHaveLength(2);
      expect(reportData.controls[0].result).toBe('PASSED');
      expect(reportData.controls[1].result).toBe('FAILED');
      expect(reportData.assessment.tenantName).toBe('contoso.onmicrosoft.com');
      expect(reportData.assessment.assessmentName).toBe('quick Security Assessment');
      expect(reportData.failedEndpoints).toHaveLength(1);
      expect(reportData.failedEndpoints![0].endpoint).toBe('test');
      expect(reportData.informationalControls).toHaveLength(1);
    });

    it('handles unparsable raw_data_path gracefully', () => {
      const input = {
        assessment: {
          id: 'assess-1',
          type: 'detailed',
          status: 'completed',
          started_at: '2024-01-15T10:00:00.000Z',
          completed_at: '2024-01-15T10:02:00.000Z',
          tenant_name: 'contoso.onmicrosoft.com',
          org_name: 'Contoso Ltd',
        } as any,
        modules: [
          { id: 'mod-1', raw_data_path: 'not-valid-json' },
        ],
        findings: [],
        metadata: [],
        scoreResult: mockScoreResult,
      };

      const reportData = buildReportDataFromDatabase(input);
      expect(reportData.controls).toHaveLength(0);
      expect(reportData.failedEndpoints).toBeUndefined();
    });

    it('calculates duration correctly', () => {
      const input = {
        assessment: {
          id: 'assess-1',
          type: 'quick',
          status: 'completed',
          started_at: '2024-01-15T10:00:00.000Z',
          completed_at: '2024-01-15T10:02:00.000Z',
          tenant_name: 'contoso.onmicrosoft.com',
          org_name: 'Contoso Ltd',
        } as any,
        modules: [],
        findings: [],
        metadata: [],
        scoreResult: mockScoreResult,
      };

      const reportData = buildReportDataFromDatabase(input);
      expect(reportData.assessment.durationMs).toBe(120000);
    });
  });
});
