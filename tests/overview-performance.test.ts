import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { overviewRatesQuery, type OverviewRateRow } from '../worker/lib/overview-rates';
import type { OverviewResponse } from '../worker/routes/overview/overview.routes';

import { insertSource, resetDb } from './helpers/db';
import { env, server } from './helpers/harness';

const DAY_MS = 86_400_000;
const start = Date.UTC(2025, 0, 1);
const query = new SQLiteSyncDialect().sqlToQuery(
  overviewRatesQuery({ sourceId: 1, start, end: start + DAY_MS - 1, now: start + 2 * DAY_MS }),
);

const runRatesQuery = () =>
  env.DB.prepare(query.sql)
    .bind(...query.params)
    .all<OverviewRateRow>();

const insertEventBatch = (eventType: string, time: number, condition: string) =>
  env.DB.prepare(`
    INSERT INTO events (message_id, source_id, event_type, recipient_email, event_at, event_data)
    SELECT id, source_id, ?, 'recipient-' || id || '@example.com', ?, '{}'
    FROM messages WHERE ${condition}
  `).bind(eventType, time);

const insertHistory = async () => {
  const sentAt = start - 30 * DAY_MS;
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO messages (id, source_id, ses_message_id, sent_at)
      WITH RECURSIVE sequence(n) AS (VALUES (1) UNION ALL SELECT n + 1 FROM sequence WHERE n < 1000)
      SELECT 1000 + n, 1, 'history-' || n, ? FROM sequence
    `).bind(sentAt),
    insertEventBatch('Send', sentAt, 'id > 1000'),
    insertEventBatch('Delivery', sentAt + 1, 'id > 1000'),
    insertEventBatch('Open', sentAt + 2, 'id > 1000'),
  ]);
};

beforeEach(async () => {
  await resetDb();
  await insertSource({ id: 1 });
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO messages (id, source_id, ses_message_id, sent_at)
      WITH RECURSIVE sequence(n) AS (VALUES (1) UNION ALL SELECT n + 1 FROM sequence WHERE n < 150)
      SELECT n, 1, 'current-' || n, ? FROM sequence
    `).bind(start),
    insertEventBatch('Send', start, 'id <= 150'),
    insertEventBatch('Delivery', start + 1, 'id <= 100'),
    insertEventBatch('Open', start + DAY_MS, 'id <= 100 AND id % 2 = 0'),
    insertEventBatch('Click', start + DAY_MS, 'id <= 100 AND id % 4 = 0'),
    insertEventBatch('Bounce', start + DAY_MS, 'id > 100 AND id <= 150'),
    insertEventBatch('Complaint', start + DAY_MS, 'id <= 100 AND id % 10 = 0'),
  ]);
});

// These checks run against the plugin's local D1 binding and migrated schema.
// They guard query correctness and access patterns, not production latency or
// the index choices a remote database will make with different statistics.
describe('overview D1 query regressions', () => {
  it('does not read unrelated historical messages when calculating rates', async () => {
    await env.DB.prepare('DELETE FROM messages WHERE id > 1').run();
    const baseline = await runRatesQuery();
    await insertHistory();
    const withHistory = await runRatesQuery();

    expect(withHistory.results).toEqual(baseline.results);
    expect(baseline.meta.rows_read).toBeGreaterThan(0);
    // Allow a few index traversal reads, not a scan of the 3,000 added events.
    expect(withHistory.meta.rows_read).toBeLessThan(baseline.meta.rows_read + 10);
  });

  it('looks up outcomes by message instead of repeatedly scanning the source', async () => {
    await insertHistory();
    const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
      .bind(...query.params)
      .all<{ detail: string }>();
    const outcomeLookups = plan.results.filter((row) => /SEARCH outcome\b/.test(row.detail));

    expect(outcomeLookups).toHaveLength(4);
    for (const { detail } of outcomeLookups) {
      expect(detail).toContain('message_id=?');
      expect(detail).not.toContain('events_source_id_event_at_index');
    }
  });

  it('serves matching rates through the Worker API with multiple messages and late events', async () => {
    await insertHistory();
    // Opens of older deliveries are activity in the window, not engagement of
    // the deliveries being measured. Retries must not inflate the rates either.
    await env.DB.batch([
      insertEventBatch('Open', start + 1, 'id > 1000'),
      insertEventBatch('Open', start + DAY_MS + 1, 'id <= 100 AND id % 2 = 0'),
    ]);
    const response = await server.fetch(
      'http://example.com/api/sources/1/overview?from=2025-01-01&to=2025-01-01',
    );
    expect(response.status).toBe(200);
    const overview = (await response.json()) as OverviewResponse;
    expect(overview.metrics).toMatchObject({
      sent: 150,
      delivered: 100,
      opens: 1000,
      opened_deliveries: 50,
      clicked_deliveries: 25,
      open_rate: 0.5,
      click_rate: 0.25,
      bounce_rate: 50 / 150,
      complaint_rate: 10 / 150,
    });
    expect(overview.chart.open_rate).toEqual([0.5]);
    expect(overview.chart.bounce_rate).toEqual([50 / 150]);
  });
});
