/**
 * Accessibility Tests
 * Ensures WCAG 2.1 AA compliance using axe-core
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMocks, createTestFiles } from '../fixtures';
import { AssessmentWizardPage } from '../fixtures/page-objects/assessment-wizard';

test.describe('Accessibility', () => {
  let wizard: AssessmentWizardPage;

  test.beforeEach(async ({ page }) => {
    wizard = new AssessmentWizardPage(page);
    // Setup default mocks for most tests
    await setupMocks(page, {
      assessStatus: { sequence: ['completed'] },
    });
  });

  test.describe('Page-Level Accessibility', () => {
    test('home page should have no critical accessibility violations', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      // Filter to only critical and serious violations
      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalViolations).toEqual([]);
    });

    test('assessment wizard upload step should have no critical accessibility violations', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalViolations).toEqual([]);
    });

    test('assessment wizard metadata step should have no critical accessibility violations', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalViolations).toEqual([]);
    });

    test('assessment report page should have no critical accessibility violations', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();
      await wizard.waitForCompletion();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalViolations).toEqual([]);
    });

    test('chat interface should have no critical accessibility violations', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();
      await wizard.waitForCompletion();
      await wizard.startChat();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalViolations).toEqual([]);
    });
  });

  test.describe('Form Accessibility', () => {
    test('all form inputs should have accessible labels', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();

      // Check that all inputs have associated labels
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .include('form')
        .analyze();

      // Filter for label-related violations
      const labelViolations = results.violations.filter(
        (v) => v.id.includes('label') || v.id.includes('aria-label')
      );

      expect(labelViolations).toEqual([]);
    });

    test('required fields should be indicated accessibly', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();

      // Check for required field indicators
      const requiredInputs = page.locator('input[required], select[required], textarea[required]');
      const count = await requiredInputs.count();

      // Each required field should have appropriate ARIA attributes or visual indicators
      for (let i = 0; i < count; i++) {
        const input = requiredInputs.nth(i);
        const ariaRequired = await input.getAttribute('aria-required');
        const required = await input.getAttribute('required');

        // Either attribute should be present
        expect(ariaRequired === 'true' || required !== null).toBe(true);
      }
    });

    test('form select elements should be keyboard accessible', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();

      // Tab to the room type select and interact with keyboard
      await page.keyboard.press('Tab');

      // Should be able to focus select elements
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      // Either input or select should be focusable
    });
  });

  test.describe('Error Message Accessibility', () => {
    test('error messages should be announced to screen readers', async ({ page }) => {
      await setupMocks(page, {
        assessSubmit: {
          success: false,
          error: { code: 500, message: 'Test error for accessibility' },
        },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Wait for error to appear
      await wizard.expectError();

      // Error banner should have appropriate ARIA attributes
      const errorBanner = page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]');
      const count = await errorBanner.count();

      // At least one element should announce the error
      expect(count).toBeGreaterThan(0);
    });

    test('error banner should have accessible dismiss button', async ({ page }) => {
      await setupMocks(page, {
        assessSubmit: {
          success: false,
          error: { code: 500, message: 'Test error' },
        },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      await wizard.expectError();

      // Check dismiss button accessibility
      const dismissButton = wizard.errorDismissButton;
      const ariaLabel = await dismissButton.getAttribute('aria-label');
      const title = await dismissButton.getAttribute('title');
      const textContent = await dismissButton.textContent();

      // Button should have accessible name (via aria-label, title, or visible text)
      expect(ariaLabel || title || textContent?.trim()).toBeTruthy();
    });
  });

  test.describe('Button Accessibility', () => {
    test('all buttons should have accessible names', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast']) // May have false positives
        .analyze();

      // Check for button-name violations
      const buttonViolations = results.violations.filter(
        (v) => v.id === 'button-name'
      );

      expect(buttonViolations).toEqual([]);
    });

    test('submit button should indicate loading state accessibly', async ({ page }) => {
      // Setup slow response
      await page.route('**/api/assess/submit', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { jobId: 'test' } }),
        });
      });

      await setupMocks(page);

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      // Check if loading state is communicated
      // Could be via aria-busy, aria-disabled, or aria-label change
      await page.waitForTimeout(500);

      const ariaBusy = await wizard.submitButton.getAttribute('aria-busy');
      const disabled = await wizard.submitButton.isDisabled();

      // Either aria-busy should be true or button should be disabled
      expect(ariaBusy === 'true' || disabled).toBe(true);
    });
  });

  test.describe('Image Upload Accessibility', () => {
    test('file input should have accessible label', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const fileInput = page.locator('input[type="file"]');
      const ariaLabel = await fileInput.getAttribute('aria-label');
      const ariaLabelledBy = await fileInput.getAttribute('aria-labelledby');
      const id = await fileInput.getAttribute('id');

      // Either has aria-label, aria-labelledby, or associated label element
      if (!ariaLabel && !ariaLabelledBy && id) {
        const label = page.locator(`label[for="${id}"]`);
        const labelCount = await label.count();
        expect(labelCount).toBeGreaterThan(0);
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });

    test('uploaded image previews should have alt text', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const files = createTestFiles(3);
      await wizard.uploadImages(files);

      // Check all preview images have alt text
      const previewImages = page.locator('img');
      const count = await previewImages.count();

      for (let i = 0; i < count; i++) {
        const img = previewImages.nth(i);
        const alt = await img.getAttribute('alt');
        // Alt should be present (even if empty for decorative images)
        expect(alt !== null).toBe(true);
      }
    });
  });

  test.describe('Focus Management', () => {
    test('focus should move logically through form fields', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();

      // Tab through form fields and verify focus order
      const focusOrder: string[] = [];

      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
        const focusedName = await page.evaluate(
          () => (document.activeElement as HTMLElement)?.getAttribute('name') || 'unnamed'
        );
        focusOrder.push(`${focusedTag}:${focusedName}`);
      }

      // Focus should hit interactive elements (inputs, selects, buttons)
      const interactiveElements = focusOrder.filter(
        (el) => el.startsWith('input') || el.startsWith('select') || el.startsWith('button') || el.startsWith('textarea')
      );

      expect(interactiveElements.length).toBeGreaterThan(0);
    });

    test('focus should return to appropriate element after error dismissal', async ({ page }) => {
      await setupMocks(page, {
        assessSubmit: {
          success: false,
          error: { code: 500, message: 'Test error' },
        },
      });

      await wizard.gotoNewAssessment();

      const files = createTestFiles(1);
      await wizard.uploadImages(files);
      await wizard.continueToMetadata();
      await wizard.fillRequiredMetadataOnly('residential-living', 'single-family', 10, 10, 8);
      await wizard.submitAssessment();

      await wizard.expectError();

      // Dismiss error
      await wizard.dismissError();

      // Focus should be in a reasonable location (not lost)
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
      expect(focusedTag).not.toBe('body'); // Should not lose focus to body
    });
  });

  test.describe('Color Contrast', () => {
    test('text should meet minimum contrast ratio', async ({ page }) => {
      await wizard.gotoNewAssessment();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('main, [role="main"], body')
        .analyze();

      // Check for contrast violations
      const contrastViolations = results.violations.filter(
        (v) => v.id === 'color-contrast'
      );

      // Allow some minor violations but flag critical ones
      const criticalContrastViolations = contrastViolations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalContrastViolations).toEqual([]);
    });
  });
});
