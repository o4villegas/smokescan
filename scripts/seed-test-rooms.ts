/**
 * Seed Test Rooms Script
 * Creates a Test Project with 7 pre-configured rooms for testing assessments
 *
 * Usage: npm run seed:test-rooms
 * Requires: Dev server running on http://localhost:5173
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedData = JSON.parse(readFileSync(join(__dirname, '../seed/test-rooms.json'), 'utf-8'));

const API_BASE = process.env.API_BASE || 'http://localhost:5173';

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: number; message: string; details?: string } };

type Project = {
  id: string;
  name: string;
  address: string;
  client_name?: string;
  notes?: string;
};

type Assessment = {
  id: string;
  project_id: string;
  room_type: string;
  room_name?: string;
};

async function seedTestRooms() {
  console.log('🌱 Starting seed process...\n');
  console.log(`📡 API Base URL: ${API_BASE}\n`);

  // 1. Create project
  console.log('📁 Creating Test Project...');
  const projectRes = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(seedData.project),
  });

  const projectData = (await projectRes.json()) as ApiResponse<Project>;

  if (!projectData.success) {
    console.error('❌ Failed to create project:', projectData.error.message);
    process.exit(1);
  }

  const projectId = projectData.data.id;
  console.log(`✅ Created project: ${projectData.data.name}`);
  console.log(`   ID: ${projectId}\n`);

  // 2. Create each room
  console.log('🚪 Creating rooms...\n');

  let successCount = 0;
  let failCount = 0;

  for (const room of seedData.rooms) {
    const roomRes = await fetch(`${API_BASE}/api/projects/${projectId}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    });

    const roomData = (await roomRes.json()) as ApiResponse<Assessment>;

    if (!roomData.success) {
      console.error(`   ❌ ${room.room_name}: ${roomData.error.message}`);
      failCount++;
      continue;
    }

    console.log(`   ✅ ${room.room_name} (${room.room_type})`);
    console.log(`      - Structure: ${room.structure_type}`);
    console.log(`      - Floor: ${room.floor_level}`);
    console.log(`      - Dimensions: ${room.dimensions.length_ft}×${room.dimensions.width_ft}×${room.dimensions.height_ft} ft`);
    console.log(`      - Smoke Odor: ${room.sensory_observations.smoke_odor_present ? room.sensory_observations.smoke_odor_intensity : 'none'}`);
    console.log(`      - Wipe Result: ${room.sensory_observations.white_wipe_result}`);
    console.log('');
    successCount++;
  }

  // 3. Summary
  console.log('━'.repeat(50));
  console.log('\n📊 Seed Summary:');
  console.log(`   ✅ ${successCount} rooms created successfully`);
  if (failCount > 0) {
    console.log(`   ❌ ${failCount} rooms failed`);
  }

  console.log('\n🔗 Project URL:');
  console.log(`   ${API_BASE}/projects/${projectId}`);

  console.log('\n📂 Sample Images Location:');
  console.log('   \\\\wsl$\\Ubuntu\\home\\lando555\\smokescan\\sample_images\\');

  console.log('\n📝 Next Steps:');
  console.log('   1. Navigate to the project URL above');
  console.log('   2. Click on each room to open the AssessmentWizard');
  console.log('   3. Upload images from the corresponding sample_images folder');
  console.log('   4. Click "Start Assessment" to run the AI analysis');
  console.log('');
}

// Run the seed
seedTestRooms().catch((error) => {
  console.error('💥 Seed failed with error:', error);
  process.exit(1);
});
