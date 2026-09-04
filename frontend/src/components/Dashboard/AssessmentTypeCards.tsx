'use client';

import { useRouter } from 'next/navigation';
import { Rocket, Zap, ClipboardList, Play } from 'lucide-react';

interface AssessmentTypeCardsProps {
  onStartTrial?: () => void;
}

export default function AssessmentTypeCards({ onStartTrial }: AssessmentTypeCardsProps) {
  const router = useRouter();

  const cards = [
    {
      name: 'Trial Assessment',
      description: 'Quick self-assessment covering key security areas.',
      icon: Rocket,
      color: 'purple',
      action: () => router.push('/trial'),
      buttonLabel: 'Start Trial',
    },
    {
      name: 'Quick Assessment',
      description: 'Automated assessment of critical security controls.',
      icon: Zap,
      color: 'green',
      action: () => router.push('/assessment/quick'),
      buttonLabel: 'Start Quick',
    },
    {
      name: 'Detailed Assessment',
      description: 'Comprehensive analysis with expert review and full reporting.',
      icon: ClipboardList,
      color: 'blue',
      action: () => router.push('/assessment/detailed'),
      buttonLabel: 'Start Detailed',
      recommended: true,
    },
  ];

  const colorClasses = {
    purple: {
      border: 'border-purple-200',
      iconBg: 'bg-purple-100',
      iconText: 'text-purple-600',
      button: 'bg-purple-600 hover:bg-purple-700',
    },
    green: {
      border: 'border-green-200',
      iconBg: 'bg-green-100',
      iconText: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700',
    },
    blue: {
      border: 'border-blue-200',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {cards.map((card) => {
        const colors = colorClasses[card.color as keyof typeof colorClasses];
        const Icon = card.icon;

        return (
          <div
            key={card.name}
            className={`relative rounded-xl border ${colors.border} bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md flex flex-col`}
          >
            {card.recommended && (
              <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                Recommended
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${colors.iconBg} flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${colors.iconText}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">{card.name}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{card.description}</p>
              </div>
            </div>
            <button
              onClick={card.action}
              className={`mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg transition-colors ${colors.button}`}
            >
              <Play className="w-3 h-3" />
              {card.buttonLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}
