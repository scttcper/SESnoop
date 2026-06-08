import { sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import * as schema from '../db/schema';
import { events, messages, sources, webhooks } from '../db/schema';

import { EventPayload, normalizeRecipients } from './event-payload';
import type { SnsMessage } from './sns';

type Db = DrizzleD1Database<typeof schema>;
type Source = Pick<typeof sources.$inferSelect, 'id'>;

export function parseNotificationPayload(snsMessage: SnsMessage): EventPayload | null {
  if (!snsMessage.Message) {
    return null;
  }

  let notificationPayload: unknown;
  try {
    notificationPayload = JSON.parse(snsMessage.Message);
  } catch {
    return null;
  }

  const eventPayload = new EventPayload(notificationPayload);
  if (!eventPayload.messageId) {
    return null;
  }

  return eventPayload;
}

async function persistNotification(
  db: Db,
  source: Source,
  snsMessage: SnsMessage,
  snsPayload: unknown,
  eventPayload: EventPayload,
): Promise<void> {
  const recipients = normalizeRecipients(eventPayload.recipients);
  const messageId = sql<number>`(
    select ${messages.id}
    from ${messages}
    where ${messages.source_id} = ${source.id}
      and ${messages.ses_message_id} = ${eventPayload.messageId}
    limit 1
  )`;

  const insertWebhook = db
    .insert(webhooks)
    .values({
      sns_message_id: snsMessage.MessageId,
      sns_type: snsMessage.Type,
      sns_timestamp: snsMessage.Timestamp ? new Date(snsMessage.Timestamp) : new Date(),
      raw_payload: snsPayload,
    })
    .onConflictDoNothing();

  const insertMessage = db
    .insert(messages)
    .values({
      source_id: source.id,
      ses_message_id: eventPayload.messageId,
      source_email: eventPayload.sourceEmail,
      subject: eventPayload.subject,
      sent_at: eventPayload.sentAt,
      mail_metadata: eventPayload.mail,
    })
    .onConflictDoNothing();

  if (recipients.length > 0) {
    const insertEventRows = db
      .insert(events)
      .values(
        recipients.map((recipient) => ({
          message_id: messageId,
          source_id: source.id,
          event_type: eventPayload.eventType,
          recipient_email: recipient,
          event_at: eventPayload.timestamp,
          event_data: eventPayload.eventData,
          bounce_type: eventPayload.bounceType,
        })),
      )
      .onConflictDoNothing();

    await db.batch([insertWebhook, insertMessage, insertEventRows]);
    return;
  }

  await db.batch([insertWebhook, insertMessage]);
}

export async function ingestNotification(
  db: Db,
  source: Source,
  snsMessage: SnsMessage,
  snsPayload: unknown,
  eventPayload: EventPayload,
): Promise<void> {
  await persistNotification(db, source, snsMessage, snsPayload, eventPayload);
}
