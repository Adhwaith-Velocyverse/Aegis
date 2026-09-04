'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, LayoutDashboard, ClipboardList, Users, FileText, History, Settings, ChevronDown, User, LogOut, HelpCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  activePaths?: string[];
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="w-5 h-5" />, activePaths: ['/'] },
  { label: 'Assessments', href: '/assessments', icon: <ClipboardList className="w-5 h-5" />, activePaths: ['/assessments', '/assessment/quick', '/assessment/detailed', '/trial'] },
  { label: 'Tenants', href: '/tenants', icon: <Users className="w-5 h-5" />, activePaths: ['/tenants', '/tenant-verification', '/connect-tenant'] },
  { label: 'Reports', href: '/reports', icon: <FileText className="w-5 h-5" />, activePaths: ['/reports', '/results'] },
  { label: 'History', href: '/history', icon: <History className="w-5 h-5" />, activePaths: ['/history'] },
  {
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    activePaths: ['/account', '/mfa', '/organization'],
    children: [
      { label: 'Account Settings', href: '/account' },
      { label: 'MFA Settings', href: '/mfa' },
      { label: 'Organization', href: '/organization' },
    ],
  },
  { label: 'Support', href: '/user-guide', icon: <HelpCircle className="w-5 h-5" />, activePaths: ['/user-guide'] },
];

export default function AppSidebar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const isActive = (item: NavItem): boolean => {
    if (item.activePaths) {
      return item.activePaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
    }
    return false;
  };

  const handleNav = (href?: string) => {
    if (href) router.push(href);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-30">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <Shield className="w-8 h-8 text-primary-600 mr-3" />
        <span className="text-xl font-bold text-gray-900">Aegis</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          if (item.children) {
            const active = isActive(item);
            return (
              <div key={item.label} className="relative">
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active || item.activePaths?.some((p) => pathname.startsWith(p))
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center">
                    <span className="mr-3">{item.icon}</span>
                    {item.label}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                </button>
                {(active || item.activePaths?.some((p) => pathname.startsWith(p))) && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-r-full" />
                )}
                {settingsOpen && (
                  <div className="mt-1 ml-8 space-y-1">
                    {item.children.map((child) => (
                      <button
                        key={child.href}
                        onClick={() => handleNav(child.href)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          pathname === child.href
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          const active = isActive(item);
          return (
            <div key={item.label} className="relative">
              <button
                onClick={() => handleNav(item.href)}
                className={`w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </button>
              {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-r-full" />}
            </div>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-gray-200 p-4">
        <div className="mb-3 px-3 flex items-center">
          <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-medium mr-3 flex-shrink-0">
            {(user?.fullName || 'User').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName || 'User'}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.orgRole || 'Member'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </aside>
  );
}
