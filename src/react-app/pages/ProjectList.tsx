/**
 * ProjectList Page
 * Displays all projects with ability to create new ones
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, MapPin, User, Calendar, FolderOpen } from 'lucide-react';

type ProjectListState = {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  showCreateForm: boolean;
  isCreating: boolean;
};

export function ProjectList() {
  const navigate = useNavigate();
  const [state, setState] = useState<ProjectListState>({
    projects: [],
    isLoading: true,
    error: null,
    showCreateForm: false,
    isCreating: false,
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
    setState((prev) => ({ ...prev, isCreating: true }));

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
        setState((prev) => ({ ...prev, error: result.error.message, isCreating: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to create project', isCreating: false }));
    }
  };

  const resetForm = () => {
    setFormData({ name: '', address: '', client_name: '', notes: '' });
    setState((prev) => ({ ...prev, showCreateForm: false }));
  };

  if (state.isLoading && state.projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
        <Button onClick={() => setState((prev) => ({ ...prev, showCreateForm: true }))}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Error Banner */}
      {state.error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
          <span>{state.error}</span>
          <button
            onClick={() => setState((prev) => ({ ...prev, error: null }))}
            className="hover:bg-destructive/20 rounded p-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={state.showCreateForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Enter project details. You can add rooms and assessments after creation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="e.g., Smith Residence Fire Restoration"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Property Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  required
                  placeholder="e.g., 123 Main St, City, State ZIP"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_name">Client Name</Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, client_name: e.target.value }))}
                  placeholder="e.g., ABC Insurance Co."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about the project..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm} disabled={state.isCreating}>
                Cancel
              </Button>
              <Button type="submit" disabled={state.isCreating || !formData.name || !formData.address}>
                {state.isCreating ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project Grid */}
      {state.projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No projects yet. Create your first project to get started.
            </p>
            <Button
              variant="outline"
              onClick={() => setState((prev) => ({ ...prev, showCreateForm: true }))}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {state.projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-lg truncate">{project.name}</h3>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{project.address}</span>
                  </div>

                  {project.client_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate">{project.client_name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                    <Calendar className="h-3 w-3" />
                    <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
