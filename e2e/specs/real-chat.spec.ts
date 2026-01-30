/**
 * Production Chat E2E Tests (NOT MOCKED)
 *
 * Tests chat functionality against the deployed production Worker
 * with real RunPod inference. No mocks — all KV/R2/D1/RunPod calls are real.
 *
 * WARNING: This test incurs real GPU costs (~$1.50-2.50 per run)
 * Only run when validating chat behavior end-to-end.
 *
 * Run: npx playwright test --project=production
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { AssessmentWizardPage } from '../fixtures/page-objects/assessment-wizard';
import * as path from 'path';

test.describe('Production Chat E2E', () => {
  // Serial execution: all tests share beforeAll browser context
  // 5-minute default per chat test (RunPod two-pass generation)
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  let page: Page;
  let wizard: AssessmentWizardPage;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // 10-minute timeout for the wizard flow (real RunPod inference)
    test.setTimeout(600_000);

    context = await browser.newContext();
    page = await context.newPage();
    wizard = new AssessmentWizardPage(page);

    // Collect console logs for debugging
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[ImageUpload]') || text.includes('[API]') || text.includes('[Chat]')) {
        console.log(`[Browser] ${text}`);
      }
    });

    console.log('[Test] Starting production chat E2E...');

    // Navigate to wizard on production
    await page.goto('/projects/test-proj/assess/test-assess');
    await page.waitForSelector('text=Damage Photos');

    // Upload a real sample image
    const testImagePath = path.join(process.cwd(), 'sample_images/Kitchen/Kitchen - burn zone.jpg');
    console.log(`[Test] Uploading image: ${testImagePath}`);
    await wizard.fileInput.setInputFiles(testImagePath);

    // Wait for compression
    await expect(page.locator('text=/\\d+% smaller/')).toBeVisible({ timeout: 30000 });
    console.log('[Test] Image compressed successfully');

    // Fill metadata
    await page.locator('#room-type').click();
    await page.getByRole('option', { name: 'Kitchen' }).click();
    await page.locator('#structure-type').click();
    await page.getByRole('option', { name: 'Single Family Home' }).click();
    await page.locator('#length-ft').fill('12');
    await page.locator('#width-ft').fill('10');
    await page.locator('#height-ft').fill('9');

    // Submit and wait for completion (up to 8 min)
    console.log('[Test] Submitting assessment...');
    await page.getByRole('button', { name: 'Start Assessment' }).click();
    await expect(page.getByRole('heading', { name: 'Analyzing Damage' })).toBeVisible({ timeout: 10000 });
    console.log('[Test] Processing started, waiting for inference...');

    await expect(page.getByText('Executive Summary')).toBeVisible({ timeout: 480000 });
    console.log('[Test] Assessment completed! Entering chat...');

    // Enter chat
    await wizard.startChat();
    await wizard.expectOnChatStep();

    console.log('[Test] Chat ready. Running tests...');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('chat UI elements are visible on entry', async () => {
    await expect(wizard.chatInput).toBeVisible();
    await expect(wizard.sendButton).toBeVisible();

    // Suggested questions visible before first message (messages.length === 0)
    // The page object locator uses /^(What|How|Can you|Why)/ which misses "Explain..."
    // Match all 4 by looking for buttons near the "Suggested questions:" text
    const suggestedSection = page.locator('text=Suggested questions:').locator('..');
    const suggestedButtons = suggestedSection.locator('button');
    await expect(suggestedButtons.first()).toBeVisible();
    const suggestedCount = await suggestedButtons.count();
    expect(suggestedCount).toBe(4);
  });

  test('free-form question returns FDAM-relevant response', async () => {
    await expect(wizard.chatInput).toBeEnabled({ timeout: 5000 });

    // Specific locator for assistant chat bubbles: left-aligned bg-muted with actual text content.
    // Excludes: suggested question buttons (bg-muted/50), loading indicator (only has dots).
    const assistantBubbles = page.locator('.justify-start > .bg-muted').filter({ hasText: /.{20,}/ });
    const prevCount = await assistantBubbles.count();

    await wizard.sendChatMessage('What are the most critical areas to address first?');

    // Wait for assistant response (real RunPod)
    await expect(async () => {
      const currentCount = await assistantBubbles.count();
      expect(currentCount).toBeGreaterThan(prevCount);
    }).toPass({ timeout: 300000 });

    const response = await wizard.getLastAssistantMessage();
    expect(response.length).toBeGreaterThan(50);

    // Response must reference at least one FDAM domain term
    const fdamTerms = /zone|clean|sampl|restor|HEPA|vacuum|soot|damage|contamin|FDAM|ceiling|wall/i;
    expect(response).toMatch(fdamTerms);

    console.log(`[Test] Got FDAM response (${response.length} chars)`);
  });

  test('chat response renders as formatted markdown', async () => {
    const lastMsg = wizard.assistantMessages.last();

    // Should have HTML formatting elements (not raw markdown)
    const formattedElements = await lastMsg.locator('strong, ul, ol, li, h1, h2, h3, h4, p, em').count();
    expect(formattedElements).toBeGreaterThan(0);

    // Should NOT show raw markdown syntax
    const rawText = await lastMsg.textContent() || '';
    expect(rawText).not.toMatch(/\*\*[A-Z]/); // No raw **Bold
    expect(rawText).not.toMatch(/^##\s/m);     // No raw ## Heading
  });

  test('each suggested question topic gets a relevant response', async () => {
    // 3 sequential chat calls × ~3 min each = ~9 min worst case
    test.setTimeout(600_000);
    // Suggested questions disappear after first message (ChatInterface.tsx:67).
    // Clicking one fills input but doesn't send (line 79).
    // Since we already sent a message, type them directly.
    const questions = [
      {
        text: 'What sampling should be done according to FDAM?',
        pattern: /sampl|wipe|tape|protocol|FDAM|test|analys/i,
      },
      {
        text: 'Explain the zone classification in more detail.',
        pattern: /zone|burn|near.?field|far.?field|classif|thermal/i,
      },
      {
        text: 'What cleaning methods are recommended?',
        pattern: /clean|HEPA|vacuum|wash|method|restor|wipe|sponge/i,
      },
    ];

    for (const { text, pattern } of questions) {
      // Wait for input to be enabled (previous response complete)
      await expect(wizard.chatInput).toBeEnabled({ timeout: 300000 });

      const prevCount = await wizard.assistantMessages.count();
      console.log(`[Test] Sending: "${text}"`);
      await wizard.sendChatMessage(text);

      // Wait for a NEW assistant response (count increases)
      await expect(async () => {
        const currentCount = await wizard.assistantMessages.count();
        expect(currentCount).toBeGreaterThan(prevCount);
      }).toPass({ timeout: 300000 });

      const response = await wizard.getLastAssistantMessage();
      expect(response.length).toBeGreaterThan(50);
      expect(response).toMatch(pattern);

      console.log(`[Test] Got topic-relevant response (${response.length} chars)`);
    }
  });

  test('conversation maintains context across turns', async () => {
    // Extract a term from the last response to reference
    const priorResponse = await wizard.getLastAssistantMessage();
    const match = priorResponse.match(/\b(HEPA|zone|sampling|cleaning|soot|contamination|ceiling|restoration)\b/i);
    const referenceTerm = match ? match[0] : 'cleaning';

    console.log(`[Test] Referencing prior term: "${referenceTerm}"`);
    await expect(wizard.chatInput).toBeEnabled({ timeout: 300000 });
    const prevCount = await wizard.assistantMessages.count();

    await wizard.sendChatMessage(`Can you elaborate on the ${referenceTerm} you just mentioned?`);

    // Wait for new response
    await expect(async () => {
      const currentCount = await wizard.assistantMessages.count();
      expect(currentCount).toBeGreaterThan(prevCount);
    }).toPass({ timeout: 300000 });

    const followUp = await wizard.getLastAssistantMessage();
    expect(followUp.length).toBeGreaterThan(50);

    // Response should reference the term, showing context awareness
    expect(followUp.toLowerCase()).toContain(referenceTerm.toLowerCase());

    console.log(`[Test] Context maintained - response references "${referenceTerm}"`);
  });
});
