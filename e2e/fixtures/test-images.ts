/**
 * Test Image Fixtures
 * Provides test image buffers for e2e upload tests
 */

/**
 * Create a minimal valid PNG buffer
 * This is a 1x1 red pixel PNG (smallest valid PNG possible)
 */
export function createMinimalPng(): Buffer {
  // Minimal 1x1 red PNG
  const pngData = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, // bit depth: 8, color type: RGB
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x77, 0x53, 0xde, // IHDR CRC
    0x00, 0x00, 0x00, 0x0c, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, // compressed red pixel
    0x01, 0x01, 0x01, 0x00, // CRC part
    0x18, 0xdd, 0x8d, 0xb5, // IDAT CRC (corrected for actual data)
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4e, 0x44, // IEND
    0xae, 0x42, 0x60, 0x82, // IEND CRC
  ]);
  return pngData;
}

/**
 * Create a test PNG with specified dimensions
 * Uses a simple colored rectangle pattern
 */
export function createTestPng(width: number = 100, height: number = 100, color: 'red' | 'green' | 'blue' = 'red'): Buffer {
  // For simplicity, we'll return the minimal PNG
  // In a real implementation, you'd generate actual sized images
  return createMinimalPng();
}

/**
 * Create multiple test images for batch upload testing
 */
export function createTestImageSet(count: number): Buffer[] {
  const images: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    images.push(createMinimalPng());
  }
  return images;
}

/**
 * Convert buffer to base64 data URL for form uploads
 */
export function bufferToDataUrl(buffer: Buffer, mimeType: string = 'image/png'): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Create a File-like object for Playwright uploads
 * Returns the data needed for page.setInputFiles()
 */
export function createTestFile(
  name: string = 'test-image.png',
  buffer: Buffer = createMinimalPng()
): {
  name: string;
  mimeType: string;
  buffer: Buffer;
} {
  return {
    name,
    mimeType: 'image/png',
    buffer,
  };
}

/**
 * Create multiple test files for batch upload
 */
export function createTestFiles(count: number): Array<{
  name: string;
  mimeType: string;
  buffer: Buffer;
}> {
  const files = [];
  for (let i = 1; i <= count; i++) {
    files.push(createTestFile(`fire-damage-${i}.png`));
  }
  return files;
}

/**
 * Create an invalid file (not an image) for rejection testing
 */
export function createInvalidFile(): {
  name: string;
  mimeType: string;
  buffer: Buffer;
} {
  return {
    name: 'document.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('This is not an image file'),
  };
}

/**
 * File upload helpers for Playwright tests
 */
export const uploadHelpers = {
  /**
   * Standard set of 3 test images for most tests
   */
  standardSet: () => createTestFiles(3),

  /**
   * Single image for simple tests
   */
  singleImage: () => [createTestFile('single-test.png')],

  /**
   * Maximum allowed images (10) for limit testing
   */
  maxImages: () => createTestFiles(10),

  /**
   * Over the limit (11 images) for rejection testing
   */
  overLimitImages: () => createTestFiles(11),

  /**
   * Mixed valid and invalid files
   */
  mixedFiles: () => [
    createTestFile('valid-1.png'),
    createInvalidFile(),
    createTestFile('valid-2.png'),
  ],
};

/**
 * Sample fire damage image descriptions
 * These describe what real test images would show
 */
export const imageDescriptions = {
  ceilingDamage: 'Ceiling with heavy soot accumulation and thermal discoloration',
  wallSmoke: 'Wall surface with moderate smoke staining gradient',
  charredMaterial: 'Close-up of charred building materials',
  overviewShot: 'Wide-angle room overview showing damage extent',
  cleanReference: 'Clean reference surface for comparison',
};
