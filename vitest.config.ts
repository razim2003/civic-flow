import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    projects: [
      { plugins: [react()], test: { name: 'unit', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'], setupFiles: ['tests/setup.ts'], maxWorkers: 2 } },
      { test: { name: 'database', environment: 'node', include: ['supabase/tests/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000, maxWorkers: 1 } },
    ],
  },
})
