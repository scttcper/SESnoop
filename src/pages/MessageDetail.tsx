import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'

type Source = {
  id: number
  name: string
}

type MessageEvent = {
  id: number
  event_type: string
  recipient_email: string
  event_at: number
}

type MessageDetail = {
  id: number
  ses_message_id: string
  subject: string | null
  source_email: string | null
  destination_emails: string[]
  sent_at: number | null
  tags: string[]
  mail_metadata: Record<string, unknown>
  events_count: number
  events: MessageEvent[]
}

const formatDateTime = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : '—'

const formatJson = (value: Record<string, unknown>) =>
  JSON.stringify(value, null, 2)

export default function MessageDetailPage() {
  const { sesMessageId } = useParams({ from: '/messages/$sesMessageId' })
  const [sources, setSources] = useState<Source[]>([])
  const [sourceId, setSourceId] = useState<number | null>(null)
  const [message, setMessage] = useState<MessageDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messageTitle = useMemo(
    () => message?.subject ?? 'Message detail',
    [message?.subject]
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sourceParam = params.get('sourceId')
    if (sourceParam) {
      setSourceId(Number(sourceParam))
    }
  }, [])

  useEffect(() => {
    const loadSources = async () => {
      try {
        const response = await fetch('/api/sources')
        if (!response.ok) {
          throw new Error('Failed to load sources')
        }
        const data = (await response.json()) as Source[]
        setSources(data)
        if (!sourceId && data.length > 0) {
          setSourceId(data[0].id)
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
      }
    }

    void loadSources()
  }, [sourceId])

  useEffect(() => {
    const loadMessage = async () => {
      if (!sourceId) {
        return
      }
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/sources/${sourceId}/messages/${sesMessageId}`)
        if (!response.ok) {
          throw new Error('Failed to load message')
        }
        const data = (await response.json()) as MessageDetail
        setMessage(data)
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    void loadMessage()
  }, [sesMessageId, sourceId])

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Message detail</p>
          <h1>{messageTitle}</h1>
        </div>
        <div className="topbar-actions">
          <Link className="button ghost" to="/events">
            Back to events
          </Link>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Message overview</h2>
          <span className="meta">{loading ? 'Loading…' : 'Ready'}</span>
        </div>
        {error ? <p className="notice error">{error}</p> : null}
        <div className="filters">
          <label className="field">
            <span>Source</span>
            <select
              className="input"
              value={sourceId ?? ''}
              onChange={(event) => setSourceId(Number(event.target.value))}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {message ? (
          <div className="overview">
            <div className="stat">
              <span className="label">From</span>
              <span>{message.source_email ?? '—'}</span>
            </div>
            <div className="stat">
              <span className="label">To</span>
              <span>{message.destination_emails.join(', ') || '—'}</span>
            </div>
            <div className="stat">
              <span className="label">Sent at</span>
              <span>{formatDateTime(message.sent_at)}</span>
            </div>
            <div className="stat">
              <span className="label">SES message id</span>
              <span className="mono">{message.ses_message_id}</span>
            </div>
            <div className="stat">
              <span className="label">Events</span>
              <span>{message.events_count}</span>
            </div>
            <div className="stat">
              <span className="label">Tags</span>
              <span>{message.tags.length ? message.tags.join(', ') : '—'}</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Event timeline</h2>
        </div>
        {message?.events.length ? (
          <div className="timeline">
            {message.events.map((event) => (
              <div key={event.id} className="timeline-row">
                <span className="mono">{formatDateTime(event.event_at)}</span>
                <span>{event.recipient_email}</span>
                <span className={`badge badge-${event.event_type.toLowerCase()}`}>
                  {event.event_type}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <p>No events recorded yet.</p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Raw metadata</h2>
        </div>
        {message ? (
          <details className="metadata">
            <summary>View SES payload</summary>
            <pre className="code-block">{formatJson(message.mail_metadata)}</pre>
          </details>
        ) : null}
      </section>
    </div>
  )
}
