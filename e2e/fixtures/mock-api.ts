/**
 * Centralized API Mocking for E2E Tests
 * Provides configurable mocks for all SmokeScan API endpoints
 */

import { Page, Route } from '@playwright/test';
import type { AssessmentReport, JobStatus } from '../../src/react-app/types';

// ============ Types ============

export interface MockAssessSubmitConfig {
  success?: boolean;
  jobId?: string;
  error?: { code: number; message: string };
  delay?: number;
}

export interface MockAssessStatusConfig {
  /** Sequence of statuses to return on successive calls */
  sequence?: JobStatus[];
  /** Error message when status is 'failed' */
  error?: string;
  /** Delay in ms before responding */
  delay?: number;
}

export interface MockAssessResultConfig {
  success?: boolean;
  report?: AssessmentReport;
  sessionId?: string;
  error?: { code: number; message: string };
  delay?: number;
}

export interface MockChatConfig {
  success?: boolean;
  response?: string;
  error?: { code: number; message: string };
  delay?: number;
}

export interface MockProjectConfig {
  success?: boolean;
  project?: {
    id: string;
    name: string;
    address: string;
    client_name?: string;
    created_at: string;
    updated_at: string;
  };
  error?: { code: number; message: string };
}

export interface MockAssessmentConfig {
  success?: boolean;
  assessment?: {
    id: string;
    project_id: string;
    room_type: string;
    room_name?: string;
    phase: string;
    status: string;
    session_id?: string;
    created_at: string;
    updated_at: string;
  };
  error?: { code: number; message: string };
}

export interface MockConfig {
  assessSubmit?: MockAssessSubmitConfig;
  assessStatus?: MockAssessStatusConfig;
  assessResult?: MockAssessResultConfig;
  chat?: MockChatConfig;
  project?: MockProjectConfig;
  assessment?: MockAssessmentConfig;
  /** Whether to mock project/assessment endpoints */
  mockProjectEndpoints?: boolean;
}

// ============ Default Mock Data ============

export function getMockReport(): AssessmentReport {
  return {
    executiveSummary:
      'Initial assessment of fire-damaged residential living room reveals moderate smoke damage with near-field zone classification. Visible soot deposits on ceiling and upper walls indicate thermal plume effects. FDAM methodology recommends immediate HEPA vacuuming followed by appropriate cleaning protocols.',
    detailedAssessment: [
      {
        area: 'Zone Classification',
        findings: 'Near-field damage observed based on thermal gradient patterns and soot density.',
        severity: 'moderate',
        recommendations: [
          'HEPA vacuum all surfaces before wet cleaning',
          'Use appropriate PPE during restoration',
          'Document all findings photographically',
        ],
      },
      {
        area: 'Ceiling',
        findings: 'Heavy soot accumulation with visible thermal discoloration.',
        severity: 'heavy',
        recommendations: [
          'HEPA vacuum ceiling surfaces',
          'Apply alkaline cleaner for protein-based residues',
          'Consider sealing with shellac-based primer if odor persists',
        ],
      },
      {
        area: 'Walls',
        findings: 'Moderate smoke staining on upper portions, lighter deposits near floor level.',
        severity: 'moderate',
        recommendations: [
          'HEPA vacuum from top to bottom',
          'Clean with appropriate degreaser',
          'Repaint after cleaning verification',
        ],
      },
    ],
    fdamRecommendations: [
      'Follow FDAM v4 protocols for near-field contamination',
      'Collect wipe samples from representative surfaces before cleaning',
      'Document baseline conditions for insurance purposes',
      'Verify cleaning effectiveness with post-cleaning samples',
    ],
    restorationPriority: [
      {
        priority: 1,
        area: 'Ceiling',
        action: 'HEPA vacuum and clean',
        rationale: 'Highest contamination level, affects air quality',
      },
      {
        priority: 2,
        area: 'Upper Walls',
        action: 'Clean and seal if needed',
        rationale: 'Thermal plume deposited significant residue',
      },
      {
        priority: 3,
        area: 'Lower Walls',
        action: 'Clean and monitor',
        rationale: 'Lower contamination, standard cleaning may suffice',
      },
    ],
    scopeIndicators: [
      'Visual assessment completed',
      'Zone classification: Near-field',
      'Primary damage type: Smoke/soot',
      'Recommended phase: PRE evaluation complete, ready for PRA sampling',
    ],
  };
}

export const DEFAULT_PROJECT = {
  id: 'test-project-123',
  name: 'Test Fire Damage Assessment',
  address: '123 Test Street, TestCity, TS 12345',
  client_name: 'Test Client',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEFAULT_ASSESSMENT = {
  id: 'test-assessment-456',
  project_id: 'test-project-123',
  room_type: 'residential-living',
  room_name: 'Living Room',
  phase: 'PRE',
  status: 'draft',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============ Mock Handlers ============

let statusCallIndex = 0;

async function handleAssessSubmit(route: Route, config: MockAssessSubmitConfig): Promise<void> {
  if (config.delay) {
    await new Promise((resolve) => setTimeout(resolve, config.delay));
  }

  if (config.success === false) {
    // Return 200 with success: false so frontend parses the error message
    // (Frontend checks response.ok before parsing JSON)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: config.error || { code: 500, message: 'Internal server error' },
      }),
    });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: { jobId: config.jobId || 'test-job-123' },
    }),
  });
}

async function handleAssessStatus(route: Route, config: MockAssessStatusConfig): Promise<void> {
  if (config.delay) {
    await new Promise((resolve) => setTimeout(resolve, config.delay));
  }

  const sequence = config.sequence || ['completed'];
  const status = sequence[Math.min(statusCallIndex, sequence.length - 1)];
  statusCallIndex++;

  const response: {
    success: boolean;
    data: { jobId: string; status: JobStatus; error?: string };
  } = {
    success: true,
    data: {
      jobId: 'test-job-123',
      status,
    },
  };

  if (status === 'failed' && config.error) {
    response.data.error = config.error;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(response),
  });
}

async function handleAssessResult(route: Route, config: MockAssessResultConfig): Promise<void> {
  if (config.delay) {
    await new Promise((resolve) => setTimeout(resolve, config.delay));
  }

  if (config.success === false) {
    // Return 200 with success: false so frontend parses the error message
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: config.error || { code: 500, message: 'Internal server error' },
      }),
    });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        sessionId: config.sessionId || 'test-session-789',
        report: config.report || getMockReport(),
        processingTimeMs: 5000,
      },
    }),
  });
}

async function handleChat(route: Route, config: MockChatConfig): Promise<void> {
  if (config.delay) {
    await new Promise((resolve) => setTimeout(resolve, config.delay));
  }

  if (config.success === false) {
    // Return 200 with success: false so frontend parses the error message
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: config.error || { code: 500, message: 'Internal server error' },
      }),
    });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        sessionId: 'test-session-789',
        response:
          config.response ||
          'Based on the FDAM methodology, the recommended approach for this area would be to start with HEPA vacuuming followed by appropriate wet cleaning methods.',
        timestamp: new Date().toISOString(),
      },
    }),
  });
}

async function handleProject(route: Route, config: MockProjectConfig): Promise<void> {
  if (config.success === false) {
    await route.fulfill({
      status: config.error?.code || 404,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: config.error || { code: 404, message: 'Project not found' },
      }),
    });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: config.project || DEFAULT_PROJECT,
    }),
  });
}

async function handleAssessment(route: Route, config: MockAssessmentConfig): Promise<void> {
  if (config.success === false) {
    await route.fulfill({
      status: config.error?.code || 404,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: config.error || { code: 404, message: 'Assessment not found' },
      }),
    });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: config.assessment || DEFAULT_ASSESSMENT,
    }),
  });
}

// ============ Main Setup Function ============

/**
 * Setup API mocks for e2e tests
 * Call this at the start of each test to configure API behavior
 */
export async function setupMocks(page: Page, config: MockConfig = {}): Promise<void> {
  // Reset status call counter for each test
  statusCallIndex = 0;

  // Default configurations
  const assessSubmitConfig: MockAssessSubmitConfig = {
    success: true,
    jobId: 'test-job-123',
    ...config.assessSubmit,
  };

  const assessStatusConfig: MockAssessStatusConfig = {
    sequence: ['completed'], // Fast tests: skip polling, go straight to completed
    ...config.assessStatus,
  };

  const assessResultConfig: MockAssessResultConfig = {
    success: true,
    sessionId: 'test-session-789',
    ...config.assessResult,
  };

  const chatConfig: MockChatConfig = {
    success: true,
    ...config.chat,
  };

  // Setup assessment polling endpoints
  await page.route('**/api/assess/submit', async (route) => {
    await handleAssessSubmit(route, assessSubmitConfig);
  });

  await page.route('**/api/assess/status/*', async (route) => {
    await handleAssessStatus(route, assessStatusConfig);
  });

  await page.route('**/api/assess/result/*', async (route) => {
    await handleAssessResult(route, assessResultConfig);
  });

  // Setup chat endpoint
  await page.route('**/api/chat', async (route) => {
    await handleChat(route, chatConfig);
  });

  // Optionally setup project/assessment endpoints
  if (config.mockProjectEndpoints !== false) {
    await page.route('**/api/projects/*', async (route) => {
      // Handle nested routes like /api/projects/:id/assessments
      const url = route.request().url();
      if (url.includes('/assessments')) {
        // POST to create assessment
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: config.assessment?.assessment || DEFAULT_ASSESSMENT,
            }),
          });
        } else {
          await route.continue();
        }
      } else {
        await handleProject(route, config.project || {});
      }
    });

    await page.route('**/api/assessments/*', async (route) => {
      const method = route.request().method();

      if (method === 'GET') {
        await handleAssessment(route, config.assessment || {});
      } else if (method === 'PATCH') {
        // Allow PATCH to succeed silently (for updating assessment status)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...DEFAULT_ASSESSMENT, status: 'completed' },
          }),
        });
      } else {
        await route.continue();
      }
    });
  }
}

/**
 * Reset the status call counter
 * Useful when testing multiple polling sequences in one test
 */
export function resetStatusCounter(): void {
  statusCallIndex = 0;
}

/**
 * Get current status call count
 * Useful for verifying polling behavior
 */
export function getStatusCallCount(): number {
  return statusCallIndex;
}
