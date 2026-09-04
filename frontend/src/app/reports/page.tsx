'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Assessment } from '@aegis/shared';
import { Shield, FileText, Download, ExternalLink, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';

export default function ReportsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      const response = await api.get('/assessments/history?limit=50');
      const data = response.data.data || [];
      setAssessments(data.filter((a: Assessment) => a.status === 'completed'));
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button onClick={() => router.push('/')} className="text-gray-600 hover:text-gray-900 mr-4">
                ← Back
              </button>
              <Shield className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Reports</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Generated Reports</h2>
            <p className="text-sm text-gray-600 mt-1">Download or share reports from completed assessments.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assessment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assessments.map((assessment) => (
                  <tr key={assessment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">Assessment Report</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                        {assessment.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(assessment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={assessment.overallScore !== undefined ? (assessment.overallScore >= 70 ? 'text-green-600' : assessment.overallScore >= 40 ? 'text-yellow-600' : 'text-red-600') : 'text-gray-500'}>
                        {assessment.overallScore !== undefined ? `${assessment.overallScore}/100` : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => window.open(`/api/reports/${assessment.id}/pdf`, '_blank')}
                          className="flex items-center text-primary-600 hover:text-primary-700"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </button>
                        <button
                          onClick={() => window.open(`/api/reports/${assessment.id}/excel`, '_blank')}
                          className="flex items-center text-primary-600 hover:text-primary-700"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Excel
                        </button>
                        <button
                          onClick={() => router.push(`/results/${assessment.id}`)}
                          className="flex items-center text-gray-600 hover:text-gray-900"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {assessments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <FileText className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 mb-2">No reports available yet</p>
                        <button
                          onClick={() => router.push('/trial')}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Start an assessment
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
