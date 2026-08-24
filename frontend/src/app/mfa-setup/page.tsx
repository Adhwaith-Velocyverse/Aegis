'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Shield, Smartphone, Mail, CheckCircle2, Copy } from 'lucide-react';

export default function MFASetupPage() {
  const [step, setStep] = useState<'choose' | 'totp' | 'email' | 'verify' | 'complete'>('choose');
  const [method, setMethod] = useState<'totp' | 'email' | null>(null);
  const [otp, setOtp] = useState('');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const router = useRouter();
  const { user, login } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChooseMethod = (selectedMethod: 'totp' | 'email') => {
    setMethod(selectedMethod);
    if (selectedMethod === 'totp') {
      setStep('totp');
      setupTOTP();
    } else {
      setStep('email');
    }
  };

  const setupTOTP = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/mfa/totp/setup');
      setSecret(response.data.data.secret);
      setQrCode(response.data.data.qrCode);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to setup TOTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/mfa/setup', {
        method: 'email',
        destination: user?.email || '',
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

  const handleVerifyTOTP = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/mfa/totp/verify', {
        secret,
        code: otp,
      });
      setSuccess('MFA enabled successfully!');
      setStep('complete');
      // Update auth store with new token
      if (response.data.data?.token && response.data.data?.user) {
        login(response.data.data.user, response.data.data.token);
      }
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid TOTP code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySMS = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/mfa/verify', { code: otp });
      setSuccess('MFA enabled successfully!');
      setStep('complete');
      // Update auth store with new token
      if (response.data.data?.token && response.data.data?.user) {
        login(response.data.data.user, response.data.data.token);
      }
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/');
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
            <h1 className="text-2xl font-bold text-gray-900">Setup Multi-Factor Authentication</h1>
            <p className="text-gray-600 mt-2">Add an extra layer of security to your account</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {success}
            </div>
          )}

          {step === 'choose' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">Choose how you want to receive your verification codes:</p>
              
              <button
                onClick={() => handleChooseMethod('totp')}
                className="w-full flex items-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Smartphone className="w-8 h-8 text-primary-600 mr-4" />
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">Authenticator App</h3>
                  <p className="text-sm text-gray-600">Use Google Authenticator, Authy, or similar app</p>
                </div>
              </button>

              <button
                onClick={() => handleChooseMethod('email')}
                className="w-full flex items-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-8 h-8 text-primary-600 mr-4" />
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">Email OTP</h3>
                  <p className="text-sm text-gray-600">Receive codes via email</p>
                </div>
              </button>

              <button
                onClick={handleSkip}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-4"
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 'totp' && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Step 1: Scan QR Code</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                {qrCode && (
                  <div className="flex justify-center mb-4">
                    <div className="bg-white p-4 rounded-lg border">
                      <pre className="text-xs text-center whitespace-pre-wrap break-all max-w-xs">
                        {qrCode}
                      </pre>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between bg-white p-3 rounded border">
                  <code className="text-sm font-mono">{secret}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(secret)}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Step 2: Enter Verification Code</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Enter the 6-digit code from your authenticator app
                </p>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl tracking-widest"
                  maxLength={6}
                />
              </div>

              <button
                onClick={handleVerifyTOTP}
                disabled={loading || otp.length !== 6}
                className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify & Enable MFA'}
              </button>
            </div>
          )}

          {(step === 'email' || (step === 'verify' && method === 'email')) && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Verify Your Email</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {!otpSent
                    ? "We'll send a verification code to your email address"
                    : 'Enter the 6-digit code sent to your email'}
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Email:</strong> {user?.email}
                  </p>
                </div>
              </div>

              {!otpSent ? (
                <button
                  onClick={handleSendOTP}
                  disabled={loading}
                  className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl tracking-widest"
                    maxLength={6}
                  />

                  <button
                    onClick={handleVerifySMS}
                    disabled={loading || otp.length !== 6}
                    className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Verifying...' : 'Verify & Enable MFA'}
                  </button>

                  <div className="text-center">
                    {countdown > 0 ? (
                      <p className="text-sm text-gray-500">Resend code in {countdown}s</p>
                    ) : (
                      <button
                        onClick={handleResendOTP}
                        disabled={loading}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">MFA Enabled!</h3>
              <p className="text-sm text-gray-600">Your account is now more secure.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
