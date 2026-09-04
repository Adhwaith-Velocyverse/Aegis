'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Assessment } from '@aegis/shared';
import {
  History, Search, Filter, Eye, Download, Share2, ChevronLeft, ChevronRight,
  Calendar, X, CheckSquare, Square, Trash2, MoreVertical, ArrowUpDown,
  ArrowUp, ArrowDown, RefreshCw, AlertCircle, CheckCircle2, XCircle,
  Clock, PlayCircle, BarChart3, FileText, Mail, Copy, ExternalLink, Hash
} from 'lucide-react';

type SortField = 'created_at' | 'overall_score' | 'type' | 'status' | 'completed_at' | 'duration_ms';
type SortOrder = 'ASC' | 'DESC';

export default function HistoryPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [detailedRequests, setDetailedRequests] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareAssessment, setShareAssessment] = useState<Assessment | null>(null);
  const [shareEmails, setShareEmails] = useState('');
  const [shareIncludeFindings, setShareIncludeFindings] = useState(true);
  const [shareIncludeModules, setShareIncludeModules] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const limit = 10;
  const router = useRouter();
  const { user } = useAuthStore();

  const modules = ['Entra ID', 'Email'];
  // Disabled modules (backend isActive: false) — kept for quick re-enable:
  // 'M365 Admin Center', 'Purview', 'Intune', 'Cloud Apps', 'Teams', 'SharePoint'

  useEffect(() => {
    fetchAssessments();
  }, [page, filterType, filterStatus, filterModule, dateFrom, dateTo, scoreMin, scoreMax, sortField, sortOrder]);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: sortField,
        sortOrder: sortOrder,
      });
      if (filterType) params.append('type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      if (filterModule) params.append('module', filterModule);
      if (dateFrom) params.append('startDate', dateFrom);
      if (dateTo) params.append('endDate', dateTo + 'T23:59:59');
      if (scoreMin !== '') params.append('minScore', scoreMin);
      if (scoreMax !== '') params.append('maxScore', scoreMax);

      const response = await api.get(`/assessments/history?${params.toString()}`);
      setAssessments(response.data.data);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);

      // Fetch detailed assessment requests for all detailed assessments
      const detailedAssessments = response.data.data.filter((a: Assessment) => a.type === 'detailed');
      const requestMap: Record<string, any> = {};
      await Promise.all(
        detailedAssessments.map(async (assessment: Assessment) => {
          try {
            const requestRes = await api.get(`/assessments/detailed/${assessment.id}/request`);
            requestMap[assessment.id] = requestRes.data.data;
          } catch (e) {
            // No detailed request exists
          }
        })
      );
      setDetailedRequests(requestMap);
    } catch (error) {
      console.error('Failed to fetch assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssessments = useMemo(() => {
    if (!search) return assessments;
    const lowerSearch = search.toLowerCase();
    return assessments.filter((assessment) => {
      return (
        assessment.id.toLowerCase().includes(lowerSearch) ||
        assessment.type.toLowerCase().includes(lowerSearch) ||
        assessment.status.toLowerCase().includes(lowerSearch) ||
        assessment.tenantName?.toLowerCase().includes(lowerSearch) ||
        assessment.scoreBand?.toLowerCase().includes(lowerSearch) ||
        assessment.assessmentOwner?.toLowerCase().includes(lowerSearch)
      );
    });
  }, [assessments, search]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortField(field);
      setSortOrder('DESC');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    return sortOrder === 'ASC' ?
      <ArrowUp className="w-4 h-4 text-primary-600" /> :
      <ArrowDown className="w-4 h-4 text-primary-600" />;
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAssessments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssessments.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} assessment(s)? This action cannot be undone.`)) return;

    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          api.delete(`/assessments/${id}`).catch(() => {})
        )
      );
      setAssessments(assessments.filter(a => !selectedIds.has(a.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Bulk delete error:', error);
    }
  };

  const handleShare = async () => {
    if (!shareAssessment) return;
    try {
      await api.post('/reports/share', {
        assessmentId: shareAssessment.id,
        emails: shareEmails.split(',').map(e => e.trim()).filter(Boolean),
        includeFindings: shareIncludeFindings,
        includeModules: shareIncludeModules,
      });
      setShowShareModal(false);
      setShareAssessment(null);
      setShareEmails('');
      alert('Report shared successfully!');
    } catch (error) {
      console.error('Share error:', error);
      alert('Failed to share report');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterStatus('');
    setFilterModule('');
    setDateFrom('');
    setDateTo('');
    setScoreMin('');
    setScoreMax('');
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters = filterType || filterStatus || filterModule || dateFrom || dateTo || scoreMin !== '' || scoreMax !== '' || search;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'quick': return 'bg-purple-100 text-purple-800';
      case 'detailed': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score?: number) => {
    if (score === undefined) return 'text-gray-500';
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button onClick={() => router.push('/')} className="text-gray-600 hover:text-gray-900 mr-4">
                ← Back
              </button>
              <History className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Assessment History</h1>
            </div>
            <div className="flex items-center space-x-3">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
                  showFilters || hasActiveFilters
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {hasActiveFilters && <span className="ml-1 w-2 h-2 bg-primary-600 rounded-full"></span>}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Quick Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID, type, status, or tenant name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              >
                <option value="">All Types</option>
                <option value="trial">Trial</option>
                <option value="quick">Quick</option>
                <option value="detailed">Detailed</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Score Range</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      placeholder="Min"
                      min="0"
                      max="100"
                      value={scoreMin}
                      onChange={(e) => { setScoreMin(e.target.value); setPage(1); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <span className="text-gray-500">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      min="0"
                      max="100"
                      value={scoreMax}
                      onChange={(e) => { setScoreMax(e.target.value); setPage(1); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
                  <select
                    value={filterModule}
                    onChange={(e) => { setFilterModule(e.target.value); setPage(1); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  >
                    <option value="">All Modules</option>
                    {modules.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredAssessments.length > 0 ? ((page - 1) * limit) + 1 : 0} to {Math.min(page * limit, total)} of {total} assessments
          </p>
          <button
            onClick={fetchAssessments}
            className="flex items-center text-sm text-primary-600 hover:text-primary-700"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </button>
        </div>

        {/* Assessment Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[100px]">
                     <div className="flex items-center">Request ID</div>
                   </th>
                   <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 w-[100px]" onClick={() => handleSort('type')}>
                     <div className="flex items-center">Type {getSortIcon('type')}</div>
                   </th>
                   <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 w-[90px]" onClick={() => handleSort('overall_score')}>
                     <div className="flex items-center">Score {getSortIcon('overall_score')}</div>
                   </th>
                   <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 w-[120px]" onClick={() => handleSort('status')}>
                     <div className="flex items-center">Status {getSortIcon('status')}</div>
                   </th>
                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase max-w-[180px]">Client/Tenant</th>
                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 w-[100px]" onClick={() => handleSort('created_at')}>
                     <div className="flex items-center">Requested On {getSortIcon('created_at')}</div>
                   </th>
                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 w-[100px]" onClick={() => handleSort('completed_at')}>
                     <div className="flex items-center">Completed On {getSortIcon('completed_at')}</div>
                   </th>
                   <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 w-[80px]" onClick={() => handleSort('duration_ms')}>
                     <div className="flex items-center">Duration {getSortIcon('duration_ms')}</div>
                   </th>
                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase min-w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAssessments.map((assessment) => (
                   <tr key={assessment.id} className={`hover:bg-gray-50 ${selectedIds.has(assessment.id) ? 'bg-primary-50' : ''}`}>
                     <td className="px-4 py-4">
                       <button onClick={() => toggleSelect(assessment.id)} className="text-gray-500 hover:text-gray-700">
                         {selectedIds.has(assessment.id) ?
                           <CheckSquare className="w-5 h-5 text-primary-600" /> :
                           <Square className="w-5 h-5" />
                         }
                       </button>
                     </td>
                     <td className="px-4 py-4 whitespace-nowrap">
                       <div className="flex items-center">
                         <Hash className="w-4 h-4 text-gray-400 mr-1.5" />
                         <span className="text-sm font-mono text-gray-900">{assessment.id.slice(0, 8)}...</span>
                       </div>
                     </td>
                     <td className="px-3 py-4 whitespace-nowrap">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getTypeColor(assessment.type)}`}>
                         {assessment.type}
                       </span>
                     </td>
                     <td className="px-3 py-4 whitespace-nowrap">
                       {assessment.overallScore !== undefined ? (
                         <div className="flex items-center">
                           <BarChart3 className={`w-4 h-4 mr-2 ${getScoreColor(assessment.overallScore)}`} />
                           <span className={`font-medium ${getScoreColor(assessment.overallScore)}`}>
                             {assessment.overallScore}/100
                           </span>
                         </div>
                       ) : (
                         <span className="text-gray-400">-</span>
                       )}
                     </td>
                     <td className="px-3 py-4 whitespace-nowrap">
                       <div className="flex items-center">
                         {getStatusIcon(assessment.status)}
                         <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                           assessment.status === 'completed' ? 'bg-green-100 text-green-800' :
                           assessment.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                           assessment.status === 'failed' ? 'bg-red-100 text-red-800' :
                           assessment.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                           'bg-gray-100 text-gray-800'
                         }`}>
                           {assessment.status === 'pending' && detailedRequests[assessment.id] ?
                             'Pending Review' :
                             assessment.status.replace('_', ' ')}
                         </span>
                       </div>
                     </td>
                     <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 max-w-[180px] truncate">
                       {assessment.tenantName || '-'}
                     </td>
                     <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                       {new Date(assessment.createdAt).toLocaleDateString()}
                     </td>
                     <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                       {assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString() : '-'}
                     </td>
                     <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-600">
                       {assessment.durationMs ? `${Math.round(assessment.durationMs / 1000)}s` : '-'}
                     </td>
                     <td className="px-4 py-4 whitespace-nowrap text-sm min-w-[100px]">
                       <div className="flex items-center space-x-2 flex-shrink-0">
                        {assessment.status === 'completed' && (
                          <>
                            <button
                              onClick={() => router.push(`/results/${assessment.id}`)}
                              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                              title="View Report"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => router.push(`/results/${assessment.id}`)}
                              className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setShareAssessment(assessment);
                                setShowShareModal(true);
                              }}
                              className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                              title="Share Report"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {assessment.status === 'in_progress' && assessment.type === 'detailed' && (
                          <button
                            onClick={() => router.push(`/assessment-loading?assessmentId=${assessment.id}`)}
                            className="flex items-center px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
                            title="Continue Assessment"
                          >
                            <PlayCircle className="w-4 h-4 mr-1" />
                            Continue
                          </button>
                        )}
                        {assessment.status === 'pending' && detailedRequests[assessment.id] && (
                          <span className="text-xs text-blue-600 font-medium" title="Awaiting assessor assignment">
                            Awaiting Review
                          </span>
                        )}
                        <button
                          onClick={() => copyToClipboard(assessment.id)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                          title="Copy ID"
                        >
                          {copiedId === assessment.id ?
                            <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                            <Copy className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAssessments.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <FileText className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 mb-2">No assessments found</p>
                        {hasActiveFilters ? (
                          <button onClick={clearFilters} className="text-primary-600 hover:text-primary-700 text-sm">
                            Clear filters
                          </button>
                        ) : (
                          <button onClick={() => router.push('/assessment/trial')} className="text-primary-600 hover:text-primary-700 text-sm">
                            Start your first assessment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} assessments
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Share Modal */}
      {showShareModal && shareAssessment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Share Report</h3>
                <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Addresses</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="email1@example.com, email2@example.com"
                      value={shareEmails}
                      onChange={(e) => setShareEmails(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Separate multiple emails with commas</p>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={shareIncludeFindings}
                      onChange={(e) => setShareIncludeFindings(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include findings</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={shareIncludeModules}
                      onChange={(e) => setShareIncludeModules(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include module scores</span>
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShare}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Share Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
