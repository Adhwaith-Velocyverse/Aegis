import type { SecurityAssessmentReportData } from '../types/report-data';

export function validateReportData(data: unknown): SecurityAssessmentReportData {
  if (!data || typeof data !== 'object') {
    throw new Error('Report data is required and must be an object');
  }

  const report = data as Record<string, unknown>;

  if (!report.assessment || typeof report.assessment !== 'object') {
    throw new Error('Report data must contain an assessment object');
  }

  const assessment = report.assessment as Record<string, unknown>;

  if (!assessment.assessmentId || typeof assessment.assessmentId !== 'string') {
    throw new Error('assessment.assessmentId is required');
  }
  if (!assessment.assessmentType || typeof assessment.assessmentType !== 'string') {
    throw new Error('assessment.assessmentType is required');
  }
  if (!assessment.assessmentDate || typeof assessment.assessmentDate !== 'string') {
    throw new Error('assessment.assessmentDate is required');
  }

  if (!report.summary || typeof report.summary !== 'object') {
    throw new Error('Report data must contain a summary object');
  }

  const summary = report.summary as Record<string, unknown>;

  if (typeof summary.totalScore !== 'number') {
    throw new Error('summary.totalScore is required and must be a number');
  }
  if (typeof summary.maximumScore !== 'number') {
    throw new Error('summary.maximumScore is required and must be a number');
  }
  if (typeof summary.percentage !== 'number' && summary.percentage !== null) {
    throw new Error('summary.percentage must be a number or null');
  }

  if (!Array.isArray(report.controls)) {
    throw new Error('Report data must contain a controls array');
  }

  if (!Array.isArray(report.recommendations)) {
    throw new Error('Report data must contain a recommendations array');
  }

  return data as SecurityAssessmentReportData;
}
