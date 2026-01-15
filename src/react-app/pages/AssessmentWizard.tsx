/**
 * AssessmentWizard Page
 * Multi-step assessment with image upload and AI analysis
 */

import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ImageUpload, MetadataForm, ProcessingView, AssessmentReport } from '../components';
import type { AssessmentMetadata, AssessmentReport as ReportType } from '../types';

type WizardStep = 'upload' | 'metadata' | 'processing' | 'complete';

type WizardState = {
  step: WizardStep;
  images: File[];
  imagePreviewUrls: string[];
  metadata: AssessmentMetadata | null;
  report: ReportType | null;
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

  const uploadImages = useCallback(
    async (images: File[]): Promise<boolean> => {
      if (!assessmentId) return false;

      for (const image of images) {
        const formData = new FormData();
        formData.append('file', image);
        formData.append('assessment_id', assessmentId);

        const response = await fetch('/api/images/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        if (!result.success) {
          updateState({ error: `Failed to upload ${image.name}: ${result.error.message}` });
          return false;
        }
      }
      return true;
    },
    [assessmentId, updateState]
  );

  const handleMetadataSubmit = useCallback(
    async (metadata: AssessmentMetadata) => {
      updateState({ metadata, step: 'processing', isLoading: true, error: null });

      try {
        // First upload images to R2
        const uploaded = await uploadImages(state.images);
        if (!uploaded) {
          updateState({ step: 'metadata', isLoading: false });
          return;
        }

        // Convert images to base64 for vision API
        const imagePromises = state.images.map((file) => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]); // Remove data:image/...;base64, prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        });

        const base64Images = await Promise.all(imagePromises);

        // Call the assess API
        const startTime = Date.now();
        const response = await fetch('/api/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: base64Images,
            metadata,
          }),
        });

        const result = await response.json();
        const processingTime = Date.now() - startTime;

        if (result.success) {
          // Update the assessment in database with results
          if (assessmentId) {
            await fetch(`/api/assessments/${assessmentId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'completed',
                executive_summary: result.data.report.executiveSummary,
              }),
            });
          }

          updateState({
            step: 'complete',
            report: result.data.report,
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
    [state.images, assessmentId, updateState, uploadImages]
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
          onNext={() => updateState({ step: 'metadata' })}
        />
      )}

      {state.step === 'metadata' && (
        <MetadataForm
          onSubmit={handleMetadataSubmit}
          onBack={() => updateState({ step: 'upload' })}
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
            // For now, just complete. Chat can be accessed from assessment view.
            handleComplete();
          }}
          onNewAssessment={handleComplete}
        />
      )}
    </div>
  );
}
