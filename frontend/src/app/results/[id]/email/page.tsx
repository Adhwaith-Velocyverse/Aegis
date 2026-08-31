'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Shield, Mail, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Info, ExternalLink, Filter } from 'lucide-react';

type Result = 'pass' | 'fail' | 'not_applicable' | 'needs_manual_review' | 'error' | 'info';

interface Finding {
  id: string;
  assessmentModuleId: string;
  controlCatalogId: string;
  result: Result;
  severity: string;
  evidence: string;
  recommendation: string;
  source: string;
  control_name?: string;
  module_name?: string;
  description?: string;
  area?: string;
}

interface Module {
  id: string;
  moduleName: string;
  moduleScore?: number;
  passedCount?: number;
  failedCount?: number;
  notApplicableCount?: number;
  collectionStatus: string;
}

interface Assessment {
  id: string;
  type: string;
  status: string;
  overallScore?: number;
  scoreBand?: string;
  createdAt: string;
  completedAt?: string;
  tenantName?: string;
}

const AREA_COLORS: Record<string, string> = {
  'Anti-Phishing': 'bg-purple-50 border-purple-200',
  'Anti-Spam Inbound': 'bg-blue-50 border-blue-200',
  'Anti-Spam Outbound': 'bg-indigo-50 border-indigo-200',
  'Anti-Malware': 'bg-red-50 border-red-200',
  'Safe Links': 'bg-green-50 border-green-200',
  'Safe Attachments': 'bg-orange-50 border-orange-200',
  'Permissions & RBAC': 'bg-yellow-50 border-yellow-200',
  'SMTP AUTH': 'bg-gray-50 border-gray-200',
  'POP/IMAP': 'bg-gray-50 border-gray-200',
  'Connectors': 'bg-teal-50 border-teal-200',
  'Transport Rules': 'bg-pink-50 border-pink-200',
  'Common Metrics': 'bg-sky-50 border-sky-200',
};

export default function EmailModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Result>('all');
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  useEffect(() => {
    fetchData();
  }, [assessmentId]);

  const fetchData = async () => {
    try {
      const [assessmentRes, modulesRes, findingsRes] = await Promise.all([
        api.get(`/assessments/${assessmentId}`),
        api.get(`/assessments/${assessmentId}/modules`),
        api.get(`/assessments/${assessmentId}/findings`),
      ]);
      setAssessment(assessmentRes.data.data);
      const modules = modulesRes.data.data as Module[];
      const emailModule = modules.find((m) => m.moduleName === 'Email');
      setModule(emailModule || null);
      const allFindings = findingsRes.data.data as Finding[];
      setFindings(allFindings.filter((f) => f.module_name === 'Email'));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedFindings = findings.reduce((acc, finding) => {
    const area = finding.area || 'Other';
    if (!acc[area]) acc[area] = [];
    acc[area].push(finding);
    return acc;
  }, {} as Record<string, Finding[]>);

  const filteredGroupedFindings = Object.entries(groupedFindings).reduce((acc, [area, items]) => {
    if (filter === 'all') {
      acc[area] = items;
    } else {
      acc[area] = items.filter((f) => f.result === filter);
    }
    return acc;
  }, {} as Record<string, Finding[]>);

  const getResultColor = (result: Result) => {
    switch (result) {
      case 'pass': return 'bg-green-100 text-green-800';
      case 'fail': return 'bg-red-100 text-red-800';
      case 'not_applicable': return 'bg-gray-100 text-gray-800';
      case 'needs_manual_review': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-orange-100 text-orange-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getResultIcon = (result: Result) => {
    switch (result) {
      case 'pass': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'fail': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'info': return <Info className="w-4 h-4 text-blue-600" />;
      default: return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  const areaStats = (area: string) => {
    const items = groupedFindings[area] || [];
    return {
      total: items.length,
      pass: items.filter((f) => f.result === 'pass').length,
      fail: items.filter((f) => f.result === 'fail').length,
      info: items.filter((f) => f.result === 'info').length,
      error: items.filter((f) => f.result === 'error').length,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!assessment || !module) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Email Module Not Found</h2>
          <p className="text-gray-600 mb-4">This assessment does not have an Email module.</p>
          <button
            onClick={() => router.push(`/results/${assessmentId}`)}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Return to Results
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push(`/results/${assessmentId}`)}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Mail className="w-8 h-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Email Security</h1>
                <p className="text-sm text-gray-500">Module Detail View</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 capitalize">{assessment.type} Assessment</span>
              <span className="text-sm text-gray-500">Tenant: {assessment.tenantName || 'N/A'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Module Score Card */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Email Security Score</h2>
              <p className="text-sm text-gray-500">Defender for Office 365 / Exchange Online</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-gray-900">{module.moduleScore || 0}/100</p>
              <div className="flex space-x-4 mt-2 text-sm">
                <span className="text-green-600">{module.passedCount || 0} passed</span>
                <span className="text-red-600">{module.failedCount || 0} failed</span>
                <span className="text-gray-500">{module.notApplicableCount || 0} N/A</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex items-center space-x-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Results</option>
              <option value="pass">Passed</option>
              <option value="fail">Failed</option>
              <option value="info">Informational</option>
              <option value="error">Errors</option>
              <option value="needs_manual_review">Needs Manual Review</option>
              <option value="not_applicable">Not Applicable</option>
            </select>
          </div>
        </div>

        {/* Findings by Area */}
        <div className="space-y-6">
          {Object.entries(filteredGroupedFindings).map(([area, areaFindings]) => {
            const stats = areaStats(area);
            const colorClass = AREA_COLORS[area] || 'bg-gray-50 border-gray-200';
            return (
              <div key={area} className={`bg-white rounded-xl shadow-sm border p-6 ${colorClass}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{area}</h3>
                  <div className="flex items-center space-x-3 text-sm">
                    <span className="text-green-600 font-medium">{stats.pass} passed</span>
                    <span className="text-red-600 font-medium">{stats.fail} failed</span>
                    {stats.info > 0 && <span className="text-blue-600 font-medium">{stats.info} info</span>}
                    {stats.error > 0 && <span className="text-orange-600 font-medium">{stats.error} errors</span>}
                  </div>
                </div>
                <div className="space-y-3">
                  {areaFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${
                        finding.result === 'pass' ? 'border-green-200 bg-green-50' :
                        finding.result === 'fail' ? 'border-red-200 bg-red-50' :
                        finding.result === 'info' ? 'border-blue-200 bg-blue-50' :
                        'border-gray-200 bg-white'
                      }`}
                      onClick={() => setSelectedFinding(finding)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            {getResultIcon(finding.result)}
                            <span className="ml-2 text-sm font-medium text-gray-900">{finding.control_name || finding.id}</span>
                          </div>
                          {finding.description && (
                            <p className="text-sm text-gray-600 mb-2">{finding.description}</p>
                          )}
                          <p className="text-sm text-gray-800">{finding.evidence}</p>
                        </div>
                        <span className={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getResultColor(finding.result)}`}>
                          {finding.result}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {Object.keys(filteredGroupedFindings).length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No findings match your filter</h3>
            <p className="text-gray-600">Try adjusting the filter to see more results.</p>
          </div>
        )}
      </main>

      {/* Evidence Modal */}
      {selectedFinding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedFinding.control_name || 'Finding Details'}</h3>
                <p className="text-sm text-gray-500 capitalize">{selectedFinding.area || selectedFinding.module_name}</p>
              </div>
              <button
                onClick={() => setSelectedFinding(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getResultColor(selectedFinding.result)}`}>
                {selectedFinding.result}
              </span>
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                {selectedFinding.severity} severity
              </span>
            </div>

            {selectedFinding.description && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-900 mb-2">Description</h5>
                <p className="text-sm text-gray-600">{selectedFinding.description}</p>
              </div>
            )}

            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-900 mb-2">Evidence</h5>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                {selectedFinding.evidence || 'No evidence available'}
              </p>
            </div>

            {selectedFinding.recommendation && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-900 mb-2">Recommendation</h5>
                <p className="text-sm text-gray-600 whitespace-pre-wrap bg-blue-50 p-3 rounded-lg">
                  {selectedFinding.recommendation}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-xs text-gray-500 capitalize">Source: {selectedFinding.source || 'automated'}</span>
              <button
                onClick={() => setSelectedFinding(null)}
                className="bg-primary-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
