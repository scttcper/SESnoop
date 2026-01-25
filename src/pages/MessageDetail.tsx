import { useQuery } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { messageQueryOptions, sourcesQueryOptions } from '../lib/queries';

const routeApi = getRouteApi('/app/messages/$sesMessageId');

const formatDateTime = (value?: number | null) => (value ? new Date(value).toLocaleString() : '—');

const formatJson = (value: Record<string, unknown>) => JSON.stringify(value, null, 2);

export default function MessageDetailPage() {
  const { sesMessageId } = routeApi.useParams();
  const searchParams = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const [sourceId, setSourceId] = useState<number | null>(searchParams.sourceId ?? null);

  const { data: sources = [] } = useQuery(sourcesQueryOptions);

  // Initialize sourceId from first source if not provided in URL
  useEffect(() => {
    if (!sourceId && sources.length > 0) {
      const firstSourceId = sources[0].id;
      setSourceId(firstSourceId);
      // Update URL with the selected sourceId
      navigate({ search: { sourceId: firstSourceId }, replace: true });
    }
  }, [sources, sourceId, navigate]);

  const {
    data: message,
    isLoading: loading,
    error: queryError,
  } = useQuery(messageQueryOptions(sourceId, sesMessageId));

  const error = queryError instanceof Error ? queryError.message : null;

  const messageTitle = useMemo(() => message?.subject ?? 'Message detail', [message?.subject]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col border-x border-white/10 bg-[#0B0C0E]">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex flex-col">
          <h1
            className="font-display max-w-4xl truncate text-2xl font-semibold tracking-tight text-white"
            title={messageTitle}
          >
            {messageTitle}
          </h1>
        </div>
        <div className="topbar-actions">
          <Link
            to="/events"
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            Back to events
          </Link>
        </div>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto p-6">
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-semibold text-white">Message overview</h2>
            <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-sm text-white/40">
              {loading ? 'Loading…' : 'Ready'}
            </span>
          </div>
          {error ? (
            <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-400">
              {error}
            </p>
          ) : null}

          <div className="mb-6 w-full md:w-1/3">
            <label className="flex flex-col space-y-2">
              <span className="text-sm font-medium text-white/60">Source</span>
              <Select
                items={sources.map((source) => ({
                  label: source.name,
                  value: String(source.id),
                }))}
                value={sourceId ? String(sourceId) : ''}
                onValueChange={(value) => setSourceId(Number(value))}
              >
                <SelectTrigger className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-white/30 focus:outline-none">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={String(source.id)}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {message ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <span className="mb-2 block text-xs font-semibold tracking-wider text-white/40 uppercase">
                  From
                </span>
                <span className="text-sm break-all text-white">{message.source_email ?? '—'}</span>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <span className="mb-2 block text-xs font-semibold tracking-wider text-white/40 uppercase">
                  To
                </span>
                <span className="text-sm break-all text-white">
                  {message.destination_emails.join(', ') || '—'}
                </span>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <span className="mb-2 block text-xs font-semibold tracking-wider text-white/40 uppercase">
                  Sent at
                </span>
                <span className="text-sm text-white">{formatDateTime(message.sent_at)}</span>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 md:col-span-2">
                <span className="mb-2 block text-xs font-semibold tracking-wider text-white/40 uppercase">
                  SES Message ID
                </span>
                <span className="font-mono text-sm text-white select-all">
                  {message.ses_message_id}
                </span>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <span className="mb-2 block text-xs font-semibold tracking-wider text-white/40 uppercase">
                  Events
                </span>
                <span className="font-display text-2xl font-medium text-white">
                  {message.events_count}
                </span>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 md:col-span-3">
                <span className="mb-2 block text-xs font-semibold tracking-wider text-white/40 uppercase">
                  Tags
                </span>
                <div className="flex flex-wrap gap-2">
                  {message.tags.length > 0 ? (
                    message.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/10 px-2 py-1 font-mono text-xs text-white/80"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-white/40">—</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-lg font-semibold text-white">Event timeline</h2>
          </div>
          {message?.events.length ? (
            <div className="relative ml-2 flex flex-col space-y-4 border-l border-white/10 pl-4">
              {message.events.map((event) => (
                <div key={event.id} className="relative pl-6">
                  <div
                    className={`absolute top-1.5 -left-[21px] h-3 w-3 rounded-full border-2 border-[#0B0C0E] ${
                      event.event_type === 'Bounce'
                        ? 'bg-red-500'
                        : event.event_type === 'Delivery'
                          ? 'bg-green-500'
                          : event.event_type === 'Send'
                            ? 'bg-blue-500'
                            : 'bg-white/40'
                    }`}
                  />
                  <div className="flex flex-col rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04] md:flex-row md:items-center md:justify-between">
                    <div className="mb-2 flex items-center space-x-3 md:mb-0">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                          event.event_type === 'Bounce'
                            ? 'border-red-500/20 bg-red-500/10 text-red-400'
                            : event.event_type === 'Delivery'
                              ? 'border-green-500/20 bg-green-500/10 text-green-400'
                              : event.event_type === 'Send'
                                ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                                : 'border-white/10 bg-white/5 text-white/60'
                        }`}
                      >
                        {event.event_type}
                      </span>
                      <span className="text-sm text-white">{event.recipient_email}</span>
                    </div>
                    <span className="font-mono text-xs text-white/40">
                      {formatDateTime(event.event_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <p className="text-sm text-white/40">No events recorded yet.</p>
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-lg font-semibold text-white">Raw metadata</h2>
          </div>
          {message ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0D0E11]">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center p-4 text-sm font-medium text-white/60 transition-colors select-none hover:text-white">
                  <span className="mr-2 transition-transform group-open:rotate-90">▶</span>
                  View SES payload
                </summary>
                <div className="overflow-x-auto border-t border-white/5 bg-black/30 p-4">
                  <pre className="font-mono text-xs leading-relaxed text-blue-300/90">
                    {formatJson(message.mail_metadata)}
                  </pre>
                </div>
              </details>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
