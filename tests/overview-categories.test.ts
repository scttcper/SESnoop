import { createClient, type InValue } from '@libsql/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import overview from '../worker/routes/overview/overview.index';
import type { OverviewResponse } from '../worker/routes/overview/overview.routes';

const client = createClient({ url: ':memory:' });
const queries: Array<{ sql: string; args: InValue[] }> = [];
const start = Date.UTC(2025, 0, 1);
const end = start + 86_400_000 - 1;

vi.mock('../worker/db', async () => {
  const { drizzle } = await import('drizzle-orm/libsql');
  return {
    createDb: () =>
      drizzle(client, {
        logger: {
          logQuery: (sql, args) => queries.push({ sql, args: args as InValue[] }),
        },
      }),
  };
});

// Exercise the real route and SQL against disposable SQLite tables. This suite
// does not use the Worker harness, project databases, or migration runner.
beforeAll(async () => {
  await client.executeMultiple(`
    CREATE TABLE sources (id INTEGER PRIMARY KEY);
    CREATE TABLE events (
      id INTEGER PRIMARY KEY,
      source_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      event_at INTEGER NOT NULL,
      event_data TEXT NOT NULL DEFAULT '{}',
      bounce_type TEXT
    );
    CREATE INDEX events_source_id_event_at_index ON events (source_id, event_at);
    CREATE INDEX events_message_id_event_at_index ON events (message_id, event_at);
    CREATE TABLE message_tags (
      source_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL
    );
    CREATE UNIQUE INDEX message_tags_message_id_key_value_unique
      ON message_tags (message_id, key, value);
    CREATE INDEX message_tags_source_id_key_value_index
      ON message_tags (source_id, key, value, message_id);
  `);
});

beforeEach(async () => {
  await client.executeMultiple(`
    DELETE FROM events;
    DELETE FROM message_tags;
    DELETE FROM sources;
    INSERT INTO sources VALUES (1);
  `);
  queries.length = 0;
});

afterAll(() => client.close());

const insertEvent = (
  messageId: number,
  eventType: string,
  recipient: string,
  time = start,
  sourceId = 1,
) =>
  client.execute({
    sql: `INSERT INTO events (message_id, source_id, event_type, recipient_email, event_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [messageId, sourceId, eventType, recipient, time],
  });

const insertTag = (messageId: number, key: string, value: string, sourceId = 1) =>
  client.execute({
    sql: `INSERT OR IGNORE INTO message_tags (message_id, source_id, key, value)
          VALUES (?, ?, ?, ?)`,
    args: [messageId, sourceId, key, value],
  });

const requestOverview = async () => {
  const response = await overview.request('/sources/1/overview?from=2025-01-01&to=2025-01-01');
  expect(response.status).toBe(200);
  return (await response.json()) as OverviewResponse;
};

describe('overview categories', () => {
  it('counts recipient events per category and retains uncategorized activity', async () => {
    await insertTag(1, 'category', 'product_update');
    await insertTag(1, 'category', 'product_update');
    await insertTag(1, 'category', 'newsletter');
    await insertTag(1, 'campaign', 'september');
    await insertTag(2, 'category', 'transactional');
    await insertTag(3, 'campaign', 'september');

    await insertEvent(1, 'Send', 'a@example.com');
    await insertEvent(1, 'Send', 'b@example.com');
    await insertEvent(1, 'Delivery', 'A@example.com');
    await insertEvent(1, 'Bounce', 'b@example.com');
    await insertEvent(1, 'Open', 'a@example.com');
    await insertEvent(1, 'Open', 'a@example.com', start + 1000);
    await insertEvent(2, 'Send', 'c@example.com');
    await insertEvent(2, 'Delivery', 'c@example.com');
    await insertEvent(3, 'Send', 'd@example.com');
    await insertEvent(3, 'Delivery', 'd@example.com');
    await insertEvent(4, 'Open', 'e@example.com');

    const json = await requestOverview();
    expect(json.category_breakdown).toEqual([
      { category: 'newsletter', sent: 2, delivered: 1, bounced: 1, recipients: 2 },
      { category: 'product_update', sent: 2, delivered: 1, bounced: 1, recipients: 2 },
      { category: null, sent: 1, delivered: 1, bounced: 0, recipients: 2 },
      { category: 'transactional', sent: 1, delivered: 1, bounced: 0, recipients: 1 },
    ]);
    expect(json.metrics.sent).toBe(4);
  });

  it('uses the selected source and inclusive date range while preserving raw category values', async () => {
    await insertTag(1, 'category', 'password_reset.v2');
    await insertTag(2, 'category', 'other_source', 2);
    await insertEvent(1, 'Send', 'a@example.com', start);
    await insertEvent(1, 'Delivery', 'a@example.com', end);
    await insertEvent(1, 'Bounce', 'a@example.com', start - 1);
    await insertEvent(1, 'Open', 'b@example.com', end + 1);
    await insertEvent(2, 'Send', 'c@example.com', start, 2);

    const json = await requestOverview();
    expect(json.category_breakdown).toEqual([
      { category: 'password_reset.v2', sent: 1, delivered: 1, bounced: 0, recipients: 1 },
    ]);
  });

  it('returns no categories when the selected range has no events', async () => {
    await insertTag(1, 'category', 'historical');
    await insertEvent(1, 'Send', 'a@example.com', start - 1);

    const json = await requestOverview();
    expect(json.category_breakdown).toEqual([]);
  });

  it('looks up tags by message instead of scanning every category tag for each event', async () => {
    await requestOverview();
    const query = queries.find((entry) => entry.sql.includes('left join "message_tags"'));
    expect(query).toBeDefined();
    const plan = await client.execute({
      sql: `EXPLAIN QUERY PLAN ${query!.sql}`,
      args: query!.args,
    });
    const lookups = plan.rows.map((row) => String(row.detail));
    expect(lookups).toContainEqual(
      expect.stringMatching(/SEARCH events .*source_id=\? AND event_at>\? AND event_at<\?/),
    );
    expect(lookups).toContainEqual(
      expect.stringMatching(/SEARCH message_tags .*message_id=\? AND key=\?/),
    );
  });
});
