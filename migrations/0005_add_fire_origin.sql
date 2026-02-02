-- Add is_fire_origin flag to identify the source location room
ALTER TABLE assessments ADD COLUMN is_fire_origin INTEGER DEFAULT 0;
