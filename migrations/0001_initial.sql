-- SmokeScan D1 Database Schema
-- MVP v1: Projects, Assessments, Images, Damage Items

-- Projects table - top-level organization
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  client_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Assessments table - individual room/area assessments within a project
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_type TEXT NOT NULL,
  room_name TEXT,
  phase TEXT NOT NULL DEFAULT 'PRE',
  status TEXT NOT NULL DEFAULT 'draft',
  zone_classification TEXT,
  overall_severity TEXT,
  confidence_score REAL,
  executive_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Images table - references to R2-stored images
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- Damage items table - individual damage findings
CREATE TABLE IF NOT EXISTS damage_items (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  damage_type TEXT NOT NULL,
  location TEXT NOT NULL,
  severity TEXT NOT NULL,
  surface_type TEXT,
  material TEXT,
  disposition TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- Lab samples table - for PRE/PRA workflow
CREATE TABLE IF NOT EXISTS lab_samples (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  location TEXT NOT NULL,
  sample_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  results_json TEXT,
  collected_at TEXT,
  results_received_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- Reports table - generated assessment reports
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'assessment',
  content_json TEXT NOT NULL,
  pdf_r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- Restoration priorities table - prioritized action items
CREATE TABLE IF NOT EXISTS restoration_priorities (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  priority INTEGER NOT NULL,
  area TEXT NOT NULL,
  action TEXT NOT NULL,
  rationale TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_assessments_project ON assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_images_assessment ON images(assessment_id);
CREATE INDEX IF NOT EXISTS idx_damage_items_assessment ON damage_items(assessment_id);
CREATE INDEX IF NOT EXISTS idx_lab_samples_assessment ON lab_samples(assessment_id);
CREATE INDEX IF NOT EXISTS idx_reports_assessment ON reports(assessment_id);
CREATE INDEX IF NOT EXISTS idx_restoration_priorities_assessment ON restoration_priorities(assessment_id);
