import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import type { EventResponse } from '@/routes/events/events.routes';

import { insertEvent, insertMessage, insertMessageTags, insertSource, resetDb } from './helpers/db';

const day = Date.UTC(2025, 0, 1, 12, 0, 0);

beforeEach(async () => {
  await resetDb();
  await insertSource({ id: 1, name: 'Alpha', token: 'alpha-token' });
  await insertMessage({
    id: 1,
    source_id: 1,
    ses_message_id: 'ses-1',
    subject: 'Hello world',
  });
  await insertMessageTags(1, [
    { key: 'campaign', value: 'spring' },
    { key: 'environment', value: 'prod' },
  ]);
  await insertEvent({
    message_id: 1,
    event_type: 'Delivery',
    recipient_email: 'a@example.com',
    event_at: day,
  });
  await insertEvent({
    message_id: 1,
    event_type: 'Bounce',
    recipient_email: 'b@example.com',
    event_at: day + 1000,
    bounce_type: 'Permanent',
  });
  await insertEvent({
    message_id: 1,
    event_type: 'Bounce',
    recipient_email: 'c@example.com',
    event_at: day + 2000,
    bounce_type: 'Transient',
  });
});

describe('events routes', () => {
  it('lists events with counts', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/sources/1/events?date_range=all_time',
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as EventResponse;
    expect(json.data).toHaveLength(3);
    expect(json.pagination.total).toBe(3);
    expect(json.counts.event_types.Bounce).toBe(2);
    expect(json.counts.event_types.Delivery).toBe(1);
    expect(json.counts.bounce_types.Permanent).toBe(1);
    expect(json.counts.bounce_types.Transient).toBe(1);
    expect(json.counts.tags['campaign:spring']).toBe(3);
    expect(json.counts.tags['environment:prod']).toBe(3);
    expect(json.data[0]?.event_type).toBe('Bounce');
    expect(json.data[0]?.tags).toEqual([
      { key: 'campaign', value: 'spring', label: 'campaign:spring' },
      { key: 'environment', value: 'prod', label: 'environment:prod' },
    ]);
  });

  it('filters events by type', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/sources/1/events?event_types=Bounce&date_range=all_time',
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as EventResponse;
    expect(json.data).toHaveLength(2);
    expect(json.data[0]?.event_type).toBe('Bounce');
  });

  it('filters events by a single tag', async () => {
    await insertMessage({
      id: 2,
      source_id: 1,
      ses_message_id: 'ses-2',
      subject: 'Fall update',
    });
    await insertMessageTags(2, [{ key: 'campaign', value: 'fall' }]);
    await insertEvent({
      message_id: 2,
      event_type: 'Delivery',
      recipient_email: 'd@example.com',
      event_at: day + 3000,
    });

    const response = await SELF.fetch(
      'http://example.com/api/sources/1/events?tags=campaign:spring&date_range=all_time',
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as EventResponse;
    expect(json.data).toHaveLength(3);
    expect(json.pagination.total).toBe(3);
    expect(json.data.every((event) => event.ses_message_id === 'ses-1')).toBe(true);
    expect(json.counts.tags['campaign:spring']).toBe(3);
    expect(json.counts.tags['campaign:fall']).toBe(1);
  });

  it('filters events by multiple tags with AND semantics', async () => {
    await insertMessage({
      id: 2,
      source_id: 1,
      ses_message_id: 'ses-2',
      subject: 'Staging spring',
    });
    await insertMessageTags(2, [
      { key: 'campaign', value: 'spring' },
      { key: 'environment', value: 'staging' },
    ]);
    await insertEvent({
      message_id: 2,
      event_type: 'Delivery',
      recipient_email: 'd@example.com',
      event_at: day + 3000,
    });

    const response = await SELF.fetch(
      'http://example.com/api/sources/1/events?tags=campaign:spring,environment:prod&date_range=all_time',
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as EventResponse;
    expect(json.data).toHaveLength(3);
    expect(json.pagination.total).toBe(3);
    expect(json.data.every((event) => event.ses_message_id === 'ses-1')).toBe(true);
  });

  it('returns 404 for missing sources', async () => {
    const response = await SELF.fetch('http://example.com/api/sources/999/events');
    expect(response.status).toBe(404);
  });

  it('returns 422 for invalid source ids', async () => {
    const response = await SELF.fetch('http://example.com/api/sources/nope/events');
    expect(response.status).toBe(422);
  });
});
