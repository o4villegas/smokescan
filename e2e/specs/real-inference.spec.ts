/**
 * Real Inference Test (NOT MOCKED)
 *
 * This test runs a real RunPod inference to verify:
 * 1. Compressed images are correctly encoded
 * 2. RunPod handler can decode them
 * 3. Model generates valid assessment
 *
 * WARNING: This test incurs real GPU costs (~$0.50-1.00)
 * Only run when validating compression changes.
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';

// Increase timeout for real inference (up to 10 minutes)
test.setTimeout(600000);

test.describe('Real Inference Test', () => {
  test('should complete assessment with compressed image', async ({ page }) => {
    // Collect console logs for debugging
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[ImageUpload]') || text.includes('[API]')) {
        consoleLogs.push(text);
        console.log(`[Browser] ${text}`);
      }
    });

    console.log('[Test] Starting real inference test...');

    // Navigate to assessment wizard
    await page.goto('/projects/test-proj/assess/test-assess');
    await page.waitForSelector('text=Damage Photos');

    // Upload a test image (will be compressed by our code)
    const testImagePath = path.join(process.cwd(), 'sample_images/Kitchen/Kitchen - burn zone.jpg');
    console.log(`[Test] Uploading image: ${testImagePath}`);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Wait for compression to complete
    await expect(page.locator('text=/\\d+% smaller/')).toBeVisible({ timeout: 30000 });
    console.log('[Test] Image compressed successfully');

    // Verify compression happened
    const compressionLog = consoleLogs.find(log => log.includes('Compressed'));
    expect(compressionLog).toBeDefined();
    console.log(`[Test] ${compressionLog}`);

    // Fill in required metadata (using shadcn/ui Select components)
    // Room type select (Radix portal)
    await page.locator('#room-type').click();
    await page.getByRole('option', { name: 'Kitchen' }).click();

    // Structure type select (Radix portal)
    await page.locator('#structure-type').click();
    await page.getByRole('option', { name: 'Single Family Home' }).click();

    // Fill mandatory dimensions
    await page.locator('#length-ft').fill('12');
    await page.locator('#width-ft').fill('10');
    await page.locator('#height-ft').fill('9');

    // Submit the assessment
    console.log('[Test] Submitting assessment...');
    await page.getByRole('button', { name: 'Start Assessment' }).click();

    // Wait for processing view
    await expect(page.getByRole('heading', { name: 'Analyzing Damage' })).toBeVisible({ timeout: 10000 });
    console.log('[Test] Processing started...');

    // Wait for completion (up to 8 minutes)
    // The results page should show when done
    console.log('[Test] Waiting for inference to complete (this may take several minutes)...');
    await expect(page.getByText('Executive Summary')).toBeVisible({ timeout: 480000 });
    console.log('[Test] Assessment completed!');

    // Verify we have a valid report
    const executiveSummary = page.locator('text=Executive Summary').locator('..').locator('..');
    await expect(executiveSummary).toBeVisible();

    // Check for zone classification
    await expect(page.getByText(/Zone Classification|zone/i)).toBeVisible();

    console.log('[Test] SUCCESS - Real inference completed with compressed image!');
  });
});
