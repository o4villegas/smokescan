/**
 * AssessmentWizard Page Object
 * Encapsulates all interactions with the assessment wizard
 */

import { Page, Locator, expect } from '@playwright/test';
import type { AssessmentMetadata } from '../../../src/react-app/types';

export class AssessmentWizardPage {
  readonly page: Page;

  // ============ Image Upload Step Locators ============
  readonly dropZone: Locator;
  readonly fileInput: Locator;
  readonly imageGrid: Locator;
  readonly imagePreviews: Locator;
  readonly removeImageButtons: Locator;
  readonly continueToMetadataButton: Locator;

  // ============ Metadata Step Locators ============
  readonly roomTypeSelect: Locator;
  readonly structureTypeSelect: Locator;
  readonly lengthInput: Locator;
  readonly widthInput: Locator;
  readonly heightInput: Locator;
  readonly areaDisplay: Locator;
  readonly volumeDisplay: Locator;
  readonly floorLevelSelect: Locator;
  readonly smokeOdorCheckbox: Locator;
  readonly smokeOdorIntensitySelect: Locator;
  readonly whiteWipeSelect: Locator;
  readonly fireOriginInput: Locator;
  readonly notesTextarea: Locator;
  readonly submitButton: Locator;
  readonly backToUploadButton: Locator;

  // ============ Processing Step Locators ============
  readonly processingView: Locator;
  readonly processingSpinner: Locator;
  readonly processingSteps: Locator;
  readonly processingMessage: Locator;

  // ============ Report Step Locators ============
  readonly reportView: Locator;
  readonly executiveSummary: Locator;
  readonly detailedAssessmentSection: Locator;
  readonly fdamRecommendationsSection: Locator;
  readonly restorationPrioritySection: Locator;
  readonly processingTimeDisplay: Locator;
  readonly chatButton: Locator;
  readonly newAssessmentButton: Locator;

  // ============ Chat Step Locators ============
  readonly chatInterface: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly messageList: Locator;
  readonly userMessages: Locator;
  readonly assistantMessages: Locator;
  readonly suggestedQuestions: Locator;
  readonly backToReportButton: Locator;
  readonly chatLoadingIndicator: Locator;

  // ============ Common Locators ============
  readonly errorBanner: Locator;
  readonly errorDismissButton: Locator;
  readonly breadcrumb: Locator;
  readonly pageTitle: Locator;

  constructor(page: Page) {
    this.page = page;

    // Image Upload Step
    this.dropZone = page.locator('[data-testid="drop-zone"], .dropzone, [class*="drop"]').first();
    this.fileInput = page.locator('#file-input, input[type="file"]');
    this.imageGrid = page.locator('[data-testid="image-grid"], [class*="image-grid"], [class*="preview"]').first();
    this.imagePreviews = page.locator('img[alt^="Upload"]');
    this.removeImageButtons = page.locator('button[aria-label="Remove image"]');
    this.continueToMetadataButton = page.getByRole('button', { name: 'Continue to Details' });

    // Metadata Step (shadcn/ui Select components use Radix UI)
    this.roomTypeSelect = page.locator('#room-type');
    this.structureTypeSelect = page.locator('#structure-type');
    this.lengthInput = page.locator('#length-ft');
    this.widthInput = page.locator('#width-ft');
    this.heightInput = page.locator('#height-ft');
    this.areaDisplay = page.locator(':text("Area:")');
    this.volumeDisplay = page.locator(':text("Volume:")');
    this.floorLevelSelect = page.locator('#floor-level');
    this.smokeOdorCheckbox = page.locator('#smoke-odor-present');
    this.smokeOdorIntensitySelect = page.locator('#smoke-intensity');
    this.whiteWipeSelect = page.locator('#white-wipe');
    this.fireOriginInput = page.locator('#fire-origin');
    this.notesTextarea = page.locator('#notes');
    this.submitButton = page.getByRole('button', { name: 'Start Assessment' });
    this.backToUploadButton = page.getByRole('button', { name: 'Back' });

    // Processing Step (actual component uses "Analyzing Damage" heading)
    this.processingView = page.getByText('Analyzing Damage');
    this.processingSpinner = page.locator('svg.animate-spin');
    this.processingSteps = page.locator('[class*="space-y"]').filter({ hasText: 'Analyzing' });
    this.processingMessage = page.getByText(/Processing .* image/);

    // Report Step
    this.reportView = page.getByText('FDAM Assessment Report');
    this.executiveSummary = page.getByText('Executive Summary');
    this.detailedAssessmentSection = page.getByText('Detailed Assessment');
    this.fdamRecommendationsSection = page.getByText('FDAM Recommendations');
    this.restorationPrioritySection = page.getByText('Restoration Priority');
    this.processingTimeDisplay = page.getByText(/Generated in/);
    this.chatButton = page.getByRole('button', { name: 'Ask Follow-up Questions' });
    this.newAssessmentButton = page.getByRole('button', { name: 'New Assessment' });

    // Chat Step (actual component structure from ChatInterface.tsx)
    this.chatInterface = page.locator('form').filter({ hasText: 'Ask a question' });
    this.chatInput = page.getByPlaceholder('Ask a question about your assessment...');
    this.sendButton = page.locator('form button[type="submit"]');
    this.messageList = page.locator('[class*="space-y"]').filter({ has: page.locator('[class*="rounded-lg"]') });
    this.userMessages = page.locator('[class*="bg-primary"]').filter({ hasText: /.+/ });
    this.assistantMessages = page.locator('[class*="bg-muted"]').filter({ hasText: /.+/ });
    this.suggestedQuestions = page.locator('button').filter({ hasText: /^(What|How|Can you|Why)/ });
    this.backToReportButton = page.getByRole('button', { name: 'Back to Report' });
    this.chatLoadingIndicator = page.locator('svg.animate-spin');

    // Common (error banner uses border-destructive class, not "error")
    this.errorBanner = page.locator('[class*="border-destructive"], [class*="bg-destructive"]').first();
    this.errorDismissButton = page.locator('[class*="destructive"] button, button:has-text("×")').first();
    this.breadcrumb = page.locator('[class*="text-muted-foreground"]').filter({ hasText: 'Projects' });
    this.pageTitle = page.locator('h1, [class*="CardTitle"]').first();
  }

  // ============ Navigation Methods ============

  async goto(projectId?: string, assessmentId?: string): Promise<void> {
    const pid = projectId || 'test-proj';
    const aid = assessmentId || 'test-assess';
    await this.page.goto(`/projects/${pid}/assess/${aid}`);
    await this.page.waitForLoadState('networkidle');
  }

  async gotoNewAssessment(): Promise<void> {
    await this.page.goto('/projects/test-proj/assess/test-assess');
    await this.page.waitForLoadState('networkidle');
  }

  // ============ Image Upload Methods ============

  async uploadImages(files: Array<{ name: string; mimeType: string; buffer: Buffer }>): Promise<void> {
    await this.fileInput.setInputFiles(files);
    // Wait for previews to appear
    await this.page.waitForTimeout(500);
  }

  async uploadSingleImage(file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
    await this.uploadImages([file]);
  }

  async removeImage(index: number): Promise<void> {
    const removeButtons = await this.removeImageButtons.all();
    if (removeButtons[index]) {
      await removeButtons[index].click();
    }
  }

  async getImageCount(): Promise<number> {
    return await this.imagePreviews.count();
  }

  async continueToMetadata(): Promise<void> {
    await this.continueToMetadataButton.click();
    // Wait for metadata form to appear
    await this.roomTypeSelect.waitFor({ state: 'visible', timeout: 5000 });
  }

  // ============ Metadata Form Methods ============

  /**
   * Helper to select a value from a Radix UI Select component
   */
  private async selectRadixOption(trigger: Locator, optionLabel: string): Promise<void> {
    await trigger.click();
    await this.page.getByRole('option', { name: optionLabel }).click();
  }

  // ============ Public Select Helpers ============

  /**
   * Select a room type by its value
   */
  async selectRoomType(value: string): Promise<void> {
    await this.selectRadixOption(this.roomTypeSelect, this.getRoomTypeLabel(value));
  }

  /**
   * Select a structure type by its value
   */
  async selectStructureType(value: string): Promise<void> {
    await this.selectRadixOption(this.structureTypeSelect, this.getStructureTypeLabel(value));
  }

  /**
   * Select a floor level by its value
   */
  async selectFloorLevel(value: string): Promise<void> {
    const floorLabels: Record<string, string> = {
      'basement': 'Basement',
      'ground': 'Ground Floor',
      '1st': '1st Floor',
      '2nd': '2nd Floor',
      '3rd': '3rd Floor',
      '4th+': '4th Floor+',
      'attic': 'Attic',
    };
    await this.selectRadixOption(this.floorLevelSelect, floorLabels[value] || value);
  }

  /**
   * Select smoke odor intensity
   */
  async selectSmokeOdorIntensity(value: string): Promise<void> {
    const intensityLabels: Record<string, string> = {
      'none': 'None',
      'faint': 'Faint',
      'moderate': 'Moderate',
      'strong': 'Strong',
    };
    await this.selectRadixOption(this.smokeOdorIntensitySelect, intensityLabels[value] || value);
  }

  /**
   * Select white wipe result
   */
  async selectWhiteWipeResult(value: string): Promise<void> {
    const wipeLabels: Record<string, string> = {
      'clean': 'Clean',
      'light-deposits': 'Light Deposits',
      'moderate-deposits': 'Moderate Deposits',
      'heavy-deposits': 'Heavy Deposits',
    };
    await this.selectRadixOption(this.whiteWipeSelect, wipeLabels[value] || value);
  }

  /**
   * Map room type values to their display labels
   */
  private getRoomTypeLabel(value: string): string {
    const labels: Record<string, string> = {
      'residential-bedroom': 'Residential - Bedroom',
      'residential-living': 'Residential - Living Room',
      'residential-kitchen': 'Residential - Kitchen',
      'residential-bathroom': 'Residential - Bathroom',
      'commercial-office': 'Commercial - Office',
      'commercial-retail': 'Commercial - Retail',
      'industrial-warehouse': 'Industrial - Warehouse',
      'industrial-manufacturing': 'Industrial - Manufacturing',
      'other': 'Other',
    };
    return labels[value] || value;
  }

  /**
   * Map structure type values to their display labels
   */
  private getStructureTypeLabel(value: string): string {
    const labels: Record<string, string> = {
      'single-family': 'Single Family Home',
      'multi-family': 'Multi-Family Residence',
      'commercial': 'Commercial Building',
      'industrial': 'Industrial Facility',
      'mixed-use': 'Mixed-Use Building',
    };
    return labels[value] || value;
  }

  async fillMetadata(metadata: Partial<AssessmentMetadata>): Promise<void> {
    // Required fields (Radix UI Select)
    if (metadata.roomType) {
      await this.selectRadixOption(this.roomTypeSelect, this.getRoomTypeLabel(metadata.roomType));
    }
    if (metadata.structureType) {
      await this.selectRadixOption(this.structureTypeSelect, this.getStructureTypeLabel(metadata.structureType));
    }

    // Dimensions (required)
    if (metadata.dimensions) {
      await this.lengthInput.fill(String(metadata.dimensions.length_ft));
      await this.widthInput.fill(String(metadata.dimensions.width_ft));
      await this.heightInput.fill(String(metadata.dimensions.height_ft));
    }

    // Optional fields
    if (metadata.floor_level) {
      const floorLabels: Record<string, string> = {
        'basement': 'Basement',
        'ground': 'Ground Floor',
        '1st': '1st Floor',
        '2nd': '2nd Floor',
        '3rd': '3rd Floor',
        '4th+': '4th Floor+',
        'attic': 'Attic',
      };
      await this.selectRadixOption(this.floorLevelSelect, floorLabels[metadata.floor_level] || metadata.floor_level);
    }

    if (metadata.sensory_observations) {
      if (metadata.sensory_observations.smoke_odor_present) {
        await this.smokeOdorCheckbox.click();
        if (metadata.sensory_observations.smoke_odor_intensity) {
          const intensityLabels: Record<string, string> = {
            'none': 'None',
            'faint': 'Faint',
            'moderate': 'Moderate',
            'strong': 'Strong',
          };
          await this.selectRadixOption(
            this.smokeOdorIntensitySelect,
            intensityLabels[metadata.sensory_observations.smoke_odor_intensity] || metadata.sensory_observations.smoke_odor_intensity
          );
        }
      }
      if (metadata.sensory_observations.white_wipe_result) {
        const wipeLabels: Record<string, string> = {
          'clean': 'Clean',
          'light-deposits': 'Light Deposits',
          'moderate-deposits': 'Moderate Deposits',
          'heavy-deposits': 'Heavy Deposits',
        };
        await this.selectRadixOption(
          this.whiteWipeSelect,
          wipeLabels[metadata.sensory_observations.white_wipe_result] || metadata.sensory_observations.white_wipe_result
        );
      }
    }

    if (metadata.fireOrigin) {
      await this.fireOriginInput.fill(metadata.fireOrigin);
    }

    if (metadata.notes) {
      await this.notesTextarea.fill(metadata.notes);
    }
  }

  async fillRequiredMetadataOnly(
    roomType: string,
    structureType: string,
    length: number,
    width: number,
    height: number
  ): Promise<void> {
    await this.selectRadixOption(this.roomTypeSelect, this.getRoomTypeLabel(roomType));
    await this.selectRadixOption(this.structureTypeSelect, this.getStructureTypeLabel(structureType));
    await this.lengthInput.fill(String(length));
    await this.widthInput.fill(String(width));
    await this.heightInput.fill(String(height));
  }

  async submitAssessment(): Promise<void> {
    await this.submitButton.click();
  }

  async goBackToUpload(): Promise<void> {
    await this.backToUploadButton.click();
  }

  async isSubmitButtonEnabled(): Promise<boolean> {
    return await this.submitButton.isEnabled();
  }

  // ============ Processing Step Methods ============

  async waitForProcessing(): Promise<void> {
    // Wait for processing view to appear (shows "Analyzing Damage")
    await this.processingView.waitFor({ state: 'visible', timeout: 10000 });
  }

  async waitForCompletion(timeout: number = 30000): Promise<void> {
    // Wait for report to appear (processing complete)
    await this.reportView.waitFor({ state: 'visible', timeout });
  }

  async isProcessing(): Promise<boolean> {
    return await this.processingSpinner.isVisible();
  }

  // ============ Report Step Methods ============

  async getExecutiveSummary(): Promise<string> {
    // Get the executive summary content (the paragraph after the "Executive Summary" heading)
    const summaryCard = this.page.locator('text=Executive Summary').locator('..').locator('..').locator('p');
    return await summaryCard.first().textContent() || '';
  }

  async getProcessingTime(): Promise<string | null> {
    const timeText = await this.processingTimeDisplay.textContent();
    return timeText;
  }

  async startChat(): Promise<void> {
    await this.chatButton.click();
    await this.chatInput.waitFor({ state: 'visible', timeout: 5000 });
  }

  async finishAssessment(): Promise<void> {
    await this.newAssessmentButton.click();
  }

  // ============ Chat Methods ============

  async sendChatMessage(message: string): Promise<void> {
    await this.chatInput.fill(message);
    await this.sendButton.click();
    // Wait for response
    await this.page.waitForTimeout(500);
  }

  async clickSuggestedQuestion(index: number = 0): Promise<void> {
    const questions = await this.suggestedQuestions.all();
    if (questions[index]) {
      await questions[index].click();
    }
  }

  async getChatMessageCount(): Promise<number> {
    const userCount = await this.userMessages.count();
    const assistantCount = await this.assistantMessages.count();
    return userCount + assistantCount;
  }

  async getLastAssistantMessage(): Promise<string> {
    const messages = await this.assistantMessages.all();
    if (messages.length > 0) {
      return await messages[messages.length - 1].textContent() || '';
    }
    return '';
  }

  async backToReport(): Promise<void> {
    await this.backToReportButton.click();
  }

  async isChatLoading(): Promise<boolean> {
    return await this.chatLoadingIndicator.isVisible();
  }

  // ============ Error Handling Methods ============

  async getErrorMessage(): Promise<string | null> {
    if (await this.errorBanner.isVisible()) {
      return await this.errorBanner.textContent();
    }
    return null;
  }

  async dismissError(): Promise<void> {
    await this.errorDismissButton.click();
  }

  async hasError(): Promise<boolean> {
    return await this.errorBanner.isVisible();
  }

  // ============ Assertion Helpers ============

  async expectOnUploadStep(): Promise<void> {
    await expect(this.fileInput).toBeVisible();
  }

  async expectOnMetadataStep(): Promise<void> {
    await expect(this.roomTypeSelect).toBeVisible();
  }

  async expectOnProcessingStep(): Promise<void> {
    await expect(this.processingView).toBeVisible();
  }

  async expectOnReportStep(): Promise<void> {
    await expect(this.executiveSummary).toBeVisible();
  }

  async expectOnChatStep(): Promise<void> {
    await expect(this.chatInput).toBeVisible();
  }

  async expectError(messageContains?: string): Promise<void> {
    await expect(this.errorBanner).toBeVisible();
    if (messageContains) {
      await expect(this.errorBanner).toContainText(messageContains);
    }
  }

  async expectNoError(): Promise<void> {
    await expect(this.errorBanner).not.toBeVisible();
  }

  // ============ Complete Flow Helpers ============

  /**
   * Complete the entire wizard flow from upload to report
   */
  async completeFullFlow(
    files: Array<{ name: string; mimeType: string; buffer: Buffer }>,
    metadata: AssessmentMetadata
  ): Promise<void> {
    // Upload images
    await this.uploadImages(files);
    await this.continueToMetadata();

    // Fill metadata
    await this.fillMetadata(metadata);
    await this.submitAssessment();

    // Wait for completion
    await this.waitForCompletion();
  }
}
