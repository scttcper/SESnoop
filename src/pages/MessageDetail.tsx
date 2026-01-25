import { Separator } from '@base-ui/react';
import { useQuery } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { messageQueryOptions, sourcesQueryOptions } from '../lib/queries';

const routeApi = getRouteApi('/app/messages/$sesMessageId');

const formatDateTime = (value?: number | null) => (value ? new Date(value).toLocaleString() : '—');

const formatJson = (value: Record<string, unknown>) => JSON.stringify(value, null, 2);

const eventBadgeClassNames: Record<string, string> = {
  Bounce: 'border-red-500/20 bg-red-500/10 text-red-400',
  Delivery: 'border-green-500/20 bg-green-500/10 text-green-400',
  Complaint: 'border-orange-500/20 bg-orange-500/10 text-orange-400',
  Send: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
};

const eventBadgeClassName = (eventType: string) =>
  eventBadgeClassNames[eventType] ?? 'border-white/10 bg-white/5 text-white/60';

export default function MessageDetailPage() {
  const { sesMessageId } = routeApi.useParams();
  const searchParams = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const [sourceId, setSourceId] = useState<number | null>(searchParams.sourceId ?? null);
  const [toCopied, setToCopied] = useState(false);
  const toCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const destinationEmails = message?.destination_emails.join(', ') ?? '';
  const sentAtLabel = formatDateTime(message?.sent_at);
  const sentAtIso = message?.sent_at ? new Date(message.sent_at).toISOString() : undefined;
  const backToEventsSearch = useMemo(
    () => ({
      search: searchParams.search,
      event_types: searchParams.event_types,
      bounce_types: searchParams.bounce_types,
      date_range: searchParams.date_range,
      from: searchParams.from,
      to: searchParams.to,
      page: searchParams.page,
    }),
    [
      searchParams.bounce_types,
      searchParams.date_range,
      searchParams.event_types,
      searchParams.from,
      searchParams.page,
      searchParams.search,
      searchParams.to,
    ],
  );
  const recipientRows = useMemo(() => {
    if (!message || message.events.length === 0) {
      return [];
    }
    const latestByRecipient = new Map<string, (typeof message.events)[number]>();
    for (const event of message.events) {
      const existing = latestByRecipient.get(event.recipient_email);
      if (!existing || event.event_at > existing.event_at) {
        latestByRecipient.set(event.recipient_email, event);
      }
    }
    return [...latestByRecipient.values()].sort((a, b) =>
      a.recipient_email.localeCompare(b.recipient_email),
    );
  }, [message]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col border-x border-white/10 bg-[#0B0C0E]">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex flex-col">
          <h1
            className="font-display max-w-4xl truncate text-2xl font-semibold tracking-tight text-white"
            title={messageTitle}
          >
            Message detail
          </h1>
        </div>
        <div className="topbar-actions">
          {sourceId ? (
            <Link
              to="/s/$sourceId/events"
              params={{ sourceId: sourceId.toString() }}
              search={backToEventsSearch}
              className="rounded-md border border-white/10 px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              Back to events
            </Link>
          ) : (
            <Link
              to="/sources"
              className="rounded-md border border-white/10 px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              Back to events
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto p-6">
        <section className="space-y-6">
          {error ? (
            <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-400">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="min-h-[320px] animate-pulse rounded-lg bg-white/[0.02] p-6 outline-1 -outline-offset-1 outline-white/10">
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="h-3 w-12 rounded bg-white/10" />
                  <div className="h-4 w-64 rounded bg-white/10" />
                </div>
                <div className="h-px w-full bg-white/5" />
                <div className="space-y-2">
                  <div className="h-3 w-10 rounded bg-white/10" />
                  <div className="h-4 w-80 rounded bg-white/10" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-14 rounded bg-white/10" />
                  <div className="h-4 w-72 rounded bg-white/10" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-16 rounded bg-white/10" />
                  <div className="h-4 w-40 rounded bg-white/10" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-20 rounded bg-white/10" />
                  <div className="h-4 w-96 rounded bg-white/10" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-10 rounded bg-white/10" />
                  <div className="flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-white/10" />
                    <div className="h-5 w-20 rounded-full bg-white/10" />
                    <div className="h-5 w-12 rounded-full bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          ) : message ? (
            <div className="rounded-lg bg-white/[0.02] outline-1 -outline-offset-1 outline-white/10">
              <dl className="flex flex-wrap">
                <div className="flex w-full items-baseline gap-2 px-6 pt-6">
                  <dt className="text-sm/6 font-semibold text-white/70">From</dt>
                  <dd className="text-sm font-semibold break-all text-white">
                    {message.source_email ?? '—'}
                  </dd>
                </div>
                <Separator className="my-4 h-px w-full bg-white/5" />
                <div className="mt-1 flex w-full items-baseline gap-2 px-6">
                  <dt className="text-sm/6 font-semibold text-white/70">To</dt>
                  <dd className="flex flex-wrap items-center gap-2 text-sm/6 font-medium text-white">
                    <span className="break-all">{destinationEmails || '—'}</span>
                    {destinationEmails ? (
                      <button
                        type="button"
                        className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                        onClick={() => {
                          const text = destinationEmails;
                          if (!text) {
                            return;
                          }
                          navigator.clipboard.writeText(text);
                          if (toCopyTimeoutRef.current) {
                            clearTimeout(toCopyTimeoutRef.current);
                          }
                          setToCopied(true);
                          toast.success('Copied to clipboard');
                          toCopyTimeoutRef.current = setTimeout(() => {
                            setToCopied(false);
                            toCopyTimeoutRef.current = null;
                          }, 2000);
                        }}
                      >
                        {toCopied ? '✓ Copied' : 'Copy'}
                      </button>
                    ) : null}
                  </dd>
                </div>
                <div className="mt-4 w-full px-6">
                  <dt className="text-sm/6 font-semibold text-white/70">Subject</dt>
                  <dd className="mt-1 text-sm break-words text-white/80">
                    {message.subject ?? '—'}
                  </dd>
                </div>
                <div className="mt-6 w-full border-t border-white/5 px-6 pt-6">
                  <dt className="text-sm/6 font-semibold text-white/70">Sent at</dt>
                  <dd className="mt-1 text-sm/6 text-white/70">
                    <time dateTime={sentAtIso}>{sentAtLabel}</time>
                  </dd>
                </div>
                <div className="mt-4 w-full px-6">
                  <dt className="text-sm/6 font-semibold text-white/70">SES Message ID</dt>
                  <dd className="mt-1 font-mono text-sm/6 break-all text-white/70 select-all">
                    {message.ses_message_id}
                  </dd>
                </div>
                <div className="mt-4 w-full px-6 pb-6">
                  <dt className="text-sm/6 font-semibold text-white/70">Tags</dt>
                  <dd className="mt-1 flex flex-wrap gap-2 text-sm/6 text-white/70">
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
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-lg font-semibold text-white">Recipients</h2>
          </div>
          {loading ? (
            <div className="min-h-[220px] overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs font-medium text-white/60 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Recipient</th>
                    <th className="px-4 py-3 font-semibold">Latest event</th>
                    <th className="px-4 py-3 font-semibold">Latest event time</th>
                    <th className="px-4 py-3 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-white/[0.02]">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <tr key={`recipients-skeleton-${index}`} className="animate-pulse">
                      <td className="px-4 py-3">
                        <div className="h-4 w-48 rounded bg-white/10" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-20 rounded bg-white/10" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-28 rounded bg-white/10" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-64 rounded bg-white/10" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : message ? (
            message.events.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-xs font-medium text-white/60 uppercase">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Recipient</th>
                      <th className="px-4 py-3 font-semibold">Latest event</th>
                      <th className="px-4 py-3 font-semibold">Latest event time</th>
                      <th className="px-4 py-3 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-white/[0.02]">
                    {recipientRows.map((event) => (
                      <tr
                        key={event.recipient_email}
                        className="transition-colors hover:bg-white/5"
                      >
                        <td className="px-4 py-3 text-white">{event.recipient_email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${eventBadgeClassName(
                              event.event_type,
                            )}`}
                          >
                            {event.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-white/60">
                          {formatDateTime(event.event_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-white/70">
                          {event.event_detail ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                <p className="text-sm text-white/40">There are no recipient updates yet.</p>
              </div>
            )
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Event timeline</h2>
              {message ? (
                <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                  {message.events_count} events
                </span>
              ) : null}
            </div>
          </div>
          {loading ? (
            <div className="min-h-[240px] space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`timeline-skeleton-${index}`}
                  className="animate-pulse rounded-lg border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="h-4 w-24 rounded bg-white/10" />
                    <div className="h-4 w-24 rounded bg-white/10" />
                  </div>
                  <div className="h-3 w-64 rounded bg-white/10" />
                </div>
              ))}
            </div>
          ) : message?.events.length ? (
            <div className="ml-2 flex flex-col">
              {message.events.map((event, index) => (
                <div key={event.id} className="group relative pb-8 pl-10 last:pb-0">
                  {index > 0 && (
                    <div className="absolute top-0 left-4 h-5 w-px -translate-x-1/2 bg-white/10" />
                  )}
                  {index < message.events.length - 1 && (
                    <div className="absolute top-5 bottom-0 left-4 w-px -translate-x-1/2 bg-white/10" />
                  )}
                  <div
                    className={`absolute top-5 left-4 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0B0C0E] ${
                      event.event_type === 'Bounce'
                        ? 'bg-red-500'
                        : event.event_type === 'Delivery'
                          ? 'bg-green-500'
                          : event.event_type === 'Complaint'
                            ? 'bg-orange-500'
                            : event.event_type === 'Send'
                              ? 'bg-blue-500'
                              : 'bg-white/40'
                    }`}
                  />
                  <div className="flex flex-col rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04] md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="mb-2 flex items-center space-x-3 md:mb-0">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${eventBadgeClassName(
                            event.event_type,
                          )}`}
                        >
                          {event.event_type}
                        </span>
                        <span className="text-sm text-white">{event.recipient_email}</span>
                      </div>
                      {event.event_detail ? (
                        <span className="text-xs text-white/50">
                          <span className="text-white/40">Reason:</span> {event.event_detail}
                        </span>
                      ) : null}
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
          {loading ? (
            <div className="min-h-[200px] animate-pulse overflow-hidden rounded-xl border border-white/10 bg-[#0D0E11]">
              <div className="flex items-center gap-3 border-b border-white/5 p-4">
                <div className="h-4 w-4 rounded bg-white/10" />
                <div className="h-4 w-32 rounded bg-white/10" />
              </div>
              <div className="space-y-3 p-4">
                <div className="h-3 w-full rounded bg-white/10" />
                <div className="h-3 w-5/6 rounded bg-white/10" />
                <div className="h-3 w-4/6 rounded bg-white/10" />
              </div>
            </div>
          ) : message ? (
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
