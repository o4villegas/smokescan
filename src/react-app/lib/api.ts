/**
 * API Client
 * Functions for communicating with the SmokeScan backend
 */

import type {
  AssessmentMetadata,
  AssessmentResponse,
  ChatResponse,
  ApiResponse,
} from '../types';

const API_BASE = '/api';

/**
 * Convert File to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Return the full data URL (includes mime type prefix)
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Submit images for FDAM assessment
 */
export async function submitAssessment(
  images: File[],
  metadata: AssessmentMetadata
): Promise<ApiResponse<AssessmentResponse>> {
  try {
    // Convert images to base64
    const imageBase64Array = await Promise.all(images.map(fileToBase64));

    const response = await fetch(`${API_BASE}/assess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: imageBase64Array,
        metadata,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: response.status,
          message: `HTTP error: ${response.status} ${response.statusText}`,
        },
      };
    }

    const data = await response.json();
    return data as ApiResponse<AssessmentResponse>;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 500,
        message: 'Network error',
        details: String(error),
      },
    };
  }
}

/**
 * Send a chat message for follow-up questions
 */
export async function sendChatMessage(
  sessionId: string,
  message: string
): Promise<ApiResponse<ChatResponse>> {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        message,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: response.status,
          message: `HTTP error: ${response.status} ${response.statusText}`,
        },
      };
    }

    const data = await response.json();
    return data as ApiResponse<ChatResponse>;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 500,
        message: 'Network error',
        details: String(error),
      },
    };
  }
}

