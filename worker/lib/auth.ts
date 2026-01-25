import { verify } from '@tsndr/cloudflare-worker-jwt';
import { getCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppBindings } from './types';

export const DEFAULT_AUTH_COOKIE_NAME = 'sesnoop_auth';
export const DEFAULT_AUTH_TTL_SECONDS = 60 * 60 * 24 * 30;

export type AuthSession = {
  username: string;
};

type AuthConfig = {
  username?: string;
  password?: string;
  secret?: string;
  cookieName: string;
  ttlSeconds: number;
  configured: boolean;
  enabled: boolean;
};

const parseTtlSeconds = (value: string | undefined) => {
  if (!value) {
    return DEFAULT_AUTH_TTL_SECONDS;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_AUTH_TTL_SECONDS;
  }
  return Math.floor(parsed);
};

export const getAuthConfig = (env: AppBindings['Bindings']): AuthConfig => {
  const username = env.AUTH_USERNAME;
  const password = env.AUTH_PASSWORD;
  const secret = env.AUTH_JWT_SECRET;
  const configured = Boolean(username && password);

  return {
    username,
    password,
    secret,
    cookieName: env.AUTH_COOKIE_NAME ?? DEFAULT_AUTH_COOKIE_NAME,
    ttlSeconds: parseTtlSeconds(env.AUTH_COOKIE_TTL_SECONDS),
    configured,
    enabled: configured && Boolean(secret),
  };
};

const unauthorized = () =>
  new Response('Unauthorized', {
    status: HttpStatusCodes.UNAUTHORIZED,
  });

export const authMiddleware = (): MiddlewareHandler<AppBindings> => async (c, next) => {
  if (c.req.path.startsWith('/api/webhooks')) {
    return next();
  }

  if (c.req.path.startsWith('/api/auth/login') || c.req.path.startsWith('/api/auth/logout')) {
    return next();
  }

  const config = getAuthConfig(c.env);
  if (!config.configured) {
    return next();
  }

  if (!config.enabled) {
    return new Response('Auth secret not configured', {
      status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
    });
  }

  const token = getCookie(c, config.cookieName);
  if (!token) {
    return unauthorized();
  }

  const verified = await verify<AuthSession>(token, config.secret);
  const payload = verified?.payload;
  if (!payload?.username || payload.username !== config.username) {
    return unauthorized();
  }

  c.set('auth', { username: payload.username } satisfies AuthSession);

  return next();
};
