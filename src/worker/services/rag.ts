/**
 * RAG Service
 * Handles Cloudflare AI Search for FDAM methodology retrieval
 */

import type { Result, ApiError, RAGChunk } from '../types';

type RAGConfig = {
  ai: Ai;
};

export class RAGService {
  private ai: Ai;

  constructor(config: RAGConfig) {
    this.ai = config.ai;
  }

  /**
   * Retrieve relevant FDAM methodology chunks based on keywords
   */
  async retrieve(
    keywords: string[],
    maxChunks: number = 5
  ): Promise<Result<RAGChunk[], ApiError>> {
    try {
      // Construct search query from keywords
      const query = keywords.join(' ');

      // Use Cloudflare AI Search (AutoRAG)
      const response = await this.ai.autorag('smokescan-rag').search({
        query,
        max_num_results: maxChunks,
        rewrite_query: true,
      });

      if (!response.data || response.data.length === 0) {
        // Return empty array if no results (not an error)
        return { success: true, data: [] };
      }

      const chunks: RAGChunk[] = response.data.map((result) => ({
        // Extract text content from the content array
        content: result.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('\n'),
        source: result.filename || 'unknown',
        relevanceScore: result.score || 0,
      }));

      return { success: true, data: chunks };
    } catch (e) {
      // If AI Search is not configured or fails, return empty results
      // This allows the system to work without RAG during development
      console.error('RAG retrieval error:', e);
      return {
        success: true,
        data: [],
      };
    }
  }

  /**
   * Format RAG chunks into context string for LLM
   */
  formatContext(chunks: RAGChunk[]): string {
    if (chunks.length === 0) {
      return 'No specific FDAM methodology context available. Use general fire damage assessment best practices.';
    }

    return chunks
      .map(
        (chunk, i) =>
          `[Source ${i + 1}: ${chunk.source}]\n${chunk.content}`
      )
      .join('\n\n---\n\n');
  }
}
