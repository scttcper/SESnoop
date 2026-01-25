import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          assets: {
            directory: './public',
          },
          bindings: {
            SNS_DISABLE_SIGNATURE_VERIFY: 'true',
            DB_DISABLE_TRANSACTIONS: 'true',
          },
        },
      },
    },
  },
});
