const { defineConfig } = require('vitest/config')

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['dist', 'node_modules'],
    setupFiles: ['tests/setup.ts'],
  },
})
