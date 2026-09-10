import { getRouteApi } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';

import {
  controlClassName,
  errorClassName,
  inputClassName,
  labelClassName,
  panelClassName,
  primaryControlClassName,
} from '../components/layout/PageLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AuthError, safeRedirectPath, sessionQueryOptions } from '../lib/auth';
import { queryClient } from '../lib/query-client';
import { cn } from '../lib/utils';

const routeApi = getRouteApi('/login');

export default function LoginPage() {
  const navigate = routeApi.useNavigate();
  const { redirect } = routeApi.useSearch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    queryClient
      .fetchQuery(sessionQueryOptions)
      .then((session) => {
        if (!active) {
          return;
        }
        if (!session.enabled) {
          navigate({ to: '/', replace: true });
          return;
        }
        if (session.user) {
          const target = safeRedirectPath(redirect);
          navigate({ to: target, replace: true });
        }
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        if (err instanceof AuthError) {
          return;
        }
        setError('Unable to check session');
      });

    return () => {
      active = false;
    };
  }, [navigate, redirect]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.status === 401) {
        setError('Invalid username or password.');
        return;
      }

      if (!response.ok) {
        setError('Login failed. Please try again.');
        return;
      }

      const target = safeRedirectPath(redirect);
      await queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey });
      navigate({ to: target, replace: true });
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 text-white sm:px-6">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-semibold tracking-tight text-white/85">
          SESnoop
        </p>
        <div className={cn(panelClassName, 'p-6 sm:p-7')}>
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">Sign in</h1>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="username" className={labelClassName}>
                Username
              </label>
              <Input
                id="username"
                name="username"
                className={inputClassName}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={error ? 'login-error' : undefined}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className={labelClassName}>
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                className={inputClassName}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                aria-describedby={error ? 'login-error' : undefined}
                required
              />
            </div>

            {error ? (
              <p id="login-error" role="alert" className={errorClassName}>
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={loading}
              className={cn(controlClassName, primaryControlClassName, 'mt-2 w-full')}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
