import { defineConfig } from 'vitest/config';

/** Unit tests only — live Ollama integration tests run via vitest.integration.config.ts. */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
