import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { eventsQueryOptions, sourcesQueryOptions } from '../lib/queries'

const EVENT_TYPES = [
  'Send',
  'Delivery',
  'Bounce',
  'Complaint',
  'Reject',
  'DeliveryDelay',
  'RenderingFailure',
  'Subscription',
  'Open',
  'Click',
]

const BOUNCE_TYPES = ['Permanent', 'Transient', 'Undetermined']

const DATE_PRESETS = [
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_45_days', label: 'Last 45 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'all_time', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
]

const formatDateTime = (value: number) =>
  new Date(value).toLocaleString()

export default function EventsPage() {
  const [sourceId, setSourceId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([])
  const [selectedBounceTypes, setSelectedBounceTypes] = useState<string[]>([])
  const [datePreset, setDatePreset] = useState('last_30_days')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const { data: sources = [] } = useQuery(sourcesQueryOptions)

  // Initialize sourceId if not set
  if (sourceId === null && sources.length > 0) {
    setSourceId(sources[0].id)
  }

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) {
      params.set('search', search.trim())
    }
    if (selectedEventTypes.length) {
      params.set('event_types', selectedEventTypes.join(','))
    }
    if (selectedBounceTypes.length) {
      params.set('bounce_types', selectedBounceTypes.join(','))
    }
    if (datePreset && datePreset !== 'custom') {
      params.set('date_range', datePreset)
    }
    if (datePreset === 'custom' && from) {
      params.set('from', from)
    }
    if (datePreset === 'custom' && to) {
      params.set('to', to)
    }
    params.set('page', page.toString())
    return params.toString()
  }, [datePreset, from, page, search, selectedBounceTypes, selectedEventTypes, to])

  const { 
    data: eventsResponse, 
    isLoading: loading, 
    error: queryError 
  } = useQuery(eventsQueryOptions(sourceId, queryString))

  const events = eventsResponse?.data ?? []
  const counts = eventsResponse?.counts ?? { event_types: {}, bounce_types: {} }
  const pagination = eventsResponse?.pagination ?? null
  const error = queryError instanceof Error ? queryError.message : null

  const toggleEventType = (value: string) => {
    setPage(1)
    setSelectedEventTypes((prev) =>
      prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value]
    )
  }

  const toggleBounceType = (value: string) => {
    setPage(1)
    setSelectedBounceTypes((prev) =>
      prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value]
    )
  }

  const totalLabel = pagination ? `${pagination.total} events` : '—'

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-[#0B0C0E] p-6 space-y-8 border-x border-white/10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-blue-400 mb-1">Event stream</p>
          <h1 className="text-3xl font-display font-bold tracking-tight text-white">Events & filters</h1>
        </div>
        <div className="flex items-center space-x-3">
          <Link 
            to="/sources"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors px-3 py-2"
          >
            Sources
          </Link>
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white/10 text-white hover:bg-white/20 border border-white/10 h-9 px-4 py-2 shadow-sm"
            type="button"
            onClick={() => setPage(1)}
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold text-white">Filters</h2>
          <span className="text-sm font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
            {loading ? 'Loading…' : totalLabel}
          </span>
        </div>
        {error ? <p className="p-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</p> : null}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="flex flex-col space-y-2">
            <span className="text-sm font-medium text-white/60">Source</span>
            <select
              className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
              value={sourceId ?? ''}
              onChange={(event) => {
                setPage(1)
                setSourceId(Number(event.target.value))
              }}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id} className="text-black">
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col space-y-2">
            <span className="text-sm font-medium text-white/60">Search</span>
            <input
              className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
              value={search}
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
              placeholder="Recipient or subject"
            />
          </label>
          <label className="flex flex-col space-y-2">
            <span className="text-sm font-medium text-white/60">Date range</span>
            <select
              className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
              value={datePreset}
              onChange={(event) => {
                setPage(1)
                setDatePreset(event.target.value)
              }}
            >
              {DATE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value} className="text-black">
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          {datePreset === 'custom' ? (
            <div className="flex space-x-2">
              <label className="flex flex-col space-y-2 flex-1">
                <span className="text-sm font-medium text-white/60">From</span>
                <input
                  className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setPage(1)
                    setFrom(event.target.value)
                  }}
                />
              </label>
              <label className="flex flex-col space-y-2 flex-1">
                <span className="text-sm font-medium text-white/60">To</span>
                <input
                  className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setPage(1)
                    setTo(event.target.value)
                  }}
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col space-y-4 pt-4 border-t border-white/10">
          <div>
            <span className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-2 block">Event types</span>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((type) => {
                const count = counts.event_types[type] ?? 0
                const active = selectedEventTypes.includes(type)
                return (
                  <button
                    key={type}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                      active 
                        ? 'bg-white text-black border-white' 
                        : 'bg-transparent text-white/60 border-white/10 hover:border-white/30 hover:text-white'
                    }`}
                    type="button"
                    onClick={() => toggleEventType(type)}
                  >
                    {type} <span className="opacity-60 ml-1">({count})</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
             <span className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-2 block">Bounce types</span>
            <div className="flex flex-wrap gap-2">
              {BOUNCE_TYPES.map((type) => {
                const count = counts.bounce_types[type] ?? 0
                const active = selectedBounceTypes.includes(type)
                return (
                  <button
                    key={type}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                      active 
                        ? 'bg-white text-black border-white' 
                        : 'bg-transparent text-white/60 border-white/10 hover:border-white/30 hover:text-white'
                    }`}
                    type="button"
                    onClick={() => toggleBounceType(type)}
                  >
                    {type} <span className="opacity-60 ml-1">({count})</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold text-white">Events</h2>
          <span className="text-sm text-white/40">Page {pagination?.page ?? 1} of {pagination?.total_pages ?? 1}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.01] overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] gap-4 p-4 border-b border-white/10 bg-white/[0.02] text-xs font-medium uppercase tracking-wider text-white/40">
            <span className="w-40">When</span>
            <span>Recipient</span>
            <span className="w-32">Type</span>
            <span>Subject</span>
            <span className="w-16 text-right">Action</span>
          </div>
          <div className="divide-y divide-white/5">
            {events.map((event) => (
              <div key={event.id} className="grid grid-cols-[auto_1fr_auto_1fr_auto] gap-4 p-4 items-center text-sm hover:bg-white/[0.02] transition-colors">
                <span className="text-white/60 font-mono text-xs w-40">{formatDateTime(event.event_at)}</span>
                <span className="text-white truncate">{event.recipient_email}</span>
                <div className="w-32">
                   <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide border ${
                      event.event_type === 'Bounce' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      event.event_type === 'Delivery' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      event.event_type === 'Send' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-white/5 text-white/60 border-white/10'
                   }`}>
                    {event.event_type}
                  </span>
                </div>
                <span className="text-white/60 truncate">{event.message_subject ?? '—'}</span>
                <div className="w-16 text-right">
                  <Link
                    className="text-xs font-medium text-white/60 hover:text-white hover:underline decoration-white/30 underline-offset-4"
                    to="/messages/$sesMessageId"
                    params={{ sesMessageId: event.ses_message_id }}
                    search={{ sourceId: sourceId ?? undefined }}
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
            {!loading && events.length === 0 ? (
              <div className="p-12 text-center text-white/40">
                <p>No events found for this filter set.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <button
            className="px-4 py-2 rounded-md border border-white/10 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            type="button"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={!pagination || pagination.page <= 1}
          >
            Previous
          </button>
          <button
            className="px-4 py-2 rounded-md border border-white/10 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            type="button"
            onClick={() =>
              setPage((prev) =>
                pagination ? Math.min(prev + 1, pagination.total_pages) : prev + 1
              )
            }
            disabled={!pagination || pagination.page >= pagination.total_pages}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  )
}
