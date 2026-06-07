import { desc, eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import { createDb } from '../../db';
import { events } from '../../db/schema';
import {
  extractDestinations,
  extractEventDetail,
  normalizeMailTags,
  toRecord,
} from '../../lib/event-payload';
import type { AppRouteHandler } from '../../lib/types';

import type { GetOneRoute } from './messages.routes';

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const db = createDb(c.env);
  const { id, ses_message_id } = c.req.valid('param');

  const message = await db.query.messages.findFirst({
    where(fields, operators) {
      return operators.and(
        operators.eq(fields.source_id, id),
        operators.eq(fields.ses_message_id, ses_message_id),
      );
    },
  });

  if (!message) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const messageEvents = await db
    .select({
      id: events.id,
      event_type: events.event_type,
      recipient_email: events.recipient_email,
      event_at: events.event_at,
      event_data: events.event_data,
      bounce_type: events.bounce_type,
    })
    .from(events)
    .where(eq(events.message_id, message.id))
    .orderBy(desc(events.event_at));

  const mailMetadata = toRecord(message.mail_metadata);

  return c.json(
    {
      id: message.id,
      ses_message_id: message.ses_message_id,
      subject: message.subject,
      source_email: message.source_email,
      destination_emails: extractDestinations(mailMetadata),
      sent_at: message.sent_at?.getTime() ?? null,
      tags: normalizeMailTags(mailMetadata),
      mail_metadata: mailMetadata,
      events: messageEvents.map((event) => ({
        id: event.id,
        event_type: event.event_type,
        recipient_email: event.recipient_email,
        event_at: event.event_at.getTime(),
        event_detail: extractEventDetail(
          event.event_type,
          toRecord(event.event_data),
          event.bounce_type,
        ),
      })),
    },
    HttpStatusCodes.OK,
  );
};
