import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearch, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
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
  // @ts-ignore
  const { sourceId: sourceIdStr } = useParams({ strict: false })
  const sourceId = sourceIdStr ? Number(sourceIdStr) : null

  // @ts-ignore
  const searchParams = useSearch({ strict: false })
  // @ts-ignore
  const navigate = useNavigate({ strict: false })

  const search = searchParams.search || ''
  const selectedEventTypes = searchParams.event_types || []
  const selectedBounceTypes = searchParams.bounce_types || []
  const datePreset = searchParams.date_range || 'last_30_days'
  const from = searchParams.from || ''
  const to = searchParams.to || ''
  const page = searchParams.page || 1

  const updateFilter = (updates: any) => {
    navigate({
        // @ts-ignore
        search: (prev: any) => ({ ...prev, ...updates, page: 1 }),
        replace: true,
    })
  }

  const updatePage = (newPage: number) => {
    navigate({
        // @ts-ignore
        search: (prev: any) => ({ ...prev, page: newPage }),
        replace: true,
    })
  }

  const { data: sources = [] } = useQuery(sourcesQueryOptions)
  const currentSource = sources.find((s) => s.id === sourceId)

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
    isLoading: loadingEvents, 
    error: queryError 
  } = useQuery(eventsQueryOptions(sourceId, queryString))

  const events = eventsResponse?.data ?? []
  const counts = eventsResponse?.counts ?? { event_types: {}, bounce_types: {} }
  const pagination = eventsResponse?.pagination ?? null
  const error = queryError instanceof Error ? queryError.message : null
  
  const loading = loadingEvents 

  const toggleEventType = (value: string) => {
    // @ts-ignore
    const newTypes = selectedEventTypes.includes(value) 
       // @ts-ignore
      ? selectedEventTypes.filter((entry: string) => entry !== value) 
       // @ts-ignore
      : [...selectedEventTypes, value]
    updateFilter({ event_types: newTypes })
  }

  const toggleBounceType = (value: string) => {
    // @ts-ignore
    const newTypes = selectedBounceTypes.includes(value) 
       // @ts-ignore
      ? selectedBounceTypes.filter((entry: string) => entry !== value) 
       // @ts-ignore
      : [...selectedBounceTypes, value]
    updateFilter({ bounce_types: newTypes })
  }

  const totalLabel = pagination ? `${pagination.total} events` : '—'
  
  if (!sourceId) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-white/60">
            <p>Please select a source to view events.</p>
        </div>
      )
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-[#0B0C0E] border-x border-white/10">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-white">
            {currentSource ? `${currentSource.name} Events` : 'Events'}
          </h1>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="ghost"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white/10 text-white hover:bg-white/20 border border-white/10 h-9 px-4 py-2 shadow-sm"
            type="button"
            onClick={() => updatePage(1)}
          >
            Refresh
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-8 flex-1 overflow-y-auto">

      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold text-white">Filters</h2>
          <span className="text-sm font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
            {loading ? 'Loading…' : totalLabel}
          </span>
        </div>
        {error ? <p className="p-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</p> : null}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="flex flex-col space-y-2">
            <span className="text-sm font-medium text-white/60">Search</span>
            <Input
              className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
              value={search}
              onChange={(event) => {
                updateFilter({ search: event.target.value })
              }}
              placeholder="Recipient or subject"
            />
          </label>
          <label className="flex flex-col space-y-2">
            <span className="text-sm font-medium text-white/60">Date range</span>
            <Select
              value={datePreset}
              onValueChange={(value) => {
                updateFilter({ date_range: value })
              }}
            >
              <SelectTrigger className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors">
                <span className="block truncate">
                  {DATE_PRESETS.find(p => p.value === datePreset)?.label || datePreset}
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
             <div className="flex gap-2 items-end">
                <label className="flex-1 flex flex-col space-y-2">
                    <span className="text-sm font-medium text-white/60">From</span>
                     <Input
                        type="date"
                        className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                        value={from}
                        onChange={(e) => {
                             updateFilter({ from: e.target.value })
                        }}
                     />
                </label>
                <label className="flex-1 flex flex-col space-y-2">
                    <span className="text-sm font-medium text-white/60">To</span>
                     <Input
                        type="date"
                        className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                        value={to}
                        onChange={(e) => {
                             updateFilter({ to: e.target.value })
                        }}
                     />
                </label>
             </div>
            )}
        </div>
        
        <div className="space-y-4">
          <div>
            <span className="block text-sm font-medium text-white/60 mb-2">Event types</span>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((type) => {
                const count = counts.event_types?.[type] ?? 0
                const isSelected = selectedEventTypes.includes(type)
                return (
                  <Button variant="ghost"
                    key={type}
                    type="button"
                    onClick={() => toggleEventType(type)}
                    className={`
                      px-3 py-1.5 rounded-full text-xs font-medium border transition-colors h-auto
                      ${isSelected 
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-200' 
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                      }
                    `}
                  >
                    {type}
                    <span className="ml-2 font-mono opacity-60">{count}</span>
                  </Button>
                )
              })}
            </div>
          </div>
          
          <div>
             <span className="block text-sm font-medium text-white/60 mb-2">Bounce types</span>
            <div className="flex flex-wrap gap-2">
              {BOUNCE_TYPES.map((type) => {
                const count = counts.bounce_types?.[type] ?? 0
                const isSelected = selectedBounceTypes.includes(type)
                return (
                  <Button variant="ghost"
                    key={type}
                    type="button"
                    onClick={() => toggleBounceType(type)}
                     className={`
                      px-3 py-1.5 rounded-full text-xs font-medium border transition-colors h-auto
                      ${isSelected 
                        ? 'bg-red-500/20 border-red-500/50 text-red-200' 
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                      }
                    `}
                  >
                    {type}
                    <span className="ml-2 font-mono opacity-60">{count}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-white/60 uppercase text-xs font-medium">
              <tr>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Recipient</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
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
                <tr key={event.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`
                      inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                      ${event.event_type === 'Bounce' ? 'bg-red-500/10 text-red-400' : 
                        event.event_type === 'Complaint' ? 'bg-orange-500/10 text-orange-400' :
                        event.event_type === 'Delivery' ? 'bg-green-500/10 text-green-400' :
                        'bg-white/10 text-white'
                      }
                    `}>
                      {event.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white">
                    {event.recipient_email || '—'}
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {event.message_subject || '—'}
                  </td>
                  <td className="px-4 py-3 text-white/60 font-mono text-xs">
                    {formatDateTime(event.event_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/messages/$sesMessageId"
                      params={{ sesMessageId: event.ses_message_id }}
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
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
          <div className="flex items-center justify-between pt-6 border-t border-white/10 mt-6">
            <div className="text-sm text-white/60">
              Page {pagination.page} of {pagination.total_pages}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost"
                type="button"
                className="px-3 py-1 text-sm border border-white/10 rounded hover:bg-white/5 text-white disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => updatePage(page - 1)}
              >
                Previous
              </Button>
              <Button variant="ghost"
                type="button"
                className="px-3 py-1 text-sm border border-white/10 rounded hover:bg-white/5 text-white disabled:opacity-50"
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
  )
}
