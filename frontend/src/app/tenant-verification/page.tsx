'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Shield, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Link2, ExternalLink, Loader2 } from 'lucide-react';

interface TenantConnection {
  id: string;
  tenantId: string;
  tenantName: string;
  connectionStatus: string;
  lastHealthCheck?: string;
  consentedScopes?: string[];
}

export default function TenantVerificationPage() {
  const [connections, setConnections] = useState<TenantConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await api.get('/tenants');
      setConnections(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHealthCheck = async (connectionId: string) => {
    setCheckingId(connectionId);
    try {
      await api.post(`/tenants/${connectionId}/health-check`);
      await fetchConnections();
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setCheckingId(null);
    }
  };

  const handleReconnect = (connection: TenantConnection) => {
    // Redirect to consent page for reconnection
    router.push(`/consent?connectionId=${connection.id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-700 bg-green-100';
      case 'needs_attention': return 'text-yellow-700 bg-yellow-100';
      case 'disconnected': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle2 className="w-5 h-5" />;
      case 'needs_attention': return <AlertTriangle className="w-5 h-5" />;
      case 'disconnected': return <XCircle className="w-5 h-5" />;
      default: return <XCircle className="w-5 h-5" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'needs_attention': return 'Needs Attention';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-primary-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Tenant Connection Verification</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Verify and manage your Microsoft 365 tenant connections. Ensure your connections are healthy and up-to-date.
          </p>
        </div>

        {/* Connections List */}
        {connections.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <Link2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tenant Connections</h3>
            <p className="text-gray-600 mb-6">
              You haven't connected any Microsoft 365 tenants yet. Connect a tenant to start automated security assessments.
            </p>
            <button
              onClick={() => router.push('/connect-tenant')}
              className="bg-primary-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Connect Your First Tenant
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="bg-white rounded-xl shadow-sm border p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <div className={`p-2 rounded-lg mr-4 ${
                      connection.connectionStatus === 'connected' ? 'bg-green-100' :
                      connection.connectionStatus === 'needs_attention' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      {getStatusIcon(connection.connectionStatus)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{connection.tenantName}</h3>
                      <p className="text-sm text-gray-600">{connection.tenantId}</p>
                      <div className="flex items-center mt-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(connection.connectionStatus)}`}>
                          {getStatusText(connection.connectionStatus)}
                        </span>
                        {connection.lastHealthCheck && (
                          <span className="text-xs text-gray-500 ml-3">
                            Last checked: {new Date(connection.lastHealthCheck).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {connection.connectionStatus !== 'connected' && (
                      <button
                        onClick={() => handleReconnect(connection)}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Reconnect
                      </button>
                    )}
                    <button
                      onClick={() => handleHealthCheck(connection.id)}
                      disabled={checkingId === connection.id}
                      className="text-gray-600 hover:text-gray-700 text-sm font-medium flex items-center disabled:opacity-50"
                    >
                      {checkingId === connection.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Verify
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Consented Scopes */}
                {connection.consentedScopes && connection.consentedScopes.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Consented Permissions</h4>
                    <div className="flex flex-wrap gap-1">
                      {connection.consentedScopes.map((scope) => (
                        <span
                          key={scope}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <button
                    onClick={() => router.push(`/connect-tenant?connectionId=${connection.id}`)}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Manage Modules
                  </button>
                  {connection.connectionStatus === 'connected' && (
                    <button
                      onClick={() => router.push('/')}
                      className="bg-primary-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      Go to Dashboard
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Need Help?</h3>
          <p className="text-sm text-blue-800 mb-4">
            If you're experiencing connection issues, try the following:
          </p>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Ensure a global administrator has granted consent for your tenant</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Check that the app registration is configured for multi-tenant access</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Verify that the required API permissions are granted in Azure AD</span>
            </li>
          </ul>
          <button className="mt-4 text-primary-600 hover:text-primary-700 text-sm font-medium">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
