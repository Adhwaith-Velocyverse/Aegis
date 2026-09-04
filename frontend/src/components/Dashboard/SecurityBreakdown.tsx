'use client';

import type { DashboardLatestAssessment } from '@aegis/shared';

interface SecurityBreakdownProps {
  assessment: DashboardLatestAssessment;
}

const segmentConfig = [
  { key: 'passedControls', label: 'Passed', color: 'bg-green-500' },
  { key: 'partialControls', label: 'Partial', color: 'bg-blue-500' },
  { key: 'failedControls', label: 'Failed', color: 'bg-red-500' },
  { key: 'notAssessedControls', label: 'Not Assessed', color: 'bg-gray-300' },
] as const;

export default function SecurityBreakdown({ assessment }: SecurityBreakdownProps) {
  const summary = assessment.summary;
  const total = summary.assessedControls + summary.notAssessedControls;

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Control Breakdown</p>
        <p className="text-sm text-gray-500">No control data available for this assessment.</p>
      </div>
    );
  }

  const segments = segmentConfig.map(({ key, label, color }) => {
    const count = summary[key as keyof typeof summary] as number;
    const percent = total > 0 ? (count / total) * 100 : 0;
    return { label, color, count, percent };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Control Breakdown</p>
      <div className="w-full h-3 rounded-full overflow-hidden flex">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} h-full transition-all duration-500`}
            style={{ width: `${seg.percent}%` }}
            title={`${seg.label}: ${seg.count}`}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-sm ${seg.color}`} />
              <span className="text-xs text-gray-600">{seg.label}</span>
            </div>
            <span className="text-xs font-medium text-gray-900">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
