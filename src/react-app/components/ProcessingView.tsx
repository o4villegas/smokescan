/**
 * ProcessingView Component
 * Loading state while assessment is being processed
 */

type ProcessingViewProps = {
  imageCount: number;
};

export function ProcessingView({ imageCount }: ProcessingViewProps) {
  return (
    <div className="processing-view">
      <div className="processing-animation">
        <div className="spinner"></div>
      </div>
      <h2>Analyzing Damage</h2>
      <p className="processing-status">
        Processing {imageCount} image{imageCount > 1 ? 's' : ''}...
      </p>
      <div className="processing-steps">
        <div className="step active">
          <span className="step-icon">📷</span>
          <span>Analyzing images with AI vision model</span>
        </div>
        <div className="step">
          <span className="step-icon">📚</span>
          <span>Retrieving FDAM methodology context</span>
        </div>
        <div className="step">
          <span className="step-icon">📋</span>
          <span>Generating assessment report</span>
        </div>
      </div>
      <p className="processing-note">
        This may take 1-2 minutes for thorough analysis.
      </p>
    </div>
  );
}
