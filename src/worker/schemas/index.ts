/**
 * SmokeScan Zod Schemas
 * Runtime validation for API contracts
 */

import { z } from 'zod';

// Room and structure type enums
export const RoomTypeSchema = z.enum([
  'residential-bedroom',
  'residential-living',
  'residential-kitchen',
  'residential-bathroom',
  'commercial-office',
  'commercial-retail',
  'industrial-warehouse',
  'industrial-manufacturing',
  'other',
]);

export const StructureTypeSchema = z.enum([
  'single-family',
  'multi-family',
  'commercial',
  'industrial',
  'mixed-use',
]);

// Assessment metadata schema
export const AssessmentMetadataSchema = z.object({
  roomType: RoomTypeSchema,
  structureType: StructureTypeSchema,
  fireOrigin: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

// Base64 image validation (basic check)
const Base64ImageSchema = z.string().refine(
  (val) => {
    // Check if it's a valid base64 data URL or raw base64
    return (
      val.startsWith('data:image/') ||
      /^[A-Za-z0-9+/]+=*$/.test(val.slice(0, 100))
    );
  },
  { message: 'Invalid base64 image format' }
);

// Assessment request schema
export const AssessmentRequestSchema = z.object({
  images: z
    .array(Base64ImageSchema)
    .min(1, 'At least one image is required')
    .max(10, 'Maximum 10 images allowed'),
  metadata: AssessmentMetadataSchema,
});

export type AssessmentRequestInput = z.infer<typeof AssessmentRequestSchema>;

// Chat request schema
export const ChatRequestSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  message: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
});

export type ChatRequestInput = z.infer<typeof ChatRequestSchema>;

// Vision model output schema (for parsing LLM response)
export const SeveritySchema = z.enum(['heavy', 'moderate', 'light', 'trace', 'none']);

export const ZoneSchema = z.enum(['burn', 'near-field', 'far-field']);

export const DamageTypeSchema = z.enum([
  'char_damage',
  'smoke_staining',
  'soot_deposit',
  'heat_damage',
  'water_damage',
  'structural_damage',
  'odor_contamination',
  'particulate_contamination',
]);

export const MaterialCategorySchema = z.enum([
  'non-porous',
  'semi-porous',
  'porous',
  'hvac',
]);

export const DamageInventoryItemSchema = z.object({
  damageType: DamageTypeSchema,
  location: z.string(),
  severity: SeveritySchema,
  material: z.string(),
  materialCategory: MaterialCategorySchema.optional(), // Optional for backward compatibility
  notes: z.string().optional(),
});

export const CombustionIndicatorsSchema = z.object({
  sootVisible: z.boolean(),
  sootPattern: z.string().optional(),
  charVisible: z.boolean(),
  charDescription: z.string().optional(),
  ashVisible: z.boolean(),
  ashDescription: z.string().optional(),
});

export const VisionAnalysisOutputSchema = z.object({
  damageInventory: z.array(DamageInventoryItemSchema),
  combustionIndicators: CombustionIndicatorsSchema.optional(), // Optional for backward compatibility
  retrievalKeywords: z.array(z.string()).min(3).max(15),
  overallSeverity: SeveritySchema,
  zoneClassification: ZoneSchema,
  confidenceScore: z.number().min(0).max(1),
});

export type VisionAnalysisOutputInput = z.infer<typeof VisionAnalysisOutputSchema>;
