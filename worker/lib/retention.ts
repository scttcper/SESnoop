import type { AppBindings } from './types';

type RetentionSource = {
  id: number;
  retention_days: number | null;
};

export type RetentionCleanupResult = {
  source_id: number;
  retention_days: number | null;
  messages_deleted: number;
  events_deleted: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toCutoff = (days: number) => Date.now() - days * DAY_MS;

export async function runRetentionCleanupForSource(
  env: AppBindings['Bindings'],
  source: RetentionSource,
): Promise<RetentionCleanupResult> {
  const retentionDays = source.retention_days;
  if (!retentionDays || retentionDays <= 0) {
    return {
      source_id: source.id,
      retention_days: retentionDays ?? null,
      messages_deleted: 0,
      events_deleted: 0,
    };
  }

  const cutoff = toCutoff(retentionDays);

  const eventsResult = await env.DB.prepare(
    `DELETE FROM events
     WHERE message_id IN (
       SELECT id FROM messages
       WHERE source_id = ? AND sent_at IS NOT NULL AND sent_at < ?
     )`,
  )
    .bind(source.id, cutoff)
    .run();

  const messagesResult = await env.DB.prepare(
    `DELETE FROM messages
     WHERE source_id = ? AND sent_at IS NOT NULL AND sent_at < ?`,
  )
    .bind(source.id, cutoff)
    .run();

  return {
    source_id: source.id,
    retention_days: retentionDays,
    messages_deleted: messagesResult.meta?.changes ?? 0,
    events_deleted: eventsResult.meta?.changes ?? 0,
  };
}

export async function runRetentionCleanup(env: AppBindings['Bindings']) {
  const sourcesResult = await env.DB.prepare(
    'SELECT id, retention_days FROM sources WHERE retention_days IS NOT NULL',
  ).all<RetentionSource>();

  if (sourcesResult.results.length === 0) {
    return;
  }

  for (const source of sourcesResult.results) {
    await runRetentionCleanupForSource(env, source);
  }
}
