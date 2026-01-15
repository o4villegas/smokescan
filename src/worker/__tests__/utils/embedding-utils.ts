/**
 * Embedding Test Utilities
 * Cosine similarity calculation and Vectorize format validation
 */

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1, where 1 means identical direction
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Cloudflare Vectorize upsert payload format
 */
export type VectorizePayload = {
  id: string;
  values: number[];
  metadata?: Record<string, string | number | boolean>;
};

/**
 * Validate that a payload matches Cloudflare Vectorize upsert format
 * Format: { id: string, values: number[], metadata?: object }
 */
export function validateVectorizePayload(payload: unknown): payload is VectorizePayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const p = payload as Record<string, unknown>;

  // id must be a non-empty string
  if (typeof p.id !== 'string' || p.id.length === 0) {
    return false;
  }

  // values must be a non-empty array of numbers
  if (!Array.isArray(p.values) || p.values.length === 0) {
    return false;
  }

  if (!p.values.every((v) => typeof v === 'number' && !isNaN(v))) {
    return false;
  }

  // metadata is optional but must be an object if present
  if (p.metadata !== undefined) {
    if (typeof p.metadata !== 'object' || p.metadata === null || Array.isArray(p.metadata)) {
      return false;
    }
  }

  return true;
}

/**
 * Create a Vectorize-compatible payload from an embedding
 */
export function createVectorizePayload(
  id: string,
  embedding: number[],
  metadata?: Record<string, string | number | boolean>
): VectorizePayload {
  return {
    id,
    values: embedding,
    ...(metadata && { metadata }),
  };
}
