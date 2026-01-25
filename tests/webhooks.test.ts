import { SELF, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { insertSource, resetDb } from './helpers/db';

beforeEach(async () => {
  await resetDb();
  await insertSource({ name: 'Test', token: 'token-123', color: 'blue' });
});

describe('webhooks ingestion', () => {
  it('returns 400 for invalid JSON', async () => {
    const response = await SELF.fetch('http://example.com/api/webhooks/token-123', {
      method: 'POST',
      body: 'not-json',
    });
    expect(response.status).toBe(400);
  });

  it('ingests notification events idempotently', async () => {
    const eventPayload = {
      eventType: 'Bounce',
      mail: {
        messageId: 'ses-123',
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'sender@example.com',
        destination: ['TEST@EXAMPLE.COM'],
        commonHeaders: {
          subject: 'Hello',
        },
      },
      bounce: {
        bounceType: 'Permanent',
        timestamp: '2025-01-01T00:00:01.000Z',
        bouncedRecipients: [{ emailAddress: 'TEST@EXAMPLE.COM' }],
      },
    };

    const snsMessage = {
      Type: 'Notification',
      MessageId: 'sns-1',
      Message: JSON.stringify(eventPayload),
      Timestamp: '2025-01-01T00:00:02.000Z',
      SignatureVersion: '1',
      Signature: 'ignored',
      SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService.pem',
    };

    const response = await SELF.fetch('http://example.com/api/webhooks/token-123', {
      method: 'POST',
      body: JSON.stringify(snsMessage),
      headers: { 'content-type': 'application/json' },
    });
    expect(response.status).toBe(200);

    const secondResponse = await SELF.fetch('http://example.com/api/webhooks/token-123', {
      method: 'POST',
      body: JSON.stringify(snsMessage),
      headers: { 'content-type': 'application/json' },
    });
    expect(secondResponse.status).toBe(200);

    const messages = await env.DB.prepare(
      'SELECT ses_message_id, events_count FROM messages',
    ).all();
    expect(messages.results).toHaveLength(1);
    expect(messages.results[0]?.ses_message_id).toBe('ses-123');
    expect(messages.results[0]?.events_count).toBe(1);

    const events = await env.DB.prepare('SELECT recipient_email, bounce_type FROM events').all();
    expect(events.results).toHaveLength(1);
    expect(events.results[0]?.recipient_email).toBe('test@example.com');
    expect(events.results[0]?.bounce_type).toBe('Permanent');

    const webhooks = await env.DB.prepare('SELECT processed_at FROM webhooks').all();
    expect(webhooks.results).toHaveLength(1);
    expect(webhooks.results[0]?.processed_at).toBeTruthy();
  });

  it('increments events_count correctly with multiple recipients and duplicates', async () => {
    const eventPayload = {
      eventType: 'Delivery',
      mail: {
        messageId: 'ses-multi',
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'sender@example.com',
        destination: ['a@example.com', 'b@example.com', 'c@example.com'],
        commonHeaders: { subject: 'Multi-recipient' },
      },
      delivery: {
        timestamp: '2025-01-01T00:00:01.000Z',
        recipients: ['a@example.com', 'b@example.com', 'c@example.com'],
      },
    };

    const snsMessage1 = {
      Type: 'Notification',
      MessageId: 'sns-multi-1',
      Message: JSON.stringify(eventPayload),
      Timestamp: '2025-01-01T00:00:02.000Z',
      SignatureVersion: '1',
      Signature: 'ignored',
      SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService.pem',
    };

    const response1 = await SELF.fetch('http://example.com/api/webhooks/token-123', {
      method: 'POST',
      body: JSON.stringify(snsMessage1),
      headers: { 'content-type': 'application/json' },
    });
    expect(response1.status).toBe(200);

    // Check 3 events created, events_count = 3
    let messages = await env.DB.prepare(
      "SELECT events_count FROM messages WHERE ses_message_id = 'ses-multi'",
    ).all();
    expect(messages.results[0]?.events_count).toBe(3);

    // Send a second notification for same message with overlapping recipients
    const eventPayload2 = {
      eventType: 'Open',
      mail: {
        messageId: 'ses-multi',
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'sender@example.com',
        destination: ['a@example.com'],
        commonHeaders: { subject: 'Multi-recipient' },
      },
      open: {
        timestamp: '2025-01-01T00:00:05.000Z',
        ipAddress: '1.2.3.4',
      },
    };

    const snsMessage2 = {
      Type: 'Notification',
      MessageId: 'sns-multi-2',
      Message: JSON.stringify(eventPayload2),
      Timestamp: '2025-01-01T00:00:06.000Z',
      SignatureVersion: '1',
      Signature: 'ignored',
      SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService.pem',
    };

    const response2 = await SELF.fetch('http://example.com/api/webhooks/token-123', {
      method: 'POST',
      body: JSON.stringify(snsMessage2),
      headers: { 'content-type': 'application/json' },
    });
    expect(response2.status).toBe(200);

    // Should now have 4 events (3 deliveries + 1 open)
    messages = await env.DB.prepare(
      "SELECT events_count FROM messages WHERE ses_message_id = 'ses-multi'",
    ).all();
    expect(messages.results[0]?.events_count).toBe(4);

    const events = await env.DB.prepare(
      "SELECT event_type FROM events WHERE ses_message_id = 'ses-multi'",
    ).all();
    expect(events.results).toHaveLength(4);
  });
});
