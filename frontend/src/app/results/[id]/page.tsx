'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Assessment, AssessmentModule, Finding } from '@aegis/shared';
import {
  Shield, Download, Share2, AlertTriangle, CheckCircle2, XCircle, Mail, Copy, Check,
  Filter, ChevronDown, ChevronUp, User, Clock, Search, ArrowLeft, Info, ShieldCheck,
  FileText, Building2, Users, Monitor, Settings, Cloud, MessageSquare, Server,
  Calendar, ListChecks, Eye, ArrowRight, BookOpen, Activity, Briefcase, Database
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

type SortField = 'severity' | 'control_name' | 'module_name' | 'result';
type SortOrder = 'ASC' | 'DESC';

const scoreColorMap: Record<string, { hex: string; text: string; bg: string; lightBg: string; ring: string; label: string }> = {
  red:    { hex: '#DC2626', text: 'text-red-700',    bg: 'bg-red-600',    lightBg: 'bg-red-50',    ring: 'ring-red-200',    label: 'Critical' },
  orange: { hex: '#EA580C', text: 'text-orange-700', bg: 'bg-orange-600', lightBg: 'bg-orange-50', ring: 'ring-orange-200', label: 'Poor' },
  yellow: { hex: '#CA8A04', text: 'text-yellow-700', bg: 'bg-yellow-600', lightBg: 'bg-yellow-50', ring: 'ring-yellow-200', label: 'Fair' },
  blue:   { hex: '#2563EB', text: 'text-blue-700',   bg: 'bg-blue-600',   lightBg: 'bg-blue-50',   ring: 'ring-blue-200',   label: 'Good' },
  green:  { hex: '#059669', text: 'text-emerald-700',bg: 'bg-emerald-600',lightBg: 'bg-emerald-50',ring: 'ring-emerald-200',label: 'Excellent' },
  gray:   { hex: '#6B7280', text: 'text-gray-700',   bg: 'bg-gray-600',   lightBg: 'bg-gray-50',   ring: 'ring-gray-200',   label: 'No Data' },
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string; leftBar: string; softBg: string }> = {
  critical: { bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-200',     dot: 'bg-red-500',     leftBar: 'border-l-red-500',     softBg: 'bg-red-50' },
  high:     { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-200',  dot: 'bg-orange-500',  leftBar: 'border-l-orange-500',  softBg: 'bg-orange-50' },
  medium:   { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-200',   dot: 'bg-amber-500',   leftBar: 'border-l-amber-500',   softBg: 'bg-amber-50' },
  low:      { bg: 'bg-sky-100',     text: 'text-sky-800',     border: 'border-sky-200',     dot: 'bg-sky-500',     leftBar: 'border-l-sky-500',     softBg: 'bg-sky-50' },
};

const RESULT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pass:               { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Pass' },
  fail:               { bg: 'bg-red-100',     text: 'text-red-800',     label: 'Fail' },
  not_applicable:     { bg: 'bg-gray-100',    text: 'text-gray-700',    label: 'N/A' },
  needs_manual_review:{ bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'Review' },
  error:              { bg: 'bg-orange-100',  text: 'text-orange-800',  label: 'Error' },
  info:               { bg: 'bg-sky-100',     text: 'text-sky-800',     label: 'Info' },
};

const MODULE_CONFIG: Record<string, { icon: any; color: string; bgColor: string; barColor: string; hex: string }> = {
  'Entra ID':         { icon: Users,         color: 'text-blue-600',    bgColor: 'bg-blue-50',    barColor: 'bg-blue-500',    hex: '#2563EB' },
  'Email':            { icon: Mail,          color: 'text-purple-600',  bgColor: 'bg-purple-50',  barColor: 'bg-purple-500',  hex: '#9333EA' },
  'Purview':          { icon: ShieldCheck,   color: 'text-emerald-600', bgColor: 'bg-emerald-50', barColor: 'bg-emerald-500', hex: '#059669' },
  'Intune':           { icon: Monitor,       color: 'text-cyan-600',    bgColor: 'bg-cyan-50',    barColor: 'bg-cyan-500',    hex: '#0891B2' },
  'M365 Admin Center':{ icon: Settings,      color: 'text-slate-600',   bgColor: 'bg-slate-50',   barColor: 'bg-slate-500',   hex: '#475569' },
  'Cloud Apps':       { icon: Cloud,         color: 'text-indigo-600',  bgColor: 'bg-indigo-50',  barColor: 'bg-indigo-500',  hex: '#4F46E5' },
  'Teams':            { icon: MessageSquare, color: 'text-teal-600',    bgColor: 'bg-teal-50',    barColor: 'bg-teal-500',    hex: '#0D9488' },
  'SharePoint':       { icon: Server,        color: 'text-orange-600',  bgColor: 'bg-orange-50',  barColor: 'bg-orange-500',  hex: '#EA580C' },
};

function getModuleConfig(name: string) {
  return MODULE_CONFIG[name] || { icon: Shield, color: 'text-gray-600', bgColor: 'bg-gray-50', barColor: 'bg-gray-500', hex: '#6B7280' };
}

function getScoreColorInfo(bandColor: string) {
  return scoreColorMap[bandColor as keyof typeof scoreColorMap] || scoreColorMap.gray;
}

function getSeverityStyle(severity: string) {
  return SEVERITY_STYLES[severity] || SEVERITY_STYLES.medium;
}

function getResultStyle(result: string) {
  return RESULT_STYLES[result] || { bg: 'bg-gray-100', text: 'text-gray-700', label: result || 'Unknown' };
}

function ScoreGauge({ score, bandColor, scoreBand, bandDescription }: { score: number; bandColor: string; scoreBand?: string; bandDescription?: string }) {
  const safeScore = score == null ? 0 : Math.min(Math.max(score, 0), 100);
  const colorInfo = getScoreColorInfo(bandColor);
  const radius = 72;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const percent = safeScore / 100;
  const dashArray = `${percent * circumference} ${circumference}`;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: radius * 2, height: radius * 2 }}>
        <svg width={radius * 2} height={radius * 2} className="transform -rotate-90">
          <circle stroke="#F3F4F6" fill="none" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
          <circle
            stroke={colorInfo.hex}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={dashArray}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-gray-900 leading-none">{safeScore}</span>
          <span className="text-xs text-gray-400 mt-1 font-medium">out of 100</span>
        </div>
      </div>
      {scoreBand && (
        <div className="mt-5 text-center">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${colorInfo.bg} text-white`}>
            {scoreBand}
          </span>
          {bandDescription && <p className="text-xs text-gray-500 mt-3 max-w-[220px] leading-relaxed">{bandDescription}</p>}
        </div>
      )}
    </div>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 rounded animate-pulse ${className}`} />;
}

function ResultsPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <SkeletonBlock className="h-8 w-64 mb-2" />
          <SkeletonBlock className="h-4 w-96" />
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-20 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonBlock className="h-80" />
          <SkeletonBlock className="h-80" />
          <SkeletonBlock className="h-80" />
        </div>
        <SkeletonBlock className="h-64 w-full" />
      </main>
    </div>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [modules, setModules] = useState<AssessmentModule[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [detailedRequest, setDetailedRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmails, setShareEmails] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [includeFindings, setIncludeFindings] = useState(true);
  const [includeModules, setIncludeModules] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ link: string; copied: boolean } | null>(null);
  const [showFindingsTable, setShowFindingsTable] = useState(false);
  const [findingFilter, setFindingFilter] = useState<string>('all');
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
      setError(null);
      const [assessmentRes, modulesRes, findingsRes] = await Promise.all([
        api.get(`/assessments/${params.id}`),
        api.get(`/assessments/${params.id}/modules`),
        api.get(`/assessments/${params.id}/findings`),
      ]);
      setAssessment(assessmentRes.data.data);
      setModules(modulesRes.data.data || []);
      setFindings(findingsRes.data.data || []);

      try {
        const metaRes = await api.get(`/assessments/${params.id}/metadata`);
        const metaMap: Record<string, string> = {};
        (metaRes.data.data || []).forEach((m: any) => { metaMap[m.key] = m.value; });
        setMetadata(metaMap);
      } catch (e) {
        // metadata endpoint optional
      }

      if (assessmentRes.data.data?.type === 'detailed') {
        try {
          const requestRes = await api.get(`/assessments/detailed/${params.id}/request`);
          setDetailedRequest(requestRes.data.data);
        } catch (e) {
          // no detailed request
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch results:', err);
      setError(err?.response?.data?.error || 'Failed to load assessment results');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/reports/${params.id}/pdf`, '_blank');
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
        emails, message: shareMessage, includeFindings, includeModules,
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

  const formatDuration = (ms: number | undefined): string => {
    let resolved = ms;
    if ((!resolved || resolved <= 0) && assessment?.startedAt && assessment?.completedAt) {
      resolved = new Date(assessment.completedAt).getTime() - new Date(assessment.startedAt).getTime();
    }
    if (!resolved || resolved <= 0) return 'Not available';
    const totalSeconds = Math.floor(resolved / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const formatCompletedOn = (dateString: string | Date | undefined): string => {
    if (!dateString) return 'Not available';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Not available';
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  const filteredFindings = useMemo(() => {
    let result = [...findings];
    if (findingFilter !== 'all') {
      if (['critical', 'high', 'medium', 'low'].includes(findingFilter)) {
        result = result.filter((f: any) => f.severity === findingFilter);
      } else {
        result = result.filter((f: any) => f.result === findingFilter);
      }
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
        comparison = (severityOrder[a.severity as string] ?? 4) - (severityOrder[b.severity as string] ?? 4);
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
    if (sortField !== field) return <ChevronDown className="w-3.5 h-3.5 text-gray-400" />;
    return sortOrder === 'ASC' ?
      <ChevronUp className="w-3.5 h-3.5 text-primary-600" /> :
      <ChevronDown className="w-3.5 h-3.5 text-primary-600" />;
  };

  if (loading) {
    return <ResultsPageSkeleton />;
  }

  if (error || !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to load assessment</h2>
          <p className="text-sm text-gray-500 mb-6">{error || 'Assessment not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const bandColor = metadata.band_color || 'gray';
  const colorInfo = getScoreColorInfo(bandColor);
  const overallScore = assessment.overallScore ?? 0;
  const bandDescription = metadata.band_description || '';

  const passedTotal = findings.filter((f: any) => f.result === 'pass').length;
  const failedTotal = findings.filter((f: any) => f.result === 'fail').length;
  const naTotal = findings.filter((f: any) => f.result === 'not_applicable').length;
  const errorTotal = findings.filter((f: any) => f.result === 'error').length;
  const reviewTotal = findings.filter((f: any) => f.result === 'needs_manual_review').length;
  const infoTotal = findings.filter((f: any) => f.result === 'info').length;
  const totalFindings = findings.length;
  const assessedTotal = totalFindings - naTotal - infoTotal;

  const severityCounts = {
    critical: findings.filter((f: any) => f.severity === 'critical' && f.result === 'fail').length,
    high:     findings.filter((f: any) => f.severity === 'high'     && f.result === 'fail').length,
    medium:   findings.filter((f: any) => f.severity === 'medium'   && f.result === 'fail').length,
    low:      findings.filter((f: any) => f.severity === 'low'      && f.result === 'fail').length,
  };

  const pieData = [
    { name: 'Passed',  value: passedTotal, color: '#10B981' },
    { name: 'Failed',  value: failedTotal, color: '#EF4444' },
    { name: 'N/A',     value: naTotal,     color: '#94A3B8' },
  ];

  const failedFindings = findings.filter((f: any) => f.result === 'fail');
  const topFindings = [...failedFindings].sort((a: any, b: any) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  }).slice(0, 5);

  const keyRecommendations = [...failedFindings]
    .filter((f: any) => f.recommendation)
    .sort((a: any, b: any) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    })
    .slice(0, 5);

  const infoMetrics = findings.filter((f: any) => f.result === 'info');

  const statusBanner = detailedRequest ? (
    <div className={`rounded-xl p-5 mb-6 border ${
      detailedRequest.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
      detailedRequest.status === 'in_review' ? 'bg-purple-50 border-purple-200' :
      detailedRequest.status === 'awaiting_client' ? 'bg-amber-50 border-amber-200' :
      'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center">
          <div className={`p-2 rounded-lg mr-3 ${
            detailedRequest.status === 'completed' ? 'bg-emerald-100' :
            detailedRequest.status === 'in_review' ? 'bg-purple-100' :
            detailedRequest.status === 'awaiting_client' ? 'bg-amber-100' : 'bg-blue-100'
          }`}>
            <CheckCircle2 className={`w-5 h-5 ${
              detailedRequest.status === 'completed' ? 'text-emerald-600' :
              detailedRequest.status === 'in_review' ? 'text-purple-600' :
              detailedRequest.status === 'awaiting_client' ? 'text-amber-600' : 'text-blue-600'
            }`} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Detailed Assessment {(detailedRequest.status || '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
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
            <p className="text-xs text-gray-500">Assessor</p>
            <p className="text-sm font-medium text-gray-900">{detailedRequest.assessor_name}</p>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="rounded-xl p-5 mb-6 border border-emerald-200 bg-emerald-50/60">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center">
          <div className="p-2 rounded-lg bg-emerald-100 mr-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Assessment Completed</h2>
            <p className="text-sm text-gray-600 mt-0.5">Your assessment has completed successfully. Review your results below.</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ========== REPORT HEADER ========== */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-3">
            <div className="flex items-center min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center mr-3 flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-bold text-gray-900">Aegis</h1>
                  <span className="text-gray-300">/</span>
                  <h1 className="text-base font-semibold text-gray-700">Microsoft 365 Security Assessment</h1>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {assessment.tenantName || 'Unknown Tenant'} • {assessment.type ? assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1) : ''} Assessment
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
              </button>
               <button
                 onClick={() => setShowShareModal(true)}
                 className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
               >
                <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
              </button>
            </div>
          </div>
          {/* meta row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 pb-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-gray-700">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatCompletedOn(assessment.completedAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span className="capitalize">{assessment.type || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>{assessment.tenantName || 'Unknown Tenant'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ========== MAIN ========== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Status banner */}
        {statusBanner}

        {/* ========== ASSESSMENT SUMMARY STRIP ========== */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-gray-100">
            <SummaryCell icon={FileText}     label="Type"          value={assessment.type ? assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1) : 'N/A'} />
            <SummaryCell icon={Building2}    label="Tenant"        value={assessment.tenantName || 'Not available'} />
            <SummaryCell icon={Calendar}     label="Completed"     value={formatCompletedOn(assessment.completedAt)} />
            <SummaryCell icon={Clock}        label="Duration"      value={formatDuration(assessment.durationMs)} />
            <SummaryCell icon={ListChecks}   label="Controls"      value={assessment.controlsAssessed != null ? assessment.controlsAssessed.toString() : '0'} />
            <SummaryCell icon={Activity}     label="Score Band"    value={assessment.scoreBand || 'Not available'} valueClassName={colorInfo.text} />
          </div>
        </div>

        {/* ========== SCORE + EXEC SUMMARY + RISK ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Score */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall Security Score</h2>
              <Shield className="w-4 h-4 text-gray-400" />
            </div>
            <ScoreGauge score={overallScore} bandColor={bandColor} scoreBand={assessment.scoreBand} bandDescription={bandDescription} />
          </div>

          {/* Executive summary */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Executive Summary</h2>
              <Briefcase className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              {assessment.tenantName || 'This tenant'} received an overall security score of{' '}
              <span className={`font-semibold ${colorInfo.text}`}>{overallScore}/100</span>
              {assessment.scoreBand ? <>, rated as <span className={`font-semibold ${colorInfo.text}`}>{assessment.scoreBand}</span></> : null}
              {' '}based on {assessment.controlsAssessed ?? totalFindings} assessed control{(assessment.controlsAssessed ?? totalFindings) === 1 ? '' : 's'}.
            </p>
            <div className="space-y-2">
              <PriorityRow severity="critical" count={severityCounts.critical} label="Critical findings" />
              <PriorityRow severity="high"     count={severityCounts.high}     label="High severity findings" />
              <PriorityRow severity="medium"   count={severityCounts.medium}   label="Medium severity findings" />
              <PriorityRow severity="low"      count={severityCounts.low}      label="Low severity findings" />
            </div>
            {bandDescription && (
              <div className={`mt-4 rounded-lg p-3 ${colorInfo.lightBg} border ${colorInfo.ring}`}>
                <p className="text-xs text-gray-700 leading-relaxed">{bandDescription}</p>
              </div>
            )}
          </div>

          {/* Risk distribution */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk Distribution</h2>
              <BarMiniIcon />
            </div>
            <div className="space-y-3">
              <RiskBar label="Critical" count={severityCounts.critical} total={Math.max(failedTotal, 1)} color="bg-red-500" />
              <RiskBar label="High"     count={severityCounts.high}     total={Math.max(failedTotal, 1)} color="bg-orange-500" />
              <RiskBar label="Medium"   count={severityCounts.medium}   total={Math.max(failedTotal, 1)} color="bg-amber-500" />
              <RiskBar label="Low"      count={severityCounts.low}      total={Math.max(failedTotal, 1)} color="bg-sky-500" />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-emerald-600">{passedTotal}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Passed</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-600">{failedTotal}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Failed</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-500">{naTotal}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">N/A</p>
              </div>
            </div>
          </div>
        </div>

        {/* ========== RESULTS OVERVIEW + TOP FINDINGS ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Results overview donut */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Results Overview</h2>
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="flex-shrink-0 h-[200px] w-[200px] relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                      formatter={(value: any, name: any) => [`${value} controls`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-gray-900">{assessedTotal}</span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Assessed</span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2.5">
                <ResultLegendRow color="#10B981" label="Passed"  value={passedTotal}  total={totalFindings} />
                <ResultLegendRow color="#EF4444" label="Failed"  value={failedTotal}  total={totalFindings} />
                <ResultLegendRow color="#94A3B8" label="N/A"     value={naTotal}      total={totalFindings} />
                {errorTotal > 0 && <ResultLegendRow color="#F97316" label="Error"   value={errorTotal}   total={totalFindings} />}
                {reviewTotal > 0 && <ResultLegendRow color="#F59E0B" label="Review" value={reviewTotal}  total={totalFindings} />}
                <div className="pt-2.5 mt-1 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Total controls evaluated</p>
                  <p className="text-xl font-bold text-gray-900">{totalFindings}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top findings */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Top Findings</h2>
              {failedTotal > 5 && (
                <button
                  onClick={() => {
                    setShowFindingsTable(true);
                    setTimeout(() => {
                      const el = document.getElementById('detailed-findings');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center"
                >
                  View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              )}
            </div>
            {topFindings.length === 0 ? (
              <EmptyState message="No failed findings detected. Your environment passed all evaluated controls." />
            ) : (
              <div className="space-y-2.5">
                {topFindings.map((f: any) => {
                  const ss = getSeverityStyle(f.severity);
                  return (
                    <div key={f.id} className={`flex items-start p-3 rounded-lg border ${ss.border} ${ss.softBg}`}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${ss.bg} ${ss.text} mr-3 flex-shrink-0 mt-0.5`}>
                        {f.severity || 'medium'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {f.control_name || 'Unknown Control'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {f.module_name && <span className="font-medium">{f.module_name}</span>}
                          {f.module_name && f.control_description && <span> · </span>}
                          {f.control_description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========== MODULE SCORES ========== */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Module Scores</h2>
              <p className="text-xs text-gray-500 mt-0.5">Breakdown of security controls across assessed modules</p>
            </div>
            <Database className="w-5 h-5 text-gray-400" />
          </div>
          {modules.length === 0 ? (
            <EmptyState message="No module data available for this assessment." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((module) => {
                const total = (module.passedCount || 0) + (module.failedCount || 0) + (module.notApplicableCount || 0);
                const assessedInModule = (module.passedCount || 0) + (module.failedCount || 0);
                const isNotAssessed = total === 0 || (assessedInModule === 0 && module.notApplicableCount === 0);
                const score = module.moduleScore != null
                  ? module.moduleScore
                  : (total > 0 ? Math.round(((module.passedCount || 0) / total) * 100) : 0);
                const config = getModuleConfig(module.moduleName);
                const Icon = config.icon;
                const isClickable = module.moduleName === 'Email';
                return (
                  <div
                    key={module.id}
                    className={`rounded-lg border border-gray-200 p-4 ${isClickable ? 'cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all' : ''}`}
                    onClick={isClickable ? () => router.push(`/results/${assessment?.id}/email`) : undefined}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center min-w-0">
                        <div className={`p-1.5 rounded-md ${config.bgColor} mr-2.5 flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{module.moduleName}</p>
                      </div>
                      {isNotAssessed ? (
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded">Not Assessed</span>
                      ) : (
                        <span className={`text-lg font-bold ${score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {score}<span className="text-xs text-gray-400 font-normal">/100</span>
                        </span>
                      )}
                    </div>
                    {isNotAssessed ? (
                      <p className="text-xs text-gray-400">No controls evaluated for this module</p>
                    ) : (
                      <>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(Math.max(score, 0), 100)}%`, backgroundColor: config.hex }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-700 font-medium">{module.passedCount || 0} passed</span>
                          <span className="text-red-600 font-medium">{module.failedCount || 0} failed</span>
                          <span className="text-gray-400">{module.notApplicableCount || 0} N/A</span>
                        </div>
                        {isClickable && (
                          <p className="text-[10px] text-primary-600 mt-2 font-medium flex items-center">
                            Click for details <ArrowRight className="w-3 h-3 ml-1" />
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========== REPORT RETENTION / DOWNLOAD ========== */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start">
              <div className="p-2 rounded-lg bg-blue-50 mr-3 flex-shrink-0">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Report Retention</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Available for download until <span className="font-medium text-gray-700">{getReportExpiryDate()}</span> ({getDaysUntilExpiry()} days remaining). After this date, the report will be archived.
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0"
            >
              <Download className="w-4 h-4 mr-1.5" /> Download PDF Report
            </button>
          </div>
        </div>

        {/* ========== INFORMATIONAL METRICS ========== */}
        {infoMetrics.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Informational Metrics</h2>
                <p className="text-xs text-gray-500 mt-0.5">Environment context and configuration details discovered during the assessment</p>
              </div>
              <Info className="w-5 h-5 text-sky-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {infoMetrics.map((m: any) => (
                <div key={m.id} className="border border-sky-100 bg-sky-50/40 rounded-lg p-3.5">
                  <div className="flex items-start">
                    <div className="p-1.5 rounded-md bg-sky-100 mr-2.5 flex-shrink-0">
                      {m.module_name === 'Email' ? <Mail className="w-3.5 h-3.5 text-sky-600" /> : <Shield className="w-3.5 h-3.5 text-sky-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 line-clamp-2">{m.control_name || 'Unknown Metric'}</p>
                      {m.module_name && <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{m.module_name}</p>}
                      <p className="text-sm text-sky-900 mt-1.5 break-words">{m.evidence || 'Not available'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== DETAILED FINDINGS ========== */}
        <div id="detailed-findings" className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Detailed Findings</h2>
              <p className="text-xs text-gray-500 mt-0.5">{totalFindings} total finding{totalFindings === 1 ? '' : 's'} evaluated</p>
            </div>
            <button
              onClick={() => setShowFindingsTable(!showFindingsTable)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors self-start sm:self-auto"
            >
              {showFindingsTable ? 'Hide Table' : 'Show Table'}
              {showFindingsTable ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
            </button>
          </div>

          {showFindingsTable && (
            <>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={findingSearch}
                    onChange={(e) => setFindingSearch(e.target.value)}
                    placeholder="Search findings, controls, or modules..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <select
                    value={findingFilter}
                    onChange={(e) => setFindingFilter(e.target.value)}
                    className="pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 appearance-none bg-white w-full md:w-auto"
                  >
                    <option value="all">All Results</option>
                    <option value="fail">Failed only</option>
                    <option value="pass">Passed only</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="error">Error</option>
                    <option value="info">Info</option>
                    <option value="needs_manual_review">Needs Review</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('control_name')}>
                        <div className="flex items-center min-w-[160px]">Control {getSortIcon('control_name')}</div>
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('module_name')}>
                        <div className="flex items-center min-w-[100px]">Module {getSortIcon('module_name')}</div>
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('severity')}>
                        <div className="flex items-center w-20">Severity {getSortIcon('severity')}</div>
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('result')}>
                        <div className="flex items-center w-20">Status {getSortIcon('result')}</div>
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        <div className="min-w-[180px]">Recommendation</div>
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-16">Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredFindings.map((f: any) => {
                      const ss = getSeverityStyle(f.severity);
                      const rs = getResultStyle(f.result);
                      return (
                        <tr key={f.id} className="hover:bg-gray-50/50">
                          <td className="px-3 py-3 align-top">
                            <p className="text-sm font-medium text-gray-900 leading-snug">{f.control_name || 'Unknown Control'}</p>
                            {f.control_id && <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{f.control_id}</p>}
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-gray-700">{f.module_name || '—'}</td>
                          <td className="px-3 py-3 align-top">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${ss.bg} ${ss.text}`}>
                              {f.severity || 'medium'}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${rs.bg} ${rs.text}`}>
                              {rs.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-gray-600 leading-relaxed" style={{ wordBreak: 'break-word' }}>
                            {f.recommendation || '—'}
                          </td>
                          <td className="px-3 py-3 align-top text-center">
                            <button
                              onClick={() => { setSelectedFinding(f); setShowEvidenceModal(true); }}
                              className="text-primary-600 hover:text-primary-700 text-xs font-medium inline-flex items-center"
                            >
                              <Eye className="w-3.5 h-3.5 mr-0.5" /> View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredFindings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-12 text-center text-sm text-gray-500">
                          No findings match the current filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                <span>Showing {filteredFindings.length} of {findings.length} findings</span>
              </div>
            </>
          )}
        </div>

        {/* ========== KEY RECOMMENDATIONS ========== */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Key Recommendations</h2>
              <p className="text-xs text-gray-500 mt-0.5">Prioritized actions to improve your security posture</p>
            </div>
            <BookOpen className="w-5 h-5 text-gray-400" />
          </div>
          {keyRecommendations.length === 0 ? (
            <EmptyState message="No critical recommendations at this time. Your environment has no failed controls requiring remediation." />
          ) : (
            <div className="space-y-3">
              {keyRecommendations.map((f: any) => {
                const ss = getSeverityStyle(f.severity);
                return (
                  <div key={f.id} className={`flex items-start p-4 rounded-lg border-l-4 ${ss.leftBar} bg-white border border-gray-200`}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${ss.bg} ${ss.text} mr-3 flex-shrink-0 mt-0.5`}>
                      {f.severity || 'medium'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{f.control_name || 'Unknown Control'}</p>
                      {f.module_name && <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{f.module_name}</p>}
                      <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{f.recommendation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========== NEXT STEPS ========== */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Next Steps</h2>
              <p className="text-xs text-gray-500 mt-0.5">Recommended action plan following this assessment</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NextStepCard
              number="01"
              title="Review detailed findings"
              description="Examine all failed and needs-review controls in the findings table to understand each gap."
            />
            <NextStepCard
              number="02"
              title="Prioritize critical remediation"
              description="Address Critical and High severity findings first to reduce the most significant risk exposure."
            />
            <NextStepCard
              number="03"
              title="Download the full report"
              description="Share the PDF report with stakeholders and track remediation progress over time."
            />
            <NextStepCard
              number="04"
              title="Schedule reassessment"
              description="Re-assess after remediation to verify improvements and maintain a strong security posture."
            />
          </div>
        </div>
      </main>

      {/* ========== SHARE MODAL ========== */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Share Report</h3>
              <button onClick={() => { setShowShareModal(false); setShareResult(null); }} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            {!shareResult ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Addresses (comma-separated)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={shareEmails}
                      onChange={(e) => setShareEmails(e.target.value)}
                      placeholder="john@example.com, jane@example.com"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Message (optional)</label>
                  <textarea
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                    placeholder="Please review the attached security assessment report..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="mb-5 space-y-2">
                  <label className="flex items-center text-sm text-gray-700">
                    <input type="checkbox" checked={includeFindings} onChange={(e) => setIncludeFindings(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2" />
                    Include findings
                  </label>
                  <label className="flex items-center text-sm text-gray-700">
                    <input type="checkbox" checked={includeModules} onChange={(e) => setIncludeModules(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2" />
                    Include module scores
                  </label>
                </div>
                <button onClick={handleShare} disabled={sharing} className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
                  {sharing ? 'Sharing...' : 'Share Report'}
                </button>
              </>
            ) : (
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-gray-900 font-medium mb-1">Report shared successfully!</p>
                <p className="text-sm text-gray-500 mb-4">The report has been shared with {shareEmails.split(',').length} recipient(s).</p>
                <div className="bg-gray-50 rounded-md p-3 mb-4">
                  <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">Shareable Link (expires in 30 days)</p>
                  <div className="flex items-center">
                    <input type="text" value={shareResult.link} readOnly className="flex-1 text-xs bg-white border border-gray-300 rounded px-2 py-1.5 mr-2 font-mono" />
                    <button onClick={copyToClipboard} className="p-1.5 text-gray-600 hover:text-gray-900" title="Copy to clipboard">
                      {shareResult.copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button onClick={() => { setShowShareModal(false); setShareResult(null); setShareEmails(''); setShareMessage(''); }} className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 text-sm font-medium">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== EVIDENCE MODAL ========== */}
      {showEvidenceModal && selectedFinding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Control Evidence</h3>
              <button onClick={() => { setShowEvidenceModal(false); setSelectedFinding(null); }} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto -mx-2 px-2">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">{selectedFinding.control_name || 'Unknown Control'}</h4>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${getResultStyle(selectedFinding.result).bg} ${getResultStyle(selectedFinding.result).text}`}>
                    {getResultStyle(selectedFinding.result).label}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${getSeverityStyle(selectedFinding.severity).bg} ${getSeverityStyle(selectedFinding.severity).text}`}>
                    {selectedFinding.severity || 'medium'}
                  </span>
                  {selectedFinding.module_name && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-700">
                      {selectedFinding.module_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Evidence</h5>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-md border border-gray-100">
                  {selectedFinding.evidence || 'No evidence available'}
                </p>
              </div>
              {selectedFinding.recommendation && (
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recommendation</h5>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-md border border-gray-100">
                    {selectedFinding.recommendation}
                  </p>
                </div>
              )}
              {selectedFinding.details && (
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Details</h5>
                  <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md border border-gray-100 overflow-auto max-h-60">
                    {JSON.stringify(selectedFinding.details, null, 2)}
                  </pre>
                </div>
              )}
              {selectedFinding.error && (
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Error</h5>
                  <pre className="text-xs text-red-600 bg-red-50 p-3 rounded-md border border-red-100 overflow-auto max-h-60">
                    {JSON.stringify(selectedFinding.error, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCell({ icon: Icon, label, value, valueClassName = 'text-gray-900' }: { icon: any; label: string; value: string; valueClassName?: string }) {
  return (
    <div className="p-4 flex items-start">
      <div className="p-1.5 rounded-md bg-gray-50 mr-3 flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-semibold mt-0.5 truncate ${valueClassName}`}>{value}</p>
      </div>
    </div>
  );
}

function PriorityRow({ severity, count, label }: { severity: string; count: number; label: string }) {
  const ss = getSeverityStyle(severity);
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center">
        <span className={`w-2 h-2 rounded-full ${ss.dot} mr-2.5`} />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <span className={`text-sm font-bold ${count > 0 ? ss.text : 'text-gray-400'}`}>{count}</span>
    </div>
  );
}

function RiskBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((count / total) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="text-xs font-bold text-gray-900">{count}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResultLegendRow({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <span className="w-2.5 h-2.5 rounded-sm mr-2" style={{ backgroundColor: color }} />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="flex items-baseline">
        <span className="text-sm font-semibold text-gray-900">{value}</span>
        <span className="text-[10px] text-gray-400 ml-1.5">({pct}%)</span>
      </div>
    </div>
  );
}

function NextStepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start p-4 rounded-lg border border-gray-200 hover:border-primary-200 transition-colors">
      <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center text-sm font-bold mr-3">
        {number}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8">
      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-2">
        <CheckCircle2 className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

function BarMiniIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
      <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}
