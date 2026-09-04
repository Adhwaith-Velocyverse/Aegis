'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Shield, ClipboardList, CheckCircle2, KeyRound, Play, MoreVertical, ChevronDown, LogOut, LayoutDashboard, FileText, Settings, History, User } from 'lucide-react';

interface AssignedRequest {
  id: string;
  clientName: string;
  tenantName: string;
  type: string;
  requestedOn: string;
  status: string;
  dueDate?: string;
  completedOn?: string;
}

export default function AssessorDashboard() {
  const [assigned, setAssigned] = useState<AssignedRequest[]>([]);
  const [completed, setCompleted] = useState<AssignedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const router = useRouter();
  const { user, logout, isAuthenticated, isLoading } = useAuthStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait for auth state to load before fetching
    if (isLoading) return;
    
    // Only fetch data if user is authenticated
    if (isAuthenticated && user) {
      fetchData();
    }
  }, [isAuthenticated, isLoading, user]);

  const fetchData = async () => {
    try {
      const response = await api.get('/assessor/dashboard');
      setAssigned(response.data.data.assigned);
      setCompleted(response.data.data.completed);
    } catch (error) {
      console.error('Failed to fetch assessor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
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
              <Shield className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Aegis Assessor</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.fullName}</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full capitalize">
                Assessor
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
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      MFA Settings
                    </button>
                    <button
                      onClick={() => { setShowAccountMenu(false); router.push('/organization'); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Organization
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => { setShowAccountMenu(false); handleLogout(); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex">
          {/* Left Navigation */}
          <nav className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border p-4 sticky top-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Navigation</h2>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => router.push('/assessor/dashboard')}
                    className="w-full flex items-center px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg"
                  >
                    <LayoutDashboard className="w-5 h-5 mr-3" />
                    Dashboard
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => router.push('/assessor/assessment')}
                    className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    <ClipboardList className="w-5 h-5 mr-3" />
                    Assessments
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => router.push('/history')}
                    className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    <History className="w-5 h-5 mr-3" />
                    History
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => router.push('/account')}
                    className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    <Settings className="w-5 h-5 mr-3" />
                    Settings
                  </button>
                </li>
              </ul>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 ml-8 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-primary-100 rounded-lg mr-4">
                <ClipboardList className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Assigned Requests</p>
                <p className="text-2xl font-bold text-gray-900">{assigned.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg mr-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed Requests</p>
                <p className="text-2xl font-bold text-gray-900">{completed.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg mr-4">
                <KeyRound className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Change Password</p>
                <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Requests */}
        <div className="bg-white rounded-xl shadow-sm border mb-8">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Assigned Assessment Requests</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested On</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assigned.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {request.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.clientName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{request.tenantName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                        {request.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(request.requestedOn).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        request.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                        request.status === 'in_review' ? 'bg-purple-100 text-purple-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {request.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {request.dueDate ? new Date(request.dueDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => router.push(`/assessor/assessment/${request.id}`)}
                        className="text-primary-600 hover:text-primary-700 font-medium flex items-center"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start Assessment
                      </button>
                    </td>
                  </tr>
                ))}
                {assigned.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      No assigned requests
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Completed Requests */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Completed Assessment Requests</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed On</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {completed.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {request.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.clientName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                        {request.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {request.completedOn ? new Date(request.completedOn).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-gray-600 hover:text-gray-900">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {completed.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No completed requests
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          </main>
        </div>
      </div>
    </div>
  );
}
