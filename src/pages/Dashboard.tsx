import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { overviewQueryOptions, sourcesQueryOptions } from '../lib/queries'

const formatPercent = (value: number) =>
  `${(value * 100).toFixed(1)}%`

export default function DashboardPage() {
  const [sourceId, setSourceId] = useState<number | null>(null)

  const { data: sources = [] } = useQuery(sourcesQueryOptions)

  // Initialize sourceId if not set
  if (sourceId === null && sources.length > 0) {
    setSourceId(sources[0].id)
  }

  const { 
    data: overview, 
    isLoading: loading, 
    error: queryError 
  } = useQuery(overviewQueryOptions(sourceId))

  const error = queryError instanceof Error ? queryError.message : null

  const chartMax = useMemo(() => {
    if (!overview) {
      return 0
    }
    return Math.max(
      ...overview.chart.sent,
      ...overview.chart.delivered,
      ...overview.chart.bounced,
      1
    )
  }, [overview])

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-[#0B0C0E] border-x border-white/10">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-white">Dashboard</h1>
        </div>
        <div className="flex items-center space-x-3">
          <Link 
            to="/events"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors px-3 py-2"
          >
            Events
          </Link>
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white/10 text-white hover:bg-white/20 border border-white/10 h-9 px-4 py-2 shadow-sm"
            type="button"
            onClick={() => sourceId && setSourceId(sourceId)}
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="p-6 space-y-8 flex-1 overflow-y-auto">

      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-white">Summary</h2>
            <span className="text-sm font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
              {loading
                ? 'Loading…'
                : overview
                ? `${overview.range.from} → ${overview.range.to}`
                : '—'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-white/60">Source:</span>
            <select
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
              value={sourceId ?? ''}
              onChange={(event) => setSourceId(Number(event.target.value))}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id} className="text-black">
                  {source.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {error ? <p className="p-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</p> : null}

        {overview ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Sent', value: overview.metrics.sent, color: 'text-blue-400' },
              { label: 'Delivered', value: overview.metrics.delivered, color: 'text-green-400' },
              { label: 'Bounced', value: overview.metrics.bounced, color: 'text-red-400' },
              { label: 'Complaints', value: overview.metrics.complaints, color: 'text-orange-400' },
              { label: 'Sent today', value: overview.metrics.sent_today },
              { label: 'Bounce rate', value: formatPercent(overview.metrics.bounce_rate), color: overview.metrics.bounce_rate > 0.05 ? 'text-red-400' : 'text-white' },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col">
                <span className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-2">{stat.label}</span>
                <span className={`text-2xl font-display font-medium ${stat.color || 'text-white'}`}>{stat.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {overview ? (
        <section className="space-y-6">
           <div className="flex items-center justify-between border-b border-white/10 pb-4">
             <h2 className="text-lg font-semibold text-white">Daily volume</h2>
           </div>
          <div className="h-64 flex items-end justify-between space-x-1 pt-4">
            {overview.chart.days.map((day, index) => (
              <div key={day} className="flex-1 flex flex-col items-center group relative h-full justify-end group">
                 {/* Tooltip */}
                 <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-[#1A1B1E] border border-white/10 p-2 rounded text-xs z-10 w-32 shadow-xl">
                   <div className="flex justify-between"><span className="text-white/60">Sent</span> <span className="text-white">{overview.chart.sent[index]}</span></div>
                   <div className="flex justify-between"><span className="text-green-400/80">Delivered</span> <span className="text-green-400">{overview.chart.delivered[index]}</span></div>
                   <div className="flex justify-between"><span className="text-red-400/80">Bounced</span> <span className="text-red-400">{overview.chart.bounced[index]}</span></div>
                   <div className="mt-1 pt-1 border-t border-white/10 text-white/40 text-[10px] text-center">{day}</div>
                 </div>

                <div className="w-full max-w-[40px] flex flex-col-reverse h-full bg-white/[0.02] rounded-t-sm overflow-hidden relative">
                   <div 
                      className="w-full bg-red-500/80 transition-all duration-300"
                      style={{ height: `${(overview.chart.bounced[index] / chartMax) * 100}%` }}
                   />
                   <div 
                      className="w-full bg-green-500/60 transition-all duration-300"
                      style={{ height: `${(overview.chart.delivered[index] / chartMax) * 100}%` }}
                   />
                   {/* Sent is total, so usually represented by the full bar or separate. 
                       Here I'm stacking delivered + bounced? Or showing them relative to sent.
                       The original code had separate bars. Stacked is usually better for "volume". 
                       I'll stick to a simple representation: Total height = Sent, with colored segments?
                       Actually, let's just make it relative to chartMax.
                   */}
                   <div 
                      className="w-full bg-blue-500/20 absolute bottom-0 left-0 right-0 transition-all duration-300"
                      style={{ height: `${(overview.chart.sent[index] / chartMax) * 100}%`, zIndex: 0 }}
                   />
                </div>
                <span className="text-[10px] text-white/30 mt-2 font-mono hidden md:block">{day.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {overview ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-lg font-semibold text-white">Engagement</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
               {[
                { label: 'Opens', value: overview.metrics.opens },
                { label: 'Unique opens', value: overview.metrics.unique_opens },
                { label: 'Open rate', value: formatPercent(overview.metrics.open_rate), color: 'text-purple-400' },
                { label: 'Clicks', value: overview.metrics.clicks },
                { label: 'Unique clicks', value: overview.metrics.unique_clicks },
                { label: 'Click rate', value: formatPercent(overview.metrics.click_rate), color: 'text-purple-400' },
              ].map((stat) => (
                <div key={stat.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <span className="text-xs uppercase tracking-wider text-white/40 font-semibold block mb-2">{stat.label}</span>
                  <span className={`text-xl font-display font-medium ${stat.color || 'text-white'}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-lg font-semibold text-white">Bounce breakdown</h2>
            </div>
            <div className="space-y-3">
              {overview.bounce_breakdown.map((row) => (
                <div key={row.bounce_type} className="flex items-center justify-between text-sm group">
                  <span className="text-white/60 font-mono text-xs">{row.bounce_type}</span>
                  <div className="flex items-center space-x-3 flex-1 mx-4">
                    <div className="h-2 flex-1 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500/50 rounded-full"
                        style={{
                          width: `${overview.metrics.bounced ? (row.count / overview.metrics.bounced) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-white font-medium">{row.count}</span>
                </div>
              ))}
              {overview.bounce_breakdown.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-white/10 rounded-xl">
                  <p className="text-sm text-white/40">No bounce events in this range.</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
      </div>
    </div>
  )
}
