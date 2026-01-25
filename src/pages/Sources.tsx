import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus, Settings, Activity } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { createSourceFn, sourcesQueryOptions } from '../lib/queries';
import { COLOR_STYLES, COLORS, cn } from '../lib/utils';

export default function SourcesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    color: 'blue',
    retention_days: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: sources = [], isLoading: loadingSources } = useQuery(sourcesQueryOptions);

  const createMutation = useMutation({
    mutationFn: createSourceFn,
    onSuccess: (newSource) => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setIsCreating(false);
      setForm({
        name: '',
        color: 'blue',
        retention_days: '',
      });
      navigate({ to: '/s/$sourceId/setup', params: { sourceId: newSource.id.toString() } });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const handleCreate = () => {
    setError(null);
    const retentionValue = form.retention_days.trim() ? Number(form.retention_days) : undefined;

    createMutation.mutate({
      name: form.name.trim(),
      color: form.color,
      ...(retentionValue ? { retention_days: retentionValue } : {}),
    });
  };

  // If in creation mode, show a simple centralized form
  if (isCreating) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-[#0B0C0E]">
        <div className="w-full max-w-md p-6">
          <div className="mb-8 text-center">
            <h1 className="font-display mb-2 text-2xl font-bold text-white">Create new source</h1>
            <p className="text-white/60">Set up a new endpoint to receive SES events.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-6 rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/60">Name</span>
              <Input
                autoFocus
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white transition-colors placeholder:text-white/20 focus:border-white/30 focus:ring-1 focus:ring-white/30 focus:outline-none"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Transactional Emails"
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-medium text-white/60">Color</span>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <Button
                    variant="ghost"
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border border-white/10 transition-transform ${
                      form.color === color
                        ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0B0C0E]'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: `var(--color-${color}-500, ${color})` }}
                    aria-label={color}
                    onClick={() => setForm({ ...form, color })}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1 border border-white/10 bg-transparent text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50"
                onClick={() => setIsCreating(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-white font-medium text-black hover:bg-white/90 disabled:opacity-50"
                onClick={handleCreate}
                disabled={!form.name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Source'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#0B0C0E]">
      <div className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
              Sources
            </h1>
            <p className="mt-1 text-white/60">Manage your event sources and configurations.</p>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90"
          >
            <Plus className="h-4 w-4" />
            New Source
          </Button>
        </div>

        {loadingSources ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl border border-white/10 bg-white/[0.02]"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.02] transition-all duration-200 hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="flex-1 p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <Link
                      to="/s/$sourceId/events"
                      params={{ sourceId: source.id.toString() }}
                      className="flex items-center gap-3"
                    >
                      <span
                        className={cn(
                          'w-3 h-3 rounded-full ring-2 ring-white/10',
                          COLOR_STYLES[source.color],
                        )}
                      />
                      <h2 className="text-lg font-semibold text-white transition-colors group-hover:text-blue-200">
                        {source.name}
                      </h2>
                    </Link>
                    <div className="flex items-center gap-1 opacity-100 transition-opacity group-hover:opacity-100 sm:opacity-0">
                      <Link
                        to="/s/$sourceId/settings"
                        params={{ sourceId: source.id.toString() }}
                        className="rounded-md p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                        title="Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="mb-1 block text-xs font-semibold tracking-wider text-white/40 uppercase">
                        Ingestion Token
                      </span>
                      <code className="block truncate rounded bg-white/5 px-2 py-1 font-mono text-xs text-white/60">
                        {source.token}
                      </code>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-white/60">
                      <div className="flex flex-col">
                        <span className="mb-0.5 text-[10px] font-semibold tracking-wider text-white/30 uppercase">
                          Retention
                        </span>
                        <span>
                          {source.retention_days ? `${source.retention_days} days` : 'Forever'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="mb-0.5 text-[10px] font-semibold tracking-wider text-white/30 uppercase">
                          Created
                        </span>
                        <span>
                          {new Date(source.created_at || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.01] p-4">
                  <Link
                    to="/s/$sourceId/events"
                    params={{ sourceId: source.id.toString() }}
                    className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300"
                  >
                    <Activity className="h-4 w-4" />
                    View Events
                  </Link>
                  <Link
                    to="/s/$sourceId/setup"
                    params={{ sourceId: source.id.toString() }}
                    className="text-xs font-medium text-white/40 transition-colors hover:text-white"
                  >
                    Setup Instructions
                  </Link>
                </div>
              </div>
            ))}

            {/* Empty State Card */}
            {sources.length === 0 && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="group flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-transparent transition-all hover:border-white/20 hover:bg-white/[0.02]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 transition-colors group-hover:bg-white/10">
                  <Plus className="h-6 w-6 text-white/40 group-hover:text-white/80" />
                </div>
                <h3 className="mb-1 font-medium text-white">Create your first source</h3>
                <p className="text-sm text-white/40">Start capturing email events</p>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
