/**
 * RAG Query Route
 * POST /api/rag/query - Query FDAM methodology from Cloudflare AI Search
 * Called by RunPod handler when Qwen-Agent's fdam_rag tool is invoked
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { RAGService } from '../services';
import { z } from 'zod';

const RagQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  maxChunks: z.number().min(1).max(10).optional().default(5),
});

export async function handleRagQuery(c: Context<{ Bindings: WorkerEnv }>) {
  const startTime = Date.now();

  // Parse and validate request
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: 'Invalid JSON body' },
      400
    );
  }

  const parsed = RagQuerySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues,
      },
      400
    );
  }

  const { query, maxChunks } = parsed.data;

  console.log(`[RAG Query] Received query: "${query.slice(0, 100)}..."`);

  // Query Cloudflare AI Search
  const ragService = new RAGService({ ai: c.env.AI });
  const result = await ragService.retrieve([query], maxChunks);

  if (!result.success) {
    console.error(`[RAG Query] Failed: ${result.error.message}`);
    return c.json({ success: false, error: 'RAG query failed' }, 500);
  }

  // Format context for the LLM
  const context = ragService.formatContext(result.data);
  const processingTimeMs = Date.now() - startTime;

  console.log(`[RAG Query] Retrieved ${result.data.length} chunks in ${processingTimeMs}ms`);

  return c.json({
    success: true,
    data: {
      context,
      chunks: result.data.length,
      processingTimeMs,
    },
  });
}
