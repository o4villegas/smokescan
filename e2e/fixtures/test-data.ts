/**
 * Test Data Fixtures
 * Sample data for e2e tests matching SmokeScan types
 */

import type {
  AssessmentMetadata,
  RoomType,
  StructureType,
  FloorLevel,
  SmokeOdorIntensity,
  Project,
  Assessment,
} from '../../src/react-app/types';

// ============ Valid Metadata Fixtures ============

/** Complete metadata with all optional fields filled */
export const validMetadataComplete: AssessmentMetadata = {
  roomType: 'residential-living',
  structureType: 'single-family',
  dimensions: {
    length_ft: 15,
    width_ft: 12,
    height_ft: 9,
  },
  floor_level: 'ground',
  sensory_observations: {
    smoke_odor_present: true,
    smoke_odor_intensity: 'moderate',
    white_wipe_result: 'light-deposits',
  },
  fireOrigin: 'Kitchen',
  notes: 'Assessment notes for testing purposes',
};

/** Minimal metadata with only required fields */
export const validMetadataMinimal: AssessmentMetadata = {
  roomType: 'other',
  structureType: 'commercial',
  dimensions: {
    length_ft: 10,
    width_ft: 10,
    height_ft: 8,
  },
};

/** Metadata for different room types */
export const roomTypeMetadata: Record<RoomType, AssessmentMetadata> = {
  'residential-bedroom': {
    roomType: 'residential-bedroom',
    structureType: 'single-family',
    dimensions: { length_ft: 12, width_ft: 10, height_ft: 8 },
    floor_level: '2nd',
  },
  'residential-living': {
    roomType: 'residential-living',
    structureType: 'single-family',
    dimensions: { length_ft: 18, width_ft: 14, height_ft: 9 },
    floor_level: 'ground',
  },
  'residential-kitchen': {
    roomType: 'residential-kitchen',
    structureType: 'single-family',
    dimensions: { length_ft: 12, width_ft: 12, height_ft: 9 },
    floor_level: 'ground',
  },
  'residential-bathroom': {
    roomType: 'residential-bathroom',
    structureType: 'multi-family',
    dimensions: { length_ft: 8, width_ft: 6, height_ft: 8 },
    floor_level: '1st',
  },
  'commercial-office': {
    roomType: 'commercial-office',
    structureType: 'commercial',
    dimensions: { length_ft: 20, width_ft: 15, height_ft: 10 },
    floor_level: '3rd',
  },
  'commercial-retail': {
    roomType: 'commercial-retail',
    structureType: 'commercial',
    dimensions: { length_ft: 40, width_ft: 30, height_ft: 12 },
    floor_level: 'ground',
  },
  'industrial-warehouse': {
    roomType: 'industrial-warehouse',
    structureType: 'industrial',
    dimensions: { length_ft: 100, width_ft: 80, height_ft: 25 },
    floor_level: 'ground',
  },
  'industrial-manufacturing': {
    roomType: 'industrial-manufacturing',
    structureType: 'industrial',
    dimensions: { length_ft: 150, width_ft: 100, height_ft: 30 },
    floor_level: 'ground',
  },
  other: {
    roomType: 'other',
    structureType: 'mixed-use',
    dimensions: { length_ft: 25, width_ft: 20, height_ft: 10 },
    floor_level: 'ground',
  },
};

// ============ Invalid Metadata Fixtures ============

/** Invalid metadata for testing validation */
export const invalidMetadata = {
  /** Dimensions with zero values */
  zeroDimensions: {
    roomType: 'residential-living' as RoomType,
    structureType: 'single-family' as StructureType,
    dimensions: {
      length_ft: 0,
      width_ft: 0,
      height_ft: 0,
    },
  },

  /** Dimensions with negative values */
  negativeDimensions: {
    roomType: 'residential-living' as RoomType,
    structureType: 'single-family' as StructureType,
    dimensions: {
      length_ft: -1,
      width_ft: 10,
      height_ft: 8,
    },
  },

  /** Partial dimensions (missing height) */
  partialDimensions: {
    roomType: 'residential-living' as RoomType,
    structureType: 'single-family' as StructureType,
    dimensions: {
      length_ft: 10,
      width_ft: 10,
      height_ft: 0,
    },
  },

  /** Extremely large dimensions */
  extremeDimensions: {
    roomType: 'industrial-warehouse' as RoomType,
    structureType: 'industrial' as StructureType,
    dimensions: {
      length_ft: 99999,
      width_ft: 99999,
      height_ft: 9999,
    },
  },
};

// ============ Project Fixtures ============

export const mockProject: Project = {
  id: 'test-project-123',
  name: 'Test Fire Damage Assessment',
  address: '123 Test Street, TestCity, TS 12345',
  client_name: 'Test Client',
  notes: 'Test project notes',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockProjectWithoutClient: Project = {
  id: 'test-project-456',
  name: 'Residential Fire Assessment',
  address: '456 Oak Avenue, Springfield, IL 62701',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============ Assessment Fixtures ============

export const mockAssessmentDraft: Assessment = {
  id: 'test-assessment-draft',
  project_id: 'test-project-123',
  room_type: 'residential-living',
  room_name: 'Living Room',
  phase: 'PRE',
  status: 'draft',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockAssessmentCompleted: Assessment = {
  id: 'test-assessment-completed',
  project_id: 'test-project-123',
  room_type: 'residential-kitchen',
  room_name: 'Kitchen',
  phase: 'PRE',
  status: 'completed',
  zone_classification: 'near-field',
  overall_severity: 'moderate',
  confidence_score: 0.85,
  executive_summary: 'Moderate fire damage assessment complete.',
  floor_level: 'ground',
  dimensions: {
    length_ft: 12,
    width_ft: 12,
    height_ft: 9,
    area_sf: 144,
    volume_cf: 1296,
  },
  sensory_observations: {
    smoke_odor_present: true,
    smoke_odor_intensity: 'moderate',
    white_wipe_result: 'light-deposits',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockAssessmentWithSession: Assessment = {
  ...mockAssessmentCompleted,
  id: 'test-assessment-with-session',
  // Note: session_id is stored in DB but not in the Assessment type
  // It's returned as a separate field from the API
};

// ============ Sensory Observations Fixtures ============

export const sensoryObservations = {
  /** No smoke odor detected */
  noOdor: {
    smoke_odor_present: false,
  },

  /** Faint smoke odor */
  faintOdor: {
    smoke_odor_present: true,
    smoke_odor_intensity: 'faint' as SmokeOdorIntensity,
  },

  /** Moderate smoke odor with wipe test */
  moderateWithWipe: {
    smoke_odor_present: true,
    smoke_odor_intensity: 'moderate' as SmokeOdorIntensity,
    white_wipe_result: 'moderate-deposits',
  },

  /** Strong odor, heavy deposits */
  severeContamination: {
    smoke_odor_present: true,
    smoke_odor_intensity: 'strong' as SmokeOdorIntensity,
    white_wipe_result: 'heavy-deposits',
  },

  /** Clean white wipe result */
  cleanWipe: {
    smoke_odor_present: false,
    white_wipe_result: 'clean',
  },
};

// ============ Floor Level Test Cases ============

export const floorLevelCases: { value: FloorLevel; label: string }[] = [
  { value: 'basement', label: 'Basement' },
  { value: 'ground', label: 'Ground Floor' },
  { value: '1st', label: '1st Floor' },
  { value: '2nd', label: '2nd Floor' },
  { value: '3rd', label: '3rd Floor' },
  { value: '4th+', label: '4th Floor+' },
  { value: 'attic', label: 'Attic' },
];

// ============ Chat Message Fixtures ============

export const chatMessages = {
  /** Simple follow-up question */
  simpleQuestion: 'What cleaning methods do you recommend for the ceiling?',

  /** Technical FDAM question */
  fdamQuestion: 'Can you explain the zone classification criteria used in this assessment?',

  /** Question about specific area */
  areaQuestion: 'What is the recommended approach for the upper wall sections?',

  /** Priority question */
  priorityQuestion: 'Why is the ceiling restoration prioritized over the walls?',

  /** Message with special characters */
  specialChars: 'What about the <script>alert("test")</script> area? Is it safe?',

  /** Unicode message */
  unicode: "What's the recommended approach? Fire -> Clean -> Done",

  /** Very long message */
  longMessage:
    'I have several questions about this assessment. First, can you explain why the zone classification was determined to be near-field rather than far-field? Second, what specific cleaning products would you recommend for the ceiling area? Third, how long should we expect the restoration process to take? Fourth, are there any safety precautions we should be aware of during the cleaning process? Finally, what verification methods should we use to confirm the cleaning was successful?',
};

// ============ Dimension Calculation Helpers ============

/**
 * Calculate expected area and volume for given dimensions
 */
export function calculateDimensionResults(
  length: number,
  width: number,
  height: number
): {
  area_sf: number;
  volume_cf: number;
  areaDisplay: string;
  volumeDisplay: string;
} {
  const area_sf = length * width;
  const volume_cf = area_sf * height;
  return {
    area_sf,
    volume_cf,
    areaDisplay: `${area_sf.toLocaleString()} SF`,
    volumeDisplay: `${volume_cf.toLocaleString()} CF`,
  };
}

// ============ Test Scenarios ============

/**
 * Predefined test scenarios combining metadata, project, and assessment
 */
export const testScenarios = {
  /** Basic residential assessment */
  basicResidential: {
    project: mockProject,
    assessment: mockAssessmentDraft,
    metadata: validMetadataComplete,
  },

  /** Commercial office assessment */
  commercialOffice: {
    project: {
      ...mockProject,
      name: 'Commercial Fire Assessment',
      address: '100 Business Park Drive, Suite 500',
    },
    assessment: {
      ...mockAssessmentDraft,
      room_type: 'commercial-office' as const,
      room_name: 'Executive Office',
    },
    metadata: roomTypeMetadata['commercial-office'],
  },

  /** Industrial warehouse assessment */
  industrialWarehouse: {
    project: {
      ...mockProject,
      name: 'Industrial Warehouse Fire',
      address: '2500 Industrial Blvd',
    },
    assessment: {
      ...mockAssessmentDraft,
      room_type: 'industrial-warehouse' as const,
      room_name: 'Main Storage Area',
    },
    metadata: roomTypeMetadata['industrial-warehouse'],
  },

  /** Minimal data scenario */
  minimalData: {
    project: mockProjectWithoutClient,
    assessment: {
      ...mockAssessmentDraft,
      room_name: undefined,
    },
    metadata: validMetadataMinimal,
  },
};
