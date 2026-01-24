import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Activity, Plus, BarChart3, ArrowRight } from 'lucide-react'
import { overviewQueryOptions, sourcesQueryOptions } from '../lib/queries'
import { useActiveSourceId } from '../lib/use-active-source'
import { cn, COLOR_STYLES } from '../lib/utils'

const formatPercent = (value: number) =>
  `${(value * 100).toFixed(1)}%`

type SourceItem = {
  id: number
  name: string
  color: keyof typeof COLOR_STYLES
}

type OverviewChart = {
  days: string[]
  sent: number[]
  delivered: number[]
  bounced: number[]
}

type OverviewMetrics = {
  sent: number
  delivered: number
  bounced: number
  complaints: number
  sent_today: number
  bounce_rate: number
  opens: number
  unique_opens: number
  open_rate: number
  clicks: number
  unique_clicks: number
  click_rate: number
}

type BounceBreakdownRow = {
  bounce_type: string
  count: number
}

type OverviewData = {
  range: {
    from: string
    to: string
  }
  metrics: OverviewMetrics
  chart: OverviewChart
  bounce_breakdown: BounceBreakdownRow[]
}

type QueryError = string | null

function LoadingState() {
  return <div className="p-8 text-white/50">Loading...</div>
}

function EmptySourceState({ sources }: { sources: SourceItem[] }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-[#0B0C0E]">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-4xl w-full">
          <div className="mb-12">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
              <BarChart3 className="w-8 h-8 text-white/40" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white mb-3">Select a Source</h1>
            <p className="text-lg text-white/60 max-w-lg mx-auto">
              Choose a source to view its dashboard, events, and metrics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {sources.map((source) => (
              <Link
                key={source.id}
                to="/s/$sourceId/events"
                params={{ sourceId: source.id.toString() }}
                className="group relative flex flex-col rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all duration-200 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={cn("w-3 h-3 rounded-full ring-2 ring-white/10", COLOR_STYLES[source.color])} />
                    <h2 className="text-lg font-semibold text-white group-hover:text-blue-200 transition-colors">
                      {source.name}
                    </h2>
                  </div>
                  <div className="text-sm text-white/40 mb-6">
                    Click to view dashboard & events
                  </div>
                  <div className="flex items-center text-sm font-medium text-white/40 group-hover:text-white transition-colors">
                    Select Source <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </div>
                </div>
                <div className="h-1 w-full mt-auto bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}

            <Link
              to="/sources"
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-transparent hover:bg-white/[0.02] hover:border-white/20 transition-all min-h-[160px] group"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:bg-white/10 transition-colors">
                <Plus className="w-5 h-5 text-white/40 group-hover:text-white/80" />
              </div>
              <span className="font-medium text-white/60 group-hover:text-white transition-colors">Create new source</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardHeader({
  sourceId,
  sources,
  overview,
}: {
  sourceId: number
  sources: SourceItem[]
  overview: OverviewData | undefined
}) {
  return (
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div>
        <h1 className="text-2xl font-display font-semibold tracking-tight text-white">Dashboard</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-white/40">Viewing data for</span>
          {overview ? (
            <span className="text-sm font-medium text-white/80 px-2 py-0.5 rounded bg-white/5 border border-white/10">
              {sources.find((s) => s.id === sourceId)?.name || 'Unknown Source'}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <Link
          to="/s/$sourceId/events"
          params={{ sourceId: sourceId.toString() }}
          className="text-sm font-medium text-white/60 hover:text-white transition-colors px-3 py-2 flex items-center gap-2"
        >
          <Activity className="w-4 h-4" />
          Events
        </Link>
      </div>
    </header>
  )
}

function SummarySection({
  overview,
  loadingOverview,
  error,
}: {
  overview: OverviewData | undefined
  loadingOverview: boolean
  error: QueryError
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-white">Summary</h2>
          <span className="text-sm font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
            {loadingOverview
              ? 'Loading…'
              : overview
              ? `${overview.range.from} → ${overview.range.to}`
              : '—'}
          </span>
        </div>
      </div>

      {error ? (
        <p className="p-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</p>
      ) : null}

      {overview ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Sent', value: overview.metrics.sent, color: 'text-blue-400' },
            { label: 'Delivered', value: overview.metrics.delivered, color: 'text-green-400' },
            { label: 'Bounced', value: overview.metrics.bounced, color: 'text-red-400' },
            { label: 'Complaints', value: overview.metrics.complaints, color: 'text-orange-400' },
            { label: 'Sent today', value: overview.metrics.sent_today },
            {
              label: 'Bounce rate',
              value: formatPercent(overview.metrics.bounce_rate),
              color: overview.metrics.bounce_rate > 0.05 ? 'text-red-400' : 'text-white',
            },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col">
              <span className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-2">{stat.label}</span>
              <span className={`text-2xl font-display font-medium ${stat.color || 'text-white'}`}>{stat.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function DailyVolumeSection({ overview, chartMax }: { overview: OverviewData; chartMax: number }) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold text-white">Daily volume</h2>
      </div>
      <div className="h-64 flex items-end justify-between space-x-1 pt-4">
        {overview.chart.days.map((day, index) => (
          <div key={day} className="flex-1 flex flex-col items-center group relative h-full justify-end group">
            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-[#1A1B1E] border border-white/10 p-2 rounded text-xs z-10 w-32 shadow-xl">
              <div className="flex justify-between">
                <span className="text-white/60">Sent</span> <span className="text-white">{overview.chart.sent[index]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-400/80">Delivered</span>{' '}
                <span className="text-green-400">{overview.chart.delivered[index]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-400/80">Bounced</span> <span className="text-red-400">{overview.chart.bounced[index]}</span>
              </div>
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
  )
}

function EngagementSection({ overview }: { overview: OverviewData }) {
  return (
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
  )
}

function BounceBreakdownSection({ overview }: { overview: OverviewData }) {
  return (
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
  )
}

export default function DashboardPage() {
  const sourceId = useActiveSourceId()
  const { data: sources = [], isLoading: loadingSources } = useQuery(sourcesQueryOptions)
  
  const { 
    data: overview, 
    isLoading: loadingOverview, 
    error: queryError 
  } = useQuery({
    ...overviewQueryOptions(sourceId),
    enabled: !!sourceId
  })

  // Hook must be called unconditionally
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

  // 1. Loading State
  if (loadingSources) {
    return <LoadingState />
  }

  // 2. No Source Selected State
  if (!sourceId) {
    return <EmptySourceState sources={sources} />
  }

  // 3. Active Dashboard State
  const error = queryError instanceof Error ? queryError.message : null

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-[#0B0C0E] border-x border-white/10">
      <DashboardHeader sourceId={sourceId} sources={sources} overview={overview} />

      <div className="p-6 space-y-8 flex-1 overflow-y-auto">
        <SummarySection overview={overview} loadingOverview={loadingOverview} error={error} />

        {overview ? <DailyVolumeSection overview={overview} chartMax={chartMax} /> : null}

        {overview ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <EngagementSection overview={overview} />
            <BounceBreakdownSection overview={overview} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
