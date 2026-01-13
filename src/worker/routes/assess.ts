/**
 * Assessment Route Handler
 * POST /api/assess - Submit images for FDAM assessment
 *
 * Architecture: Single-call pattern where the Qwen3-VL agent handles RAG internally.
 * The agent uses tool calling to query Cloudflare AI Search for FDAM methodology.
 */

import type { Context } from 'hono';
import type { WorkerEnv, AssessmentReport, SessionState, VisionAnalysisOutput } from '../types';
import { AssessmentRequestSchema } from '../schemas';
import { RunPodService, SessionService } from '../services';

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

  const session = new SessionService({ kv: c.env.SMOKESCAN_SESSIONS });

  // Single call to agent - it handles RAG internally via tool calling
  const assessResult = await runpod.assess(images, metadata);
  if (!assessResult.success) {
    return c.json(
      { success: false, error: assessResult.error },
      assessResult.error.code as 400 | 500
    );
  }

  // Parse the report into structured format
  const report = parseReport(assessResult.data);

  // Create minimal vision analysis for session state (for chat context)
  // The agent now handles this internally, but we need session data for chat
  const visionAnalysis: VisionAnalysisOutput = extractVisionSummary(assessResult.data);

  // Save session (without RAG chunks - agent retrieves dynamically)
  const sessionId = session.generateSessionId();
  const sessionState: SessionState = {
    sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata,
    imageUrls: [], // Don't store full images in session
    visionAnalysis,
    ragChunks: [], // No longer pre-fetching RAG - agent handles dynamically
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
 * Extract basic vision summary from report for session state.
 * Used to provide context in follow-up chat sessions.
 */
function extractVisionSummary(reportText: string): VisionAnalysisOutput {
  // Extract zone classification from report
  let zoneClassification: 'burn' | 'near-field' | 'far-field' = 'far-field';
  if (/\bburn\s*zone\b/i.test(reportText)) {
    zoneClassification = 'burn';
  } else if (/\bnear[-\s]?field\b/i.test(reportText)) {
    zoneClassification = 'near-field';
  }

  // Extract severity from report
  let overallSeverity: 'heavy' | 'moderate' | 'light' | 'trace' | 'none' = 'moderate';
  if (/\b(heavy|severe)\s*(damage|contamination)\b/i.test(reportText)) {
    overallSeverity = 'heavy';
  } else if (/\blight\s*(damage|contamination)\b/i.test(reportText)) {
    overallSeverity = 'light';
  } else if (/\btrace\b/i.test(reportText)) {
    overallSeverity = 'trace';
  }

  return {
    damageInventory: [],
    retrievalKeywords: [],
    overallSeverity,
    zoneClassification,
    confidenceScore: 0.8,
  };
}

/**
 * Parse the LLM report output into structured format
 */
function parseReport(reportText: string): AssessmentReport {
  // Extract sections from the report text

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
    /(?:fdam|recommendations?|protocol)[:\s]*\n?([\s\S]*?)(?=\n##|\n\*\*[A-Z]|$)/i
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
