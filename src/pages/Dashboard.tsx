import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Activity, Plus, BarChart3, ArrowRight } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '../components/ui/chart';
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
  unique_opens: number[];
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

type FailureInsightItem = {
  label: string;
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
  failure_insights: {
    top_reasons: FailureInsightItem[];
    top_domains: FailureInsightItem[];
  };
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

function DashboardHeader({ sourceId, sources }: { sourceId: number; sources: SourceItem[] }) {
  const sourceName = sources.find((source) => source.id === sourceId)?.name ?? 'Selected project';

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
          {sourceName} Dashboard
        </h1>
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

function DailyVolumeSection({ overview }: { overview: OverviewData }) {
  const chartData = overview.chart.days.map((day, index) => ({
    day,
    sent: overview.chart.sent[index] ?? 0,
    delivered: overview.chart.delivered[index] ?? 0,
    bounced: overview.chart.bounced[index] ?? 0,
    bounce_rate:
      (overview.chart.sent[index] ?? 0) > 0
        ? Math.min(1, (overview.chart.bounced[index] ?? 0) / (overview.chart.sent[index] ?? 0))
        : 0,
    open_rate:
      (overview.chart.sent[index] ?? 0) > 0
        ? Math.min(1, (overview.chart.unique_opens[index] ?? 0) / (overview.chart.sent[index] ?? 0))
        : 0,
  }));

  const chartConfig = {
    sent: {
      label: 'Sent',
      color: '#60a5fa',
    },
    delivered: {
      label: 'Delivered',
      color: '#4ade80',
    },
    bounce_rate: {
      label: 'Bounce rate',
      color: '#f87171',
    },
    open_rate: {
      label: 'Open rate',
      color: '#c084fc',
    },
  } satisfies ChartConfig;

  const tooltipRows = [
    { key: 'sent', isRate: false },
    { key: 'delivered', isRate: false },
    { key: 'bounce_rate', isRate: true },
    { key: 'open_rate', isRate: true },
  ] as const;

  const renderTooltip = ({ active, label }: TooltipContentProps<number, string>) => {
    if (!active || label === undefined || label === null) {
      return null;
    }
    const labelText = typeof label === 'string' || typeof label === 'number' ? String(label) : '';
    if (!labelText) {
      return null;
    }
    const row = chartData.find((item) => item.day === labelText);
    if (!row) {
      return null;
    }

    return (
      <div className="border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs/relaxed shadow-xl">
        <div className="font-medium">{labelText}</div>
        <div className="grid gap-1.5">
          {tooltipRows.map(({ key, isRate }) => {
            const value = row[key];
            return (
              <div key={key} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ background: `var(--color-${key})` }}
              />
              <div className="flex flex-1 justify-between leading-none">
                <span className="text-muted-foreground">{chartConfig[key].label ?? key}</span>
                <span className="pl-4 font-mono">
                  {isRate ? `${(value * 100).toFixed(1)}%` : value}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold text-white">Daily delivery trend</h2>
      </div>
      <ChartContainer config={chartConfig} className="h-[260px] w-full">
        <LineChart data={chartData} accessibilityLayer margin={{ top: 8, right: 12, bottom: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => (typeof value === 'string' ? value.slice(5) : value)}
          />
          <YAxis yAxisId="count" tickLine={false} axisLine={false} tickMargin={8} width={36} />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[0, 1]}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <ChartTooltip content={renderTooltip} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="sent"
            stroke="var(--color-sent)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="bounce_rate"
            stroke="var(--color-bounce_rate)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="open_rate"
            stroke="var(--color-open_rate)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
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

function FailureInsightsList({ title, items }: { title: string; items: FailureInsightItem[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white/70">{title}</h3>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
            >
              <span className="text-white/80">{item.label}</span>
              <span className="font-mono text-xs text-white/60">{item.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-white/40">
          No data.
        </div>
      )}
    </div>
  );
}

function FailureInsightsSection({ overview }: { overview: OverviewData }) {
  const { top_reasons, top_domains } = overview.failure_insights;
  const isEmpty = top_reasons.length === 0 && top_domains.length === 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold text-white">Failure insights</h2>
        <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-sm text-white/40">
          {overview.range.from} → {overview.range.to}
        </span>
      </div>
      {isEmpty ? (
        <div className="pt-4 text-sm text-white/50">No bounce data in this range.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-2">
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
      <DashboardHeader sourceId={sourceId} sources={sources} />

      <div className="flex-1 space-y-8 overflow-y-auto p-6">
        <SummarySection overview={overview} loadingOverview={loadingOverview} error={error} />

        {overview ? <DailyVolumeSection overview={overview} /> : null}

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
