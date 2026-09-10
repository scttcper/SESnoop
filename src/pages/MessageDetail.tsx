import { useQuery } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { ArrowLeft, Check, ChevronRight, Copy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  EventBadge,
  RecipientAvatar,
  countBadgeClassName,
  eventDotClassName,
  formatCompactEventTime,
  formatDateTime,
} from '../components/EventPresentation';
import {
  PageHeader,
  PageLayout,
  controlClassName,
  errorClassName,
  focusClassName,
  labelClassName,
  panelClassName,
  secondaryControlClassName,
  sectionHeadingClassName,
  tableHeaderClassName,
} from '../components/layout/PageLayout';
import { messageQueryOptions } from '../lib/queries';
import { cn, formatShortMessageId } from '../lib/utils';

const routeApi = getRouteApi('/app/s/$sourceId/messages/$sesMessageId');
const SKELETON_ROWS = [0, 1, 2];
type CopyField = 'from' | 'to' | 'subject' | 'id';

function CopyButton({
  label,
  copied,
  onClick,
  showLabel = false,
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
  showLabel?: boolean;
}) {
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? 'Copied' : `Copy ${label}`}
      className={cn(controlClassName, secondaryControlClassName, !showLabel && 'w-9 px-0')}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {showLabel ? (copied ? 'Copied' : `Copy ${label}`) : null}
    </button>
  );
}

function MessageLoadingState() {
  return (
    <div role="status" className="space-y-5">
      <span className="sr-only">Loading message details</span>
      {SKELETON_ROWS.map((row) => (
        <div
          key={row}
          className={cn(panelClassName, 'animate-pulse p-5 motion-reduce:animate-none')}
        >
          <div className="h-4 w-24 rounded bg-white/5" />
          <div className="mt-5 h-4 w-3/4 max-w-lg rounded bg-white/5" />
          <div className="mt-3 h-4 w-1/2 max-w-xs rounded bg-white/5" />
          <div className="mt-3 h-4 w-2/3 max-w-md rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export default function MessageDetailPage() {
  const { sourceId: sourceIdStr, sesMessageId } = routeApi.useParams();
  const searchParams = routeApi.useSearch();
  const sourceId = Number(sourceIdStr);
  const [copiedField, setCopiedField] = useState<CopyField | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    data: message,
    isLoading: loading,
    error,
    refetch,
  } = useQuery(messageQueryOptions(sourceId, sesMessageId));

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  const destinationEmails = message?.destination_emails.join(', ') ?? '';
  const messageSubject = message?.subject?.trim() || null;
  const shortMessageId = formatShortMessageId(sesMessageId);
  const sentAtIso = message?.sent_at != null ? new Date(message.sent_at).toISOString() : undefined;
  const backToEventsSearch = {
    search: searchParams.search,
    event_types: searchParams.event_types,
    bounce_types: searchParams.bounce_types,
    tags: searchParams.tags,
    date_range: searchParams.date_range,
    from: searchParams.from,
    to: searchParams.to,
    page: searchParams.page,
  };
  const buildTagSearch = (tag: string) => ({
    ...backToEventsSearch,
    tags: searchParams.tags.includes(tag) ? searchParams.tags : [...searchParams.tags, tag],
    page: 1,
  });

  const handleCopy = async (field: CopyField, text: string) => {
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      setCopiedField(field);
      toast.success('Copied to clipboard');
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedField(null);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const recipientRows = useMemo(() => {
    if (!message) {
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
    <PageLayout>
      <PageHeader
        title={
          <span className="block leading-snug [overflow-wrap:anywhere]">
            {loading ? 'Loading message…' : messageSubject || 'Message details'}
          </span>
        }
        actions={
          <>
            {messageSubject ? (
              <CopyButton
                label="subject"
                copied={copiedField === 'subject'}
                onClick={() => void handleCopy('subject', message?.subject ?? '')}
                showLabel
              />
            ) : null}
            <Link
              to="/s/$sourceId/events"
              params={{ sourceId: sourceIdStr }}
              search={backToEventsSearch}
              className={cn(controlClassName, secondaryControlClassName)}
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to events
            </Link>
          </>
        }
      >
        <p className="mt-1.5 text-sm text-white/45">Message {shortMessageId}</p>
      </PageHeader>

      {error ? (
        <div role="alert" className={cn(errorClassName, 'mb-5 flex flex-wrap items-center gap-3')}>
          <p className="flex-1">{error.message}</p>
          <button
            type="button"
            className={cn(controlClassName, secondaryControlClassName)}
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {loading ? <MessageLoadingState /> : null}

      {message ? (
        <div className="space-y-5">
          <section aria-labelledby="message-details-heading" className={cn(panelClassName, 'p-5')}>
            <h2 id="message-details-heading" className={sectionHeadingClassName}>
              Message details
            </h2>
            <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className={labelClassName}>From</dt>
                <dd className="mt-1 flex min-h-9 items-start justify-between gap-3">
                  <span className="min-w-0 py-2 text-sm leading-5 [overflow-wrap:anywhere] text-white/80">
                    {message.source_email || 'Unknown sender'}
                  </span>
                  {message.source_email ? (
                    <CopyButton
                      label="sender"
                      copied={copiedField === 'from'}
                      onClick={() => void handleCopy('from', message.source_email ?? '')}
                    />
                  ) : null}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className={labelClassName}>To</dt>
                <dd className="mt-1 flex min-h-9 items-start justify-between gap-3">
                  <span className="min-w-0 py-2 text-sm leading-5 [overflow-wrap:anywhere] text-white/80">
                    {destinationEmails || 'Unknown recipient'}
                  </span>
                  {destinationEmails ? (
                    <CopyButton
                      label="recipients"
                      copied={copiedField === 'to'}
                      onClick={() => void handleCopy('to', destinationEmails)}
                    />
                  ) : null}
                </dd>
              </div>
              <div className="min-w-0 border-t border-white/[0.08] pt-4">
                <dt className={labelClassName}>Sent</dt>
                <dd className="mt-1 flex min-h-9 items-center text-sm leading-5 text-white/65">
                  <time dateTime={sentAtIso} title={sentAtIso}>
                    {formatDateTime(message.sent_at)}
                  </time>
                </dd>
              </div>
              <div className="min-w-0 border-t border-white/[0.08] pt-4">
                <dt className={labelClassName}>SES message ID</dt>
                <dd className="mt-1 flex min-h-9 items-start justify-between gap-3">
                  <span className="min-w-0 py-2 font-mono text-xs leading-5 [overflow-wrap:anywhere] text-white/55 select-all">
                    {message.ses_message_id}
                  </span>
                  <CopyButton
                    label="message ID"
                    copied={copiedField === 'id'}
                    onClick={() => void handleCopy('id', message.ses_message_id)}
                  />
                </dd>
              </div>
              <div className="min-w-0 border-t border-white/[0.08] pt-4 sm:col-span-2">
                <dt className={labelClassName}>Tags</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {message.tags.length > 0 ? (
                    message.tags.map((tag) => (
                      <Link
                        key={tag.label}
                        to="/s/$sourceId/events"
                        params={{ sourceId: sourceIdStr }}
                        search={buildTagSearch(tag.label)}
                        className={cn(
                          focusClassName,
                          'max-w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs leading-5 text-white/60 transition-colors hover:border-blue-400/20 hover:bg-blue-400/10 hover:text-blue-200 [overflow-wrap:anywhere]',
                        )}
                        title={`Filter events by ${tag.label}`}
                      >
                        {tag.label}
                      </Link>
                    ))
                  ) : (
                    <span className="text-xs leading-5 text-white/40">No tags</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="message-recipients-heading"
            className={cn(panelClassName, 'overflow-hidden')}
          >
            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <h2 id="message-recipients-heading" className={sectionHeadingClassName}>
                  Recipients
                </h2>
                <p className="mt-1 text-xs leading-5 text-white/40">
                  Latest event for each tracked recipient.
                </p>
              </div>
              <span className={countBadgeClassName}>{recipientRows.length}</span>
            </div>
            {recipientRows.length > 0 ? (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                  <caption className="sr-only">Latest event for each tracked recipient</caption>
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-36" />
                    <col className="w-40" />
                    <col />
                  </colgroup>
                  <thead
                    className={cn(
                      tableHeaderClassName,
                      'border-y border-white/[0.06] bg-white/[0.015]',
                    )}
                  >
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Recipient
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Latest event
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Event time
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Detail
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {recipientRows.map((event) => (
                      <tr
                        key={event.recipient_email}
                        className="transition-colors hover:bg-white/[0.025]"
                      >
                        <th scope="row" className="px-5 py-4 text-left font-medium text-white/75">
                          <div className="flex items-center gap-2">
                            <RecipientAvatar email={event.recipient_email} />
                            <span className="min-w-0 [overflow-wrap:anywhere]">
                              {event.recipient_email}
                            </span>
                          </div>
                        </th>
                        <td className="px-3 py-4">
                          <EventBadge eventType={event.event_type} />
                        </td>
                        <td className="px-3 py-4">
                          <time
                            className="text-xs whitespace-nowrap text-white/45 tabular-nums"
                            dateTime={new Date(event.event_at).toISOString()}
                            title={formatDateTime(event.event_at)}
                          >
                            {formatCompactEventTime(event.event_at)}
                          </time>
                        </td>
                        <td className="px-5 py-4 text-xs leading-5 [overflow-wrap:anywhere] text-white/55">
                          {event.event_detail ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 pt-1 pb-6 text-sm text-white/40">
                No recipient events recorded yet.
              </p>
            )}
          </section>

          <section aria-labelledby="message-timeline-heading" className={cn(panelClassName, 'p-5')}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="message-timeline-heading" className={sectionHeadingClassName}>
                  Event timeline
                </h2>
                <p className="mt-1 text-xs leading-5 text-white/40">Newest first.</p>
              </div>
              <span className={countBadgeClassName}>{message.events.length} events</span>
            </div>
            {message.events.length > 0 ? (
              <ol className="mt-6 space-y-6">
                {message.events.map((event, index) => (
                  <li key={event.id} className="relative pl-7">
                    {index < message.events.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-5 -bottom-6 left-1.5 w-px bg-white/[0.08]"
                      />
                    ) : null}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute top-1.5 left-0 size-3 rounded-full border-2 border-[#0B0C0E]',
                        eventDotClassName(event.event_type),
                      )}
                    />
                    <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
                        <EventBadge eventType={event.event_type} />
                        <span className="min-w-0 text-sm [overflow-wrap:anywhere] text-white/75">
                          {event.recipient_email}
                        </span>
                      </div>
                      <time
                        className="pt-0.5 text-xs leading-5 whitespace-nowrap text-white/40 tabular-nums"
                        dateTime={new Date(event.event_at).toISOString()}
                        title={formatDateTime(event.event_at)}
                      >
                        {formatCompactEventTime(event.event_at)}
                      </time>
                    </div>
                    {event.event_detail ? (
                      <p className="mt-2 text-xs leading-5 [overflow-wrap:anywhere] text-white/45">
                        {event.event_detail}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-5 text-sm text-white/40">No events recorded yet.</p>
            )}
          </section>

          <details className={cn(panelClassName, 'group overflow-hidden')}>
            <summary
              className={cn(
                focusClassName,
                sectionHeadingClassName,
                'flex cursor-pointer list-none items-center gap-2 p-5 transition-colors select-none focus-visible:-outline-offset-2 hover:bg-white/[0.025] [&::-webkit-details-marker]:hidden',
              )}
            >
              <ChevronRight
                className="size-4 text-white/35 transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              SES mail metadata
            </summary>
            <div className="max-h-[32rem] overflow-auto border-t border-white/[0.08] bg-black/20 p-5">
              <pre className="font-mono text-xs leading-6 text-white/65">
                {JSON.stringify(message.mail_metadata, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      ) : null}
    </PageLayout>
  );
}
