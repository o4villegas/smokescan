/**
 * RunPod Service
 * Handles communication with the Qwen3-VL vision model endpoint
 */

import type { Result, ApiError, ApiErrorCode, VisionAnalysisOutput, AssessmentMetadata } from '../types';
import { VisionAnalysisOutputSchema } from '../schemas';

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

const PHASE1_SYSTEM_PROMPT = `You are an expert fire damage assessment analyst implementing the FDAM (Fire Damage Assessment Methodology) v4.0.1 protocol.

Analyze the provided images of fire/smoke damage and produce a structured JSON assessment.

Your output MUST be valid JSON with this exact structure:
{
  "damageInventory": [
    {
      "damageType": "char_damage|smoke_staining|soot_deposit|heat_damage|water_damage|structural_damage|odor_contamination|particulate_contamination",
      "location": "specific location description (e.g., 'ceiling_northwest', 'wall_east')",
      "severity": "heavy|moderate|light|trace|none",
      "material": "affected material (e.g., 'drywall', 'wood_beam', 'hvac_duct')",
      "notes": "optional additional observations"
    }
  ],
  "retrievalKeywords": ["5-10 technical terms for RAG retrieval"],
  "overallSeverity": "heavy|moderate|light|trace|none",
  "zoneClassification": "burn|near-field|far-field",
  "confidenceScore": 0.0-1.0
}

Zone Classification Guide:
- burn: Direct fire involvement, visible char, structural damage from flames
- near-field: Adjacent to burn zone, heavy smoke/soot, heat exposure but no direct flames
- far-field: Smoke migration only, no direct heat exposure

Use precise FDAM vocabulary for damage types and materials. Be thorough but accurate.`;

const PHASE3_SYSTEM_PROMPT = `You are an expert fire damage assessment consultant generating a professional FDAM-compliant assessment report.

Based on the structured damage analysis and FDAM methodology context provided, generate a comprehensive assessment report for the property owner/insurance adjuster.

Your report should include:
1. Executive Summary (2-3 sentences)
2. Detailed findings by area
3. FDAM protocol recommendations
4. Restoration priority matrix
5. Scope indicators (not dollar amounts)

Write in professional, clear language. Reference FDAM standards where applicable.
Be specific about locations and severities. Provide actionable recommendations.`;

/**
 * Format system message for Qwen3-VL multimodal requests.
 * The processor requires ALL messages to use list format when ANY message contains images/video.
 * See: https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking
 */
function formatSystemMessage(text: string) {
  return { role: 'system', content: [{ type: 'text', text }] };
}

export class RunPodService {
  private config: RunPodConfig;
  private baseUrl: string;

  constructor(config: RunPodConfig) {
    this.config = config;
    this.baseUrl = `https://api.runpod.ai/v2/${config.endpointId}`;
  }

  /**
   * Phase 1: Analyze images with vision model to extract structured damage data
   */
  async analyzeImages(
    images: string[],
    metadata: AssessmentMetadata
  ): Promise<Result<VisionAnalysisOutput, ApiError>> {
    const userPrompt = `Analyze these ${images.length} images of a ${metadata.roomType} in a ${metadata.structureType} structure.
${metadata.fireOrigin ? `Fire origin information: ${metadata.fireOrigin}` : ''}
${metadata.notes ? `Additional notes: ${metadata.notes}` : ''}

Provide your structured damage assessment as JSON.`;

    // Build message with images
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
        messages: [
          formatSystemMessage(PHASE1_SYSTEM_PROMPT),
          { role: 'user', content },
        ],
        max_tokens: 2000,
      },
    };

    const result = await this.callEndpoint(requestBody);
    if (!result.success) {
      return result;
    }

    // Parse the LLM response
    try {
      const responseData = result.data as { output?: string };
      const content = responseData.output;

      if (!content) {
        return {
          success: false,
          error: { code: 500, message: 'No content in vision model response' },
        };
      }

      // Extract JSON from the response (may be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                        content.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, content];
      const jsonStr = jsonMatch[1] || content;

      const parsed = JSON.parse(jsonStr.trim());
      const validated = VisionAnalysisOutputSchema.safeParse(parsed);

      if (!validated.success) {
        return {
          success: false,
          error: {
            code: 422,
            message: 'Vision model output validation failed',
            details: validated.error.message,
          },
        };
      }

      return { success: true, data: validated.data };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 500,
          message: 'Failed to parse vision model response',
          details: String(e),
        },
      };
    }
  }

  /**
   * Phase 3: Synthesize final report from analysis + RAG context
   */
  async synthesizeReport(
    images: string[],
    visionAnalysis: VisionAnalysisOutput,
    ragContext: string,
    metadata: AssessmentMetadata
  ): Promise<Result<string, ApiError>> {
    const userPrompt = `Generate a professional FDAM assessment report based on:

## Property Information
- Room Type: ${metadata.roomType}
- Structure Type: ${metadata.structureType}
${metadata.fireOrigin ? `- Fire Origin: ${metadata.fireOrigin}` : ''}
${metadata.notes ? `- Notes: ${metadata.notes}` : ''}

## Damage Analysis Summary
- Overall Severity: ${visionAnalysis.overallSeverity}
- Zone Classification: ${visionAnalysis.zoneClassification}
- Confidence Score: ${(visionAnalysis.confidenceScore * 100).toFixed(1)}%

## Detailed Damage Inventory
${visionAnalysis.damageInventory
  .map(
    (item, i) =>
      `${i + 1}. ${item.damageType} at ${item.location}
   - Severity: ${item.severity}
   - Material: ${item.material}
   ${item.notes ? `- Notes: ${item.notes}` : ''}`
  )
  .join('\n')}

## FDAM Methodology Reference
${ragContext}

Please generate a complete, professional assessment report.`;

    // Include images for visual reference in synthesis
    const content: Array<{ type: string; text?: string; image?: string }> = [
      { type: 'text', text: userPrompt },
    ];

    // Include first 3 images for context (to stay within token limits)
    for (const image of images.slice(0, 3)) {
      const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      content.push({
        type: 'image',
        image: imageUrl,
      });
    }

    const requestBody = {
      input: {
        messages: [
          formatSystemMessage(PHASE3_SYSTEM_PROMPT),
          { role: 'user', content },
        ],
        max_tokens: 4000,
      },
    };

    const result = await this.callEndpoint(requestBody);
    if (!result.success) {
      return result;
    }

    const responseData = result.data as { output?: string };
    const reportContent = responseData.output;

    if (!reportContent) {
      return {
        success: false,
        error: { code: 500, message: 'No content in synthesis response' },
      };
    }

    return { success: true, data: reportContent };
  }

  /**
   * Chat completion for follow-up questions
   */
  async chat(
    conversationHistory: Array<{ role: string; content: string }>,
    sessionContext: string
  ): Promise<Result<string, ApiError>> {
    const systemPrompt = `You are an expert fire damage assessment consultant. You have access to a previous assessment and can answer follow-up questions about the findings, recommendations, and FDAM methodology.

Previous Assessment Context:
${sessionContext}

Answer questions clearly and professionally. Reference specific findings from the assessment when relevant.`;

    const requestBody = {
      input: {
        messages: [
          formatSystemMessage(systemPrompt),
          ...conversationHistory,
        ],
        max_tokens: 2000,
      },
    };

    const result = await this.callEndpoint(requestBody);
    if (!result.success) {
      return result;
    }

    const responseData = result.data as { output?: string };
    const response = responseData.output;

    if (!response) {
      return {
        success: false,
        error: { code: 500, message: 'No content in chat response' },
      };
    }

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

      // Poll for completion
      const jobId = submitResult.id;
      const maxAttempts = 60; // 5 minutes with 5s intervals
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
