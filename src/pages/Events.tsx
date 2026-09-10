import { useQuery } from '@tanstack/react-query';
import { Link, useParams, getRouteApi } from '@tanstack/react-router';
import { CalendarDays, ChevronRight, Download, RefreshCw, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { buildEventsQueryString, type EventsQueryParams } from '../../shared/event-filters';
import {
  EventBadge,
  RecipientAvatar,
  formatCompactEventTime,
  formatDateTime,
  formatEventType,
} from '../components/EventPresentation';
import {
  controlClassName,
  errorClassName,
  focusClassName,
  inputClassName,
  labelClassName,
  PageHeader,
  PageLayout,
  panelClassName,
  secondaryControlClassName,
  tableHeaderClassName,
} from '../components/layout/PageLayout';
import { TagFilterDropdown } from '../components/TagFilterDropdown';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select';
import {
  BOUNCE_TYPES,
  DATE_PRESETS,
  DEFAULT_EVENT_TYPES,
  EVENT_TYPES,
  type BounceType,
  type DateRangeValue,
  type EventType,
} from '../lib/constants';
import {
  eventsQueryOptions,
  sourcesQueryOptions,
  type EventCounts,
  type EventResponse,
  type EventRow,
} from '../lib/queries';
import { cn } from '../lib/utils';
import type { EventsSearchParams } from '../router';

const routeApi = getRouteApi('/app/s/$sourceId/events');

const EVENT_SKELETON_ROWS = ['event-1', 'event-2', 'event-3', 'event-4', 'event-5', 'event-6'];
const EMPTY_EVENT_COUNTS: EventCounts = { event_types: {}, bounce_types: {}, tags: {} };

const escapeCsvCell = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
};

const createCsv = (rows: Array<Array<string | number | null | undefined>>) =>
  rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');

const buildExportFileName = (sourceName: string | undefined, sourceId: number | null) => {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const base = sourceName
    ? sourceName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
    : sourceId
      ? `source-${sourceId}`
      : 'events';
  const trimmed = base.replaceAll(/^-+|-+$/g, '');
  return `${trimmed || 'events'}-${dateStamp}.csv`;
};

export default function EventsPage() {
  const { sourceId: sourceIdStr } = useParams({ strict: false });
  const sourceId = sourceIdStr ? Number(sourceIdStr) : null;

  const [exporting, setExporting] = useState(false);

  const searchParams = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const search = searchParams.search;
  const eventTypeSearchValues = searchParams.event_types;
  const selectedEventTypes = eventTypeSearchValues ?? DEFAULT_EVENT_TYPES;
  const selectedBounceTypes = searchParams.bounce_types;
  const selectedTags: readonly string[] = searchParams.tags;
  const datePreset = searchParams.date_range;
  const from = searchParams.from;
  const to = searchParams.to;
  const page = searchParams.page;

  const updateFilter = (updates: Partial<EventsSearchParams>) => {
    navigate({
      search: (prev) => ({ ...prev, ...updates, page: 1 }),
      replace: true,
    });
  };

  const updatePage = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
      replace: true,
    });
  };

  const { data: sources = [] } = useQuery(sourcesQueryOptions);
  const currentSource = sources.find((s) => s.id === sourceId);

  const filterParams = useMemo<EventsQueryParams>(
    () => ({
      search,
      event_types: selectedEventTypes,
      bounce_types: selectedBounceTypes,
      tags: selectedTags,
      date_range: datePreset,
      from,
      to,
    }),
    [datePreset, from, search, selectedBounceTypes, selectedEventTypes, selectedTags, to],
  );

  const queryParams = useMemo<EventsQueryParams>(
    () => ({
      ...filterParams,
      page,
    }),
    [filterParams, page],
  );

  const detailSearch = useMemo(
    () => ({
      search,
      event_types: eventTypeSearchValues,
      bounce_types: selectedBounceTypes,
      tags: [...selectedTags],
      date_range: datePreset,
      from,
      to,
      page,
    }),
    [datePreset, eventTypeSearchValues, from, page, search, selectedBounceTypes, selectedTags, to],
  );

  const {
    data: eventsResponse,
    isLoading: loadingEvents,
    isFetching: fetchingEvents,
    refetch: refetchEvents,
    error: queryError,
  } = useQuery(eventsQueryOptions(sourceId, queryParams));

  const events = eventsResponse?.data ?? [];
  const counts = eventsResponse?.counts ?? EMPTY_EVENT_COUNTS;
  const pagination = eventsResponse?.pagination ?? null;
  const error = queryError instanceof Error ? queryError.message : null;

  const loading = loadingEvents;

  const toggleEventType = (value: EventType) => {
    const newTypes = selectedEventTypes.includes(value)
      ? selectedEventTypes.filter((entry: string) => entry !== value)
      : [...selectedEventTypes, value];
    updateFilter({
      event_types: newTypes,
    });
  };

  const toggleBounceType = (value: BounceType) => {
    const newTypes = selectedBounceTypes.includes(value)
      ? selectedBounceTypes.filter((entry: string) => entry !== value)
      : [...selectedBounceTypes, value];
    updateFilter({ bounce_types: newTypes });
  };

  const toggleTag = (value: string) => {
    const newTags = selectedTags.includes(value)
      ? selectedTags.filter((entry: string) => entry !== value)
      : [...selectedTags, value];
    updateFilter({ tags: newTags });
  };

  const tagCountEntries = useMemo(
    () =>
      [...new Set([...Object.keys(counts.tags), ...selectedTags])]
        .sort((a, b) => a.localeCompare(b))
        .map((tag) => [tag, counts.tags[tag] ?? 0] as const),
    [counts.tags, selectedTags],
  );

  const handleExport = async () => {
    if (!sourceId) {
      return;
    }
    setExporting(true);
    try {
      const firstPageQuery = buildEventsQueryString({
        ...filterParams,
        per_page: 200,
        page: 1,
      });

      const response = await fetch(`/api/sources/${sourceId}/events?${firstPageQuery}`);
      if (!response.ok) {
        throw new Error('Failed to export events');
      }
      const firstPage = (await response.json()) as EventResponse;
      let allEvents = [...firstPage.data];
      const totalPages = firstPage.pagination?.total_pages ?? 1;

      for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
        const pageQuery = buildEventsQueryString({
          ...filterParams,
          per_page: 200,
          page: nextPage,
        });
        const pageResponse = await fetch(`/api/sources/${sourceId}/events?${pageQuery}`);
        if (!pageResponse.ok) {
          throw new Error('Failed to export events');
        }
        const pageData = (await pageResponse.json()) as EventResponse;
        allEvents = [...allEvents, ...pageData.data];
      }

      const csv = createCsv([
        ['Event', 'Recipient', 'Subject', 'Tags', 'Time'],
        ...allEvents.map((event) => [
          event.event_type,
          event.recipient_email ?? '',
          event.message_subject ?? '',
          event.tags.map((tag) => tag.label).join(' '),
          formatDateTime(event.event_at),
        ]),
      ]);

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildExportFileName(currentSource?.name, sourceId);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${allEvents.length} events`);
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Failed to export events');
    } finally {
      setExporting(false);
    }
  };

  const totalLabel = pagination ? `${pagination.total.toLocaleString()} events` : '—';

  if (!sourceId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-white/60">
        <p>Please select a source to view events.</p>
      </div>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Events"
        actions={
          <>
            <Button
              variant="ghost"
              type="button"
              aria-label="Refresh events"
              title="Refresh events"
              className={cn(controlClassName, secondaryControlClassName, 'w-9 px-0')}
              disabled={fetchingEvents}
              onClick={() => void refetchEvents()}
            >
              <RefreshCw
                className={cn(fetchingEvents && 'animate-spin motion-reduce:animate-none')}
                aria-hidden="true"
              />
            </Button>
            <Button
              variant="ghost"
              type="button"
              className={cn(controlClassName, secondaryControlClassName)}
              disabled={exporting}
              onClick={handleExport}
            >
              <Download aria-hidden="true" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {error ? (
          <p role="alert" className={errorClassName}>
            {error}
          </p>
        ) : null}

        <section aria-label="Event filters" className={cn(panelClassName, 'space-y-5 p-4 sm:p-5')}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/30"
                aria-hidden="true"
              />
              <Input
                aria-label="Search recipient or subject"
                className={cn(inputClassName, 'pl-9')}
                value={search}
                onChange={(event) => updateFilter({ search: event.target.value })}
                placeholder="Search recipient or subject"
              />
            </div>
            <Select
              value={datePreset}
              onValueChange={(value) => {
                if (value) {
                  updateFilter({ date_range: value as DateRangeValue });
                }
              }}
            >
              <SelectTrigger
                aria-label="Date range"
                className={cn(controlClassName, secondaryControlClassName)}
              >
                <CalendarDays className="text-white/50" aria-hidden="true" />
                <span>
                  {DATE_PRESETS.find((preset) => preset.value === datePreset)?.label || datePreset}
                </span>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TagFilterDropdown
              selectedTags={selectedTags}
              tagCountEntries={tagCountEntries}
              onClearTags={() => updateFilter({ tags: [] })}
              onToggleTag={toggleTag}
            />
          </div>

          {datePreset === 'custom' ? (
            <div className="grid max-w-lg grid-cols-2 gap-3">
              <label className="min-w-0 space-y-2">
                <span className={labelClassName}>From · UTC</span>
                <Input
                  type="date"
                  className={inputClassName}
                  value={from}
                  onChange={(event) => updateFilter({ from: event.target.value })}
                />
              </label>
              <label className="min-w-0 space-y-2">
                <span className={labelClassName}>To · UTC</span>
                <Input
                  type="date"
                  className={inputClassName}
                  value={to}
                  onChange={(event) => updateFilter({ to: event.target.value })}
                />
              </label>
            </div>
          ) : null}

          <div className="space-y-2.5">
            <h2 className={labelClassName}>Event types</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                type="button"
                aria-pressed={selectedEventTypes.length === 0}
                onClick={() => updateFilter({ event_types: [] })}
                className={cn(
                  controlClassName,
                  'h-8 rounded-md px-2.5',
                  selectedEventTypes.length === 0
                    ? 'border-blue-400/20 bg-blue-400/10 text-blue-200 hover:bg-blue-400/20'
                    : secondaryControlClassName,
                )}
              >
                All events
              </Button>
              {EVENT_TYPES.map((type) => {
                const isSelected = selectedEventTypes.includes(type);
                return (
                  <Button
                    variant="ghost"
                    key={type}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleEventType(type)}
                    className={cn(
                      controlClassName,
                      'h-8 rounded-md px-2.5',
                      isSelected
                        ? 'border-blue-400/20 bg-blue-400/10 text-blue-200 hover:bg-blue-400/20'
                        : secondaryControlClassName,
                    )}
                  >
                    {formatEventType(type)}
                    <span className="text-[11px] tabular-nums opacity-50">
                      {(counts.event_types[type] ?? 0).toLocaleString()}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          {selectedEventTypes.length === 0 ||
          selectedEventTypes.includes('Bounce') ||
          selectedBounceTypes.length > 0 ? (
            <div className="space-y-2.5">
              <h2 className={labelClassName}>Bounce types</h2>
              <div className="flex flex-wrap gap-2">
                {BOUNCE_TYPES.map((type) => {
                  const isSelected = selectedBounceTypes.includes(type);
                  return (
                    <Button
                      variant="ghost"
                      key={type}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleBounceType(type)}
                      className={cn(
                        controlClassName,
                        'h-8 rounded-md px-2.5',
                        isSelected
                          ? 'border-rose-400/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20'
                          : secondaryControlClassName,
                      )}
                    >
                      {type}
                      <span className="text-[11px] tabular-nums opacity-50">
                        {(counts.bounce_types[type] ?? 0).toLocaleString()}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selectedTags.length > 0 ? (
            <div
              className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4"
              aria-label="Selected tags"
            >
              {selectedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    controlClassName,
                    'h-7 max-w-full rounded-md border-blue-400/20 bg-blue-400/10 px-2 text-blue-200 hover:bg-blue-400/20',
                  )}
                >
                  <span className="truncate">{tag}</span>
                  <X aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => updateFilter({ tags: [] })}
                className={cn(
                  focusClassName,
                  'h-7 rounded px-1 text-xs text-white/40 hover:text-white/75',
                )}
              >
                Clear tags
              </button>
            </div>
          ) : null}
        </section>

        <section aria-label="Events">
          <div className="mb-3 text-xs text-white/45 tabular-nums" aria-live="polite">
            {loading ? 'Loading events…' : totalLabel}
          </div>
          <div className={cn(panelClassName, 'overflow-hidden')}>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[820px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-40" />
                  <col className="w-60" />
                  <col />
                  <col className="w-36" />
                  <col className="w-8" />
                </colgroup>
                <thead className={cn(tableHeaderClassName, 'border-b border-white/[0.06]')}>
                  <tr>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Event</th>
                    <th className="px-4 py-3 font-medium">Recipient</th>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 text-right font-medium">Time</th>
                    <th className="px-2 py-3">
                      <span className="sr-only">Open event</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {loading
                    ? EVENT_SKELETON_ROWS.map((rowId) => (
                        <tr key={rowId} className="animate-pulse motion-reduce:animate-none">
                          <td className="px-4 py-2.5">
                            <div className="flex min-w-0 flex-col items-start gap-1">
                              <div className="h-5 w-16 rounded-full bg-white/10" />
                              <div className="h-3 w-14 rounded bg-white/10" />
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="size-6 rounded-full bg-white/10" />
                              <div className="h-4 w-40 rounded bg-white/10" />
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="space-y-1.5">
                              <div className="h-4 w-56 rounded bg-white/10" />
                              <div className="flex gap-1">
                                <div className="h-5 w-28 rounded-full bg-white/10" />
                                <div className="h-5 w-24 rounded-full bg-white/10" />
                                <div className="h-5 w-16 rounded-full bg-white/10" />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="ml-auto h-4 w-20 rounded bg-white/10" />
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="h-4 w-4 rounded bg-white/10" />
                          </td>
                        </tr>
                      ))
                    : null}
                  {events.map((event: EventRow) => {
                    const recipientEmail = event.recipient_email || 'Unknown recipient';
                    const messageSubject = event.message_subject || '[no subject]';
                    const bounceType = event.bounce_type;
                    const messageLinkProps = {
                      to: '/s/$sourceId/messages/$sesMessageId',
                      params: {
                        sourceId: sourceId.toString(),
                        sesMessageId: event.ses_message_id,
                      },
                      search: detailSearch,
                    } as const;
                    const linkClassName =
                      'block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-400';

                    return (
                      <tr
                        key={event.id}
                        className="group transition-colors focus-within:bg-white/[0.06] hover:bg-white/[0.04]"
                      >
                        <td className="align-middle">
                          <Link
                            {...messageLinkProps}
                            aria-label={`Open ${event.event_type} event for ${recipientEmail}`}
                            className={`${linkClassName} px-4 py-2.5`}
                          >
                            <div className="flex min-w-0 flex-col items-start gap-1">
                              <EventBadge eventType={event.event_type} />
                              {bounceType ? (
                                <span className="max-w-full truncate text-xs text-white/35">
                                  {bounceType}
                                </span>
                              ) : null}
                            </div>
                          </Link>
                        </td>
                        <td className="align-middle">
                          <Link {...messageLinkProps} className={`${linkClassName} px-4 py-2.5`}>
                            <div className="flex min-w-0 items-center gap-2">
                              <RecipientAvatar email={recipientEmail} />
                              <span className="min-w-0 truncate text-white/80">
                                {recipientEmail}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td className="align-middle">
                          <div className="min-w-0 px-4 py-2.5">
                            <Link {...messageLinkProps} className={linkClassName}>
                              <span className="block truncate text-white/75" title={messageSubject}>
                                {messageSubject}
                              </span>
                            </Link>
                            {event.tags.length > 0 ? (
                              <div className="mt-1 flex min-w-0 flex-wrap gap-1">
                                {event.tags.slice(0, 3).map((tag) => (
                                  <button
                                    key={tag.label}
                                    type="button"
                                    className={cn(
                                      focusClassName,
                                      'max-w-[12rem] truncate rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/40 transition-colors hover:bg-white/10 hover:text-white/75',
                                    )}
                                    title={`Filter by ${tag.label}`}
                                    onClick={() => toggleTag(tag.label)}
                                  >
                                    {tag.label}
                                  </button>
                                ))}
                                {event.tags.length > 3 ? (
                                  <span
                                    className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/40"
                                    title={event.tags
                                      .slice(3)
                                      .map((tag) => tag.label)
                                      .join(', ')}
                                  >
                                    +{event.tags.length - 3}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="text-right align-middle">
                          <Link
                            {...messageLinkProps}
                            className={`${linkClassName} flex min-h-14 items-center justify-end px-4 py-2.5`}
                          >
                            <time
                              className="block text-xs whitespace-nowrap text-white/55 tabular-nums"
                              dateTime={new Date(event.event_at).toISOString()}
                              title={formatDateTime(event.event_at)}
                            >
                              {formatCompactEventTime(event.event_at)}
                            </time>
                          </Link>
                        </td>
                        <td className="align-middle text-white/25">
                          <Link
                            {...messageLinkProps}
                            aria-label={`View message ${messageSubject}`}
                            className={`${linkClassName} px-2 py-2.5`}
                          >
                            <ChevronRight
                              className="size-4 transition-colors group-hover:text-white/55"
                              aria-hidden="true"
                            />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {events.length === 0 && !loading ? (
              <p className="px-4 py-12 text-center text-sm text-white/40">
                No events match these filters.
              </p>
            ) : null}
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-white/45 tabular-nums">
                Page {pagination.page} of {pagination.total_pages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  className={cn(controlClassName, secondaryControlClassName)}
                  disabled={page <= 1}
                  onClick={() => updatePage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className={cn(controlClassName, secondaryControlClassName)}
                  disabled={page >= pagination.total_pages}
                  onClick={() => updatePage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </PageLayout>
  );
}
