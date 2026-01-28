/**
 * SmokeScan Worker Entry Point
 * Cloudflare Worker API for FDAM fire damage assessment
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { WorkerEnv } from './types';
import {
  handleAssess,
  handleAssessSubmit,
  handleAssessStatus,
  handleAssessResult,
  handleAssessWarmup,
  handleChat,
  handleHealth,
  handleRagTest,
  handleRagQuery,
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

// RAG query endpoint (called by RunPod Qwen-Agent)
app.post('/api/rag/query', handleRagQuery);

// Project management routes
app.route('/api/projects', projectsRoutes);

// Assessment management routes
app.route('/api/assessments', assessmentsRoutes);

// Also mount create assessment under projects for RESTful pattern
app.post('/api/projects/:projectId/assessments', async (c) => {
  // Forward to assessments route
  const { projectId } = c.req.param();
  const body = await c.req.json();

  // Create assessment with project_id and all FDAM fields
  const { DatabaseService } = await import('./services/database');
  const db = new DatabaseService(c.env.SMOKESCAN_DB);

  const result = await db.createAssessment({
    project_id: projectId,
    room_type: body.room_type,
    room_name: body.room_name,
    // FDAM fields (optional - pre-filled for seeded data)
    structure_type: body.structure_type,
    floor_level: body.floor_level,
    dimensions: body.dimensions,
    sensory_observations: body.sensory_observations,
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

// New polling-based assessment endpoints (avoids Cloudflare 30s timeout)
app.post('/api/assess/submit', handleAssessSubmit);
app.get('/api/assess/status/:jobId', handleAssessStatus);
app.get('/api/assess/result/:jobId', handleAssessResult);
app.post('/api/assess/warmup', handleAssessWarmup);

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
    assessSubmit: '/api/assess/submit',
    assessStatus: '/api/assess/status/:jobId',
    assessResult: '/api/assess/result/:jobId',
    assessWarmup: '/api/assess/warmup',
    chat: '/api/chat',
    health: '/api/health',
    ragQuery: '/api/rag/query',
  },
}));

export default app;
