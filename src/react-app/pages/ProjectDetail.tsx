/**
 * ProjectDetail Page
 * Shows project details with assessments
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { ProjectWithAssessments, RoomType } from '../types';

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

type ProjectDetailState = {
  project: ProjectWithAssessments | null;
  isLoading: boolean;
  error: string | null;
  showAddRoom: boolean;
};

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<ProjectDetailState>({
    project: null,
    isLoading: true,
    error: null,
    showAddRoom: false,
  });

  const [newRoom, setNewRoom] = useState({
    room_type: 'residential-living' as RoomType,
    room_name: '',
  });

  const fetchProject = useCallback(async () => {
    if (!id) return;

    try {
      const response = await fetch(`/api/projects/${id}`);
      const result = await response.json();

      if (result.success) {
        setState((prev) => ({ ...prev, project: result.data, isLoading: false }));
      } else {
        setState((prev) => ({ ...prev, error: result.error.message, isLoading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to load project', isLoading: false }));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    fetchProject();
  }, [fetchProject]);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`/api/projects/${id}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoom),
      });
      const result = await response.json();

      if (result.success) {
        // Navigate to the new assessment wizard
        navigate(`/projects/${id}/assess/${result.data.id}`);
      } else {
        setState((prev) => ({ ...prev, error: result.error.message, isLoading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to create assessment', isLoading: false }));
    }
  };

  const handleDeleteProject = async () => {
    if (!id || !confirm('Are you sure you want to delete this project and all its assessments?')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        navigate('/');
      } else {
        setState((prev) => ({ ...prev, error: result.error.message }));
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to delete project' }));
    }
  };

  if (state.isLoading) {
    return (
      <div className="project-detail">
        <div className="loading">Loading project...</div>
      </div>
    );
  }

  if (!state.project) {
    return (
      <div className="project-detail">
        <div className="error-state">
          <p>Project not found</p>
          <Link to="/" className="primary-btn">Back to Projects</Link>
        </div>
      </div>
    );
  }

  const { project } = state;

  return (
    <div className="project-detail">
      <div className="breadcrumb">
        <Link to="/">Projects</Link> / {project.name}
      </div>

      {state.error && (
        <div className="error-banner">
          <span>{state.error}</span>
          <button onClick={() => setState((prev) => ({ ...prev, error: null }))}>×</button>
        </div>
      )}

      <div className="project-header">
        <div>
          <h2>{project.name}</h2>
          <p className="project-address">{project.address}</p>
          {project.client_name && <p className="project-client">Client: {project.client_name}</p>}
        </div>
        <div className="header-actions">
          <button
            className="primary-btn"
            onClick={() => setState((prev) => ({ ...prev, showAddRoom: true }))}
          >
            + Add Room
          </button>
          <button className="secondary-btn danger" onClick={handleDeleteProject}>
            Delete Project
          </button>
        </div>
      </div>

      {project.notes && (
        <div className="project-notes">
          <h3>Notes</h3>
          <p>{project.notes}</p>
        </div>
      )}

      {state.showAddRoom && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add Room Assessment</h3>
              <button
                className="close-btn"
                onClick={() => setState((prev) => ({ ...prev, showAddRoom: false }))}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddRoom}>
              <div className="form-group">
                <label htmlFor="room_type">Room Type *</label>
                <select
                  id="room_type"
                  value={newRoom.room_type}
                  onChange={(e) => setNewRoom((prev) => ({ ...prev, room_type: e.target.value as RoomType }))}
                  required
                >
                  {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="room_name">Room Name (Optional)</label>
                <input
                  type="text"
                  id="room_name"
                  value={newRoom.room_name}
                  onChange={(e) => setNewRoom((prev) => ({ ...prev, room_name: e.target.value }))}
                  placeholder="e.g., Master Bedroom, Kitchen #1"
                />
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setState((prev) => ({ ...prev, showAddRoom: false }))}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={state.isLoading}>
                  {state.isLoading ? 'Creating...' : 'Start Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="assessments-section">
        <h3>Assessments ({project.assessments.length})</h3>

        {project.assessments.length === 0 ? (
          <div className="empty-state">
            <p>No assessments yet. Add a room to start an assessment.</p>
          </div>
        ) : (
          <div className="assessment-list">
            {project.assessments.map((assessment) => (
              <Link
                key={assessment.id}
                to={`/assessments/${assessment.id}`}
                className="assessment-card"
              >
                <div className="assessment-info">
                  <h4>{assessment.room_name || ROOM_TYPE_LABELS[assessment.room_type]}</h4>
                  <span className={`phase-badge ${assessment.phase.toLowerCase()}`}>
                    {assessment.phase}
                  </span>
                  <span className={`status-badge ${assessment.status}`}>
                    {assessment.status.replace('-', ' ')}
                  </span>
                </div>
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
                <p className="assessment-date">
                  {new Date(assessment.updated_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
