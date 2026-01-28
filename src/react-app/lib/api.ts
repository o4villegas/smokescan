/**
 * API Client
 * Functions for communicating with the SmokeScan backend
 */

import type {
  AssessmentMetadata,
  AssessmentResponse,
  ChatResponse,
  ApiResponse,
  JobStatus,
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

/**
 * Pre-warm RunPod worker (fire-and-forget, best-effort)
 */
export async function triggerWarmup(): Promise<void> {
  try {
    await fetch(`${API_BASE}/assess/warmup`, { method: 'POST' });
  } catch {
    // Silent failure - warmup is best-effort
  }
}

// ============ Polling-based Assessment API ============

type JobSubmitResponse = {
  jobId: string;
};

type JobStatusResponse = {
  jobId: string;
  status: JobStatus;
  error?: string;
};

/**
 * Submit assessment job (returns immediately with jobId)
 * @param images - Original File objects (used as fallback if compressedDataUrls not provided)
 * @param metadata - Assessment metadata
 * @param compressedDataUrls - Optional pre-compressed data URLs (preferred for smaller payloads)
 */
export async function submitAssessmentJob(
  images: File[],
  metadata: AssessmentMetadata,
  compressedDataUrls?: string[]
): Promise<ApiResponse<JobSubmitResponse>> {
  try {
    // Use pre-compressed data URLs if available, otherwise convert files to base64
    let imageBase64Array: string[];
    if (compressedDataUrls && compressedDataUrls.length === images.length) {
      imageBase64Array = compressedDataUrls;
      console.log('[API] Using pre-compressed images');
    } else {
      imageBase64Array = await Promise.all(images.map(fileToBase64));
      console.log('[API] Converting files to base64 (no compression)');
    }

    const response = await fetch(`${API_BASE}/assess/submit`, {
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
    return data as ApiResponse<JobSubmitResponse>;
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
 * Check job status (for polling)
 */
export async function getJobStatus(
  jobId: string
): Promise<ApiResponse<JobStatusResponse>> {
  try {
    const response = await fetch(`${API_BASE}/assess/status/${jobId}`);

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
    return data as ApiResponse<JobStatusResponse>;
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
 * Get job result (when status is 'completed')
 */
export async function getJobResult(
  jobId: string
): Promise<ApiResponse<AssessmentResponse>> {
  try {
    const response = await fetch(`${API_BASE}/assess/result/${jobId}`);

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

