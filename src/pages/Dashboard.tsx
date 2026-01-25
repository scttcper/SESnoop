import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Activity, Plus, BarChart3, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

import { overviewQueryOptions, sourcesQueryOptions } from '../lib/queries';
import { useActiveSourceId } from '../lib/use-active-source';
import { cn, COLOR_STYLES } from '../lib/utils';

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

type SourceItem = {
  id: number;
  name: string;
  color: keyof typeof COLOR_STYLES;
};

type OverviewChart = {
  days: string[];
  sent: number[];
  delivered: number[];
  bounced: number[];
};

type OverviewMetrics = {
  sent: number;
  delivered: number;
  bounced: number;
  complaints: number;
  sent_today: number;
  bounce_rate: number;
  opens: number;
  unique_opens: number;
  open_rate: number;
  clicks: number;
  unique_clicks: number;
  click_rate: number;
};

type BounceBreakdownRow = {
  bounce_type: string;
  count: number;
};

type OverviewData = {
  range: {
    from: string;
    to: string;
  };
  metrics: OverviewMetrics;
  chart: OverviewChart;
  bounce_breakdown: BounceBreakdownRow[];
};

type QueryError = string | null;

function LoadingState() {
  return <div className="p-8 text-white/50">Loading...</div>;
}

function EmptySourceState({ sources }: { sources: SourceItem[] }) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#0B0C0E]">
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-4xl">
          <div className="mb-12">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <BarChart3 className="h-8 w-8 text-white/40" />
            </div>
            <h1 className="font-display mb-3 text-3xl font-bold text-white">Select a Source</h1>
            <p className="mx-auto max-w-lg text-lg text-white/60">
              Choose a source to view its dashboard, events, and metrics.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 text-left md:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => (
              <Link
                key={source.id}
                to="/s/$sourceId/events"
                params={{ sourceId: source.id.toString() }}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition-all duration-200 hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className={cn(
                        'w-3 h-3 rounded-full ring-2 ring-white/10',
                        COLOR_STYLES[source.color],
                      )}
                    />
                    <h2 className="text-lg font-semibold text-white transition-colors group-hover:text-blue-200">
                      {source.name}
                    </h2>
                  </div>
                  <div className="mb-6 text-sm text-white/40">Click to view dashboard & events</div>
                  <div className="flex items-center text-sm font-medium text-white/40 transition-colors group-hover:text-white">
                    Select Source{' '}
                    <ArrowRight className="ml-2 h-4 w-4 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                </div>
                <div className="mt-auto h-1 w-full bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}

            <Link
              to="/sources"
              className="group flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-transparent transition-all hover:border-white/20 hover:bg-white/[0.02]"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-colors group-hover:bg-white/10">
                <Plus className="h-5 w-5 text-white/40 group-hover:text-white/80" />
              </div>
              <span className="font-medium text-white/60 transition-colors group-hover:text-white">
                Create new source
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardHeader({
  sourceId,
  sources,
  overview,
}: {
  sourceId: number;
  sources: SourceItem[];
  overview: OverviewData | undefined;
}) {
  return (
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-white/40">Viewing data for</span>
          {overview ? (
            <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-sm font-medium text-white/80">
              {sources.find((s) => s.id === sourceId)?.name || 'Unknown Source'}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <Link
          to="/s/$sourceId/events"
          params={{ sourceId: sourceId.toString() }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
        >
          <Activity className="h-4 w-4" />
          Events
        </Link>
      </div>
    </header>
  );
}

function SummarySection({
  overview,
  loadingOverview,
  error,
}: {
  overview: OverviewData | undefined;
  loadingOverview: boolean;
  error: QueryError;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-white">Summary</h2>
          <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-sm text-white/40">
            {loadingOverview
              ? 'Loading…'
              : overview
                ? `${overview.range.from} → ${overview.range.to}`
                : '—'}
          </span>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      {overview ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
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
            <div
              key={stat.label}
              className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >
              <span className="mb-2 text-xs font-semibold tracking-wider text-white/40 uppercase">
                {stat.label}
              </span>
              <span className={`font-display text-2xl font-medium ${stat.color || 'text-white'}`}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DailyVolumeSection({ overview, chartMax }: { overview: OverviewData; chartMax: number }) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold text-white">Daily volume</h2>
      </div>
      <div className="flex h-64 items-end justify-between space-x-1 pt-4">
        {overview.chart.days.map((day, index) => (
          <div
            key={day}
            className="group group relative flex h-full flex-1 flex-col items-center justify-end"
          >
            <div className="absolute bottom-full z-10 mb-2 hidden w-32 flex-col rounded border border-white/10 bg-[#1A1B1E] p-2 text-xs shadow-xl group-hover:flex">
              <div className="flex justify-between">
                <span className="text-white/60">Sent</span>{' '}
                <span className="text-white">{overview.chart.sent[index]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-400/80">Delivered</span>{' '}
                <span className="text-green-400">{overview.chart.delivered[index]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-400/80">Bounced</span>{' '}
                <span className="text-red-400">{overview.chart.bounced[index]}</span>
              </div>
              <div className="mt-1 border-t border-white/10 pt-1 text-center text-[10px] text-white/40">
                {day}
              </div>
            </div>

            <div className="relative flex h-full w-full max-w-[40px] flex-col-reverse overflow-hidden rounded-t-sm bg-white/[0.02]">
              <div
                className="w-full bg-red-500/80 transition-all duration-300"
                style={{ height: `${(overview.chart.bounced[index] / chartMax) * 100}%` }}
              />
              <div
                className="w-full bg-green-500/60 transition-all duration-300"
                style={{ height: `${(overview.chart.delivered[index] / chartMax) * 100}%` }}
              />
              <div
                className="absolute right-0 bottom-0 left-0 w-full bg-blue-500/20 transition-all duration-300"
                style={{ height: `${(overview.chart.sent[index] / chartMax) * 100}%`, zIndex: 0 }}
              />
            </div>
            <span className="mt-2 hidden font-mono text-[10px] text-white/30 md:block">
              {day.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
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
          {
            label: 'Open rate',
            value: formatPercent(overview.metrics.open_rate),
            color: 'text-purple-400',
          },
          { label: 'Clicks', value: overview.metrics.clicks },
          { label: 'Unique clicks', value: overview.metrics.unique_clicks },
          {
            label: 'Click rate',
            value: formatPercent(overview.metrics.click_rate),
            color: 'text-purple-400',
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <span className="mb-2 block text-xs font-semibold tracking-wider text-white/40 uppercase">
              {stat.label}
            </span>
            <span className={`font-display text-xl font-medium ${stat.color || 'text-white'}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BounceBreakdownSection({ overview }: { overview: OverviewData }) {
  return (
    <section className="space-y-6">
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold text-white">Bounce breakdown</h2>
      </div>
      <div className="space-y-3">
        {overview.bounce_breakdown.map((row) => (
          <div key={row.bounce_type} className="group flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-white/60">{row.bounce_type}</span>
            <div className="mx-4 flex flex-1 items-center space-x-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-red-500/50"
                  style={{
                    width: `${overview.metrics.bounced ? (row.count / overview.metrics.bounced) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <span className="font-medium text-white">{row.count}</span>
          </div>
        ))}
        {overview.bounce_breakdown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
            <p className="text-sm text-white/40">No bounce events in this range.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const sourceId = useActiveSourceId();
  const { data: sources = [], isLoading: loadingSources } = useQuery(sourcesQueryOptions);

  const {
    data: overview,
    isLoading: loadingOverview,
    error: queryError,
  } = useQuery({
    ...overviewQueryOptions(sourceId),
    enabled: !!sourceId,
  });

  // Hook must be called unconditionally
  const chartMax = useMemo(() => {
    if (!overview) {
      return 0;
    }
    return Math.max(
      ...overview.chart.sent,
      ...overview.chart.delivered,
      ...overview.chart.bounced,
      1,
    );
  }, [overview]);

  // 1. Loading State
  if (loadingSources) {
    return <LoadingState />;
  }

  // 2. No Source Selected State
  if (!sourceId) {
    return <EmptySourceState sources={sources} />;
  }

  // 3. Active Dashboard State
  const error = queryError instanceof Error ? queryError.message : null;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col border-x border-white/10 bg-[#0B0C0E]">
      <DashboardHeader sourceId={sourceId} sources={sources} overview={overview} />

      <div className="flex-1 space-y-8 overflow-y-auto p-6">
        <SummarySection overview={overview} loadingOverview={loadingOverview} error={error} />

        {overview ? <DailyVolumeSection overview={overview} chartMax={chartMax} /> : null}

        {overview ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <EngagementSection overview={overview} />
            <BounceBreakdownSection overview={overview} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
