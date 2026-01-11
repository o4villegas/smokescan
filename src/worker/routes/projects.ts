/**
 * Projects Routes
 * API endpoints for project management
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { WorkerEnv } from '../types';
import { DatabaseService } from '../services/database';

const app = new Hono<{ Bindings: WorkerEnv }>();

// Validation schemas
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  client_name: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

// GET /api/projects - List all projects
app.get('/', async (c) => {
  const db = new DatabaseService(c.env.SMOKESCAN_DB);
  const result = await db.listProjects();

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: result.data });
});

// POST /api/projects - Create a new project
app.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = CreateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 400, message: 'Invalid request', details: parsed.error.message } },
      400
    );
  }

  const db = new DatabaseService(c.env.SMOKESCAN_DB);
  const result = await db.createProject(parsed.data);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: result.data }, 201);
});

// GET /api/projects/:id - Get project with assessments
app.get('/:id', async (c) => {
  const { id } = c.req.param();
  const db = new DatabaseService(c.env.SMOKESCAN_DB);
  const result = await db.getProjectWithAssessments(id);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: result.data });
});

// DELETE /api/projects/:id - Delete a project
app.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const db = new DatabaseService(c.env.SMOKESCAN_DB);
  const result = await db.deleteProject(id);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: null });
});

export { app as projectsRoutes };
