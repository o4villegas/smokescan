/**
 * Assessment Route Handler
 * POST /api/assess - Submit images for FDAM assessment
 */

import type { Context } from 'hono';
import type { WorkerEnv, AssessmentReport, SessionState } from '../types';
import { AssessmentRequestSchema } from '../schemas';
import { RunPodService, RAGService, SessionService } from '../services';

export async function handleAssess(c: Context<{ Bindings: WorkerEnv }>) {
  const startTime = Date.now();

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

  const parsed = AssessmentRequestSchema.safeParse(body);
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

  const { images, metadata } = parsed.data;

  // Initialize services
  const runpod = new RunPodService({
    apiKey: c.env.RUNPOD_API_KEY,
    endpointId: c.env.RUNPOD_VISION_ENDPOINT_ID,
  });

  const rag = new RAGService({ ai: c.env.AI });
  const session = new SessionService({ kv: c.env.SMOKESCAN_SESSIONS });

  // Phase 1: Vision analysis
  const visionResult = await runpod.analyzeImages(images, metadata);
  if (!visionResult.success) {
    return c.json(
      { success: false, error: visionResult.error },
      visionResult.error.code as 400 | 500
    );
  }

  const visionAnalysis = visionResult.data;

  // Phase 2: RAG retrieval
  const ragResult = await rag.retrieve(visionAnalysis.retrievalKeywords);
  const ragChunks = ragResult.success ? ragResult.data : [];
  const ragContext = rag.formatContext(ragChunks);

  // Phase 3: Synthesis
  const synthesisResult = await runpod.synthesizeReport(
    images,
    visionAnalysis,
    ragContext,
    metadata
  );

  if (!synthesisResult.success) {
    return c.json(
      { success: false, error: synthesisResult.error },
      synthesisResult.error.code as 400 | 500
    );
  }

  // Parse the report into structured format
  const report = parseReport(synthesisResult.data);

  // Phase 4: Save session
  const sessionId = session.generateSessionId();
  const sessionState: SessionState = {
    sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata,
    imageUrls: [], // Don't store full images in session
    visionAnalysis,
    ragChunks,
    report,
    conversationHistory: [],
  };

  await session.save(sessionState);

  const processingTimeMs = Date.now() - startTime;

  return c.json({
    success: true,
    data: {
      sessionId,
      report,
      processingTimeMs,
    },
  });
}

/**
 * Parse the LLM report output into structured format
 */
function parseReport(reportText: string): AssessmentReport {
  // Extract sections from the report text
  // This is a simplified parser - in production, you might want
  // the LLM to output structured JSON directly

  const sections = {
    executiveSummary: '',
    detailedAssessment: [] as AssessmentReport['detailedAssessment'],
    fdamRecommendations: [] as string[],
    restorationPriority: [] as AssessmentReport['restorationPriority'],
    scopeIndicators: [] as string[],
  };

  // Extract executive summary (first paragraph or section)
  const summaryMatch = reportText.match(
    /(?:executive\s+summary|summary)[:\s]*\n?([\s\S]*?)(?=\n##|\n\*\*|$)/i
  );
  if (summaryMatch) {
    sections.executiveSummary = summaryMatch[1].trim().slice(0, 500);
  } else {
    // Use first 2-3 sentences as summary
    const sentences = reportText.split(/[.!?]+/).slice(0, 3);
    sections.executiveSummary = sentences.join('. ').trim() + '.';
  }

  // Extract FDAM recommendations
  const recMatch = reportText.match(
    /(?:fdam|recommendations?)[:\s]*\n?([\s\S]*?)(?=\n##|\n\*\*[A-Z]|$)/i
  );
  if (recMatch) {
    sections.fdamRecommendations = recMatch[1]
      .split(/\n[-•*]\s*/)
      .filter((r) => r.trim().length > 0)
      .map((r) => r.trim())
      .slice(0, 10);
  }

  // Extract scope indicators
  const scopeMatch = reportText.match(
    /(?:scope|indicators?)[:\s]*\n?([\s\S]*?)(?=\n##|\n\*\*[A-Z]|$)/i
  );
  if (scopeMatch) {
    sections.scopeIndicators = scopeMatch[1]
      .split(/\n[-•*]\s*/)
      .filter((s) => s.trim().length > 0)
      .map((s) => s.trim())
      .slice(0, 10);
  }

  // If we couldn't parse structured sections, create minimal structure
  if (sections.fdamRecommendations.length === 0) {
    sections.fdamRecommendations = [
      'Conduct detailed sampling per FDAM protocols',
      'Document all damage areas photographically',
      'Obtain laboratory analysis of samples',
    ];
  }

  if (sections.scopeIndicators.length === 0) {
    sections.scopeIndicators = [
      'Visual assessment completed',
      'Damage inventory documented',
      'Zone classification assigned',
    ];
  }

  return sections;
}
