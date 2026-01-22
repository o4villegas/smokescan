/**
 * Chat Route Handler
 * POST /api/chat - Send follow-up questions about an assessment
 *
 * Architecture:
 * Qwen-Agent on RunPod handles chat with session context and images
 * All images (original assessment + new uploads) are sent to the model
 * RAG retrieval is handled internally via fdam_rag tool when needed
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { ChatRequestSchema } from '../schemas';
import { RunPodService, SessionService, StorageService } from '../services';

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

  const { sessionId, message, images: newImages } = parsed.data;

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

  // Initialize storage service for R2 access
  const storage = new StorageService(
    c.env.SMOKESCAN_IMAGES,
    c.env.SMOKESCAN_REPORTS,
    c.env.R2_PUBLIC_URL_BASE
  );

  // Load existing images - prefer public URLs (avoids 10MB limit), fall back to base64
  console.log(`[Chat] Loading ${session.imageR2Keys.length} existing images from R2`);
  const existingImages: string[] = [];
  if (storage.hasPublicAccess()) {
    // Use public URLs - no need to fetch from R2
    for (const key of session.imageR2Keys) {
      const url = storage.getPublicUrl(key);
      if (url) existingImages.push(url);
    }
    console.log(`[Chat] Using ${existingImages.length} R2 public URLs`);
  } else {
    // Fall back to base64 data URIs
    for (const key of session.imageR2Keys) {
      const imageResult = await storage.getSignedUrl(key);
      if (imageResult.success) {
        existingImages.push(imageResult.data);
      } else {
        console.warn(`[Chat] Failed to load image ${key}:`, imageResult.error);
      }
    }
    console.log(`[Chat] Loaded ${existingImages.length} images as base64`);
  }

  // Save new images to R2 if provided
  const newImageKeys: string[] = [];
  if (newImages && newImages.length > 0) {
    console.log(`[Chat] Saving ${newImages.length} new images to R2`);
    for (let i = 0; i < newImages.length; i++) {
      const base64Image = newImages[i];

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
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }

      const uploadResult = await storage.uploadImage(
        sessionId,
        `chat-image-${Date.now()}-${i}.${contentType.split('/')[1] || 'jpg'}`,
        bytes.buffer,
        contentType
      );

      if (uploadResult.success) {
        newImageKeys.push(uploadResult.data.key);
        // Add full data URI to existing images for this request
        const dataUri = base64Image.startsWith('data:')
          ? base64Image
          : `data:${contentType};base64,${rawBase64}`;
        existingImages.push(dataUri);
      } else {
        console.warn(`[Chat] Failed to upload new image ${i}:`, uploadResult.error);
      }
    }

    // Update session with new image keys
    if (newImageKeys.length > 0) {
      session.imageR2Keys.push(...newImageKeys);
      console.log(`[Chat] Updated session with ${newImageKeys.length} new image keys`);
    }
  }

  console.log(`[Chat] Total images for model: ${existingImages.length}`);

  // Build session context for the analysis endpoint
  const sessionContext = `
## Assessment Summary
- Room Type: ${session.metadata.roomType}
- Structure Type: ${session.metadata.structureType}
- Overall Severity: ${session.visionAnalysis.overallSeverity}
- Zone Classification: ${session.visionAnalysis.zoneClassification}

## Executive Summary
${session.report.executiveSummary}

## Key Recommendations
${session.report.fdamRecommendations.slice(0, 5).map((r) => `- ${r}`).join('\n')}
`;

  // Build conversation history
  const conversationHistory = [
    ...session.conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user' as const, content: message },
  ];

  // Initialize RunPod service (Qwen-Agent handles RAG via fdam_rag tool)
  const runpod = new RunPodService({
    apiKey: c.env.RUNPOD_API_KEY,
    analysisEndpointId: c.env.RUNPOD_ANALYSIS_ENDPOINT_ID,
  });

  // Call Qwen-Agent endpoint with all images (handles RAG internally via fdam_rag tool)
  const chatResult = await runpod.chat(conversationHistory, sessionContext, existingImages);

  if (!chatResult.success) {
    return c.json(
      { success: false, error: chatResult.error },
      chatResult.error.code as 400 | 500
    );
  }

  const response = chatResult.data;
  const timestamp = new Date().toISOString();

  // Reload session and merge changes to avoid race condition
  // (another concurrent request may have modified imageR2Keys or conversationHistory)
  const freshSessionResult = await sessionService.load(sessionId);
  if (freshSessionResult.success) {
    const freshSession = freshSessionResult.data;

    // Merge new image keys (avoid duplicates)
    if (newImageKeys.length > 0) {
      const existingKeySet = new Set(freshSession.imageR2Keys);
      for (const key of newImageKeys) {
        if (!existingKeySet.has(key)) {
          freshSession.imageR2Keys.push(key);
        }
      }
    }

    // Append new messages to conversation history
    freshSession.conversationHistory.push(
      { role: 'user', content: message, timestamp },
      { role: 'assistant', content: response, timestamp }
    );

    await sessionService.save(freshSession);
  } else {
    // Fallback: save original session if reload fails (edge case)
    console.warn('[Chat] Failed to reload session for merge, saving original');
    session.conversationHistory.push(
      { role: 'user', content: message, timestamp },
      { role: 'assistant', content: response, timestamp }
    );
    await sessionService.save(session);
  }

  return c.json({
    success: true,
    data: {
      sessionId,
      response,
      timestamp,
      newImageKeys, // Return new image keys so UI can update gallery
    },
  });
}
