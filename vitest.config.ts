import path from 'node:path';

import { defineWorkersProject, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersProject(async () => {
  const migrationsPath = path.join(__dirname, 'drizzle');
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      setupFiles: ['tests/apply-migrations.ts'],
      globals: true,
      poolOptions: {
        workers: {
          main: './worker/index.ts',
          singleWorker: true,
          isolatedStorage: false,
          miniflare: {
            compatibilityFlags: ['nodejs_compat'],
            compatibilityDate: '2025-12-20',
            d1Databases: ['DB'],
            bindings: { TEST_MIGRATIONS: migrations, SNS_DISABLE_SIGNATURE_VERIFY: 'true' },
          },
        },
      },
    },
  };
});
