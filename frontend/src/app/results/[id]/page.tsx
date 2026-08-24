'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Assessment, AssessmentModule, Finding } from '@aegis/shared';
import { Shield, Download, Share2, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Mail, Copy, Check, Filter, ChevronDown, ChevronUp, User, Clock, Search, ExternalLink, ChevronLeft, ChevronRight, Info, ShieldCheck, FileText, Building2, Users, Target, ArrowUpDown, Eye, BarChart3, TrendingUp, Zap, RefreshCw, Calendar, Award, Star, Crown, Flag, BookOpen, Lightbulb, Settings, Wrench, Hammer, Package, GitBranch, Network, Globe, Server, Database, Lock, Shield as ShieldIcon, Scan, Layers, Activity, Monitor, Cpu, HardDrive, Cloud, Code, Terminal, Layout, PanelTop, Briefcase, ClipboardList, ListChecks, ShieldCheck as ShieldCheckIcon, ShieldOff, ShieldX, ShieldAlert, ShieldQuestion, ShieldPlus, ShieldMinus, Shield as ShieldIcon2, Shield as ShieldIcon3, Shield as ShieldIcon4, Shield as ShieldIcon5, Shield as ShieldIcon6, Shield as ShieldIcon7 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

type SortField = 'severity' | 'control_name' | 'module_name' | 'result';
type SortOrder = 'ASC' | 'DESC';

export default function ResultsPage() {
  const params = useParams();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [modules, setModules] = useState<AssessmentModule[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [detailedRequest, setDetailedRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmails, setShareEmails] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [includeFindings, setIncludeFindings] = useState(true);
  const [includeModules, setIncludeModules] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ link: string; copied: boolean } | null>(null);
  const [showFindingsTable, setShowFindingsTable] = useState(false);
  const [findingFilter, setFindingFilter] = useState('all');
  const [findingSearch, setFindingSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

  useEffect(() => {
    fetchResults();
  }, [params.id]);

  const fetchResults = async () => {
    try {
      const [assessmentRes, modulesRes, findingsRes] = await Promise.all([
        api.get(`/assessments/${params.id}`),
        api.get(`/assessments/${params.id}/modules`),
        api.get(`/assessments/${params.id}/findings`),
      ]);
      setAssessment(assessmentRes.data.data);
      setModules(modulesRes.data.data);
      setFindings(findingsRes.data.data);

      // Fetch metadata
      try {
        const metaRes = await api.get(`/assessments/${params.id}/metadata`);
        const metaMap: Record<string, string> = {};
        (metaRes.data.data || []).forEach((m: any) => {
          metaMap[m.key] = m.value;
        });
        setMetadata(metaMap);
      } catch (e) {
        // Metadata endpoint may not exist yet
      }

      // Fetch detailed assessment request status if applicable
      if (assessmentRes.data.data?.type === 'detailed') {
        try {
          const requestRes = await api.get(`/assessments/detailed/${params.id}/request`);
          setDetailedRequest(requestRes.data.data);
        } catch (e) {
          // No detailed request exists yet
        }
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    window.open(`/api/reports/${params.id}/pdf`, '_blank');
  };

  const handleDownloadExcel = async () => {
    window.open(`/api/reports/${params.id}/excel`, '_blank');
  };

  const handleShare = async () => {
    const emails = shareEmails.split(',').map(e => e.trim()).filter(e => e);
    if (emails.length === 0) {
      alert('Please enter at least one email address');
      return;
    }

    setSharing(true);
    try {
      const response = await api.post(`/reports/${params.id}/share`, {
        emails,
        message: shareMessage,
        includeFindings,
        includeModules,
      });
      setShareResult({ link: response.data.data.shareLink, copied: false });
    } catch (error) {
      console.error('Failed to share report:', error);
      alert('Failed to share report. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const copyToClipboard = () => {
    if (shareResult?.link) {
      navigator.clipboard.writeText(shareResult.link);
      setShareResult({ ...shareResult, copied: true });
      setTimeout(() => setShareResult({ ...shareResult, copied: false }), 2000);
    }
  };

  const getReportExpiryDate = () => {
    if (assessment?.completedAt) {
      const completed = new Date(assessment.completedAt);
      const expires = new Date(completed);
      expires.setDate(expires.getDate() + 30);
      return expires.toLocaleDateString();
    }
    return 'N/A';
  };

  const getDaysUntilExpiry = () => {
    if (assessment?.completedAt) {
      const completed = new Date(assessment.completedAt);
      const expires = new Date(completed);
      expires.setDate(expires.getDate() + 30);
      const now = new Date();
      const days = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, days);
    }
    return 0;
  };

  const filteredFindings = useMemo(() => {
    let result = [...findings];
    if (findingFilter !== 'all') {
      result = result.filter((f: any) => f.result === findingFilter);
    }
    if (findingSearch) {
      const lower = findingSearch.toLowerCase();
      result = result.filter((f: any) =>
        (f.control_name || '').toLowerCase().includes(lower) ||
        (f.module_name || '').toLowerCase().includes(lower) ||
        (f.recommendation || '').toLowerCase().includes(lower)
      );
    }
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'severity') {
        comparison = (severityOrder[a.severity as string] || 2) - (severityOrder[b.severity as string] || 2);
      } else if (sortField === 'control_name') {
        comparison = (a.control_name || '').localeCompare(b.control_name || '');
      } else if (sortField === 'module_name') {
        comparison = (a.module_name || '').localeCompare(b.module_name || '');
      } else if (sortField === 'result') {
        comparison = (a.result || '').localeCompare(b.result || '');
      }
      return sortOrder === 'ASC' ? comparison : -comparison;
    });
    return result;
  }, [findings, findingFilter, findingSearch, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortField(field);
      setSortOrder('DESC');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronDown className="w-4 h-4 text-gray-400" />;
    return sortOrder === 'ASC' ?
      <ChevronUp className="w-4 h-4 text-primary-600" /> :
      <ChevronDown className="w-4 h-4 text-primary-600" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'pass': return 'bg-green-100 text-green-800';
      case 'fail': return 'bg-red-100 text-red-800';
      case 'not_applicable': return 'bg-gray-100 text-gray-800';
      case 'needs_manual_review': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Assessment not found</p>
      </div>
    );
  }

  const bandColor = metadata.band_color || 'gray';
  const scoreColor = bandColor === 'red' ? 'text-red-600' :
                     bandColor === 'yellow' ? 'text-yellow-600' :
                     bandColor === 'blue' ? 'text-blue-600' : 'text-green-600';
  const scoreBgColor = bandColor === 'red' ? 'bg-red-100 text-red-800' :
                       bandColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                       bandColor === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';

  const pieData = [
    { name: 'Passed', value: modules.reduce((sum, m) => sum + (m.passedCount || 0), 0), color: '#22c55e' },
    { name: 'Failed', value: modules.reduce((sum, m) => sum + (m.failedCount || 0), 0), color: '#ef4444' },
    { name: 'N/A', value: modules.reduce((sum, m) => sum + (m.notApplicableCount || 0), 0), color: '#94a3b8' },
  ];

  const daysUntilExpiry = getDaysUntilExpiry();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Aegis</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleDownloadPDF}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <Download className="w-5 h-5 mr-1" />
                PDF
              </button>
              <button
                onClick={handleDownloadExcel}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <Download className="w-5 h-5 mr-1" />
                Excel
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <Share2 className="w-5 h-5 mr-1" />
                Share
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Share Report</h3>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setShareResult(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {!shareResult ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Addresses (comma-separated)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={shareEmails}
                      onChange={(e) => setShareEmails(e.target.value)}
                      placeholder="john@example.com, jane@example.com"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message (optional)
                  </label>
                  <textarea
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                    placeholder="Please review the attached security assessment report..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="mb-4 space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={includeFindings}
                      onChange={(e) => setIncludeFindings(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include findings</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={includeModules}
                      onChange={(e) => setIncludeModules(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include module scores</span>
                  </label>
                </div>

                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sharing ? 'Sharing...' : 'Share Report'}
                </button>
              </>
            ) : (
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-900 font-medium mb-2">Report shared successfully!</p>
                <p className="text-sm text-gray-600 mb-4">
                  The report has been shared with {shareEmails.split(',').length} recipient(s).
                </p>
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Shareable Link (expires in 30 days)</p>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={shareResult.link}
                      readOnly
                      className="flex-1 text-sm bg-white border border-gray-300 rounded px-2 py-1 mr-2"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="p-2 text-gray-600 hover:text-gray-900"
                      title="Copy to clipboard"
                    >
                      {shareResult.copied ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setShareResult(null);
                    setShareEmails('');
                    setShareMessage('');
                  }}
                  className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Banner */}
        {detailedRequest ? (
          <div className={`rounded-lg p-4 mb-8 ${
            detailedRequest.status === 'completed' ? 'bg-green-50 border border-green-200' :
            detailedRequest.status === 'in_review' ? 'bg-purple-50 border border-purple-200' :
            detailedRequest.status === 'awaiting_client' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-medium ${
                  detailedRequest.status === 'completed' ? 'text-green-800' :
                  detailedRequest.status === 'in_review' ? 'text-purple-800' :
                  detailedRequest.status === 'awaiting_client' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  Detailed Assessment {detailedRequest.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </p>
                <p className={`text-sm mt-1 ${
                  detailedRequest.status === 'completed' ? 'text-green-600' :
                  detailedRequest.status === 'in_review' ? 'text-purple-600' :
                  detailedRequest.status === 'awaiting_client' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {detailedRequest.status === 'unassigned' && 'Waiting for an assessor to be assigned...'}
                  {detailedRequest.status === 'assigned' && `Assigned to ${detailedRequest.assessor_name || 'an assessor'}`}
                  {detailedRequest.status === 'in_review' && 'Assessor is currently reviewing your assessment'}
                  {detailedRequest.status === 'awaiting_client' && 'Waiting for additional information from you'}
                  {detailedRequest.status === 'completed' && 'Manual review complete - final report available'}
                </p>
              </div>
              {detailedRequest.assessor_name && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Assessor</p>
                  <p className="font-medium text-gray-900">{detailedRequest.assessor_name}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
            <p className="text-green-800 font-medium">Assessment Completed</p>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-500">Assessment Type</p>
              <p className="font-medium text-gray-900 capitalize">{assessment.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed On</p>
              <p className="font-medium text-gray-900">
                {assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Duration</p>
              <p className="font-medium text-gray-900">
                {assessment.durationMs ? `${Math.round(assessment.durationMs / 1000)}s` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Controls Assessed</p>
              <p className="font-medium text-gray-900">{assessment.controlsAssessed || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Score Band</p>
              <p className="font-medium text-gray-900">{assessment.scoreBand || '-'}</p>
            </div>
          </div>
        </div>

        {/* Score Overview */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Security Score</h3>
            <div className={`text-6xl font-bold ${scoreColor} my-4`}>
              {assessment.overallScore || 0}/100
            </div>
            <div className={`inline-flex items-center px-4 py-2 rounded-full ${scoreBgColor} font-medium`}>
              {assessment.scoreBand || 'N/A'}
            </div>
            {metadata.band_description && (
              <p className="text-sm text-gray-600 mt-3">{metadata.band_description}</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Results Overview</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Findings</h3>
            <div className="space-y-3">
              {findings.filter(f => f.result === 'fail').slice(0, 5).map((finding) => (
                <div key={finding.id} className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{finding.control_name || 'Unknown Control'}</p>
                    <p className="text-xs text-gray-500 capitalize">{finding.severity} severity</p>
                  </div>
                </div>
              ))}
              {findings.filter(f => f.result === 'fail').length === 0 && (
                <p className="text-sm text-gray-500">No failed findings</p>
              )}
            </div>
          </div>
        </div>

        {/* Module Scores */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Module Scores</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {modules.map((module) => (
              <div key={module.id} className="border rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900">{module.moduleName}</p>
                <p className="text-2xl font-bold text-gray-900">{module.moduleScore || 0}/100</p>
                <div className="flex space-x-2 mt-2 text-xs">
                  <span className="text-green-600">{module.passedCount || 0} passed</span>
                  <span className="text-red-600">{module.failedCount || 0} failed</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Report Retention Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 flex items-center">
          <Clock className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">Report Retention Notice</p>
            <p className="text-sm text-blue-700">
              This report will be available for download until {getReportExpiryDate()} ({daysUntilExpiry} days remaining).
              After this date, the report will be archived and may require re-assessment to regenerate.
            </p>
          </div>
        </div>

        {/* Assessment Owner (for Detailed tier) */}
        {metadata.assessment_owner && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 text-primary-600 mr-2" />
              Assessment Owner
            </h3>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                <User className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{metadata.assessment_owner}</p>
                <p className="text-sm text-gray-500">Primary contact for this assessment</p>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Findings Table */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Detailed Findings</h3>
            <button
              onClick={() => setShowFindingsTable(!showFindingsTable)}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
            >
              {showFindingsTable ? 'Hide Table' : 'Show Table'}
              {showFindingsTable ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>
          </div>

          {showFindingsTable && (
            <>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={findingSearch}
                    onChange={(e) => setFindingSearch(e.target.value)}
                    placeholder="Search findings..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={findingFilter}
                    onChange={(e) => setFindingFilter(e.target.value)}
                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="all">All Results</option>
                    <option value="fail">Failed</option>
                    <option value="pass">Passed</option>
                    <option value="needs_manual_review">Needs Manual Review</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('control_name')}
                      >
                        <div className="flex items-center">
                          Control
                          {getSortIcon('control_name')}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('module_name')}
                      >
                        <div className="flex items-center">
                          Module
                          {getSortIcon('module_name')}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('severity')}
                      >
                        <div className="flex items-center">
                          Severity
                          {getSortIcon('severity')}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('result')}
                      >
                        <div className="flex items-center">
                          Result
                          {getSortIcon('result')}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recommendation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredFindings.map((finding) => (
                      <tr key={finding.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {finding.control_name || 'Unknown Control'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {finding.control_id || ''}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {finding.module_name || '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(finding.severity || 'medium')}`}>
                            {finding.severity || 'medium'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getResultColor(finding.result || 'not_applicable')}`}>
                            {finding.result === 'not_applicable' ? 'N/A' : finding.result || 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {finding.recommendation || '-'}
                        </td>
                      </tr>
                    ))}
                    {filteredFindings.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                          No findings match your filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination info */}
              <div className="mt-4 text-sm text-gray-500">
                Showing {filteredFindings.length} of {findings.length} findings
              </div>
            </>
          )}
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Recommendations</h3>
          <div className="space-y-3">
            {findings.filter(f => f.result === 'fail' && f.recommendation).slice(0, 5).map((finding, idx) => (
              <div key={finding.id} className="flex items-start p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{finding.control_name || 'Unknown Control'}</p>
                  <p className="text-sm text-gray-600 mt-1">{finding.recommendation}</p>
                  <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded capitalize">
                    {finding.severity} severity
                  </span>
                </div>
              </div>
            ))}
            {findings.filter(f => f.result === 'fail' && f.recommendation).length === 0 && (
              <p className="text-sm text-gray-500">No critical recommendations at this time.</p>
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Steps</h3>
          <div className="space-y-3">
            <p className="text-gray-600">1. Review the detailed findings above</p>
            <p className="text-gray-600">2. Prioritize remediation based on severity</p>
            <p className="text-gray-600">3. Download the full report for sharing with stakeholders</p>
            <p className="text-gray-600">4. Schedule a re-assessment in 90 days to track improvement</p>
          </div>
        </div>
      </main>
    </div>
  );
}
