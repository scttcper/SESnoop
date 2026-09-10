import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, Check, Plus } from 'lucide-react';
import { useState } from 'react';

import {
  controlClassName,
  errorClassName,
  focusClassName,
  inputClassName,
  labelClassName,
  PageHeader,
  PageLayout,
  panelClassName,
  primaryControlClassName,
  secondaryControlClassName,
} from '../components/layout/PageLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { createSourceFn, sourcesQueryOptions } from '../lib/queries';
import { COLOR_STYLES, COLORS, cn } from '../lib/utils';

export default function SourcesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ name: '', color: 'blue', retention_days: '' });
  const [error, setError] = useState<string | null>(null);

  const {
    data: sources = [],
    isLoading: loadingSources,
    error: sourcesError,
    refetch,
  } = useQuery(sourcesQueryOptions);

  const createMutation = useMutation({
    mutationFn: createSourceFn,
    onSuccess: (newSource) => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setIsCreating(false);
      setForm({ name: '', color: 'blue', retention_days: '' });
      navigate({ to: '/s/$sourceId/setup', params: { sourceId: newSource.id.toString() } });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not create the source.');
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

  if (isCreating) {
    return (
      <PageLayout className="max-w-2xl">
        <PageHeader title="New source">
          <p className="mt-2 text-sm leading-6 text-white/45">
            Give this source a name, then connect its webhook to Amazon SES.
          </p>
        </PageHeader>

        <form
          className={cn(panelClassName, 'space-y-5 p-5 sm:p-6')}
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
        >
          {error && (
            <div role="alert" className={errorClassName}>
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="source-name" className={labelClassName}>
              Source name
            </label>
            <Input
              id="source-name"
              autoFocus
              required
              maxLength={200}
              className={inputClassName}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Production"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className={labelClassName}>Color</legend>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    focusClassName,
                    'flex size-9 items-center justify-center rounded-lg border text-white transition-colors',
                    form.color === color
                      ? 'border-white/80'
                      : 'border-white/10 hover:border-white/40',
                  )}
                  style={{ backgroundColor: `var(--color-${color}-500, ${color})` }}
                  aria-label={color}
                  aria-pressed={form.color === color}
                  onClick={() => setForm({ ...form, color })}
                >
                  {form.color === color && <Check className="size-4" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="source-retention" className={labelClassName}>
              Retention in days
            </label>
            <Input
              id="source-retention"
              className={cn(inputClassName, 'max-w-36')}
              type="number"
              min={1}
              step={1}
              value={form.retention_days}
              onChange={(event) => setForm({ ...form, retention_days: event.target.value })}
              placeholder="No limit"
              aria-describedby="source-retention-help"
            />
            <p id="source-retention-help" className="text-xs leading-5 text-white/45">
              Leave blank to keep all events.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-white/[0.08] pt-5">
            <Button
              type="button"
              variant="ghost"
              className={cn(controlClassName, secondaryControlClassName)}
              onClick={() => setIsCreating(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={cn(controlClassName, primaryControlClassName)}
              disabled={!form.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create source'}
            </Button>
          </div>
        </form>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Sources"
        actions={
          <Button
            onClick={() => {
              setError(null);
              setIsCreating(true);
            }}
            className={cn(controlClassName, primaryControlClassName)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New source
          </Button>
        }
      />

      {sourcesError && (
        <div
          role="alert"
          className={cn(errorClassName, 'mb-5 flex flex-wrap items-center justify-between gap-3')}
        >
          <span>Could not load sources. {sourcesError.message}</span>
          <Button
            variant="ghost"
            className={cn(controlClassName, secondaryControlClassName)}
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      {loadingSources ? (
        <div role="status" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <span className="sr-only">Loading sources…</span>
          {[1, 2, 3].map((item) => (
            <div key={item} className={cn(panelClassName, 'h-48 animate-pulse')} />
          ))}
        </div>
      ) : sources.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <article key={source.id} className={cn(panelClassName, 'overflow-hidden')}>
              <Link
                to="/s/$sourceId/dashboard"
                params={{ sourceId: source.id.toString() }}
                className={cn(
                  focusClassName,
                  'group flex items-start justify-between gap-4 rounded-t-xl p-5 transition-colors hover:bg-white/[0.025] focus-visible:-outline-offset-2',
                )}
              >
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2.5 text-sm font-medium text-white/90">
                    <span
                      className={cn('size-2 shrink-0 rounded-full', COLOR_STYLES[source.color])}
                      aria-hidden="true"
                    />
                    <span className="truncate">{source.name}</span>
                  </h2>
                  <span className="mt-2 block text-xs text-white/45 group-hover:text-white/65">
                    Overview
                  </span>
                </div>
                <ArrowUpRight
                  className="size-4 shrink-0 text-white/30 transition-colors group-hover:text-white/70"
                  aria-hidden="true"
                />
              </Link>

              <dl className="grid grid-cols-2 gap-4 px-5 pb-5 text-xs">
                <div>
                  <dt className="text-white/40">Retention</dt>
                  <dd className="mt-1.5 text-white/70">
                    {source.retention_days ? `${source.retention_days} days` : 'No limit'}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/40">Created</dt>
                  <dd className="mt-1.5 text-white/70">
                    {new Date(source.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2 border-t border-white/[0.08] px-5 py-3">
                <Link
                  to="/s/$sourceId/events"
                  params={{ sourceId: source.id.toString() }}
                  className={cn(controlClassName, secondaryControlClassName)}
                >
                  Events
                </Link>
                <Link
                  to="/s/$sourceId/settings"
                  params={{ sourceId: source.id.toString() }}
                  className={cn(controlClassName, secondaryControlClassName)}
                >
                  Settings
                </Link>
                <Link
                  to="/s/$sourceId/setup"
                  params={{ sourceId: source.id.toString() }}
                  className={cn(
                    controlClassName,
                    'ml-auto border-transparent text-white/45 hover:text-white/80',
                  )}
                >
                  Setup
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : !sourcesError ? (
        <div className={cn(panelClassName, 'flex flex-col items-center px-5 py-16 text-center')}>
          <h2 className="text-sm font-medium text-white/90">Connect your first source</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/45">
            Create a webhook endpoint to collect delivery, bounce, and engagement events from SES.
          </p>
          <Button
            onClick={() => setIsCreating(true)}
            className={cn(controlClassName, primaryControlClassName, 'mt-5')}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New source
          </Button>
        </div>
      ) : null}
    </PageLayout>
  );
}
