'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Shield, Download, CheckCircle2, ExternalLink, Key, XCircle, AlertTriangle, RefreshCw, Settings, Server, Lock, Mail, Users, Cloud, MessageSquare, HardDrive, ShieldCheck } from 'lucide-react';

interface ModuleConfig {
  id: string;
  moduleName: string;
  isEnabled: boolean;
  collectionStatus: string;
}

interface Connection {
  id: string;
  tenantId: string;
  tenantName: string;
  connectionStatus: string;
  lastHealthCheck?: string;
  modules: ModuleConfig[];
}

const MODULES = [
  { name: 'Entra ID', icon: Users, description: 'Identity, access policies, conditional access' },
  { name: 'M365 Admin Center', icon: Settings, description: 'Organization settings, sharing, policies' },
  { name: 'Purview', icon: Shield, description: 'Compliance, DLP, data classification' },
  { name: 'Email', icon: Mail, description: 'Exchange Online, anti-phishing, anti-spam' },
  { name: 'Intune', icon: HardDrive, description: 'Device management, compliance, encryption' },
  { name: 'Cloud Apps', icon: Cloud, description: 'Cloud app security, conditional access' },
  { name: 'Teams', icon: MessageSquare, description: 'Teams settings, external access, meetings' },
  { name: 'SharePoint', icon: Server, description: 'Sharing, external access, permissions' },
];

export default function ConnectTenantPage() {
  const [connectionMethod, setConnectionMethod] = useState<'oauth' | 'direct'>('direct');
  const [tenantId, setTenantId] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle OAuth callback parameters
  useEffect(() => {
    const connectedParam = searchParams.get('connected');
    const errorParam = searchParams.get('error');
    const connectionIdParam = searchParams.get('connectionId');
    const assessmentTypeParam = searchParams.get('assessmentType');

    if (connectedParam === 'true' && connectionIdParam) {
      setConnected(true);
      setConnectionId(connectionIdParam);
      setError(null);
      // Clear URL parameters
      router.replace('/connect-tenant', { scroll: false });
      // Fetch connections after OAuth connection
      fetchConnections();

      // Auto-redirect to assessment if assessmentType is provided
      if (assessmentTypeParam && ['quick', 'detailed'].includes(assessmentTypeParam)) {
        setTimeout(() => {
          router.push(`/assessment/${assessmentTypeParam}?connectionId=${connectionIdParam}`);
        }, 1000);
      }
    } else if (errorParam) {
      setError(decodeURIComponent(errorParam));
      setConnected(false);
      // Clear URL parameters
      router.replace('/connect-tenant', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await api.get('/tenants');
      setConnections(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    }
  };

  const fetchModules = async (connId: string) => {
    try {
      const response = await api.get(`/tenants/${connId}/modules`);
      setModules(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch modules:', error);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        tenantId,
        tenantName,
        connectionMethod,
      };

      if (connectionMethod === 'direct') {
        payload.azureTenantId = azureTenantId;
        payload.azureClientId = azureClientId;
        payload.azureClientSecret = azureClientSecret;
      }

      const response = await api.post('/tenants/connect', payload);

      if (response.data.data.authUrl) {
        // OAuth flow - redirect to consent page first
        const connectionId = response.data.data.connectionId;
        // Determine assessment type based on URL params or default to quick
        const assessmentType = searchParams.get('type') || 'quick';
        router.push(`/consent?connectionId=${connectionId}&type=${assessmentType}`);
      } else {
        // Direct connection success
        setLoading(false);
        setConnected(true);
        setConnectionId(response.data.data.connectionId);
        fetchConnections();
      }
    } catch (error: any) {
      console.error('Failed to connect tenant:', error);
      setError(error.response?.data?.error || 'Failed to connect tenant. Please try again.');
      setLoading(false);
    }
  };

  const handleVerifyConnection = async () => {
    if (!connectionId) return;
    
    setLoading(true);
    try {
      await api.post(`/tenants/verify/${connectionId}`);
      // Connection verified successfully
      router.push('/');
    } catch (error) {
      console.error('Failed to verify connection:', error);
      setLoading(false);
    }
  };

  const handleHealthCheck = async (connId: string) => {
    setHealthLoading(true);
    setHealthStatus(null);
    try {
      const response = await api.post(`/tenants/${connId}/health-check`);
      setHealthStatus(response.data.data.status);
      fetchConnections();
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus('error');
    } finally {
      setHealthLoading(false);
    }
  };

  const handleModuleToggle = async (moduleName: string, isEnabled: boolean) => {
    if (!selectedConnection) return;
    
    try {
      await api.patch(`/tenants/${selectedConnection.id}/modules/${encodeURIComponent(moduleName)}`, { isEnabled });
      setModules(prev => prev.map(m => 
        m.moduleName === moduleName ? { ...m, isEnabled } : m
      ));
    } catch (error) {
      console.error('Failed to update module:', error);
    }
  };

  const handleSelectConnection = async (conn: Connection) => {
    setSelectedConnection(conn);
    await fetchModules(conn.id);
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
      case 'connected': return <CheckCircle2 className="w-4 h-4" />;
      case 'needs_attention': return <AlertTriangle className="w-4 h-4" />;
      case 'disconnected': return <XCircle className="w-4 h-4" />;
      default: return <XCircle className="w-4 h-4" />;
    }
  };

  if (connected && connectionId) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Tenant Connected Successfully</h1>
            <p className="text-gray-600 mb-8">
              Your Microsoft 365 tenant has been connected. You can now start assessments.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleVerifyConnection}
                disabled={loading}
                className="bg-primary-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Go to Dashboard'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <Shield className="w-16 h-16 text-primary-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Your Microsoft 365 Tenant</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Securely connect your tenant to enable automated security assessments. We request only read-only permissions.
          </p>
        </div>

        {error && (
          <div className="max-w-6xl mx-auto px-4 mb-8">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start">
              <XCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Connection Failed</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Connection Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Tenant Information</h2>
              
              {/* Connection Method Toggle */}
              <div className="flex rounded-lg border border-gray-200 p-1 mb-6">
                <button
                  type="button"
                  onClick={() => setConnectionMethod('oauth')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    connectionMethod === 'oauth'
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ExternalLink className="w-4 h-4 inline mr-2" />
                  OAuth
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionMethod('direct')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    connectionMethod === 'direct'
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Key className="w-4 h-4 inline mr-2" />
                  Direct Keys
                </button>
              </div>

              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
                  <input
                    type="text"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="e.g., contoso.onmicrosoft.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Name</label>
                  <input
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="e.g., Contoso Ltd"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                {connectionMethod === 'direct' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Azure Tenant ID</label>
                      <input
                        type="text"
                        value={azureTenantId}
                        onChange={(e) => setAzureTenantId(e.target.value)}
                        placeholder="e.g., 72f988bf-..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required={connectionMethod === 'direct'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Azure Client ID</label>
                      <input
                        type="text"
                        value={azureClientId}
                        onChange={(e) => setAzureClientId(e.target.value)}
                        placeholder="e.g., 0f1431ce-..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required={connectionMethod === 'direct'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Azure Client Secret</label>
                      <input
                        type="password"
                        value={azureClientSecret}
                        onChange={(e) => setAzureClientSecret(e.target.value)}
                        placeholder="Enter your client secret"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required={connectionMethod === 'direct'}
                      />
                    </div>
                  </>
                )}

                {connectionMethod === 'oauth' && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      You will be redirected to Microsoft to sign in and grant permissions. 
                      A global administrator must consent to the requested permissions.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Connecting...
                    </>
                  ) : connectionMethod === 'oauth' ? (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Connect with Microsoft
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Connect with Keys
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Panel - Existing Connections & Info */}
          <div className="space-y-6">
            {/* Existing Connections */}
            {connections.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Connections</h3>
                <div className="space-y-3">
                  {connections.map((conn) => (
                    <div
                      key={conn.id}
                      onClick={() => handleSelectConnection(conn)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedConnection?.id === conn.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{conn.tenantName}</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(conn.connectionStatus || 'disconnected')}`}>
                          {getStatusIcon(conn.connectionStatus || 'disconnected')}
                          <span className="ml-1 capitalize">{(conn.connectionStatus || 'disconnected').replace('_', ' ')}</span>
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{conn.tenantId}</p>
                      {conn.lastHealthCheck && (
                        <p className="text-xs text-gray-400 mt-1">
                          Last checked: {new Date(conn.lastHealthCheck).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Module Configuration */}
            {selectedConnection && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-primary-600" />
                  Module Configuration
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select which modules to include in your security assessment.
                </p>
                <div className="space-y-3">
                  {MODULES.map((module) => {
                    const moduleConfig = modules.find(m => m.moduleName === module.name);
                    const isEnabled = moduleConfig?.isEnabled ?? true;
                    const Icon = module.icon;
                    return (
                      <div key={module.name} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                        <div className="flex items-center">
                          <Icon className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{module.name}</p>
                            <p className="text-xs text-gray-500">{module.description}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => handleModuleToggle(module.name, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Health Check */}
            {selectedConnection && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Health</h3>
                <button
                  onClick={() => handleHealthCheck(selectedConnection.id)}
                  disabled={healthLoading}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {healthLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Run Health Check
                    </>
                  )}
                </button>
                {healthStatus && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    healthStatus === 'connected' ? 'bg-green-50 text-green-800' :
                    healthStatus === 'needs_attention' ? 'bg-yellow-50 text-yellow-800' :
                    'bg-red-50 text-red-800'
                  }`}>
                    <p className="text-sm font-medium capitalize">{healthStatus.replace('_', ' ')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Info Panel */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">What permissions are requested?</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start">
                  <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Read-only access to identity and access policies</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Read-only access to security and compliance settings</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Read-only access to device and app configurations</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>No write permissions requested</span>
                </li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Admin Consent Required
              </h3>
              <p className="text-sm text-yellow-800">
                The Microsoft consent page will require a global administrator to approve the permissions. 
                If you are not an admin, please contact your IT administrator to complete the connection.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Download className="w-5 h-5 mr-2 text-primary-600" />
                Need help?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Download our step-by-step guide to connect your tenant.
              </p>
              <button
                onClick={() => window.open('/user-guide', '_blank')}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Download User Guide (PDF)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
