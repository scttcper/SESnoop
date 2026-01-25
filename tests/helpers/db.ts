import { env } from 'cloudflare:test';

import { migrationSql } from './migration-sql';

const runStatements = async (sql: string) => {
  const statements = sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
};

export const resetDb = async () => {
  await runStatements(migrationSql);
  await runStatements(
    'DELETE FROM events; DELETE FROM messages; DELETE FROM webhooks; DELETE FROM sources; DELETE FROM tasks;',
  );
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
  mail_metadata?: Record<string, unknown>;
  events_count?: number;
}) => {
  const id = overrides.id ?? 1;
  const subject = overrides.subject ?? null;
  const sourceEmail = overrides.source_email ?? null;
  const sentAt = overrides.sent_at ?? null;
  const mailMetadata = JSON.stringify(overrides.mail_metadata ?? {});
  const eventsCount = overrides.events_count ?? 0;

  await env.DB.prepare(
    `INSERT INTO messages
     (id, source_id, ses_message_id, source_email, subject, sent_at, mail_metadata, events_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch() * 1000, unixepoch() * 1000)`,
  )
    .bind(
      id,
      overrides.source_id,
      overrides.ses_message_id,
      sourceEmail,
      subject,
      sentAt,
      mailMetadata,
      eventsCount,
    )
    .run();

  return { id };
};

export const insertEvent = async (overrides: {
  id?: number;
  message_id: number;
  event_type: string;
  recipient_email: string;
  event_at: number;
  ses_message_id: string;
  bounce_type?: string | null;
}) => {
  const id = overrides.id ?? null;
  const bounceType = overrides.bounce_type ?? null;

  await env.DB.prepare(
    `INSERT INTO events
     (id, message_id, event_type, recipient_email, event_at, ses_message_id, bounce_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch() * 1000, unixepoch() * 1000)`,
  )
    .bind(
      id,
      overrides.message_id,
      overrides.event_type,
      overrides.recipient_email,
      overrides.event_at,
      overrides.ses_message_id,
      bounceType,
    )
    .run();
};
