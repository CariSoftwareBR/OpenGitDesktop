import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The git tests spawn real git processes against temp repos.
    testTimeout: 30_000
  }
})
