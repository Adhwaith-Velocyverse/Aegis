'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { clientApi } from '@/lib/api';
import { Shield, Plus, CheckCircle2, AlertTriangle, XCircle, Eye, RefreshCw, Info } from 'lucide-react';

interface TenantRow {
  id: string;
  tenantId: string;
  tenantName: string;
  connectionStatus: string;
  assessmentCount?: number;
  lastAssessedAt?: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user || !isAuthenticated) {
      setLoading(false);
      router.push('/');
      return;
    }
    fetchTenants();
  }, [user, isLoading, isAuthenticated, router]);

  const fetchTenants = async () => {
    try {
      const response = await clientApi.get('/tenants');
      setTenants(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'needs_attention': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'disconnected': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <XCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'needs_attention': return 'bg-yellow-100 text-yellow-800';
      case 'disconnected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button onClick={() => router.push('/')} className="text-gray-600 hover:text-gray-900 mr-4">
                ← Back
              </button>
              <Shield className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Tenants</h1>
            </div>
            <button
              onClick={() => router.push('/connect-tenant')}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Tenant
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            Manage your connected Microsoft 365 tenants and view assessment history.
          </p>
        </div>

        {/* Tenants Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assessments</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Assessed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-primary-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{tenant.tenantName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {tenant.tenantId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tenant.connectionStatus)}`}>
                        {getStatusIcon(tenant.connectionStatus)}
                        <span className="ml-1 capitalize">{tenant.connectionStatus?.replace('_', ' ') || 'disconnected'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tenant.assessmentCount ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {tenant.lastAssessedAt ? new Date(tenant.lastAssessedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => router.push(`/tenant-verification?connectionId=${tenant.id}`)}
                        className="flex items-center text-primary-600 hover:text-primary-700 font-medium"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Verify
                      </button>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Shield className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 mb-2">No tenants connected yet</p>
                        <button
                          onClick={() => router.push('/connect-tenant')}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Connect your first tenant
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-6 flex items-center justify-center text-sm text-gray-600 bg-blue-50 rounded-lg py-3 px-4 border border-blue-100">
          <Info className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
          Need help connecting a tenant?{' '}
          <button onClick={() => router.push('/user-guide')} className="text-primary-600 hover:text-primary-700 font-medium ml-1">
            View the user guide
          </button>
        </div>
      </main>
    </div>
  );
}
