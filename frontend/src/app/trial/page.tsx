'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ChevronRight, CheckCircle2, AlertTriangle, Download, RefreshCw, Shield, Lock, Server, Users, Key, FileText, HardDrive, GraduationCap, ArrowLeft } from 'lucide-react';

interface Question {
  id: string;
  question: string;
  category: string;
  weight: number;
}

const categoryIcons: Record<string, any> = {
  'Identity': Shield,
  'Email Security': Lock,
  'Endpoint': Server,
  'Compliance': FileText,
  'Data Protection': Shield,
  'Resilience': HardDrive,
  'Governance': GraduationCap,
};

export default function TrialPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no' | 'unsure'>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    scoreBand: string;
    bandColor: string;
    bandDescription: string;
    yesCount: number;
    noCount: number;
    unsureCount: number;
  } | null>(null);
  const [hasConnectedTenant, setHasConnectedTenant] = useState<boolean | null>(null);
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchQuestions();
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await api.get('/tenants');
      const tenants = response.data.data || [];
      setHasConnectedTenant(tenants.some((t: any) => t.connectionStatus === 'connected'));
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await api.get('/assessments/trial/questions');
      setQuestions(response.data.data);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  };

  const startAssessment = async () => {
    try {
      const response = await api.post('/assessments/trial/start');
      return response.data.data.assessmentId;
    } catch (error) {
      console.error('Failed to start trial:', error);
      return null;
    }
  };

  const submitAssessment = async (assessmentId: string) => {
    const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));

    try {
      const response = await api.post(`/assessments/trial/${assessmentId}/submit`, { answers: answersArray });
      return response.data.data;
    } catch (error) {
      console.error('Failed to submit trial:', error);
      return null;
    }
  };

  const handleAnswer = (questionId: string, answer: 'yes' | 'no' | 'unsure') => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = async () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setLoading(true);
      const assessmentId = await startAssessment();
      if (assessmentId) {
        const data = await submitAssessment(assessmentId);
        if (data) {
          // Calculate counts
          const yesCount = Object.values(answers).filter(a => a === 'yes').length;
          const noCount = Object.values(answers).filter(a => a === 'no').length;
          const unsureCount = Object.values(answers).filter(a => a === 'unsure').length;

          setResult({
            score: data.score,
            scoreBand: data.scoreBand,
            bandColor: data.bandColor,
            bandDescription: data.bandDescription,
            yesCount,
            noCount,
            unsureCount,
          });
        }
      }
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleRetake = () => {
    setResult(null);
    setAnswers({});
    setCurrentStep(0);
  };

  const handleDownload = () => {
    // Generate a simple text report
    if (!result) return;

    let report = `VELOCYVERSE SECURITY ASSESSMENT - TRIAL RESULTS\n`;
    report += `================================================\n\n`;
    report += `Date: ${new Date().toLocaleDateString()}\n`;
    report += `Overall Score: ${result.score}/100\n`;
    report += `Security Band: ${result.scoreBand}\n\n`;
    report += `SUMMARY\n`;
    report += `-------\n`;
    report += `Yes: ${result.yesCount}\n`;
    report += `No: ${result.noCount}\n`;
    report += `Unsure: ${result.unsureCount}\n\n`;
    report += `QUESTION SUMMARY\n`;
    report += `-----------------\n`;

    questions.forEach((q, idx) => {
      const answer = answers[q.id] || 'Not answered';
      report += `${idx + 1}. ${q.question}\n`;
      report += `   Answer: ${answer.toUpperCase()}\n\n`;
    });

    report += `\nRECOMMENDATIONS\n`;
    report += `---------------\n`;
    questions.forEach((q, idx) => {
      if (answers[q.id] === 'no' || answers[q.id] === 'unsure') {
        report += `${idx + 1}. Consider implementing: ${q.question.replace('Is ', '').replace('Are ', '')}\n`;
      }
    });

    report += `\n\nConnect your tenant for a comprehensive automated assessment.\n`;
    report += `Visit: https://velocyverse.com/connect-tenant\n`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velocyverse-trial-results-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (result) {
    const scoreColor = result.bandColor === 'red' ? 'text-red-600' :
                       result.bandColor === 'yellow' ? 'text-yellow-600' :
                       result.bandColor === 'blue' ? 'text-blue-600' : 'text-green-600';

    const scoreBgColor = result.bandColor === 'red' ? 'bg-red-100 text-red-800' :
                         result.bandColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                         result.bandColor === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';

    return (
      <div className="min-h-screen py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Back to Dashboard */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          {/* Status Banner */}
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-green-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">Trial Assessment Completed</h1>
            </div>

            {/* Score Gauge */}
            <div className="my-8">
              <div className={`text-7xl font-bold ${scoreColor} mb-2`}>
                {result.score}<span className="text-3xl">/100</span>
              </div>
              <div className={`inline-flex items-center px-6 py-2 rounded-full ${scoreBgColor} font-medium text-lg`}>
                {result.scoreBand}
              </div>
              <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
                {result.bandDescription}
              </p>
            </div>

            {/* Score Summary Panel */}
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-700">{result.yesCount}</div>
                <div className="text-sm text-green-600">Yes</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-700">{result.noCount}</div>
                <div className="text-sm text-red-600">No</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-700">{result.unsureCount}</div>
                <div className="text-sm text-yellow-600">Unsure</div>
              </div>
            </div>

            {/* Question Summary Table */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Summary</h3>
              <div className="space-y-3">
                {questions.map((q, idx) => {
                  const answer = answers[q.id];
                  const answerColor = answer === 'yes' ? 'text-green-700 bg-green-100' :
                                     answer === 'no' ? 'text-red-700 bg-red-100' :
                                     answer === 'unsure' ? 'text-yellow-700 bg-yellow-100' : 'text-gray-700 bg-gray-100';
                  return (
                    <div key={q.id} className="flex items-start justify-between bg-white rounded-lg p-3 border">
                      <div className="flex-1">
                        <span className="text-sm text-gray-500 mr-2">{idx + 1}.</span>
                        <span className="text-gray-800">{q.question}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${answerColor}`}>
                        {answer ? answer.toUpperCase() : 'N/A'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key Recommendations */}
            <div className="bg-blue-50 rounded-lg p-6 mb-8 text-left">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Recommendations</h3>
              <ul className="space-y-2">
                {questions.map((q, idx) => {
                  if (answers[q.id] === 'no' || answers[q.id] === 'unsure') {
                    return (
                      <li key={q.id} className="flex items-start">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">
                          <strong>{q.category}:</strong> {q.question.replace('Is ', '').replace('Are ', '')}
                        </span>
                      </li>
                    );
                  }
                  return null;
                })}
                {questions.every(q => answers[q.id] === 'yes') && (
                  <li className="text-green-700 font-medium">Excellent! All controls are in place. Continue monitoring and maintaining your security posture.</li>
                )}
              </ul>
            </div>

            {hasConnectedTenant === false && (
              <>
                {/* Need Help Panel */}
                <div className="bg-primary-50 rounded-lg p-6 mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help Improving Your Score?</h3>
                  <p className="text-gray-600 mb-4">
                    Connect your Microsoft 365 tenant to Aegis for a comprehensive automated assessment. Our engine will analyze your actual tenant configuration and provide detailed recommendations.
                  </p>
                </div>

                {/* CTA Banner */}
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-8 mb-8 text-white">
                  <h3 className="text-2xl font-bold mb-2">Connect the Tenant to the Tool</h3>
                  <p className="text-primary-100 mb-6">
                    Get a verified, automated security assessment of your Microsoft 365 environment. No more self-reporting - let our engine do the work.
                  </p>
                  <button
                    onClick={() => router.push('/connect-tenant')}
                    className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
                  >
                    Connect Your Tenant Now
                  </button>
                </div>
              </>
            )}

            {hasConnectedTenant === true && (
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-8 mb-8 text-white">
                <h3 className="text-2xl font-bold mb-2">Ready for a Deeper Analysis?</h3>
                <p className="text-primary-100 mb-6">
                  You already have a connected tenant. Run a Quick or Detailed assessment to get a comprehensive, automated security analysis with findings and recommendations.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <button
                    onClick={() => router.push('/assessment/quick')}
                    className="flex-1 bg-white text-primary-700 py-3 px-6 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center justify-center"
                  >
                    Start Quick Assessment
                  </button>
                  <button
                    onClick={() => router.push('/assessment/detailed')}
                    className="flex-1 bg-white text-primary-700 py-3 px-6 rounded-lg font-semibold hover:bg-primary-50 transition-colors border border-primary-200 flex items-center justify-center"
                  >
                    Start Detailed Assessment
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/')}
                className="bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </button>
              <button
                onClick={handleDownload}
                className="bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Results
              </button>
              <button
                onClick={handleRetake}
                className="bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retake Assessment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;
  const currentAnswer = answers[currentQuestion.id];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start">
          <AlertTriangle className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-800">
              <strong>Please answer all questions</strong> to get an accurate security assessment. Your answers are confidential and used only to generate your personalized report.
            </p>
          </div>
        </div>

        {/* Confidentiality Note */}
        <div className="bg-gray-100 rounded-lg p-3 mb-6 text-center">
          <p className="text-xs text-gray-600">
            <Lock className="w-3 h-3 inline mr-1" />
            Your responses are confidential and not shared with third parties.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-8">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Question {currentStep + 1} of {questions.length}
              </span>
              <span className="text-sm font-medium text-gray-700">
                {answeredCount} / {questions.length} Completed
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Duplicate Progress Bar (top-right style) */}
          <div className="fixed top-4 right-4 bg-white rounded-lg shadow-md border p-3 z-50 hidden md:block">
            <div className="text-xs text-gray-600 mb-1">Progress</div>
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">{Math.round(progress)}%</div>
          </div>

          <div className="mb-8">
            <span className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-700 text-sm font-medium rounded-full mb-4">
              {currentQuestion.category}
            </span>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{currentQuestion.question}</h2>

            <div className="space-y-3">
              {(['yes', 'no', 'unsure'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(currentQuestion.id, option)}
                  className={`w-full p-4 rounded-lg border-2 text-left font-medium transition-colors ${
                    currentAnswer === option
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {option === 'yes' ? 'Yes' : option === 'no' ? 'No' : 'Unsure'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!currentAnswer || loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : currentStep === questions.length - 1 ? (
                'Submit Assessment'
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-8 bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white text-center">
          <h3 className="text-lg font-semibold mb-2">Want a Deeper Analysis?</h3>
          <p className="text-primary-100 mb-4 text-sm">
            Connect your Microsoft 365 tenant for a comprehensive automated security assessment with detailed findings and recommendations.
          </p>
          <button
            onClick={() => router.push('/connect-tenant')}
            className="bg-white text-primary-700 px-6 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors text-sm"
          >
            Learn About Detailed Assessment
          </button>
        </div>
      </div>
    </div>
  );
}
