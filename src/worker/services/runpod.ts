/**
 * RunPod Service
 * Handles communication with RunPod endpoints using "Retrieve First, Reason Last" architecture
 *
 * Split Endpoints:
 * - Retrieval: Embedding + Reranking (~32GB VRAM)
 * - Analysis: Vision reasoning with Qwen3-VL-30B (~40GB VRAM)
 */

import type {
  Result,
  ApiError,
  ApiErrorCode,
  AssessmentMetadata,
  RetrievalOutput,
} from '../types';

type RunPodConfig = {
  apiKey: string;
  retrievalEndpointId: string;
  analysisEndpointId: string;
};

type RunPodResponse = {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  output?: unknown;
  error?: string;
};

export type EmbedResult = {
  embeddings: number[][];
  dimension: number;
};

/**
 * Strip <think>...</think> blocks from Qwen3-VL-Thinking model output.
 * The model outputs reasoning in these blocks, but they should not be shown to users.
 */
function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export class RunPodService {
  private config: RunPodConfig;

  constructor(config: RunPodConfig) {
    this.config = config;
  }

  /**
   * Generate FDAM assessment report from images.
   *
   * Flow (Retrieve First, Reason Last):
   * 1. Build FDAM-specific queries based on metadata
   * 2. Call Retrieval endpoint to get methodology context
   * 3. Format RAG context from retrieval results
   * 4. Call Analysis endpoint with images + pre-fetched context
   */
  async assess(
    images: string[],
    metadata: AssessmentMetadata
  ): Promise<Result<string, ApiError>> {
    // Step 1: Build FDAM-specific queries based on metadata
    const queries = this.buildFDAMQueries(metadata);

    // Step 2: Call Retrieval endpoint
    console.log(`[Split] Calling Retrieval endpoint with ${queries.length} queries`);
    const ragResult = await this.callRetrievalEndpoint(queries, 5);

    // Step 3: Format RAG context (graceful degradation if retrieval fails)
    let ragContext: string;
    if (ragResult.success) {
      ragContext = this.formatRagContext(ragResult.data);
      console.log(`[Split] Retrieved ${ragResult.data.results.length} query results`);
    } else {
      console.warn(`[Split] Retrieval failed: ${ragResult.error.message}`);
      ragContext =
        'FDAM methodology context unavailable. Use general fire damage assessment principles based on your training.';
    }

    // Step 4: Call Analysis endpoint with images + context
    console.log(`[Split] Calling Analysis endpoint with ${images.length} images`);
    return this.callAnalysisEndpoint(images, metadata, ragContext);
  }

  /**
   * Chat completion for follow-up questions.
   *
   * Flow (Retrieve First, Reason Last):
   * 1. Extract queries from user message
   * 2. Call Retrieval endpoint for additional context
   * 3. Call Analysis endpoint with conversation + context
   */
  async chat(
    conversationHistory: Array<{ role: string; content: string }>,
    sessionContext: string
  ): Promise<Result<string, ApiError>> {
    // Extract potential queries from the last user message
    const lastUserMessage = conversationHistory.filter((m) => m.role === 'user').pop();
    const queries = lastUserMessage
      ? [
          `FDAM methodology for: ${lastUserMessage.content.slice(0, 200)}`,
          'Fire damage assessment disposition guidelines',
        ]
      : ['FDAM methodology general guidelines'];

    // Get RAG context
    const ragResult = await this.callRetrievalEndpoint(queries, 3);
    const ragContext = ragResult.success
      ? this.formatRagContext(ragResult.data)
      : 'FDAM methodology context unavailable.';

    // Call Analysis endpoint
    return this.callAnalysisEndpointChat(conversationHistory, sessionContext, ragContext);
  }

  /**
   * Generate embeddings for images using Qwen3-VL-Embedding-8B.
   *
   * Calls the Retrieval endpoint with action: "embed"
   * Returns 4096-dimensional vectors for each image.
   *
   * @param imageUrls - Array of image URLs or base64 data URIs
   * @param instruction - Optional task instruction for the embedder
   * @returns Embeddings and dimension info
   */
  async embed(
    imageUrls: string[],
    instruction?: string
  ): Promise<Result<EmbedResult, ApiError>> {
    const endpointUrl = `https://api.runpod.ai/v2/${this.config.retrievalEndpointId}`;

    const requestBody = {
      input: {
        action: 'embed',
        images: imageUrls,
        ...(instruction && { instruction }),
      },
    };

    console.log(`[embed] Calling Retrieval endpoint with ${imageUrls.length} images`);

    const result = await this.callEndpoint(endpointUrl, requestBody);
    if (!result.success) {
      return result;
    }

    const responseData = result.data as {
      output?: { embeddings: number[][]; dimension: number };
      error?: string;
      traceback?: string;
    };

    if (responseData.error) {
      return {
        success: false,
        error: {
          code: 500,
          message: 'Embedding error',
          details: responseData.traceback || responseData.error,
        },
      };
    }

    if (!responseData.output?.embeddings) {
      return {
        success: false,
        error: { code: 500, message: 'No embeddings in response' },
      };
    }

    console.log(
      `[embed] Generated ${responseData.output.embeddings.length} embeddings of dimension ${responseData.output.dimension}`
    );

    return {
      success: true,
      data: {
        embeddings: responseData.output.embeddings,
        dimension: responseData.output.dimension,
      },
    };
  }

  /**
   * Build FDAM-specific queries based on assessment metadata
   */
  private buildFDAMQueries(metadata: AssessmentMetadata): string[] {
    return [
      `Zone classification criteria for ${metadata.structureType} fire damage assessment`,
      `Threshold values for particulate contamination clearance in ${metadata.roomType}`,
      `Cleaning protocols for ${metadata.roomType} surfaces after fire damage`,
      'FDAM disposition guidelines for fire-damaged materials',
      'Surface sampling requirements per FDAM methodology',
    ];
  }

  /**
   * Format RAG retrieval results into context string for Analysis endpoint
   */
  private formatRagContext(output: RetrievalOutput): string {
    const sections: string[] = [];

    for (const result of output.results) {
      if (typeof result.chunks === 'string') {
        // Already formatted string from handler
        sections.push(result.chunks);
      } else if (Array.isArray(result.chunks)) {
        // Structured chunks - format them
        for (const chunk of result.chunks) {
          const source = chunk.doc_type === 'primary' ? '[FDAM]' : '[Reference]';
          sections.push(`${source} ${chunk.source}:\n${chunk.text}`);
        }
      }
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Call the Retrieval endpoint to get FDAM methodology context
   */
  private async callRetrievalEndpoint(
    queries: string[],
    topK: number
  ): Promise<Result<RetrievalOutput, ApiError>> {
    const endpointUrl = `https://api.runpod.ai/v2/${this.config.retrievalEndpointId}`;

    const requestBody = {
      input: {
        queries,
        top_k: topK,
      },
    };

    const result = await this.callEndpoint(endpointUrl, requestBody);
    if (!result.success) {
      return result;
    }

    const responseData = result.data as { output?: RetrievalOutput; error?: string };

    if (responseData.error) {
      return {
        success: false,
        error: { code: 500, message: 'Retrieval error', details: responseData.error },
      };
    }

    if (!responseData.output) {
      return {
        success: false,
        error: { code: 500, message: 'No output from Retrieval endpoint' },
      };
    }

    return { success: true, data: responseData.output };
  }

  /**
   * Call the Analysis endpoint with images and pre-fetched RAG context
   */
  private async callAnalysisEndpoint(
    images: string[],
    metadata: AssessmentMetadata,
    ragContext: string
  ): Promise<Result<string, ApiError>> {
    const endpointUrl = `https://api.runpod.ai/v2/${this.config.analysisEndpointId}`;

    const userPrompt = `Analyze these ${images.length} images of a ${metadata.roomType} in a ${metadata.structureType} structure.
${metadata.fireOrigin ? `Fire origin information: ${metadata.fireOrigin}` : ''}
${metadata.notes ? `Additional notes: ${metadata.notes}` : ''}

Generate a comprehensive FDAM assessment report based on the methodology context provided.`;

    // Build message content with images
    const content: Array<{ type: string; text?: string; image?: string }> = [
      { type: 'text', text: userPrompt },
    ];

    for (const image of images) {
      const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      content.push({
        type: 'image',
        image: imageUrl,
      });
    }

    const requestBody = {
      input: {
        messages: [{ role: 'user', content }],
        rag_context: ragContext,
        max_tokens: 8000,
      },
    };

    const result = await this.callEndpoint(endpointUrl, requestBody);
    if (!result.success) {
      return result;
    }

    const responseData = result.data as { output?: string; error?: string };

    if (responseData.error) {
      return {
        success: false,
        error: { code: 500, message: 'Analysis error', details: responseData.error },
      };
    }

    const rawContent = responseData.output;
    if (!rawContent) {
      return {
        success: false,
        error: { code: 500, message: 'No content in Analysis response' },
      };
    }

    // Strip <think> blocks before returning to user
    const reportContent = stripThinkBlocks(rawContent);

    return { success: true, data: reportContent };
  }

  /**
   * Call the Analysis endpoint for chat with pre-fetched RAG context
   */
  private async callAnalysisEndpointChat(
    conversationHistory: Array<{ role: string; content: string }>,
    sessionContext: string,
    ragContext: string
  ): Promise<Result<string, ApiError>> {
    const endpointUrl = `https://api.runpod.ai/v2/${this.config.analysisEndpointId}`;

    const requestBody = {
      input: {
        messages: conversationHistory,
        session_context: sessionContext,
        rag_context: ragContext,
        max_tokens: 4000,
      },
    };

    const result = await this.callEndpoint(endpointUrl, requestBody);
    if (!result.success) {
      return result;
    }

    const responseData = result.data as { output?: string; error?: string };

    if (responseData.error) {
      return {
        success: false,
        error: { code: 500, message: 'Chat error', details: responseData.error },
      };
    }

    const rawResponse = responseData.output;
    if (!rawResponse) {
      return {
        success: false,
        error: { code: 500, message: 'No content in chat response' },
      };
    }

    // Strip <think> blocks before returning to user
    const response = stripThinkBlocks(rawResponse);

    return { success: true, data: response };
  }

  /**
   * Internal method to call a RunPod endpoint with polling
   */
  private async callEndpoint(
    endpointUrl: string,
    requestBody: unknown
  ): Promise<Result<unknown, ApiError>> {
    try {
      // Submit job
      const submitResponse = await fetch(`${endpointUrl}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        return {
          success: false,
          error: {
            code: submitResponse.status as ApiErrorCode,
            message: 'RunPod request failed',
            details: errorText,
          },
        };
      }

      const submitResult = (await submitResponse.json()) as RunPodResponse;

      // If completed immediately
      if (submitResult.status === 'COMPLETED') {
        return { success: true, data: submitResult.output };
      }

      if (submitResult.status === 'FAILED') {
        return {
          success: false,
          error: {
            code: 500,
            message: 'RunPod job failed',
            details: submitResult.error,
          },
        };
      }

      // Poll for completion
      const jobId = submitResult.id;
      const maxAttempts = 120; // 10 minutes with 5s intervals
      const pollInterval = 5000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        const statusResponse = await fetch(`${endpointUrl}/status/${jobId}`, {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        });

        if (!statusResponse.ok) {
          continue; // Retry on transient errors
        }

        const statusResult = (await statusResponse.json()) as RunPodResponse;

        if (statusResult.status === 'COMPLETED') {
          return { success: true, data: statusResult.output };
        }

        if (statusResult.status === 'FAILED') {
          return {
            success: false,
            error: {
              code: 500,
              message: 'RunPod job failed',
              details: statusResult.error,
            },
          };
        }
      }

      return {
        success: false,
        error: { code: 504, message: 'RunPod job timed out' },
      };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 500,
          message: 'RunPod request error',
          details: String(e),
        },
      };
    }
  }
}
