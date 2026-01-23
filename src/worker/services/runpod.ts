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

export type RunPodResponse = {
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
    return this.callAnalysisEndpointChat(conversationHistory, sessionContext, images);
  }

  // ============ Non-blocking methods for client-side polling ============

  /**
   * Submit assessment job to RunPod without waiting for completion.
   * Returns the RunPod job ID for subsequent polling.
   */
  async submitJob(
    images: string[],
    metadata: AssessmentMetadata
  ): Promise<Result<string, ApiError>> {
    const endpointUrl = `https://api.runpod.ai/v2/${this.config.analysisEndpointId}`;

    // Build metadata sections (same as callAnalysisEndpoint)
    const area = metadata.dimensions.length_ft * metadata.dimensions.width_ft;
    const volume = area * metadata.dimensions.height_ft;

    const userPrompt = `Analyze these ${images.length} images of a ${metadata.roomType} in a ${metadata.structureType} structure.

## Room Metadata
- Floor level: ${metadata.floor_level || 'not specified'}
- Dimensions: ${metadata.dimensions.length_ft}ft L × ${metadata.dimensions.width_ft}ft W × ${metadata.dimensions.height_ft}ft H
- Area: ${area} SF
- Volume: ${volume} CF
${metadata.fireOrigin ? `- Fire origin: ${metadata.fireOrigin}` : ''}

## Field Observations
${metadata.sensory_observations?.smoke_odor_present ? `- Smoke odor detected: ${metadata.sensory_observations.smoke_odor_intensity || 'present'}` : '- Smoke odor: not reported'}
${metadata.sensory_observations?.white_wipe_result ? `- White wipe test: ${metadata.sensory_observations.white_wipe_result}` : '- White wipe test: not performed'}

${metadata.notes ? `## Additional Notes\n${metadata.notes}` : ''}

Generate a comprehensive FDAM assessment report. Consider all metadata and field observations when determining zone classification and disposition recommendations. Use the fdam_rag tool to retrieve relevant FDAM methodology based on what you observe in the images.`;

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

    try {
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

      // Return the job ID immediately (don't wait for completion)
      return { success: true, data: submitResult.id };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 500,
          message: 'RunPod submit error',
          details: String(e),
        },
      };
    }
  }

  /**
   * Check the status of a RunPod job without blocking.
   */
  async getJobStatus(runpodJobId: string): Promise<Result<RunPodResponse, ApiError>> {
    const endpointUrl = `https://api.runpod.ai/v2/${this.config.analysisEndpointId}`;

    try {
      const statusResponse = await fetch(`${endpointUrl}/status/${runpodJobId}`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        return {
          success: false,
          error: {
            code: statusResponse.status as ApiErrorCode,
            message: 'Failed to get job status',
          },
        };
      }

      const statusResult = (await statusResponse.json()) as RunPodResponse;
      return { success: true, data: statusResult };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 500,
          message: 'RunPod status error',
          details: String(e),
        },
      };
    }
  }

  /**
   * Get the result of a completed RunPod job.
   * Parses the output and strips think blocks.
   */
  async getJobResult(runpodJobId: string): Promise<Result<string, ApiError>> {
    const statusResult = await this.getJobStatus(runpodJobId);
    if (!statusResult.success) {
      return statusResult;
    }

    const jobResponse = statusResult.data;

    if (jobResponse.status !== 'COMPLETED') {
      return {
        success: false,
        error: {
          code: 400,
          message: `Job not completed. Current status: ${jobResponse.status}`,
        },
      };
    }

    const responseData = jobResponse.output as { output?: string; error?: string };

    if (responseData?.error) {
      return {
        success: false,
        error: { code: 500, message: 'Analysis error', details: responseData.error },
      };
    }

    const rawContent = responseData?.output;
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
   * Call the Qwen-Agent endpoint with images
   * RAG context is retrieved dynamically via fdam_rag tool
   */
  private async callAnalysisEndpoint(
    images: string[],
    metadata: AssessmentMetadata
  ): Promise<Result<string, ApiError>> {
    const endpointUrl = `https://api.runpod.ai/v2/${this.config.analysisEndpointId}`;

    // Build metadata sections
    const area = metadata.dimensions.length_ft * metadata.dimensions.width_ft;
    const volume = area * metadata.dimensions.height_ft;

    const userPrompt = `Analyze these ${images.length} images of a ${metadata.roomType} in a ${metadata.structureType} structure.

## Room Metadata
- Floor level: ${metadata.floor_level || 'not specified'}
- Dimensions: ${metadata.dimensions.length_ft}ft L × ${metadata.dimensions.width_ft}ft W × ${metadata.dimensions.height_ft}ft H
- Area: ${area} SF
- Volume: ${volume} CF
${metadata.fireOrigin ? `- Fire origin: ${metadata.fireOrigin}` : ''}

## Field Observations
${metadata.sensory_observations?.smoke_odor_present ? `- Smoke odor detected: ${metadata.sensory_observations.smoke_odor_intensity || 'present'}` : '- Smoke odor: not reported'}
${metadata.sensory_observations?.white_wipe_result ? `- White wipe test: ${metadata.sensory_observations.white_wipe_result}` : '- White wipe test: not performed'}

${metadata.notes ? `## Additional Notes\n${metadata.notes}` : ''}

Generate a comprehensive FDAM assessment report. Consider all metadata and field observations when determining zone classification and disposition recommendations. Use the fdam_rag tool to retrieve relevant FDAM methodology based on what you observe in the images.`;

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
    let messagesWithImages: Array<{ role: string; content: unknown }> = conversationHistory;

    if (images.length > 0 && conversationHistory.length > 0) {
      // The last message is always the new user message (added by chat.ts)
      const lastIndex = conversationHistory.length - 1;
      const lastMsg = conversationHistory[lastIndex];

      if (lastMsg.role === 'user') {
        // Build multimodal content with text + images
        const content: Array<{ type: string; text?: string; image?: string }> = [
          { type: 'text', text: lastMsg.content },
        ];

        for (const image of images) {
          content.push({ type: 'image', image });
        }

        messagesWithImages = [
          ...conversationHistory.slice(0, lastIndex),
          { role: 'user', content },
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
