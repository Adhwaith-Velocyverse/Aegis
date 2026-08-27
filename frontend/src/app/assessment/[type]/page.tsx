'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Shield, Play, CheckCircle2, AlertCircle, Clock, Zap, FileText, Users } from 'lucide-react';

type AssessmentType = 'quick' | 'detailed';

interface AssessmentConfig {
  type: AssessmentType;
  title: string;
  description: string;
  price: string;
  duration: string;
  features: string[];
  limitations: string[];
  icon: any;
  color: string;
  bgColor: string;
}

const ASSESSMENT_CONFIGS: Record<AssessmentType, AssessmentConfig> = {
  quick: {
    type: 'quick',
    title: 'Quick Assessment',
    description: 'Automated security check using critical controls',
    price: '$5',
    duration: '5-10 minutes',
    features: [
      '100% automated - no manual review',
      'Critical control subset (50 key controls)',
      'Instant results',
      'PDF & Excel reports',
      'Shareable report link',
    ],
    limitations: [
      'Limited to automatable controls only',
      'No expert review',
      'Basic recommendations only',
    ],
    icon: Zap,
    color: 'blue',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  detailed: {
    type: 'detailed',
    title: 'Detailed Assessment',
    description: 'Comprehensive review with expert analysis',
    price: '$7',
    duration: '2-3 business days',
    features: [
      'Full control catalog evaluation',
      'Expert manual review of findings',
      'Detailed remediation guidance',
      'PDF & Excel reports',
      'Shareable report link',
      'Assessor consultation available',
    ],
    limitations: [
      'Requires assessor assignment',
      'Longer turnaround time',
    ],
    icon: FileText,
    color: 'purple',
    bgColor: 'bg-purple-50 border-purple-200',
  },
};

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = params.type as AssessmentType;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'confirm' | 'starting' | 'error'>('confirm');
  const { user } = useAuthStore();

  const config = ASSESSMENT_CONFIGS[type];

  useEffect(() => {
    if (!['quick', 'detailed'].includes(type)) {
      router.push('/');
    }
  }, [type, router]);

  // Auto-start assessment if connectionId is provided (after OAuth consent)
  useEffect(() => {
    const connectionIdParam = searchParams.get('connectionId');
    if (connectionIdParam && step === 'confirm' && !starting) {
      // Auto-start the assessment
      handleStartAssessmentWithConnection(connectionIdParam);
    }
  }, [searchParams]);

  const handleStartAssessmentWithConnection = async (connectionId: string) => {
    setStarting(true);
    setError('');
    setStep('starting');

    try {
      // Start assessment directly with the provided connectionId
      const response = await api.post(`/assessments/${type}/start`, {
        tenantConnectionId: connectionId,
      });

      const assessmentId = response.data.data.assessmentId;

      // Navigate to loading page with type parameter
      router.push(`/assessment-loading?assessmentId=${assessmentId}&type=${type}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start assessment');
      setStep('error');
      setStarting(false);
    }
  };

  const handleStartAssessment = async () => {
    setStarting(true);
    setError('');
    setStep('starting');

    try {
      // Get tenant connections
      const tenantsRes = await api.get('/tenants');
      const tenants = tenantsRes.data.data;
      const connectedTenant = tenants.find((t: any) => t.connectionStatus === 'connected');

      if (!connectedTenant) {
        setError('Please connect a tenant first');
        setStep('error');
        setStarting(false);
        return;
      }

      // Check consent status for incremental consent
      try {
        const consentRes = await api.get(`/tenants/${connectedTenant.id}/consent-status`);
        if (consentRes.data.success && !consentRes.data.data.isFullyConsented) {
          // Redirect to consent page for incremental consent
          router.push(`/consent?connectionId=${connectedTenant.id}&type=${type}`);
          setStarting(false);
          setStep('confirm');
          return;
        }
      } catch (consentError) {
        console.error('Consent check failed:', consentError);
        // Continue anyway — consent check is advisory
      }

      // Start assessment
      const response = await api.post(`/assessments/${type}/start`, {
        tenantConnectionId: connectedTenant.id,
      });

      const assessmentId = response.data.data.assessmentId;
      
      // Navigate to loading page with type parameter
      router.push(`/assessment-loading?assessmentId=${assessmentId}&type=${type}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start assessment');
      setStep('error');
      setStarting(false);
    }
  };

  if (error && step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-900 mb-2">Unable to Start Assessment</h2>
            <p className="text-red-700 mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/connect-tenant')}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Connect Tenant
              </button>
              <button
                onClick={() => { setError(''); setStep('confirm'); }}
                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'starting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="bg-white rounded-xl shadow-sm border p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Starting Assessment</h2>
            <p className="text-gray-600">Please wait while we prepare your assessment...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${config.bgColor} mb-4`}>
            <config.icon className={`w-8 h-8 text-${config.color}-600`} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{config.title}</h1>
          <p className="text-gray-600 max-w-xl mx-auto">{config.description}</p>
        </div>

        {/* Assessment Details Card */}
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-8">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Price</p>
              <p className="text-2xl font-bold text-gray-900">{config.price}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Duration</p>
              <p className="text-2xl font-bold text-gray-900">{config.duration}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Type</p>
              <p className="text-2xl font-bold text-gray-900 capitalize">{type}</p>
            </div>
          </div>

          {/* Features */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
              What's Included
            </h3>
            <ul className="space-y-3">
              {config.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Limitations */}
          {config.limitations.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <AlertCircle className="w-5 h-5 text-amber-600 mr-2" />
                Important Notes
              </h3>
              <ul className="space-y-3">
                {config.limitations.map((limitation, index) => (
                  <li key={index} className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick Assessment Specific Note */}
          {type === 'quick' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
              <div className="flex items-start">
                <Zap className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800">Quick Assessment</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    This assessment evaluates only the most critical security controls and provides an instant automated score.
                    For a comprehensive evaluation with expert review, consider the Detailed Assessment.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.back()}
              className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStartAssessment}
              disabled={starting}
              className={`flex-1 bg-${config.color}-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-${config.color}-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center`}
            >
              {starting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Start {config.title}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            By starting this assessment, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
