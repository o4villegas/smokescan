/**
 * Assessments Routes
 * API endpoints for assessment management
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { WorkerEnv, Phase } from '../types';
import { DatabaseService } from '../services/database';
import { StorageService } from '../services/storage';

const app = new Hono<{ Bindings: WorkerEnv }>();

// Validation schemas
const RoomTypeSchema = z.enum([
  'residential-bedroom',
  'residential-living',
  'residential-kitchen',
  'residential-bathroom',
  'commercial-office',
  'commercial-retail',
  'industrial-warehouse',
  'industrial-manufacturing',
  'other',
]);

const PhaseSchema = z.enum(['PRE', 'PRA', 'RESTORATION', 'PRV']);

const StatusSchema = z.enum(['draft', 'in-progress', 'awaiting-lab', 'pra-ready', 'completed']);

const ZoneSchema = z.enum(['burn', 'near-field', 'far-field']);

const SeveritySchema = z.enum(['heavy', 'moderate', 'light', 'trace', 'none']);

// FDAM field schemas
const FloorLevelSchema = z.enum(['basement', 'ground', '1st', '2nd', '3rd', '4th+', 'attic']);

const RoomDimensionsSchema = z.object({
  length_ft: z.number().positive().max(1000),
  width_ft: z.number().positive().max(1000),
  height_ft: z.number().positive().max(100),
  area_sf: z.number().positive(),
  volume_cf: z.number().positive(),
});

const SensoryObservationsSchema = z.object({
  smoke_odor_present: z.boolean(),
  smoke_odor_intensity: z.enum(['faint', 'noticeable', 'strong']).optional(),
  white_wipe_result: z.enum(['not-performed', 'clean', 'light-deposits', 'heavy-deposits']).optional(),
});

const CreateAssessmentSchema = z.object({
  project_id: z.string().uuid(),
  room_type: RoomTypeSchema,
  room_name: z.string().max(200).optional(),
  // FDAM fields (human inputs that cannot be determined by photo analysis)
  floor_level: FloorLevelSchema.optional(),
  dimensions: RoomDimensionsSchema.optional(),
  sensory_observations: SensoryObservationsSchema.optional(),
});

const UpdateAssessmentSchema = z.object({
  status: StatusSchema.optional(),
  phase: PhaseSchema.optional(),
  zone_classification: ZoneSchema.optional(),
  overall_severity: SeveritySchema.optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  executive_summary: z.string().max(5000).optional(),
  // FDAM fields (human inputs that cannot be determined by photo analysis)
  floor_level: FloorLevelSchema.optional(),
  dimensions: RoomDimensionsSchema.optional(),
  sensory_observations: SensoryObservationsSchema.optional(),
});

// POST /api/projects/:projectId/assessments - Create assessment for a project
app.post('/projects/:projectId/assessments', async (c) => {
  const { projectId } = c.req.param();
  const body = await c.req.json();

  const parsed = CreateAssessmentSchema.safeParse({ ...body, project_id: projectId });

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 400, message: 'Invalid request', details: parsed.error.message } },
      400
    );
  }

  const db = new DatabaseService(c.env.SMOKESCAN_DB);

  // Verify project exists
  const projectResult = await db.getProject(projectId);
  if (!projectResult.success) {
    return c.json({ success: false, error: projectResult.error }, projectResult.error.code);
  }

  const result = await db.createAssessment(parsed.data);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: result.data }, 201);
});

// GET /api/assessments/:id - Get assessment with details
app.get('/:id', async (c) => {
  const { id } = c.req.param();
  const db = new DatabaseService(c.env.SMOKESCAN_DB);
  const result = await db.getAssessmentWithDetails(id);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: result.data });
});

// PATCH /api/assessments/:id - Update assessment
app.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const parsed = UpdateAssessmentSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 400, message: 'Invalid request', details: parsed.error.message } },
      400
    );
  }

  const db = new DatabaseService(c.env.SMOKESCAN_DB);
  const result = await db.updateAssessment(id, parsed.data);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: result.data });
});

// DELETE /api/assessments/:id - Delete assessment
app.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const db = new DatabaseService(c.env.SMOKESCAN_DB);
  const storage = new StorageService(c.env.SMOKESCAN_IMAGES, c.env.SMOKESCAN_REPORTS);

  // Delete files from R2 first
  await storage.deleteAllByAssessment(id);

  // Then delete from database
  const result = await db.deleteAssessment(id);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: null });
});

// POST /api/assessments/:id/complete - Mark assessment as completed
app.post('/:id/complete', async (c) => {
  const { id } = c.req.param();
  const db = new DatabaseService(c.env.SMOKESCAN_DB);

  const result = await db.updateAssessment(id, { status: 'completed' });

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: result.data });
});

// POST /api/assessments/:id/advance-phase - Advance to next phase
app.post('/:id/advance-phase', async (c) => {
  const { id } = c.req.param();
  const db = new DatabaseService(c.env.SMOKESCAN_DB);

  // Get current assessment
  const current = await db.getAssessment(id);
  if (!current.success) {
    return c.json({ success: false, error: current.error }, current.error.code);
  }

  // Determine next phase
  const phaseOrder: Phase[] = ['PRE', 'PRA', 'RESTORATION', 'PRV'];
  const currentIndex = phaseOrder.indexOf(current.data.phase);
  const nextPhase = phaseOrder[currentIndex + 1];

  if (!nextPhase) {
    return c.json(
      { success: false, error: { code: 400, message: 'Assessment is already in final phase' } },
      400
    );
  }

  const result = await db.updateAssessment(id, { phase: nextPhase });

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: result.data });
});

export { app as assessmentsRoutes };
