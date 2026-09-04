'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play, Link2, CheckCircle2, Settings, Shield } from 'lucide-react';
import api, { clientApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { TenantConnection, DashboardSummary } from '@aegis/shared';
import AppSidebar from './AppSidebar';
import TenantContextHeader from './Dashboard/TenantContextHeader';
import SecurityPostureSummary from './Dashboard/SecurityPostureSummary';
import ScoreVisualization from './Dashboard/ScoreVisualization';
import SecurityBreakdown from './Dashboard/SecurityBreakdown';
import AssessmentTypeCards from './Dashboard/AssessmentTypeCards';
import ScoreTrendChart from './Dashboard/ScoreTrendChart';
import PriorityFindings from './Dashboard/PriorityFindings';
import RecommendationsPreview from './Dashboard/RecommendationsPreview';
import RecentAssessments from './Dashboard/RecentAssessments';

export default function Dashboard() {
  const [tenants, setTenants] = useState<TenantConnection[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user || !isAuthenticated) {
      setLoading(false);
      router.push('/');
      return;
    }
    fetchData();
  }, [user, isLoading, isAuthenticated]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setDashboardError(null);
    try {
      const [tenantsRes, dashboardRes] = await Promise.all([
        clientApi.get('/tenants'),
        clientApi.get('/dashboard/summary').catch(() => ({ data: null })),
      ]);
      setTenants(tenantsRes.data.data || []);
      if (dashboardRes.data) {
        setDashboard(dashboardRes.data.data as DashboardSummary);
      }
    } catch (error: any) {
      console.error('[Dashboard] Failed to fetch data:', error);
      setDashboardError(error.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    fetchData();
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const hasTenant = tenants.length > 0 && tenants.some((t) => t.connectionStatus === 'connected');

  return (
    <div className="min-h-screen flex">
      <AppSidebar />
      <div className="flex-1 md:ml-64">
        <main className="p-4 md:p-8">
          {!hasTenant ? (
            /* Pre-connection dashboard */
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <Shield className="w-5 h-5 text-gray-700" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">
                      Welcome to Aegis
                      <span className="text-gray-400 font-normal ml-2">Microsoft 365</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        No tenant connected yet
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/tenants')}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Manage Tenant
                </button>
              </div>

              {/* Placeholder stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Overall Score</p>
                  <p className="text-2xl font-bold text-gray-300">—</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Critical Findings</p>
                  <p className="text-2xl font-bold text-gray-300">—</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Controls Assessed</p>
                  <p className="text-2xl font-bold text-gray-300">—</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Last Assessment</p>
                  <p className="text-sm font-semibold text-gray-300">Not yet assessed</p>
                </div>
              </div>

              {/* Assessment type cards */}
              <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-primary-100 rounded-lg mr-4">
                    <Play className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Start Your Trial Assessment</h3>
                    <p className="text-sm text-gray-600">Quick self-assessment in under 2 minutes</p>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    <span className="text-sm text-gray-600">12-question guided wizard</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    <span className="text-sm text-gray-600">Instant estimated security score</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    <span className="text-sm text-gray-600">No tenant connection required</span>
                  </li>
                </ul>
                <button
                  onClick={() => router.push('/trial')}
                  className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Start Trial Assessment
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-green-100 rounded-lg mr-4">
                    <Play className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Connect Your Tenant</h3>
                    <p className="text-sm text-gray-600">Full automated security assessment</p>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span className="text-sm text-gray-600">Read-only Microsoft Graph access</span>
                  </li>
                   <li className="flex items-start">
                     <span className="text-green-600 mr-2">•</span>
                     <span className="text-sm text-gray-600">Automated assessment of key security modules</span>
                   </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span className="text-sm text-gray-600">Detailed PDF/Excel reports</span>
                  </li>
                </ul>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/connect-tenant')}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    Connect Your Tenant
                  </button>
                   <button
                     onClick={() => router.push('/user-guide')}
                     className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                   >
                     View User Guide
                   </button>
                 </div>
               </div>
             </div>
           </div>
           ) : (
            /* Post-connection dashboard */
            <div className="space-y-6">
              {dashboardError ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                  <p className="text-sm font-medium text-red-800 mb-1">Unable to load security posture</p>
                  <p className="text-sm text-red-600 mb-4">{dashboardError}</p>
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {dashboard?.tenant && <TenantContextHeader tenant={dashboard.tenant} />}

                  <SecurityPostureSummary
                    latestAssessment={dashboard?.latestAssessment ?? null}
                    activeAssessment={dashboard?.activeAssessment ?? null}
                    onRetry={handleRetry}
                  />

                  {dashboard?.latestAssessment && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <ScoreVisualization assessment={dashboard.latestAssessment} />
                      <SecurityBreakdown assessment={dashboard.latestAssessment} />
                    </div>
                  )}

                  <AssessmentTypeCards />

                  {dashboard?.latestAssessment && (
                    <ScoreTrendChart trend={dashboard.trend} />
                  )}

                  {dashboard?.latestAssessment && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <PriorityFindings
                        findings={dashboard.priorityFindings}
                        latestAssessment={dashboard.latestAssessment}
                      />
                      <RecommendationsPreview
                        recommendations={dashboard.recommendations}
                        latestAssessment={dashboard.latestAssessment}
                      />
                    </div>
                  )}

                  <RecentAssessments assessments={dashboard?.recentAssessments || []} />
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
