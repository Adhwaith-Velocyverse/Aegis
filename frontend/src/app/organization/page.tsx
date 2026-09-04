'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Organization, OrganizationMember, OrgRole } from '@/../../shared/src/types';
import { Shield, Users, Settings, Plus, Trash2, ChevronDown, LogOut, UserPlus } from 'lucide-react';

export default function OrganizationPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const router = useRouter();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [orgRes, membersRes] = await Promise.all([
        api.get('/organizations/current'),
        api.get('/organizations/members')
      ]);
      setOrg(orgRes.data);
      setMembers(membersRes.data.members);
    } catch (error) {
      console.error('Failed to fetch organization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/organizations/current', {
        name: org?.name,
        industry: org?.industry,
        companySize: org?.companySize
      });
      alert('Organization updated successfully');
    } catch (error) {
      console.error('Failed to update organization:', error);
      alert('Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      await api.post('/organizations/invite', {
        email: inviteEmail,
        fullName: inviteName,
        role: 'client',
        orgRole: inviteRole
      });
      alert('Invitation sent successfully');
      setShowInviteForm(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('member');
      fetchData();
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.delete(`/organizations/members/${userId}`);
      fetchData();
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove member');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: OrgRole) => {
    try {
      await api.put(`/organizations/members/${userId}/role`, { orgRole: newRole });
      fetchData();
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role');
    }
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this organization?')) return;
    try {
      await api.post('/organizations/leave');
      logout();
      router.push('/');
    } catch (error) {
      console.error('Failed to leave organization:', error);
      alert('Failed to leave organization');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No organization found</p>
          <button onClick={() => router.push('/')} className="mt-4 text-primary-600 hover:text-primary-700">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isOwner = user?.orgRole === 'owner';
  const canManageMembers = isOwner || user?.orgRole === 'admin';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Organization Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/')} className="text-gray-600 hover:text-gray-900">
                Dashboard
              </button>
              <button onClick={() => router.push('/account')} className="text-gray-600 hover:text-gray-900">
                Account
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Organization Details */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
              <div className="flex items-center mb-6">
                <Settings className="w-6 h-6 text-gray-400 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">Organization Details</h2>
              </div>
              <form onSubmit={handleUpdateOrg} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                  <input
                    type="text"
                    value={org.name}
                    onChange={(e) => setOrg({ ...org, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={!canManageMembers}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                  <select
                    value={org.industry || ''}
                    onChange={(e) => setOrg({ ...org, industry: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={!canManageMembers}
                  >
                    <option value="">Select Industry</option>
                    <option value="technology">Technology</option>
                    <option value="finance">Finance</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="retail">Retail</option>
                    <option value="education">Education</option>
                    <option value="government">Government</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
                  <select
                    value={org.companySize || ''}
                    onChange={(e) => setOrg({ ...org, companySize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={!canManageMembers}
                  >
                    <option value="">Select Size</option>
                    <option value="1-50">1-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="501-1000">501-1000 employees</option>
                    <option value="1001-5000">1001-5000 employees</option>
                    <option value="5000+">5000+ employees</option>
                  </select>
                </div>
                {canManageMembers && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </form>
            </div>

            {/* Members */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Users className="w-6 h-6 text-gray-400 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Members ({members.length})</h2>
                </div>
                {canManageMembers && (
                  <button
                    onClick={() => setShowInviteForm(!showInviteForm)}
                    className="flex items-center px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Invite
                  </button>
                )}
              </div>

              {/* Invite Form */}
              {showInviteForm && (
                <form onSubmit={handleInvite} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'member' | 'viewer')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      disabled={inviting}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {inviting ? 'Sending...' : 'Send Invitation'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInviteForm(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Members List */}
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{member.fullName}</p>
                      <p className="text-sm text-gray-600">{member.email}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        member.orgRole === 'owner' ? 'bg-purple-100 text-purple-800' :
                        member.orgRole === 'admin' ? 'bg-blue-100 text-blue-800' :
                        member.orgRole === 'member' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {member.orgRole}
                      </span>
                      {canManageMembers && member.orgRole !== 'owner' && (
                        <div className="relative group">
                          <button className="text-gray-400 hover:text-gray-600">
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border py-1 hidden group-hover:block z-10">
                            {['admin', 'member', 'viewer'].map((role) => (
                              <button
                                key={role}
                                onClick={() => handleUpdateRole(member.id, role as OrgRole)}
                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 capitalize"
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {canManageMembers && member.orgRole !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Role</h3>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                user?.orgRole === 'owner' ? 'bg-purple-100 text-purple-800' :
                user?.orgRole === 'admin' ? 'bg-blue-100 text-blue-800' :
                user?.orgRole === 'member' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {user?.orgRole}
              </span>
              <p className="text-sm text-gray-600 mt-2">
                {user?.orgRole === 'owner' && 'Full control over organization settings and members'}
                {user?.orgRole === 'admin' && 'Can manage members and organization settings'}
                {user?.orgRole === 'member' && 'Can view and participate in assessments'}
                {user?.orgRole === 'viewer' && 'Read-only access to assessments and reports'}
              </p>
            </div>

            {isOwner && (
              <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6 mt-6">
                <h3 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h3>
                <p className="text-sm text-red-700 mb-4">
                  Leaving the organization will remove your access to all assessments and data.
                </p>
                <button
                  onClick={handleLeave}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Leave Organization
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
