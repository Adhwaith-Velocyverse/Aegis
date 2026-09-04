'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api, { clientApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { TenantConnection } from '@aegis/shared';
import { Loader2, Play, Link2, CheckCircle2, Rocket, Zap, ClipboardList, Info } from 'lucide-react';
import AppSidebar from './AppSidebar';

export default function Dashboard() {
  const [tenants, setTenants] = useState<TenantConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user, logout, isLoading, isAuthenticated } = useAuthStore();

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
    try {
      const tenantsRes = await clientApi.get('/tenants');
      setTenants(tenantsRes.data.data);
    } catch (error: any) {
      console.error('[Dashboard] Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
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
      <div className="flex-1 ml-64">
        <main className="p-8">
          {!hasTenant ? (
            /* Pre-connection dashboard */
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
                    <Link2 className="w-6 h-6 text-green-600" />
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
                    <span className="text-sm text-gray-600">Assess all 8 M365 modules</span>
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
          ) : (
            /* Post-connection dashboard */
            <div className="space-y-6">
              {/* Hero Success Card */}
              <div className="relative rounded-2xl shadow-sm border border-gray-200 p-3 md:p-4">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                  <div className="w-48 h-48 bg-gradient-to-r from-purple-200/30 to-blue-200/30 rounded-full blur-3xl opacity-40"></div>
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <div className="p-0.5 bg-green-100 rounded-full mr-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-gray-900">The tool successfully connected to your tenant.</h2>
                        <p className="text-xs text-gray-600 mt-0.5">Assess your Microsoft 365 environment, identify security gaps, and improve your security posture.</p>
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:flex flex-shrink-0 items-center justify-center">
                    <svg width="90" height="63" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <defs>
                        <linearGradient id="screenGrad" x1="40" y1="33" x2="160" y2="98" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#DBEAFE"/>
                          <stop offset="1" stopColor="#BFDBFE"/>
                        </linearGradient>
                        <linearGradient id="baseGrad" x1="20" y1="110" x2="180" y2="118" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#D1D5DB"/>
                          <stop offset="1" stopColor="#9CA3AF"/>
                        </linearGradient>
                        <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.08"/>
                        </filter>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur"/>
                          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                        </filter>
                      </defs>
                      <g filter="url(#dropShadow)">
                        <rect x="30" y="25" width="140" height="85" rx="8" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1.5"/>
                      </g>
                      <rect x="40" y="33" width="120" height="65" rx="4" fill="url(#screenGrad)"/>
                      <g filter="url(#glow)">
                        <path d="M100 50L115 57V70C115 75 107 80 100 82C93 80 85 75 85 70V57L100 50Z" fill="#10B981"/>
                        <path d="M94 67L99 72L106 63" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </g>
                      <rect x="20" y="110" width="160" height="8" rx="4" fill="url(#baseGrad)"/>
                      <g transform="translate(125, 15)" filter="url(#dropShadow)">
                        <path d="M10 18C5 18 1 14 1 10C1 6 5 2 10 2C11 2 12 0 15 0C19 0 20 4 22 4C27 4 30 8 30 12C30 15 27 18 22 18H10Z" fill="#BFDBFE"/>
                      </g>
                      <circle cx="165" cy="20" r="3" fill="#93C5FD" opacity="0.6"/>
                      <circle cx="175" cy="28" r="2" fill="#93C5FD" opacity="0.4"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Choose an Assessment Type */}
              <div className="relative rounded-2xl p-6 md:p-8">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                  <div className="w-64 h-64 bg-gradient-to-r from-purple-200/40 to-blue-200/40 rounded-full blur-3xl opacity-60"></div>
                </div>
                <div className="relative z-10 text-center mb-10">
                  <h2 className="text-xl font-bold text-gray-900">Choose an Assessment Type</h2>
                  <div className="h-1 w-12 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 mx-auto mt-3"></div>
                  <p className="mt-3 text-gray-600 leading-relaxed">Select the type of assessment you want to run for your Microsoft 365 environment.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Trial Assessment */}
                  <div className="group rounded-xl border border-purple-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-5">
                        <div className="absolute inset-0 rounded-full bg-purple-100 opacity-60 group-hover:opacity-80 transition-opacity duration-200"></div>
                        <div className="relative w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center ring-4 ring-purple-50 group-hover:ring-purple-100 transition-all duration-200">
                          <Rocket className="w-7 h-7 text-purple-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Trial Assessment</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">Run a limited assessment covering key security areas to experience the tool and identify high-priority gaps.</p>
                    </div>
                    <ul className="mt-5 space-y-3 flex-1">
                      <li className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-purple-600 mr-2.5 mt-0.5 flex-shrink-0" />
                        Covers key security areas
                      </li>
                      <li className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-purple-600 mr-2.5 mt-0.5 flex-shrink-0" />
                        Quick results
                      </li>
                      <li className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-purple-600 mr-2.5 mt-0.5 flex-shrink-0" />
                        Ideal to try before full assessment
                      </li>
                    </ul>
                    <button
                      onClick={() => router.push('/trial')}
                      className="mt-6 w-full bg-purple-600 text-white py-2.5 px-4 rounded-lg font-medium shadow-sm shadow-purple-200 hover:bg-purple-700 hover:shadow-md hover:shadow-purple-200 transition-all duration-200 flex items-center justify-center"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Trial Assessment
                      <span className="ml-auto text-sm opacity-90">FREE</span>
                    </button>
                  </div>

                  {/* Quick Assessment */}
                  <div className="group rounded-xl border border-green-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-5">
                        <div className="absolute inset-0 rounded-full bg-green-100 opacity-60 group-hover:opacity-80 transition-opacity duration-200"></div>
                        <div className="relative w-14 h-14 rounded-full bg-green-100 flex items-center justify-center ring-4 ring-green-50 group-hover:ring-green-100 transition-all duration-200">
                          <Zap className="w-7 h-7 text-green-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Assessment</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">Run a high-level assessment of essential security controls to get an overview of your security posture in a short time.</p>
                    </div>
                    <ul className="mt-5 space-y-3 flex-1">
                      <li className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mr-2.5 mt-0.5 flex-shrink-0" />
                        Covers critical security controls
                      </li>
                      <li className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mr-2.5 mt-0.5 flex-shrink-0" />
                        Faster execution
                      </li>
                      <li className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mr-2.5 mt-0.5 flex-shrink-0" />
                        Ideal for regular security checks
                      </li>
                    </ul>
                    <button
                      onClick={() => router.push('/assessment/quick')}
                      className="mt-6 w-full bg-green-600 text-white py-2.5 px-4 rounded-lg font-medium shadow-sm shadow-green-200 hover:bg-green-700 hover:shadow-md hover:shadow-green-200 transition-all duration-200 flex items-center justify-center"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Quick Assessment
                    </button>
                  </div>

                  {/* Detailed Assessment */}
                  <div className="group relative rounded-xl border border-blue-200 bg-white p-6 shadow-md ring-2 ring-blue-500 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col">
                    <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm">
                      Recommended
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-5">
                        <div className="absolute inset-0 rounded-full bg-blue-100 opacity-60 group-hover:opacity-80 transition-opacity duration-200"></div>
                        <div className="relative w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center ring-4 ring-blue-50 group-hover:ring-blue-100 transition-all duration-200">
                          <ClipboardList className="w-7 h-7 text-blue-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Detailed Assessment</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">Run an in-depth assessment of all security controls for Microsoft Entra ID and Exchange Online to get a comprehensive security analysis.</p>
                    </div>
                    <ul className="mt-5 space-y-3 flex-1">
                      <li className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 mr-2.5 mt-0.5 flex-shrink-0" />
                        Covers all security controls
                      </li>
                      <li className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 mr-2.5 mt-0.5 flex-shrink-0" />
                        In-depth analysis and findings
                      </li>
                      <li className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 mr-2.5 mt-0.5 flex-shrink-0" />
                        Ideal for compliance and audits
                      </li>
                    </ul>
                    <button
                      onClick={() => router.push('/assessment/detailed')}
                      className="mt-6 w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium shadow-sm shadow-blue-200 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-200 transition-all duration-200 flex items-center justify-center"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Detailed Assessment
                    </button>
                  </div>
                </div>
                <div className="mt-8 flex items-center justify-center text-sm text-gray-600 bg-blue-50 rounded-lg py-3 px-4 border border-blue-100 shadow-sm">
                  <Info className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
                  Not sure which one to choose?{' '}
                  <button onClick={() => router.push('/user-guide')} className="text-primary-600 hover:text-primary-700 font-medium ml-1">
                    Learn more about assessment types
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
