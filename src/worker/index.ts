/**
 * SmokeScan Worker Entry Point
 * Cloudflare Worker API for FDAM fire damage assessment
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { WorkerEnv } from './types';
import {
  handleAssess,
  handleChat,
  handleHealth,
  handleRagTest,
  projectsRoutes,
  assessmentsRoutes,
  imagesRoutes,
} from './routes';

const app = new Hono<{ Bindings: WorkerEnv }>();

// CORS middleware for development and production
app.use('/api/*', cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://smokescan.lando555.workers.dev',
  ],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// Health check endpoint
app.get('/api/health', handleHealth);

// RAG test endpoint (for debugging AI Search)
app.get('/api/health/rag', handleRagTest);

// Project management routes
app.route('/api/projects', projectsRoutes);

// Assessment management routes
app.route('/api/assessments', assessmentsRoutes);

// Also mount create assessment under projects for RESTful pattern
app.post('/api/projects/:projectId/assessments', async (c) => {
  // Forward to assessments route
  const { projectId } = c.req.param();
  const body = await c.req.json();

  // Create assessment with project_id
  const { DatabaseService } = await import('./services/database');
  const db = new DatabaseService(c.env.SMOKESCAN_DB);

  const result = await db.createAssessment({
    project_id: projectId,
    room_type: body.room_type,
    room_name: body.room_name,
  });

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: result.data }, 201);
});

// Image upload/retrieval routes
app.route('/api/images', imagesRoutes);

// Legacy assessment endpoint (backward compatible)
app.post('/api/assess', handleAssess);

// Chat endpoint
app.post('/api/chat', handleChat);

// API info endpoint
app.get('/api/', (c) => c.json({
  name: 'SmokeScan',
  version: '1.0.0',
  endpoints: {
    projects: '/api/projects',
    assessments: '/api/assessments',
    images: '/api/images',
    assess: '/api/assess',
    chat: '/api/chat',
    health: '/api/health',
  },
}));

export default app;
