import { afterEach } from 'vitest'

// Pure validation/HTTP tests do not need React DOM or browser setup.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
  const { cleanup } = await import('@testing-library/react')
  afterEach(cleanup)
}
