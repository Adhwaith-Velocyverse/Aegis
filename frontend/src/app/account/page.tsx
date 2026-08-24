'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Shield, User, Phone, Mail, Lock, LogOut, Trash2, CreditCard } from 'lucide-react';

type Tab = 'name' | 'phone' | 'email' | 'password' | 'billing' | 'danger';

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<Tab>('name');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhoneNumber(user.phoneNumber || '');
      setEmail(user.email);
    }
  }, [user]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.put('/users/me', { fullName });
      setSuccess('Name updated successfully');
      // Update local storage
      const authStore = useAuthStore.getState();
      if (authStore.user) {
        authStore.login({ ...authStore.user, fullName }, authStore.user.token);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update name');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.put('/users/me', { phoneNumber });
      setSuccess('Phone number updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update phone number');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.put('/users/me', { email });
      setSuccess('Email update initiated. Please check your new email for verification.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await api.put('/users/me/password', {
        currentPassword,
        newPassword,
      });
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    if (!confirm('This will permanently delete all your data. Are you absolutely sure?')) {
      return;
    }

    setLoading(true);

    try {
      const password = prompt('Please enter your password to confirm:') || '';
      await api.delete('/users/me', {
        data: {
          password,
          reason: 'User requested deletion',
        },
      });
      setSuccess('Account deletion scheduled. You have 30 days to cancel this request.');
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete account');
      setLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    setLoading(true);
    try {
      await api.post('/users/me/cancel-deletion');
      setSuccess('Account deletion cancelled successfully');
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel account deletion');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!user) {
    router.push('/');
    return null;
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'name', label: 'Name', icon: <User className="w-4 h-4" /> },
    { id: 'phone', label: 'Phone', icon: <Phone className="w-4 h-4" /> },
    { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
    { id: 'password', label: 'Password', icon: <Lock className="w-4 h-4" /> },
    // Only show billing tab for owners
    ...(user?.orgRole === 'owner' ? [{ id: 'billing' as Tab, label: 'Billing', icon: <CreditCard className="w-4 h-4" /> }] : []),
    { id: 'danger', label: 'Danger Zone', icon: <Trash2 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-5 h-5 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <nav className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600'
                      : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <span className="mr-3">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              {activeTab === 'name' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Name</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Update your display name. This change will be reflected across the platform.
                  </p>
                  <form onSubmit={handleUpdateName} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('name')}
                        className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                      >
                        {loading ? 'Updating...' : 'Update Name'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'phone' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Update Phone Number</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Update your phone number. You may need to verify the new number.
                  </p>
                  <form onSubmit={handleUpdatePhone} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('phone')}
                        className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                      >
                        {loading ? 'Updating...' : 'Update Phone'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'email' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Update Email</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Update your email address. You will need to verify the new email.
                  </p>
                  <form onSubmit={handleUpdateEmail} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('email')}
                        className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                      >
                        {loading ? 'Updating...' : 'Update Email'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'password' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Update your password. You will need to enter your current password to confirm.
                  </p>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                        minLength={8}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                        minLength={8}
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('password')}
                        className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                      >
                        {loading ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'billing' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing & Subscription</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Manage your subscription and billing settings.
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-4">
                      Only organization owners can manage billing settings.
                    </p>
                    <button
                      onClick={() => router.push('/billing')}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
                    >
                      Go to Billing
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'danger' && (
                <div>
                  <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>

                  {/* Cancel Deletion (if scheduled) */}
                  {user?.deletedAt && (
                    <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50 mb-4">
                      <h3 className="text-sm font-medium text-yellow-800 mb-2">Account Deletion Scheduled</h3>
                      <p className="text-sm text-yellow-700 mb-4">
                        Your account is scheduled for deletion on {new Date(user.deletedAt).toLocaleDateString()}.
                        You can cancel this deletion by clicking the button below.
                      </p>
                      <button
                        onClick={handleCancelDeletion}
                        disabled={loading}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50"
                      >
                        Cancel Deletion
                      </button>
                    </div>
                  )}

                  {/* Delete Account */}
                  {!user?.deletedAt && (
                    <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <h3 className="text-sm font-medium text-red-800 mb-2">Delete Account</h3>
                      <p className="text-sm text-red-700 mb-4">
                        This will schedule your account for deletion in 30 days. During this grace period, you can cancel the deletion.
                      </p>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Account
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
