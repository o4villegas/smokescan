/**
 * Database Service
 * D1 database operations for SmokeScan
 */

import type {
  Result,
  ApiError,
  Project,
  Assessment,
  ImageRecord,
  DamageItem,
  LabSample,
  ReportRecord,
  RestorationPriority,
  CreateProjectInput,
  CreateAssessmentInput,
  UpdateAssessmentInput,
  ProjectWithAssessments,
  AssessmentWithDetails,
  AssessmentReport,
  DamageType,
  Severity,
  SurfaceType,
  Disposition,
} from '../types';

// Raw database row type (JSON fields are strings)
// structure_type is stored directly (not JSON), so it's inherited from Assessment
type AssessmentRow = Omit<Assessment, 'dimensions' | 'sensory_observations'> & {
  dimensions_json: string | null;
  sensory_observations_json: string | null;
};

// Helper to parse assessment from database row
function parseAssessmentRow(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    project_id: row.project_id,
    room_type: row.room_type,
    room_name: row.room_name,
    phase: row.phase,
    status: row.status,
    zone_classification: row.zone_classification,
    overall_severity: row.overall_severity,
    confidence_score: row.confidence_score,
    executive_summary: row.executive_summary,
    session_id: row.session_id,
    structure_type: row.structure_type,
    floor_level: row.floor_level,
    dimensions: row.dimensions_json ? JSON.parse(row.dimensions_json) : undefined,
    sensory_observations: row.sensory_observations_json ? JSON.parse(row.sensory_observations_json) : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Generate UUID for new records
function generateId(): string {
  return crypto.randomUUID();
}

export class DatabaseService {
  constructor(private db: D1Database) {}

  // ============ Projects ============

  async createProject(input: CreateProjectInput): Promise<Result<Project, ApiError>> {
    try {
      const id = generateId();
      const now = new Date().toISOString();

      await this.db
        .prepare(
          `INSERT INTO projects (id, name, address, client_name, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, input.name, input.address, input.client_name ?? null, input.notes ?? null, now, now)
        .run();

      const project: Project = {
        id,
        name: input.name,
        address: input.address,
        client_name: input.client_name,
        notes: input.notes,
        created_at: now,
        updated_at: now,
      };

      return { success: true, data: project };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to create project', details: String(e) },
      };
    }
  }

  async getProject(id: string): Promise<Result<Project, ApiError>> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM projects WHERE id = ?')
        .bind(id)
        .first<Project>();

      if (!result) {
        return { success: false, error: { code: 404, message: 'Project not found' } };
      }

      return { success: true, data: result };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to get project', details: String(e) },
      };
    }
  }

  async listProjects(): Promise<Result<Project[], ApiError>> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM projects ORDER BY updated_at DESC')
        .all<Project>();

      return { success: true, data: result.results };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to list projects', details: String(e) },
      };
    }
  }

  async getProjectWithAssessments(id: string): Promise<Result<ProjectWithAssessments, ApiError>> {
    try {
      const project = await this.db
        .prepare('SELECT * FROM projects WHERE id = ?')
        .bind(id)
        .first<Project>();

      if (!project) {
        return { success: false, error: { code: 404, message: 'Project not found' } };
      }

      const assessmentRows = await this.db
        .prepare('SELECT * FROM assessments WHERE project_id = ? ORDER BY created_at DESC')
        .bind(id)
        .all<AssessmentRow>();

      const assessments = assessmentRows.results.map(parseAssessmentRow);

      return {
        success: true,
        data: { ...project, assessments },
      };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to get project with assessments', details: String(e) },
      };
    }
  }

  async deleteProject(id: string): Promise<Result<void, ApiError>> {
    try {
      await this.db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
      return { success: true, data: undefined };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to delete project', details: String(e) },
      };
    }
  }

  // ============ Assessments ============

  async createAssessment(input: CreateAssessmentInput): Promise<Result<Assessment, ApiError>> {
    try {
      const id = generateId();
      const now = new Date().toISOString();

      // Serialize JSON fields
      const dimensionsJson = input.dimensions ? JSON.stringify(input.dimensions) : null;
      const sensoryObservationsJson = input.sensory_observations ? JSON.stringify(input.sensory_observations) : null;

      await this.db
        .prepare(
          `INSERT INTO assessments (id, project_id, room_type, room_name, structure_type, floor_level, dimensions_json, sensory_observations_json, phase, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PRE', 'draft', ?, ?)`
        )
        .bind(
          id,
          input.project_id,
          input.room_type,
          input.room_name ?? null,
          input.structure_type ?? null,
          input.floor_level ?? null,
          dimensionsJson,
          sensoryObservationsJson,
          now,
          now
        )
        .run();

      const assessment: Assessment = {
        id,
        project_id: input.project_id,
        room_type: input.room_type,
        room_name: input.room_name,
        phase: 'PRE',
        status: 'draft',
        structure_type: input.structure_type,
        floor_level: input.floor_level,
        dimensions: input.dimensions,
        sensory_observations: input.sensory_observations,
        created_at: now,
        updated_at: now,
      };

      return { success: true, data: assessment };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to create assessment', details: String(e) },
      };
    }
  }

  async getAssessment(id: string): Promise<Result<Assessment, ApiError>> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM assessments WHERE id = ?')
        .bind(id)
        .first<AssessmentRow>();

      if (!result) {
        return { success: false, error: { code: 404, message: 'Assessment not found' } };
      }

      return { success: true, data: parseAssessmentRow(result) };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to get assessment', details: String(e) },
      };
    }
  }

  async getAssessmentWithDetails(id: string): Promise<Result<AssessmentWithDetails, ApiError>> {
    try {
      const assessmentRow = await this.db
        .prepare('SELECT * FROM assessments WHERE id = ?')
        .bind(id)
        .first<AssessmentRow>();

      if (!assessmentRow) {
        return { success: false, error: { code: 404, message: 'Assessment not found' } };
      }

      const assessment = parseAssessmentRow(assessmentRow);

      const [images, damageItems, labSamples, priorities, reports] = await Promise.all([
        this.db.prepare('SELECT * FROM images WHERE assessment_id = ?').bind(id).all<ImageRecord>(),
        this.db.prepare('SELECT * FROM damage_items WHERE assessment_id = ?').bind(id).all<DamageItem>(),
        this.db.prepare('SELECT * FROM lab_samples WHERE assessment_id = ?').bind(id).all<LabSample>(),
        this.db.prepare('SELECT * FROM restoration_priorities WHERE assessment_id = ? ORDER BY priority').bind(id).all<RestorationPriority>(),
        this.db.prepare("SELECT * FROM reports WHERE assessment_id = ? AND report_type = 'assessment' ORDER BY created_at DESC LIMIT 1").bind(id).all<ReportRecord>(),
      ]);

      // Parse report JSON if available
      let report: AssessmentReport | undefined;
      const reportRecord = reports.results[0];
      if (reportRecord?.content_json) {
        try {
          report = JSON.parse(reportRecord.content_json) as AssessmentReport;
        } catch {
          // Ignore parse errors — report will be undefined
        }
      }

      return {
        success: true,
        data: {
          ...assessment,
          images: images.results,
          damage_items: damageItems.results,
          lab_samples: labSamples.results,
          restoration_priorities: priorities.results,
          report,
        },
      };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to get assessment with details', details: String(e) },
      };
    }
  }

  async updateAssessment(id: string, input: UpdateAssessmentInput): Promise<Result<Assessment, ApiError>> {
    try {
      const now = new Date().toISOString();
      const updates: string[] = ['updated_at = ?'];
      const values: (string | number | null)[] = [now];

      if (input.status !== undefined) {
        updates.push('status = ?');
        values.push(input.status);
      }
      if (input.phase !== undefined) {
        updates.push('phase = ?');
        values.push(input.phase);
      }
      if (input.zone_classification !== undefined) {
        updates.push('zone_classification = ?');
        values.push(input.zone_classification);
      }
      if (input.overall_severity !== undefined) {
        updates.push('overall_severity = ?');
        values.push(input.overall_severity);
      }
      if (input.confidence_score !== undefined) {
        updates.push('confidence_score = ?');
        values.push(input.confidence_score);
      }
      if (input.executive_summary !== undefined) {
        updates.push('executive_summary = ?');
        values.push(input.executive_summary);
      }
      if (input.session_id !== undefined) {
        updates.push('session_id = ?');
        values.push(input.session_id);
      }
      // FDAM fields
      if (input.structure_type !== undefined) {
        updates.push('structure_type = ?');
        values.push(input.structure_type);
      }
      if (input.floor_level !== undefined) {
        updates.push('floor_level = ?');
        values.push(input.floor_level);
      }
      if (input.dimensions !== undefined) {
        updates.push('dimensions_json = ?');
        values.push(JSON.stringify(input.dimensions));
      }
      if (input.sensory_observations !== undefined) {
        updates.push('sensory_observations_json = ?');
        values.push(JSON.stringify(input.sensory_observations));
      }

      values.push(id);

      await this.db
        .prepare(`UPDATE assessments SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      return this.getAssessment(id);
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to update assessment', details: String(e) },
      };
    }
  }

  async deleteAssessment(id: string): Promise<Result<void, ApiError>> {
    try {
      await this.db.prepare('DELETE FROM assessments WHERE id = ?').bind(id).run();
      return { success: true, data: undefined };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to delete assessment', details: String(e) },
      };
    }
  }

  // ============ Images ============

  async createImageRecord(
    assessmentId: string,
    r2Key: string,
    filename: string,
    contentType: string,
    sizeBytes: number
  ): Promise<Result<ImageRecord, ApiError>> {
    try {
      const id = generateId();
      const now = new Date().toISOString();

      await this.db
        .prepare(
          `INSERT INTO images (id, assessment_id, r2_key, filename, content_type, size_bytes, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, assessmentId, r2Key, filename, contentType, sizeBytes, now)
        .run();

      const image: ImageRecord = {
        id,
        assessment_id: assessmentId,
        r2_key: r2Key,
        filename,
        content_type: contentType,
        size_bytes: sizeBytes,
        uploaded_at: now,
      };

      return { success: true, data: image };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to create image record', details: String(e) },
      };
    }
  }

  async getImagesByAssessment(assessmentId: string): Promise<Result<ImageRecord[], ApiError>> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM images WHERE assessment_id = ?')
        .bind(assessmentId)
        .all<ImageRecord>();

      return { success: true, data: result.results };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to get images', details: String(e) },
      };
    }
  }

  async deleteImage(id: string): Promise<Result<ImageRecord | null, ApiError>> {
    try {
      const image = await this.db
        .prepare('SELECT * FROM images WHERE id = ?')
        .bind(id)
        .first<ImageRecord>();

      if (image) {
        await this.db.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
      }

      return { success: true, data: image ?? null };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to delete image', details: String(e) },
      };
    }
  }

  // ============ Damage Items ============

  async createDamageItem(
    assessmentId: string,
    damageType: DamageType,
    location: string,
    severity: Severity,
    surfaceType?: SurfaceType,
    material?: string,
    disposition?: Disposition,
    notes?: string
  ): Promise<Result<DamageItem, ApiError>> {
    try {
      const id = generateId();
      const now = new Date().toISOString();

      await this.db
        .prepare(
          `INSERT INTO damage_items (id, assessment_id, damage_type, location, severity, surface_type, material, disposition, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, assessmentId, damageType, location, severity, surfaceType ?? null, material ?? null, disposition ?? null, notes ?? null, now)
        .run();

      const item: DamageItem = {
        id,
        assessment_id: assessmentId,
        damage_type: damageType,
        location,
        severity,
        surface_type: surfaceType,
        material,
        disposition,
        notes,
        created_at: now,
      };

      return { success: true, data: item };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to create damage item', details: String(e) },
      };
    }
  }

  async createDamageItems(assessmentId: string, items: Omit<DamageItem, 'id' | 'assessment_id' | 'created_at'>[]): Promise<Result<DamageItem[], ApiError>> {
    try {
      const now = new Date().toISOString();
      const createdItems: DamageItem[] = [];

      for (const item of items) {
        const id = generateId();
        await this.db
          .prepare(
            `INSERT INTO damage_items (id, assessment_id, damage_type, location, severity, surface_type, material, disposition, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(id, assessmentId, item.damage_type, item.location, item.severity, item.surface_type ?? null, item.material ?? null, item.disposition ?? null, item.notes ?? null, now)
          .run();

        createdItems.push({
          id,
          assessment_id: assessmentId,
          ...item,
          created_at: now,
        });
      }

      return { success: true, data: createdItems };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to create damage items', details: String(e) },
      };
    }
  }

  // ============ Restoration Priorities ============

  async createRestorationPriorities(
    assessmentId: string,
    priorities: Omit<RestorationPriority, 'id' | 'assessment_id' | 'created_at'>[]
  ): Promise<Result<RestorationPriority[], ApiError>> {
    try {
      const now = new Date().toISOString();
      const created: RestorationPriority[] = [];

      for (const p of priorities) {
        const id = generateId();
        await this.db
          .prepare(
            `INSERT INTO restoration_priorities (id, assessment_id, priority, area, action, rationale, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(id, assessmentId, p.priority, p.area, p.action, p.rationale ?? null, now)
          .run();

        created.push({
          id,
          assessment_id: assessmentId,
          priority: p.priority,
          area: p.area,
          action: p.action,
          rationale: p.rationale,
          created_at: now,
        });
      }

      return { success: true, data: created };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to create restoration priorities', details: String(e) },
      };
    }
  }

  // ============ Reports ============

  async createReport(
    assessmentId: string,
    reportType: 'assessment' | 'cleaning-spec' | 'executive-summary',
    contentJson: string,
    pdfR2Key?: string
  ): Promise<Result<ReportRecord, ApiError>> {
    try {
      const id = generateId();
      const now = new Date().toISOString();

      await this.db
        .prepare(
          `INSERT INTO reports (id, assessment_id, report_type, content_json, pdf_r2_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(id, assessmentId, reportType, contentJson, pdfR2Key ?? null, now)
        .run();

      const report: ReportRecord = {
        id,
        assessment_id: assessmentId,
        report_type: reportType,
        content_json: contentJson,
        pdf_r2_key: pdfR2Key,
        created_at: now,
      };

      return { success: true, data: report };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to create report', details: String(e) },
      };
    }
  }

  async getReportsByAssessment(assessmentId: string): Promise<Result<ReportRecord[], ApiError>> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM reports WHERE assessment_id = ? ORDER BY created_at DESC')
        .bind(assessmentId)
        .all<ReportRecord>();

      return { success: true, data: result.results };
    } catch (e) {
      return {
        success: false,
        error: { code: 500, message: 'Failed to get reports', details: String(e) },
      };
    }
  }
}
