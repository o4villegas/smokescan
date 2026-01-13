/**
 * RunPod Service
 * Handles communication with the Qwen3-VL agent endpoint
 *
 * Architecture: Single-call pattern where the agent handles RAG internally via tool calling.
 * The agent uses the rag_search tool to query Cloudflare AI Search REST API for FDAM methodology.
 */

import type { Result, ApiError, ApiErrorCode, AssessmentMetadata } from '../types';

type RunPodConfig = {
  apiKey: string;
  endpointId: string;
};

type RunPodResponse = {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  output?: unknown;
  error?: string;
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
  private baseUrl: string;

  constructor(config: RunPodConfig) {
    this.config = config;
    this.baseUrl = `https://api.runpod.ai/v2/${config.endpointId}`;
  }

  /**
   * Generate FDAM assessment report from images.
   *
   * Uses single-call architecture where the Qwen3-VL agent:
   * 1. Analyzes images for fire damage
   * 2. Calls RAG tool to retrieve FDAM methodology
   * 3. Generates grounded assessment report
   *
   * RAG is handled internally by the agent via tool calling.
   */
  async assess(
    images: string[],
    metadata: AssessmentMetadata
  ): Promise<Result<string, ApiError>> {
    const userPrompt = `Analyze these ${images.length} images of a ${metadata.roomType} in a ${metadata.structureType} structure.
${metadata.fireOrigin ? `Fire origin information: ${metadata.fireOrigin}` : ''}
${metadata.notes ? `Additional notes: ${metadata.notes}` : ''}

Generate a comprehensive FDAM assessment report. Use the rag_search tool to retrieve relevant methodology for your recommendations.`;

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
        max_tokens: 8000,
      },
    };

    const result = await this.callEndpoint(requestBody);
    if (!result.success) {
      return result;
    }

    const responseData = result.data as { output?: string; error?: string };

    if (responseData.error) {
      return {
        success: false,
        error: { code: 500, message: 'Agent error', details: responseData.error },
      };
    }

    const rawContent = responseData.output;
    if (!rawContent) {
      return {
        success: false,
        error: { code: 500, message: 'No content in agent response' },
      };
    }

    // Strip <think> blocks before returning to user
    const reportContent = stripThinkBlocks(rawContent);

    return { success: true, data: reportContent };
  }

  /**
   * Chat completion for follow-up questions.
   *
   * Uses the same agent architecture - the agent can call RAG tools
   * to retrieve additional methodology context as needed.
   */
  async chat(
    conversationHistory: Array<{ role: string; content: string }>,
    sessionContext: string
  ): Promise<Result<string, ApiError>> {
    const requestBody = {
      input: {
        messages: conversationHistory,
        session_context: sessionContext,
        max_tokens: 4000,
      },
    };

    const result = await this.callEndpoint(requestBody);
    if (!result.success) {
      return result;
    }

    const responseData = result.data as { output?: string; error?: string };

    if (responseData.error) {
      return {
        success: false,
        error: { code: 500, message: 'Agent error', details: responseData.error },
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
   * Internal method to call RunPod endpoint with polling
   */
  private async callEndpoint(
    requestBody: unknown
  ): Promise<Result<unknown, ApiError>> {
    try {
      // Submit job
      const submitResponse = await fetch(`${this.baseUrl}/run`, {
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

      // If completed immediately (unlikely for large models)
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

      // Poll for completion - agent may take longer due to tool calls
      const jobId = submitResult.id;
      const maxAttempts = 120; // 10 minutes with 5s intervals (agent may make multiple tool calls)
      const pollInterval = 5000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        const statusResponse = await fetch(`${this.baseUrl}/status/${jobId}`, {
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
