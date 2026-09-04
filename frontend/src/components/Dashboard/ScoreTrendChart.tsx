'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DashboardTrend } from '@aegis/shared';

interface ScoreTrendChartProps {
  trend: DashboardTrend;
}

const scoreColor = '#10B981';

export default function ScoreTrendChart({ trend }: ScoreTrendChartProps) {
  const router = useRouter();

  const hasTrial = trend.trialScores.length > 0;
  const hasPosture = trend.postureScores.length > 0;
  const totalPoints = (hasTrial ? trend.trialScores.length : 0) + (hasPosture ? trend.postureScores.length : 0);

  const chartData = useMemo(() => {
    const trialMap = new Map(trend.trialScores.map(s => [s.date, s.score]));
    const postureMap = new Map(trend.postureScores.map(s => [s.date, s.score]));

    const allDates = Array.from(new Set([...trend.trialScores.map(s => s.date), ...trend.postureScores.map(s => s.date)]))
      .sort();

    return allDates.map((date) => ({
      date,
      trial: trialMap.has(date) ? trialMap.get(date)! : null,
      posture: postureMap.has(date) ? postureMap.get(date)! : null,
    }));
  }, [trend]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (totalPoints < 2) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Security Score Trend</p>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <TrendingUp className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Complete more assessments to see your security trend.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Security Score Trend</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#9CA3AF"
              fontSize={12}
              tickMargin={8}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#9CA3AF"
              fontSize={12}
              tickMargin={8}
              label={{ value: 'Score', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6B7280', fontSize: 12 } }}
            />
            <Tooltip
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
              formatter={(value: any, name: string) => {
                if (value === null || value === undefined) return ['—', name];
                return [`${value}/100`, name === 'trial' ? 'Trial' : 'Posture'];
              }}
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 16 }}
              formatter={(value) => value === 'trial' ? 'Trial' : 'Posture Assessment'}
            />
            {hasTrial && (
              <Line
                type="monotone"
                dataKey="trial"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#8B5CF6' }}
                connectNulls={false}
              />
            )}
            {hasPosture && (
              <Line
                type="monotone"
                dataKey="posture"
                stroke={scoreColor}
                strokeWidth={2}
                dot={{ r: 4, fill: scoreColor, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: scoreColor }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
        {hasTrial && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Trial (self-reported)
          </span>
        )}
        {hasPosture && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Posture (automated)
          </span>
        )}
      </div>
    </div>
  );
}
