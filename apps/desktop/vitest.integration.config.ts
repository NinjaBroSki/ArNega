import { defineConfig } from 'vitest/config';

/**
 * Live integration tests against a running local Ollama server.
 * Not part of `npm test` / CI — run manually on a machine with Ollama:
 *
 *   npx vitest run -c vitest.integration.config.ts
 */
export default defineConfig({
  test: {
    include: ['test-integration/**/*.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
