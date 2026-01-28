/**
 * Image Compression Utility
 * Client-side image compression using Canvas API
 * Targets ~300KB per image (down from ~3MB typical)
 */

export type CompressionResult = {
  blob: Blob;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
};

export type CompressionOptions = {
  maxDimension?: number; // Max width or height in pixels (default: 2048)
  quality?: number; // JPEG quality 0-1 (default: 0.85)
  mimeType?: 'image/jpeg' | 'image/webp'; // Output format (default: 'image/jpeg')
};

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxDimension: 2048,
  quality: 0.85,
  mimeType: 'image/jpeg',
};

/**
 * Load an image from a File object
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const aspectRatio = width / height;

  if (width > height) {
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxDimension * aspectRatio),
      height: maxDimension,
    };
  }
}

/**
 * Convert blob to data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Compress a single image file
 * Returns compressed blob, data URL, and size metrics
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // Load the image
  const img = await loadImage(file);

  // Calculate new dimensions
  const newDimensions = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxDimension
  );

  // Create canvas and draw resized image
  const canvas = document.createElement('canvas');
  canvas.width = newDimensions.width;
  canvas.height = newDimensions.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the image
  ctx.drawImage(img, 0, 0, newDimensions.width, newDimensions.height);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b);
        } else {
          reject(new Error('Failed to compress image'));
        }
      },
      opts.mimeType,
      opts.quality
    );
  });

  // Convert to data URL
  const dataUrl = await blobToDataUrl(blob);

  return {
    blob,
    dataUrl,
    originalSize,
    compressedSize: blob.size,
    compressionRatio: originalSize / blob.size,
    width: newDimensions.width,
    height: newDimensions.height,
  };
}

/**
 * Compress multiple images in parallel
 * Returns array of results in same order as input
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {}
): Promise<CompressionResult[]> {
  return Promise.all(files.map((file) => compressImage(file, options)));
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Get compression summary for logging/display
 */
export function getCompressionSummary(results: CompressionResult[]): {
  totalOriginal: number;
  totalCompressed: number;
  overallRatio: number;
  formattedOriginal: string;
  formattedCompressed: string;
  savings: string;
} {
  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0);
  const overallRatio = totalOriginal / totalCompressed;
  const savings = totalOriginal - totalCompressed;

  return {
    totalOriginal,
    totalCompressed,
    overallRatio,
    formattedOriginal: formatBytes(totalOriginal),
    formattedCompressed: formatBytes(totalCompressed),
    savings: formatBytes(savings),
  };
}
