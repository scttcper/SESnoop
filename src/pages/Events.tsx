import { useQuery } from '@tanstack/react-query';
import { Link, useParams, getRouteApi } from '@tanstack/react-router';
import { useMemo } from 'react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select';
import { BOUNCE_TYPES, DATE_PRESETS, EVENT_TYPES } from '../lib/constants';
import { eventsQueryOptions, sourcesQueryOptions } from '../lib/queries';
import type { EventsSearchParams } from '../router';

const routeApi = getRouteApi('/app/s/$sourceId/events');

const formatDateTime = (value: number) => new Date(value).toLocaleString();

export default function EventsPage() {
  const { sourceId: sourceIdStr } = useParams({ strict: false });
  const sourceId = sourceIdStr ? Number(sourceIdStr) : null;

  const searchParams = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const search = searchParams.search;
  const selectedEventTypes = searchParams.event_types;
  const selectedBounceTypes = searchParams.bounce_types;
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

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set('search', search.trim());
    }
    if (selectedEventTypes.length > 0) {
      params.set('event_types', selectedEventTypes.join(','));
    }
    if (selectedBounceTypes.length > 0) {
      params.set('bounce_types', selectedBounceTypes.join(','));
    }
    if (datePreset && datePreset !== 'custom') {
      params.set('date_range', datePreset);
    }
    if (datePreset === 'custom' && from) {
      params.set('from', from);
    }
    if (datePreset === 'custom' && to) {
      params.set('to', to);
    }
    params.set('page', page.toString());
    return params.toString();
  }, [datePreset, from, page, search, selectedBounceTypes, selectedEventTypes, to]);

  const {
    data: eventsResponse,
    isLoading: loadingEvents,
    error: queryError,
  } = useQuery(eventsQueryOptions(sourceId, queryString));

  const events = eventsResponse?.data ?? [];
  const counts = eventsResponse?.counts ?? { event_types: {}, bounce_types: {} };
  const pagination = eventsResponse?.pagination ?? null;
  const error = queryError instanceof Error ? queryError.message : null;

  const loading = loadingEvents;

  const toggleEventType = (value: string) => {
    const newTypes = selectedEventTypes.includes(value)
      ? selectedEventTypes.filter((entry: string) => entry !== value)
      : [...selectedEventTypes, value];
    updateFilter({ event_types: newTypes });
  };

  const toggleBounceType = (value: string) => {
    const newTypes = selectedBounceTypes.includes(value)
      ? selectedBounceTypes.filter((entry: string) => entry !== value)
      : [...selectedBounceTypes, value];
    updateFilter({ bounce_types: newTypes });
  };

  const totalLabel = pagination ? `${pagination.total} events` : '—';

  if (!sourceId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-white/60">
        <p>Please select a source to view events.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col border-x border-white/10 bg-[#0B0C0E]">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
            {currentSource ? `${currentSource.name} Events` : 'Events'}
          </h1>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            className="ring-offset-background focus-visible:ring-ring inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            type="button"
            onClick={() => updatePage(1)}
          >
            Refresh
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto p-6">
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-semibold text-white">Filters</h2>
            <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-sm text-white/40">
              {loading ? 'Loading…' : totalLabel}
            </span>
          </div>
          {error ? (
            <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-400">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col space-y-2">
              <span className="text-sm font-medium text-white/60">Search</span>
              <Input
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors placeholder:text-white/20 focus:border-white/30 focus:outline-none"
                value={search}
                onChange={(event) => {
                  updateFilter({ search: event.target.value });
                }}
                placeholder="Recipient or subject"
              />
            </label>
            <label className="flex flex-col space-y-2">
              <span className="text-sm font-medium text-white/60">Date range</span>
              <Select
                value={datePreset}
                onValueChange={(value) => {
                  updateFilter({ date_range: value ?? undefined });
                }}
              >
                <SelectTrigger className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-white/30 focus:outline-none">
                  <span className="block truncate">
                    {DATE_PRESETS.find((p) => p.value === datePreset)?.label || datePreset}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {datePreset === 'custom' && (
              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col space-y-2">
                  <span className="text-sm font-medium text-white/60">From</span>
                  <Input
                    type="date"
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-white/30 focus:outline-none"
                    value={from}
                    onChange={(e) => {
                      updateFilter({ from: e.target.value });
                    }}
                  />
                </label>
                <label className="flex flex-1 flex-col space-y-2">
                  <span className="text-sm font-medium text-white/60">To</span>
                  <Input
                    type="date"
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-white/30 focus:outline-none"
                    value={to}
                    onChange={(e) => {
                      updateFilter({ to: e.target.value });
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <span className="mb-2 block text-sm font-medium text-white/60">Event types</span>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((type) => {
                  const count = counts.event_types?.[type] ?? 0;
                  const isSelected = selectedEventTypes.includes(type);
                  return (
                    <Button
                      variant="ghost"
                      key={type}
                      type="button"
                      onClick={() => toggleEventType(type)}
                      className={`h-auto rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-blue-500/50 bg-blue-500/20 text-blue-200'
                          : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                      } `}
                    >
                      {type}
                      <span className="ml-2 font-mono opacity-60">{count}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-white/60">Bounce types</span>
              <div className="flex flex-wrap gap-2">
                {BOUNCE_TYPES.map((type) => {
                  const count = counts.bounce_types?.[type] ?? 0;
                  const isSelected = selectedBounceTypes.includes(type);
                  return (
                    <Button
                      variant="ghost"
                      key={type}
                      type="button"
                      onClick={() => toggleBounceType(type)}
                      className={`h-auto rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-red-500/50 bg-red-500/20 text-red-200'
                          : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                      } `}
                    >
                      {type}
                      <span className="ml-2 font-mono opacity-60">{count}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs font-medium text-white/60 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Recipient</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-white/[0.02]">
                {events.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-white/40">
                      No events found for this range.
                    </td>
                  </tr>
                ) : null}
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-white/40">
                      Loading events...
                    </td>
                  </tr>
                ) : null}
                {events.map((event) => (
                  <tr key={event.id} className="transition-colors hover:bg-white/5">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          event.event_type === 'Bounce'
                            ? 'bg-red-500/10 text-red-400'
                            : event.event_type === 'Complaint'
                              ? 'bg-orange-500/10 text-orange-400'
                              : event.event_type === 'Delivery'
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-white/10 text-white'
                        } `}
                      >
                        {event.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">{event.recipient_email || '—'}</td>
                    <td className="px-4 py-3 text-white/70">{event.message_subject || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/60">
                      {formatDateTime(event.event_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/messages/$sesMessageId"
                        params={{ sesMessageId: event.ses_message_id }}
                        className="text-xs font-medium text-blue-400 transition-colors hover:text-blue-300"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 ? (
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-6">
              <div className="text-sm text-white/60">
                Page {pagination.page} of {pagination.total_pages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  className="rounded border border-white/10 px-3 py-1 text-sm text-white hover:bg-white/5 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => updatePage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className="rounded border border-white/10 px-3 py-1 text-sm text-white hover:bg-white/5 disabled:opacity-50"
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
    </div>
  );
}
