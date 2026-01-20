/**
 * AssessmentWizard Page
 * Multi-step assessment with image upload and AI analysis
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ImageUpload, MetadataForm, ProcessingView, AssessmentReport, ChatInterface } from '../components';
import { submitAssessmentJob, getJobStatus, getJobResult, sendChatMessage } from '../lib/api';
import type { AssessmentMetadata, AssessmentReport as ReportType, ChatMessage, RoomType } from '../types';

type WizardStep = 'upload' | 'metadata' | 'processing' | 'complete' | 'chat';

type WizardState = {
  step: WizardStep;
  images: File[];
  imagePreviewUrls: string[];
  metadata: AssessmentMetadata | null;
  report: ReportType | null;
  sessionId: string | null;
  chatHistory: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  processingTime?: number;
};

export function AssessmentWizard() {
  const { projectId, assessmentId } = useParams<{ projectId: string; assessmentId: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<WizardState>({
    step: 'upload',
    images: [],
    imagePreviewUrls: [],
    metadata: null,
    report: null,
    sessionId: null,
    chatHistory: [],
    isLoading: false,
    error: null,
  });

  // Pre-populated room_type from existing assessment (project flow)
  const [existingRoomType, setExistingRoomType] = useState<RoomType | undefined>(undefined);

  // Polling interval ref for cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Fetch existing assessment to pre-populate roomType when coming from project flow
  useEffect(() => {
    if (assessmentId) {
      fetch(`/api/assessments/${assessmentId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.room_type) {
            setExistingRoomType(data.data.room_type);
          }
        })
        .catch(console.error);
    }
  }, [assessmentId]);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleImagesChange = useCallback(
    (images: File[], previewUrls: string[]) => {
      updateState({ images, imagePreviewUrls: previewUrls, error: null });
    },
    [updateState]
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
            step: 'metadata',
            isLoading: false,
            error: submitResult.error.message,
          });
          return;
        }

        const { jobId } = submitResult.data;
        console.log(`[Wizard] Job submitted: ${jobId}`);

        // Poll for completion every 5 seconds
        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusResult = await getJobStatus(jobId);

            if (!statusResult.success) {
              console.warn('[Wizard] Status check failed, will retry');
              return; // Keep polling on transient errors
            }

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
                // Update the assessment in database with results and session_id
                if (assessmentId) {
                  try {
                    const patchResponse = await fetch(`/api/assessments/${assessmentId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        status: 'completed',
                        executive_summary: resultResponse.data.report.executiveSummary,
                        session_id: resultResponse.data.sessionId,
                      }),
                    });
                    if (!patchResponse.ok) {
                      console.error('Failed to update assessment status:', patchResponse.status);
                    }
                  } catch (patchError) {
                    console.error('Failed to update assessment:', patchError);
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
                  step: 'metadata',
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
                step: 'metadata',
                isLoading: false,
                error: error || 'Assessment processing failed',
              });
            }
            // For 'pending' or 'in_progress', keep polling
          } catch (pollError) {
            console.error('[Wizard] Polling error:', pollError);
            // Keep polling on errors
          }
        }, 5000); // Poll every 5 seconds
      } catch {
        updateState({
          step: 'metadata',
          isLoading: false,
          error: 'Failed to submit assessment',
        });
      }
    },
    [state.images, assessmentId, updateState]
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

      {state.step === 'upload' && (
        <ImageUpload
          images={state.images}
          previewUrls={state.imagePreviewUrls}
          onImagesChange={handleImagesChange}
          onNext={() => updateState({ step: 'metadata', error: null })}
        />
      )}

      {state.step === 'metadata' && (
        <MetadataForm
          onSubmit={handleMetadataSubmit}
          onBack={() => updateState({ step: 'upload', error: null })}
          isLoading={state.isLoading}
          initialRoomType={existingRoomType}
        />
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
