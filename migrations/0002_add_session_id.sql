-- Add session_id column to assessments table
-- This enables chat functionality on existing assessments

ALTER TABLE assessments ADD COLUMN session_id TEXT;

-- Create index for session lookups
CREATE INDEX IF NOT EXISTS idx_assessments_session ON assessments(session_id);
