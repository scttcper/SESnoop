import { applyD1Migrations, env } from 'cloudflare:test';

type D1Migrations = Parameters<typeof applyD1Migrations>[1];
type TestEnv = typeof env & { TEST_MIGRATIONS: D1Migrations };

await applyD1Migrations(env.DB, (env as TestEnv).TEST_MIGRATIONS);
