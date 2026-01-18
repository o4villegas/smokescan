/**
 * Test Helpers
 * Utilities for loading test images and setting up tests
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Sample image structure (flat files, not folders):
 * sample_images/
 * ├── Bar and dining area1.jpg, Bar and dining area2.jpg, Bar and dining area3.jpg (3)
 * ├── Bar area1.jpg, Bar area2.jpg, Bar area3.jpg (3)
 * ├── Kitchen 1.jpg through Kitchen 6.jpg (6)
 * └── factory_area.jpg (1)
 */

const SAMPLE_IMAGES_DIR = path.resolve(__dirname, '../../../../sample_images');

/**
 * Test image categories mapped to filename patterns
 */
export const TEST_PATTERNS = {
  'bar-dining': /^Bar and dining area\d+\.jpg$/i,
  'bar': /^Bar area\d+\.jpg$/i,
  'kitchen': /^Kitchen \d+\.jpg$/i,
  'factory': /^factory_area\.jpg$/i,
} as const;

export type TestCategory = keyof typeof TEST_PATTERNS;

/**
 * Read an image file and convert to base64 data URI
 */
export function imageToDataUri(imagePath: string): string {
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');

  // Determine content type from extension
  const ext = path.extname(imagePath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

  return `data:${contentType};base64,${base64}`;
}

/**
 * Get all image files from a test category (based on filename pattern)
 */
export function getTestImages(category: TestCategory): string[] {
  if (!fs.existsSync(SAMPLE_IMAGES_DIR)) {
    throw new Error(`Sample images directory not found: ${SAMPLE_IMAGES_DIR}`);
  }

  const pattern = TEST_PATTERNS[category];
  const files = fs.readdirSync(SAMPLE_IMAGES_DIR);
  const imageFiles = files.filter((f) => pattern.test(f));

  if (imageFiles.length === 0) {
    throw new Error(`No images found for category: ${category}`);
  }

  // Sort to ensure consistent ordering
  imageFiles.sort();

  return imageFiles.map((f) => path.join(SAMPLE_IMAGES_DIR, f));
}

/**
 * Get test images as base64 data URIs
 */
export function getTestImagesAsDataUri(category: TestCategory): string[] {
  const imagePaths = getTestImages(category);
  return imagePaths.map(imageToDataUri);
}

/**
 * Get a single test image as base64 data URI
 */
export function getSingleTestImage(category: TestCategory, index = 0): string {
  const imagePaths = getTestImages(category);
  if (index >= imagePaths.length) {
    throw new Error(`Image index ${index} out of range for category ${category}`);
  }
  return imageToDataUri(imagePaths[index]);
}

/**
 * Get test image metadata for Vectorize
 */
export function getTestImageMetadata(
  category: TestCategory,
  index: number
): Record<string, string | number | boolean> {
  return {
    category,
    index,
    source: 'sample_images',
    test: true,
  };
}

/**
 * RunPod configuration from environment variables
 */
export function getRunPodConfig(): {
  apiKey: string;
  analysisEndpointId: string;
} {
  const apiKey = process.env.RUNPOD_API_KEY;
  const analysisEndpointId = process.env.RUNPOD_ANALYSIS_ENDPOINT_ID;

  if (!apiKey || !analysisEndpointId) {
    throw new Error(
      'Missing required environment variables: RUNPOD_API_KEY, RUNPOD_ANALYSIS_ENDPOINT_ID'
    );
  }

  return { apiKey, analysisEndpointId };
}
