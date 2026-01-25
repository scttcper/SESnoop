import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';

const tags = ['Authentication'];

export const loginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const sessionSchema = z.object({
  enabled: z.boolean(),
  user: z
    .object({
      username: z.string(),
    })
    .nullable(),
});

const loginResponseSchema = z.object({
  success: z.boolean(),
});

const errorSchema = z.object({
  error: z.string(),
});

export const login = createRoute({
  path: '/auth/login',
  method: 'post',
  tags,
  request: {
    body: jsonContentRequired(loginRequestSchema, 'Login credentials'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(loginResponseSchema, 'Login succeeded'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorSchema,
      'Invalid credentials',
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      errorSchema,
      'Auth not configured',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Auth misconfigured',
    ),
  },
});

export const logout = createRoute({
  path: '/auth/logout',
  method: 'post',
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Logged out',
    },
  },
});

export const session = createRoute({
  path: '/auth/session',
  method: 'get',
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(sessionSchema, 'Current auth session'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Auth misconfigured',
    ),
  },
});

export type LoginRoute = typeof login;
export type LogoutRoute = typeof logout;
export type SessionRoute = typeof session;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SessionResponse = z.infer<typeof sessionSchema>;
