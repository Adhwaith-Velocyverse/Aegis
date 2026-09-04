'use client';

import { useRouter } from 'next/navigation';
import { Shield, Settings, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import type { DashboardTenantContext } from '@aegis/shared';

interface TenantContextHeaderProps {
  tenant: DashboardTenantContext;
}

const statusConfig = {
  connected: { color: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500', label: 'Connected' },
  needs_attention: { color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500', label: 'Needs Attention' },
  disconnected: { color: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500', label: 'Disconnected' },
};

export default function TenantContextHeader({ tenant }: TenantContextHeaderProps) {
  const router = useRouter();
  const config = statusConfig[tenant.connectionStatus] || statusConfig.disconnected;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
          <Shield className="w-5 h-5 text-gray-700" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {tenant.tenantName}
            <span className="text-gray-400 font-normal ml-2">Microsoft 365</span>
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
              {config.label}
            </span>
            {tenant.lastAssessedAt && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last assessed {new Date(tenant.lastAssessedAt).toLocaleDateString()}
              </span>
            )}
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
  );
}
