import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema, IdParamsSchema } from 'stoker/openapi/schemas';

import { insertSourcesSchema, patchSourcesSchema, selectSourcesSchema } from '../../db/schema';
import { notFoundSchema } from '../../lib/constants';

const tags = ['Sources'];

const setupSchema = z.object({
  source: selectSourcesSchema,
  configuration_set_name: z.string(),
  sns_topic_name: z.string(),
  webhook_url: z.string().url(),
  steps: z.array(z.string()),
});

export type SetupInfo = z.infer<typeof setupSchema>;

export const list = createRoute({
  path: '/sources',
  method: 'get',
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectSourcesSchema), 'The list of sources'),
  },
});

const internalErrorSchema = z.object({
  message: z.string(),
});

export const create = createRoute({
  path: '/sources',
  method: 'post',
  request: {
    body: jsonContentRequired(insertSourcesSchema, 'The source to create'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectSourcesSchema, 'The created source'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertSourcesSchema),
      'The validation error(s)',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      internalErrorSchema,
      'Internal server error',
    ),
  },
});

export const getOne = createRoute({
  path: '/sources/{id}',
  method: 'get',
  request: {
    params: IdParamsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectSourcesSchema, 'The requested source'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Source not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      'Invalid id error',
    ),
  },
});

export const patch = createRoute({
  path: '/sources/{id}',
  method: 'patch',
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(patchSourcesSchema, 'The source updates'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectSourcesSchema, 'The updated source'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Source not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(patchSourcesSchema).or(createErrorSchema(IdParamsSchema)),
      'The validation error(s)',
    ),
  },
});

export const remove = createRoute({
  path: '/sources/{id}',
  method: 'delete',
  request: {
    params: IdParamsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Source deleted',
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Source not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      'Invalid id error',
    ),
  },
});

export const setup = createRoute({
  path: '/sources/{id}/setup',
  method: 'get',
  request: {
    params: IdParamsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(setupSchema, 'Setup guidance for the source'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Source not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      'Invalid id error',
    ),
  },
});

export type ListRoute = typeof list;
export type CreateRoute = typeof create;
export type GetOneRoute = typeof getOne;
export type PatchRoute = typeof patch;
export type RemoveRoute = typeof remove;
export type SetupRoute = typeof setup;
