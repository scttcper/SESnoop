import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createDb } from '../../db';
import * as schema from '../../db/schema';
import { events, messages, sources, webhooks } from '../../db/schema';
import { createRouter } from '../../lib/create-app';
import { EventPayload } from '../../lib/event-payload';
import {
  type SnsMessage,
  parseSnsMessage,
  shouldVerifySnsSignature,
  verifySnsSignature,
} from '../../lib/sns';

const router = createRouter();

type Db = DrizzleD1Database<typeof schema>;
type Source = typeof sources.$inferSelect;
type Webhook = typeof webhooks.$inferSelect;
type Message = typeof messages.$inferSelect;

interface WebhookRecord {
  webhook: Webhook;
  alreadyProcessed: boolean;
}

async function handleSubscriptionConfirmation(subscribeUrl: string | undefined): Promise<void> {
  if (subscribeUrl) {
    await fetch(subscribeUrl);
  }
}

async function findOrCreateWebhook(
  db: Db,
  snsMessage: SnsMessage,
  snsPayload: unknown,
): Promise<WebhookRecord> {
  let webhook = await db.query.webhooks.findFirst({
    where: eq(webhooks.sns_message_id, snsMessage.MessageId),
  });

  if (!webhook) {
    await db.insert(webhooks).values({
      sns_message_id: snsMessage.MessageId,
      sns_type: snsMessage.Type,
      sns_timestamp: snsMessage.Timestamp ? new Date(snsMessage.Timestamp) : new Date(),
      raw_payload: snsPayload,
    });

    webhook = await db.query.webhooks.findFirst({
      where: eq(webhooks.sns_message_id, snsMessage.MessageId),
    });
  }

  if (!webhook) {
    throw new Error('Failed to load webhook record');
  }

  return { webhook, alreadyProcessed: !!webhook.processed_at };
}

async function findOrCreateMessage(
  db: Db,
  source: Source,
  eventPayload: EventPayload,
): Promise<Message> {
  let message = await db.query.messages.findFirst({
    where: eq(messages.ses_message_id, eventPayload.messageId!),
  });

  if (!message) {
    await db.insert(messages).values({
      source_id: source.id,
      ses_message_id: eventPayload.messageId!,
      source_email: eventPayload.sourceEmail,
      subject: eventPayload.subject,
      sent_at: eventPayload.sentAt,
      mail_metadata: eventPayload.mail,
    });

    message = await db.query.messages.findFirst({
      where: eq(messages.ses_message_id, eventPayload.messageId!),
    });
  }

  if (!message) {
    throw new Error('Failed to load message record');
  }

  return message;
}

async function insertEvents(
  db: Db,
  message: Message,
  webhook: Webhook,
  eventPayload: EventPayload,
): Promise<number> {
  let insertedCount = 0;
  for (const recipient of eventPayload.recipients) {
    const normalizedRecipient = recipient.trim().toLowerCase();
    const result = await db
      .insert(events)
      .values({
        message_id: message.id,
        webhook_id: webhook.id,
        event_type: eventPayload.eventType,
        recipient_email: normalizedRecipient,
        event_at: eventPayload.timestamp,
        ses_message_id: eventPayload.messageId!,
        event_data: eventPayload.eventData,
        raw_payload: eventPayload.raw,
        bounce_type: eventPayload.bounceType,
      })
      .onConflictDoNothing();
    if (result.meta.changes > 0) {
      insertedCount += 1;
    }
  }
  return insertedCount;
}

async function updateMessageEventCount(db: Db, messageId: number, delta: number): Promise<void> {
  if (delta <= 0) {
    return;
  }
  await db
    .update(messages)
    .set({ events_count: sql`${messages.events_count} + ${delta}` })
    .where(eq(messages.id, messageId));
}

async function markWebhookProcessed(db: Db, webhookId: number): Promise<void> {
  await db.update(webhooks).set({ processed_at: new Date() }).where(eq(webhooks.id, webhookId));
}

async function ingestNotification(
  db: Db,
  source: Source,
  snsMessage: SnsMessage,
  snsPayload: unknown,
  eventPayload: EventPayload,
): Promise<void> {
  const { webhook, alreadyProcessed } = await findOrCreateWebhook(db, snsMessage, snsPayload);

  if (alreadyProcessed) {
    return;
  }

  const message = await findOrCreateMessage(db, source, eventPayload);
  const insertedCount = await insertEvents(db, message, webhook, eventPayload);
  await updateMessageEventCount(db, message.id, insertedCount);
  await markWebhookProcessed(db, webhook.id);
}

function parseNotificationPayload(snsMessage: SnsMessage): EventPayload | null {
  if (!snsMessage.Message) {
    return null;
  }

  let notificationPayload: Record<string, unknown>;
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

// ─────────────────────────────────────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────────────────────────────────────

router.post('/api/webhooks/:source_token', async (c) => {
  const sourceToken = c.req.param('source_token');
  const db = createDb(c.env);

  // Validate source
  const source = await db.query.sources.findFirst({
    where: eq(sources.token, sourceToken),
  });

  if (!source) {
    return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND);
  }

  let snsPayload: unknown;
  try {
    snsPayload = await c.req.json();
  } catch {
    return c.json({ message: 'Invalid JSON' }, HttpStatusCodes.BAD_REQUEST);
  }

  const snsMessage = parseSnsMessage(snsPayload);

  // Verify SNS signature (disabled for local/dev)
  if (shouldVerifySnsSignature(c.env.SNS_DISABLE_SIGNATURE_VERIFY)) {
    const verified = await verifySnsSignature(snsMessage);
    if (!verified) {
      return c.json({ message: 'Invalid SNS signature' }, HttpStatusCodes.FORBIDDEN);
    }
  }

  // Handle SNS message types
  switch (snsMessage.Type) {
    case 'SubscriptionConfirmation': {
      await handleSubscriptionConfirmation(snsMessage.SubscribeURL);
      return c.json({ ok: true }, HttpStatusCodes.OK);
    }
    case 'Notification': {
      const eventPayload = parseNotificationPayload(snsMessage);
      if (!eventPayload) {
        return c.json({ message: 'Invalid notification payload' }, HttpStatusCodes.BAD_REQUEST);
      }

      try {
        await ingestNotification(db, source, snsMessage, snsPayload, eventPayload);
      } catch {
        return c.json(
          { message: 'Webhook ingestion failed' },
          HttpStatusCodes.INTERNAL_SERVER_ERROR,
        );
      }

      return c.json({ ok: true }, HttpStatusCodes.OK);
    }
    case 'UnsubscribeConfirmation': {
      return c.json({ ok: true }, HttpStatusCodes.OK);
    }
    default: {
      return c.json({ message: 'Unknown SNS message type' }, HttpStatusCodes.BAD_REQUEST);
    }
  }
});

export default router;
