'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Shield, CreditCard, Check, X, Crown, TrendingUp, Activity,
  Calendar, Download, Receipt, AlertTriangle, Info
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  features: string;
  included_quick_credits: number;
  included_detailed_credits: number;
  seat_limit: number;
  description?: string;
}

interface Subscription {
  id: string;
  plan_name: string;
  price_monthly: number;
  features: string;
  billing_status: string;
  current_period_start: string;
  current_period_end: string;
  included_quick_credits: number;
  included_detailed_credits: number;
}

interface UsageEntry {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'usage' | 'invoices'>('overview');
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    if (user.orgRole !== 'owner') {
      router.push('/');
      return;
    }

    fetchPlans();
    fetchSubscription();
    fetchUsage();
  }, [user, router]);

  const fetchPlans = async () => {
    try {
      const response = await api.get('/billing/plans');
      setPlans(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch plans');
    }
  };

  const fetchSubscription = async () => {
    try {
      const response = await api.get('/billing/subscription');
      setSubscription(response.data.data);
    } catch (err: any) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    try {
      const response = await api.get('/billing/usage?limit=20');
      setUsage(response.data.data);
    } catch (err: any) {
      console.error('Failed to fetch usage:', err);
    }
  };

  const handleUpgrade = async (planId: string) => {
    setUpgrading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/billing/upgrade', { planId });
      setSuccess('Subscription updated successfully');
      fetchSubscription();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update subscription');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) {
      return;
    }

    setUpgrading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/billing/cancel');
      setSuccess('Subscription canceled successfully');
      fetchSubscription();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel subscription');
    } finally {
      setUpgrading(false);
    }
  };

  const getFeatures = (featuresJson: string) => {
    try {
      return JSON.parse(featuresJson || '{}');
    } catch {
      return {};
    }
  };

  const calculateUsagePercentage = (used: number, total: number) => {
    if (total === 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Billing & Subscription</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                Dashboard
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

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'overview'
                    ? 'border-b-2 border-primary-500 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CreditCard className="w-4 h-4 inline mr-2" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('usage')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'usage'
                    ? 'border-b-2 border-primary-500 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Usage
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'invoices'
                    ? 'border-b-2 border-primary-500 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Receipt className="w-4 h-4 inline mr-2" />
                Invoices
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <>
                {/* Current Subscription */}
                {subscription && (
                  <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-6 mb-8 border border-primary-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center mb-2">
                          <Crown className="w-6 h-6 text-yellow-500 mr-2" />
                          <span className="text-2xl font-bold text-gray-900">{subscription.plan_name}</span>
                          <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                            subscription.billing_status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {subscription.billing_status}
                          </span>
                        </div>
                        <p className="text-gray-600">
                          ${subscription.price_monthly}/month
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Renews on {new Date(subscription.current_period_end).toLocaleDateString()}
                        </p>
                      </div>
                      {subscription.billing_status === 'active' && (
                        <button
                          onClick={handleCancel}
                          disabled={upgrading}
                          className="px-4 py-2 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50"
                        >
                          Cancel Subscription
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Available Plans */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">Available Plans</h2>
                  <div className="grid md:grid-cols-3 gap-6">
                    {plans.map((plan) => {
                      const features = getFeatures(plan.features);
                      const isCurrentPlan = subscription?.plan_name === plan.name;

                      return (
                        <div
                          key={plan.id}
                          className={`border rounded-xl p-6 ${
                            isCurrentPlan
                              ? 'border-primary-500 ring-2 ring-primary-200'
                              : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                            {isCurrentPlan && (
                              <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                                Current
                              </span>
                            )}
                          </div>

                          <div className="mb-4">
                            <span className="text-3xl font-bold text-gray-900">${plan.price_monthly}</span>
                            <span className="text-gray-600">/month</span>
                          </div>

                          <div className="space-y-2 mb-6">
                            <div className="flex items-center text-sm text-gray-600">
                              <Check className="w-4 h-4 text-green-500 mr-2" />
                              {plan.included_quick_credits} Quick assessments
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <Check className="w-4 h-4 text-green-500 mr-2" />
                              {plan.included_detailed_credits} Detailed assessments
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <Check className="w-4 h-4 text-green-500 mr-2" />
                              {plan.seat_limit} team members
                            </div>
                            {features.trial && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Check className="w-4 h-4 text-green-500 mr-2" />
                                Trial assessment
                              </div>
                            )}
                            {features.quick && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Check className="w-4 h-4 text-green-500 mr-2" />
                                Quick assessment
                              </div>
                            )}
                            {features.detailed && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Check className="w-4 h-4 text-green-500 mr-2" />
                                Detailed assessment
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={upgrading || isCurrentPlan}
                            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                              isCurrentPlan
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50'
                            }`}
                          >
                            {isCurrentPlan ? 'Current Plan' : upgrading ? 'Updating...' : 'Upgrade'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'usage' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Usage History</h2>
                {subscription && (
                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500">Quick Assessments</h3>
                        <TrendingUp className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {usage.filter(u => u.description.includes('quick')).length}
                          </p>
                          <p className="text-sm text-gray-500">of {subscription.included_quick_credits} used</p>
                        </div>
                        <div className="w-24 h-24 relative">
                          <svg className="w-24 h-24 transform -rotate-90">
                            <circle
                              cx="48"
                              cy="48"
                              r="40"
                              stroke="#e5e7eb"
                              strokeWidth="8"
                              fill="none"
                            />
                            <circle
                              cx="48"
                              cy="48"
                              r="40"
                              stroke="#3b82f6"
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={`${calculateUsagePercentage(usage.filter(u => u.description.includes('quick')).length, subscription.included_quick_credits) * 2.51} 251`}
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500">Detailed Assessments</h3>
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {usage.filter(u => u.description.includes('detailed')).length}
                          </p>
                          <p className="text-sm text-gray-500">of {subscription.included_detailed_credits} used</p>
                        </div>
                        <div className="w-24 h-24 relative">
                          <svg className="w-24 h-24 transform -rotate-90">
                            <circle
                              cx="48"
                              cy="48"
                              r="40"
                              stroke="#e5e7eb"
                              strokeWidth="8"
                              fill="none"
                            />
                            <circle
                              cx="48"
                              cy="48"
                              r="40"
                              stroke="#a855f7"
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={`${calculateUsagePercentage(usage.filter(u => u.description.includes('detailed')).length, subscription.included_detailed_credits) * 2.51} 251`}
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900">Recent Usage</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {usage.map((entry) => (
                      <div key={entry.id} className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                          <p className="text-xs text-gray-500">{new Date(entry.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`text-sm font-medium ${
                          entry.type === 'credit_consumption' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {entry.type === 'credit_consumption' ? '-' : '+'}{entry.amount}
                        </span>
                      </div>
                    ))}
                    {usage.length === 0 && (
                      <div className="px-6 py-8 text-center text-gray-500">
                        No usage recorded yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'invoices' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Invoices</h2>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">Billing History</h3>
                    <button className="flex items-center text-sm text-primary-600 hover:text-primary-700">
                      <Download className="w-4 h-4 mr-1" />
                      Export All
                    </button>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {usage.filter(u => u.type === 'credit_grant').map((entry) => (
                      <div key={entry.id} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="p-2 bg-green-100 rounded-lg mr-4">
                            <Receipt className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                            <p className="text-xs text-gray-500">{new Date(entry.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-green-600">+{entry.amount} credits</span>
                          <button className="text-gray-400 hover:text-gray-600">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {usage.filter(u => u.type === 'credit_grant').length === 0 && (
                      <div className="px-6 py-8 text-center text-gray-500">
                        No invoices yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
