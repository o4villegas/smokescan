/**
 * Images Routes
 * API endpoints for image upload and retrieval
 */

import { Hono } from 'hono';
import type { WorkerEnv } from '../types';
import { DatabaseService } from '../services/database';
import { StorageService } from '../services/storage';

const app = new Hono<{ Bindings: WorkerEnv }>();

// POST /api/images/upload - Upload image for an assessment
app.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const assessmentId = formData.get('assessment_id') as string | null;

  if (!file) {
    return c.json(
      { success: false, error: { code: 400, message: 'No file provided' } },
      400
    );
  }

  if (!assessmentId) {
    return c.json(
      { success: false, error: { code: 400, message: 'No assessment_id provided' } },
      400
    );
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!allowedTypes.includes(file.type)) {
    return c.json(
      { success: false, error: { code: 400, message: 'Invalid file type. Allowed: JPEG, PNG, WebP, HEIC' } },
      400
    );
  }

  // Validate file size (max 20MB)
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    return c.json(
      { success: false, error: { code: 400, message: 'File too large. Maximum size: 20MB' } },
      400
    );
  }

  const db = new DatabaseService(c.env.SMOKESCAN_DB);
  const storage = new StorageService(c.env.SMOKESCAN_IMAGES, c.env.SMOKESCAN_REPORTS, c.env.R2_PUBLIC_URL_BASE);

  // Verify assessment exists
  const assessmentResult = await db.getAssessment(assessmentId);
  if (!assessmentResult.success) {
    return c.json({ success: false, error: assessmentResult.error }, assessmentResult.error.code);
  }

  // Upload to R2
  const arrayBuffer = await file.arrayBuffer();
  const uploadResult = await storage.uploadImage(assessmentId, file.name, arrayBuffer, file.type);

  if (!uploadResult.success) {
    return c.json({ success: false, error: uploadResult.error }, uploadResult.error.code);
  }

  // Create database record
  const imageRecord = await db.createImageRecord(
    assessmentId,
    uploadResult.data.key,
    file.name,
    file.type,
    uploadResult.data.size
  );

  if (!imageRecord.success) {
    // Rollback R2 upload
    await storage.deleteImage(uploadResult.data.key);
    return c.json({ success: false, error: imageRecord.error }, imageRecord.error.code);
  }

  return c.json({ success: true, data: imageRecord.data }, 201);
});

// GET /api/images/:key - Get image by R2 key
app.get('/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const storage = new StorageService(c.env.SMOKESCAN_IMAGES, c.env.SMOKESCAN_REPORTS, c.env.R2_PUBLIC_URL_BASE);

  const result = await storage.getImage(key);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return new Response(result.data.data, {
    headers: {
      'Content-Type': result.data.contentType,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
});

// GET /api/images/assessment/:assessmentId - List images for assessment
app.get('/assessment/:assessmentId', async (c) => {
  const { assessmentId } = c.req.param();
  const db = new DatabaseService(c.env.SMOKESCAN_DB);

  const result = await db.getImagesByAssessment(assessmentId);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, result.error.code);
  }

  return c.json({ success: true, data: result.data });
});

// DELETE /api/images/:id - Delete image
app.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const db = new DatabaseService(c.env.SMOKESCAN_DB);
  const storage = new StorageService(c.env.SMOKESCAN_IMAGES, c.env.SMOKESCAN_REPORTS, c.env.R2_PUBLIC_URL_BASE);

  // Get image record first to get R2 key
  const imageResult = await db.deleteImage(id);

  if (!imageResult.success) {
    return c.json({ success: false, error: imageResult.error }, imageResult.error.code);
  }

  // Delete from R2 if record existed
  if (imageResult.data) {
    await storage.deleteImage(imageResult.data.r2_key);
  }

  return c.json({ success: true, data: null });
});

export { app as imagesRoutes };
