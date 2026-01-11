/**
 * ProjectList Page
 * Displays all projects with ability to create new ones
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Project } from '../types';

type ProjectListState = {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  showCreateForm: boolean;
};

export function ProjectList() {
  const navigate = useNavigate();
  const [state, setState] = useState<ProjectListState>({
    projects: [],
    isLoading: true,
    error: null,
    showCreateForm: false,
  });

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    client_name: '',
    notes: '',
  });

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();

      if (result.success) {
        setState((prev) => ({ ...prev, projects: result.data, isLoading: false }));
      } else {
        setState((prev) => ({ ...prev, error: result.error.message, isLoading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to load projects', isLoading: false }));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();

      if (result.success) {
        // Navigate to the new project
        navigate(`/projects/${result.data.id}`);
      } else {
        setState((prev) => ({ ...prev, error: result.error.message, isLoading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to create project', isLoading: false }));
    }
  };

  if (state.isLoading && state.projects.length === 0) {
    return (
      <div className="project-list">
        <div className="loading">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="project-list">
      <div className="page-header">
        <h2>Projects</h2>
        <button
          className="primary-btn"
          onClick={() => setState((prev) => ({ ...prev, showCreateForm: true }))}
        >
          + New Project
        </button>
      </div>

      {state.error && (
        <div className="error-banner">
          <span>{state.error}</span>
          <button onClick={() => setState((prev) => ({ ...prev, error: null }))}>×</button>
        </div>
      )}

      {state.showCreateForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create New Project</h3>
              <button
                className="close-btn"
                onClick={() => setState((prev) => ({ ...prev, showCreateForm: false }))}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label htmlFor="name">Project Name *</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="e.g., Smith Residence Fire Restoration"
                />
              </div>
              <div className="form-group">
                <label htmlFor="address">Property Address *</label>
                <input
                  type="text"
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  required
                  placeholder="e.g., 123 Main St, City, State ZIP"
                />
              </div>
              <div className="form-group">
                <label htmlFor="client_name">Client Name</label>
                <input
                  type="text"
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, client_name: e.target.value }))}
                  placeholder="e.g., ABC Insurance Co."
                />
              </div>
              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about the project..."
                />
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setState((prev) => ({ ...prev, showCreateForm: false }))}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={state.isLoading}>
                  {state.isLoading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {state.projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects yet. Create your first project to get started.</p>
        </div>
      ) : (
        <div className="project-grid">
          {state.projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="project-card">
              <h3>{project.name}</h3>
              <p className="project-address">{project.address}</p>
              {project.client_name && <p className="project-client">{project.client_name}</p>}
              <p className="project-date">
                Created: {new Date(project.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
