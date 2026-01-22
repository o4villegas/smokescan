/**
 * AssessmentWizard Page
 * Multi-step assessment with image upload and AI analysis
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ImageUpload, MetadataForm, ProcessingView, AssessmentReport, ChatInterface } from '../components';
import { submitAssessmentJob, getJobStatus, getJobResult, sendChatMessage } from '../lib/api';
import type { AssessmentMetadata, AssessmentReport as ReportType, ChatMessage, RoomType, StructureType } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type WizardStep = 'details' | 'processing' | 'complete' | 'chat';

type WizardState = {
  step: WizardStep;
  images: File[];
  imagePreviewUrls: string[];
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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track consecutive polling failures (BUG-004)
  const consecutiveFailuresRef = useRef(0);

  // Polling constants
  const POLLING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (BUG-007)
  const POLLING_INTERVAL_MS = 5000; // 5 seconds
  const MAX_CONSECUTIVE_FAILURES = 3;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
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
                // fireOrigin and notes intentionally omitted (transient, not stored)
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
    (images: File[], previewUrls: string[]) => {
      updateState({ images, imagePreviewUrls: previewUrls, error: null });
    },
    [updateState]
  );

  // Helper function for retrying PATCH with exponential backoff (BUG-003)
  const updateAssessmentWithRetry = useCallback(
    async (id: string, updateData: object, maxRetries = 3): Promise<boolean> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(`/api/assessments/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          });
          if (response.ok) return true;
          console.warn(`[Wizard] PATCH attempt ${attempt} failed: ${response.status}`);
        } catch (e) {
          console.warn(`[Wizard] PATCH attempt ${attempt} error:`, e);
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * attempt)); // Exponential backoff
        }
      }
      return false;
    },
    []
  );

  const handleMetadataSubmit = useCallback(
    async (metadata: AssessmentMetadata) => {
      updateState({ metadata, step: 'processing', isLoading: true, error: null });

      const startTime = Date.now();

      try {
        // Submit job (returns immediately with jobId)
        const submitResult = await submitAssessmentJob(state.images, metadata);

        if (!submitResult.success) {
          updateState({
            step: 'details',
            isLoading: false,
            error: submitResult.error.message,
          });
          return;
        }

        const { jobId } = submitResult.data;
        console.log(`[Wizard] Job submitted: ${jobId}`);

        // Reset consecutive failures counter
        consecutiveFailuresRef.current = 0;

        // Poll for completion with timeout
        pollIntervalRef.current = setInterval(async () => {
          // Check for timeout (BUG-007)
          if (Date.now() - startTime > POLLING_TIMEOUT_MS) {
            console.error('[Wizard] Polling timeout reached');
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
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
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                updateState({
                  step: 'details',
                  isLoading: false,
                  error: 'Unable to check assessment status. Please check your connection and try again.',
                });
              }
              return; // Keep polling on transient errors
            }

            // Reset consecutive failures on success
            consecutiveFailuresRef.current = 0;

            const { status, error } = statusResult.data;
            console.log(`[Wizard] Job ${jobId} status: ${status}`);

            if (status === 'completed') {
              // Stop polling
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }

              // Fetch result
              const resultResponse = await getJobResult(jobId);
              const processingTime = Date.now() - startTime;

              if (resultResponse.success) {
                // Update the assessment in database with results and session_id (BUG-003: retry with warning)
                if (assessmentId) {
                  const patchSuccess = await updateAssessmentWithRetry(assessmentId, {
                    status: 'completed',
                    executive_summary: resultResponse.data.report.executiveSummary,
                    session_id: resultResponse.data.sessionId,
                  });

                  if (!patchSuccess) {
                    console.error('[Wizard] Failed to persist assessment status after 3 retries');
                    // Non-blocking warning - assessment is still viewable
                  }
                }

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
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }

              updateState({
                step: 'details',
                isLoading: false,
                error: error || 'Assessment processing failed',
              });
            }
            // For 'pending' or 'in_progress', keep polling
          } catch (pollError) {
            console.error('[Wizard] Polling error:', pollError);
            // Track consecutive failures (BUG-004)
            consecutiveFailuresRef.current++;

            if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              updateState({
                step: 'details',
                isLoading: false,
                error: 'Unable to check assessment status. Please check your connection and try again.',
              });
            }
            // Keep polling on transient errors
          }
        }, POLLING_INTERVAL_MS);
      } catch {
        updateState({
          step: 'details',
          isLoading: false,
          error: 'Failed to submit assessment',
        });
      }
    },
    [state.images, assessmentId, updateState, updateAssessmentWithRetry, POLLING_TIMEOUT_MS, POLLING_INTERVAL_MS, MAX_CONSECUTIVE_FAILURES]
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
        <ProcessingView imageCount={state.images.length} />
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
