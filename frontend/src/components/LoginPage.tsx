'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Shield, Mail, Lock, User, Building2, Users, Phone, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaSent, setMfaSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);

  // Handle OAuth callback
  useEffect(() => {
    const oauthError = searchParams.get('error');
    const oauthProvider = searchParams.get('provider');
    const oauthToken = searchParams.get('token');

    if (oauthError) {
      setError(`OAuth login failed: ${oauthError}`);
      return;
    }

    if (oauthToken && oauthProvider) {
      // Clear URL params
      router.replace('/');
      
      // Exchange token for session
      api.post('/auth/oauth', { provider: oauthProvider, token: oauthToken })
        .then(response => {
          const user = response.data.data.user;
          login(user, response.data.data.token);
          
          if (user.platformRole === 'admin') {
            router.push('/admin/dashboard');
          } else if (user.platformRole === 'assessor') {
            router.push('/assessor/dashboard');
          } else {
            router.push('/');
          }
        })
        .catch(err => {
          setError(err.response?.data?.error || 'OAuth login failed');
        });
    }
  }, [searchParams, router, login]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        // Validate terms acceptance
        if (!tosAccepted) {
          setError('Please accept the Terms of Service and Privacy Policy');
          setLoading(false);
          return;
        }

        const response = await api.post('/auth/signup', {
          fullName,
          email,
          password,
          companyName,
          companySize,
          phoneNumber: `${countryCode}${phoneNumber}`,
        });
        login(response.data.data.user, response.data.data.token);
        
        // Redirect to MFA setup after signup
        router.push('/mfa-setup');
      } else {
        const response = await api.post('/auth/login', {
          email,
          password,
          rememberMe,
        });
        const user = response.data.data.user;

        // Check if MFA is required
        if (response.data.data.mfaRequired) {
          setMfaRequired(true);
          setLoading(false);
          return;
        }

        login(user, response.data.data.token);

        // Redirect based on role
        if (user.platformRole === 'admin') {
          router.push('/admin/dashboard');
        } else if (user.platformRole === 'assessor') {
          router.push('/assessor/dashboard');
        } else {
          router.push('/');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/login/mfa', {
        email,
        mfaToken,
      });
      const user = response.data.data.user;
      const token = response.data.data.token;
      console.log('[LoginPage] MFA success, token received:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
      login(user, token);
      console.log('[LoginPage] Auth store after login:', useAuthStore.getState());

      if (user.platformRole === 'admin') {
        router.push('/admin/dashboard');
      } else if (user.platformRole === 'assessor') {
        router.push('/assessor/dashboard');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      console.error('[LoginPage] MFA error:', err);
      setError(err.response?.data?.error || 'Invalid MFA code');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMfaOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/login/mfa/request', {
        email,
      });
      setMfaSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  if (mfaRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <Shield className="w-12 h-12 text-primary-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h1>
              <p className="text-gray-600 mt-2">
                {mfaSent ? 'Enter the 6-digit code sent to your email' : 'Send a verification code to your email'}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {!mfaSent ? (
              <button
                onClick={handleSendMfaOtp}
                disabled={loading}
                className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            ) : (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                  <input
                    type="text"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl tracking-widest"
                    required
                    maxLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || mfaToken.length !== 6}
                  className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Shield className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900">Aegis</h1>
            <p className="text-gray-600 mt-2">M365 Security Assessment Platform</p>
          </div>

          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => setIsSignup(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                !isSignup ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => setIsSignup(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isSignup ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <div className="relative">
                    <Building2 className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
                  <div className="relative">
                    <Users className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                    <select
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select company size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="501-1000">501-1000 employees</option>
                      <option value="1000+">1000+ employees</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <div className="flex space-x-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-24 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="+1">+1</option>
                      <option value="+44">+44</option>
                      <option value="+91">+91</option>
                      <option value="+61">+61</option>
                      <option value="+49">+49</option>
                      <option value="+33">+33</option>
                      <option value="+81">+81</option>
                      <option value="+86">+86</option>
                    </select>
                    <div className="relative flex-1">
                      <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="5550000000"
                        maxLength={10}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="tos"
                    checked={tosAccepted}
                    onChange={(e) => setTosAccepted(e.target.checked)}
                    className="mt-1 mr-2"
                    required
                  />
                  <label htmlFor="tos" className="text-sm text-gray-600">
                    I agree to the <a href="#" className="text-primary-600 hover:underline">Terms of Service</a> and <a href="#" className="text-primary-600 hover:underline">Privacy Policy</a>
                  </label>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              {isSignup && (
                <div className="flex items-start mt-1">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 mr-1 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-600">Kindly enter your tenant's mail id</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                  minLength={8}
                />
              </div>
              {isSignup && (
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters with uppercase, lowercase, number, and special character</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Log In'}
            </button>
          </form>

          {!isSignup && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>
              <button
                onClick={() => router.push('/forgot-password')}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Forgot password?
              </button>
            </div>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  // Google OAuth - redirect to backend which handles the OAuth flow
                  const redirectUri = encodeURIComponent(window.location.origin + '/');
                  window.location.href = `/api/auth/oauth/google?redirect_uri=${redirectUri}`;
                }}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.03 2.53-2.16 3.31v2.77h3.49c2.04-1.88 3.24-4.64 3.24-7.89z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.49-2.77c-.98.66-2.23 1.06-3.79 1.06-2.91 0-5.37-1.96-6.25-4.63H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.75 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.72-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.64 0 3.11.56 4.27 1.67l3.2-3.2C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.57 2.77c.88-2.67 3.34-4.63 6.25-4.63z"/>
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => {
                  // Microsoft OAuth - redirect to backend which handles the OAuth flow
                  const redirectUri = encodeURIComponent(window.location.origin + '/');
                  window.location.href = `/api/auth/oauth/microsoft?redirect_uri=${redirectUri}`;
                }}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                </svg>
                Microsoft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
