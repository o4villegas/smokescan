/**
 * Session Service
 * Handles session persistence in Cloudflare KV
 */

import type { Result, ApiError, SessionState } from '../types';

type SessionConfig = {
  kv: KVNamespace;
};

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export class SessionService {
  private kv: KVNamespace;

  constructor(config: SessionConfig) {
    this.kv = config.kv;
  }

  /**
   * Generate a new session ID
   */
  generateSessionId(): string {
    return crypto.randomUUID();
  }

  /**
   * Save session state
   */
  async save(session: SessionState): Promise<Result<void, ApiError>> {
    try {
      session.updatedAt = new Date().toISOString();
      await this.kv.put(
        `session:${session.sessionId}`,
        JSON.stringify(session),
        { expirationTtl: SESSION_TTL }
      );
      return { success: true, data: undefined };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 500,
          message: 'Failed to save session',
          details: String(e),
        },
      };
    }
  }

  /**
   * Load session state
   */
  async load(sessionId: string): Promise<Result<SessionState, ApiError>> {
    try {
      const data = await this.kv.get(`session:${sessionId}`);
      if (!data) {
        return {
          success: false,
          error: {
            code: 404,
            message: 'Session not found',
          },
        };
      }
      return { success: true, data: JSON.parse(data) as SessionState };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 500,
          message: 'Failed to load session',
          details: String(e),
        },
      };
    }
  }

  /**
   * Delete session
   */
  async delete(sessionId: string): Promise<Result<void, ApiError>> {
    try {
      await this.kv.delete(`session:${sessionId}`);
      return { success: true, data: undefined };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 500,
          message: 'Failed to delete session',
          details: String(e),
        },
      };
    }
  }
}
