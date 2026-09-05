import { beforeEach, describe, expect, it } from 'vitest';

import type { Source } from '@/db/schema';
import type { ValidationErrorResponse } from '@/lib/types';
import type { SetupInfo } from '@/routes/sources/sources.routes';

import {
  insertEvent,
  insertMessage,
  insertMessageTags,
  insertSource,
  insertWebhook,
  resetDb,
} from './helpers/db';
import { env, server } from './helpers/harness';

const updateSource = (body: unknown) =>
  server.fetch('http://example.com/api/sources/1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  await resetDb();
});

describe('sources routes', () => {
  it('lists sources', async () => {
    await insertSource({ id: 1, name: 'Alpha', token: 'alpha-token' });

    const response = await server.fetch('http://example.com/api/sources');
    expect(response.status).toBe(200);
    const json = (await response.json()) as Source[];
    expect(json).toHaveLength(1);
    expect(json[0]?.name).toBe('Alpha');
  });

  it('creates a source with defaults', async () => {
    const response = await server.fetch('http://example.com/api/sources', {
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
    const response = await server.fetch('http://example.com/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(422);
  });

  it('gets a source by id', async () => {
    await insertSource({ id: 1, name: 'Bravo', token: 'bravo-token' });
    const response = await server.fetch('http://example.com/api/sources/1');
    expect(response.status).toBe(200);
    const json = (await response.json()) as Source;
    expect(json.name).toBe('Bravo');
  });

  it('returns 404 for missing sources', async () => {
    const response = await server.fetch('http://example.com/api/sources/999');
    expect(response.status).toBe(404);
  });

  it('returns 422 for invalid source ids', async () => {
    const response = await server.fetch('http://example.com/api/sources/nope');
    expect(response.status).toBe(422);
  });

  it('rejects empty source updates', async () => {
    await insertSource({ id: 1, name: 'Charlie', token: 'charlie-token' });
    const response = await server.fetch('http://example.com/api/sources/1', {
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
    const response = await server.fetch('http://example.com/api/sources/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Delta Updated', retention_days: 30 }),
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as Source;
    expect(json.name).toBe('Delta Updated');
    expect(json.retention_days).toBe(30);
  });

  it('clears retention and leaves old messages intact during cleanup', async () => {
    await insertSource({ retention_days: 1 });
    await insertMessage({
      source_id: 1,
      ses_message_id: 'old',
      sent_at: Date.now() - 10 * 86_400_000,
    });

    const unchanged = await updateSource({ name: 'Renamed' });
    expect(((await unchanged.json()) as Source).retention_days).toBe(1);
    const cleared = await updateSource({ retention_days: null });
    expect(cleared.status).toBe(200);
    expect(((await cleared.json()) as Source).retention_days).toBeNull();
    const cleanup = await server.fetch('http://example.com/api/sources/1/cleanup', {
      method: 'POST',
    });
    expect(await cleanup.json()).toMatchObject({ messages_deleted: 0, events_deleted: 0 });
    expect((await env.DB.prepare('SELECT id FROM messages').all()).results).toHaveLength(1);
  });

  it('deletes a source', async () => {
    await insertSource({ id: 1, name: 'Echo', token: 'echo-token' });
    await insertSource({ id: 2, name: 'Foxtrot', token: 'foxtrot-token' });
    await insertMessage({
      id: 1,
      source_id: 1,
      ses_message_id: 'echo-message',
    });
    await insertMessage({
      id: 2,
      source_id: 2,
      ses_message_id: 'foxtrot-message',
    });
    await insertMessageTags(1, [{ key: 'campaign', value: 'delete-me' }]);
    await insertEvent({
      message_id: 1,
      event_type: 'Delivery',
      recipient_email: 'delete-me@example.com',
      event_at: Date.now(),
    });
    await insertWebhook({
      sns_message_id: 'sns-echo',
      ses_message_id: 'echo-message',
    });
    await insertWebhook({
      sns_message_id: 'sns-foxtrot',
      ses_message_id: 'foxtrot-message',
    });

    const response = await server.fetch('http://example.com/api/sources/1', {
      method: 'DELETE',
    });
    expect(response.status).toBe(204);

    const sources = await env.DB.prepare('SELECT id FROM sources ORDER BY id').all();
    expect(sources.results).toEqual([{ id: 2 }]);
    const messages = await env.DB.prepare('SELECT id FROM messages ORDER BY id').all();
    expect(messages.results).toEqual([{ id: 2 }]);
    const events = await env.DB.prepare('SELECT id FROM events').all();
    expect(events.results).toHaveLength(0);
    const tags = await env.DB.prepare('SELECT id FROM message_tags').all();
    expect(tags.results).toHaveLength(0);
    const webhooks = await env.DB.prepare(
      'SELECT sns_message_id FROM webhooks ORDER BY sns_message_id',
    ).all();
    expect(webhooks.results).toEqual([{ sns_message_id: 'sns-foxtrot' }]);
  });

  it('returns setup guidance variables', async () => {
    await insertSource({ id: 1, name: 'My Source', token: 'tok-1' });
    const response = await server.fetch('http://example.com/api/sources/1/setup');
    expect(response.status).toBe(200);
    const json = (await response.json()) as SetupInfo;
    expect(json.configuration_set_name).toBe('sesnoop-my-source-config');
    expect(json.sns_topic_name).toBe('sesnoop-my-source-sns');
    expect(json.webhook_url).toBe('http://example.com/api/webhooks/tok-1');
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
    });
    await insertEvent({
      message_id: 2,
      event_type: 'Delivery',
      recipient_email: 'new@example.com',
      event_at: now - dayMs,
    });
    await insertWebhook({
      sns_message_id: 'sns-old',
      ses_message_id: 'old-message',
      sns_timestamp: now - 31 * dayMs,
    });
    await insertWebhook({
      sns_message_id: 'sns-new',
      ses_message_id: 'new-message',
      sns_timestamp: now - dayMs,
    });

    const response = await server.fetch('http://example.com/api/sources/1/cleanup', {
      method: 'POST',
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      source_id: number;
      retention_days: number | null;
      messages_deleted: number;
      events_deleted: number;
      webhooks_deleted: number;
    };
    expect(json.source_id).toBe(1);
    expect(json.retention_days).toBe(30);
    expect(json.messages_deleted).toBe(1);
    expect(json.events_deleted).toBe(1);
    expect(json.webhooks_deleted).toBe(1);

    const messages = await env.DB.prepare('SELECT id FROM messages').all();
    expect(messages.results).toHaveLength(1);
    const events = await env.DB.prepare('SELECT id FROM events').all();
    expect(events.results).toHaveLength(1);
    const webhooks = await env.DB.prepare('SELECT sns_message_id FROM webhooks').all();
    expect(webhooks.results).toEqual([{ sns_message_id: 'sns-new' }]);
  });
});
