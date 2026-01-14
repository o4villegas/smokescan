/**
 * SmokeScan Worker Types
 * Core type definitions for the FDAM assessment system
 */

// Result type for error handling (never throw for expected errors)
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// API Error structure
export type ApiErrorCode = 400 | 401 | 403 | 404 | 422 | 500 | 502 | 503 | 504;

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: string;
};

// FDAM Zone Classifications
export type Zone = 'burn' | 'near-field' | 'far-field';

// FDAM Project Phases
export type Phase = 'PRE' | 'PRA' | 'RESTORATION' | 'PRV';

// Surface types for sampling
export type SurfaceType =
  | 'ceiling-deck'
  | 'beam'
  | 'column'
  | 'floor'
  | 'wall'
  | 'hvac-duct'
  | 'equipment';

// Damage severity levels
export type Severity = 'heavy' | 'moderate' | 'light' | 'trace' | 'none';

// Disposition recommendations
export type Disposition = 'clean' | 'remove' | 'no-action' | 'further-assessment';

// Room/structure types
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

// Damage type vocabulary for consistent categorization
export type DamageType =
  | 'char_damage'
  | 'smoke_staining'
  | 'soot_deposit'
  | 'heat_damage'
  | 'water_damage'
  | 'structural_damage'
  | 'odor_contamination'
  | 'particulate_contamination';

// Material categories (FDAM §4.3 - affects disposition logic)
export type MaterialCategory =
  | 'non-porous'   // steel, concrete, glass, metal, CMU (cleanable)
  | 'semi-porous'  // painted drywall, sealed wood (evaluate)
  | 'porous'       // carpet, insulation, acoustic tile (often remove)
  | 'hvac';        // ductwork, interior insulation (per NADCA ACR)

// Combustion indicators (EAA Method Guide particle morphology)
export type CombustionIndicators = {
  sootVisible: boolean;
  sootPattern?: string;  // Description of aciniform soot patterns
  charVisible: boolean;
  charDescription?: string;  // Description of char particles
  ashVisible: boolean;
  ashDescription?: string;  // Description of ash residue
};

// Phase 1: Vision model structured output
export type DamageInventoryItem = {
  damageType: DamageType;
  location: string;
  severity: Severity;
  material: string;
  materialCategory?: MaterialCategory;
  notes?: string;
};

export type VisionAnalysisOutput = {
  damageInventory: DamageInventoryItem[];
  combustionIndicators?: CombustionIndicators;
  retrievalKeywords: string[];
  overallSeverity: Severity;
  zoneClassification: Zone;
  confidenceScore: number;
};

// Phase 2: RAG retrieval output
export type RAGChunk = {
  content: string;
  source: string;
  relevanceScore: number;
};

// Phase 3: Synthesis output (user-facing report)
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

// Session state for follow-up conversations
export type SessionState = {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  metadata: AssessmentMetadata;
  imageUrls: string[];
  visionAnalysis: VisionAnalysisOutput;
  ragChunks: RAGChunk[];
  report: AssessmentReport;
  conversationHistory: ConversationMessage[];
};

export type AssessmentMetadata = {
  roomType: RoomType;
  structureType: StructureType;
  fireOrigin?: string;
  notes?: string;
};

export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

// API Request/Response types
export type AssessmentRequest = {
  images: string[]; // base64 encoded images
  metadata: AssessmentMetadata;
};

export type AssessmentResponse = {
  sessionId: string;
  report: AssessmentReport;
  processingTimeMs: number;
};

export type ChatRequest = {
  sessionId: string;
  message: string;
};

export type ChatResponse = {
  sessionId: string;
  response: string;
  timestamp: string;
};

// Cloudflare Worker environment bindings
export type WorkerEnv = {
  RUNPOD_API_KEY: string;
  // Split endpoint architecture (Retrieve First, Reason Last)
  RUNPOD_RETRIEVAL_ENDPOINT_ID: string;  // Embedding + Reranking (~32GB)
  RUNPOD_ANALYSIS_ENDPOINT_ID: string;   // Vision reasoning (~40GB)
  // Cloudflare bindings
  SMOKESCAN_SESSIONS: KVNamespace;
  SMOKESCAN_DB: D1Database;
  SMOKESCAN_IMAGES: R2Bucket;
  SMOKESCAN_REPORTS: R2Bucket;
  AI: Ai;
};

// Retrieval endpoint response types
export type RetrievalChunk = {
  text: string;
  source: string;
  score: number;
  doc_type?: 'primary' | 'reference';
};

export type RetrievalResult = {
  query: string;
  chunks: RetrievalChunk[] | string; // string for formatted output
};

export type RetrievalOutput = {
  results: RetrievalResult[];
};

// ============ Database Entity Types ============

// Project entity
export type Project = {
  id: string;
  name: string;
  address: string;
  client_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

// Assessment status workflow
export type AssessmentStatus =
  | 'draft'
  | 'in-progress'
  | 'awaiting-lab'
  | 'pra-ready'
  | 'completed';

// Assessment entity
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
  created_at: string;
  updated_at: string;
};

// Image entity (R2 reference)
export type ImageRecord = {
  id: string;
  assessment_id: string;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
};

// Damage item entity
export type DamageItem = {
  id: string;
  assessment_id: string;
  damage_type: DamageType;
  location: string;
  severity: Severity;
  surface_type?: SurfaceType;
  material?: string;
  disposition?: Disposition;
  notes?: string;
  created_at: string;
};

// Lab sample entity
export type LabSampleStatus = 'pending' | 'collected' | 'submitted' | 'results-received';

export type LabSample = {
  id: string;
  assessment_id: string;
  location: string;
  sample_type: string;
  status: LabSampleStatus;
  results_json?: string;
  collected_at?: string;
  results_received_at?: string;
  created_at: string;
};

// Report entity
export type ReportRecord = {
  id: string;
  assessment_id: string;
  report_type: 'assessment' | 'cleaning-spec' | 'executive-summary';
  content_json: string;
  pdf_r2_key?: string;
  created_at: string;
};

// Restoration priority entity
export type RestorationPriority = {
  id: string;
  assessment_id: string;
  priority: number;
  area: string;
  action: string;
  rationale?: string;
  created_at: string;
};

// ============ API Input Types ============

export type CreateProjectInput = {
  name: string;
  address: string;
  client_name?: string;
  notes?: string;
};

export type CreateAssessmentInput = {
  project_id: string;
  room_type: RoomType;
  room_name?: string;
};

export type UpdateAssessmentInput = {
  status?: AssessmentStatus;
  phase?: Phase;
  zone_classification?: Zone;
  overall_severity?: Severity;
  confidence_score?: number;
  executive_summary?: string;
};

// ============ API Response Types ============

export type ProjectWithAssessments = Project & {
  assessments: Assessment[];
};

export type AssessmentWithDetails = Assessment & {
  images: ImageRecord[];
  damage_items: DamageItem[];
  lab_samples: LabSample[];
  restoration_priorities: RestorationPriority[];
};
