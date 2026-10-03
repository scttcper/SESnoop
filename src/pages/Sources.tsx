import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Plus } from 'lucide-react';

import {
  controlClassName,
  errorClassName,
  focusClassName,
  PageHeader,
  PageLayout,
  panelClassName,
  primaryControlClassName,
  secondaryControlClassName,
} from '../components/layout/PageLayout';
import { Button } from '../components/ui/button';
import { sourcesQueryOptions } from '../lib/queries';
import { COLOR_STYLES, cn } from '../lib/utils';

export default function SourcesPage() {
  const {
    data: sources = [],
    isLoading: loadingSources,
    error: sourcesError,
    refetch,
  } = useQuery(sourcesQueryOptions);

  return (
    <PageLayout>
      <PageHeader
        title="Sources"
        actions={
          <Link to="/sources/new" className={cn(controlClassName, primaryControlClassName)}>
            <Plus className="size-3.5" aria-hidden="true" />
            New source
          </Link>
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
                params={{ sourceId: source.id }}
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
                  params={{ sourceId: source.id }}
                  className={cn(controlClassName, secondaryControlClassName)}
                >
                  Events
                </Link>
                <Link
                  to="/s/$sourceId/settings"
                  params={{ sourceId: source.id }}
                  className={cn(controlClassName, secondaryControlClassName)}
                >
                  Settings
                </Link>
                <Link
                  to="/s/$sourceId/setup"
                  params={{ sourceId: source.id }}
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
          <Link to="/sources/new" className={cn(controlClassName, primaryControlClassName, 'mt-5')}>
            <Plus className="size-3.5" aria-hidden="true" />
            New source
          </Link>
        </div>
      ) : null}
    </PageLayout>
  );
}
