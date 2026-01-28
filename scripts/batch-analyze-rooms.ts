/**
 * Batch Analyze Rooms Script
 * Runs AI analysis on all rooms in the Test Project using images from sample_images/
 *
 * Usage: npm run seed:analyze
 * Prerequisites: npm run seed:test-rooms (creates Test Project with 12 empty assessments)
 * Requires: Dev server running on http://localhost:5173
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE || 'http://localhost:5173';
const SAMPLE_IMAGES_DIR = join(__dirname, '../sample_images');
const TEST_PROJECT_NAME = 'Test Project - Residential Fire';

// Timing constants (sequential processing - one room at a time)
const POLL_INTERVAL_MS = 5000;
const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Types
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: number; message: string; details?: string } };

type Project = {
  id: string;
  name: string;
  assessments: Assessment[];
};

type Assessment = {
  id: string;
  room_name: string;
  room_type: string;
  structure_type: string;
  floor_level: string;
  session_id?: string; // If present, room already analyzed
  dimensions: {
    length_ft: number;
    width_ft: number;
    height_ft: number;
    area_sf: number;
    volume_cf: number;
  };
  sensory_observations: {
    smoke_odor_present: boolean;
    smoke_odor_intensity: string;
    white_wipe_result: string;
  };
};

type RoomTask = {
  roomName: string;
  assessmentId: string;
  imagePaths: string[];
  status: 'pending' | 'submitted' | 'processing' | 'completed' | 'failed';
  jobId?: string;
  sessionId?: string;
  error?: string;
};

type SeedRoom = {
  room_name: string;
  room_type: string;
  structure_type: string;
  floor_level: string;
  dimensions: {
    length_ft: number;
    width_ft: number;
    height_ft: number;
    area_sf: number;
    volume_cf: number;
  };
  sensory_observations: {
    smoke_odor_present: boolean;
    smoke_odor_intensity: string;
    white_wipe_result: string;
  };
};

// Special image mapping for Master Bedroom folder (contains bedroom AND bathroom images)
const MASTER_FOLDER_MAPPING: Record<string, string[]> = {
  'Master Bedroom': [
    'Master bedroom - far Field zone.jpg',
    'Master bedroom - far Field zone2.jpg',
    'Master bedroom - far Field zone3.jpg',
  ],
  'Master Bathroom': [
    'Master bathroom - far Field zone.jpg',
    'Master bathroom - far Field zone2.jpg',
  ],
};

/**
 * Find the Test Project by name
 */
async function findTestProject(): Promise<Project | null> {
  console.log('🔎 Finding Test Project...');

  const res = await fetch(`${API_BASE}/api/projects`);
  const data = (await res.json()) as ApiResponse<Project[]>;

  if (!data.success) {
    const errorData = data as { success: false; error: { message: string } };
    console.error('❌ Failed to fetch projects:', errorData.error.message);
    return null;
  }

  const project = data.data.find((p) => p.name === TEST_PROJECT_NAME);
  if (!project) {
    console.error(`❌ Project "${TEST_PROJECT_NAME}" not found. Run 'npm run seed:test-rooms' first.`);
    return null;
  }

  // Fetch full project with assessments
  const fullRes = await fetch(`${API_BASE}/api/projects/${project.id}`);
  const fullData = (await fullRes.json()) as ApiResponse<Project>;

  if (!fullData.success) {
    const errorData = fullData as { success: false; error: { message: string } };
    console.error('❌ Failed to fetch project details:', errorData.error.message);
    return null;
  }

  console.log(`✅ Found project: ${fullData.data.name} (${fullData.data.assessments.length} assessments)`);
  return fullData.data;
}

/**
 * Discover images for each room from sample_images/
 */
function discoverImages(roomName: string): string[] {
  // Special handling for Master Bedroom/Bathroom (both in same folder)
  if (roomName === 'Master Bedroom' || roomName === 'Master Bathroom') {
    const folderPath = join(SAMPLE_IMAGES_DIR, 'Master Bedroom');
    const filenames = MASTER_FOLDER_MAPPING[roomName] || [];
    return filenames.map((f) => join(folderPath, f));
  }

  // Standard case: folder name = room name
  const folderPath = join(SAMPLE_IMAGES_DIR, roomName);
  try {
    const files = readdirSync(folderPath);
    return files
      .filter((f) => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png'))
      .map((f) => join(folderPath, f));
  } catch {
    console.warn(`⚠️ No folder found for room: ${roomName}`);
    return [];
  }
}

/**
 * Convert image file to base64 data URL
 */
function imageToBase64(imagePath: string): string {
  const buffer = readFileSync(imagePath);
  const ext = imagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${buffer.toString('base64')}`;
}

/**
 * Build metadata from seed room data (transforms snake_case to camelCase where needed)
 */
function buildMetadata(room: SeedRoom) {
  return {
    roomType: room.room_type,
    structureType: room.structure_type,
    floor_level: room.floor_level,
    dimensions: {
      length_ft: room.dimensions.length_ft,
      width_ft: room.dimensions.width_ft,
      height_ft: room.dimensions.height_ft,
    },
    sensory_observations: room.sensory_observations,
  };
}

/**
 * Submit a single room for analysis
 */
async function submitJob(task: RoomTask, metadata: ReturnType<typeof buildMetadata>): Promise<string | null> {
  console.log(`📷 ${task.roomName}: ${task.imagePaths.length} images loaded`);

  const images = task.imagePaths.map(imageToBase64);

  const requestBody = JSON.stringify({ images, metadata });
  const payloadSizeMB = (requestBody.length / 1024 / 1024).toFixed(2);
  console.log(`📦 ${task.roomName}: Payload size: ${payloadSizeMB}MB`);

  const res = await fetch(`${API_BASE}/api/assess/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
  });

  const data = (await res.json()) as ApiResponse<{ jobId: string }>;

  if (!data.success) {
    const errorData = data as { success: false; error: { message: string; details?: string; code?: number } };
    console.error(`❌ ${task.roomName}: Submit failed`);
    console.error(`   Status: ${errorData.error.code || 'unknown'}`);
    console.error(`   Message: ${errorData.error.message}`);
    if (errorData.error.details) {
      console.error(`   Details: ${errorData.error.details.substring(0, 500)}`);
    }
    return null;
  }

  console.log(`📤 ${task.roomName}: Submitted (jobId: ${data.data.jobId})`);
  return data.data.jobId;
}

/**
 * Poll for job completion
 */
async function pollJob(task: RoomTask): Promise<{ status: 'completed' | 'failed'; error?: string }> {
  const startTime = Date.now();
  console.log(`⏳ ${task.roomName}: Processing...`);

  while (Date.now() - startTime < JOB_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${API_BASE}/api/assess/status/${task.jobId}`);
    const data = (await res.json()) as ApiResponse<{ status: string; error?: string }>;

    if (!data.success) {
      continue; // Transient error, keep polling
    }

    if (data.data.status === 'completed') {
      return { status: 'completed' };
    }

    if (data.data.status === 'failed') {
      return { status: 'failed', error: data.data.error || 'Unknown error' };
    }

    // Still pending or in_progress, continue polling
  }

  return { status: 'failed', error: 'Timeout' };
}

/**
 * Get job result and persist to database
 */
async function persistResult(task: RoomTask): Promise<boolean> {
  // Get result from RunPod
  const resultRes = await fetch(`${API_BASE}/api/assess/result/${task.jobId}`);
  const resultData = (await resultRes.json()) as ApiResponse<{ sessionId: string; report: { executiveSummary: string } }>;

  if (!resultData.success) {
    const errorData = resultData as { success: false; error: { message: string } };
    console.error(`❌ ${task.roomName}: Failed to get result - ${errorData.error.message}`);
    return false;
  }

  const { sessionId, report } = resultData.data;
  task.sessionId = sessionId;

  // Update assessment in database
  const patchRes = await fetch(`${API_BASE}/api/assessments/${task.assessmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'completed',
      executive_summary: report.executiveSummary,
      session_id: sessionId,
    }),
  });

  const patchData = (await patchRes.json()) as ApiResponse<unknown>;

  if (!patchData.success) {
    console.warn(`⚠️ ${task.roomName}: Failed to persist to database (non-blocking)`);
  }

  console.log(`✅ ${task.roomName}: Completed (sessionId: ${sessionId})`);
  return true;
}

/**
 * Process a single room (submit → poll → persist)
 */
async function processRoom(task: RoomTask, metadata: ReturnType<typeof buildMetadata>): Promise<void> {
  // Submit
  const jobId = await submitJob(task, metadata);
  if (!jobId) {
    task.status = 'failed';
    task.error = 'Submit failed';
    return;
  }

  task.jobId = jobId;
  task.status = 'submitted';

  // Poll
  const pollResult = await pollJob(task);
  if (pollResult.status === 'failed') {
    task.status = 'failed';
    task.error = pollResult.error;
    console.error(`❌ ${task.roomName}: ${pollResult.error}`);
    return;
  }

  // Persist
  const persisted = await persistResult(task);
  task.status = persisted ? 'completed' : 'failed';
}

/**
 * Main entry point
 */
async function main() {
  console.log('🔥 Starting batch analysis...\n');

  // 1. Find Test Project
  const project = await findTestProject();
  if (!project) {
    process.exit(1);
  }

  // 2. Load seed data for metadata
  const seedData = JSON.parse(readFileSync(join(__dirname, '../seed/test-rooms.json'), 'utf-8'));
  const roomMetadataMap = new Map<string, SeedRoom>();
  for (const room of seedData.rooms) {
    roomMetadataMap.set(room.room_name, room);
  }

  // 3. Build task list (skip already-completed rooms)
  const tasks: RoomTask[] = [];
  let skippedCount = 0;
  for (const assessment of project.assessments) {
    const roomName = assessment.room_name || 'Unknown';

    // Skip rooms that already have a session_id (already analyzed)
    if (assessment.session_id) {
      console.log(`⏭️  Skipping ${roomName}: Already analyzed (session: ${assessment.session_id.substring(0, 8)}...)`);
      skippedCount++;
      continue;
    }

    const imagePaths = discoverImages(roomName);

    if (imagePaths.length === 0) {
      console.warn(`⚠️ Skipping ${roomName}: No images found`);
      continue;
    }

    tasks.push({
      roomName,
      assessmentId: assessment.id,
      imagePaths,
      status: 'pending',
    });
  }

  if (skippedCount > 0) {
    console.log(`\n📋 Skipped ${skippedCount} already-completed rooms`);
  }

  console.log(`\n📊 Found ${tasks.length} rooms with images to process\n`);
  console.log('🔄 Processing sequentially (one room at a time)...\n');

  // 4. Process rooms sequentially (one at a time)
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const metadata = roomMetadataMap.get(task.roomName);

    console.log(`\n[${ i + 1}/${tasks.length}] Processing: ${task.roomName}`);
    console.log('─'.repeat(40));

    if (!metadata) {
      console.warn(`⚠️ Skipping ${task.roomName}: No metadata found`);
      task.status = 'failed';
      task.error = 'No metadata';
      continue;
    }

    await processRoom(task, buildMetadata(metadata));

    // Brief pause between rooms
    if (i < tasks.length - 1) {
      console.log('');
    }
  }

  // 5. Summary
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;

  console.log('\n' + '━'.repeat(50));
  console.log('\n📊 Summary:');
  console.log(`   ✅ ${completed} rooms analyzed successfully`);
  if (failed > 0) {
    console.log(`   ❌ ${failed} rooms failed`);
    for (const task of tasks.filter((t) => t.status === 'failed')) {
      console.log(`      - ${task.roomName}: ${task.error}`);
    }
  }

  console.log(`\n🔗 View results at: ${API_BASE}/projects/${project.id}`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

// Run
main().catch((error) => {
  console.error('💥 Batch analysis failed:', error);
  process.exit(1);
});
