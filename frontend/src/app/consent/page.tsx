'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Shield, CheckCircle2, AlertTriangle, Lock, Users, Mail, HardDrive, Cloud, MessageSquare, Server, Settings, ArrowRight, Info } from 'lucide-react';

interface ConsentModule {
  name: string;
  description: string;
  plainEnglishDescription: string;
  scopes: string[];
  icon: any;
  required: boolean;
  connectorType: 'graph' | 'powershell';
}

// Module configs aligned with backend MODULE_SCOPE_MAP (Section 16.2 verified)
const CONSENT_MODULES: ConsentModule[] = [
  {
    name: 'Entra ID',
    description: 'Identity and access management',
    plainEnglishDescription: 'Read your identity policies, conditional access rules, MFA settings, and privileged role assignments to assess identity security posture.',
    scopes: ['Policy.Read.All', 'Directory.Read.All', 'AuditLog.Read.All', 'RoleManagement.Read.Directory'],
    icon: Users,
    required: true,
    connectorType: 'graph',
  },
  {
    name: 'M365 Admin Center',
    description: 'Organization-wide settings',
    plainEnglishDescription: 'Read your organization settings, license information, and sharing policies to understand your M365 configuration.',
    scopes: ['Organization.Read.All', 'Directory.Read.All'],
    icon: Settings,
    required: true,
    connectorType: 'graph',
  },
  {
    name: 'Purview',
    description: 'Compliance and data protection',
    plainEnglishDescription: 'Read your DLP policies, sensitivity labels, retention policies, and audit log configuration to assess data protection.',
    scopes: [], // PowerShell-only — no Graph scopes
    icon: Shield,
    required: false,
    connectorType: 'powershell',
  },
  {
    name: 'Email',
    description: 'Exchange Online security',
    plainEnglishDescription: 'Read your anti-phishing policies, anti-malware settings, external forwarding rules, and mailbox audit configuration.',
    scopes: [], // PowerShell-only — no Graph scopes
    icon: Mail,
    required: false,
    connectorType: 'powershell',
  },
  {
    name: 'Intune',
    description: 'Device management and compliance',
    plainEnglishDescription: 'Read your device configurations, compliance policies, and managed device status to assess endpoint security.',
    scopes: ['DeviceManagementConfiguration.Read.All', 'DeviceManagementManagedDevices.Read.All'],
    icon: HardDrive,
    required: false,
    connectorType: 'graph',
  },
  {
    name: 'Cloud Apps',
    description: 'Cloud app security',
    plainEnglishDescription: 'Read your discovered apps, sanctioned apps, and cloud app security alerts to assess cloud app usage.',
    scopes: ['CloudApp-Discovery.Read.All'], // Beta-only, limited coverage
    icon: Cloud,
    required: false,
    connectorType: 'graph',
  },
  {
    name: 'Teams',
    description: 'Teams collaboration security',
    plainEnglishDescription: 'Read your Teams settings, external access policies, and meeting security configurations.',
    scopes: ['Policy.Read.All'], // Directory-level guest access only
    icon: MessageSquare,
    required: false,
    connectorType: 'graph',
  },
  {
    name: 'SharePoint',
    description: 'SharePoint sharing and permissions',
    plainEnglishDescription: 'Read your SharePoint sharing settings, external access policies, and site-level permissions.',
    scopes: ['SharePointTenantSettings.Read.All', 'Sites.Read.All'],
    icon: Server,
    required: false,
    connectorType: 'graph',
  },
];

export default function ConsentPage() {
  const [selectedModules, setSelectedModules] = useState<string[]>(CONSENT_MODULES.map(m => m.name));
  const [loading, setLoading] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [consentStatus, setConsentStatus] = useState<Record<string, { consented: boolean; missingScopes: string[]; connectorType: string }>>({});
  const [isIncremental, setIsIncremental] = useState(false);
  const [assessmentType, setAssessmentType] = useState<'quick' | 'detailed' | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const connId = searchParams.get('connectionId');
    const assessmentType = searchParams.get('assessmentType') as 'quick' | 'detailed' | null;
    if (connId) {
      setConnectionId(connId);
      if (assessmentType) setAssessmentType(assessmentType);
      fetchConsentStatus(connId);
    } else {
      router.push('/connect-tenant');
    }
  }, [searchParams, router]);

  const fetchConsentStatus = async (connId: string) => {
    try {
      const response = await api.get(`/tenants/${connId}/consent-status`);
      if (response.data.success) {
        setConsentStatus(response.data.data.moduleStatus);
        setIsIncremental(!response.data.data.isFullyConsented);
      }
    } catch (error) {
      console.error('Failed to fetch consent status:', error);
    }
  };

  const toggleModule = (moduleName: string) => {
    setSelectedModules(prev => {
      const module = CONSENT_MODULES.find(m => m.name === moduleName);
      if (module?.required) {
        return prev; // Cannot deselect required modules
      }
      if (prev.includes(moduleName)) {
        return prev.filter(m => m !== moduleName);
      }
      return [...prev, moduleName];
    });
  };

  const handleContinue = async () => {
    if (!connectionId) return;
    
    setLoading(true);
    try {
      // Use incremental consent endpoint
      const requestBody = {
        connectionId,
        modules: selectedModules,
        assessmentType,
      };
      const response = await api.post('/tenants/consent/incremental', requestBody);

      if (response.data.data?.requiresConsent && response.data.data.authUrl) {
        // Store selected modules for the OAuth flow
        sessionStorage.setItem('consentedModules', JSON.stringify(selectedModules));
        if (assessmentType) {
          sessionStorage.setItem('pendingAssessmentType', assessmentType);
        }
        window.location.href = response.data.data.authUrl;
      } else if (response.data.data?.requiresConsent === false) {
        // All modules already consented, proceed to assessment or dashboard
        if (assessmentType) {
          router.push(`/assessment/${assessmentType}?connectionId=${connectionId}`);
        } else {
          router.push('/');
        }
      }
    } catch (error) {
      console.error('Failed to initiate consent:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModuleStatus = (moduleName: string) => {
    return consentStatus[moduleName] || { consented: false, missingScopes: [], connectorType: 'graph' };
  };

  const selectedCount = selectedModules.length;
  const totalCount = CONSENT_MODULES.length;
  const alreadyConsentedCount = CONSENT_MODULES.filter(m => getModuleStatus(m.name).consented).length;
  const newScopesCount = selectedModules.reduce((count, moduleName) => {
    return count + getModuleStatus(moduleName).missingScopes.length;
  }, 0);

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-primary-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Permission Consent</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Before connecting your tenant, please review the permissions we request. We only need read-only access to assess your security posture.
          </p>
        </div>

        {/* Incremental consent info banner */}
        {isIncremental && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">Incremental Consent</h3>
                <p className="text-sm text-blue-700 mt-1">
                  You have already granted some permissions. We will only request the <strong>{newScopesCount} new permission{newScopesCount !== 1 ? 's' : ''}</strong> needed{assessmentType ? ` for the ${assessmentType === 'detailed' ? 'Detailed' : 'Quick'} Assessment` : ''}. Previously granted permissions remain active.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Read-only confirmation banner */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
          <div className="flex items-start">
            <Lock className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-green-800">Read-Only Access Only</h3>
              <p className="text-sm text-green-700 mt-1">
                We request <strong>read-only</strong> permissions only. We will never modify, delete, or send data from your tenant. All access is limited to security assessment purposes.
              </p>
            </div>
          </div>
        </div>

        {/* Module selection */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Select Assessment Modules</h2>
            <div className="flex items-center gap-4 text-sm">
              {isIncremental && (
                <span className="text-blue-600">
                  {alreadyConsentedCount} of {totalCount} already consented
                </span>
              )}
              <span className="text-gray-600">
                {selectedCount} of {totalCount} selected
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {CONSENT_MODULES.map((module) => {
              const Icon = module.icon;
              const isSelected = selectedModules.includes(module.name);
              const status = getModuleStatus(module.name);
              const isAlreadyConsented = status.consented;
              const hasNewScopes = status.missingScopes.length > 0;
              
              return (
                <div
                  key={module.name}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${isAlreadyConsented && !hasNewScopes ? 'opacity-75' : ''}`}
                  onClick={() => toggleModule(module.name)}
                >
                  <div className="flex items-start">
                    <div className={`p-2 rounded-lg mr-4 ${
                      isSelected ? 'bg-primary-100' : 'bg-gray-100'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        isSelected ? 'text-primary-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-gray-900">{module.name}</h3>
                            {isAlreadyConsented && !hasNewScopes && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                Already Consented
                              </span>
                            )}
                            {module.connectorType === 'powershell' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                                PowerShell
                              </span>
                            )}
                            {module.required && (
                              <span className="text-xs text-gray-500">Required</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{module.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-primary-600 border-primary-600'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">{module.plainEnglishDescription}</p>
                      
                      {/* Scopes display */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {module.scopes.map((scope) => {
                          const isNew = !isAlreadyConsented;
                          return (
                            <span
                              key={scope}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                isNew
                                  ? 'bg-primary-100 text-primary-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {scope}
                              {isNew && <span className="ml-1 text-primary-500">*</span>}
                            </span>
                          );
                        })}
                        {module.scopes.length === 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                            No Graph scopes — requires PowerShell connector
                          </span>
                        )}
                      </div>

                      {/* Status message */}
                      {isAlreadyConsented && !hasNewScopes && (
                        <p className="text-xs text-green-600 mt-2 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          All permissions already granted
                        </p>
                      )}
                      {hasNewScopes && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center">
                          <Info className="w-3 h-3 mr-1" />
                          {status.missingScopes.length} new permission{status.missingScopes.length !== 1 ? 's' : ''} needed
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/connect-tenant')}
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            Back
          </button>
          <div className="flex items-center gap-4">
            {isIncremental && (
              <span className="text-sm text-gray-500">
                {newScopesCount} new permission{newScopesCount !== 1 ? 's' : ''} to grant
              </span>
            )}
            <button
              onClick={handleContinue}
              disabled={loading || selectedCount === 0}
              className="bg-primary-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : isIncremental ? (
                <>
                  Grant New Permissions
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Continue to Microsoft Consent
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Help text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help? <button className="text-primary-600 hover:text-primary-700 font-medium">Contact Support</button>
          </p>
        </div>
      </div>
    </div>
  );
}
