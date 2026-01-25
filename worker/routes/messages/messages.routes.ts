import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import { notFoundSchema } from '../../lib/constants';

const tags = ['Messages'];

const paramsSchema = z.object({
  id: z.coerce.number(),
  ses_message_id: z.string(),
});

const eventSchema = z.object({
  id: z.number(),
  event_type: z.string(),
  recipient_email: z.string(),
  event_at: z.number(),
});

const messageSchema = z.object({
  id: z.number(),
  ses_message_id: z.string(),
  subject: z.string().nullable(),
  source_email: z.string().nullable(),
  destination_emails: z.array(z.string()),
  sent_at: z.number().nullable(),
  tags: z.array(z.string()),
  mail_metadata: z.record(z.string(), z.any()),
  events_count: z.number(),
  events: z.array(eventSchema),
});

export type MessageDetail = z.infer<typeof messageSchema>;

export const getOne = createRoute({
  path: '/sources/{id}/messages/{ses_message_id}',
  method: 'get',
  request: {
    params: paramsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(messageSchema, 'The requested message with events'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Message not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(paramsSchema),
      'Invalid parameter error',
    ),
  },
});

export type GetOneRoute = typeof getOne;
