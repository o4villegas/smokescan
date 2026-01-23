/**
 * Custom Assertion Helpers for E2E Tests
 * Domain-specific assertions for SmokeScan testing
 */

import { Page, Locator, expect } from '@playwright/test';
import type { AssessmentReport, Severity } from '../../src/react-app/types';

// ============ Report Assertions ============

/**
 * Assert that a report contains expected FDAM elements
 */
export async function assertValidReport(page: Page): Promise<void> {
  // Executive summary should be present and non-empty
  const summary = page.locator('[data-testid="executive-summary"], :text("Executive Summary") + *').first();
  await expect(summary).toBeVisible();
  const summaryText = await summary.textContent();
  expect(summaryText?.length).toBeGreaterThan(50);

  // Should have zone classification mention
  const pageContent = await page.content();
  expect(pageContent).toMatch(/burn|near-field|far-field/i);

  // Should have severity mention
  expect(pageContent).toMatch(/heavy|moderate|light|trace|none/i);

  // Should have FDAM recommendations section
  await expect(page.locator(':text("FDAM"), :text("Recommendations")').first()).toBeVisible();

  // Should have restoration priority section
  await expect(page.locator(':text("Priority"), :text("Restoration")').first()).toBeVisible();
}

/**
 * Assert report matches expected structure
 */
export function assertReportStructure(report: AssessmentReport): void {
  // Executive summary
  expect(report.executiveSummary).toBeDefined();
  expect(typeof report.executiveSummary).toBe('string');
  expect(report.executiveSummary.length).toBeGreaterThan(0);

  // Detailed assessment
  expect(report.detailedAssessment).toBeDefined();
  expect(Array.isArray(report.detailedAssessment)).toBe(true);
  expect(report.detailedAssessment.length).toBeGreaterThan(0);

  for (const section of report.detailedAssessment) {
    expect(section.area).toBeDefined();
    expect(section.findings).toBeDefined();
    expect(section.severity).toBeDefined();
    expect(['heavy', 'moderate', 'light', 'trace', 'none']).toContain(section.severity);
    expect(Array.isArray(section.recommendations)).toBe(true);
  }

  // FDAM recommendations
  expect(report.fdamRecommendations).toBeDefined();
  expect(Array.isArray(report.fdamRecommendations)).toBe(true);

  // Restoration priority
  expect(report.restorationPriority).toBeDefined();
  expect(Array.isArray(report.restorationPriority)).toBe(true);

  for (const priority of report.restorationPriority) {
    expect(priority.priority).toBeDefined();
    expect(typeof priority.priority).toBe('number');
    expect(priority.area).toBeDefined();
    expect(priority.action).toBeDefined();
  }

  // Scope indicators
  expect(report.scopeIndicators).toBeDefined();
  expect(Array.isArray(report.scopeIndicators)).toBe(true);
}

// ============ Form Assertions ============

/**
 * Assert form has validation errors displayed
 */
export async function assertFormHasErrors(page: Page, errorTexts?: string[]): Promise<void> {
  const errorElements = page.locator('[class*="error"], [class*="invalid"], [aria-invalid="true"]');
  await expect(errorElements.first()).toBeVisible();

  if (errorTexts) {
    for (const text of errorTexts) {
      await expect(page.locator(`:text("${text}")`)).toBeVisible();
    }
  }
}

/**
 * Assert form is in valid state
 */
export async function assertFormIsValid(page: Page): Promise<void> {
  const invalidFields = page.locator('[aria-invalid="true"]');
  await expect(invalidFields).toHaveCount(0);
}

/**
 * Assert required field has validation
 */
export async function assertRequiredField(input: Locator): Promise<void> {
  const required = await input.getAttribute('required');
  const ariaRequired = await input.getAttribute('aria-required');
  expect(required !== null || ariaRequired === 'true').toBe(true);
}

/**
 * Assert dimensions are calculated correctly
 */
export async function assertDimensionCalculation(
  page: Page,
  length: number,
  width: number,
  height: number
): Promise<void> {
  const expectedArea = length * width;
  const expectedVolume = expectedArea * height;

  const pageContent = await page.content();

  // Check for area display
  expect(pageContent).toContain(expectedArea.toString());

  // Check for volume display
  expect(pageContent).toContain(expectedVolume.toString());
}

// ============ API Response Assertions ============

/**
 * Assert API response has success structure
 */
export function assertSuccessResponse<T>(response: { success: boolean; data?: T }): asserts response is { success: true; data: T } {
  expect(response.success).toBe(true);
  expect(response.data).toBeDefined();
}

/**
 * Assert API response has error structure
 */
export function assertErrorResponse(response: { success: boolean; error?: { code: number; message: string } }): asserts response is { success: false; error: { code: number; message: string } } {
  expect(response.success).toBe(false);
  expect(response.error).toBeDefined();
  expect(response.error?.code).toBeDefined();
  expect(response.error?.message).toBeDefined();
}

// ============ UI State Assertions ============

/**
 * Assert wizard is on specific step
 */
export async function assertWizardStep(
  page: Page,
  step: 'upload' | 'metadata' | 'processing' | 'complete' | 'chat'
): Promise<void> {
  switch (step) {
    case 'upload':
      await expect(page.locator('input[type="file"]')).toBeVisible();
      break;
    case 'metadata':
      await expect(page.locator('select[name="roomType"], [data-testid="room-type-select"]')).toBeVisible();
      break;
    case 'processing':
      await expect(page.locator(':text("Processing"), :text("Analyzing"), [class*="spinner"]').first()).toBeVisible();
      break;
    case 'complete':
      await expect(page.locator(':text("Executive Summary"), :text("Assessment Report")').first()).toBeVisible();
      break;
    case 'chat':
      await expect(page.locator('input[placeholder*="message"], textarea[placeholder*="message"]')).toBeVisible();
      break;
  }
}

/**
 * Assert error banner is displayed with optional message check
 */
export async function assertErrorBanner(page: Page, messageContains?: string): Promise<void> {
  const errorBanner = page.locator('[data-testid="error-banner"], [class*="error"][class*="banner"], [role="alert"]').first();
  await expect(errorBanner).toBeVisible();

  if (messageContains) {
    await expect(errorBanner).toContainText(messageContains);
  }
}

/**
 * Assert no error banner is displayed
 */
export async function assertNoErrorBanner(page: Page): Promise<void> {
  const errorBanner = page.locator('[data-testid="error-banner"], [class*="error"][class*="banner"], [role="alert"]').first();
  await expect(errorBanner).not.toBeVisible();
}

/**
 * Assert loading state is active
 */
export async function assertLoading(page: Page): Promise<void> {
  const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"]').first();
  await expect(loadingIndicator).toBeVisible();
}

/**
 * Assert loading state is complete
 */
export async function assertNotLoading(page: Page): Promise<void> {
  const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"]').first();
  await expect(loadingIndicator).not.toBeVisible();
}

// ============ Chat Assertions ============

/**
 * Assert chat message is displayed
 */
export async function assertChatMessage(
  page: Page,
  role: 'user' | 'assistant',
  contentContains: string
): Promise<void> {
  const messageSelector = role === 'user'
    ? '[data-testid="user-message"], [class*="user-message"]'
    : '[data-testid="assistant-message"], [class*="assistant-message"]';

  const messages = page.locator(messageSelector);
  const count = await messages.count();

  let found = false;
  for (let i = 0; i < count; i++) {
    const text = await messages.nth(i).textContent();
    if (text?.includes(contentContains)) {
      found = true;
      break;
    }
  }

  expect(found).toBe(true);
}

/**
 * Assert chat has specific number of messages
 */
export async function assertChatMessageCount(
  page: Page,
  expectedCount: number
): Promise<void> {
  const allMessages = page.locator('[data-testid="user-message"], [data-testid="assistant-message"], [class*="message"]:not([class*="list"])');
  await expect(allMessages).toHaveCount(expectedCount);
}

// ============ Image Upload Assertions ============

/**
 * Assert images are uploaded and previewed
 */
export async function assertImagesUploaded(page: Page, count: number): Promise<void> {
  const previews = page.locator('[data-testid="image-preview"], img[alt*="preview"], img[alt*="Preview"]');
  await expect(previews).toHaveCount(count);
}

/**
 * Assert file input accepts only images
 */
export async function assertImageInputRestrictions(input: Locator): Promise<void> {
  const accept = await input.getAttribute('accept');
  expect(accept).toMatch(/image/);
}

// ============ Severity Assertions ============

/**
 * Assert severity is valid FDAM value
 */
export function assertValidSeverity(severity: string): asserts severity is Severity {
  const validSeverities: Severity[] = ['heavy', 'moderate', 'light', 'trace', 'none'];
  expect(validSeverities).toContain(severity);
}

/**
 * Assert severity ordering is correct (higher severity first)
 */
export function assertSeverityOrder(severities: Severity[]): void {
  const severityRank: Record<Severity, number> = {
    heavy: 4,
    moderate: 3,
    light: 2,
    trace: 1,
    none: 0,
  };

  for (let i = 0; i < severities.length - 1; i++) {
    expect(severityRank[severities[i]]).toBeGreaterThanOrEqual(severityRank[severities[i + 1]]);
  }
}

// ============ Navigation Assertions ============

/**
 * Assert breadcrumb navigation is correct
 */
export async function assertBreadcrumb(page: Page, expectedParts: string[]): Promise<void> {
  const breadcrumb = page.locator('[data-testid="breadcrumb"], nav[aria-label="Breadcrumb"], [class*="breadcrumb"]');
  await expect(breadcrumb).toBeVisible();

  for (const part of expectedParts) {
    await expect(breadcrumb).toContainText(part);
  }
}

/**
 * Assert current URL matches expected pattern
 */
export async function assertUrlMatches(page: Page, pattern: string | RegExp): Promise<void> {
  const url = page.url();
  if (typeof pattern === 'string') {
    expect(url).toContain(pattern);
  } else {
    expect(url).toMatch(pattern);
  }
}
