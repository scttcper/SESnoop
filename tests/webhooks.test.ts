import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

const schemaSql = `
CREATE TABLE IF NOT EXISTS sources (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  name text NOT NULL,
  token text NOT NULL,
  color text NOT NULL,
  retention_days integer,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sources_token_unique ON sources (token);

CREATE TABLE IF NOT EXISTS messages (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  source_id integer NOT NULL,
  ses_message_id text NOT NULL,
  source_email text,
  subject text,
  sent_at integer,
  mail_metadata text DEFAULT '{}' NOT NULL,
  events_count integer DEFAULT 0 NOT NULL,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS messages_ses_message_id_unique ON messages (ses_message_id);

CREATE TABLE IF NOT EXISTS webhooks (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  sns_message_id text NOT NULL,
  sns_type text NOT NULL,
  sns_timestamp integer NOT NULL,
  raw_payload text DEFAULT '{}' NOT NULL,
  processed_at integer,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS webhooks_sns_message_id_unique ON webhooks (sns_message_id);

CREATE TABLE IF NOT EXISTS events (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  message_id integer NOT NULL,
  webhook_id integer,
  event_type text NOT NULL,
  recipient_email text NOT NULL,
  event_at integer NOT NULL,
  ses_message_id text NOT NULL,
  event_data text DEFAULT '{}' NOT NULL,
  raw_payload text DEFAULT '{}' NOT NULL,
  bounce_type text,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS events_dedupe_unique ON events (
  ses_message_id,
  event_type,
  recipient_email,
  event_at
);
`

const runStatements = async (sql: string) => {
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await env.DB.prepare(statement).run()
  }
}

beforeEach(async () => {
  await runStatements(schemaSql)
  await runStatements(
    'DELETE FROM events; DELETE FROM messages; DELETE FROM webhooks; DELETE FROM sources;'
  )
  await env.DB.prepare(
    "INSERT INTO sources (name, token, color, created_at, updated_at) VALUES ('Test', 'token-123', 'blue', unixepoch() * 1000, unixepoch() * 1000);"
  ).run()

})

describe('webhooks ingestion', () => {
  it('returns 400 for invalid JSON', async () => {
    const response = await SELF.fetch('http://example.com/webhooks/token-123', {
      method: 'POST',
      body: 'not-json',
    })
    expect(response.status).toBe(400)
  })

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
    }

    const snsMessage = {
      Type: 'Notification',
      MessageId: 'sns-1',
      Message: JSON.stringify(eventPayload),
      Timestamp: '2025-01-01T00:00:02.000Z',
      SignatureVersion: '1',
      Signature: 'ignored',
      SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService.pem',
    }

    const response = await SELF.fetch('http://example.com/webhooks/token-123', {
      method: 'POST',
      body: JSON.stringify(snsMessage),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(200)

    const secondResponse = await SELF.fetch(
      'http://example.com/webhooks/token-123',
      {
        method: 'POST',
        body: JSON.stringify(snsMessage),
        headers: { 'content-type': 'application/json' },
      }
    )
    expect(secondResponse.status).toBe(200)

    const messages = await env.DB.prepare(
      'SELECT ses_message_id, events_count FROM messages'
    ).all()
    expect(messages.results).toHaveLength(1)
    expect(messages.results[0]?.ses_message_id).toBe('ses-123')
    expect(messages.results[0]?.events_count).toBe(1)

    const events = await env.DB.prepare(
      'SELECT recipient_email, bounce_type FROM events'
    ).all()
    expect(events.results).toHaveLength(1)
    expect(events.results[0]?.recipient_email).toBe('test@example.com')
    expect(events.results[0]?.bounce_type).toBe('Permanent')

    const webhooks = await env.DB.prepare(
      'SELECT processed_at FROM webhooks'
    ).all()
    expect(webhooks.results).toHaveLength(1)
    expect(webhooks.results[0]?.processed_at).toBeTruthy()
  })
})
