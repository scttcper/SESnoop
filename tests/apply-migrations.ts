import { applyD1Migrations, env } from 'cloudflare:test';

await applyD1Migrations(env.DB, (env as any).TEST_MIGRATIONS);
