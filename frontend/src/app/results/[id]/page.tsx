'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Assessment, AssessmentModule, Finding } from '@aegis/shared';
import { Shield, Download, Share2, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Mail, Copy, Check, Filter, ChevronDown, ChevronUp, User, Clock, Search, ExternalLink, ChevronLeft, ChevronRight, ArrowLeft, Info, ShieldCheck, FileText, Building2, Users, Target, ArrowUpDown, Eye, BarChart3, TrendingUp, Zap, RefreshCw, Calendar, Award, Star, Crown, Flag, BookOpen, Lightbulb, Settings, Wrench, Hammer, Package, GitBranch, Network, Globe, Server, Database, Lock, Shield as ShieldIcon, Scan, Layers, Activity, Monitor, Cpu, HardDrive, Cloud, Code, Terminal, Layout, PanelTop, Briefcase, ClipboardList, ListChecks, ShieldCheck as ShieldCheckIcon, ShieldOff, ShieldX, ShieldAlert, ShieldQuestion, ShieldPlus, ShieldMinus, Shield as ShieldIcon2, Shield as ShieldIcon3, Shield as ShieldIcon4, Shield as ShieldIcon5, Shield as ShieldIcon6, Shield as ShieldIcon7, Plus, MessageSquare } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const scoreColorMap: Record<string, string> = {
  red: '#EF4444',
  yellow: '#F59E0B',
  blue: '#3B82F6',
  green: '#10B981',
  gray: '#9CA3AF',
  orange: '#F97316',
};

function ScoreRing({ score, bandColor, scoreBand, bandDescription }: { score: number; bandColor: string; scoreBand?: string; bandDescription?: string }) {
  const color = scoreColorMap[bandColor as keyof typeof scoreColorMap] || scoreColorMap['No Data'];
  const radius = 54;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const percent = Math.min(Math.max(score, 0), 100) / 100;
  const dashArray = `${percent * circumference} ${circumference}`;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={radius * 2} height={radius * 2}>
          <circle stroke="#E5E7EB" fill="none" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
          <circle
            stroke={color}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={dashArray}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            transform={`rotate(-90 ${radius} ${radius})`}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">{score}</span>
          <span className="text-xs text-gray-500">/100</span>
        </div>
      </div>
      {scoreBand && (
        <div className="mt-4 text-center">
          <span className="text-sm font-medium text-gray-900">{scoreBand}</span>
          {bandDescription && <p className="text-xs text-gray-500 mt-1 max-w-[200px]">{bandDescription}</p>}
        </div>
      )}
    </div>
  );
}

type SortField = 'severity' | 'control_name' | 'module_name' | 'result';
type SortOrder = 'ASC' | 'DESC';

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
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
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);

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

  const getPostureDescription = (band: string, score: number): string => {
    if (score >= 90) return 'Strong security posture across all assessed controls.';
    if (score >= 75) return 'Solid security posture with minor improvements recommended.';
    if (score >= 50) return 'Some security controls in place but improvements needed.';
    if (score >= 25) return 'Significant security gaps requiring attention.';
    return 'Critical security gaps requiring immediate remediation.';
  };

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
      case 'error': return 'bg-orange-100 text-orange-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (ms: number): string => {
    if (!ms) return '-';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const formatCompletedOn = (dateString: string | Date | undefined): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const MODULE_CONFIG: Record<string, { icon: any; color: string; bgColor: string; barColor: string }> = {
    'Entra ID': { icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100', barColor: 'bg-blue-500' },
    'Email': { icon: Mail, color: 'text-purple-600', bgColor: 'bg-purple-100', barColor: 'bg-purple-500' },
    'Purview': { icon: ShieldCheck, color: 'text-green-600', bgColor: 'bg-green-100', barColor: 'bg-green-500' },
    'Intune': { icon: Monitor, color: 'text-blue-600', bgColor: 'bg-blue-100', barColor: 'bg-blue-500' },
    'M365 Admin Center': { icon: Settings, color: 'text-gray-600', bgColor: 'bg-gray-100', barColor: 'bg-gray-500' },
    'Cloud Apps': { icon: Cloud, color: 'text-indigo-600', bgColor: 'bg-indigo-100', barColor: 'bg-indigo-500' },
    'Teams': { icon: MessageSquare, color: 'text-teal-600', bgColor: 'bg-teal-100', barColor: 'bg-teal-500' },
    'SharePoint': { icon: Server, color: 'text-orange-600', bgColor: 'bg-orange-100', barColor: 'bg-orange-500' },
  };

  const getModuleIcon = (moduleName: string) => MODULE_CONFIG[moduleName] || { icon: Shield, color: 'text-gray-600', bgColor: 'bg-gray-100', barColor: 'bg-gray-500' };

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

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-7 h-7 text-primary-600 mr-3" />
              <div>
                <h1 className="text-lg font-bold text-gray-900">Aegis Security Assessment</h1>
                <p className="text-xs text-gray-500">
                  {assessment.tenantName || 'Unknown Tenant'} • {assessment.type} Assessment
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4 mr-1.5" />
                PDF
              </button>
              <button
                onClick={handleDownloadExcel}
                className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Excel
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Share2 className="w-4 h-4 mr-1.5" />
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
           <div className={`rounded-xl p-6 mb-8 ${
             detailedRequest.status === 'completed' ? 'bg-green-50 border border-green-200' :
             detailedRequest.status === 'in_review' ? 'bg-purple-50 border border-purple-200' :
             detailedRequest.status === 'awaiting_client' ? 'bg-yellow-50 border border-yellow-200' :
             'bg-blue-50 border border-blue-200'
           }`}>
             <div className="flex items-start justify-between">
               <div className="flex items-center">
                 <div className={`p-2 rounded-lg mr-4 ${
                   detailedRequest.status === 'completed' ? 'bg-green-100' :
                   detailedRequest.status === 'in_review' ? 'bg-purple-100' :
                   detailedRequest.status === 'awaiting_client' ? 'bg-yellow-100' :
                   'bg-blue-100'
                 }`}>
                   <CheckCircle2 className={`w-6 h-6 ${
                     detailedRequest.status === 'completed' ? 'text-green-600' :
                     detailedRequest.status === 'in_review' ? 'text-purple-600' :
                     detailedRequest.status === 'awaiting_client' ? 'text-yellow-600' :
                     'text-blue-600'
                   }`} />
                 </div>
                 <div>
                   <h2 className="text-xl font-bold text-gray-900">
                     Detailed Assessment {detailedRequest.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                   </h2>
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-full mr-4">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Assessment Completed</h2>
                    <p className="text-sm text-gray-500 mt-1">Your assessment has completed successfully. Here are your results.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/connect-tenant')}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Another Tenant
                  </button>
                  <button
                    onClick={() => router.push('/history')}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Back to Assessments
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stat Strip */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
              <div className="flex items-start">
                <div className="p-2 bg-primary-50 rounded-lg mr-3">
                  <FileText className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Assessment Type</p>
                  <p className="text-sm font-semibold text-gray-900 capitalize mt-1">{assessment.type}</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 bg-blue-50 rounded-lg mr-3">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tenant</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{assessment.tenantName || '-'}</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 bg-green-50 rounded-lg mr-3">
                  <Calendar className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed On</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{formatCompletedOn(assessment.completedAt || '')}</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 bg-orange-50 rounded-lg mr-3">
                  <Clock className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Duration</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{formatDuration(assessment.durationMs || 0)}</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 bg-purple-50 rounded-lg mr-3">
                  <ListChecks className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Controls Assessed</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{assessment.controlsAssessed || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Score + Module + Findings Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            {/* Overall Security Score Gauge */}
            <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4 text-center">Overall Security Score</p>
              <div className="flex flex-col items-center">
                <svg viewBox="0 0 200 120" className="w-full max-w-[220px]">
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#EF4444" />
                      <stop offset="50%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                  
                  {/* Background arc */}
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth={10}
                    strokeLinecap="round"
                  />
                  
                  {/* Score arc */}
                  {(() => {
                    const score = Math.min(Math.max(assessment.overallScore || 0, 0), 100);
                    const angle = Math.PI * (1 - score / 100);
                    const scoreX = 100 + 80 * Math.cos(angle);
                    const scoreY = 100 + 80 * Math.sin(angle);
                    return (
                      <path
                        d={`M 20 100 A 80 80 0 0 1 ${scoreX} ${scoreY}`}
                        fill="none"
                        stroke="url(#gaugeGradient)"
                        strokeWidth={10}
                        strokeLinecap="round"
                      />
                    );
                  })()}
                  
                  {/* Needle */}
                  {(() => {
                    const score = Math.min(Math.max(assessment.overallScore || 0, 0), 100);
                    const angle = Math.PI * (1 - score / 100);
                    const scoreX = 100 + 80 * Math.cos(angle);
                    const scoreY = 100 + 80 * Math.sin(angle);
                    return (
                      <line
                        x1={100}
                        y1={100}
                        x2={scoreX}
                        y2={scoreY}
                        stroke="#1F2937"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                      />
                    );
                  })()}
                  
                  {/* Center dot */}
                  <circle cx={100} cy={100} r={5} fill="#1F2937" />
                  
                  {/* Score text */}
                  <text x={100} y={88} textAnchor="middle" fontSize="28" fontWeight="bold" fill="#111827">
                    {assessment.overallScore || 0}
                  </text>
                  <text x={100} y={104} textAnchor="middle" fontSize="11" fill="#6B7280">
                    /100
                  </text>
                </svg>
                
                <div className="mt-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${scoreBgColor}`}>
                    {assessment.scoreBand || 'N/A'}
                  </span>
                  <p className="text-xs text-gray-500 mt-2 max-w-[180px]">
                    {metadata.band_description || getPostureDescription(assessment.scoreBand || '', assessment.overallScore || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Per-Module Cards */}
            <div className="lg:col-span-3 space-y-4">
              {modules.map((module) => {
                const total = (module.passedCount || 0) + (module.failedCount || 0) + (module.notApplicableCount || 0);
                const score = module.moduleScore ?? (total > 0 ? Math.round(((module.passedCount || 0) / total) * 100) : 0);
                const config = getModuleIcon(module.moduleName);
                const Icon = config.icon;
                return (
                  <div
                    key={module.id}
                    className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${module.moduleName === 'Email' ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                    onClick={() => module.moduleName === 'Email' ? router.push(`/results/${assessment?.id}/email`) : undefined}
                  >
                    <div className="flex items-center mb-3">
                      <div className={`p-2 rounded-lg mr-3 ${config.bgColor}`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{module.moduleName}</p>
                        <p className="text-xl font-bold text-gray-900">{score}/100</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div className={`${config.barColor} h-2 rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="text-green-600 font-medium">{module.passedCount || 0} passed</span>
                      <span className="text-red-600 font-medium">{module.failedCount || 0} failed</span>
                      <span className="text-gray-400">{total} total</span>
                    </div>
                    {module.moduleName === 'Email' && (
                      <p className="text-xs text-primary-600 mt-2 font-medium">Click for details</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Results Overview + Top Findings */}
            <div className="lg:col-span-5 space-y-6">
              {/* Results Overview */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Results Overview</h3>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="flex-shrink-0">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-3">
                    {pieData.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                          <span className="w-3 h-3 rounded-sm mr-2" style={{ backgroundColor: entry.color }} />
                          <span className="text-gray-600">{entry.name}</span>
                        </div>
                        <span className="font-medium text-gray-900">{entry.value}</span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">Total Controls</p>
                      <p className="text-lg font-bold text-gray-900">{assessment.controlsAssessed || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Findings */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Top Findings</h3>
                  <button
                    onClick={() => {
                      setShowFindingsTable(true);
                      setTimeout(() => {
                        const el = document.getElementById('detailed-findings');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                  >
                    View all findings
                  </button>
                </div>
                <div className="space-y-3">
                  {findings.filter(f => f.result === 'fail').slice(0, 5).map((finding) => (
                    <div key={finding.id} className="flex items-center justify-between">
                      <div className="flex items-start flex-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-3 ${getSeverityColor(finding.severity || 'medium')}`}>
                          {finding.severity || 'medium'}
                        </span>
                        <p className="text-sm text-gray-900">{finding.control_name || 'Unknown Control'}</p>
                      </div>
                    </div>
                  ))}
                  {findings.filter(f => f.result === 'fail').length === 0 && (
                    <p className="text-sm text-gray-500">No failed findings</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Download Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Download Report</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Reports will be available for download until {getReportExpiryDate()} ({getDaysUntilExpiry()} days remaining). After this date, the report will be archived and may require re-assessment to regenerate.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download PDF Report
                </button>
                <button
                  onClick={handleDownloadExcel}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Excel
                </button>
              </div>
            </div>
          </div>

        {/* Informational Metrics */}
        {findings.filter(f => f.result === 'info').length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4 flex items-center">
              <Info className="w-4 h-4 text-blue-600 mr-2" />
              Informational Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {findings.filter(f => f.result === 'info').map((finding) => (
                <div key={finding.id} className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex items-start">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3 flex-shrink-0">
                      {finding.module_name === 'Email' ? <Mail className="w-4 h-4 text-blue-600" /> : <Shield className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{finding.control_name || 'Unknown Control'}</p>
                      <p className="text-xs text-gray-500 mt-1">{finding.module_name}</p>
                      <p className="text-sm text-blue-800 mt-2">{finding.evidence}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
         <div id="detailed-findings" className="bg-white rounded-xl shadow-sm border p-6 mb-8">
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
                    <option value="error">Error</option>
                    <option value="info">Info</option>
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
                        className="min-w-[180px] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('control_name')}
                      >
                        <div className="flex items-center">
                          Control
                          {getSortIcon('control_name')}
                        </div>
                      </th>
                      <th
                        className="w-[120px] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('module_name')}
                      >
                        <div className="flex items-center">
                          Module
                          {getSortIcon('module_name')}
                        </div>
                      </th>
                      <th
                        className="w-24 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('severity')}
                      >
                        <div className="flex items-center">
                          Severity
                          {getSortIcon('severity')}
                        </div>
                      </th>
                      <th
                        className="w-28 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('result')}
                      >
                        <div className="flex items-center">
                          Result
                          {getSortIcon('result')}
                        </div>
                      </th>
                      <th className="min-w-[180px] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recommendation
                      </th>
                      <th className="w-[80px] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Evidence
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredFindings.map((finding) => (
                      <tr key={finding.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {finding.control_name || 'Unknown Control'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {finding.control_id || ''}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {finding.module_name || '-'}
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(finding.severity || 'medium')}`}>
                            {finding.severity || 'medium'}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getResultColor(finding.result || 'not_applicable')}`}>
                            {finding.result === 'not_applicable' ? 'N/A' : finding.result || 'unknown'}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-600 whitespace-normal">
                          {finding.recommendation || '-'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedFinding(finding);
                              setShowEvidenceModal(true);
                            }}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredFindings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
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
           <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Key Recommendations</h3>
           <div className="space-y-3">
             {findings.filter(f => f.result === 'fail' && f.recommendation).slice(0, 5).map((finding) => (
               <div key={finding.id} className={`flex items-start p-4 rounded-lg border-l-4 ${
                 finding.severity === 'critical' ? 'border-red-500 bg-red-50' :
                 finding.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                 finding.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                 'border-blue-500 bg-blue-50'
               }`}>
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                     <p className="text-sm font-medium text-gray-900">{finding.control_name || 'Unknown Control'}</p>
                     <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(finding.severity || 'medium')}`}>
                       {finding.severity || 'medium'}
                     </span>
                   </div>
                   <p className="text-sm text-gray-600">{finding.recommendation}</p>
                 </div>
               </div>
             ))}
             {findings.filter(f => f.result === 'fail' && f.recommendation).length === 0 && (
               <p className="text-sm text-gray-500">No critical recommendations at this time.</p>
             )}
           </div>
         </div>

        {/* Next Steps */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Next Steps</h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">1</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Review detailed findings</p>
                <p className="text-xs text-gray-500 mt-0.5">Examine all failed and needs-review controls in the findings table below</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">2</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Prioritize critical remediation</p>
                <p className="text-xs text-gray-500 mt-0.5">Address Critical and High severity findings first</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">3</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Download the full report</p>
                <p className="text-xs text-gray-500 mt-0.5">Share PDF/Excel reports with stakeholders and track progress</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">4</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Schedule reassessment</p>
                <p className="text-xs text-gray-500 mt-0.5">Re-assess after remediation to verify improvements</p>
              </div>
            </div>
          </div>
        </div>

        {/* Evidence Modal */}
        {showEvidenceModal && selectedFinding && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Control Evidence</h3>
                <button
                  onClick={() => {
                    setShowEvidenceModal(false);
                    setSelectedFinding(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto">
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">{selectedFinding.control_name || 'Unknown Control'}</h4>
                  <div className="flex space-x-2 mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getResultColor(selectedFinding.result || 'not_applicable')}`}>
                      {selectedFinding.result || 'unknown'}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(selectedFinding.severity || 'medium')}`}>
                      {selectedFinding.severity || 'medium'}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Evidence</h5>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                    {selectedFinding.evidence || 'No evidence available'}
                  </p>
                </div>

                {selectedFinding.recommendation && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Recommendation</h5>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {selectedFinding.recommendation}
                    </p>
                  </div>
                )}

                {selectedFinding.details && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Details</h5>
                    <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg overflow-auto max-h-60">
                      {JSON.stringify(selectedFinding.details, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedFinding.error && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Error</h5>
                    <pre className="text-xs text-red-600 bg-red-50 p-3 rounded-lg overflow-auto max-h-60">
                      {JSON.stringify(selectedFinding.error, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

