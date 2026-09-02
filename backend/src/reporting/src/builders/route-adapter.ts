import type { SecurityAssessmentReportData, InformationalControl, FailedEndpoint } from '../types/report-data';
import { buildReportDataFromScoreAndControls, type ScoreResultLike, type ActualControlResult } from './report-data.builder';

export interface AssessmentDatabaseRow {
  id: string;
  type: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  tenant_name?: string;
  org_name?: string;
}

export interface FindingRow {
  control_catalog_id: string;
  result: string;
  severity: string;
  evidence?: string;
  recommendation?: string;
  control_name?: string;
  module_name?: string;
  weight?: number;
  category?: string;
}

export interface ModuleRow {
  id: string;
  raw_data_path?: string;
}

export interface MetadataRow {
  key: string;
  value: string;
}

export interface ReportAdapterInput {
  assessment: AssessmentDatabaseRow;
  modules: ModuleRow[];
  findings: FindingRow[];
  metadata: MetadataRow[];
  scoreResult: ScoreResultLike;
}

export function buildReportDataFromDatabase(input: ReportAdapterInput): SecurityAssessmentReportData {
  const { assessment, modules, findings, metadata, scoreResult } = input;

  const actualControls: ActualControlResult[] = findings.map((f) => ({
    id: f.control_catalog_id,
    name: f.control_name || 'Unknown',
    category: f.category || f.module_name,
    severity: f.severity || 'medium',
    score: mapResultToScore(f.result),
    maximumScore: 100,
    result: mapResultToStatus(f.result),
    evidence: f.evidence,
    recommendation: f.recommendation,
  }));

  const failedEndpoints: FailedEndpoint[] = [];
  const informationalControls: InformationalControl[] = [];

  const rawDataPaths = modules
    .map((m) => m.raw_data_path)
    .filter(Boolean);

  for (const rawPath of rawDataPaths) {
    try {
      const rawData = typeof rawPath === 'string' ? JSON.parse(rawPath) : rawPath;
      if (rawData?.errors && Array.isArray(rawData.errors)) {
        for (const err of rawData.errors) {
          failedEndpoints.push({
            endpoint: err.endpoint || err.source || 'Unknown',
            errorType: err.type || 'collection_error',
            errorMessage: err.error || err.message || 'Unknown error',
            statusCode: err.statusCode,
            description: err.description,
            impact: err.impact,
          });
        }
      }
      if (rawData?.metrics && !informationalControls.find((i) => i.id === 'collection-metrics')) {
        informationalControls.push({
          id: 'collection-metrics',
          title: 'Data Collection Metrics',
          evidence: `Total endpoints: ${rawData.metrics.totalEndpoints || 0}, Successful: ${rawData.metrics.successfulEndpoints || 0}, Failed: ${rawData.metrics.failedEndpoints || 0}`,
          details: rawData.metrics,
        });
      }
    } catch {
      // ignore unparsable raw_data_path
    }
  }

  const startedAt = assessment.started_at ? new Date(assessment.started_at) : null;
  const completedAt = assessment.completed_at ? new Date(assessment.completed_at) : null;
  const durationMs = startedAt && completedAt ? completedAt.getTime() - startedAt.getTime() : 0;

  const metaMap: Record<string, string> = {};
  for (const m of metadata) {
    metaMap[m.key] = m.value;
  }

  return buildReportDataFromScoreAndControls(scoreResult, actualControls, {
    informationalControls: informationalControls.length > 0 ? informationalControls : undefined,
    failedEndpoints: failedEndpoints.length > 0 ? failedEndpoints : undefined,
    tenantName: assessment.tenant_name || assessment.org_name || 'Unknown',
    assessmentName: `${assessment.type} Security Assessment`,
  });
}

function mapResultToStatus(result: string): 'PASSED' | 'FAILED' | 'PARTIAL' | 'MANUAL_REVIEW' | 'NOT_APPLICABLE' {
  const upper = result.toUpperCase();
  switch (upper) {
    case 'PASS':
      return 'PASSED';
    case 'FAIL':
      return 'FAILED';
    case 'PARTIAL':
      return 'PARTIAL';
    case 'NOT_ASSESSED':
    case 'NEEDS_MANUAL_REVIEW':
      return 'MANUAL_REVIEW';
    case 'NOT_APPLICABLE':
      return 'NOT_APPLICABLE';
    case 'INFO':
      return 'PASSED';
    case 'ERROR':
      return 'MANUAL_REVIEW';
    default:
      return 'MANUAL_REVIEW';
  }
}

function mapResultToScore(result: string): number {
  const upper = result.toUpperCase();
  switch (upper) {
    case 'PASS':
      return 100;
    case 'FAIL':
      return 0;
    case 'PARTIAL':
      return 50;
    case 'INFO':
      return 100;
    default:
      return 0;
  }
}
