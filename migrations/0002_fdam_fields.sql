-- SmokeScan D1 Migration: FDAM Fields
-- Adds room dimensions, floor level, and sensory observations to assessments
-- Per FDAM v4.0.1 Section 2.2 Field Activities and AI-First design principle

-- Room dimensions (stored as JSON)
-- Example: {"length_ft":20,"width_ft":15,"height_ft":10,"area_sf":300,"volume_cf":3000}
ALTER TABLE assessments ADD COLUMN dimensions_json TEXT;

-- Floor level for building position context
-- Values: 'basement' | 'ground' | '1st' | '2nd' | '3rd' | '4th+' | 'attic'
ALTER TABLE assessments ADD COLUMN floor_level TEXT;

-- Sensory observations (non-visual inputs that cannot be determined by AI)
-- Example: {"smoke_odor_present":true,"smoke_odor_intensity":"strong","white_wipe_result":"light-deposits"}
-- NOTE: Visual observations (soot/char/ash visibility) are determined by VisionAnalysisOutput
ALTER TABLE assessments ADD COLUMN sensory_observations_json TEXT;
