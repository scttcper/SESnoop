import { SELF, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Source } from '@/db/schema';
import type { ValidationErrorResponse } from '@/lib/types';
import type { SetupInfo } from '@/routes/sources/sources.routes';

import { insertEvent, insertMessage, insertSource, resetDb } from './helpers/db';

beforeEach(async () => {
  await resetDb();
});

describe('sources routes', () => {
  it('lists sources', async () => {
    await insertSource({ id: 1, name: 'Alpha', token: 'alpha-token' });

    const response = await SELF.fetch('http://example.com/api/sources');
    expect(response.status).toBe(200);
    const json = (await response.json()) as Source[];
    expect(json).toHaveLength(1);
    expect(json[0]?.name).toBe('Alpha');
  });

  it('creates a source with defaults', async () => {
    const response = await SELF.fetch('http://example.com/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Source' }),
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as Source;
    expect(json.name).toBe('New Source');
    expect(json.color).toBe('blue');
    expect(json.token).toBeTypeOf('string');
  });

  it('validates source creation payloads', async () => {
    const response = await SELF.fetch('http://example.com/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(422);
  });

  it('gets a source by id', async () => {
    await insertSource({ id: 1, name: 'Bravo', token: 'bravo-token' });
    const response = await SELF.fetch('http://example.com/api/sources/1');
    expect(response.status).toBe(200);
    const json = (await response.json()) as Source;
    expect(json.name).toBe('Bravo');
  });

  it('returns 404 for missing sources', async () => {
    const response = await SELF.fetch('http://example.com/api/sources/999');
    expect(response.status).toBe(404);
  });

  it('returns 422 for invalid source ids', async () => {
    const response = await SELF.fetch('http://example.com/api/sources/nope');
    expect(response.status).toBe(422);
  });

  it('rejects empty source updates', async () => {
    await insertSource({ id: 1, name: 'Charlie', token: 'charlie-token' });
    const response = await SELF.fetch('http://example.com/api/sources/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(422);
    const json = (await response.json()) as ValidationErrorResponse;
    expect(json.success).toBe(false);
  });

  it('updates a source', async () => {
    await insertSource({ id: 1, name: 'Delta', token: 'delta-token' });
    const response = await SELF.fetch('http://example.com/api/sources/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Delta Updated', retention_days: 30 }),
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as Source;
    expect(json.name).toBe('Delta Updated');
    expect(json.retention_days).toBe(30);
  });

  it('deletes a source', async () => {
    await insertSource({ id: 1, name: 'Echo', token: 'echo-token' });
    const response = await SELF.fetch('http://example.com/api/sources/1', {
      method: 'DELETE',
    });
    expect(response.status).toBe(204);
  });

  it('returns setup guidance', async () => {
    await insertSource({ id: 1, name: 'My Source', token: 'tok-1' });
    const response = await SELF.fetch('http://example.com/api/sources/1/setup');
    expect(response.status).toBe(200);
    const json = (await response.json()) as SetupInfo;
    expect(json.configuration_set_name).toBe('sesnoop-my-source-config');
    expect(json.sns_topic_name).toBe('sesnoop-my-source-sns');
    expect(json.webhook_url).toBe('http://example.com/api/webhooks/tok-1');
    expect(json.steps).toHaveLength(4);
  });

  it('runs retention cleanup for a source', async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    await insertSource({
      id: 1,
      name: 'Cleanup Source',
      token: 'cleanup-token',
      retention_days: 30,
    });
    await insertMessage({
      id: 1,
      source_id: 1,
      ses_message_id: 'old-message',
      sent_at: now - 31 * dayMs,
    });
    await insertMessage({
      id: 2,
      source_id: 1,
      ses_message_id: 'new-message',
      sent_at: now - dayMs,
    });
    await insertEvent({
      message_id: 1,
      event_type: 'Delivery',
      recipient_email: 'old@example.com',
      event_at: now - 31 * dayMs,
      ses_message_id: 'old-message',
    });
    await insertEvent({
      message_id: 2,
      event_type: 'Delivery',
      recipient_email: 'new@example.com',
      event_at: now - dayMs,
      ses_message_id: 'new-message',
    });

    const response = await SELF.fetch('http://example.com/api/sources/1/cleanup', {
      method: 'POST',
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      source_id: number;
      retention_days: number | null;
      messages_deleted: number;
      events_deleted: number;
    };
    expect(json.source_id).toBe(1);
    expect(json.retention_days).toBe(30);
    expect(json.messages_deleted).toBe(1);
    expect(json.events_deleted).toBe(1);

    const messages = await env.DB.prepare('SELECT id FROM messages').all();
    expect(messages.results).toHaveLength(1);
    const events = await env.DB.prepare('SELECT id FROM events').all();
    expect(events.results).toHaveLength(1);
  });
});
