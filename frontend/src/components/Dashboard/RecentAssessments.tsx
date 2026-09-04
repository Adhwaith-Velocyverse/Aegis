'use client';

import { useRouter } from 'next/navigation';
import { FileText, ChevronRight, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import type { DashboardRecentAssessment } from '@aegis/shared';

interface RecentAssessmentsProps {
  assessments: DashboardRecentAssessment[];
}

const statusConfig = {
  completed: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  in_progress: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  pending: { icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
};

const typeConfig = {
  trial: 'bg-blue-100 text-blue-800',
  quick: 'bg-purple-100 text-purple-800',
  detailed: 'bg-orange-100 text-orange-800',
};

export default function RecentAssessments({ assessments }: RecentAssessmentsProps) {
  const router = useRouter();

  if (assessments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Recent Assessments</p>
        <p className="text-sm text-gray-500">No assessments completed yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent Assessments</p>
        <button
          onClick={() => router.push('/history')}
          className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center"
        >
          View Assessment History
          <ChevronRight className="w-3 h-3 ml-1" />
        </button>
      </div>
      <div className="space-y-2">
        {assessments.slice(0, 5).map((assessment) => {
          const status = statusConfig[assessment.status as keyof typeof statusConfig] || statusConfig.pending;
          const StatusIcon = status.icon;
          const dateStr = assessment.completedAt
            ? new Date(assessment.completedAt).toLocaleDateString()
            : new Date(assessment.createdAt).toLocaleDateString();

          return (
            <div
              key={assessment.id}
              onClick={() => router.push(`/results/${assessment.id}`)}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm cursor-pointer transition-all"
            >
              <div className={`p-1.5 rounded-md ${status.bg} ${status.color}`}>
                <StatusIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${typeConfig[assessment.type as keyof typeof typeConfig] || 'bg-gray-100 text-gray-800'}`}>
                    {assessment.type}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {assessment.status === 'completed' ? 'Completed' : assessment.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
              </div>
              {assessment.overallScore !== undefined && (
                <span className="text-sm font-semibold text-gray-900">{assessment.overallScore}/100</span>
              )}
              {assessment.overallScore === undefined && (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
