'use client';

import { useRouter } from 'next/navigation';
import { Play, AlertTriangle, RefreshCw } from 'lucide-react';
import type { DashboardLatestAssessment, DashboardActiveAssessment } from '@aegis/shared';

interface SecurityPostureSummaryProps {
  latestAssessment: DashboardLatestAssessment | null;
  activeAssessment: DashboardActiveAssessment | null;
  error?: string | null;
  onRetry?: () => void;
}

const ratingColorMap: Record<string, { text: string; bg: string; border: string }> = {
  Excellent: { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  Good: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  Fair: { text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  Poor: { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  Critical: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  'No Data': { text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
};

export default function SecurityPostureSummary({
  latestAssessment,
  activeAssessment,
  error,
  onRetry,
}: SecurityPostureSummaryProps) {
  const router = useRouter();

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-red-800 mb-1">Unable to load security posture</h3>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}
      </div>
    );
  }

  if (activeAssessment && !latestAssessment) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Assessment in progress</p>
            <p className="text-xs text-gray-500 mt-1 capitalize">
              {activeAssessment.type} Assessment — {activeAssessment.progress.percent}% complete
            </p>
          </div>
          <button
            onClick={() => router.push(`/assessment-loading?assessmentId=${activeAssessment.id}&type=${activeAssessment.type}`)}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            View progress →
          </button>
        </div>
        <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${activeAssessment.progress.percent}%` }}
          />
        </div>
      </div>
    );
  }

  if (!latestAssessment) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-sm font-medium text-gray-900 mb-1">Security posture not assessed yet</p>
        <p className="text-xs text-gray-500 mb-4">Run an assessment to see your security score and findings.</p>
        <button
          onClick={() => router.push('/assessment/quick')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Play className="w-4 h-4" />
          Start Quick Assessment
        </button>
      </div>
    );
  }

  const colors = ratingColorMap[latestAssessment.securityRating] || ratingColorMap['No Data'];
  const summary = latestAssessment.summary;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Overall Score</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900">
            {latestAssessment.overallScore ?? '—'}
          </span>
          {latestAssessment.overallScore !== null && (
            <span className="text-xs text-gray-500">/100</span>
          )}
        </div>
        {latestAssessment.scoreBand && (
          <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
            {latestAssessment.securityRating}
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Critical Findings</p>
        <p className="text-2xl font-bold text-gray-900">
          {latestAssessment.severityBreakdown.critical}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {summary.failedControls} failed control{summary.failedControls !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Controls Assessed</p>
        <p className="text-2xl font-bold text-gray-900">
          {summary.assessedControls}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {summary.totalControls} total controls
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Last Assessment</p>
        <p className="text-sm font-semibold text-gray-900 capitalize">
          {latestAssessment.type}
        </p>
        {latestAssessment.completedAt && (
          <p className="text-xs text-gray-500 mt-1">
            {new Date(latestAssessment.completedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
