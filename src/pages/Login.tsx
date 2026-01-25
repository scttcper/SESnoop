import { getRouteApi } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AuthError, getSession, safeRedirectPath } from '../lib/auth';

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
    getSession()
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
      navigate({ to: target, replace: true });
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B0C0E] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.4)]">
          <div className="mb-8 space-y-2">
            <p className="text-xs tracking-[0.3em] text-white/40">SESnoop</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-white/60">Enter your credentials to access the dashboard.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-widest text-white/50 uppercase">
                Username
              </label>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-widest text-white/50 uppercase">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
              />
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black hover:bg-white/90"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
