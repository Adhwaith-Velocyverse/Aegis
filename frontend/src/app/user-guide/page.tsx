'use client';

import { useState } from 'react';
import { Shield, Download, Lock, CheckCircle2, Clock, FileText, ExternalLink, Mail } from 'lucide-react';

export default function UserGuidePage() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleDownload = () => {
    // In production, this would download a real PDF
    alert('User Guide PDF download would start here. In production, this would download the actual PDF file.');
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@velocyverse.com?subject=Support Request - Tenant Connection';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Hero Section */}
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Your Tenant - User Guide</h1>
              <p className="text-gray-600 max-w-xl">
                Follow our step-by-step guide to securely connect your Microsoft 365 tenant and start your security assessment.
              </p>
            </div>
            <button
              onClick={handleDownload}
              className="bg-primary-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Download User Guide (PDF)
            </button>
          </div>
        </div>

        {/* Benefit Tiles */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="p-3 bg-green-100 rounded-lg w-fit mb-4">
              <Lock className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Connection</h3>
            <p className="text-sm text-gray-600">
              We use Microsoft's secure OAuth 2.0 protocol. We only request read-only permissions and never store your credentials.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="p-3 bg-blue-100 rounded-lg w-fit mb-4">
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Step-by-Step</h3>
            <p className="text-sm text-gray-600">
              Our guided wizard walks you through each step. No technical expertise required - just follow the prompts.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="p-3 bg-purple-100 rounded-lg w-fit mb-4">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Save Time</h3>
            <p className="text-sm text-gray-600">
              Automated data collection means no manual questionnaires. Get comprehensive results in minutes, not days.
            </p>
          </div>
        </div>

        {/* Connection Steps */}
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">How to Connect Your Tenant</h2>
          
          <div className="space-y-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-600 font-semibold text-sm">1</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Sign In to Your Account</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Log in to your Aegis account. If you don't have an account, you'll need to sign up first.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-600 font-semibold text-sm">2</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Navigate to Connect Tenant</h3>
                <p className="text-sm text-gray-600 mt-1">
                  From your dashboard, click "Connect Your Tenant" or go to the Connect Tenant page from the menu.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-600 font-semibold text-sm">3</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Enter Tenant Information</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Provide your Microsoft 365 tenant ID (e.g., contoso.onmicrosoft.com) and tenant name. This helps us identify your organization.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-600 font-semibold text-sm">4</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Review Permissions</h3>
                <p className="text-sm text-gray-600 mt-1">
                  You'll see a list of permissions we request. We only need read-only access to assess your security posture. Review and confirm the modules you want to include.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-600 font-semibold text-sm">5</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Grant Consent</h3>
                <p className="text-sm text-gray-600 mt-1">
                  You'll be redirected to Microsoft's consent page. A global administrator must approve the permissions. This is a one-time action per tenant.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-600 font-semibold text-sm">6</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Start Your Assessment</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Once connected, you can start your first security assessment. Choose from Trial, Quick, or Detailed assessment types.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Support Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 mb-8">
          <div className="flex items-start">
            <Mail className="w-6 h-6 text-blue-600 mr-4 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Need help connecting your tenant?</h3>
              <p className="text-sm text-blue-800 mb-4">
                Our support team is here to help. If you're experiencing issues or have questions about the connection process, don't hesitate to reach out.
              </p>
              <button
                onClick={handleContactSupport}
                className="bg-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-xl shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">What permissions do you request?</h3>
              <p className="text-sm text-gray-600">
                We request read-only permissions to assess your security posture. This includes access to identity policies, security settings, device configurations, and compliance data. We never request write permissions.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Is my data secure?</h3>
              <p className="text-sm text-gray-600">
                Yes. All data is encrypted in transit and at rest. We use Microsoft's secure OAuth 2.0 protocol and never store your credentials. Access tokens are encrypted and stored securely.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Who can grant consent?</h3>
              <p className="text-sm text-gray-600">
                A global administrator of your Microsoft 365 tenant must grant consent. If you're not an admin, you'll need to contact your IT administrator to complete the connection.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Can I disconnect my tenant later?</h3>
              <p className="text-sm text-gray-600">
                Yes, you can disconnect your tenant at any time from the Tenant Connection Verification page. This will revoke access and delete stored data.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">What if consent is denied?</h3>
              <p className="text-sm text-gray-600">
                If consent is denied for certain modules, those modules will be marked as "Permission Not Granted" and won't be included in the assessment. You can retry consent for specific modules later.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
