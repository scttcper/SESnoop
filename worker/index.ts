import app from './app';
import { runRetentionCleanup } from './lib/retention';
import type { AppBindings } from './lib/types';

export default {
  fetch: app.fetch,
  scheduled: (_event: ScheduledController, env: AppBindings['Bindings'], ctx: ExecutionContext) => {
    ctx.waitUntil(runRetentionCleanup(env));
  },
} satisfies ExportedHandler<AppBindings['Bindings']>;
