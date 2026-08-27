'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Shield, Download, Upload, Send, CheckCircle2, XCircle, AlertTriangle,
  Eye, Edit3, Save, FileText, Image, Paperclip, MessageSquare, Plus, Trash2
} from 'lucide-react';

interface Finding {
  id: string;
  assessmentModuleId: string;
  controlCatalogId: string;
  controlName: string;
  moduleName: string;
  result: string;
  severity: string;
  evidence: string;
  recommendation: string;
  source: string;
  status?: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  reviewerNotes?: string;
}

interface Module {
  id: string;
  moduleName: string;
  collectionStatus: string;
  moduleScore?: number;
}

interface ControlCatalogItem {
  id: string;
  controlName: string;
  moduleName: string;
  description: string;
  automatable: boolean;
  severity: string;
}

interface ManualFindingForm {
  controlCatalogId: string;
  result: 'pass' | 'fail' | 'not_applicable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  recommendation: string;
  assessmentModuleId: string;
}

export default function AssessorAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const [request, setRequest] = useState<any>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [controls, setControls] = useState<ControlCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'findings' | 'modules' | 'manual' | 'resources'>('findings');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualFinding, setManualFinding] = useState<ManualFindingForm>({
    controlCatalogId: '',
    result: 'fail',
    severity: 'medium',
    evidence: '',
    recommendation: '',
    assessmentModuleId: '',
  });
  const { user } = useAuthStore();

  useEffect(() => {
    fetchAssessment();
  }, [params.id]);

  const fetchAssessment = async () => {
    try {
      const response = await api.get(`/assessor/assessment/${params.id}`);
      setRequest(response.data.data.request);
      setFindings(response.data.data.findings.map((f: any) => ({
        id: f.id,
        assessmentModuleId: f.assessment_module_id || f.id,
        controlCatalogId: f.control_catalog_id,
        controlName: f.control_name,
        moduleName: f.module_name,
        result: f.result,
        severity: f.severity,
        evidence: f.evidence,
        recommendation: f.recommendation,
        source: f.source,
        status: f.status || 'pending',
        reviewerNotes: f.reviewerNotes || '',
      })));
      setModules(response.data.data.modules);
      
      // Fetch control catalog for manual review
      const controlsResponse = await api.get('/controls?automatable=false');
      if (controlsResponse.data.success) {
        setControls(controlsResponse.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch assessment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFindingAction = (findingId: string, action: 'approved' | 'rejected' | 'needs_revision') => {
    setFindings(prev => prev.map(f =>
      f.id === findingId ? { ...f, status: action } : f
    ));
  };

  const handleUpdateReviewNotes = (findingId: string, notes: string) => {
    setFindings(prev => prev.map(f =>
      f.id === findingId ? { ...f, reviewerNotes: notes } : f
    ));
  };

  const handleCreateManualFinding = async () => {
    if (!manualFinding.controlCatalogId || !manualFinding.evidence) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/assessor/assessment/${params.id}/findings`, {
        findings: [{
          controlCatalogId: manualFinding.controlCatalogId,
          result: manualFinding.result,
          severity: manualFinding.severity,
          evidence: manualFinding.evidence,
          recommendation: manualFinding.recommendation,
          // assessmentModuleId is auto-resolved by backend from controlCatalogId
        }],
      });
      
      // Add the new finding to the list
      const newFinding: Finding = {
        id: response.data.data.findings?.[0]?.id || `manual-${Date.now()}`,
        assessmentModuleId: '', // Will be resolved by backend
        controlCatalogId: manualFinding.controlCatalogId,
        controlName: controls.find(c => c.id === manualFinding.controlCatalogId)?.controlName || 'Unknown',
        moduleName: controls.find(c => c.id === manualFinding.controlCatalogId)?.moduleName || 'Unknown',
        result: manualFinding.result,
        severity: manualFinding.severity,
        evidence: manualFinding.evidence,
        recommendation: manualFinding.recommendation,
        source: 'manual',
        status: 'pending',
      };
      
      setFindings(prev => [...prev, newFinding]);
      setShowManualForm(false);
      setManualFinding({
        controlCatalogId: '',
        result: 'fail',
        severity: 'medium',
        evidence: '',
        recommendation: '',
        assessmentModuleId: '',
      });
      alert('Manual finding created successfully');
    } catch (error) {
      console.error('Failed to create manual finding:', error);
      alert('Failed to create manual finding');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFindings = async () => {
    setSubmitting(true);
    try {
      await api.post(`/assessor/assessment/${params.id}/findings`, {
        findings: findings.map(f => ({
          id: f.id,
          assessmentModuleId: f.assessmentModuleId,
          controlCatalogId: f.controlCatalogId,
          result: f.result,
          severity: f.severity,
          evidence: f.evidence,
          recommendation: f.recommendation,
          status: f.status,
          reviewerNotes: f.reviewerNotes,
        })),
      });
      alert('Findings submitted successfully');
    } catch (error) {
      console.error('Failed to submit findings:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestDocs = async () => {
    const message = prompt('Enter message for the client:');
    if (!message) return;

    try {
      await api.post(`/assessor/assessment/${params.id}/request-docs`, { message });
      alert('Document request sent to client');
    } catch (error) {
      console.error('Failed to request docs:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'needs_revision': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  // Get controls that don't have findings yet
  const controlsWithoutFindings = controls.filter(control => 
    !findings.some(f => f.controlCatalogId === control.id)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Assessment not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Aegis Assessor</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Request ID: {request.id.slice(0, 8)}...</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                request.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                request.status === 'in_review' ? 'bg-purple-100 text-purple-800' :
                request.status === 'awaiting_client' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {request.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Request Info */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Information</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Client Information</h3>
              <div className="space-y-1">
                <p className="text-sm text-gray-900">Name: {request.clientName}</p>
                <p className="text-sm text-gray-600">Email: {request.clientEmail}</p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Organization Details</h3>
              <div className="space-y-1">
                <p className="text-sm text-gray-900">Tenant: {request.tenantName}</p>
                <p className="text-sm text-gray-600">Type: {request.type}</p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Assessment Progress</h3>
              <div className="space-y-1">
                <p className="text-sm text-gray-900">Overall Score: {request.overallScore || 'N/A'}/100</p>
                <p className="text-sm text-gray-600">Modules: {modules.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('findings')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'findings'
                    ? 'border-b-2 border-primary-500 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Findings ({findings.length})
              </button>
              <button
                onClick={() => setActiveTab('modules')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'modules'
                    ? 'border-b-2 border-primary-500 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Modules ({modules.length})
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'manual'
                    ? 'border-b-2 border-primary-500 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Manual Review ({controlsWithoutFindings.length})
              </button>
              <button
                onClick={() => setActiveTab('resources')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'resources'
                    ? 'border-b-2 border-primary-500 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Download className="w-4 h-4 inline mr-2" />
                Resources
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Findings Tab */}
            {activeTab === 'findings' && (
              <div className="space-y-4">
                {findings.map((finding) => (
                  <div key={finding.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{finding.controlName}</h3>
                        <p className="text-xs text-gray-500">{finding.moduleName}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          finding.result === 'pass' ? 'bg-green-100 text-green-800' :
                          finding.result === 'fail' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {finding.result}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(finding.severity)}`}>
                          {finding.severity}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(finding.status || 'pending')}`}>
                          {finding.status || 'pending'}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {finding.source}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <p className="text-sm text-gray-700"><strong>Evidence:</strong> {finding.evidence}</p>
                      <p className="text-sm text-gray-700 mt-1"><strong>Recommendation:</strong> {finding.recommendation}</p>
                    </div>

                    {selectedFinding?.id === finding.id && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer Notes</label>
                        <textarea
                          value={reviewNotes}
                          onChange={(e) => {
                            setReviewNotes(e.target.value);
                            handleUpdateReviewNotes(finding.id, e.target.value);
                          }}
                          placeholder="Add your review notes..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleFindingAction(finding.id, 'approved')}
                          className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-lg ${
                            finding.status === 'approved'
                              ? 'bg-green-600 text-white'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleFindingAction(finding.id, 'rejected')}
                          className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-lg ${
                            finding.status === 'rejected'
                              ? 'bg-red-600 text-white'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleFindingAction(finding.id, 'needs_revision')}
                          className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-lg ${
                            finding.status === 'needs_revision'
                              ? 'bg-yellow-600 text-white'
                              : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Needs Revision
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedFinding(selectedFinding?.id === finding.id ? null : finding);
                          setReviewNotes(finding.reviewerNotes || '');
                        }}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        {selectedFinding?.id === finding.id ? 'Hide Notes' : 'Add Notes'}
                      </button>
                    </div>
                  </div>
                ))}
                {findings.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No findings to review</p>
                  </div>
                )}
              </div>
            )}

            {/* Modules Tab */}
            {activeTab === 'modules' && (
              <div className="grid md:grid-cols-2 gap-4">
                {modules.map((module) => (
                  <div key={module.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-900">{module.moduleName}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        module.collectionStatus === 'completed' ? 'bg-green-100 text-green-800' :
                        module.collectionStatus === 'failed' ? 'bg-red-100 text-red-800' :
                        module.collectionStatus === 'permission_denied' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {module.collectionStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Score: {module.moduleScore || 0}/100</span>
                      <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual Review Tab - Structured Findings Form (FR-11.4) */}
            {activeTab === 'manual' && (
              <div className="space-y-6">
                {!showManualForm ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Plus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Create Manual Finding</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Record a manual finding for a non-automatable control. This will merge into the Scoring Engine.
                    </p>
                    <button
                      onClick={() => setShowManualForm(true)}
                      className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Manual Finding
                    </button>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">New Manual Finding</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Control *</label>
                        <select
                          value={manualFinding.controlCatalogId}
                          onChange={(e) => {
                            const control = controls.find(c => c.id === e.target.value);
                            setManualFinding({
                              ...manualFinding,
                              controlCatalogId: e.target.value,
                              severity: (control?.severity as 'low' | 'medium' | 'high' | 'critical') || manualFinding.severity,
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="">Select a control...</option>
                          {controlsWithoutFindings.map(control => (
                            <option key={control.id} value={control.id}>
                              [{control.moduleName}] {control.controlName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Result *</label>
                          <select
                            value={manualFinding.result}
                            onChange={(e) => setManualFinding({ ...manualFinding, result: e.target.value as any })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option value="pass">Pass</option>
                            <option value="fail">Fail</option>
                            <option value="not_applicable">Not Applicable</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                          <select
                            value={manualFinding.severity}
                            onChange={(e) => setManualFinding({ ...manualFinding, severity: e.target.value as any })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Evidence *</label>
                        <textarea
                          value={manualFinding.evidence}
                          onChange={(e) => setManualFinding({ ...manualFinding, evidence: e.target.value })}
                          placeholder="Describe the evidence for this finding..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Recommendation</label>
                        <textarea
                          value={manualFinding.recommendation}
                          onChange={(e) => setManualFinding({ ...manualFinding, recommendation: e.target.value })}
                          placeholder="Provide remediation guidance..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>

                      <div className="flex items-center justify-end space-x-3 pt-4">
                        <button
                          onClick={() => {
                            setShowManualForm(false);
                            setManualFinding({
                              controlCatalogId: '',
                              result: 'fail',
                              severity: 'medium',
                              evidence: '',
                              recommendation: '',
                              assessmentModuleId: '',
                            });
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateManualFinding}
                          disabled={submitting}
                          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {submitting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Creating...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              Create Finding
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* List of existing manual findings */}
                {findings.filter(f => f.source === 'manual').length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Manual Findings Created</h4>
                    <div className="space-y-2">
                      {findings.filter(f => f.source === 'manual').map((finding) => (
                        <div key={finding.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{finding.controlName}</p>
                            <p className="text-xs text-gray-500">{finding.moduleName} • {finding.result} • {finding.severity}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(finding.status || 'pending')}`}>
                            {finding.status || 'pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resources Tab */}
            {activeTab === 'resources' && (
              <div className="grid md:grid-cols-2 gap-4">
                <button className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors">
                  <div className="text-center">
                    <Download className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">Download Collected Data</p>
                    <p className="text-xs text-gray-500">Raw data from Microsoft Graph</p>
                  </div>
                </button>
                <button className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors">
                  <div className="text-center">
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">Download Automated Report</p>
                    <p className="text-xs text-gray-500">Pre-generated assessment report</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={handleRequestDocs}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Send className="w-4 h-4 mr-2" />
            Request Documents from Client
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/assessor/dashboard')}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Save Draft
            </button>
            <button
              onClick={handleSubmitFindings}
              disabled={submitting}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Submit Findings
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
