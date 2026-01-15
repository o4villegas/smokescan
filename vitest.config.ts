import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load .env file
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      testTimeout: 120000, // 2 min for RunPod calls
      hookTimeout: 120000,
      env,
    },
  };
});
