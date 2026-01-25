export type SessionResponse = {
  enabled: boolean;
  user: { username: string } | null;
};

export class AuthError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'AuthError';
  }
}

export const getSession = async (): Promise<SessionResponse> => {
  const response = await fetch('/api/auth/session');
  if (response.status === 401) {
    throw new AuthError();
  }
  if (!response.ok) {
    throw new Error('Failed to load session');
  }
  return (await response.json()) as SessionResponse;
};

export const safeRedirectPath = (value: string | null | undefined) => {
  if (!value) {
    return '/';
  }
  if (value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return '/';
};

export const redirectToLogin = (path?: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (window.location.pathname === '/login') {
    return;
  }
  const redirectTarget = path ?? `${window.location.pathname}${window.location.search}`;
  const next = encodeURIComponent(redirectTarget);
  window.location.assign(`/login?redirect=${next}`);
};
