'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api, { clientApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Assessment, TenantConnection } from '@aegis/shared';
import { Shield, Play, Link2, FileText, History, Settings, LogOut, Loader2, ChevronDown, User, KeyRound, Users, Trash2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function Dashboard() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [tenants, setTenants] = useState<TenantConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ deletionDate: string } | null>(null);
  const router = useRouter();
  const { user, logout, isLoading, isAuthenticated } = useAuthStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait for auth state to load before checking
    if (isLoading) return;
    
    // Check if user is authenticated before fetching data
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
      const [assessmentsRes, tenantsRes] = await Promise.all([
        clientApi.get('/assessments/history'),
        clientApi.get('/tenants'),
      ]);
      setAssessments(assessmentsRes.data.data);
      setTenants(tenantsRes.data.data);
    } catch (error: any) {
      console.error('[Dashboard] Failed to fetch data:', error);
      console.error('[Dashboard] Error response:', error.response?.data);
      console.error('[Dashboard] Error status:', error.response?.status);
      // Don't auto-logout on 401 — allow admin/assessor to view dashboard
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete('/auth/account', {
        data: {
          password: deletePassword,
          reason: deleteReason,
        },
      });
      setDeleteResult({
        deletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account. Please check your password and try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Close account menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const hasTenant = tenants.length > 0 && tenants.some((t) => t.connectionStatus === 'connected');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Aegis</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.fullName}</span>
              <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full capitalize">
                {user?.orgRole || 'Member'}
              </span>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <User className="w-5 h-5 mr-1" />
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showAccountMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                    <button
                      onClick={() => { setShowAccountMenu(false); router.push('/'); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Back to User
                    </button>
                    <button
                      onClick={() => { setShowAccountMenu(false); router.push('/account'); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Account Settings
                    </button>
                    <button
                      onClick={() => { setShowAccountMenu(false); router.push('/mfa'); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      MFA Settings
                    </button>
                    <button
                      onClick={() => { setShowAccountMenu(false); router.push('/organization'); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Organization
                    </button>
                    <button
                      onClick={() => { setShowAccountMenu(false); router.push('/history'); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <History className="w-4 h-4 mr-2" />
                      Assessment History
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => { setShowAccountMenu(false); handleLogout(); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => { setShowAccountMenu(false); setShowDeleteModal(true); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Account
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            {!deleteResult ? (
              <>
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-red-100 rounded-lg mr-3">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-800">
                    This action will schedule your account for deletion in <strong>30 days</strong>.
                    During this grace period, you can cancel the deletion at any time.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm your password
                  </label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for leaving (optional)
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Help us improve by telling us why you're leaving..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeletePassword('');
                      setDeleteReason('');
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting || !deletePassword}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Delete Account'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="p-3 bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Deletion Scheduled</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your account will be permanently deleted on:
                </p>
                <p className="text-lg font-medium text-gray-900 mb-4">
                  {new Date(deleteResult.deletionDate).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  You can cancel this deletion by logging in before the grace period ends.
                </p>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteResult(null);
                    setDeletePassword('');
                    setDeleteReason('');
                  }}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200"
                >
                  I Understand
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            {/* Success Banner */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 mr-3" />
              <p className="text-green-800 font-medium">The tool successfully connected to your tenant</p>
            </div>

            {/* Assessment Type Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-primary-100 rounded-lg mr-4">
                    <Play className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Trial Assessment</h3>
                    <p className="text-sm text-gray-600">Free self-assessment</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/trial')}
                  className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Start Trial
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg mr-4">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Quick Assessment</h3>
                    <p className="text-sm text-gray-600">$5 - Automated check</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/assessment/quick')}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Start Quick Assessment
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-purple-100 rounded-lg mr-4">
                    <FileText className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Detailed Assessment</h3>
                    <p className="text-sm text-gray-600">$7 - Expert reviewed</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/assessment/detailed')}
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Start Detailed Assessment
                </button>
              </div>
            </div>

            {/* Connection Status */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Status</h2>
              <div className="space-y-3">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{tenant.tenantName}</h3>
                      <p className="text-xs text-gray-500">{tenant.tenantId}</p>
                    </div>
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tenant.connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                        tenant.connectionStatus === 'needs_attention' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tenant.connectionStatus === 'connected' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {tenant.connectionStatus === 'needs_attention' && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {tenant.connectionStatus === 'disconnected' && <XCircle className="w-3 h-3 mr-1" />}
                        <span className="ml-1 capitalize">{tenant.connectionStatus?.replace('_', ' ') || 'disconnected'}</span>
                      </span>
                      <button
                        onClick={() => router.push('/tenant-verification')}
                        className="ml-4 text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assessment History */}
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <History className="w-5 h-5 mr-2" />
                    Assessment History
                  </h2>
                  <button
                    onClick={() => router.push('/history')}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    View All
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {assessments.slice(0, 5).map((assessment) => (
                      <tr key={assessment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                            {assessment.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(assessment.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {assessment.overallScore !== undefined ? `${assessment.overallScore}/100` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            assessment.status === 'completed' ? 'bg-green-100 text-green-800' :
                            assessment.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {assessment.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {assessment.status === 'completed' && (
                            <button
                              onClick={() => router.push(`/results/${assessment.id}`)}
                              className="text-primary-600 hover:text-primary-700 font-medium"
                            >
                              View Report
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {assessments.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          No assessments yet. Start your first assessment above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
