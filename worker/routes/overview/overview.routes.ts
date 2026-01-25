import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { createErrorSchema, IdParamsSchema } from 'stoker/openapi/schemas';

import { notFoundSchema } from '../../lib/constants';

const tags = ['Overview'];

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const responseSchema = z.object({
  source_id: z.number(),
  range: z.object({
    from: z.string(),
    to: z.string(),
  }),
  metrics: z.object({
    sent: z.number(),
    delivered: z.number(),
    bounced: z.number(),
    complaints: z.number(),
    opens: z.number(),
    clicks: z.number(),
    sent_today: z.number(),
    unique_opens: z.number(),
    unique_clicks: z.number(),
    bounce_rate: z.number(),
    complaint_rate: z.number(),
    open_rate: z.number(),
    click_rate: z.number(),
  }),
  chart: z.object({
    days: z.array(z.string()),
    sent: z.array(z.number()),
    delivered: z.array(z.number()),
    bounced: z.array(z.number()),
  }),
  bounce_breakdown: z.array(
    z.object({
      bounce_type: z.string(),
      count: z.number(),
    }),
  ),
});

export type OverviewResponse = z.infer<typeof responseSchema>;

export const get = createRoute({
  path: '/sources/{id}/overview',
  method: 'get',
  request: {
    params: IdParamsSchema,
    query: querySchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(responseSchema, 'Overview metrics for the source'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Source not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(querySchema).or(createErrorSchema(IdParamsSchema)),
      'Invalid parameter error',
    ),
  },
});

export type GetRoute = typeof get;
