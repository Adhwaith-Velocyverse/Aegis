'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Shield, Users, ClipboardList, KeyRound, Plus, MoreVertical, ChevronDown,
  LogOut, LayoutDashboard, FileText, Settings, History, Building2,
  CreditCard, Search, Filter, Eye, Edit2, Trash2, CheckCircle2, XCircle,
  AlertTriangle, Mail, Phone, Calendar, TrendingUp, Activity, UserCheck,
  ShieldCheck, User
} from 'lucide-react';

interface Assessor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  addedOn?: string;
}

interface DetailedRequest {
  id: string;
  clientName: string;
  tenantName: string;
  type: string;
  requestedOn: string;
  status: string;
  assessorName?: string;
  overallScore?: number;
}

interface Organization {
  id: string;
  name: string;
  industry?: string;
  companySize?: string;
  memberCount: number;
  createdAt: string;
}

interface Subscription {
  id: string;
  planName: string;
  billingStatus: string;
  currentPeriodEnd: string;
  includedQuickCredits: number;
  includedDetailedCredits: number;
}

interface PlatformUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  platformRole: string;
  orgRole: string;
  organizationName?: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
}

type AdminTab = 'dashboard' | 'requests' | 'assessors' | 'users' | 'organizations' | 'subscriptions';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [activeRequests, setActiveRequests] = useState(0);
  const [assessors, setAssessors] = useState<Assessor[]>([]);
  const [requests, setRequests] = useState<DetailedRequest[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showAddAssessorModal, setShowAddAssessorModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [newAssessor, setNewAssessor] = useState({ name: '', email: '', phone: '' });
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    password: '',
    platformRole: 'client',
    orgRole: 'member',
    phoneNumber: '',
    organizationId: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const router = useRouter();
  const { user: currentUser, logout, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait for auth state to load before fetching
    if (authLoading) return;
    
    // Only fetch data if user is authenticated
    if (isAuthenticated && currentUser) {
      fetchData();
    }
  }, [activeTab, isAuthenticated, authLoading, currentUser]);

  const fetchData = async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'dashboard':
        case 'requests':
          const [dashboardRes, requestsRes] = await Promise.all([
            api.get('/admin/dashboard'),
            api.get('/admin/requests'),
          ]);
          setActiveRequests(dashboardRes.data.data.activeRequests);
          setRequests(requestsRes.data.data);
          break;
        case 'assessors':
          const assessorsRes = await api.get('/admin/assessors');
          setAssessors(assessorsRes.data.data);
          break;
        case 'users':
          const usersRes = await api.get('/admin/users');
          setUsers(usersRes.data.data);
          break;
        case 'organizations':
          const orgsRes = await api.get('/admin/organizations');
          setOrganizations(orgsRes.data.data);
          break;
        case 'subscriptions':
          const subsRes = await api.get('/admin/subscriptions');
          setSubscriptions(subsRes.data.data);
          break;
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleAddAssessor = async () => {
    try {
      await api.post('/admin/assessors', newAssessor);
      setShowAddAssessorModal(false);
      setNewAssessor({ name: '', email: '', phone: '' });
      fetchData();
    } catch (error) {
      console.error('Failed to add assessor:', error);
      alert('Failed to add assessor');
    }
  };

  const handleDeleteAssessor = async (id: string) => {
    if (!confirm('Are you sure you want to remove this assessor?')) return;
    try {
      await api.delete(`/admin/assessors/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to remove assessor:', error);
    }
  };

  const handleAssignAssessor = async (requestId: string, assessorId: string) => {
    try {
      await api.post(`/admin/requests/${requestId}/assign`, { assessorId });
      fetchData();
    } catch (error) {
      console.error('Failed to assign assessor:', error);
    }
  };

  const handleAddUser = async () => {
    try {
      await api.post('/admin/users', newUser);
      setShowAddUserModal(false);
      setNewUser({
        fullName: '',
        email: '',
        password: '',
        platformRole: 'client',
        orgRole: 'member',
        phoneNumber: '',
        organizationId: '',
      });
      fetchData();
    } catch (error: any) {
      console.error('Failed to add user:', error);
      alert(error.response?.data?.error || 'Failed to add user');
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    try {
      await api.put(`/admin/users/${editingUser.id}`, editingUser);
      setShowEditUserModal(false);
      setEditingUser(null);
      fetchData();
    } catch (error: any) {
      console.error('Failed to update user:', error);
      alert(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      fetchData();
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      alert(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const openEditUserModal = (user: PlatformUser) => {
    setEditingUser({ ...user });
    setShowEditUserModal(true);
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

  if (loading && activeTab === 'dashboard') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const filteredRequests = requests.filter(r =>
    r.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Aegis Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {currentUser?.fullName}</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full capitalize">
                {currentUser?.orgRole || 'Admin'}
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
                    onClick={() => setActiveTab('dashboard')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                      activeTab === 'dashboard' ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5 mr-3" />
                    Dashboard
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                      activeTab === 'requests' ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className="w-5 h-5 mr-3" />
                    Assessment Requests
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('assessors')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                      activeTab === 'assessors' ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Users className="w-5 h-5 mr-3" />
                    Assessors
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                      activeTab === 'users' ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <UserCheck className="w-5 h-5 mr-3" />
                    Users
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('organizations')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                      activeTab === 'organizations' ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Building2 className="w-5 h-5 mr-3" />
                    Organizations
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('subscriptions')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                      activeTab === 'subscriptions' ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 mr-3" />
                    Subscriptions
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
            {activeTab === 'dashboard' && (
              <>
                {/* Stats */}
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-primary-100 rounded-lg mr-4">
                        <ClipboardList className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Active Requests</p>
                        <p className="text-2xl font-bold text-gray-900">{activeRequests}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-green-100 rounded-lg mr-4">
                        <Users className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Assessors</p>
                        <p className="text-2xl font-bold text-gray-900">{assessors.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-100 rounded-lg mr-4">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Organizations</p>
                        <p className="text-2xl font-bold text-gray-900">{organizations.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-purple-100 rounded-lg mr-4">
                        <Activity className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Platform Health</p>
                        <p className="text-2xl font-bold text-green-600">98%</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border mb-8">
                  <div className="p-6 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {requests.slice(0, 5).map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="p-2 bg-primary-100 rounded-lg mr-4">
                              <ClipboardList className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                New {request.type} assessment request from {request.clientName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(request.requestedOn).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            request.status === 'unassigned' ? 'bg-yellow-100 text-yellow-800' :
                            request.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                            request.status === 'in_review' ? 'bg-purple-100 text-purple-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {request.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                      {requests.length === 0 && (
                        <p className="text-center text-gray-500 py-4">No recent activity</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'requests' && (
              <div className="bg-white rounded-xl shadow-sm border mb-8">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Assessment Requests</h2>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search requests..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredRequests.map((request) => (
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {request.overallScore !== undefined ? `${request.overallScore}/100` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              request.status === 'unassigned' ? 'bg-yellow-100 text-yellow-800' :
                              request.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                              request.status === 'in_review' ? 'bg-purple-100 text-purple-800' :
                              request.status === 'completed' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {request.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {request.assessorName || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center space-x-2">
                              {request.status === 'unassigned' && (
                                <select
                                  onChange={(e) => handleAssignAssessor(request.id, e.target.value)}
                                  className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                                  defaultValue=""
                                >
                                  <option value="" disabled>Assign Assessor</option>
                                  {assessors.filter(a => a.status === 'active').map(assessor => (
                                    <option key={assessor.id} value={assessor.id}>{assessor.name}</option>
                                  ))}
                                </select>
                              )}
                              <button className="text-gray-600 hover:text-gray-900">
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredRequests.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                            No requests found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'assessors' && (
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">Assessors</h2>
                  <button
                    onClick={() => setShowAddAssessorModal(true)}
                    className="bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Assessor
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added On</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {assessors.map((assessor) => (
                        <tr key={assessor.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{assessor.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{assessor.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{assessor.phone || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              assessor.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {assessor.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {assessor.addedOn ? new Date(assessor.addedOn).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleDeleteAssessor(assessor.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {assessors.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            No assessors added yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add User
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Org Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MFA</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users
                        .filter((u) =>
                          u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                        )
                        .map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.fullName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.phoneNumber || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              u.platformRole === 'admin' ? 'bg-purple-100 text-purple-800' :
                              u.platformRole === 'assessor' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {u.platformRole}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{u.orgRole}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.organizationName || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {u.mfaEnabled ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-400" />
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => openEditUserModal(u)}
                                className="text-primary-600 hover:text-primary-700"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                            No users found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'organizations' && (
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">Organizations</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Industry</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Members</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {organizations.map((org) => (
                        <tr key={org.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{org.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{org.industry || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{org.companySize || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{org.memberCount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(org.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button className="text-primary-600 hover:text-primary-700 font-medium">
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                      {organizations.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            No organizations found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'subscriptions' && (
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">Subscriptions</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period End</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quick Credits</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detailed Credits</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {subscriptions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.planName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sub.planName}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              sub.billingStatus === 'active' ? 'bg-green-100 text-green-800' :
                              sub.billingStatus === 'past_due' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {sub.billingStatus.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sub.includedQuickCredits}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sub.includedDetailedCredits}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button className="text-primary-600 hover:text-primary-700 font-medium">
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                      {subscriptions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                            No subscriptions found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Add Assessor Modal */}
      {showAddAssessorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Assessor</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newAssessor.name}
                  onChange={(e) => setNewAssessor({ ...newAssessor, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newAssessor.email}
                  onChange={(e) => setNewAssessor({ ...newAssessor, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
                <input
                  type="tel"
                  value={newAssessor.phone}
                  onChange={(e) => setNewAssessor({ ...newAssessor, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddAssessorModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAssessor}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Add Assessor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Min 8 characters"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform Role</label>
                  <select
                    value={newUser.platformRole}
                    onChange={(e) => setNewUser({ ...newUser, platformRole: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                    <option value="assessor">Assessor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Org Role</label>
                  <select
                    value={newUser.orgRole}
                    onChange={(e) => setNewUser({ ...newUser, orgRole: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
                <input
                  type="tel"
                  value={newUser.phoneNumber}
                  onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddUserModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform Role</label>
                  <select
                    value={editingUser.platformRole}
                    onChange={(e) => setEditingUser({ ...editingUser, platformRole: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                    <option value="assessor">Assessor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Org Role</label>
                  <select
                    value={editingUser.orgRole}
                    onChange={(e) => setEditingUser({ ...editingUser, orgRole: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editingUser.phoneNumber || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phoneNumber: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mfaEnabled"
                  checked={editingUser.mfaEnabled}
                  onChange={(e) => setEditingUser({ ...editingUser, mfaEnabled: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="mfaEnabled" className="ml-2 block text-sm text-gray-900">
                  MFA Enabled
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => { setShowEditUserModal(false); setEditingUser(null); }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEditUser}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
