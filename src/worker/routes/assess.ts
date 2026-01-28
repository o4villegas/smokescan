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
import type { WorkerEnv, AssessmentReport, SessionState, VisionAnalysisOutput, JobState, JobStatus } from '../types';
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

  // Call Qwen-Agent endpoint (handles RAG internally via fdam_rag tool)
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

// ============ Client-Side Polling Endpoints ============

const JOB_TTL = 60 * 60; // 1 hour TTL for job state

/**
 * POST /api/assess/submit
 * Submit assessment job and return immediately with jobId.
 * Client polls /api/assess/status/:jobId for completion.
 */
export async function handleAssessSubmit(c: Context<{ Bindings: WorkerEnv }>) {
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

  // Generate jobId and sessionId
  const jobId = crypto.randomUUID();
  const sessionId = sessionService.generateSessionId();

  // Save images to R2 (in parallel) - fail entire assessment if any upload fails
  let imageR2Keys: string[];
  try {
    imageR2Keys = await Promise.all(
      images.map(async (base64Image, index) => {
        let contentType = 'image/jpeg';
        let rawBase64 = base64Image;

        if (base64Image.startsWith('data:')) {
          const match = base64Image.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            contentType = match[1];
            rawBase64 = match[2];
          }
        }

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

        if (!uploadResult.success) {
          throw new Error(`Failed to upload image ${index + 1}: ${uploadResult.error?.message || 'Unknown error'}`);
        }
        return uploadResult.data.key;
      })
    );
  } catch (uploadError) {
    console.error('[AssessSubmit] Image upload failed:', uploadError);
    return c.json(
      {
        success: false,
        error: {
          code: 500,
          message: `Image upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`,
        },
      },
      500
    );
  }

  // Submit job to RunPod (non-blocking)
  const submitResult = await runpod.submitJob(images, metadata);
  if (!submitResult.success) {
    return c.json(
      { success: false, error: submitResult.error },
      submitResult.error.code as 400 | 500
    );
  }

  const runpodJobId = submitResult.data;

  // Store job state in KV
  const jobState: JobState = {
    jobId,
    runpodJobId,
    status: 'pending',
    sessionId,
    metadata,
    imageR2Keys,
    images, // Store images for result processing
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await c.env.SMOKESCAN_SESSIONS.put(
    `job:${jobId}`,
    JSON.stringify(jobState),
    { expirationTtl: JOB_TTL }
  );

  return c.json({
    success: true,
    data: { jobId },
  });
}

/**
 * GET /api/assess/status/:jobId
 * Check job status without blocking.
 */
export async function handleAssessStatus(c: Context<{ Bindings: WorkerEnv }>) {
  const jobId = c.req.param('jobId');
  if (!jobId) {
    return c.json(
      { success: false, error: { code: 400, message: 'Missing jobId parameter' } },
      400
    );
  }

  // Load job state from KV
  const jobData = await c.env.SMOKESCAN_SESSIONS.get(`job:${jobId}`);
  if (!jobData) {
    return c.json(
      { success: false, error: { code: 404, message: 'Job not found' } },
      404
    );
  }

  let jobState: JobState;
  try {
    jobState = JSON.parse(jobData);
  } catch (parseError) {
    console.error('[AssessStatus] Failed to parse job state:', parseError);
    return c.json(
      { success: false, error: { code: 500, message: 'Invalid job state data' } },
      500
    );
  }

  // If already completed or failed, return cached status
  if (jobState.status === 'completed' || jobState.status === 'failed') {
    return c.json({
      success: true,
      data: {
        jobId,
        status: jobState.status,
        error: jobState.error,
      },
    });
  }

  // Check RunPod status
  const runpod = new RunPodService({
    apiKey: c.env.RUNPOD_API_KEY,
    analysisEndpointId: c.env.RUNPOD_ANALYSIS_ENDPOINT_ID,
  });

  const statusResult = await runpod.getJobStatus(jobState.runpodJobId);
  if (!statusResult.success) {
    return c.json({
      success: true,
      data: {
        jobId,
        status: jobState.status, // Return last known status
      },
    });
  }

  const runpodStatus = statusResult.data.status;

  // Map RunPod status to our JobStatus
  let newStatus: JobStatus = jobState.status;
  let error: string | undefined;

  if (runpodStatus === 'COMPLETED') {
    newStatus = 'completed';
  } else if (runpodStatus === 'FAILED') {
    newStatus = 'failed';
    error = statusResult.data.error || 'Job failed';
  } else if (runpodStatus === 'IN_PROGRESS') {
    newStatus = 'in_progress';
  } else if (runpodStatus === 'IN_QUEUE') {
    newStatus = 'pending';
  }

  // Update KV if status changed
  if (newStatus !== jobState.status) {
    jobState.status = newStatus;
    jobState.updatedAt = new Date().toISOString();
    if (error) jobState.error = error;

    await c.env.SMOKESCAN_SESSIONS.put(
      `job:${jobId}`,
      JSON.stringify(jobState),
      { expirationTtl: JOB_TTL }
    );
  }

  return c.json({
    success: true,
    data: {
      jobId,
      status: newStatus,
      error,
    },
  });
}

/**
 * GET /api/assess/result/:jobId
 * Get results for a completed job.
 */
export async function handleAssessResult(c: Context<{ Bindings: WorkerEnv }>) {
  const jobId = c.req.param('jobId');
  if (!jobId) {
    return c.json(
      { success: false, error: { code: 400, message: 'Missing jobId parameter' } },
      400
    );
  }

  // Load job state from KV
  const jobData = await c.env.SMOKESCAN_SESSIONS.get(`job:${jobId}`);
  if (!jobData) {
    return c.json(
      { success: false, error: { code: 404, message: 'Job not found' } },
      404
    );
  }

  let jobState: JobState;
  try {
    jobState = JSON.parse(jobData);
  } catch (parseError) {
    console.error('[AssessResult] Failed to parse job state:', parseError);
    return c.json(
      { success: false, error: { code: 500, message: 'Invalid job state data' } },
      500
    );
  }

  // Check if job is completed
  if (jobState.status !== 'completed') {
    return c.json(
      { success: false, error: { code: 400, message: `Job not completed. Status: ${jobState.status}` } },
      400
    );
  }

  // Get result from RunPod
  const runpod = new RunPodService({
    apiKey: c.env.RUNPOD_API_KEY,
    analysisEndpointId: c.env.RUNPOD_ANALYSIS_ENDPOINT_ID,
  });

  const resultResponse = await runpod.getJobResult(jobState.runpodJobId);
  if (!resultResponse.success) {
    return c.json(
      { success: false, error: resultResponse.error },
      resultResponse.error.code as 400 | 500
    );
  }

  // Parse report
  const report = parseReport(resultResponse.data);
  const visionAnalysis = extractVisionSummary(resultResponse.data);

  // Save session for chat functionality
  const sessionService = new SessionService({ kv: c.env.SMOKESCAN_SESSIONS });
  const sessionState: SessionState = {
    sessionId: jobState.sessionId,
    createdAt: jobState.createdAt,
    updatedAt: new Date().toISOString(),
    metadata: jobState.metadata,
    imageR2Keys: jobState.imageR2Keys,
    visionAnalysis,
    ragChunks: [],
    report,
    conversationHistory: [],
  };

  await sessionService.save(sessionState);

  // Clean up job state (optional - keep for debugging)
  // await c.env.SMOKESCAN_SESSIONS.delete(`job:${jobId}`);

  return c.json({
    success: true,
    data: {
      sessionId: jobState.sessionId,
      report,
    },
  });
}

/**
 * POST /api/assess/warmup
 * Fire-and-forget warmup to trigger RunPod worker allocation.
 */
export async function handleAssessWarmup(c: Context<{ Bindings: WorkerEnv }>) {
  const runpod = new RunPodService({
    apiKey: c.env.RUNPOD_API_KEY,
    analysisEndpointId: c.env.RUNPOD_ANALYSIS_ENDPOINT_ID,
  });

  const result = await runpod.warmupWorker();

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 500);
  }

  return c.json({ success: true, data: { status: 'warming' } });
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
 * Parse the LLM report output into structured format.
 *
 * Model outputs sections per PASS2_SYSTEM_PROMPT_TEMPLATE in handler.py:
 * 1. Executive Summary
 * 2. Zone Classification
 * 3. Surface Assessment
 * 4. Disposition
 * 5. Sampling Recommendations
 */
function parseReport(reportText: string): AssessmentReport {
  const sections: AssessmentReport = {
    executiveSummary: '',
    detailedAssessment: [],
    fdamRecommendations: [],
    restorationPriority: [],
    scopeIndicators: [],
  };

  // Helper to extract section content between headers
  // Handles: "## 1. Executive Summary", "## Executive Summary", "**Executive Summary**", "1. Executive Summary"
  function extractSection(sectionName: string): string {
    const patterns = [
      // ## 1. Section Name or ## Section Name
      new RegExp(`##\\s*(?:\\d+\\.?\\s*)?${sectionName}[:\\s]*\\n([\\s\\S]*?)(?=\\n##|\\n\\*\\*[A-Z]|\\n\\d+\\.\\s+[A-Z]|$)`, 'i'),
      // **Section Name** or **1. Section Name**
      new RegExp(`\\*\\*(?:\\d+\\.?\\s*)?${sectionName}\\*\\*[:\\s]*\\n?([\\s\\S]*?)(?=\\n##|\\n\\*\\*[A-Z]|\\n\\d+\\.\\s+[A-Z]|$)`, 'i'),
      // 1. Section Name (numbered without markdown)
      new RegExp(`\\d+\\.\\s*${sectionName}[:\\s]*\\n([\\s\\S]*?)(?=\\n##|\\n\\*\\*[A-Z]|\\n\\d+\\.\\s+[A-Z]|$)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = reportText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return '';
  }

  // Helper to extract severity from text
  function extractSeverity(text: string): 'heavy' | 'moderate' | 'light' | 'trace' | 'none' {
    const lowerText = text.toLowerCase();
    if (/\b(heavy|severe|significant)\b/.test(lowerText)) return 'heavy';
    if (/\bmoderate\b/.test(lowerText)) return 'moderate';
    if (/\blight\b/.test(lowerText)) return 'light';
    if (/\btrace\b/.test(lowerText)) return 'trace';
    if (/\b(none|clean|no\s+damage)\b/.test(lowerText)) return 'none';
    return 'moderate'; // Default
  }

  // Helper to extract bullet points from section
  function extractBulletPoints(text: string): string[] {
    const lines = text.split('\n');
    const bullets: string[] = [];

    for (const line of lines) {
      // Match lines starting with -, *, •, or numbered items
      const match = line.match(/^\s*[-•*]\s*(.+)$/) || line.match(/^\s*\d+\.\s*(.+)$/);
      if (match && match[1].trim()) {
        bullets.push(match[1].trim());
      }
    }

    return bullets.length > 0 ? bullets : text.split(/[.!?]+/).filter(s => s.trim().length > 10).slice(0, 5);
  }

  // 1. Extract Executive Summary
  const summaryContent = extractSection('Executive Summary');
  if (summaryContent) {
    sections.executiveSummary = summaryContent.slice(0, 800);
  } else {
    // Fallback: use first paragraph
    const firstPara = reportText.split(/\n\n/)[0];
    sections.executiveSummary = firstPara ? firstPara.trim().slice(0, 500) : 'Assessment report generated.';
  }

  // 2. Extract Zone Classification → detailedAssessment[0]
  const zoneContent = extractSection('Zone Classification');
  if (zoneContent) {
    sections.detailedAssessment.push({
      area: 'Zone Classification',
      findings: zoneContent.slice(0, 1000),
      severity: extractSeverity(zoneContent),
      recommendations: extractBulletPoints(zoneContent).slice(0, 5),
    });
  }

  // 3. Extract Surface Assessment → detailedAssessment[1]
  const surfaceContent = extractSection('Surface Assessment');
  if (surfaceContent) {
    sections.detailedAssessment.push({
      area: 'Surface Assessment',
      findings: surfaceContent.slice(0, 1000),
      severity: extractSeverity(surfaceContent),
      recommendations: extractBulletPoints(surfaceContent).slice(0, 5),
    });
  }

  // 4. Extract Disposition → restorationPriority
  const dispositionContent = extractSection('Disposition');
  if (dispositionContent) {
    const bullets = extractBulletPoints(dispositionContent);
    let priority = 1;

    for (const bullet of bullets.slice(0, 10)) {
      // Try to determine action type from content
      let action = 'Assess';
      const lowerBullet = bullet.toLowerCase();
      if (/\bremove\b|\breplace\b|\bdiscard\b/.test(lowerBullet)) {
        action = 'Remove';
      } else if (/\bclean\b|\bwipe\b|\bhepa\b|\bvacuum\b/.test(lowerBullet)) {
        action = 'Clean';
      } else if (/\bno.?action\b|\bretain\b|\baccept\b/.test(lowerBullet)) {
        action = 'No Action';
      }

      sections.restorationPriority.push({
        priority: priority++,
        area: bullet.split(/[,.:]/)[0].slice(0, 50) || `Item ${priority - 1}`,
        action,
        rationale: bullet,
      });
    }
  }

  // 5. Extract Sampling Recommendations → scopeIndicators + fdamRecommendations
  const samplingContent = extractSection('Sampling Recommendations') || extractSection('Sampling');
  if (samplingContent) {
    const bullets = extractBulletPoints(samplingContent);
    sections.scopeIndicators = bullets.slice(0, 10);
    sections.fdamRecommendations = bullets.slice(0, 10);
  }

  // Also try to extract any general recommendations section
  const generalRecContent = extractSection('Recommendations') || extractSection('FDAM Recommendations');
  if (generalRecContent && sections.fdamRecommendations.length === 0) {
    sections.fdamRecommendations = extractBulletPoints(generalRecContent).slice(0, 10);
  }

  // Fallbacks if sections are empty
  if (sections.detailedAssessment.length === 0) {
    // Try to create assessment from any structured content
    sections.detailedAssessment.push({
      area: 'General Assessment',
      findings: sections.executiveSummary || 'Assessment pending detailed analysis.',
      severity: extractSeverity(reportText),
      recommendations: ['Review detailed findings', 'Conduct follow-up inspection as needed'],
    });
  }

  if (sections.fdamRecommendations.length === 0) {
    sections.fdamRecommendations = [
      'Conduct detailed sampling per FDAM protocols',
      'Document all damage areas photographically',
      'Obtain laboratory analysis of samples',
    ];
  }

  if (sections.restorationPriority.length === 0) {
    sections.restorationPriority.push({
      priority: 1,
      area: 'General',
      action: 'Assess',
      rationale: 'Complete detailed assessment before restoration planning',
    });
  }

  if (sections.scopeIndicators.length === 0) {
    sections.scopeIndicators = [
      'Visual assessment completed',
      'Zone classification assigned',
      'Disposition recommendations provided',
    ];
  }

  return sections;
}
