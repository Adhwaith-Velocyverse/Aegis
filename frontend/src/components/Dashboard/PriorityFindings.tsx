'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { DashboardFinding, DashboardLatestAssessment } from '@aegis/shared';

interface PriorityFindingsProps {
  findings: DashboardFinding[];
  latestAssessment: DashboardLatestAssessment | null;
}

const severityConfig = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
  informational: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function PriorityFindings({ findings, latestAssessment }: PriorityFindingsProps) {
  const router = useRouter();

  if (!latestAssessment) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Top Security Gaps</p>
        <p className="text-sm text-gray-500">No assessment data available yet.</p>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Top Security Gaps</p>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <AlertTriangle className="w-4 h-4 text-green-500" />
          No critical gaps found.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Top Security Gaps</p>
        <button
          onClick={() => router.push(`/results/${latestAssessment.id}`)}
          className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center"
        >
          View All Findings
          <ChevronRight className="w-3 h-3 ml-1" />
        </button>
      </div>
      <div className="space-y-3">
        {findings.slice(0, 5).map((finding) => (
          <div
            key={finding.id}
            onClick={() => router.push(`/results/${latestAssessment.id}`)}
            className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm cursor-pointer transition-all"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severityConfig[finding.severity as keyof typeof severityConfig] || severityConfig.medium}`}>
                  {finding.severity}
                </span>
                <span className="text-xs text-gray-500">{finding.moduleName}</span>
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">{finding.controlName}</p>
              {finding.recommendation && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{finding.recommendation}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
