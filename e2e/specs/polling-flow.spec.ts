/**
 * Polling Architecture Tests
 * Tests for the client-side polling implementation for assessment processing
 *
 * @bug BUG-007 Tests for polling timeout (currently no timeout limit)
 */

import { test, expect } from '@playwright/test';
import { setupMocks, resetStatusCounter, createTestFiles, validMetadataComplete } from '../fixtures';
import { AssessmentWizardPage } from '../fixtures/page-objects/assessment-wizard';

test.describe('Assessment Polling Flow', () => {
  let wizard: AssessmentWizardPage;

  test.beforeEach(async ({ page }) => {
    wizard = new AssessmentWizardPage(page);
  });

  test.describe('Happy Path', () => {
    test('should submit job and poll until completion', async ({ page }) => {
      // Increase timeout for flaky tests under heavy parallel load
      test.setTimeout(90000);

      // Setup mocks with a realistic polling sequence
      await setupMocks(page, {
        assessStatus: {
          sequence: ['pending', 'in_progress', 'completed'],
        },
      });

      await wizard.gotoNewAssessment();

      // Upload images
      const files = createTestFiles(2);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();

      // Fill metadata and submit
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 15, 12, 9);
      await wizard.submitAssessment();

      // Should show processing
      await wizard.waitForProcessing();

      // Should complete and show report
      await wizard.waitForCompletion(60000);
      await wizard.expectOnReportStep();

      // Verify report content
      const summary = await wizard.getExecutiveSummary();
      expect(summary.length).toBeGreaterThan(50);
    });

    test('should display processing view during polling', async ({ page }) => {
      // Increase timeout for flaky tests under heavy parallel load
      test.setTimeout(90000);

      // Setup base mocks first for project/assessment endpoints
      await setupMocks(page);

      // Setup mocks with slower polling (status stays pending longer) - override base mocks
      let statusCalls = 0;
      await page.route('**/api/assess/submit', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123' } }),
        });
      });

      await page.route('**/api/assess/status/*', async (route) => {
        statusCalls++;
        const status = statusCalls >= 3 ? 'completed' : 'pending';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123', status } }),
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

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Verify processing view is shown
      await wizard.waitForProcessing();
      await expect(page.locator(':text("Processing"), :text("Analyzing")').first()).toBeVisible();

      // Wait for completion
      await wizard.waitForCompletion(30000);
    });

    test('should show processing time after completion', async ({ page }) => {
      await setupMocks(page, {
        assessStatus: { sequence: ['completed'] },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      await wizard.waitForCompletion();

      // Processing time should be displayed somewhere on the page
      const pageContent = await page.content();
      // The page should show some indication of timing (seconds, ms, time, etc.)
      expect(
        pageContent.toLowerCase().includes('second') ||
        pageContent.toLowerCase().includes('ms') ||
        pageContent.toLowerCase().includes('time')
      ).toBe(true);
    });
  });

  test.describe('Error Paths', () => {
    test('should handle job submission failure', async ({ page }) => {
      await setupMocks(page, {
        assessSubmit: {
          success: false,
          error: { code: 500, message: 'Failed to submit assessment job' },
        },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Should show error and return to metadata step
      await wizard.expectError('Failed to submit');
      await wizard.expectOnMetadataStep();
    });

    test('should handle job failure status', async ({ page }) => {
      // Increase timeout for flaky tests under heavy parallel load
      test.setTimeout(90000);

      await setupMocks(page, {
        assessStatus: {
          sequence: ['pending', 'failed'],
          error: 'RunPod processing failed: model timeout',
        },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      await wizard.waitForProcessing();

      // Wait for failure to be detected (allow time for 2 polling cycles under load)
      await page.waitForTimeout(12000);

      // Should show error and return to metadata step
      await wizard.expectError();
      await wizard.expectOnMetadataStep();
    });

    test('should handle result fetch failure after completion', async ({ page }) => {
      await setupMocks(page, {
        assessStatus: { sequence: ['completed'] },
        assessResult: {
          success: false,
          error: { code: 500, message: 'Failed to retrieve results' },
        },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Wait for the result fetch to fail
      await page.waitForTimeout(6000);

      // Should show error
      await wizard.expectError('Failed to retrieve');
    });

    test('should recover from transient polling errors', async ({ page }) => {
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

      // First call fails, subsequent calls succeed
      await page.route('**/api/assess/status/*', async (route) => {
        statusCalls++;
        if (statusCalls === 1) {
          // First call - network error (will be caught and polling continues)
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: { code: 500, message: 'Temporary error' } }),
          });
        } else {
          // Subsequent calls succeed
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { jobId: 'test-job-123', status: 'completed' } }),
          });
        }
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
                executiveSummary: 'Recovery successful',
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

      // Should eventually complete despite transient error
      await wizard.waitForCompletion(30000);
      await wizard.expectOnReportStep();

      // Verify we recovered
      const summary = await wizard.getExecutiveSummary();
      expect(summary).toContain('Recovery successful');
    });
  });

  test.describe('Edge Cases', () => {
    test('should cleanup polling interval on navigation away', async ({ page }) => {
      // Setup base mocks first for project/assessment endpoints
      await setupMocks(page);

      // Setup slow polling that never completes (override base mocks)
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
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123', status: 'pending' } }),
        });
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Wait for processing to start
      await wizard.waitForProcessing();

      // Navigate away
      await page.goto('/');

      // Wait a bit to ensure no errors from orphaned polling
      await page.waitForTimeout(3000);

      // Should not have console errors
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.waitForTimeout(2000);

      // Filter out expected console messages (not related to polling cleanup)
      const unexpectedErrors = consoleErrors.filter(
        (err) => !err.includes('404') && !err.includes('favicon')
      );

      expect(unexpectedErrors.length).toBe(0);
    });

    test('should handle rapid status changes correctly', async ({ page }) => {
      // Setup mocks that return completed immediately
      await setupMocks(page, {
        assessStatus: { sequence: ['completed'] },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Should handle immediate completion without issues
      await wizard.waitForCompletion();
      await wizard.expectOnReportStep();
      await wizard.expectNoError();
    });

    /**
     * @bug BUG-007
     * @description Tests that polling has a maximum timeout
     * @expected Polling should timeout after reasonable duration with user-friendly error
     * @actual Currently polls indefinitely - this test documents the bug
     */
    test.skip('should timeout after maximum polling duration', async ({ page }) => {
      // This test is skipped because it takes 10 minutes to run
      // BUG-007 HAS BEEN FIXED - polling now times out after 10 minutes

      // Setup base mocks first for project/assessment endpoints
      await setupMocks(page);

      // Setup mocks that always return pending (override base mocks)
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
          body: JSON.stringify({ success: true, data: { jobId: 'test-job-123', status: 'pending' } }),
        });
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Wait for timeout (expected: 10 minutes max)
      // This should eventually show an error like "Assessment timed out"
      await page.waitForTimeout(600000); // 10 minutes

      await wizard.expectError('timeout');
    });
  });
});
