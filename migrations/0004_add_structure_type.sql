-- SmokeScan D1 Migration: Add structure_type
-- Stores the building structure classification for pre-filled FDAM metadata
-- Values: 'single-family' | 'multi-family' | 'commercial' | 'industrial' | 'mixed-use'
ALTER TABLE assessments ADD COLUMN structure_type TEXT;
