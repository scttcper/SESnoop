import { env } from 'cloudflare:test';

export const resetDb = async () => {
  // Clear data in correct order to respect foreign key constraints
  await env.DB.prepare('DELETE FROM message_tags').run();
  await env.DB.prepare('DELETE FROM message_recipients').run();
  await env.DB.prepare('DELETE FROM message_payloads').run();
  await env.DB.prepare('DELETE FROM events').run();
  await env.DB.prepare('DELETE FROM webhooks').run();
  await env.DB.prepare('DELETE FROM messages').run();
  await env.DB.prepare('DELETE FROM sources').run();
};

export const insertMessageTags = async (
  messageId: number,
  tags: Array<{ key: string; value: string }>,
) => {
  for (const tag of tags) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO message_tags (source_id, message_id, key, value)
       SELECT source_id, id, ?, ?
       FROM messages
       WHERE id = ?`,
    )
      .bind(tag.key, tag.value, messageId)
      .run();
  }
};

export const insertWebhook = async (overrides: {
  sns_message_id: string;
  ses_message_id?: string;
  source_id?: number;
  message_id?: number;
  sns_type?: string;
  sns_timestamp?: number;
}) => {
  const snsType = overrides.sns_type ?? 'Notification';
  const snsTimestamp = overrides.sns_timestamp ?? Date.now();

  await env.DB.prepare(
    `INSERT INTO webhooks
     (source_id, message_id, sns_message_id, sns_type, sns_timestamp)
     VALUES (
       COALESCE(?, (SELECT source_id FROM messages WHERE ses_message_id = ? LIMIT 1)),
       COALESCE(?, (SELECT id FROM messages WHERE ses_message_id = ? LIMIT 1)),
       ?,
       ?,
       ?
     )`,
  )
    .bind(
      overrides.source_id ?? null,
      overrides.ses_message_id ?? null,
      overrides.message_id ?? null,
      overrides.ses_message_id ?? null,
      overrides.sns_message_id,
      snsType,
      snsTimestamp,
    )
    .run();
};

export const insertSource = async (overrides?: {
  id?: number;
  name?: string;
  token?: string;
  color?: string;
  retention_days?: number | null;
}) => {
  const id = overrides?.id ?? 1;
  const name = overrides?.name ?? 'Test Source';
  const token = overrides?.token ?? 'token-123';
  const color = overrides?.color ?? 'blue';
  const retention = overrides?.retention_days ?? null;

  await env.DB.prepare(
    `INSERT INTO sources (id, name, token, color, retention_days, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, unixepoch() * 1000, unixepoch() * 1000)`,
  )
    .bind(id, name, token, color, retention)
    .run();

  return { id, name, token, color, retention_days: retention };
};

export const insertMessage = async (overrides: {
  id?: number;
  source_id: number;
  ses_message_id: string;
  subject?: string | null;
  source_email?: string | null;
  sent_at?: number | null;
  mail?: Record<string, unknown>;
}) => {
  const id = overrides.id ?? 1;
  const subject = overrides.subject ?? null;
  const sourceEmail = overrides.source_email ?? null;
  const sentAt = overrides.sent_at ?? null;
  const mailMetadata = JSON.stringify(overrides.mail ?? {});

  await env.DB.prepare(
    `INSERT INTO messages
     (id, source_id, ses_message_id, source_email, subject, sent_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, overrides.source_id, overrides.ses_message_id, sourceEmail, subject, sentAt)
    .run();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO message_payloads (message_id, mail_metadata)
     VALUES (?, ?)`,
  )
    .bind(id, mailMetadata)
    .run();

  const destinations = Array.isArray(overrides.mail?.destination)
    ? overrides.mail.destination.filter((entry): entry is string => typeof entry === 'string')
    : [];

  for (const destination of destinations) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO message_recipients (source_id, message_id, email)
       VALUES (?, ?, ?)`,
    )
      .bind(overrides.source_id, id, destination)
      .run();
  }

  return { id };
};

export const insertEvent = async (overrides: {
  id?: number;
  message_id: number;
  source_id?: number;
  event_type: string;
  recipient_email: string;
  event_at: number;
  bounce_type?: string | null;
  event_data?: Record<string, unknown>;
}) => {
  const id = overrides.id ?? null;
  const bounceType = overrides.bounce_type ?? null;
  const eventData = JSON.stringify(overrides.event_data ?? {});
  // source_id is denormalized onto events; default it from the parent message.
  const sourceId = overrides.source_id ?? null;

  await env.DB.prepare(
    `INSERT INTO events
     (id, message_id, source_id, event_type, recipient_email, event_at, event_data, bounce_type)
     VALUES (?, ?, COALESCE(?, (SELECT source_id FROM messages WHERE id = ?)), ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      overrides.message_id,
      sourceId,
      overrides.message_id,
      overrides.event_type,
      overrides.recipient_email,
      overrides.event_at,
      eventData,
      bounceType,
    )
    .run();
};
