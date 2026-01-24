import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent } from 'stoker/openapi/helpers'
import { createErrorSchema, IdParamsSchema } from 'stoker/openapi/schemas'

import { notFoundSchema } from '../../lib/constants'

const tags = ['Events']

const datePresetSchema = z.enum([
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'last_45_days',
  'last_90_days',
  'all_time',
])

const listQuerySchema = z.object({
  search: z.string().optional(),
  event_types: z.string().optional(),
  bounce_types: z.string().optional(),
  date_range: datePresetSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.string().optional(),
  per_page: z.string().optional(),
})

const eventRowSchema = z.object({
  id: z.number(),
  event_type: z.string(),
  recipient_email: z.string(),
  event_at: z.number(),
  ses_message_id: z.string(),
  bounce_type: z.string().nullable(),
  message_subject: z.string().nullable(),
})

const responseSchema = z.object({
  data: z.array(eventRowSchema),
  pagination: z.object({
    page: z.number(),
    per_page: z.number(),
    total: z.number(),
    total_pages: z.number(),
  }),
  counts: z.object({
    event_types: z.record(z.string(), z.number()),
    bounce_types: z.record(z.string(), z.number()),
  }),
})

export const list = createRoute({
  path: '/sources/{id}/events',
  method: 'get',
  request: {
    params: IdParamsSchema,
    query: listQuerySchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      responseSchema,
      'Filtered events for the source'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      'Source not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(listQuerySchema).or(createErrorSchema(IdParamsSchema)),
      'The validation error(s)'
    ),
  },
})

export type ListRoute = typeof list
