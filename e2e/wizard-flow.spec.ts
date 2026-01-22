import { test, expect, type Page } from '@playwright/test';

/**
 * Mock API response for GET /api/assessments/:id (fetch existing assessment)
 */
const mockExistingAssessment = {
  success: true,
  data: {
    id: 'test-assess',
    project_id: 'test-proj',
    room_type: 'commercial-office',
    room_name: 'Test Office',
    phase: 'PRE',
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

/**
 * Mock API response for /api/assess
 */
const mockAssessmentResponse = {
  success: true,
  data: {
    sessionId: 'test-session-123',
    report: {
      executiveSummary: 'Test summary of fire damage assessment. The space shows moderate smoke damage consistent with near-field exposure.',
      detailedAssessment: [
        {
          area: 'Zone Classification',
          findings: 'Near-field zone with moderate smoke damage. Thermal indicators suggest proximity to burn zone without direct flame contact.',
          severity: 'moderate',
          recommendations: ['HEPA vacuum all surfaces', 'Clean with TSP solution', 'Verify with tape lift sampling'],
        },
        {
          area: 'Surface Assessment',
          findings: 'Non-porous surfaces show soot deposits. Porous materials may require removal.',
          severity: 'moderate',
          recommendations: ['Clean non-porous surfaces', 'Evaluate porous materials for replacement'],
        },
      ],
      fdamRecommendations: [
        'Conduct tape lift sampling per FDAM protocols',
        'Document all affected areas photographically',
        'Obtain laboratory analysis of samples',
        'Follow NADCA ACR standards for HVAC cleaning',
      ],
      restorationPriority: [
        {
          priority: 1,
          area: 'Ceiling',
          action: 'Clean',
          rationale: 'Heavy soot deposits require immediate attention per FDAM methodology',
        },
        {
          priority: 2,
          area: 'Walls',
          action: 'Clean',
          rationale: 'Moderate smoke staining on non-porous surfaces',
        },
      ],
      scopeIndicators: [
        'Visual assessment completed',
        'Zone classification assigned',
        'Disposition recommendations provided',
      ],
    },
    processingTimeMs: 5000,
  },
};

/**
 * Mock API response for /api/chat
 */
const mockChatResponse = {
  success: true,
  data: {
    sessionId: 'test-session-123',
    response: 'Based on the FDAM methodology, the recommended cleaning sequence for this near-field zone is: 1) HEPA vacuum all surfaces to remove loose particulate, 2) Apply TSP solution to non-porous surfaces, 3) Conduct verification sampling.',
    timestamp: new Date().toISOString(),
    newImageKeys: [],
  },
};

/**
 * Setup API mocks for all tests
 * Updated to use polling-based assessment endpoints
 */
async function setupMocks(page: Page) {
  // Mock /api/assess/submit - returns jobId immediately
  await page.route('**/api/assess/submit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { jobId: 'test-job-123' },
      }),
    });
  });

  // Mock /api/assess/status/:jobId - return completed immediately for fast tests
  await page.route('**/api/assess/status/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          jobId: 'test-job-123',
          status: 'completed',
        },
      }),
    });
  });

  // Mock /api/assess/result/:jobId - returns the assessment report
  await page.route('**/api/assess/result/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAssessmentResponse),
    });
  });

  // Mock /api/chat endpoint
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockChatResponse),
    });
  });

  // Mock /api/assessments/:id GET and PATCH
  await page.route('**/api/assessments/*', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else if (route.request().method() === 'GET') {
      // Return mock existing assessment (for pre-populating roomType)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockExistingAssessment),
      });
    } else {
      await route.continue();
    }
  });
}

// Helper: Create a minimal PNG buffer (1x1 transparent pixel)
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

test.describe('Assessment Wizard Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('should load wizard with combined details page', async ({ page }) => {
    await page.goto('/projects/test-proj/assess/test-assess');

    // Verify we're on the combined details page
    await expect(page.getByText('Assessment Details')).toBeVisible();
    // Both form fields and image upload should be visible
    await expect(page.locator('#file-input')).toBeAttached();
    await expect(page.locator('#room-type')).toBeVisible();
    await expect(page.locator('#length-ft')).toBeVisible();
  });

  test('should show Start Assessment button disabled when no images or dimensions', async ({ page }) => {
    await page.goto('/projects/test-proj/assess/test-assess');

    // Button should be disabled initially (no images, no dimensions)
    const submitButton = page.getByRole('button', { name: 'Start Assessment' });
    await expect(submitButton).toBeDisabled();

    // Add an image - still disabled (no dimensions)
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });
    await expect(submitButton).toBeDisabled();

    // Fill dimensions - should enable
    await page.locator('#length-ft').fill('20');
    await page.locator('#width-ft').fill('15');
    await page.locator('#height-ft').fill('10');
    await expect(submitButton).toBeEnabled();
  });

  test('should show image preview after upload', async ({ page }) => {
    await page.goto('/projects/test-proj/assess/test-assess');

    // Upload a test image
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    // Verify preview appears
    await expect(page.locator('img[alt="Upload 1"]')).toBeVisible();
  });

  test('should pre-populate room type from existing assessment (project flow)', async ({ page }) => {
    await page.goto('/projects/test-proj/assess/test-assess');

    // Wait for the page to load and fetch assessment data
    await expect(page.getByText('Assessment Details')).toBeVisible();

    // Verify room type is pre-populated with 'commercial-office' from mock
    // The select trigger should show "Commercial - Office" text
    const roomTypeSelect = page.locator('#room-type');
    await expect(roomTypeSelect).toContainText('Commercial - Office');
  });

  test('should fill form and submit assessment', async ({ page }) => {
    await page.goto('/projects/test-proj/assess/test-assess');

    // Upload image
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    // Room type select (Radix portal)
    await page.locator('#room-type').click();
    await page.getByRole('option', { name: 'Commercial - Office' }).click();

    // Structure type select (Radix portal)
    await page.locator('#structure-type').click();
    await page.getByRole('option', { name: 'Commercial Building' }).click();

    // Fill mandatory dimensions
    await page.locator('#length-ft').fill('20');
    await page.locator('#width-ft').fill('15');
    await page.locator('#height-ft').fill('10');

    // Fill optional fields
    await page.locator('#fire-origin').fill('Electrical panel');
    await page.locator('#notes').fill('Test assessment notes');

    // Submit
    await page.getByRole('button', { name: 'Start Assessment' }).click();

    // Verify processing view appears briefly, then report
    // Note: With mocked API, this should be nearly instant
    await expect(page.getByText('FDAM Assessment Report')).toBeVisible({ timeout: 10000 });
  });

  test('should display all report sections after assessment', async ({ page }) => {
    await page.goto('/projects/test-proj/assess/test-assess');

    // Upload image
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    // Fill mandatory dimensions
    await page.locator('#length-ft').fill('20');
    await page.locator('#width-ft').fill('15');
    await page.locator('#height-ft').fill('10');

    await page.getByRole('button', { name: 'Start Assessment' }).click();

    // Wait for report
    await expect(page.getByText('FDAM Assessment Report')).toBeVisible({ timeout: 10000 });

    // Verify all 5 sections are present
    await expect(page.getByText('Executive Summary')).toBeVisible();
    await expect(page.getByText('Detailed Assessment')).toBeVisible();
    await expect(page.getByText('FDAM Recommendations')).toBeVisible();
    await expect(page.getByText('Restoration Priority Matrix')).toBeVisible();
    await expect(page.getByText('Scope Indicators')).toBeVisible();

    // Verify some content from mock data
    await expect(page.getByText('Test summary of fire damage assessment')).toBeVisible();
    // Use heading role to avoid matching scope indicator badge
    await expect(page.getByRole('heading', { name: 'Zone Classification' })).toBeVisible();
    await expect(page.getByText('HEPA vacuum all surfaces')).toBeVisible();
  });

  test('should open chat interface when clicking follow-up questions', async ({ page }) => {
    await page.goto('/projects/test-proj/assess/test-assess');

    // Complete assessment flow
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    // Fill mandatory dimensions
    await page.locator('#length-ft').fill('20');
    await page.locator('#width-ft').fill('15');
    await page.locator('#height-ft').fill('10');

    await page.getByRole('button', { name: 'Start Assessment' }).click();
    await expect(page.getByText('FDAM Assessment Report')).toBeVisible({ timeout: 10000 });

    // Click chat button
    await page.getByRole('button', { name: 'Ask Follow-up Questions' }).click();

    // Verify chat interface is visible
    await expect(page.getByText('Follow-up Questions')).toBeVisible();
    await expect(page.getByPlaceholder(/Ask a question/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Report' })).toBeVisible();
  });

  test('should send chat message and receive response', async ({ page }) => {
    await page.goto('/projects/test-proj/assess/test-assess');

    // Complete assessment flow
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    // Fill mandatory dimensions
    await page.locator('#length-ft').fill('20');
    await page.locator('#width-ft').fill('15');
    await page.locator('#height-ft').fill('10');

    await page.getByRole('button', { name: 'Start Assessment' }).click();
    await expect(page.getByText('FDAM Assessment Report')).toBeVisible({ timeout: 10000 });

    // Open chat
    await page.getByRole('button', { name: 'Ask Follow-up Questions' }).click();
    await expect(page.getByText('Follow-up Questions')).toBeVisible();

    // Type and send message
    const chatInput = page.getByPlaceholder(/Ask a question/);
    await chatInput.fill('What cleaning methods are recommended?');
    // Submit button has no text label, just Send icon - use type="submit" selector
    await page.locator('button[type="submit"]').click();

    // Verify response appears (from mock)
    await expect(page.getByText(/FDAM methodology/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/HEPA vacuum/)).toBeVisible();
  });

  test('should navigate back to report from chat', async ({ page }) => {
    await page.goto('/projects/test-proj/assess/test-assess');

    // Complete assessment flow
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    // Fill mandatory dimensions
    await page.locator('#length-ft').fill('20');
    await page.locator('#width-ft').fill('15');
    await page.locator('#height-ft').fill('10');

    await page.getByRole('button', { name: 'Start Assessment' }).click();
    await expect(page.getByText('FDAM Assessment Report')).toBeVisible({ timeout: 10000 });

    // Open chat
    await page.getByRole('button', { name: 'Ask Follow-up Questions' }).click();
    await expect(page.getByText('Follow-up Questions')).toBeVisible();

    // Click back button
    await page.getByRole('button', { name: 'Back to Report' }).click();

    // Verify report is visible again
    await expect(page.getByText('FDAM Assessment Report')).toBeVisible();
    await expect(page.getByText('Executive Summary')).toBeVisible();
  });
});
