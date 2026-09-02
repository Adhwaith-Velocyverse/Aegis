'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Loader2, CheckCircle2, AlertTriangle, Clock, Settings, Users, FileText, Zap } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface ModuleStatus {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  icon: any;
}

const MODULES: ModuleStatus[] = [
  { name: 'Entra ID', status: 'pending', icon: Users },
  { name: 'M365 Admin Center', status: 'pending', icon: Settings },
  { name: 'Purview', status: 'pending', icon: Shield },
  { name: 'Email', status: 'pending', icon: FileText },
  { name: 'Intune', status: 'pending', icon: Loader2 },
  { name: 'Cloud Apps', status: 'pending', icon: Shield },
  { name: 'Teams', status: 'pending', icon: Users },
  { name: 'SharePoint', status: 'pending', icon: Settings },
];

const STAGES = [
  { name: 'Initializing', description: 'Preparing assessment environment' },
  { name: 'Collecting Data', description: 'Gathering security data from Microsoft Graph' },
  { name: 'Analyzing Data', description: 'Evaluating controls and calculating scores' },
  { name: 'Preparing Results', description: 'Generating your security report' },
];

export default function AssessmentLoadingPage() {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [modules, setModules] = useState<ModuleStatus[]>(MODULES);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assessmentType, setAssessmentType] = useState<'quick' | 'detailed'>('quick');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get('assessmentId');
    const type = searchParams.get('type') as 'quick' | 'detailed' | null;
    
    if (id) {
      setAssessmentId(id);
      if (type) setAssessmentType(type);
      pollProgress(id);
    } else {
      router.push('/');
    }
  }, [searchParams, router]);

  const pollProgress = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const token = useAuthStore.getState().user?.token;
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assessments/${id}/progress`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        if (response.status === 401) {
          clearInterval(interval);
          setError('Session expired. Please log in again to continue tracking the assessment.');
          return;
        }

        if (response.ok) {
          const data = await response.json();
          const moduleStatuses = data.data.modules || [];
          
          setModules(prev => prev.map((module, index) => {
            const status = moduleStatuses[index];
            if (!status) return module;
            
            let newStatus: ModuleStatus['status'] = 'pending';
            if (status.collection_status === 'completed') newStatus = 'completed';
            else if (status.collection_status === 'failed' || status.collection_status === 'permission_denied') newStatus = 'failed';
            else if (status.collection_status === 'collecting') newStatus = 'in_progress';
            
            return { ...module, status: newStatus };
          }));

          // Calculate progress
          const completed = moduleStatuses.filter((m: any) => m.collection_status === 'completed').length;
          const failed = moduleStatuses.filter((m: any) => m.collection_status === 'failed' || m.collection_status === 'permission_denied').length;
          const total = moduleStatuses.length;
          const progressPercent = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
          setProgress(progressPercent);

          // Update stage based on progress
          if (progressPercent < 20) setCurrentStage(0);
          else if (progressPercent < 60) setCurrentStage(1);
          else if (progressPercent < 90) setCurrentStage(2);
          else setCurrentStage(3);

          // Check if assessment is complete
          if (data.data.status === 'completed') {
            clearInterval(interval);
            router.push(`/results/${id}`);
          } else if (data.data.status === 'pending' && assessmentType === 'detailed') {
            // Detailed assessment pending manual review - redirect to results
            clearInterval(interval);
            router.push(`/results/${id}`);
          } else if (data.data.status === 'failed') {
            clearInterval(interval);
            setError('Assessment failed. Please try again or contact support.');
          }
        }
      } catch (error) {
        console.error('Failed to poll progress:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  };

  const getStatusIcon = (status: ModuleStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: ModuleStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-primary-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">
              {assessmentType === 'quick' ? 'Quick Assessment' : 'Detailed Assessment'} in Progress
            </h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {assessmentType === 'quick'
              ? 'Running automated security checks on critical controls. This usually takes 5-10 minutes.'
              : "We're analyzing your Microsoft 365 security posture. This usually takes 2-3 business days."
            }
          </p>
          {assessmentType === 'quick' && (
            <div className="mt-4 inline-flex items-center bg-blue-50 border border-blue-200 rounded-full px-4 py-2">
              <Zap className="w-4 h-4 text-blue-600 mr-2" />
              <span className="text-sm text-blue-800 font-medium">Quick Assessment - No manual review required</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Overall Progress</h2>
            <span className="text-sm text-gray-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-primary-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between">
            {STAGES.map((stage, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                  index <= currentStage
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {index < currentStage ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span className="text-xs text-gray-600 text-center">{stage.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Current Stage Description */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
          <div className="flex items-start">
            <Loader2 className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0 animate-spin" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                {STAGES[currentStage].name}
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                {STAGES[currentStage].description}
              </p>
            </div>
          </div>
        </div>

        {/* Module Status */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Module Collection Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((module, index) => {
              const Icon = module.icon;
              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    module.status === 'completed'
                      ? 'border-green-200 bg-green-50'
                      : module.status === 'in_progress'
                      ? 'border-blue-200 bg-blue-50'
                      : module.status === 'failed'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Icon className={`w-5 h-5 mr-3 ${
                        module.status === 'completed'
                          ? 'text-green-600'
                          : module.status === 'in_progress'
                          ? 'text-blue-600'
                          : module.status === 'failed'
                          ? 'text-red-600'
                          : 'text-gray-400'
                      }`} />
                      <span className="text-sm font-medium text-gray-900">{module.name}</span>
                    </div>
                    {getStatusIcon(module.status)}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{getStatusText(module.status)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Assessment Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-4 bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Please do not close this window. The assessment will continue in the background.
          </p>
        </div>
      </div>
    </div>
  );
}
