/**
 * Assessment Route Handler
 * POST /api/assess - Submit images for FDAM assessment
 *
 * Architecture:
 * Qwen-Agent on RunPod handles both vision reasoning AND RAG retrieval
 * The VL model decides when to query FDAM methodology based on what it observes
 * RAG queries are made via the fdam_rag tool calling back to /api/rag/query
 */

import type { Context } from 'hono';
import type { WorkerEnv, AssessmentReport, SessionState, VisionAnalysisOutput } from '../types';
import { AssessmentRequestSchema } from '../schemas';
import { RunPodService, SessionService, StorageService } from '../services';

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
    analysisEndpointId: c.env.RUNPOD_ANALYSIS_ENDPOINT_ID,
  });
  const sessionService = new SessionService({ kv: c.env.SMOKESCAN_SESSIONS });
  const storage = new StorageService(c.env.SMOKESCAN_IMAGES, c.env.SMOKESCAN_REPORTS);

  // Generate sessionId first (used as prefix for R2 storage)
  const sessionId = sessionService.generateSessionId();

  // Save images to R2 for later use in chat (in parallel)
  console.log(`[Assess] Saving ${images.length} images to R2`);
  const imageR2Keys: string[] = [];
  const uploadPromises = images.map(async (base64Image, index) => {
    // Extract content type from data URI or default to jpeg
    let contentType = 'image/jpeg';
    let rawBase64 = base64Image;

    if (base64Image.startsWith('data:')) {
      const match = base64Image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contentType = match[1];
        rawBase64 = match[2];
      }
    }

    // Convert base64 to ArrayBuffer
    const binaryString = atob(rawBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const uploadResult = await storage.uploadImage(
      sessionId,
      `image-${index}.${contentType.split('/')[1] || 'jpg'}`,
      bytes.buffer,
      contentType
    );

    if (uploadResult.success) {
      return uploadResult.data.key;
    }
    console.warn(`[Assess] Failed to upload image ${index}:`, uploadResult.error);
    return null;
  });

  const uploadedKeys = await Promise.all(uploadPromises);
  for (const key of uploadedKeys) {
    if (key) imageR2Keys.push(key);
  }
  console.log(`[Assess] Saved ${imageR2Keys.length}/${images.length} images to R2`);

  // Call Qwen-Agent endpoint (handles RAG internally via fdam_rag tool)
  console.log(`[Assess] Sending ${images.length} images to Qwen-Agent`);
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

  // Save session with R2 image keys for chat access
  const sessionState: SessionState = {
    sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata,
    imageR2Keys, // R2 keys for images (enables chat with images)
    visionAnalysis,
    ragChunks: [], // No longer pre-fetching RAG - agent handles dynamically
    report,
    conversationHistory: [],
  };

  await sessionService.save(sessionState);

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
