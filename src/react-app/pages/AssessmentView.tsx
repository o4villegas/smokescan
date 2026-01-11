/**
 * AssessmentView Page
 * View and manage a single assessment
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChatInterface } from '../components';
import type { AssessmentWithDetails, RoomType, ChatMessage } from '../types';

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  'residential-bedroom': 'Bedroom',
  'residential-living': 'Living Room',
  'residential-kitchen': 'Kitchen',
  'residential-bathroom': 'Bathroom',
  'commercial-office': 'Office',
  'commercial-retail': 'Retail Space',
  'industrial-warehouse': 'Warehouse',
  'industrial-manufacturing': 'Manufacturing',
  'other': 'Other',
};

type ViewMode = 'details' | 'chat';

type AssessmentViewState = {
  assessment: AssessmentWithDetails | null;
  isLoading: boolean;
  error: string | null;
  viewMode: ViewMode;
  chatHistory: ChatMessage[];
  sessionId: string | null;
};

export function AssessmentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<AssessmentViewState>({
    assessment: null,
    isLoading: true,
    error: null,
    viewMode: 'details',
    chatHistory: [],
    sessionId: null,
  });

  const fetchAssessment = useCallback(async () => {
    if (!id) return;

    try {
      const response = await fetch(`/api/assessments/${id}`);
      const result = await response.json();

      if (result.success) {
        setState((prev) => ({ ...prev, assessment: result.data, isLoading: false }));
      } else {
        setState((prev) => ({ ...prev, error: result.error.message, isLoading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to load assessment', isLoading: false }));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    fetchAssessment();
  }, [fetchAssessment]);

  const handleChatMessage = async (message: string) => {
    if (!state.sessionId) {
      setState((prev) => ({ ...prev, error: 'No chat session available' }));
      return;
    }

    setState((prev) => ({
      ...prev,
      chatHistory: [...prev.chatHistory, { role: 'user', content: message }],
      isLoading: true,
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, message }),
      });

      const result = await response.json();

      if (result.success) {
        setState((prev) => ({
          ...prev,
          chatHistory: [
            ...prev.chatHistory,
            { role: 'assistant', content: result.data.response },
          ],
          isLoading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          chatHistory: [
            ...prev.chatHistory,
            { role: 'assistant', content: `Error: ${result.error.message}` },
          ],
          isLoading: false,
        }));
      }
    } catch {
      setState((prev) => ({
        ...prev,
        chatHistory: [
          ...prev.chatHistory,
          { role: 'assistant', content: 'Failed to send message' },
        ],
        isLoading: false,
      }));
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this assessment?')) {
      return;
    }

    try {
      const response = await fetch(`/api/assessments/${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        navigate(-1);
      } else {
        setState((prev) => ({ ...prev, error: result.error.message }));
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to delete assessment' }));
    }
  };

  if (state.isLoading && !state.assessment) {
    return (
      <div className="assessment-view">
        <div className="loading">Loading assessment...</div>
      </div>
    );
  }

  if (!state.assessment) {
    return (
      <div className="assessment-view">
        <div className="error-state">
          <p>Assessment not found</p>
          <Link to="/" className="primary-btn">Back to Projects</Link>
        </div>
      </div>
    );
  }

  const { assessment } = state;

  return (
    <div className="assessment-view">
      <div className="breadcrumb">
        <Link to="/">Projects</Link>
        {' / '}
        <Link to={`/projects/${assessment.project_id}`}>Project</Link>
        {' / '}
        {assessment.room_name || ROOM_TYPE_LABELS[assessment.room_type]}
      </div>

      {state.error && (
        <div className="error-banner">
          <span>{state.error}</span>
          <button onClick={() => setState((prev) => ({ ...prev, error: null }))}>×</button>
        </div>
      )}

      <div className="assessment-header">
        <div>
          <h2>{assessment.room_name || ROOM_TYPE_LABELS[assessment.room_type]}</h2>
          <div className="badges">
            <span className={`phase-badge ${assessment.phase.toLowerCase()}`}>
              {assessment.phase}
            </span>
            <span className={`status-badge ${assessment.status}`}>
              {assessment.status.replace('-', ' ')}
            </span>
            {assessment.zone_classification && (
              <span className={`zone-badge ${assessment.zone_classification}`}>
                {assessment.zone_classification.replace('-', ' ')}
              </span>
            )}
            {assessment.overall_severity && (
              <span className={`severity-badge ${assessment.overall_severity}`}>
                {assessment.overall_severity}
              </span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`tab-btn ${state.viewMode === 'details' ? 'active' : ''}`}
            onClick={() => setState((prev) => ({ ...prev, viewMode: 'details' }))}
          >
            Details
          </button>
          <button
            className={`tab-btn ${state.viewMode === 'chat' ? 'active' : ''}`}
            onClick={() => setState((prev) => ({ ...prev, viewMode: 'chat' }))}
            disabled={!state.sessionId}
          >
            Chat
          </button>
          <button className="secondary-btn danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      {state.viewMode === 'details' && (
        <div className="assessment-details">
          {assessment.executive_summary && (
            <div className="detail-section">
              <h3>Executive Summary</h3>
              <p>{assessment.executive_summary}</p>
            </div>
          )}

          {assessment.confidence_score !== undefined && (
            <div className="detail-section">
              <h3>Confidence Score</h3>
              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{ width: `${assessment.confidence_score * 100}%` }}
                />
                <span>{Math.round(assessment.confidence_score * 100)}%</span>
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3>Images ({assessment.images.length})</h3>
            {assessment.images.length === 0 ? (
              <p className="empty-text">No images uploaded</p>
            ) : (
              <div className="image-grid">
                {assessment.images.map((img) => (
                  <div key={img.id} className="image-item">
                    <img src={`/api/images/${img.r2_key}`} alt={img.filename} />
                    <span className="image-filename">{img.filename}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="detail-section">
            <h3>Damage Items ({assessment.damage_items.length})</h3>
            {assessment.damage_items.length === 0 ? (
              <p className="empty-text">No damage items recorded</p>
            ) : (
              <div className="damage-list">
                {assessment.damage_items.map((item) => (
                  <div key={item.id} className="damage-item">
                    <div className="damage-header">
                      <span className="damage-type">{item.damage_type.replace('_', ' ')}</span>
                      <span className={`severity-badge ${item.severity}`}>{item.severity}</span>
                    </div>
                    <p className="damage-location">{item.location}</p>
                    {item.material && <p className="damage-material">Material: {item.material}</p>}
                    {item.disposition && (
                      <span className={`disposition-badge ${item.disposition}`}>
                        {item.disposition}
                      </span>
                    )}
                    {item.notes && <p className="damage-notes">{item.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {assessment.restoration_priorities.length > 0 && (
            <div className="detail-section">
              <h3>Restoration Priorities</h3>
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
                  {assessment.restoration_priorities.map((p) => (
                    <tr key={p.id}>
                      <td className="priority-cell">{p.priority}</td>
                      <td>{p.area}</td>
                      <td>{p.action}</td>
                      <td>{p.rationale || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {state.viewMode === 'chat' && state.sessionId && (
        <ChatInterface
          messages={state.chatHistory}
          onSendMessage={handleChatMessage}
          onBack={() => setState((prev) => ({ ...prev, viewMode: 'details' }))}
          isLoading={state.isLoading}
        />
      )}
    </div>
  );
}
