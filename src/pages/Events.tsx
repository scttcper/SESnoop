import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

type Source = {
  id: number
  name: string
}

type EventRow = {
  id: number
  event_type: string
  recipient_email: string
  event_at: number
  ses_message_id: string
  bounce_type: string | null
  message_subject: string | null
}

type EventCounts = {
  event_types: Record<string, number>
  bounce_types: Record<string, number>
}

type EventResponse = {
  data: EventRow[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
  counts: EventCounts
}

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
  const [sources, setSources] = useState<Source[]>([])
  const [sourceId, setSourceId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([])
  const [selectedBounceTypes, setSelectedBounceTypes] = useState<string[]>([])
  const [datePreset, setDatePreset] = useState('last_30_days')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [events, setEvents] = useState<EventRow[]>([])
  const [counts, setCounts] = useState<EventCounts>({
    event_types: {},
    bounce_types: {},
  })
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<EventResponse['pagination'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    const loadSources = async () => {
      try {
        const response = await fetch('/api/sources')
        if (!response.ok) {
          throw new Error('Failed to load sources')
        }
        const data = (await response.json()) as Source[]
        setSources(data)
        if (data.length > 0) {
          setSourceId((prev) => prev ?? data[0].id)
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
      }
    }

    void loadSources()
  }, [])

  useEffect(() => {
    const loadEvents = async () => {
      if (!sourceId) {
        return
      }
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/sources/${sourceId}/events?${queryString}`)
        if (!response.ok) {
          throw new Error('Failed to load events')
        }
        const data = (await response.json()) as EventResponse
        setEvents(data.data)
        setCounts(data.counts)
        setPagination(data.pagination)
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    void loadEvents()
  }, [queryString, sourceId])

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
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Event stream</p>
          <h1>Events & filters</h1>
        </div>
        <div className="topbar-actions">
          <Link className="button ghost" to="/sources">
            Sources
          </Link>
          <button className="button primary" type="button" onClick={() => setPage(1)}>
            Refresh
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Filters</h2>
          <span className="meta">{loading ? 'Loading…' : totalLabel}</span>
        </div>
        {error ? <p className="notice error">{error}</p> : null}
        <div className="filters">
          <label className="field">
            <span>Source</span>
            <select
              className="input"
              value={sourceId ?? ''}
              onChange={(event) => {
                setPage(1)
                setSourceId(Number(event.target.value))
              }}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Search</span>
            <input
              className="input"
              value={search}
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
              placeholder="Recipient or subject"
            />
          </label>
          <label className="field">
            <span>Date range</span>
            <select
              className="input"
              value={datePreset}
              onChange={(event) => {
                setPage(1)
                setDatePreset(event.target.value)
              }}
            >
              {DATE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          {datePreset === 'custom' ? (
            <>
              <label className="field">
                <span>From</span>
                <input
                  className="input"
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setPage(1)
                    setFrom(event.target.value)
                  }}
                />
              </label>
              <label className="field">
                <span>To</span>
                <input
                  className="input"
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setPage(1)
                    setTo(event.target.value)
                  }}
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="filter-groups">
          <div>
            <span className="label">Event types</span>
            <div className="chips">
              {EVENT_TYPES.map((type) => {
                const count = counts.event_types[type] ?? 0
                const active = selectedEventTypes.includes(type)
                return (
                  <button
                    key={type}
                    className={`chip-btn ${active ? 'active' : ''}`}
                    type="button"
                    onClick={() => toggleEventType(type)}
                  >
                    {type} ({count})
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <span className="label">Bounce types</span>
            <div className="chips">
              {BOUNCE_TYPES.map((type) => {
                const count = counts.bounce_types[type] ?? 0
                const active = selectedBounceTypes.includes(type)
                return (
                  <button
                    key={type}
                    className={`chip-btn ${active ? 'active' : ''}`}
                    type="button"
                    onClick={() => toggleBounceType(type)}
                  >
                    {type} ({count})
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Events</h2>
          <span className="meta">Page {pagination?.page ?? 1} of {pagination?.total_pages ?? 1}</span>
        </div>
        <div className="table">
          <div className="table-header">
            <span>When</span>
            <span>Recipient</span>
            <span>Type</span>
            <span>Subject</span>
            <span>Message</span>
          </div>
          {events.map((event) => (
            <div key={event.id} className="table-row">
              <span className="mono">{formatDateTime(event.event_at)}</span>
              <span>{event.recipient_email}</span>
              <span className={`badge badge-${event.event_type.toLowerCase()}`}>
                {event.event_type}
              </span>
              <span>{event.message_subject ?? '—'}</span>
              <Link
                className="link"
                to="/messages/$sesMessageId"
                params={{ sesMessageId: event.ses_message_id }}
                search={{ sourceId: sourceId ?? undefined }}
              >
                View
              </Link>
            </div>
          ))}
          {!loading && events.length === 0 ? (
            <div className="empty">
              <p>No events found for this filter set.</p>
            </div>
          ) : null}
        </div>

        <div className="pager">
          <button
            className="button ghost"
            type="button"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={!pagination || pagination.page <= 1}
          >
            Previous
          </button>
          <button
            className="button ghost"
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
