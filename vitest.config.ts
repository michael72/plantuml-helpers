import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    // if anything else than v8 comments (coverage)
    // it will be added to legal text
    legalComments: 'none',
  },
  test: {
    include: ['test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'out/**',
        'node_modules/**'
      ]
    },
    globals: true,
    environment: 'node',
    testTimeout: 100,
  },
});
