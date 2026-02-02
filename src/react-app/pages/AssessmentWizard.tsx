/**
 * AssessmentWizard Page
 * Multi-step assessment with image upload and AI analysis
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ImageUpload, MetadataForm, ProcessingView, AssessmentReport, ChatInterface } from '../components';
import { submitAssessmentJob, getJobStatus, getJobResult, sendChatMessage, triggerWarmup } from '../lib/api';
import type { AssessmentMetadata, AssessmentReport as ReportType, ChatMessage, RoomType, StructureType } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type WizardStep = 'details' | 'processing' | 'complete' | 'chat';

type WizardState = {
  step: WizardStep;
  images: File[];
  imagePreviewUrls: string[];
  compressedDataUrls: string[]; // Pre-compressed images for API submission
  metadata: AssessmentMetadata | null;
  report: ReportType | null;
  sessionId: string | null;
  chatHistory: ChatMessage[];
  isLoading: boolean;
  isLoadingAssessment: boolean; // True while fetching assessment data for pre-fill
  error: string | null;
  processingTime?: number;
};

export function AssessmentWizard() {
  const { projectId, assessmentId } = useParams<{ projectId: string; assessmentId: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<WizardState>({
    step: 'details',
    images: [],
    imagePreviewUrls: [],
    compressedDataUrls: [],
    metadata: null,
    report: null,
    sessionId: null,
    chatHistory: [],
    isLoading: false,
    isLoadingAssessment: !!assessmentId, // True if we need to fetch assessment data
    error: null,
  });

  // Pre-populated room_type from existing assessment (project flow)
  const [existingRoomType, setExistingRoomType] = useState<RoomType | undefined>(undefined);

  // Polling interval ref for cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track consecutive polling failures (BUG-004)
  const consecutiveFailuresRef = useRef(0);
  // Track poll status for UX (cold start visibility)
  const [pollStatus, setPollStatus] = useState<'pending' | 'in_progress' | undefined>(undefined);
  // Track polling start time for progressive intervals
  const pollStartTimeRef = useRef<number>(0);

  // Polling constants
  const POLLING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (BUG-007)
  const MAX_CONSECUTIVE_FAILURES = 3;

  // Progressive polling: faster initially, slower during cold start
  function getPollingInterval(): number {
    const elapsed = Date.now() - pollStartTimeRef.current;
    if (elapsed < 30000) return 5000;   // First 30s: every 5s (responsive for warm workers)
    if (elapsed < 120000) return 10000; // 30s-2min: every 10s (cold start territory)
    return 15000;                        // 2min+: every 15s (extended wait)
  }

  // Pre-warm RunPod worker while user prepares assessment
  useEffect(() => {
    triggerWarmup();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
    };
  }, []);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Fetch existing assessment to pre-populate roomType and FDAM metadata when coming from project flow
  useEffect(() => {
    if (assessmentId) {
      fetch(`/api/assessments/${assessmentId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            const assessment = data.data;
            setExistingRoomType(assessment.room_type);

            // Build initial metadata from pre-filled FDAM fields (if dimensions exist)
            if (assessment.dimensions) {
              const initialMetadata: AssessmentMetadata = {
                roomType: assessment.room_type as RoomType,
                structureType: (assessment.structure_type as StructureType) || 'single-family',
                floor_level: assessment.floor_level,
                dimensions: {
                  length_ft: assessment.dimensions.length_ft,
                  width_ft: assessment.dimensions.width_ft,
                  height_ft: assessment.dimensions.height_ft,
                },
                sensory_observations: assessment.sensory_observations,
                isFireOrigin: assessment.is_fire_origin,
              };
              updateState({ metadata: initialMetadata, isLoadingAssessment: false });
            } else {
              updateState({ isLoadingAssessment: false });
            }
          } else {
            updateState({ isLoadingAssessment: false });
          }
        })
        .catch((err) => {
          console.error(err);
          updateState({ isLoadingAssessment: false });
        });
    }
  }, [assessmentId, updateState]);

  const handleImagesChange = useCallback(
    (images: File[], previewUrls: string[], compressedDataUrls?: string[]) => {
      updateState({
        images,
        imagePreviewUrls: previewUrls,
        compressedDataUrls: compressedDataUrls ?? [],
        error: null,
      });
    },
    [updateState]
  );

  const handleMetadataSubmit = useCallback(
    async (metadata: AssessmentMetadata) => {
      updateState({ metadata, step: 'processing', isLoading: true, error: null });

      const startTime = Date.now();

      try {
        // Submit job (returns immediately with jobId)
        // Pass compressed images for ~90% payload reduction
        const submitResult = await submitAssessmentJob(
          state.images,
          metadata,
          state.compressedDataUrls.length > 0 ? state.compressedDataUrls : undefined,
          assessmentId
        );

        if (!submitResult.success) {
          updateState({
            step: 'details',
            isLoading: false,
            error: submitResult.error.message,
          });
          return;
        }

        const { jobId } = submitResult.data;

        // Reset consecutive failures counter
        consecutiveFailuresRef.current = 0;
        pollStartTimeRef.current = Date.now();
        setPollStatus('pending');

        // Poll for completion with progressive intervals and timeout
        const schedulePoll = () => {
          pollIntervalRef.current = setTimeout(async () => {
            // Check for timeout (BUG-007)
            if (Date.now() - startTime > POLLING_TIMEOUT_MS) {
              console.error('[Wizard] Polling timeout reached');
              pollIntervalRef.current = null;
              setPollStatus(undefined);
              updateState({
                step: 'details',
                isLoading: false,
                error: 'Assessment is taking longer than expected. Please try again or contact support if the issue persists.',
              });
              return;
            }

            try {
              const statusResult = await getJobStatus(jobId);

              if (!statusResult.success) {
                // Track consecutive failures (BUG-004)
                consecutiveFailuresRef.current++;
                console.warn(`[Wizard] Status check failed (${consecutiveFailuresRef.current}/${MAX_CONSECUTIVE_FAILURES}), will retry`);

                if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
                  pollIntervalRef.current = null;
                  setPollStatus(undefined);
                  updateState({
                    step: 'details',
                    isLoading: false,
                    error: 'Unable to check assessment status. Please check your connection and try again.',
                  });
                  return;
                }
                schedulePoll(); // Keep polling on transient errors
                return;
              }

              // Reset consecutive failures on success
              consecutiveFailuresRef.current = 0;

              const { status, error } = statusResult.data;

              // Update poll status for UX (cold start visibility)
              if (status === 'pending' || status === 'in_progress') {
                setPollStatus(status);
              }

              if (status === 'completed') {
                // Stop polling
                pollIntervalRef.current = null;
                setPollStatus(undefined);

                // Fetch result
                const resultResponse = await getJobResult(jobId);
                const processingTime = Date.now() - startTime;

                if (resultResponse.success) {
                  // D1 persistence (report, images, assessment update) is now handled
                  // by the backend in handleAssessResult when assessmentId is provided

                  updateState({
                    step: 'complete',
                    report: resultResponse.data.report,
                    sessionId: resultResponse.data.sessionId,
                    isLoading: false,
                    processingTime,
                  });
                } else {
                  updateState({
                    step: 'details',
                    isLoading: false,
                    error: resultResponse.error.message,
                  });
                }
              } else if (status === 'failed') {
                // Stop polling
                pollIntervalRef.current = null;
                setPollStatus(undefined);

                updateState({
                  step: 'details',
                  isLoading: false,
                  error: error || 'Assessment processing failed',
                });
              } else {
                // For 'pending' or 'in_progress', keep polling with progressive interval
                schedulePoll();
              }
            } catch (pollError) {
              console.error('[Wizard] Polling error:', pollError);
              // Track consecutive failures (BUG-004)
              consecutiveFailuresRef.current++;

              if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
                pollIntervalRef.current = null;
                setPollStatus(undefined);
                updateState({
                  step: 'details',
                  isLoading: false,
                  error: 'Unable to check assessment status. Please check your connection and try again.',
                });
                return;
              }
              // Keep polling on transient errors
              schedulePoll();
            }
          }, getPollingInterval());
        };

        schedulePoll();
      } catch {
        updateState({
          step: 'details',
          isLoading: false,
          error: 'Failed to submit assessment',
        });
      }
    },
    [state.images, state.compressedDataUrls, assessmentId, updateState, POLLING_TIMEOUT_MS, MAX_CONSECUTIVE_FAILURES]
  );

  const handleChatMessage = useCallback(
    async (message: string) => {
      if (!state.sessionId) {
        updateState({ error: 'No session available for chat' });
        return;
      }

      // Add user message to history
      const userMessage: ChatMessage = { role: 'user', content: message };
      updateState({
        chatHistory: [...state.chatHistory, userMessage],
        isLoading: true,
      });

      try {
        const result = await sendChatMessage(state.sessionId, message);

        if (result.success) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: result.data.response,
          };
          updateState({
            chatHistory: [...state.chatHistory, userMessage, assistantMessage],
            isLoading: false,
            error: null, // Clear any previous error
          });
        } else {
          // Remove user message on failure, show error banner
          updateState({
            chatHistory: state.chatHistory.filter((m) => m !== userMessage),
            error: result.error.message,
            isLoading: false,
          });
        }
      } catch {
        // Remove user message on failure, show error banner
        updateState({
          chatHistory: state.chatHistory.filter((m) => m !== userMessage),
          error: 'Failed to send message',
          isLoading: false,
        });
      }
    },
    [state.sessionId, state.chatHistory, updateState]
  );

  const handleComplete = () => {
    // Clean up preview URLs
    state.imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));

    // Navigate back to project
    if (projectId) {
      navigate(`/projects/${projectId}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">Projects</Link>
        {projectId && (
          <>
            <span>/</span>
            <Link to={`/projects/${projectId}`} className="hover:text-foreground transition-colors">
              Project
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-foreground">New Assessment</span>
      </div>

      {/* Error Banner */}
      {state.error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
          <span>{state.error}</span>
          <button
            onClick={() => updateState({ error: null })}
            className="hover:bg-destructive/20 rounded p-1"
          >
            ×
          </button>
        </div>
      )}

      {state.step === 'details' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Assessment Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter property details, then add damage photos. The AI analyzes your images and uses field observations as context for a comprehensive FDAM assessment.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Left: Metadata Form (3/5 width on lg+) - PRIMARY */}
              <div className="lg:col-span-3">
                <MetadataForm
                  key={`form-${existingRoomType ?? 'loading'}`}
                  onSubmit={handleMetadataSubmit}
                  onBack={() => {}} // No-op, no back needed
                  isLoading={state.isLoading}
                  initialRoomType={existingRoomType}
                  initialData={state.metadata}
                  embedded={true}
                  imagesCount={state.images.length}
                  isLoadingAssessment={state.isLoadingAssessment}
                />
              </div>

              {/* Right: Image Upload (2/5 width on lg+) - SECONDARY */}
              <div className="lg:col-span-2">
                <ImageUpload
                  images={state.images}
                  previewUrls={state.imagePreviewUrls}
                  compressedDataUrls={state.compressedDataUrls}
                  onImagesChange={handleImagesChange}
                  onNext={() => {}} // No-op, form handles submit
                  isLoadingMetadata={state.isLoadingAssessment}
                  embedded={true}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'processing' && (
        <ProcessingView imageCount={state.images.length} status={pollStatus} />
      )}

      {state.step === 'complete' && state.report && (
        <AssessmentReport
          report={state.report}
          processingTimeMs={state.processingTime}
          onStartChat={() => {
            updateState({ step: 'chat' });
          }}
          onNewAssessment={handleComplete}
        />
      )}

      {state.step === 'chat' && (
        <ChatInterface
          messages={state.chatHistory}
          onSendMessage={handleChatMessage}
          onBack={() => updateState({ step: 'complete' })}
          isLoading={state.isLoading}
        />
      )}
    </div>
  );
}
