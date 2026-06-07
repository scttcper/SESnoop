import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import * as schema from '../db/schema';
import { events, messages, sources, webhooks } from '../db/schema';

import { EventPayload, normalizeRecipients } from './event-payload';
import type { SnsMessage } from './sns';

type Db = DrizzleD1Database<typeof schema>;
type Source = typeof sources.$inferSelect;

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
  const webhookId = sql<number>`(
    select ${webhooks.id}
    from ${webhooks}
    where ${webhooks.sns_message_id} = ${snsMessage.MessageId}
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

  const markProcessed = db
    .update(webhooks)
    .set({ processed_at: new Date() })
    .where(eq(webhooks.sns_message_id, snsMessage.MessageId));

  if (recipients.length > 0) {
    const insertEventRows = db
      .insert(events)
      .values(
        recipients.map((recipient) => ({
          message_id: messageId,
          webhook_id: webhookId,
          event_type: eventPayload.eventType,
          recipient_email: recipient,
          event_at: eventPayload.timestamp,
          ses_message_id: eventPayload.messageId,
          event_data: eventPayload.eventData,
          raw_payload: eventPayload.raw,
          bounce_type: eventPayload.bounceType,
        })),
      )
      .onConflictDoNothing();

    await db.batch([insertWebhook, insertMessage, insertEventRows, markProcessed]);
    return;
  }

  await db.batch([insertWebhook, insertMessage, markProcessed]);
}

export async function ingestNotification(
  db: Db,
  source: Source,
  snsMessage: SnsMessage,
  snsPayload: unknown,
  eventPayload: EventPayload,
): Promise<{ alreadyProcessed: boolean }> {
  const webhook = await db.query.webhooks.findFirst({
    where: eq(webhooks.sns_message_id, snsMessage.MessageId),
  });

  if (webhook?.processed_at) {
    return { alreadyProcessed: true };
  }

  await persistNotification(db, source, snsMessage, snsPayload, eventPayload);
  return { alreadyProcessed: false };
}
