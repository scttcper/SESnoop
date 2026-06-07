import { eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createDb } from '../../db';
import { sources } from '../../db/schema';
import { EVENT_TYPE_VALUES } from '../../lib/constants';
import { createRouter } from '../../lib/create-app';
import { parseSnsMessage, shouldVerifySnsSignature, verifySnsSignature } from '../../lib/sns';
import { ingestNotification, parseNotificationPayload } from '../../lib/webhook-ingestion';

const router = createRouter();

type EventType = (typeof EVENT_TYPE_VALUES)[number];

const EVENT_TYPE_BY_LOWERCASE = new Map<string, EventType>(
  EVENT_TYPE_VALUES.map((eventType) => [eventType.toLowerCase(), eventType]),
);

const parseIgnoredEventTypes = (value: string | undefined): Set<EventType> => {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => EVENT_TYPE_BY_LOWERCASE.get(entry.toLowerCase()))
      .filter((eventType): eventType is EventType => Boolean(eventType)),
  );
};

async function handleSubscriptionConfirmation(subscribeUrl: string | undefined): Promise<void> {
  if (subscribeUrl) {
    await fetch(subscribeUrl);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────────────────────────────────────

router.post('/api/webhooks/:source_token', async (c) => {
  const sourceToken = c.req.param('source_token');
  const db = createDb(c.env);
  const ignoredEventTypes = parseIgnoredEventTypes(c.env.IGNORED_SES_EVENT_TYPES);

  // Validate source
  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.token, sourceToken))
    .limit(1);

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

      const eventType = EVENT_TYPE_BY_LOWERCASE.get(eventPayload.eventType.toLowerCase());
      if (eventType && ignoredEventTypes.has(eventType)) {
        return c.json({ ok: true, ignored: true }, HttpStatusCodes.OK);
      }

      try {
        await ingestNotification(db, source, snsMessage, snsPayload, eventPayload);
      } catch (error) {
        console.error('Webhook ingestion failed', error);
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
