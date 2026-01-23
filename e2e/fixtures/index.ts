/**
 * E2E Test Fixtures
 * Central export for all test fixtures
 */

// Mock API
export {
  setupMocks,
  resetStatusCounter,
  getStatusCallCount,
  getMockReport,
  DEFAULT_PROJECT,
  DEFAULT_ASSESSMENT,
  type MockConfig,
  type MockAssessSubmitConfig,
  type MockAssessStatusConfig,
  type MockAssessResultConfig,
  type MockChatConfig,
  type MockProjectConfig,
  type MockAssessmentConfig,
} from './mock-api';

// Test Data
export {
  validMetadataComplete,
  validMetadataMinimal,
  roomTypeMetadata,
  invalidMetadata,
  mockProject,
  mockProjectWithoutClient,
  mockAssessmentDraft,
  mockAssessmentCompleted,
  mockAssessmentWithSession,
  sensoryObservations,
  floorLevelCases,
  chatMessages,
  calculateDimensionResults,
  testScenarios,
} from './test-data';

// Test Images
export {
  createMinimalPng,
  createTestPng,
  createTestImageSet,
  bufferToDataUrl,
  createTestFile,
  createTestFiles,
  createInvalidFile,
  uploadHelpers,
  imageDescriptions,
} from './test-images';

// Page Objects
export { AssessmentWizardPage } from './page-objects/assessment-wizard';
