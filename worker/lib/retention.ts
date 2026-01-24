import type { AppBindings } from './types'

type RetentionSource = {
  id: number
  retention_days: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000

const toCutoff = (days: number) => Date.now() - days * DAY_MS

export async function runRetentionCleanup(env: AppBindings['Bindings']) {
  const sourcesResult = await env.DB.prepare(
    'SELECT id, retention_days FROM sources WHERE retention_days IS NOT NULL'
  ).all<RetentionSource>()

  if (!sourcesResult.results.length) {
    return
  }

  for (const source of sourcesResult.results) {
    const retentionDays = source.retention_days
    if (!retentionDays || retentionDays <= 0) {
      continue
    }

    const cutoff = toCutoff(retentionDays)

    await env.DB.prepare(
      `DELETE FROM events
       WHERE message_id IN (
         SELECT id FROM messages
         WHERE source_id = ? AND sent_at IS NOT NULL AND sent_at < ?
       )`
    )
      .bind(source.id, cutoff)
      .run()

    await env.DB.prepare(
      `DELETE FROM messages
       WHERE source_id = ? AND sent_at IS NOT NULL AND sent_at < ?`
    )
      .bind(source.id, cutoff)
      .run()
  }
}
