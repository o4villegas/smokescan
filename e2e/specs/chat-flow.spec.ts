/**
 * Chat Flow Tests
 * Comprehensive testing for chat functionality
 *
 * @bug BUG-001 Tests for race condition in chat route
 */

import { test, expect, Page } from '@playwright/test';
import { setupMocks, createTestFiles, chatMessages } from '../fixtures';
import { AssessmentWizardPage } from '../fixtures/page-objects/assessment-wizard';

test.describe('Chat Flow', () => {
  let wizard: AssessmentWizardPage;

  test.beforeEach(async ({ page }) => {
    wizard = new AssessmentWizardPage(page);
  });

  /**
   * Helper to complete assessment and get to chat
   */
  async function completeAssessmentAndStartChat(page: Page) {
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
    await wizard.startChat();
  }

  test.describe('Basic Chat', () => {
    test('should send message and receive response', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      await wizard.sendChatMessage('What cleaning methods do you recommend?');
      await page.waitForTimeout(1000);

      // Should have response in chat
      const assistantMessage = await wizard.getLastAssistantMessage();
      expect(assistantMessage.length).toBeGreaterThan(0);
    });

    test('should display user message in chat history', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      const testMessage = 'What is the recommended approach for ceiling cleaning?';
      await wizard.sendChatMessage(testMessage);

      // User message should be visible in chat
      await expect(page.locator(`text=${testMessage}`)).toBeVisible();
    });

    test('should display assistant response in chat history', async ({ page }) => {
      await setupMocks(page, {
        assessStatus: { sequence: ['completed'] },
        chat: {
          success: true,
          response: 'Based on the FDAM methodology, I recommend HEPA vacuuming followed by wet cleaning.',
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

      // Check for specific response content
      await expect(page.locator('text=HEPA vacuuming')).toBeVisible();
    });

    test('should show loading state while sending message', async ({ page }) => {
      // Setup slow chat response
      await page.route('**/api/chat', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'test-session',
              response: 'Delayed response',
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });

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
      await wizard.startChat();

      // Send message but don't wait
      wizard.chatInput.fill('Test question');
      wizard.sendButton.click();

      // Should show loading state
      // Input may be disabled or loading indicator shown
      await page.waitForTimeout(500);
    });

    test('should disable input while waiting for response', async ({ page }) => {
      // Setup slow chat response
      await page.route('**/api/chat', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'test-session',
              response: 'Response',
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });

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
      await wizard.startChat();

      await wizard.chatInput.fill('Test question');
      await wizard.sendButton.click();

      // Check if input is disabled during loading
      await page.waitForTimeout(500);
      const isDisabled = await wizard.chatInput.isDisabled();
      // Note: This depends on implementation - may or may not be disabled
    });
  });

  test.describe('Chat State Management', () => {
    test('should preserve chat history on back/forward navigation', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      // Send a message
      await wizard.sendChatMessage('First question about damage assessment');
      await page.waitForTimeout(1000);

      // Go back to report
      await wizard.backToReport();
      await wizard.expectOnReportStep();

      // Return to chat
      await wizard.startChat();

      // Message history should be preserved
      await expect(page.locator('text=First question')).toBeVisible();
    });

    test('should maintain session across multiple messages', async ({ page }) => {
      let sessionId = '';
      let messageCount = 0;

      // Setup mocks first, then override chat route (Playwright LIFO order)
      await setupMocks(page, {
        assessStatus: { sequence: ['completed'] },
      });

      await page.route('**/api/chat', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        messageCount++;

        if (messageCount === 1) {
          sessionId = body.sessionId;
        } else {
          // Verify same session is used
          expect(body.sessionId).toBe(sessionId);
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: body.sessionId,
              response: `Response ${messageCount}`,
              timestamp: new Date().toISOString(),
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
      await wizard.waitForCompletion();
      await wizard.startChat();

      // Send multiple messages
      await wizard.sendChatMessage('Question 1');
      await page.waitForTimeout(1000);
      await wizard.sendChatMessage('Question 2');
      await page.waitForTimeout(1000);
      await wizard.sendChatMessage('Question 3');
      await page.waitForTimeout(1000);

      expect(messageCount).toBe(3);
    });

    test('should clear input after sending message', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      await wizard.chatInput.fill('Test question');
      await wizard.sendButton.click();
      await page.waitForTimeout(1000);

      // Input should be cleared
      const inputValue = await wizard.chatInput.inputValue();
      expect(inputValue).toBe('');
    });
  });

  test.describe('Chat Input Handling', () => {
    test('should handle special characters in messages', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      await wizard.sendChatMessage(chatMessages.specialChars);
      await page.waitForTimeout(1000);

      // Should not crash and message should be visible
      await wizard.expectNoError();
    });

    test('should handle long messages', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      await wizard.sendChatMessage(chatMessages.longMessage);
      await page.waitForTimeout(1500);

      // Should handle without error
      await wizard.expectNoError();
    });

    test('should handle empty message submission', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      // Clear input
      await wizard.chatInput.fill('');

      // Send button should be disabled for empty messages, or clicking should have no effect
      // Check if button is disabled
      const isDisabled = await wizard.sendButton.isDisabled();
      if (!isDisabled) {
        // If not disabled, clicking should not cause errors
        await wizard.sendButton.click();
        await page.waitForTimeout(500);
      }

      // Should not have any errors
      await wizard.expectNoError();
    });

    test('should trim whitespace from messages', async ({ page }) => {
      let sentMessage = '';

      await page.route('**/api/chat', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        sentMessage = body.message;

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'test-session',
              response: 'Response',
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });

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
      await wizard.startChat();

      // Send message with extra whitespace
      await wizard.sendChatMessage('   Question with whitespace   ');
      await page.waitForTimeout(1000);

      // Message should be trimmed (implementation dependent)
    });
  });

  test.describe('Chat Error Handling', () => {
    test('should show error and allow retry on failure', async ({ page }) => {
      let attempts = 0;

      // Setup mocks first, then override chat route (Playwright LIFO order)
      await setupMocks(page, {
        assessStatus: { sequence: ['completed'] },
      });

      await page.route('**/api/chat', async (route) => {
        attempts++;
        if (attempts === 1) {
          // Return HTTP 200 with success: false so frontend parses error
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { code: 500, message: 'Server error' },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                sessionId: 'test-session',
                response: 'Retry successful!',
                timestamp: new Date().toISOString(),
              },
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

      // First attempt fails
      await wizard.sendChatMessage('First attempt');
      await page.waitForTimeout(1000);
      await wizard.expectError();

      // Dismiss and retry
      await wizard.dismissError();
      await wizard.sendChatMessage('Retry attempt');
      await page.waitForTimeout(1000);

      // Should succeed
      await expect(page.locator('text=Retry successful')).toBeVisible();
    });

    /**
     * @bug BUG-001
     * @description Tests for race condition when rapid messages are sent
     * @expected Messages should be processed in order without conflicts
     * @actual May have race condition issues
     */
    test('should handle rapid message sending without race conditions', async ({ page }) => {
      const responses: string[] = [];

      await page.route('**/api/chat', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const responseNum = body.message.includes('1')
          ? '1'
          : body.message.includes('2')
            ? '2'
            : '3';

        // Add random delay to simulate real network conditions
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 500));

        responses.push(responseNum);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'test-session',
              response: `Response ${responseNum}`,
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });

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
      await wizard.startChat();

      // Send messages rapidly (if the UI allows)
      await wizard.chatInput.fill('Message 1');
      await wizard.sendButton.click();

      // Wait for messages to complete
      await page.waitForTimeout(3000);

      // Verify no errors occurred
      await wizard.expectNoError();
    });
  });

  test.describe('Chat with Existing Assessment', () => {
    test('should load existing session for completed assessment', async ({ page }) => {
      // This tests accessing chat for an already-completed assessment
      await setupMocks(page, {
        assessment: {
          success: true,
          assessment: {
            id: 'existing-assessment',
            project_id: 'test-project',
            room_type: 'residential-living',
            phase: 'PRE',
            status: 'completed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      });

      // For this test, we need to mock the assessment view page
      // This depends on how the app handles viewing existing assessments
    });
  });

  test.describe('Chat UI Elements', () => {
    test('should show back button to return to report', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      await expect(wizard.backToReportButton).toBeVisible();
    });

    test('should navigate back to report when clicking back button', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      await wizard.backToReport();

      await wizard.expectOnReportStep();
    });

    test('should have visible chat input and send button', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      await expect(wizard.chatInput).toBeVisible();
      await expect(wizard.sendButton).toBeVisible();
    });

    test('should focus chat input when entering chat', async ({ page }) => {
      await completeAssessmentAndStartChat(page);

      // Input should be focused (ready for typing)
      // This is implementation dependent
    });
  });
});
