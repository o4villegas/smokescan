/**
 * AssessmentWizard Page
 * Multi-step assessment with image upload and AI analysis
 */

import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ImageUpload, MetadataForm, ProcessingView, AssessmentReport, ChatInterface } from '../components';
import { submitAssessment, sendChatMessage } from '../lib/api';
import type { AssessmentMetadata, AssessmentReport as ReportType, ChatMessage } from '../types';

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

      try {
        // Use api.ts client - it handles base64 conversion with proper data URI format
        // Backend handles R2 upload using sessionId as prefix
        const startTime = Date.now();
        const result = await submitAssessment(state.images, metadata);
        const processingTime = Date.now() - startTime;

        if (result.success) {
          // Update the assessment in database with results and session_id
          if (assessmentId) {
            try {
              const patchResponse = await fetch(`/api/assessments/${assessmentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  status: 'completed',
                  executive_summary: result.data.report.executiveSummary,
                  session_id: result.data.sessionId,
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
            report: result.data.report,
            sessionId: result.data.sessionId,
            isLoading: false,
            processingTime,
          });
        } else {
          updateState({
            step: 'metadata',
            isLoading: false,
            error: result.error.message,
          });
        }
      } catch {
        updateState({
          step: 'metadata',
          isLoading: false,
          error: 'Failed to process assessment',
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
