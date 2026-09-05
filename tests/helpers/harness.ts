import { afterAll, beforeAll } from 'vitest';
import { createTestHarness } from 'wrangler';

// Each test file gets an independent runtime with disposable, non-persistent D1 storage.
export const server = createTestHarness({
  workers: [
    {
      configPath: './dist/sesnoop/wrangler.json',
      vars: { SNS_DISABLE_SIGNATURE_VERIFY: 'true' },
    },
  ],
});

export let env: Cloudflare.Env;

beforeAll(async () => {
  await server.listen();
  const worker = server.getWorker<Cloudflare.Env>();
  await worker.applyD1Migrations('DB');
  env = await worker.getEnv();
}, 30_000);

afterAll(async () => {
  await server.close();
});

export async function setWorkerVars(vars: Record<string, string>) {
  await server.update({
    workers: [
      {
        configPath: './dist/sesnoop/wrangler.json',
        vars: { SNS_DISABLE_SIGNATURE_VERIFY: 'true', ...vars },
      },
    ],
  });
  env = await server.getWorker<Cloudflare.Env>().getEnv();
}
