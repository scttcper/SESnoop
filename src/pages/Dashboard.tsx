import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus, BarChart3, ArrowRight } from 'lucide-react';

import { overviewQueryOptions, sourcesQueryOptions } from '../lib/queries';
import { useActiveSourceId } from '../lib/use-active-source';
import { cn, COLOR_STYLES } from '../lib/utils';

const DailyVolumeSection = lazy(() => import('./DailyVolumeSection'));

const format = {
  integer: (value: number) => value.toLocaleString(),
  percent: (value: number) => `${(value * 100).toFixed(1)}%`,
  dateTime: (value: number | null) =>
    value
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value))
      : 'No events yet',
};

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
  unique_opens: number[];
};

type OverviewMetrics = {
  sent: number;
  delivered: number;
  bounced: number;
  complaints: number;
  sent_today: number;
  bounce_rate: number;
  complaint_rate: number;
  opens: number;
  unique_emails: number;
  unique_opens: number;
  open_rate: number;
  unique_clicks: number;
  click_rate: number;
};

type OverviewActivity = {
  last_event_at: number | null;
};

type BounceBreakdownRow = {
  bounce_type: string;
  count: number;
};

type FailureInsightItem = {
  label: string;
  count: number;
  percentage: number;
};

type OverviewData = {
  range: {
    from: string;
    to: string;
  };
  metrics: OverviewMetrics;
  activity: OverviewActivity;
  event_mix: Record<string, number>;
  chart: OverviewChart;
  bounce_breakdown: BounceBreakdownRow[];
  failure_insights: {
    top_reasons: FailureInsightItem[];
    top_domains: FailureInsightItem[];
  };
};

type QueryError = string | null;

function LoadingState() {
  return <div className="p-8 text-white/50">Loading...</div>;
}

function DailyVolumeLoadingState() {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold text-white">Daily delivery trend</h2>
      </div>
      <div className="flex h-[260px] w-full items-center justify-center text-sm text-white/40">
        Loading chart...
      </div>
    </section>
  );
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
  loadingOverview,
  overview,
}: {
  sourceId: number;
  sources: SourceItem[];
  loadingOverview: boolean;
  overview: OverviewData | undefined;
}) {
  const sourceName = sources.find((source) => source.id === sourceId)?.name ?? 'Selected project';

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex flex-wrap items-center gap-1 space-x-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
          {sourceName} Dashboard
        </h1>
      </div>
      <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-sm text-white/40">
        {loadingOverview
          ? 'Loading…'
          : overview
            ? `${overview.range.from} → ${overview.range.to}`
            : '—'}
      </span>
    </header>
  );
}

function SummarySection({
  overview,
  error,
}: {
  overview: OverviewData | undefined;
  loadingOverview: boolean;
  error: QueryError;
}) {
  return (
    <section className="space-y-6">
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
              value: format.percent(overview.metrics.bounce_rate),
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

function ActivitySection({ overview }: { overview: OverviewData }) {
  const eventMix = [
    { label: 'Send', value: overview.event_mix.Send ?? 0 },
    { label: 'Delivery', value: overview.event_mix.Delivery ?? 0 },
    { label: 'Bounce', value: overview.event_mix.Bounce ?? 0 },
    { label: 'Complaint', value: overview.event_mix.Complaint ?? 0 },
    { label: 'Open', value: overview.event_mix.Open ?? 0 },
    { label: 'Click', value: overview.event_mix.Click ?? 0 },
  ];

  return (
    <section className="grid gap-4 border-y border-white/10 py-4 lg:grid-cols-2 lg:items-start">
      <div>
        <div className="mb-2 text-xs font-semibold tracking-wider text-white/40 uppercase">
          Latest
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          <span className="inline-flex items-baseline gap-1.5 text-sm whitespace-nowrap text-white/45">
            Last event
            <span className="font-mono text-xs text-white/70">
              {format.dateTime(overview.activity.last_event_at)}
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1.5 text-sm whitespace-nowrap text-white/45">
            Bounce rate
            <span className="font-mono text-xs text-white/70">
              {format.percent(overview.metrics.bounce_rate)}
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1.5 text-sm whitespace-nowrap text-white/45">
            Complaints
            <span
              className={`font-mono text-xs ${
                overview.metrics.complaints > 0 ? 'text-red-300' : 'text-white/70'
              }`}
            >
              {format.integer(overview.metrics.complaints)}
            </span>
          </span>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold tracking-wider text-white/40 uppercase">
          Events
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          {eventMix.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-baseline gap-1.5 text-sm whitespace-nowrap"
            >
              <span className="text-white/45">{item.label}</span>
              <span className="font-mono text-xs text-white/70">{format.integer(item.value)}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function EngagementSection({ overview }: { overview: OverviewData }) {
  const rateMetrics = [
    {
      label: 'Open rate',
      value: overview.metrics.open_rate,
      detail: `${format.integer(overview.metrics.unique_opens)} unique opens`,
      color: 'text-blue-300',
      accent: 'bg-blue-400',
      track: 'bg-blue-400/10',
    },
    {
      label: 'Click rate',
      value: overview.metrics.click_rate,
      detail: `${format.integer(overview.metrics.unique_clicks)} unique clicks`,
      color: 'text-emerald-300',
      accent: 'bg-emerald-400',
      track: 'bg-emerald-400/10',
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold text-white">Engagement</h2>
        <span className="shrink-0 rounded bg-white/5 px-2 py-0.5 font-mono text-sm whitespace-nowrap text-white/45">
          {format.integer(overview.metrics.unique_emails)} recipients
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {rateMetrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <span className="block text-sm font-medium text-white/70">{metric.label}</span>
                <span className="mt-1 block truncate text-sm leading-snug whitespace-nowrap text-white/45">
                  {metric.detail}
                </span>
              </div>
              <span
                className={`font-display shrink-0 text-right text-3xl leading-none font-medium ${metric.color}`}
              >
                {format.percent(metric.value)}
              </span>
            </div>
            <div className={`h-2 overflow-hidden rounded-full ${metric.track}`}>
              <div
                className={`h-full rounded-full ${metric.accent}`}
                style={{ width: `${Math.min(100, Math.max(0, metric.value * 100))}%` }}
              />
            </div>
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

function FailureInsightsList({ title, items }: { title: string; items: FailureInsightItem[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
        <h3 className="text-sm font-semibold text-white/75">{title}</h3>
        <span className="font-mono text-xs text-white/35">Count</span>
      </div>
      {items.length > 0 ? (
        <div className="divide-y divide-white/10">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span className="min-w-0 truncate text-white/75">{item.label}</span>
              <span className="shrink-0 font-mono text-xs text-white/55">
                {item.count} · {format.percent(item.percentage)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-2 text-sm text-white/40">No data.</div>
      )}
    </div>
  );
}

function FailureInsightsSection({ overview }: { overview: OverviewData }) {
  const { top_reasons, top_domains } = overview.failure_insights;
  const isEmpty = top_reasons.length === 0 && top_domains.length === 0;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold text-white">Failure insights</h2>
        <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-sm text-white/40">
          {overview.range.from} → {overview.range.to}
        </span>
      </div>
      {isEmpty ? (
        <div className="text-sm text-white/50">No bounce data in this range.</div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <FailureInsightsList title="Top bounce reasons" items={top_reasons} />
          <FailureInsightsList title="Top failing domains" items={top_domains} />
        </div>
      )}
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
      <DashboardHeader
        sourceId={sourceId}
        sources={sources}
        loadingOverview={loadingOverview}
        overview={overview}
      />

      <div className="flex-1 space-y-8 overflow-y-auto p-6">
        <SummarySection overview={overview} loadingOverview={loadingOverview} error={error} />

        {overview ? (
          <Suspense fallback={<DailyVolumeLoadingState />}>
            <DailyVolumeSection chart={overview.chart} />
          </Suspense>
        ) : null}

        {overview ? <ActivitySection overview={overview} /> : null}

        {overview ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <EngagementSection overview={overview} />
            <BounceBreakdownSection overview={overview} />
          </div>
        ) : null}

        {overview ? <FailureInsightsSection overview={overview} /> : null}
      </div>
    </div>
  );
}
