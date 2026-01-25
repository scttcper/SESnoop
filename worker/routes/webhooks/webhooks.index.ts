import { eq, sql } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createDb } from '../../db';
import { events, messages, sources, webhooks } from '../../db/schema';
import { createRouter } from '../../lib/create-app';
import { EventPayload } from '../../lib/event-payload';
import { parseSnsMessage, shouldVerifySnsSignature, verifySnsSignature } from '../../lib/sns';

const router = createRouter();

type Db = ReturnType<typeof createDb>;

const runWithOptionalTransaction = async <T>(
  db: Db,
  disableTransactions: boolean,
  fn: (tx: Db) => Promise<T>,
) => {
  if (disableTransactions) {
    return await fn(db);
  }
  return await db.transaction(async (tx) => fn(tx as any));
};

router.post('/webhooks/:source_token', async (c) => {
  const sourceToken = c.req.param('source_token');
  const db = createDb(c.env);

  const source = await db.query.sources.findFirst({
    where: eq(sources.token, sourceToken),
  });

  if (!source) {
    return c.json({ message: 'Not Found' }, HttpStatusCodes.NOT_FOUND);
  }

  const rawBody = await c.req.text();
  let snsPayload: unknown;
  try {
    snsPayload = JSON.parse(rawBody);
  } catch {
    return c.json({ message: 'Invalid JSON' }, HttpStatusCodes.BAD_REQUEST);
  }

  let snsMessage: ReturnType<typeof parseSnsMessage>;
  try {
    snsMessage = parseSnsMessage(snsPayload);
  } catch {
    return c.json({ message: 'Invalid SNS payload' }, HttpStatusCodes.BAD_REQUEST);
  }

  // Set SNS_DISABLE_SIGNATURE_VERIFY=true for local/dev only.
  if (shouldVerifySnsSignature(c.env.SNS_DISABLE_SIGNATURE_VERIFY)) {
    const verified = await verifySnsSignature(snsMessage);
    if (!verified) {
      return c.json({ message: 'Invalid SNS signature' }, HttpStatusCodes.FORBIDDEN);
    }
  }

  switch (snsMessage.Type) {
    case 'SubscriptionConfirmation': {
      if (snsMessage.SubscribeURL) {
        await fetch(snsMessage.SubscribeURL);
      }
      return c.json({ ok: true }, HttpStatusCodes.OK);
    }
    case 'Notification': {
      if (!snsMessage.Message) {
        return c.json({ message: 'Missing SNS Message' }, HttpStatusCodes.BAD_REQUEST);
      }

      let notificationPayload: Record<string, unknown>;
      try {
        notificationPayload = JSON.parse(snsMessage.Message);
      } catch {
        return c.json({ message: 'Invalid SNS Message JSON' }, HttpStatusCodes.BAD_REQUEST);
      }

      const eventPayload = new EventPayload(notificationPayload);
      if (!eventPayload.messageId) {
        return c.json({ message: 'Missing SES message id' }, HttpStatusCodes.BAD_REQUEST);
      }

      try {
        await runWithOptionalTransaction(
          db,
          c.env.DB_DISABLE_TRANSACTIONS === 'true',
          async (tx) => {
            let webhook = await tx.query.webhooks.findFirst({
              where: eq(webhooks.sns_message_id, snsMessage.MessageId),
            });

            if (!webhook) {
              await tx.insert(webhooks).values({
                sns_message_id: snsMessage.MessageId,
                sns_type: snsMessage.Type,
                sns_timestamp: snsMessage.Timestamp ? new Date(snsMessage.Timestamp) : new Date(),
                raw_payload: snsPayload,
              });

              webhook = await tx.query.webhooks.findFirst({
                where: eq(webhooks.sns_message_id, snsMessage.MessageId),
              });
            }

            if (!webhook) {
              throw new Error('Failed to load webhook record');
            }

            if (webhook.processed_at) {
              return;
            }

            let message = await tx.query.messages.findFirst({
              where: eq(messages.ses_message_id, eventPayload.messageId),
            });

            if (!message) {
              await tx.insert(messages).values({
                source_id: source.id,
                ses_message_id: eventPayload.messageId,
                source_email: eventPayload.sourceEmail,
                subject: eventPayload.subject,
                sent_at: eventPayload.sentAt,
                mail_metadata: eventPayload.mail,
              });

              message = await tx.query.messages.findFirst({
                where: eq(messages.ses_message_id, eventPayload.messageId),
              });
            }

            if (!message) {
              throw new Error('Failed to load message record');
            }

            for (const recipient of eventPayload.recipients) {
              const normalizedRecipient = recipient.trim().toLowerCase();
              await tx
                .insert(events)
                .values({
                  message_id: message.id,
                  webhook_id: webhook.id,
                  event_type: eventPayload.eventType,
                  recipient_email: normalizedRecipient,
                  event_at: eventPayload.timestamp,
                  ses_message_id: eventPayload.messageId,
                  event_data: eventPayload.eventData,
                  raw_payload: eventPayload.raw,
                  bounce_type: eventPayload.bounceType,
                })
                .onConflictDoNothing();
            }

            const [countRow] = await tx
              .select({ count: sql<number>`count(*)` })
              .from(events)
              .where(eq(events.message_id, message.id));

            await tx
              .update(messages)
              .set({ events_count: countRow?.count ?? 0 })
              .where(eq(messages.id, message.id));

            await tx
              .update(webhooks)
              .set({ processed_at: new Date() })
              .where(eq(webhooks.id, webhook.id));
          },
        );
      } catch {
        return c.json(
          { message: 'Webhook ingestion failed' },
          HttpStatusCodes.INTERNAL_SERVER_ERROR,
        );
      }

      return c.json({ ok: true }, HttpStatusCodes.OK);
    }
    case 'UnsubscribeConfirmation': {
      console.warn('SNS unsubscribe confirmation received', {
        messageId: snsMessage.MessageId,
        topicArn: snsMessage.TopicArn,
      });
      return c.json({ ok: true }, HttpStatusCodes.OK);
    }
    default: {
      return c.json({ message: 'Unknown SNS message type' }, HttpStatusCodes.BAD_REQUEST);
    }
  }
});

export default router;
