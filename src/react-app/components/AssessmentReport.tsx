/**
 * AssessmentReport Component
 * Displays the FDAM assessment report
 */

import type { AssessmentReport as ReportType } from '../types';

type AssessmentReportProps = {
  report: ReportType;
  processingTimeMs?: number;
  onStartChat: () => void;
  onNewAssessment: () => void;
};

export function AssessmentReport({
  report,
  processingTimeMs,
  onStartChat,
  onNewAssessment,
}: AssessmentReportProps) {
  return (
    <div className="assessment-report">
      <div className="report-header">
        <h2>FDAM Assessment Report</h2>
        {processingTimeMs && (
          <span className="processing-time">
            Generated in {(processingTimeMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      <section className="report-section">
        <h3>Executive Summary</h3>
        <p>{report.executiveSummary}</p>
      </section>

      {report.detailedAssessment.length > 0 && (
        <section className="report-section">
          <h3>Detailed Assessment</h3>
          {report.detailedAssessment.map((item, index) => (
            <div key={index} className="assessment-item">
              <h4>
                {item.area}
                <span className={`severity-badge ${item.severity}`}>
                  {item.severity}
                </span>
              </h4>
              <p>{item.findings}</p>
              {item.recommendations.length > 0 && (
                <ul>
                  {item.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="report-section">
        <h3>FDAM Recommendations</h3>
        <ul className="recommendations-list">
          {report.fdamRecommendations.map((rec, index) => (
            <li key={index}>{rec}</li>
          ))}
        </ul>
      </section>

      {report.restorationPriority.length > 0 && (
        <section className="report-section">
          <h3>Restoration Priority Matrix</h3>
          <table className="priority-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Area</th>
                <th>Action</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {report.restorationPriority.map((item, index) => (
                <tr key={index}>
                  <td className="priority-cell">{item.priority}</td>
                  <td>{item.area}</td>
                  <td>{item.action}</td>
                  <td>{item.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="report-section">
        <h3>Scope Indicators</h3>
        <ul className="scope-list">
          {report.scopeIndicators.map((indicator, index) => (
            <li key={index}>{indicator}</li>
          ))}
        </ul>
      </section>

      <div className="report-actions">
        <button className="primary-btn" onClick={onStartChat}>
          Ask Follow-up Questions
        </button>
        <button className="secondary-btn" onClick={onNewAssessment}>
          New Assessment
        </button>
      </div>
    </div>
  );
}
