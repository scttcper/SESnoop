import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  messageQueryOptions,
  sourcesQueryOptions,
} from '../lib/queries'

const formatDateTime = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : '—'

const formatJson = (value: Record<string, unknown>) =>
  JSON.stringify(value, null, 2)

export default function MessageDetailPage() {
  const { sesMessageId } = useParams({ from: '/app/messages/$sesMessageId' })
  const [sourceId, setSourceId] = useState<number | null>(null)

  const { data: sources = [] } = useQuery(sourcesQueryOptions)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sourceParam = params.get('sourceId')
    if (sourceParam) {
      setSourceId(Number(sourceParam))
    } else if (sources.length > 0 && !sourceId) {
      setSourceId(sources[0].id)
    }
  }, [sources, sourceId])

  const {
    data: message,
    isLoading: loading,
    error: queryError,
  } = useQuery(messageQueryOptions(sourceId, sesMessageId))

  const error = queryError instanceof Error ? queryError.message : null

  const messageTitle = useMemo(
    () => message?.subject ?? 'Message detail',
    [message?.subject]
  )

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-[#0B0C0E] border-x border-white/10">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-display font-semibold tracking-tight text-white max-w-4xl truncate" title={messageTitle}>
            {messageTitle}
          </h1>
        </div>
        <div className="topbar-actions">
          <Link 
            to="/events"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors px-3 py-2 border border-white/10 rounded-md hover:bg-white/5"
          >
            Back to events
          </Link>
        </div>
      </header>

      <div className="p-6 space-y-8 flex-1 overflow-y-auto">

      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold text-white">Message overview</h2>
          <span className="text-sm font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
             {loading ? 'Loading…' : 'Ready'}
          </span>
        </div>
        {error ? <p className="p-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</p> : null}
        
        <div className="w-full md:w-1/3 mb-6">
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
              <SelectTrigger className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10">
              <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-2">From</span>
              <span className="text-sm text-white break-all">{message.source_email ?? '—'}</span>
            </div>
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10">
              <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-2">To</span>
              <span className="text-sm text-white break-all">{message.destination_emails.join(', ') || '—'}</span>
            </div>
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10">
              <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-2">Sent at</span>
              <span className="text-sm text-white">{formatDateTime(message.sent_at)}</span>
            </div>
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10 md:col-span-2">
              <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-2">SES Message ID</span>
              <span className="font-mono text-sm text-white select-all">{message.ses_message_id}</span>
            </div>
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10">
              <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-2">Events</span>
              <span className="text-2xl font-display font-medium text-white">{message.events_count}</span>
            </div>
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10 md:col-span-3">
              <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-2">Tags</span>
              <div className="flex flex-wrap gap-2">
                {message.tags.length ? message.tags.map(tag => (
                   <span key={tag} className="px-2 py-1 rounded-full bg-white/10 text-xs font-mono text-white/80">{tag}</span>
                )) : <span className="text-sm text-white/40">—</span>}
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
          <div className="flex flex-col space-y-4 relative pl-4 border-l border-white/10 ml-2">
            {message.events.map((event) => (
              <div key={event.id} className="relative pl-6">
                <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-[#0B0C0E] ${
                   event.event_type === 'Bounce' ? 'bg-red-500' :
                   event.event_type === 'Delivery' ? 'bg-green-500' :
                   event.event_type === 'Send' ? 'bg-blue-500' :
                   'bg-white/40'
                }`} />
                <div className="flex flex-col md:flex-row md:items-center md:justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center space-x-3 mb-2 md:mb-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide border ${
                      event.event_type === 'Bounce' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      event.event_type === 'Delivery' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      event.event_type === 'Send' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-white/5 text-white/60 border-white/10'
                   }`}>
                      {event.event_type}
                    </span>
                    <span className="text-sm text-white">{event.recipient_email}</span>
                  </div>
                  <span className="text-xs font-mono text-white/40">{formatDateTime(event.event_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-xl">
             <p className="text-sm text-white/40">No events recorded yet.</p>
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold text-white">Raw metadata</h2>
        </div>
        {message ? (
          <div className="rounded-xl border border-white/10 bg-[#0D0E11] overflow-hidden">
            <details className="group">
              <summary className="flex items-center cursor-pointer p-4 list-none text-sm font-medium text-white/60 hover:text-white transition-colors select-none">
                 <span className="mr-2 transition-transform group-open:rotate-90">▶</span>
                 View SES payload
              </summary>
              <div className="border-t border-white/5 p-4 overflow-x-auto bg-black/30">
                <pre className="text-xs font-mono text-blue-300/90 leading-relaxed">
                  {formatJson(message.mail_metadata)}
                </pre>
              </div>
            </details>
          </div>
        ) : null}
      </section>
      </div>
    </div>
  )
}
