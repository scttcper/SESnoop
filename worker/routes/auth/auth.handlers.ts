import { sign } from '@tsndr/cloudflare-worker-jwt';
import { deleteCookie, setCookie } from 'hono/cookie';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { getAuthConfig } from '../../lib/auth';
import type { AppRouteHandler } from '../../lib/types';

import type { LoginRoute, LogoutRoute, SessionRoute } from './auth.routes';

const toCookieOptions = (requestUrl: string, ttlSeconds: number) => {
  const isSecure = new URL(requestUrl).protocol === 'https:';
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ttlSeconds,
  };
};

export const login: AppRouteHandler<LoginRoute> = async (c) => {
  const config = getAuthConfig(c.env);

  if (!config.configured) {
    return c.json({ error: 'Auth is not configured' }, HttpStatusCodes.BAD_REQUEST);
  }

  if (!config.enabled || !config.secret) {
    return c.json({ error: 'Auth secret not configured' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const { username, password } = c.req.valid('json');
  if (username !== config.username || password !== config.password) {
    return c.json({ error: 'Invalid credentials' }, HttpStatusCodes.UNAUTHORIZED);
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await sign(
    {
      username,
      iat: issuedAt,
      exp: issuedAt + config.ttlSeconds,
    },
    config.secret,
  );

  setCookie(c, config.cookieName, token, toCookieOptions(c.req.url, config.ttlSeconds));

  return c.json({ success: true }, HttpStatusCodes.OK);
};

export const logout: AppRouteHandler<LogoutRoute> = async (c) => {
  const config = getAuthConfig(c.env);
  deleteCookie(c, config.cookieName, {
    path: '/',
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'lax',
  });
  return c.body(null, HttpStatusCodes.NO_CONTENT);
};

export const session: AppRouteHandler<SessionRoute> = async (c) => {
  const config = getAuthConfig(c.env);

  if (!config.configured) {
    return c.json({ enabled: false, user: null }, HttpStatusCodes.OK);
  }

  if (!config.enabled) {
    return c.json({ error: 'Auth secret not configured' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const auth = c.get('auth') as { username: string } | undefined;
  return c.json({ enabled: true, user: auth ?? null }, HttpStatusCodes.OK);
};
