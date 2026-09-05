import { SELF, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { insertSource, resetDb } from './helpers/db';

const testEnv = env as typeof env & {
  IGNORED_SES_EVENT_TYPES?: string;
};

beforeEach(async () => {
  testEnv.IGNORED_SES_EVENT_TYPES = undefined;
  await resetDb();
  await insertSource({ name: 'Test', token: 'token-123', color: 'blue' });
});

const buildOpenNotification = (messageId: string, timestamp: string) => ({
  Type: 'Notification',
  MessageId: messageId,
  Message: JSON.stringify({
    eventType: 'Open',
    mail: {
      messageId: 'ses-open-repeat',
      timestamp: '2025-01-01T00:00:00.000Z',
      source: 'sender@example.com',
      destination: ['reader@example.com'],
      commonHeaders: { subject: 'Repeated open' },
    },
    open: {
      timestamp,
    },
  }),
  Timestamp: timestamp,
  SignatureVersion: '1',
  Signature: 'ignored',
  SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService.pem',
});

describe('webhooks ingestion', () => {
  it('returns 400 for invalid JSON', async () => {
    const response = await SELF.fetch('http://example.com/api/webhooks/token-123', {
      method: 'POST',
      body: 'not-json',
    });
    expect(response.status).toBe(400);
  });

  it('returns 400 for unknown SES event types', async () => {
    const snsMessage = {
      Type: 'Notification',
      MessageId: 'sns-unknown-1',
      Message: JSON.stringify({
        eventType: 'UnexpectedType',
        mail: {
          messageId: 'ses-unknown',
          timestamp: '2025-01-01T00:00:00.000Z',
          source: 'sender@example.com',
          destination: ['reader@example.com'],
        },
      }),
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

    expect(response.status).toBe(400);

    const events = await env.DB.prepare('SELECT id FROM events').all();
    expect(events.results).toHaveLength(0);
  });

  it('stores rendering failure notifications with canonical event type', async () => {
    const snsMessage = {
      Type: 'Notification',
      MessageId: 'sns-rendering-1',
      Message: JSON.stringify({
        eventType: 'Rendering Failure',
        mail: {
          messageId: 'ses-rendering',
          timestamp: '2025-01-01T00:00:00.000Z',
          source: 'sender@example.com',
          destination: ['reader@example.com'],
          commonHeaders: { subject: 'Template render' },
        },
        failure: {
          errorMessage: 'Missing template data',
        },
      }),
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

    const events = await env.DB.prepare('SELECT event_type FROM events').all();
    expect(events.results).toEqual([{ event_type: 'RenderingFailure' }]);
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
        tags: {
          campaign: ['spring', 'spring'],
          environment: 'prod',
          'ses:configuration-set': ['ignored'],
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

    const messages = await env.DB.prepare('SELECT ses_message_id FROM messages').all();
    expect(messages.results).toHaveLength(1);
    expect(messages.results[0]?.ses_message_id).toBe('ses-123');

    const events = await env.DB.prepare(
      `SELECT events.recipient_email, events.bounce_type, events.source_id, messages.source_id AS message_source_id
       FROM events
       INNER JOIN messages ON events.message_id = messages.id`,
    ).all();
    expect(events.results).toHaveLength(1);
    expect(events.results[0]?.recipient_email).toBe('test@example.com');
    expect(events.results[0]?.bounce_type).toBe('Permanent');
    // Ingestion must denormalize source_id onto the event, matching its message.
    expect(events.results[0]?.source_id).toBe(events.results[0]?.message_source_id);

    const webhooks = await env.DB.prepare(
      `SELECT webhooks.sns_message_id, webhooks.source_id, webhooks.message_id
       FROM webhooks
       INNER JOIN messages ON messages.id = webhooks.message_id`,
    ).all();
    expect(webhooks.results).toHaveLength(1);
    expect(webhooks.results[0]?.sns_message_id).toBe('sns-1');
    expect(webhooks.results[0]?.source_id).toBe(1);

    const payloads = await env.DB.prepare(
      `SELECT message_payloads.mail_metadata
       FROM message_payloads
       INNER JOIN messages ON messages.id = message_payloads.message_id`,
    ).all<{ mail_metadata: string }>();
    expect(JSON.parse(payloads.results[0]?.mail_metadata ?? '{}')).toEqual(
      expect.objectContaining({
        messageId: 'ses-123',
      }),
    );

    const recipients = await env.DB.prepare(
      `SELECT email
       FROM message_recipients
       ORDER BY email`,
    ).all();
    expect(recipients.results).toEqual([{ email: 'TEST@EXAMPLE.COM' }]);

    const tags = await env.DB.prepare(
      `SELECT key, value
       FROM message_tags
       ORDER BY key, value`,
    ).all();
    expect(tags.results).toEqual([
      { key: 'campaign', value: 'spring' },
      { key: 'environment', value: 'prod' },
    ]);
  });

  it('creates events for multiple notifications and recipients', async () => {
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

    let events = await env.DB.prepare(
      `SELECT events.event_type
       FROM events
       INNER JOIN messages ON events.message_id = messages.id
       WHERE messages.ses_message_id = 'ses-multi'`,
    ).all();
    expect(events.results).toHaveLength(3);

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

    events = await env.DB.prepare(
      `SELECT events.event_type, events.event_at
       FROM events
       INNER JOIN messages ON events.message_id = messages.id
       WHERE messages.ses_message_id = 'ses-multi'`,
    ).all();
    expect(events.results).toHaveLength(4);
    expect(events.results).toContainEqual(
      expect.objectContaining({
        event_type: 'Open',
        event_at: Date.parse('2025-01-01T00:00:05.000Z'),
      }),
    );
  });

  it('stores repeated open events at their open timestamps', async () => {
    for (const snsMessage of [
      buildOpenNotification('sns-open-1', '2025-01-01T00:00:05.000Z'),
      buildOpenNotification('sns-open-2', '2025-01-01T00:00:10.000Z'),
    ]) {
      const response = await SELF.fetch('http://example.com/api/webhooks/token-123', {
        method: 'POST',
        body: JSON.stringify(snsMessage),
        headers: { 'content-type': 'application/json' },
      });
      expect(response.status).toBe(200);
    }

    const events = await env.DB.prepare(
      `SELECT events.event_at
       FROM events
       INNER JOIN messages ON events.message_id = messages.id
       WHERE messages.ses_message_id = 'ses-open-repeat'
       ORDER BY events.event_at`,
    ).all();

    expect(events.results).toEqual([
      { event_at: Date.parse('2025-01-01T00:00:05.000Z') },
      { event_at: Date.parse('2025-01-01T00:00:10.000Z') },
    ]);
  });

  it('acknowledges ignored event types without storing them', async () => {
    testEnv.IGNORED_SES_EVENT_TYPES = 'Open, click';

    const eventPayload = {
      eventType: 'Open',
      mail: {
        messageId: 'ses-ignored',
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'sender@example.com',
        destination: ['reader@example.com'],
        commonHeaders: {
          subject: 'Ignored',
        },
      },
      open: {
        timestamp: '2025-01-01T00:00:01.000Z',
      },
    };

    const snsMessage = {
      Type: 'Notification',
      MessageId: 'sns-ignored-1',
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
    await expect(response.json()).resolves.toEqual({ ok: true, ignored: true });

    const messages = await env.DB.prepare('SELECT id FROM messages').all();
    expect(messages.results).toHaveLength(0);

    const events = await env.DB.prepare('SELECT id FROM events').all();
    expect(events.results).toHaveLength(0);

    const webhooks = await env.DB.prepare('SELECT id FROM webhooks').all();
    expect(webhooks.results).toHaveLength(0);
  });
});

const postNotification = (notification: unknown) =>
  SELF.fetch('http://example.com/api/webhooks/token-123', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(notification),
  });

describe('notification fidelity and retries', () => {
  it('rejects invalid SNS envelopes and notifications without any stable timestamp', async () => {
    expect((await postNotification({})).status).toBe(400);
    const notification = buildOpenNotification('sns-invalid-date', 'invalid');
    expect((await postNotification(notification)).status).toBe(400);
    expect((await env.DB.prepare('SELECT id FROM events').all()).results).toHaveLength(0);
  });

  it.each([undefined, 'invalid'])(
    'uses the SNS timestamp for a missing or invalid event timestamp: %s',
    async (timestamp) => {
      const notification = buildOpenNotification('sns-fallback', '2025-01-02T00:00:00Z');
      const payload = JSON.parse(notification.Message);
      payload.open.timestamp = timestamp;
      notification.Message = JSON.stringify(payload);
      expect((await postNotification(notification)).status).toBe(200);
      expect((await postNotification(notification)).status).toBe(200);
      expect((await env.DB.prepare('SELECT event_at FROM events').all()).results).toEqual([
        { event_at: Date.parse(notification.Timestamp) },
      ]);
      expect((await env.DB.prepare('SELECT id FROM webhooks').all()).results).toHaveLength(1);
    },
  );

  it('recovers missing event rows when retrying a partially persisted notification', async () => {
    const notification = buildOpenNotification('sns-partial', '2025-01-02T00:00:00Z');
    expect((await postNotification(notification)).status).toBe(200);
    await env.DB.prepare('DELETE FROM events').run();
    expect((await postNotification(notification)).status).toBe(200);
    expect((await env.DB.prepare('SELECT id FROM events').all()).results).toHaveLength(1);
    expect((await env.DB.prepare('SELECT id FROM webhooks').all()).results).toHaveLength(1);
  });

  it('preserves the original click and mail metadata', async () => {
    const notification = buildOpenNotification('sns-click', '2025-01-02T00:00:00Z');
    const payload = JSON.parse(notification.Message);
    payload.eventType = 'Click';
    payload.click = {
      timestamp: notification.Timestamp,
      link: 'https://example.com/path',
      ipAddress: '192.0.2.1',
      userAgent: 'test',
      linkTags: { campaign: ['spring'] },
    };
    payload.mail.headers = [{ name: 'X-Custom', value: 'preserve me' }];
    payload.mail.commonHeaders.to = ['reader@example.com'];
    notification.Message = JSON.stringify(payload);
    expect((await postNotification(notification)).status).toBe(200);
    const event = await env.DB.prepare('SELECT event_data FROM events').first<{
      event_data: string;
    }>();
    const mail = await env.DB.prepare('SELECT mail_metadata FROM message_payloads').first<{
      mail_metadata: string;
    }>();
    expect(JSON.parse(event!.event_data)).toEqual(payload.click);
    expect(JSON.parse(mail!.mail_metadata)).toEqual(payload.mail);
  });
});
