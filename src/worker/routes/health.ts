/**
 * Health Check Route Handler
 * GET /api/health - System health status
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

  // Check RunPod configuration
  checks.services.runpod = !!(
    c.env.RUNPOD_API_KEY && c.env.RUNPOD_VISION_ENDPOINT_ID
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
