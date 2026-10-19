import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    projects: [
      { plugins: [react()], test: { name: 'unit', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['tests/setup.ts'] } },
      { test: { name: 'database', environment: 'node', include: ['supabase/tests/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000, maxWorkers: 1 } },
    ],
  },
})
