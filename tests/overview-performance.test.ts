import { env } from 'cloudflare:test';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { expect, it } from 'vitest';

import { overviewRatesQuery } from '../worker/lib/overview-rates';

import { insertEvent, insertMessage, insertSource, resetDb } from './helpers/db';

it('keeps rate query reads bounded when a source has older event history', async () => {
  await resetDb();
  await insertSource({ id: 1 });
  await insertMessage({ id: 1, source_id: 1, ses_message_id: 'old' });
  await insertMessage({ id: 2, source_id: 1, ses_message_id: 'current' });
  const start = Date.UTC(2025, 0, 1);
  await env.DB.prepare(`
    INSERT INTO events (message_id, source_id, event_type, recipient_email, event_at)
    WITH RECURSIVE sequence(n) AS (VALUES (1) UNION ALL SELECT n + 1 FROM sequence WHERE n < 10000)
    SELECT 1, 1, 'Send', 'old-' || n || '@example.com', ? FROM sequence
  `)
    .bind(start - 86_400_000)
    .run();
  for (const event_type of ['Send', 'Delivery', 'Open', 'Click']) {
    await insertEvent({
      message_id: 2,
      event_type,
      recipient_email: 'a@example.com',
      event_at: start,
    });
  }
  // A repeated anchor in this range must not move an older recipient into it.
  await insertEvent({
    message_id: 1,
    event_type: 'Send',
    recipient_email: 'old-1@example.com',
    event_at: start,
  });
  const query = new SQLiteSyncDialect().sqlToQuery(
    overviewRatesQuery({
      sourceId: 1,
      start,
      end: start + 86_399_999,
      now: start + 86_400_000,
    }),
  );
  const result = await env.DB.prepare(query.sql)
    .bind(...query.params)
    .all();
  expect(result.results).toEqual([
    {
      day_bucket: start / 86_400_000,
      event_type: 'Delivery',
      total: 1,
      opened: 1,
      clicked: 1,
      bounced: 0,
      complained: 0,
    },
    {
      day_bucket: start / 86_400_000,
      event_type: 'Send',
      total: 1,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
    },
  ]);
  expect(result.meta.rows_read).toBeLessThan(200);
});
