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
  webhooks_deleted: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toCutoff = (days: number) => Date.now() - days * DAY_MS;

type WebhookCleanupOptions = {
  sentBefore?: number;
};

type CountResult = {
  count: number;
};

export async function deleteWebhooksForSourceMessages(
  env: AppBindings['Bindings'],
  sourceId: number,
  options: WebhookCleanupOptions = {},
): Promise<number> {
  const sentBefore = options.sentBefore;
  const query =
    sentBefore == null
      ? `DELETE FROM webhooks WHERE source_id = ?`
      : `DELETE FROM webhooks
         WHERE id IN (
           SELECT webhooks.id
           FROM webhooks
           INNER JOIN messages ON messages.id = webhooks.message_id
           WHERE webhooks.source_id = ?
             AND messages.sent_at IS NOT NULL
             AND messages.sent_at < ?
         )`;
  const bindings = sentBefore == null ? [sourceId] : [sourceId, sentBefore];

  const result = await env.DB.prepare(query)
    .bind(...bindings)
    .run();

  return result.meta?.changes ?? 0;
}

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
      webhooks_deleted: 0,
    };
  }

  const cutoff = toCutoff(retentionDays);

  const webhooksDeleted = await deleteWebhooksForSourceMessages(env, source.id, {
    sentBefore: cutoff,
  });

  const messagesCountResult = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM messages
     WHERE source_id = ? AND sent_at IS NOT NULL AND sent_at < ?`,
  )
    .bind(source.id, cutoff)
    .first<CountResult>();

  const eventsCountResult = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM events
     WHERE message_id IN (
       SELECT id FROM messages
       WHERE source_id = ? AND sent_at IS NOT NULL AND sent_at < ?
     )`,
  )
    .bind(source.id, cutoff)
    .first<CountResult>();

  await env.DB.prepare(
    `DELETE FROM events
     WHERE message_id IN (
       SELECT id FROM messages
       WHERE source_id = ? AND sent_at IS NOT NULL AND sent_at < ?
     )`,
  )
    .bind(source.id, cutoff)
    .run();

  await env.DB.prepare(
    `DELETE FROM messages
     WHERE source_id = ? AND sent_at IS NOT NULL AND sent_at < ?`,
  )
    .bind(source.id, cutoff)
    .run();

  return {
    source_id: source.id,
    retention_days: retentionDays,
    messages_deleted: messagesCountResult?.count ?? 0,
    events_deleted: eventsCountResult?.count ?? 0,
    webhooks_deleted: webhooksDeleted,
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
