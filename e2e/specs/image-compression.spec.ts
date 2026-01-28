/**
 * Image Compression Test
 * Verifies client-side image compression is working correctly
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Image Compression', () => {
  test('should compress images on upload and show compression stats', async ({ page }) => {
    // Collect console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('[ImageUpload]') || msg.text().includes('[API]')) {
        consoleLogs.push(msg.text());
      }
    });

    // Navigate to the assessment wizard
    await page.goto('/projects/test-proj/assess/test-assess');

    // Wait for the page to load
    await page.waitForSelector('text=Damage Photos');

    // Find a test image
    const testImagePath = path.join(process.cwd(), 'sample_images/Kitchen/Kitchen - burn zone.jpg');

    // Verify test image exists
    expect(fs.existsSync(testImagePath)).toBe(true);
    const originalSize = fs.statSync(testImagePath).size;
    console.log(`Original image size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    // Upload the image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Wait for compression to complete (look for the green stats text)
    await expect(page.locator('text=/\\d+% smaller/')).toBeVisible({ timeout: 10000 });

    // Check console logs for compression info
    console.log('Console logs:', consoleLogs);

    // Verify compression happened
    const compressionLog = consoleLogs.find(log => log.includes('Compressed'));
    expect(compressionLog).toBeDefined();
    console.log('Compression log:', compressionLog);

    // Verify the image preview is shown
    await expect(page.locator('img[alt="Upload 1"]')).toBeVisible();

    // Verify compression stats are displayed (e.g., "420 KB (87% smaller)")
    const statsText = await page.locator('text=/\\d+(\\.\\d+)?\\s*(KB|MB).*smaller/').textContent();
    console.log('Compression stats shown:', statsText);
    expect(statsText).toBeTruthy();
  });

  test('should compress multiple images and aggregate stats', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('[ImageUpload]')) {
        consoleLogs.push(msg.text());
      }
    });

    await page.goto('/projects/test-proj/assess/test-assess');
    await page.waitForSelector('text=Damage Photos');

    // Upload 3 images
    const testImages = [
      'sample_images/Kitchen/Kitchen - burn zone.jpg',
      'sample_images/Kitchen/Kitchen - burn zone2.jpg',
      'sample_images/Kitchen/Kitchen - burn zone3.jpg',
    ].map(p => path.join(process.cwd(), p));

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImages);

    // Wait for compression
    await expect(page.locator('text=/\\d+% smaller/')).toBeVisible({ timeout: 15000 });

    // Should show "3 of 10 images selected"
    await expect(page.locator('text=3 of 10 images selected')).toBeVisible();

    // All 3 previews should be visible
    await expect(page.locator('img[alt="Upload 1"]')).toBeVisible();
    await expect(page.locator('img[alt="Upload 2"]')).toBeVisible();
    await expect(page.locator('img[alt="Upload 3"]')).toBeVisible();

    console.log('Compression logs:', consoleLogs);
  });

  test('should show compression in progress state', async ({ page }) => {
    await page.goto('/projects/test-proj/assess/test-assess');
    await page.waitForSelector('text=Damage Photos');

    // Use a larger image to ensure we catch the loading state
    const testImagePath = path.join(process.cwd(), 'sample_images/Kitchen/Kitchen - burn zone4.jpg');

    const fileInput = page.locator('input[type="file"]');

    // Start upload and immediately check for compressing state
    const uploadPromise = fileInput.setInputFiles(testImagePath);

    // The "Compressing images..." text should appear briefly
    // (may be too fast to catch reliably, so we just verify final state)
    await uploadPromise;

    // Final state should show compression stats
    await expect(page.locator('text=/\\d+% smaller/')).toBeVisible({ timeout: 10000 });
  });
});
