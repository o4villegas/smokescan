/**
 * RAG Integration Test
 * Tests the Cloudflare AI Search → RunPod Analysis simplified flow
 *
 * Note: These tests verify the RAGService logic. Full integration
 * with Cloudflare AI Search requires the AI binding (available in
 * wrangler dev or production). Unit tests mock the AI binding.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RAGService } from '../services/rag';
import type { RAGChunk } from '../types';

// Mock Cloudflare AI binding
const mockSearch = vi.fn();
const mockAi = {
  autorag: vi.fn(() => ({
    search: mockSearch,
  })),
} as unknown as Ai;

describe('RAGService', () => {
  let ragService: RAGService;

  beforeEach(() => {
    vi.clearAllMocks();
    ragService = new RAGService({ ai: mockAi });
  });

  describe('retrieve()', () => {
    it('should retrieve FDAM methodology chunks successfully', async () => {
      // Mock successful response from Cloudflare AI Search
      mockSearch.mockResolvedValueOnce({
        data: [
          {
            filename: 'FDAM_v4_METHODOLOGY.md',
            score: 0.95,
            content: [
              { type: 'text', text: 'Zone classification criteria...' },
            ],
          },
          {
            filename: 'FDAM_v4_METHODOLOGY.md',
            score: 0.88,
            content: [
              { type: 'text', text: 'Threshold values for particulates...' },
            ],
          },
        ],
      });

      const result = await ragService.retrieve(
        ['Zone classification', 'fire damage assessment'],
        5
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].source).toBe('FDAM_v4_METHODOLOGY.md');
        expect(result.data[0].relevanceScore).toBe(0.95);
        expect(result.data[0].content).toContain('Zone classification');
      }

      // Verify AI Search was called with correct parameters
      expect(mockAi.autorag).toHaveBeenCalledWith('smokescan-rag');
      expect(mockSearch).toHaveBeenCalledWith({
        query: 'Zone classification fire damage assessment',
        max_num_results: 5,
        rewrite_query: true,
      });
    });

    it('should return empty array when no results found', async () => {
      mockSearch.mockResolvedValueOnce({ data: [] });

      const result = await ragService.retrieve(['nonexistent query'], 3);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should handle AI Search errors gracefully', async () => {
      mockSearch.mockRejectedValueOnce(new Error('AI Search unavailable'));

      const result = await ragService.retrieve(['test query'], 3);

      // Should return success with empty data (graceful degradation)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should handle multiple content blocks per result', async () => {
      mockSearch.mockResolvedValueOnce({
        data: [
          {
            filename: 'test.md',
            score: 0.9,
            content: [
              { type: 'text', text: 'First paragraph.' },
              { type: 'text', text: 'Second paragraph.' },
            ],
          },
        ],
      });

      const result = await ragService.retrieve(['test'], 3);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].content).toBe('First paragraph.\nSecond paragraph.');
      }
    });
  });

  describe('formatContext()', () => {
    it('should format chunks into context string for LLM', () => {
      const chunks: RAGChunk[] = [
        {
          content: 'Zone 1: Burn zone - direct fire damage',
          source: 'FDAM_v4_METHODOLOGY.md',
          relevanceScore: 0.95,
        },
        {
          content: 'Threshold: 150 particles for ash/char',
          source: 'FDAM_v4_METHODOLOGY.md',
          relevanceScore: 0.88,
        },
      ];

      const context = ragService.formatContext(chunks);

      // Verify format matches expected pattern
      expect(context).toContain('[Source 1: FDAM_v4_METHODOLOGY.md]');
      expect(context).toContain('[Source 2: FDAM_v4_METHODOLOGY.md]');
      expect(context).toContain('Zone 1: Burn zone');
      expect(context).toContain('Threshold: 150 particles');
      expect(context).toContain('---'); // Separator between chunks
    });

    it('should return default message when no chunks provided', () => {
      const context = ragService.formatContext([]);

      expect(context).toContain('No specific FDAM methodology context available');
      expect(context).toContain('general fire damage assessment');
    });

    it('should handle single chunk without separator', () => {
      const chunks: RAGChunk[] = [
        {
          content: 'Single chunk content',
          source: 'test.md',
          relevanceScore: 0.9,
        },
      ];

      const context = ragService.formatContext(chunks);

      expect(context).toContain('[Source 1: test.md]');
      expect(context).toContain('Single chunk content');
      // Single chunk should not have separator
      expect(context.split('---').length).toBe(1);
    });
  });
});

describe('RAG Integration Flow', () => {
  it('should produce context compatible with Analysis endpoint format', async () => {
    const mockAiLocal = {
      autorag: vi.fn(() => ({
        search: vi.fn().mockResolvedValueOnce({
          data: [
            {
              filename: 'FDAM_v4_METHODOLOGY.md',
              score: 0.92,
              content: [
                { type: 'text', text: 'FDAM methodology for zone classification...' },
              ],
            },
          ],
        }),
      })),
    } as unknown as Ai;

    const ragService = new RAGService({ ai: mockAiLocal });

    // Simulate the flow from assess.ts
    const ragResult = await ragService.retrieve([
      'Zone classification criteria for single-family fire damage',
      'Threshold values for particulate contamination in residential-kitchen',
    ], 6);

    const ragContext = ragResult.success && ragResult.data.length > 0
      ? ragService.formatContext(ragResult.data)
      : 'FDAM methodology context unavailable.';

    // Verify the context is a non-empty string suitable for LLM injection
    expect(typeof ragContext).toBe('string');
    expect(ragContext.length).toBeGreaterThan(0);
    expect(ragContext).toContain('[Source');
    expect(ragContext).toContain('FDAM');
  });
});
