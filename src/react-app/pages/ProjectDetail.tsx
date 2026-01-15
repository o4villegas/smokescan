/**
 * ProjectDetail Page
 * Shows project details with assessments
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { ProjectWithAssessments, RoomType } from '../types';
import { RoomForm, type RoomFormData } from '../components/room';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowLeft, MapPin, User } from 'lucide-react';

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
  isCreatingRoom: boolean;
};

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<ProjectDetailState>({
    project: null,
    isLoading: true,
    error: null,
    showAddRoom: false,
    isCreatingRoom: false,
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

  const handleAddRoom = async (data: RoomFormData) => {
    if (!id) return;

    setState((prev) => ({ ...prev, isCreatingRoom: true }));

    try {
      const response = await fetch(`/api/projects/${id}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (result.success) {
        setState((prev) => ({ ...prev, showAddRoom: false, isCreatingRoom: false }));
        // Navigate to the new assessment wizard
        navigate(`/projects/${id}/assess/${result.data.id}`);
      } else {
        setState((prev) => ({ ...prev, error: result.error.message, isCreatingRoom: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to create assessment', isCreatingRoom: false }));
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!state.project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Project not found</p>
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  const { project } = state;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-foreground">{project.name}</span>
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

      {/* Project Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{project.name}</CardTitle>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{project.address}</span>
            </div>
            {project.client_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{project.client_name}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setState((prev) => ({ ...prev, showAddRoom: true }))}>
              <Plus className="mr-2 h-4 w-4" />
              Add Room
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardHeader>
        {project.notes && (
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium mb-1">Notes</p>
              <p className="text-sm text-muted-foreground">{project.notes}</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Room Form Dialog */}
      <RoomForm
        open={state.showAddRoom}
        onOpenChange={(open) => setState((prev) => ({ ...prev, showAddRoom: open }))}
        onSubmit={handleAddRoom}
        isLoading={state.isCreatingRoom}
      />

      {/* Assessments Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          Assessments ({project.assessments.length})
        </h3>

        {project.assessments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No assessments yet. Add a room to start an assessment.
              </p>
              <Button
                variant="outline"
                onClick={() => setState((prev) => ({ ...prev, showAddRoom: true }))}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add First Room
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {project.assessments.map((assessment) => (
              <Link key={assessment.id} to={`/assessments/${assessment.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium">
                        {assessment.room_name || ROOM_TYPE_LABELS[assessment.room_type]}
                      </h4>
                      <Badge variant="secondary">{assessment.phase}</Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {assessment.status.replace('-', ' ')}
                      </Badge>
                      {assessment.zone_classification && (
                        <Badge variant={assessment.zone_classification as 'burn' | 'near-field' | 'far-field'}>
                          {assessment.zone_classification.replace('-', ' ')}
                        </Badge>
                      )}
                      {assessment.overall_severity && (
                        <Badge variant={assessment.overall_severity as 'heavy' | 'moderate' | 'light' | 'trace' | 'none'}>
                          {assessment.overall_severity}
                        </Badge>
                      )}
                    </div>

                    {assessment.dimensions && (
                      <p className="text-xs text-muted-foreground">
                        {assessment.dimensions.area_sf} SF · {assessment.dimensions.volume_cf} CF
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(assessment.updated_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
