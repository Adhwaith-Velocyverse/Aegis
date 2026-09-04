'use client';

import type { DashboardLatestAssessment } from '@aegis/shared';

interface ScoreVisualizationProps {
  assessment: DashboardLatestAssessment;
}

const scoreColorMap: Record<string, string> = {
  Excellent: '#10B981',
  Good: '#3B82F6',
  Fair: '#F59E0B',
  Poor: '#F97316',
  Critical: '#EF4444',
  'No Data': '#9CA3AF',
};

export default function ScoreVisualization({ assessment }: ScoreVisualizationProps) {
  const score = assessment.overallScore ?? 0;
  const rating = assessment.securityRating;
  const color = scoreColorMap[rating] || '#9CA3AF';

  const radius = 54;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const percent = Math.min(Math.max(score, 0), 100) / 100;
  const dashArray = `${percent * circumference} ${circumference}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4 self-start">Security Score</p>
      <div className="relative">
        <svg width={radius * 2} height={radius * 2}>
          <circle
            stroke="#E5E7EB"
            fill="none"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={color}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={dashArray}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            transform={`rotate(-90 ${radius} ${radius})`}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">
            {assessment.overallScore ?? '—'}
          </span>
          {assessment.overallScore !== null && (
            <span className="text-xs text-gray-500">/100</span>
          )}
        </div>
      </div>
      {assessment.scoreBand && (
        <div className="mt-4 text-center">
          <span className="text-sm font-medium text-gray-900">{assessment.securityRating}</span>
          {assessment.bandDescription && (
            <p className="text-xs text-gray-500 mt-1 max-w-[200px]">{assessment.bandDescription}</p>
          )}
        </div>
      )}
    </div>
  );
}
