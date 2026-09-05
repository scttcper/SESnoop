import { sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import * as schema from '../db/schema';
import {
  events,
  messagePayloads,
  messageRecipients,
  messages,
  messageTags,
  sources,
  webhooks,
} from '../db/schema';

import {
  EventPayload,
  extractDestinations,
  normalizeMailTags,
  normalizeRecipients,
  parseEventDate,
} from './event-payload';
import type { SnsMessage } from './sns';

type Db = DrizzleD1Database<typeof schema>;
type Source = Pick<typeof sources.$inferSelect, 'id'>;

const MAX_MULTI_ROW_INSERT_SIZE = 10;

const uniqueList = (values: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
};

async function forEachChunk<T>(
  values: T[],
  size: number,
  callback: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < values.length; index += size) {
    await callback(values.slice(index, index + size));
  }
}

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

  const eventPayload = new EventPayload(notificationPayload, snsMessage.Timestamp);
  if (
    !eventPayload.messageId ||
    !eventPayload.eventType ||
    !eventPayload.timestamp ||
    !parseEventDate(snsMessage.Timestamp)
  ) {
    return null;
  }

  return eventPayload;
}

async function persistNotification(
  db: Db,
  source: Source,
  snsMessage: SnsMessage,
  _snsPayload: unknown,
  eventPayload: EventPayload,
): Promise<void> {
  const recipients = normalizeRecipients(eventPayload.recipients);
  const eventType = eventPayload.eventType;
  if (!eventType) {
    return;
  }
  const timestamp = eventPayload.timestamp;
  const snsTimestamp = parseEventDate(snsMessage.Timestamp);
  if (!timestamp || !snsTimestamp) {
    throw new Error('Missing valid notification timestamp');
  }
  const destinations = uniqueList(extractDestinations(eventPayload.mail));

  const messageId = sql<number>`(
    select ${messages.id}
    from ${messages}
    where ${messages.source_id} = ${source.id}
      and ${messages.ses_message_id} = ${eventPayload.messageId}
    limit 1
  )`;

  const insertMessage = db
    .insert(messages)
    .values({
      source_id: source.id,
      ses_message_id: eventPayload.messageId,
      source_email: eventPayload.sourceEmail,
      subject: eventPayload.subject,
      sent_at: eventPayload.sentAt,
    })
    .onConflictDoNothing();

  const insertMessagePayload = db
    .insert(messagePayloads)
    .values({
      message_id: messageId,
      mail_metadata: eventPayload.mailMetadata,
    })
    .onConflictDoNothing();

  const insertWebhook = db
    .insert(webhooks)
    .values({
      source_id: source.id,
      message_id: messageId,
      sns_message_id: snsMessage.MessageId,
      sns_type: snsMessage.Type,
      sns_timestamp: snsTimestamp,
    })
    .onConflictDoNothing();

  await db.batch([insertMessage, insertMessagePayload, insertWebhook]);

  await forEachChunk(destinations, MAX_MULTI_ROW_INSERT_SIZE, async (chunk) => {
    await db
      .insert(messageRecipients)
      .values(
        chunk.map((recipient) => ({
          source_id: source.id,
          message_id: messageId,
          email: recipient,
        })),
      )
      .onConflictDoNothing();
  });

  const normalizedTags = normalizeMailTags(eventPayload.mail);
  await forEachChunk(normalizedTags, MAX_MULTI_ROW_INSERT_SIZE, async (chunk) => {
    await db
      .insert(messageTags)
      .values(
        chunk.map((tag) => ({
          source_id: source.id,
          message_id: messageId,
          key: tag.key,
          value: tag.value,
        })),
      )
      .onConflictDoNothing();
  });

  if (recipients.length > 0) {
    await forEachChunk(recipients, MAX_MULTI_ROW_INSERT_SIZE, async (chunk) => {
      await db
        .insert(events)
        .values(
          chunk.map((recipient) => ({
            message_id: messageId,
            source_id: source.id,
            event_type: eventType,
            recipient_email: recipient,
            event_at: timestamp,
            event_data: eventPayload.eventData,
            bounce_type: eventPayload.bounceType,
          })),
        )
        .onConflictDoNothing();
    });
  }
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
