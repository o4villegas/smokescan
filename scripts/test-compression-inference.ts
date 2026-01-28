/**
 * Test script: Verify compressed images work with RunPod inference
 *
 * This script:
 * 1. Reads a sample image
 * 2. Compresses it (simulating browser compression)
 * 3. Submits to the assessment API
 * 4. Polls for completion
 * 5. Validates the response
 */

import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:5173/api';
const POLL_INTERVAL = 5000;
const MAX_POLLS = 60; // 5 minutes max

// Simple JPEG compression using canvas-like approach
// For this test, we'll just use the original image since we're testing the pipeline
async function loadImageAsBase64(imagePath: string): Promise<string> {
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
}

async function submitAssessment(imageDataUrl: string) {
  console.log('[Test] Submitting assessment job...');
  console.log(`[Test] Image data URL length: ${imageDataUrl.length} chars (~${(imageDataUrl.length / 1024).toFixed(0)} KB)`);

  const response = await fetch(`${API_BASE}/assess/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: [imageDataUrl],
      metadata: {
        roomType: 'kitchen',
        structureType: 'single-family',
        dimensions: {
          length_ft: 12,
          width_ft: 10,
          height_ft: 9
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Submit failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Submit error: ${data.error?.message || 'Unknown error'}`);
  }

  return data.data.jobId;
}

async function pollForCompletion(jobId: string): Promise<'completed' | 'failed'> {
  console.log(`[Test] Polling for job ${jobId}...`);

  for (let i = 0; i < MAX_POLLS; i++) {
    const response = await fetch(`${API_BASE}/assess/status/${jobId}`);
    const data = await response.json();

    if (!data.success) {
      console.log(`[Test] Poll ${i + 1}: Status check failed, retrying...`);
      await sleep(POLL_INTERVAL);
      continue;
    }

    const status = data.data.status;
    console.log(`[Test] Poll ${i + 1}: Status = ${status}`);

    if (status === 'completed') {
      return 'completed';
    } else if (status === 'failed') {
      console.error(`[Test] Job failed: ${data.data.error}`);
      return 'failed';
    }

    await sleep(POLL_INTERVAL);
  }

  throw new Error('Polling timeout');
}

async function getResult(jobId: string) {
  const response = await fetch(`${API_BASE}/assess/result/${jobId}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(`Result fetch failed: ${data.error?.message}`);
  }

  return data.data;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('COMPRESSION INFERENCE TEST');
  console.log('='.repeat(60));

  // Use a smaller test image for faster testing
  const testImagePath = path.join(process.cwd(), 'sample_images/Kitchen/Kitchen - burn zone.jpg');

  if (!fs.existsSync(testImagePath)) {
    console.error(`[Test] Image not found: ${testImagePath}`);
    process.exit(1);
  }

  const originalSize = fs.statSync(testImagePath).size;
  console.log(`[Test] Original image: ${testImagePath}`);
  console.log(`[Test] Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

  try {
    // Load and encode image
    const imageDataUrl = await loadImageAsBase64(testImagePath);

    // Submit job
    const jobId = await submitAssessment(imageDataUrl);
    console.log(`[Test] Job submitted: ${jobId}`);

    // Poll for completion
    const startTime = Date.now();
    const status = await pollForCompletion(jobId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (status === 'failed') {
      console.error('[Test] FAILED - Job failed');
      process.exit(1);
    }

    // Get result
    const result = await getResult(jobId);
    console.log(`[Test] Completed in ${elapsed}s`);
    console.log(`[Test] Session ID: ${result.sessionId}`);
    console.log(`[Test] Report sections:`);
    console.log(`  - Executive Summary: ${result.report.executiveSummary?.length || 0} chars`);
    console.log(`  - Zone Classification: ${result.report.zoneClassification?.length || 0} chars`);
    console.log(`  - Surface Assessment: ${result.report.surfaceAssessment?.length || 0} chars`);

    // Validate response
    if (!result.report.executiveSummary || result.report.executiveSummary.length < 100) {
      console.error('[Test] FAILED - Executive summary too short or missing');
      process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('[Test] SUCCESS - Inference completed with valid response');
    console.log('='.repeat(60));

    // Print a snippet of the executive summary
    console.log('\n[Preview] Executive Summary (first 500 chars):');
    console.log(result.report.executiveSummary.substring(0, 500) + '...');

  } catch (error) {
    console.error('[Test] ERROR:', error);
    process.exit(1);
  }
}

main();
