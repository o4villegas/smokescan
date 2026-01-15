/**
 * RunPod Embedding Endpoint Integration Tests
 *
 * Tests the image embedding capability of the retrieval endpoint
 * using Qwen3-VL-Embedding-8B model.
 *
 * Requirements:
 * - RUNPOD_API_KEY environment variable
 * - RUNPOD_RETRIEVAL_ENDPOINT_ID environment variable
 * - Sample images in sample_images/ folder
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { RunPodService } from '../services/runpod';
import {
  cosineSimilarity,
  validateVectorizePayload,
  createVectorizePayload,
} from './utils/embedding-utils';
import {
  getSingleTestImage,
  getTestImagesAsDataUri,
  getTestImageMetadata,
  getRunPodConfig,
} from './utils/test-helpers';

const EXPECTED_DIMENSION = 4096;
const SIMILARITY_THRESHOLD = 0.7;

describe('RunPod Embedding Endpoint', () => {
  let runpodService: RunPodService;

  beforeAll(() => {
    const config = getRunPodConfig();
    runpodService = new RunPodService(config);
  });

  /**
   * Test 1: Basic Embedding Generation
   * Verify that embeddings are generated with the correct dimension (4096)
   */
  it('should generate embeddings with correct dimension (4096)', async () => {
    // Get one test image from kitchen folder
    const imageDataUri = getSingleTestImage('kitchen', 0);

    // Call embed endpoint
    const result = await runpodService.embed([imageDataUri]);

    // Assertions - log error if failed
    if (!result.success) {
      console.error('Test 1 - Embed failed:', JSON.stringify(result.error, null, 2));
    }
    expect(result.success).toBe(true);

    if (result.success) {
      const data = result.data;

      // Check dimension in response
      expect(data.dimension).toBe(EXPECTED_DIMENSION);

      // Check embeddings array
      expect(data.embeddings).toHaveLength(1);
      expect(data.embeddings[0]).toHaveLength(EXPECTED_DIMENSION);

      // Verify embedding values are valid numbers
      expect(data.embeddings[0].every((v) => typeof v === 'number' && !isNaN(v))).toBe(true);
    }
  }, 120000);

  /**
   * Test 2: Batch Embedding
   * Verify that batch processing works correctly (3-5 images)
   */
  it('should handle batch embedding (3 images)', async () => {
    // Get 3 kitchen images
    const kitchenImages = getTestImagesAsDataUri('kitchen').slice(0, 3);
    expect(kitchenImages).toHaveLength(3);

    // Call embed endpoint with batch
    const result = await runpodService.embed(kitchenImages);

    // Assertions
    expect(result.success).toBe(true);

    if (result.success) {
      const data = result.data;

      // Should return 3 embeddings
      expect(data.embeddings).toHaveLength(3);

      // Each should have correct dimension
      for (const embedding of data.embeddings) {
        expect(embedding).toHaveLength(EXPECTED_DIMENSION);
      }

      expect(data.dimension).toBe(EXPECTED_DIMENSION);
    }
  }, 120000);

  /**
   * Test 3: Semantic Similarity (Same Folder)
   * Images from the same location should have high cosine similarity (>0.7)
   */
  it('should produce similar embeddings for related images (cosine > 0.7)', async () => {
    // Get all kitchen images (6 images of same room)
    const kitchenImages = getTestImagesAsDataUri('kitchen');
    expect(kitchenImages.length).toBeGreaterThanOrEqual(3);

    // Use first 3 to limit API calls
    const testImages = kitchenImages.slice(0, 3);

    // Embed all images in batch
    const result = await runpodService.embed(testImages);

    expect(result.success).toBe(true);

    if (result.success) {
      const embeddings = result.data.embeddings;

      // Calculate pairwise similarities
      const similarities: number[] = [];
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
          similarities.push(similarity);
          console.log(`Kitchen images ${i} vs ${j}: cosine similarity = ${similarity.toFixed(4)}`);
        }
      }

      // All pairs should have similarity > threshold
      for (const similarity of similarities) {
        expect(similarity).toBeGreaterThan(SIMILARITY_THRESHOLD);
      }
    }
  }, 120000);

  /**
   * Test 4: Semantic Dissimilarity (Different Categories)
   * Images from different locations should have lower cosine similarity
   */
  it('should produce different embeddings for unrelated images', async () => {
    // Get one kitchen image and one factory image
    const kitchenImage = getSingleTestImage('kitchen', 0);
    const factoryImage = getSingleTestImage('factory', 0);

    // Embed both
    const result = await runpodService.embed([kitchenImage, factoryImage]);

    expect(result.success).toBe(true);

    if (result.success) {
      const embeddings = result.data.embeddings;
      expect(embeddings).toHaveLength(2);

      // Calculate similarity between kitchen and factory
      const similarity = cosineSimilarity(embeddings[0], embeddings[1]);
      console.log(`Kitchen vs Factory: cosine similarity = ${similarity.toFixed(4)}`);

      // Should be less similar than same-category images
      // Note: Using < 0.9 as threshold since they're both fire damage images
      expect(similarity).toBeLessThan(0.9);
    }
  }, 120000);

  /**
   * Test 5: Vectorize Upsert Format Validation
   * Verify embeddings can be formatted for Cloudflare Vectorize
   */
  it('should produce embeddings compatible with Cloudflare Vectorize', async () => {
    // Get one test image
    const imageDataUri = getSingleTestImage('bar', 0);

    // Embed the image
    const result = await runpodService.embed([imageDataUri]);

    expect(result.success).toBe(true);

    if (result.success) {
      const embedding = result.data.embeddings[0];

      // Create Vectorize upsert payload
      const payload = createVectorizePayload(
        'test-bar-1',
        embedding,
        getTestImageMetadata('bar', 0)
      );

      // Validate payload format
      expect(validateVectorizePayload(payload)).toBe(true);

      // Verify payload structure
      expect(payload.id).toBe('test-bar-1');
      expect(payload.values).toHaveLength(EXPECTED_DIMENSION);
      expect(payload.metadata).toBeDefined();
      expect(payload.metadata?.category).toBe('bar');
      expect(payload.metadata?.test).toBe(true);

      console.log('Vectorize payload validated successfully');
      console.log(`  id: ${payload.id}`);
      console.log(`  values: [${embedding.slice(0, 3).map((v) => v.toFixed(4)).join(', ')}, ...]`);
      console.log(`  dimension: ${payload.values.length}`);
      console.log(`  metadata: ${JSON.stringify(payload.metadata)}`);
    }
  }, 120000);
});
