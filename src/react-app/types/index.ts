/**
 * Frontend Type Definitions
 * Mirrors backend types for API communication
 */

// ============ Core Types ============

// Room and structure types
export type RoomType =
  | 'residential-bedroom'
  | 'residential-living'
  | 'residential-kitchen'
  | 'residential-bathroom'
  | 'commercial-office'
  | 'commercial-retail'
  | 'industrial-warehouse'
  | 'industrial-manufacturing'
  | 'other';

export type StructureType =
  | 'single-family'
  | 'multi-family'
  | 'commercial'
  | 'industrial'
  | 'mixed-use';

export type Severity = 'heavy' | 'moderate' | 'light' | 'trace' | 'none';
export type Zone = 'burn' | 'near-field' | 'far-field';
export type Phase = 'PRE' | 'PRA' | 'RESTORATION' | 'PRV';
export type AssessmentStatus = 'draft' | 'in-progress' | 'awaiting-lab' | 'pra-ready' | 'completed';
export type Disposition = 'clean' | 'remove' | 'no-action' | 'further-assessment';

// FDAM fields (human inputs that cannot be determined by photo analysis)
export type FloorLevel = 'basement' | 'ground' | '1st' | '2nd' | '3rd' | '4th+' | 'attic';

export type RoomDimensions = {
  length_ft: number;
  width_ft: number;
  height_ft: number;
  area_sf: number;      // length × width (auto-calculated)
  volume_cf: number;    // area × height (auto-calculated)
};

// Smoke odor intensity (matches FDAM condition scale)
export type SmokeOdorIntensity = 'none' | 'faint' | 'moderate' | 'strong';

// White wipe result (dropdown options + free text)
export type WhiteWipeResult = 'clean' | 'light-deposits' | 'moderate-deposits' | 'heavy-deposits' | string;

// Sensory observations - inputs that CANNOT be determined by photo analysis
export type SensoryObservations = {
  smoke_odor_present?: boolean;
  smoke_odor_intensity?: SmokeOdorIntensity;
  white_wipe_result?: WhiteWipeResult;
};
export type DamageType =
  | 'char_damage'
  | 'smoke_staining'
  | 'soot_deposit'
  | 'heat_damage'
  | 'water_damage'
  | 'structural_damage'
  | 'odor_contamination'
  | 'particulate_contamination';

// ============ Entity Types ============

export type Project = {
  id: string;
  name: string;
  address: string;
  client_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type Assessment = {
  id: string;
  project_id: string;
  room_type: RoomType;
  room_name?: string;
  phase: Phase;
  status: AssessmentStatus;
  zone_classification?: Zone;
  overall_severity?: Severity;
  confidence_score?: number;
  executive_summary?: string;
  // FDAM fields (human inputs)
  floor_level?: FloorLevel;
  dimensions?: RoomDimensions;
  sensory_observations?: SensoryObservations;
  created_at: string;
  updated_at: string;
};

export type ImageRecord = {
  id: string;
  assessment_id: string;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
};

export type DamageItem = {
  id: string;
  assessment_id: string;
  damage_type: DamageType;
  location: string;
  severity: Severity;
  surface_type?: string;
  material?: string;
  disposition?: Disposition;
  notes?: string;
  created_at: string;
};

export type RestorationPriority = {
  id: string;
  assessment_id: string;
  priority: number;
  area: string;
  action: string;
  rationale?: string;
  created_at: string;
};

export type ProjectWithAssessments = Project & {
  assessments: Assessment[];
};

export type AssessmentWithDetails = Assessment & {
  images: ImageRecord[];
  damage_items: DamageItem[];
  lab_samples: unknown[];
  restoration_priorities: RestorationPriority[];
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// Room dimensions input (without auto-calculated fields)
export type RoomDimensionsInput = {
  length_ft: number;
  width_ft: number;
  height_ft: number;
};

// Assessment metadata (matches backend schema)
export type AssessmentMetadata = {
  roomType: RoomType;
  structureType: StructureType;
  floor_level?: FloorLevel;
  dimensions: RoomDimensionsInput; // MANDATORY per FDAM methodology
  sensory_observations?: SensoryObservations;
  fireOrigin?: string;
  notes?: string;
};

// Assessment report structure
export type AssessmentReport = {
  executiveSummary: string;
  detailedAssessment: {
    area: string;
    findings: string;
    severity: Severity;
    recommendations: string[];
  }[];
  fdamRecommendations: string[];
  restorationPriority: {
    priority: number;
    area: string;
    action: string;
    rationale: string;
  }[];
  scopeIndicators: string[];
};

// API response types
export type AssessmentResponse = {
  sessionId: string;
  report: AssessmentReport;
  processingTimeMs: number;
};

export type ChatResponse = {
  sessionId: string;
  response: string;
  timestamp: string;
  newImageKeys?: string[]; // R2 keys for newly uploaded images
};

export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: {
    code: number;
    message: string;
    details?: unknown;
  };
};

// Application state
export type AppState = {
  step: 'upload' | 'metadata' | 'processing' | 'report' | 'chat';
  images: File[];
  imagePreviewUrls: string[];
  metadata: AssessmentMetadata | null;
  sessionId: string | null;
  report: AssessmentReport | null;
  chatHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  isLoading: boolean;
  error: string | null;
};

// Room type options for dropdown
export const ROOM_TYPE_OPTIONS: { value: RoomType; label: string }[] = [
  { value: 'residential-bedroom', label: 'Residential - Bedroom' },
  { value: 'residential-living', label: 'Residential - Living Room' },
  { value: 'residential-kitchen', label: 'Residential - Kitchen' },
  { value: 'residential-bathroom', label: 'Residential - Bathroom' },
  { value: 'commercial-office', label: 'Commercial - Office' },
  { value: 'commercial-retail', label: 'Commercial - Retail' },
  { value: 'industrial-warehouse', label: 'Industrial - Warehouse' },
  { value: 'industrial-manufacturing', label: 'Industrial - Manufacturing' },
  { value: 'other', label: 'Other' },
];

export const STRUCTURE_TYPE_OPTIONS: { value: StructureType; label: string }[] = [
  { value: 'single-family', label: 'Single Family Home' },
  { value: 'multi-family', label: 'Multi-Family Residence' },
  { value: 'commercial', label: 'Commercial Building' },
  { value: 'industrial', label: 'Industrial Facility' },
  { value: 'mixed-use', label: 'Mixed-Use Building' },
];

export const FLOOR_LEVEL_OPTIONS: { value: FloorLevel; label: string }[] = [
  { value: 'basement', label: 'Basement' },
  { value: 'ground', label: 'Ground Floor' },
  { value: '1st', label: '1st Floor' },
  { value: '2nd', label: '2nd Floor' },
  { value: '3rd', label: '3rd Floor' },
  { value: '4th+', label: '4th Floor+' },
  { value: 'attic', label: 'Attic' },
];

export const SMOKE_ODOR_INTENSITY_OPTIONS: { value: SmokeOdorIntensity; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'faint', label: 'Faint' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'strong', label: 'Strong' },
];

export const WHITE_WIPE_RESULT_OPTIONS: { value: string; label: string }[] = [
  { value: 'clean', label: 'Clean' },
  { value: 'light-deposits', label: 'Light Deposits' },
  { value: 'moderate-deposits', label: 'Moderate Deposits' },
  { value: 'heavy-deposits', label: 'Heavy Deposits' },
];
