/**
 * Storage Service
 * R2 bucket operations for SmokeScan images and reports
 */

import type { Result, ApiError } from '../types';

export class StorageService {
  constructor(
    private imagesBucket: R2Bucket,
    private reportsBucket: R2Bucket
  ) {}

  // ============ Image Operations ============

  async uploadImage(
    assessmentId: string,
    filename: string,
    data: ArrayBuffer | ReadableStream,
    contentType: string
  ): Promise<Result<{ key: string; size: number }, ApiError>> {
    try {
      const key = `${assessmentId}/${Date.now()}-${filename}`;

      const result = await this.imagesBucket.put(key, data, {
        httpMetadata: {
          contentType,
        },
        customMetadata: {
          assessmentId,
          originalFilename: filename,
          uploadedAt: new Date().toISOString(),
        },
      });

      return {
        success: true,
        data: {
          key,
          size: result?.size ?? 0,
        },
      };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to upload image', details: String(e) },
      };
    }
  }

  async getImage(key: string): Promise<Result<{ data: ReadableStream; contentType: string }, ApiError>> {
    try {
      const object = await this.imagesBucket.get(key);

      if (!object) {
        return { success: false, error: { code: 404, message: 'Image not found' } };
      }

      return {
        success: true,
        data: {
          data: object.body,
          contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
        },
      };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to get image', details: String(e) },
      };
    }
  }

  async getImageAsBase64(key: string): Promise<Result<{ base64: string; contentType: string }, ApiError>> {
    try {
      const object = await this.imagesBucket.get(key);

      if (!object) {
        return { success: false, error: { code: 404, message: 'Image not found' } };
      }

      const arrayBuffer = await object.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      return {
        success: true,
        data: {
          base64,
          contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
        },
      };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to get image as base64', details: String(e) },
      };
    }
  }

  async deleteImage(key: string): Promise<Result<void, ApiError>> {
    try {
      await this.imagesBucket.delete(key);
      return { success: true, data: undefined };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to delete image', details: String(e) },
      };
    }
  }

  async listImagesByAssessment(assessmentId: string): Promise<Result<R2Object[], ApiError>> {
    try {
      const listed = await this.imagesBucket.list({
        prefix: `${assessmentId}/`,
      });

      return { success: true, data: listed.objects };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to list images', details: String(e) },
      };
    }
  }

  // ============ Report Operations ============

  async uploadReport(
    assessmentId: string,
    reportId: string,
    pdfData: ArrayBuffer
  ): Promise<Result<{ key: string }, ApiError>> {
    try {
      const key = `${assessmentId}/${reportId}.pdf`;

      await this.reportsBucket.put(key, pdfData, {
        httpMetadata: {
          contentType: 'application/pdf',
        },
        customMetadata: {
          assessmentId,
          reportId,
          createdAt: new Date().toISOString(),
        },
      });

      return { success: true, data: { key } };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to upload report', details: String(e) },
      };
    }
  }

  async getReport(key: string): Promise<Result<{ data: ReadableStream; contentType: string }, ApiError>> {
    try {
      const object = await this.reportsBucket.get(key);

      if (!object) {
        return { success: false, error: { code: 404, message: 'Report not found' } };
      }

      return {
        success: true,
        data: {
          data: object.body,
          contentType: 'application/pdf',
        },
      };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to get report', details: String(e) },
      };
    }
  }

  async deleteReport(key: string): Promise<Result<void, ApiError>> {
    try {
      await this.reportsBucket.delete(key);
      return { success: true, data: undefined };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to delete report', details: String(e) },
      };
    }
  }

  // ============ Utility ============

  async deleteAllByAssessment(assessmentId: string): Promise<Result<void, ApiError>> {
    try {
      // Delete all images
      const images = await this.imagesBucket.list({ prefix: `${assessmentId}/` });
      for (const obj of images.objects) {
        await this.imagesBucket.delete(obj.key);
      }

      // Delete all reports
      const reports = await this.reportsBucket.list({ prefix: `${assessmentId}/` });
      for (const obj of reports.objects) {
        await this.reportsBucket.delete(obj.key);
      }

      return { success: true, data: undefined };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to delete assessment files', details: String(e) },
      };
    }
  }
}
