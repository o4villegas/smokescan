/**
 * Chat Route Handler
 * POST /api/chat - Send follow-up questions about an assessment
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { ChatRequestSchema } from '../schemas';
import { RunPodService, RAGService, SessionService } from '../services';

export async function handleChat(c: Context<{ Bindings: WorkerEnv }>) {
  // Parse and validate request
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: 400, message: 'Invalid JSON body' } },
      400
    );
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 400,
          message: 'Validation failed',
          details: parsed.error.issues,
        },
      },
      400
    );
  }

  const { sessionId, message } = parsed.data;

  // Load session
  const sessionService = new SessionService({ kv: c.env.SMOKESCAN_SESSIONS });
  const sessionResult = await sessionService.load(sessionId);

  if (!sessionResult.success) {
    return c.json(
      { success: false, error: sessionResult.error },
      sessionResult.error.code as 404 | 500
    );
  }

  const session = sessionResult.data;

  // Build context from session
  const rag = new RAGService({ ai: c.env.AI });
  const ragContext = rag.formatContext(session.ragChunks);

  const sessionContext = `
## Assessment Summary
- Room Type: ${session.metadata.roomType}
- Structure Type: ${session.metadata.structureType}
- Overall Severity: ${session.visionAnalysis.overallSeverity}
- Zone Classification: ${session.visionAnalysis.zoneClassification}

## Key Findings
${session.visionAnalysis.damageInventory
  .slice(0, 5)
  .map((item) => `- ${item.damageType} at ${item.location} (${item.severity})`)
  .join('\n')}

## Executive Summary
${session.report.executiveSummary}

## FDAM Reference
${ragContext}
`;

  // Build conversation history
  const conversationHistory = [
    ...session.conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user' as const, content: message },
  ];

  // Get chat response
  const runpod = new RunPodService({
    apiKey: c.env.RUNPOD_API_KEY,
    endpointId: c.env.RUNPOD_VISION_ENDPOINT_ID,
  });

  const chatResult = await runpod.chat(conversationHistory, sessionContext);

  if (!chatResult.success) {
    return c.json(
      { success: false, error: chatResult.error },
      chatResult.error.code as 400 | 500
    );
  }

  const response = chatResult.data;
  const timestamp = new Date().toISOString();

  // Update session with new messages
  session.conversationHistory.push(
    { role: 'user', content: message, timestamp },
    { role: 'assistant', content: response, timestamp }
  );

  await sessionService.save(session);

  return c.json({
    success: true,
    data: {
      sessionId,
      response,
      timestamp,
    },
  });
}
