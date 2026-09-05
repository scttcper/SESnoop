import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['tests/build.ts'],
    globals: true,
  },
});
