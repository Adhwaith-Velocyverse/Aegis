'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Shield, Mail, Smartphone, ArrowLeft } from 'lucide-react';

type MFAMethod = 'email' | 'sms';

export default function MFAPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [method, setMethod] = useState<MFAMethod>('email');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const router = useRouter();
  const { user, login } = useAuthStore();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    // Check MFA status
    checkMFAStatus();
  }, [user]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const checkMFAStatus = async () => {
    try {
      const response = await api.get('/mfa/status');
      if (response.data.data.mfaEnabled) {
        setMfaEnabled(true);
      }
    } catch (error) {
      console.error('Failed to check MFA status:', error);
    }
  };

  const handleSendOTP = async () => {
    if (!destination) {
      setError(`Please enter your ${method === 'email' ? 'email' : 'phone number'}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/mfa/setup', {
        method,
        destination,
      });

      setCountdown(60);
      setOtpSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setLoading(true);
    setError('');

    try {
      await api.post('/mfa/resend');
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/mfa/verify', { code });

      if (response.data.success) {
        // MFA verified - update auth store with new token and redirect to dashboard
        if (response.data.data?.token && response.data.data?.user) {
          login(response.data.data.user, response.data.data.token);
        }
        router.push('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid OTP');
      // Clear OTP inputs on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (index === 5 && value && newOtp.every(digit => digit !== '')) {
      handleVerify();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];

    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }

    setOtp(newOtp);

    // Focus last filled input or last input
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();

    // Auto-submit if all 6 digits pasted
    if (pastedData.length === 6) {
      setTimeout(() => handleVerify(), 100);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Shield className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Multi-Factor Authentication</h1>
            <p className="text-gray-600 mt-2">
              {mfaEnabled ? 'Verify your identity' : 'Set up multi-factor authentication'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!mfaEnabled ? (
            // MFA Setup Flow
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Method
                </label>
                <div className="flex rounded-lg border border-gray-200 p-1">
                  <button
                    type="button"
                    onClick={() => setMethod('email')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center ${
                      method === 'email'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('sms')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center ${
                      method === 'sms'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    SMS
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {method === 'email' ? 'Email Address' : 'Phone Number'}
                </label>
                <input
                  type={method === 'email' ? 'email' : 'tel'}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={method === 'email' ? user?.email || '' : '+1 (555) 000-0000'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  We'll send a 6-digit code to this {method === 'email' ? 'email' : 'phone number'}
                </p>
              </div>

              {!otpSent ? (
                <button
                  onClick={handleSendOTP}
                  disabled={loading || countdown > 0}
                  className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Send OTP'}
                </button>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      Enter the 6-digit code sent to your {method === 'email' ? 'email' : 'phone'}
                    </p>
                    {destination && (
                      <p className="text-sm font-medium text-gray-900">
                        {method === 'email' ? destination : `+1 ***-***-${destination.slice(-4)}`}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-center gap-2">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={index === 0 ? handlePaste : undefined}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleVerify}
                    disabled={loading || otp.some(d => d === '')}
                    className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Verifying...' : 'Verify & Enable MFA'}
                  </button>

                  <div className="text-center">
                    <button
                      onClick={handleResendOTP}
                      disabled={countdown > 0 || loading}
                      className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            // MFA Verification Flow
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Enter the 6-digit code sent to your {method === 'email' ? 'email' : 'phone'}
                </p>
                {destination && (
                  <p className="text-sm font-medium text-gray-900">
                    {method === 'email' ? destination : `+1 ***-***-${destination.slice(-4)}`}
                  </p>
                )}
              </div>

              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                ))}
              </div>

              <button
                onClick={handleVerify}
                disabled={loading || otp.some(d => d === '')}
                className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <div className="text-center">
                <button
                  onClick={handleResendOTP}
                  disabled={countdown > 0 || loading}
                  className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center mx-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
