import { desc, eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import { createDb } from '../../db';
import { events, messages } from '../../db/schema';
import type { AppRouteHandler } from '../../lib/types';

import type { GetOneRoute } from './messages.routes';

const parseJsonRecord = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const normalizeTags = (mail: Record<string, unknown>): string[] => {
  const tagsValue = mail.tags;
  if (!tagsValue || typeof tagsValue !== 'object') {
    return [];
  }
  const tags = tagsValue as Record<string, unknown>;
  return Object.entries(tags)
    .filter(([key]) => !key.toLowerCase().startsWith('ses:'))
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value
          .map((entry) => (typeof entry === 'string' ? `${key}:${entry}` : null))
          .filter((entry): entry is string => Boolean(entry));
      }
      if (typeof value === 'string') {
        return [`${key}:${value}`];
      }
      return [key];
    });
};

const extractDestinations = (mail: Record<string, unknown>): string[] => {
  const destination = mail.destination;
  if (!Array.isArray(destination)) {
    return [];
  }
  return destination.filter((entry): entry is string => typeof entry === 'string');
};

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
    })
    .from(events)
    .where(eq(events.message_id, message.id))
    .orderBy(desc(events.event_at));

  const mailMetadata = parseJsonRecord(message.mail_metadata);

  return c.json(
    {
      id: message.id,
      ses_message_id: message.ses_message_id,
      subject: message.subject,
      source_email: message.source_email,
      destination_emails: extractDestinations(mailMetadata),
      sent_at: message.sent_at?.getTime() ?? null,
      tags: normalizeTags(mailMetadata),
      mail_metadata: mailMetadata,
      events_count: message.events_count,
      events: messageEvents.map((event) => ({
        ...event,
        event_at: event.event_at.getTime(),
      })),
    },
    HttpStatusCodes.OK,
  );
};
