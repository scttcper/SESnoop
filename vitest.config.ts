import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrationsPath = path.join(__dirname, 'drizzle');
  const migrations = await readD1Migrations(migrationsPath);

  return {
    plugins: [
      cloudflareTest({
        main: './worker/index.ts',
        miniflare: {
          compatibilityFlags: ['nodejs_compat'],
          compatibilityDate: '2025-12-20',
          d1Databases: ['DB'],
          bindings: { TEST_MIGRATIONS: migrations, SNS_DISABLE_SIGNATURE_VERIFY: 'true' },
        },
      }),
    ],
    test: {
      setupFiles: ['tests/apply-migrations.ts'],
      globals: true,
    },
  };
});
