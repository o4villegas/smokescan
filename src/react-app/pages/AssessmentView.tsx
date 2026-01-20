/**
 * AssessmentView Page
 * View and manage a single assessment
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChatInterface } from '../components';
import type { AssessmentWithDetails, RoomType, ChatMessage } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trash2, Image, AlertTriangle, ListOrdered, MessageSquare } from 'lucide-react';

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
        setState((prev) => ({
          ...prev,
          assessment: result.data,
          sessionId: result.data.session_id || null,
          isLoading: false,
        }));
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

    const userMessage = { role: 'user' as const, content: message };

    setState((prev) => ({
      ...prev,
      chatHistory: [...prev.chatHistory, userMessage],
      isLoading: true,
      error: null, // Clear previous error
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, message }),
      });

      if (!response.ok) {
        // Remove user message on HTTP error, show error banner
        setState((prev) => ({
          ...prev,
          chatHistory: prev.chatHistory.filter((m) => m !== userMessage),
          error: `HTTP error: ${response.status}`,
          isLoading: false,
        }));
        return;
      }

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
        // Remove user message on API error, show error banner
        setState((prev) => ({
          ...prev,
          chatHistory: prev.chatHistory.filter((m) => m !== userMessage),
          error: result.error.message,
          isLoading: false,
        }));
      }
    } catch {
      // Remove user message on network error, show error banner
      setState((prev) => ({
        ...prev,
        chatHistory: prev.chatHistory.filter((m) => m !== userMessage),
        error: 'Failed to send message',
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading assessment...</div>
      </div>
    );
  }

  if (!state.assessment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Assessment not found</p>
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  const { assessment } = state;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">Projects</Link>
        <span>/</span>
        <Link to={`/projects/${assessment.project_id}`} className="hover:text-foreground transition-colors">
          Project
        </Link>
        <span>/</span>
        <span className="text-foreground">
          {assessment.room_name || ROOM_TYPE_LABELS[assessment.room_type]}
        </span>
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

      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-2">
            <CardTitle className="text-2xl">
              {assessment.room_name || ROOM_TYPE_LABELS[assessment.room_type]}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{assessment.phase}</Badge>
              <Badge variant="outline">{assessment.status.replace('-', ' ')}</Badge>
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
          </div>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </CardHeader>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="chat" disabled={!state.sessionId}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          {/* Executive Summary */}
          {assessment.executive_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{assessment.executive_summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Confidence Score */}
          {assessment.confidence_score !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Confidence Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                    style={{ width: `${assessment.confidence_score * 100}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {Math.round(assessment.confidence_score * 100)}% confidence
                </p>
              </CardContent>
            </Card>
          )}

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Image className="h-5 w-5" />
                Images ({assessment.images.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assessment.images.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No images uploaded</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {assessment.images.map((img) => (
                    <div key={img.id} className="group relative aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={`/api/images/${img.r2_key}`}
                        alt={img.filename}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <span className="text-xs text-white truncate">{img.filename}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Damage Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Damage Items ({assessment.damage_items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assessment.damage_items.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No damage items recorded</p>
              ) : (
                <div className="space-y-3">
                  {assessment.damage_items.map((item) => (
                    <div key={item.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {item.damage_type.replace('_', ' ')}
                        </span>
                        <Badge variant={item.severity as 'heavy' | 'moderate' | 'light' | 'trace' | 'none'}>
                          {item.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.location}</p>
                      {item.material && (
                        <p className="text-sm text-muted-foreground">Material: {item.material}</p>
                      )}
                      {item.disposition && (
                        <Badge variant="outline" className="capitalize">
                          {item.disposition}
                        </Badge>
                      )}
                      {item.notes && (
                        <p className="text-sm text-muted-foreground italic">{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Restoration Priorities */}
          {assessment.restoration_priorities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListOrdered className="h-5 w-5" />
                  Restoration Priorities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 pr-4 font-medium text-muted-foreground">Priority</th>
                        <th className="pb-3 pr-4 font-medium text-muted-foreground">Area</th>
                        <th className="pb-3 pr-4 font-medium text-muted-foreground">Action</th>
                        <th className="pb-3 font-medium text-muted-foreground">Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessment.restoration_priorities.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-3 pr-4">
                            <Badge variant="secondary" className="font-mono">
                              #{p.priority}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">{p.area}</td>
                          <td className="py-3 pr-4">{p.action}</td>
                          <td className="py-3 text-muted-foreground">{p.rationale || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chat">
          {state.sessionId && (
            <ChatInterface
              messages={state.chatHistory}
              onSendMessage={handleChatMessage}
              onBack={() => setState((prev) => ({ ...prev, viewMode: 'details' }))}
              isLoading={state.isLoading}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
