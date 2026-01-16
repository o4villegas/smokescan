/**
 * Health Check Route Handler
 * GET /api/health - System health status
 * GET /api/health/rag?q=query - Test AI Search binding
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';

export async function handleHealth(c: Context<{ Bindings: WorkerEnv }>) {
  const checks = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      worker: true,
      runpod: false,
      aiSearch: false,
      kv: false,
    },
    version: '1.0.1',
  };

  // Check RunPod configuration (Analysis endpoint only)
  checks.services.runpod = !!(
    c.env.RUNPOD_API_KEY &&
    c.env.RUNPOD_ANALYSIS_ENDPOINT_ID
  );

  // Check AI binding
  checks.services.aiSearch = !!c.env.AI;

  // Check KV binding
  try {
    if (c.env.SMOKESCAN_SESSIONS) {
      await c.env.SMOKESCAN_SESSIONS.get('health-check');
      checks.services.kv = true;
    }
  } catch {
    checks.services.kv = false;
  }

  // Determine overall status
  const allHealthy = Object.values(checks.services).every((v) => v);
  const someHealthy = Object.values(checks.services).some((v) => v);

  if (allHealthy) {
    checks.status = 'healthy';
  } else if (someHealthy) {
    checks.status = 'degraded';
  } else {
    checks.status = 'unhealthy';
  }

  const statusCode = checks.status === 'unhealthy' ? 503 : 200;

  return c.json(checks, statusCode);
}

/**
 * Test AI Search binding directly
 * GET /api/health/rag?q=query
 */
export async function handleRagTest(c: Context<{ Bindings: WorkerEnv }>) {
  const query = c.req.query('q') || 'FDAM fire damage methodology';

  try {
    const response = await c.env.AI.autorag('smokescan-rag').search({
      query,
      max_num_results: 5,
      rewrite_query: true,
    });

    return c.json({
      success: true,
      query,
      results: response.data?.map((r) => ({
        filename: r.filename,
        score: r.score,
        contentPreview: r.content?.[0]?.text?.slice(0, 200) + '...',
      })) || [],
      total: response.data?.length || 0,
    });
  } catch (e) {
    return c.json({
      success: false,
      query,
      error: String(e),
    }, 500);
  }
}

