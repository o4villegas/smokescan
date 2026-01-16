/**
 * RunPod Service
 * Handles communication with RunPod Qwen-Agent endpoint for vision reasoning
 *
 * Qwen-Agent handles RAG internally via the fdam_rag tool
 * The VL model decides when and what to query from FDAM methodology
 */

import type {
  Result,
  ApiError,
  ApiErrorCode,
  AssessmentMetadata,
} from '../types';

type RunPodConfig = {
  apiKey: string;
  analysisEndpointId: string;
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

  constructor(config: RunPodConfig) {
    this.config = config;
  }

  /**
   * Generate FDAM assessment report from images.
   * Qwen-Agent handles RAG internally via fdam_rag tool
   *
   * @param images - Array of base64 encoded images
   * @param metadata - Room and structure metadata
   */
  async assess(
    images: string[],
    metadata: AssessmentMetadata
  ): Promise<Result<string, ApiError>> {
    console.log(`[RunPod] Calling Qwen-Agent endpoint with ${images.length} images`);
    return this.callAnalysisEndpoint(images, metadata);
  }

  /**
   * Chat completion for follow-up questions.
   * Qwen-Agent handles RAG internally via fdam_rag tool
   *
   * @param conversationHistory - Previous messages in the conversation
   * @param sessionContext - Summary of the assessment session
   * @param images - All images (original + new) as base64 data URIs
   */
  async chat(
    conversationHistory: Array<{ role: string; content: string }>,
    sessionContext: string,
    images: string[] = []
  ): Promise<Result<string, ApiError>> {
    console.log(`[RunPod] Calling Qwen-Agent endpoint for chat with ${images.length} images`);
    return this.callAnalysisEndpointChat(conversationHistory, sessionContext, images);
  }

  /**
   * Call the Qwen-Agent endpoint with images
   * RAG context is retrieved dynamically via fdam_rag tool
   */
  private async callAnalysisEndpoint(
    images: string[],
    metadata: AssessmentMetadata
  ): Promise<Result<string, ApiError>> {
    const endpointUrl = `https://api.runpod.ai/v2/${this.config.analysisEndpointId}`;

    const userPrompt = `Analyze these ${images.length} images of a ${metadata.roomType} in a ${metadata.structureType} structure.
${metadata.fireOrigin ? `Fire origin information: ${metadata.fireOrigin}` : ''}
${metadata.notes ? `Additional notes: ${metadata.notes}` : ''}

Generate a comprehensive FDAM assessment report. Use the fdam_rag tool to retrieve relevant FDAM methodology based on what you observe in the images.`;

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

    // No rag_context - Qwen-Agent calls fdam_rag tool as needed
    const requestBody = {
      input: {
        messages: [{ role: 'user', content }],
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
   * Call the Qwen-Agent endpoint for chat
   * RAG context is retrieved dynamically via fdam_rag tool
   */
  private async callAnalysisEndpointChat(
    conversationHistory: Array<{ role: string; content: string }>,
    sessionContext: string,
    images: string[] = []
  ): Promise<Result<string, ApiError>> {
    const endpointUrl = `https://api.runpod.ai/v2/${this.config.analysisEndpointId}`;

    // Build messages with images included in the latest user message
    // Images are included so the model can reference them when answering
    let messagesWithImages = conversationHistory;

    if (images.length > 0) {
      // Find the last user message and add images to it
      const lastUserIndex = conversationHistory.findIndex(
        (msg, idx) => msg.role === 'user' && idx === conversationHistory.length - 1
      );

      if (lastUserIndex !== -1) {
        const lastUserMsg = conversationHistory[lastUserIndex];
        const content: Array<{ type: string; text?: string; image?: string }> = [
          { type: 'text', text: lastUserMsg.content },
        ];

        for (const image of images) {
          content.push({ type: 'image', image });
        }

        messagesWithImages = [
          ...conversationHistory.slice(0, lastUserIndex),
          { role: 'user', content: content as unknown as string },
          ...conversationHistory.slice(lastUserIndex + 1),
        ];
      }
    }

    // No rag_context - Qwen-Agent calls fdam_rag tool as needed
    const requestBody = {
      input: {
        messages: messagesWithImages,
        session_context: sessionContext,
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
