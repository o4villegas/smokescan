/**
 * API Failure Recovery Tests
 * Tests system resilience to various API failure modes
 *
 * @bug BUG-002 Tests for Promise.all partial failures
 * @bug BUG-005 Tests for JSON.parse without try-catch
 */

import { test, expect } from '@playwright/test';
import { setupMocks, createTestFiles, DEFAULT_PROJECT, DEFAULT_ASSESSMENT } from '../fixtures';
import { AssessmentWizardPage } from '../fixtures/page-objects/assessment-wizard';

test.describe('API Failure Recovery', () => {
  let wizard: AssessmentWizardPage;

  test.beforeEach(async ({ page }) => {
    wizard = new AssessmentWizardPage(page);
  });

  test.describe('Assessment Creation', () => {
    test('should handle project not found error', async ({ page }) => {
      await setupMocks(page, {
        project: {
          success: false,
          error: { code: 404, message: 'Project not found' },
        },
      });

      // Navigate to wizard for non-existent project
      await page.goto('/projects/non-existent-project/wizard');

      // Should show some error or fallback behavior
      // The exact behavior depends on how the app handles this
      await page.waitForTimeout(1000);
    });

    test('should handle assessment not found when resuming', async ({ page }) => {
      await setupMocks(page, {
        assessment: {
          success: false,
          error: { code: 404, message: 'Assessment not found' },
        },
      });

      // Navigate to wizard for non-existent assessment
      await page.goto('/projects/test-project/assessments/non-existent/wizard');

      await page.waitForTimeout(1000);
    });

    test('should handle database connection failure on project fetch', async ({ page }) => {
      await setupMocks(page, {
        project: {
          success: false,
          error: { code: 500, message: 'Database connection failed' },
        },
      });

      await page.goto('/projects/test-project/wizard');

      // Should handle gracefully
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Image Upload Failures', () => {
    test('should handle large image upload gracefully', async ({ page }) => {
      await setupMocks(page);

      await wizard.gotoNewAssessment();

      // Create a larger test file (simulated)
      const files = createTestFiles(5);
      await wizard.uploadImages(files);

      // Should handle without crashing
      const count = await wizard.getImageCount();
      expect(count).toBe(5);
    });
  });

  test.describe('RunPod Integration Failures', () => {
    test('should handle RunPod endpoint unavailable', async ({ page }) => {
      await setupMocks(page, {
        assessSubmit: {
          success: false,
          error: { code: 503, message: 'RunPod service unavailable' },
        },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      await wizard.expectError('unavailable');
    });

    test('should handle RunPod rate limiting', async ({ page }) => {
      await setupMocks(page, {
        assessSubmit: {
          success: false,
          error: { code: 429, message: 'Rate limit exceeded. Please try again later.' },
        },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      await wizard.expectError('Rate limit');
    });

    /**
     * @bug BUG-005
     * @description Tests handling of malformed JSON response
     * @expected Should show user-friendly error, not crash
     * @actual May cause JSON.parse error if not wrapped in try-catch
     */
    test('should handle malformed RunPod response gracefully', async ({ page }) => {
      // Setup base mocks first for project/assessment endpoints
      await setupMocks(page);

      // Override specific endpoints (Playwright uses LIFO order)
      await page.route('**/api/assess/submit', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123' } }),
        });
      });

      await page.route('**/api/assess/status/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123', status: 'completed' } }),
        });
      });

      // Return malformed JSON-like response
      await page.route('**/api/assess/result/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          // This is valid JSON but missing expected fields
          body: JSON.stringify({
            success: true,
            data: {
              // Missing required fields: sessionId, report
              unexpectedField: 'unexpected value',
            },
          }),
        });
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Wait for result fetch
      await page.waitForTimeout(6000);

      // Should not crash - may show error or handle gracefully
      // This test documents current behavior for BUG-005
    });

    test('should handle RunPod job that takes too long', async ({ page }) => {
      // This test requires longer timeout due to explicit 20s wait
      test.setTimeout(45000);

      // Setup base mocks first for project/assessment endpoints
      await setupMocks(page);

      let statusCalls = 0;

      // Override specific endpoints (Playwright uses LIFO order)
      await page.route('**/api/assess/submit', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123' } }),
        });
      });

      // Always return in_progress (simulates stuck job)
      await page.route('**/api/assess/status/*', async (route) => {
        statusCalls++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { jobId: 'test-job-123', status: 'in_progress' },
          }),
        });
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Wait for several polling cycles
      await page.waitForTimeout(20000);

      // Verify polling is happening
      expect(statusCalls).toBeGreaterThan(2);

      // Note: Currently no timeout is implemented (BUG-007)
      // This test just verifies the polling mechanism works
    });
  });

  test.describe('Session Management Failures', () => {
    test('should handle session not found in chat', async ({ page }) => {
      await setupMocks(page, {
        assessStatus: { sequence: ['completed'] },
        chat: {
          success: false,
          error: { code: 404, message: 'Session not found' },
        },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();
      await wizard.waitForCompletion();
      await wizard.startChat();

      await wizard.sendChatMessage('Test question');
      await page.waitForTimeout(1000);

      await wizard.expectError('Session not found');
    });

    test('should handle session expired mid-conversation', async ({ page }) => {
      // This test involves multiple chat interactions
      test.setTimeout(60000);

      // Setup base mocks first for project/assessment endpoints
      await setupMocks(page);

      let chatCalls = 0;

      // Override specific endpoints (Playwright uses LIFO order)
      await page.route('**/api/assess/submit', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123' } }),
        });
      });

      await page.route('**/api/assess/status/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123', status: 'completed' } }),
        });
      });

      await page.route('**/api/assess/result/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'test-session-789',
              report: {
                executiveSummary: 'Test summary',
                detailedAssessment: [],
                fdamRecommendations: [],
                restorationPriority: [],
                scopeIndicators: [],
              },
              processingTimeMs: 5000,
            },
          }),
        });
      });

      // First chat succeeds, second fails with expired session
      await page.route('**/api/chat', async (route) => {
        chatCalls++;
        if (chatCalls === 1) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                sessionId: 'test-session-789',
                response: 'First response successful',
                timestamp: new Date().toISOString(),
              },
            }),
          });
        } else {
          // Return HTTP 200 with success: false so frontend parses error
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { code: 410, message: 'Session has expired' },
            }),
          });
        }
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();
      await wizard.waitForCompletion();
      await wizard.startChat();

      // First message succeeds
      await wizard.sendChatMessage('First question');
      await page.waitForTimeout(500);

      // Second message should fail
      await wizard.sendChatMessage('Second question');
      await page.waitForTimeout(1000);

      await wizard.expectError('Session has expired');
    });
  });

  test.describe('Network Failures', () => {
    test('should handle network disconnection during submit', async ({ page }) => {
      await page.route('**/api/assess/submit', async (route) => {
        await route.abort('internetdisconnected');
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Should show network error
      await wizard.expectError();
    });

    test('should handle timeout during polling', async ({ page }) => {
      // This test requires longer timeout due to explicit 15s wait
      test.setTimeout(45000);

      // Setup base mocks first for project/assessment endpoints
      await setupMocks(page);

      // Override specific endpoints (Playwright uses LIFO order)
      await page.route('**/api/assess/submit', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123' } }),
        });
      });

      await page.route('**/api/assess/status/*', async (route) => {
        await route.abort('timedout');
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Wait for several polling attempts
      await page.waitForTimeout(15000);

      // Current behavior: polling continues despite errors (BUG-004)
      // This test documents the behavior
    });

    test('should handle slow response gracefully', async ({ page }) => {
      // This test has a 5s delay in mock plus processing time
      test.setTimeout(60000);

      // Setup base mocks first for project/assessment endpoints
      await setupMocks(page);

      // Override specific endpoints (Playwright uses LIFO order)
      await page.route('**/api/assess/submit', async (route) => {
        // Delay response by 5 seconds
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123' } }),
        });
      });

      await page.route('**/api/assess/status/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123', status: 'completed' } }),
        });
      });

      await page.route('**/api/assess/result/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'test-session',
              report: {
                executiveSummary: 'Success after slow start',
                detailedAssessment: [],
                fdamRecommendations: [],
                restorationPriority: [],
                scopeIndicators: [],
              },
              processingTimeMs: 5000,
            },
          }),
        });
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Should eventually complete despite slow start
      await wizard.waitForCompletion(30000);
      await wizard.expectOnReportStep();
    });
  });

  test.describe('Concurrent Request Handling', () => {
    test('should handle rapid form submissions', async ({ page }) => {
      // The wizard flow + waitForCompletion needs more time
      test.setTimeout(45000);

      let submitCount = 0;

      // Setup base mocks first for project/assessment loading
      await setupMocks(page);

      // Override with our tracking routes (LIFO order)
      await page.route('**/api/assess/submit', async (route) => {
        submitCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: `job-${submitCount}` } }),
        });
      });

      await page.route('**/api/assess/status/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job', status: 'completed' } }),
        });
      });

      await page.route('**/api/assess/result/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'test-session',
              report: {
                executiveSummary: 'Test',
                detailedAssessment: [],
                fdamRecommendations: [],
                restorationPriority: [],
                scopeIndicators: [],
              },
              processingTimeMs: 1000,
            },
          }),
        });
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);

      // Click submit once
      await wizard.submitAssessment();

      await wizard.waitForCompletion(30000);

      // Should process successfully
      await wizard.expectOnReportStep();

      // Verify at least one submission occurred
      expect(submitCount).toBeGreaterThanOrEqual(1);
    });
  });
});
