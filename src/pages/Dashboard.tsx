import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Info,
  Mail,
  Plus,
  RefreshCw,
  Tag,
} from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';

import { formatDay, startOfDayUtc, type EventType } from '../../shared/event-filters';
import {
  controlClassName as toolbarControlClass,
  focusClassName as focusClass,
  panelClassName as panelClass,
  secondaryControlClassName as toolbarSecondaryClass,
  PageLayout,
} from '../components/layout/PageLayout';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import {
  overviewQueryOptions,
  sourcesQueryOptions,
  type OverviewResponse,
  type Source,
} from '../lib/queries';
import { useActiveSourceId } from '../lib/use-active-source';
import { cn, COLOR_STYLES } from '../lib/utils';

const DailyVolumeSection = lazy(() => import('./DailyVolumeSection'));
const RecipientReachSection = lazy(() => import('./RecipientReachSection'));

const integer = (value: number) => value.toLocaleString();
const percent = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
const categoryLabel = (value: string | null) => {
  if (value === null) {
    return 'Uncategorized';
  }
  const label = value.replaceAll(/[_-]+/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const categoryColors = [
  'bg-blue-400',
  'bg-violet-400',
  'bg-teal-400',
  'bg-amber-400',
  'bg-rose-400',
];

type EventsLinkProps = {
  sourceId: number;
  range: OverviewResponse['range'];
  eventTypes?: EventType[];
  tags?: string[];
  label?: string;
  children: ReactNode;
  className?: string;
};

function EventsLink({
  sourceId,
  range,
  eventTypes,
  tags = [],
  label,
  children,
  className,
}: EventsLinkProps) {
  return (
    <Link
      to="/s/$sourceId/events"
      params={{ sourceId: String(sourceId) }}
      search={{
        search: '',
        event_types: eventTypes,
        bounce_types: [],
        tags,
        date_range: 'custom',
        from: range.from,
        to: range.to,
        page: 1,
      }}
      className={cn(focusClass, className)}
      aria-label={label}
    >
      {children}
    </Link>
  );
}

function MetricHelp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`About ${label.toLowerCase()}`}
        className={cn('rounded text-white/30 hover:text-white/70', focusClass)}
      >
        <Info className="size-3.5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

function LoadingState() {
  return (
    <div role="status" className="space-y-6 py-2">
      <span className="sr-only">Loading email overview</span>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-xl bg-white/5 motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-white/5 motion-reduce:animate-none" />
    </div>
  );
}

function EmptySourceState({ sources }: { sources: Source[] }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <div className="mb-8 flex size-12 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 text-blue-300">
        <Mail className="size-6" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-white">Select a source</h1>
      <p className="mt-3 text-sm leading-6 text-white/50">
        {sources.length > 0
          ? 'View delivery and engagement metrics for a source.'
          : 'Connect an Amazon SES source to collect email events.'}
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {sources.map((source) => (
          <Link
            key={source.id}
            to="/s/$sourceId/dashboard"
            params={{ sourceId: String(source.id) }}
            search={{ period: '30' }}
            className={cn(
              panelClass,
              focusClass,
              'group flex items-center gap-3 p-5 transition-colors hover:bg-white/5',
            )}
          >
            <span className={cn('size-2.5 shrink-0 rounded-full', COLOR_STYLES[source.color])} />
            <span className="min-w-0 flex-1 truncate font-medium text-white/85">{source.name}</span>
            <ArrowRight
              className="size-4 text-white/30 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        ))}
        <Link
          to="/sources"
          className={cn(
            focusClass,
            'flex items-center gap-3 rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white',
          )}
        >
          <Plus className="size-4" aria-hidden="true" /> Connect a source
        </Link>
      </div>
    </div>
  );
}

function SummarySection({ overview, sourceId }: { overview: OverviewResponse; sourceId: number }) {
  const { metrics, range } = overview;
  const metricsToShow = [
    {
      label: 'Emails sent',
      value: integer(metrics.sent),
      detail: `${integer(metrics.sent_today)} sent today · UTC`,
      eventTypes: ['Send'] as EventType[],
      icon: ArrowUpRight,
      color: 'text-blue-300',
      help: 'Send events in this period, counted per recipient. Today is the current UTC calendar day.',
    },
    {
      label: 'Delivered',
      value: integer(metrics.delivered),
      detail: 'Accepted by the receiving server',
      eventTypes: ['Delivery'] as EventType[],
      icon: Check,
      color: 'text-teal-300',
      help: 'Delivery events received in this period. A delivery means the recipient’s mail server accepted the email.',
    },
    {
      label: 'Open rate',
      value: metrics.delivered ? percent(metrics.open_rate) : '—',
      detail: `${integer(metrics.opened_deliveries)} deliveries opened`,
      eventTypes: undefined,
      icon: Mail,
      color: 'text-white/90',
      help: 'Share of deliveries from this period with at least one tracked open, including opens recorded later. Automated opens can affect this rate.',
    },
    {
      label: 'Click rate',
      value: metrics.delivered ? percent(metrics.click_rate) : '—',
      detail: `${integer(metrics.clicked_deliveries)} deliveries clicked`,
      eventTypes: undefined,
      icon: ArrowDownRight,
      color: 'text-white/90',
      help: 'Share of deliveries from this period with at least one tracked link click, including clicks recorded later.',
    },
  ];

  return (
    <section
      aria-label="Email metrics"
      className={cn(panelClass, 'grid grid-cols-2 divide-white/[0.08] lg:grid-cols-4')}
    >
      {metricsToShow.map((metric, index) => (
        <div
          key={metric.label}
          className={cn(
            'min-w-0 p-4 sm:p-5',
            index % 2 === 1 && 'border-l',
            index > 1 && 'border-t lg:border-t-0',
            index === 2 && 'lg:border-l',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-white/55 sm:text-sm">
              {metric.label}
              <MetricHelp label={metric.label}>{metric.help}</MetricHelp>
            </div>
            <metric.icon
              className={cn('hidden size-4 sm:block', metric.color, 'opacity-60')}
              aria-hidden="true"
            />
          </div>
          {metric.eventTypes ? (
            <EventsLink
              sourceId={sourceId}
              range={range}
              eventTypes={metric.eventTypes}
              label={`${metric.label}: ${metric.value}. Explore events in this period.`}
              className={cn(
                'mt-4 inline-block text-3xl font-medium tracking-tight tabular-nums transition-opacity hover:opacity-70 sm:text-4xl',
                metric.color,
              )}
            >
              {metric.value}
            </EventsLink>
          ) : (
            <span
              className={cn(
                'mt-4 inline-block text-3xl font-medium tracking-tight tabular-nums sm:text-4xl',
                metric.color,
              )}
            >
              {metric.value}
            </span>
          )}
          <p className="mt-2 text-xs leading-5 text-white/40">{metric.detail}</p>
        </div>
      ))}
    </section>
  );
}

function DeliveryHealth({ overview, sourceId }: { overview: OverviewResponse; sourceId: number }) {
  const { metrics, range } = overview;
  return (
    <section className={cn(panelClass, 'flex flex-col p-5')}>
      <h2 className="text-sm font-semibold text-white/90">Delivery health</h2>
      <div className="my-5 space-y-5">
        {[
          {
            label: 'Bounce rate',
            value: metrics.sent ? percent(metrics.bounce_rate) : '—',
            count: metrics.bounced,
            type: 'Bounce' as const,
            noun: 'bounce',
            help: 'Share of sends from this period that bounced, including bounce events recorded later. The event count below uses the selected date range.',
          },
          {
            label: 'Complaint rate',
            value: metrics.sent ? percent(metrics.complaint_rate) : '—',
            count: metrics.complaints,
            type: 'Complaint' as const,
            noun: 'complaint',
            help: 'Share of sends from this period that received a spam complaint, including complaints recorded later. The event count below uses the selected date range.',
          },
        ].map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-white/60">
                {item.label}
                <MetricHelp label={item.label}>{item.help}</MetricHelp>
              </span>
              <span
                className={cn(
                  'text-xl font-medium tabular-nums',
                  item.count ? 'text-rose-300' : 'text-white/85',
                )}
              >
                {item.value}
              </span>
            </div>
            <EventsLink
              sourceId={sourceId}
              range={range}
              eventTypes={[item.type]}
              className="mt-1 flex w-fit items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/80"
            >
              {integer(item.count)} {item.noun}
              {item.count === 1 ? '' : 's'} in this period{' '}
              <ChevronRight className="size-3" aria-hidden="true" />
            </EventsLink>
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-white/[0.08] pt-4 text-xs text-white/45">
        <p className="mb-2 font-medium text-white/60">Bounce types</p>
        {overview.bounce_breakdown.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {overview.bounce_breakdown.map((row) => (
              <span key={row.bounce_type} className="rounded-md bg-white/5 px-2 py-1">
                {row.bounce_type}{' '}
                <span className="ml-1 text-white/75 tabular-nums">{integer(row.count)}</span>
              </span>
            ))}
          </div>
        ) : (
          <p>No bounces recorded in this period.</p>
        )}
      </div>
    </section>
  );
}

function CategorySection({ overview, sourceId }: { overview: OverviewResponse; sourceId: number }) {
  const categories = overview.category_breakdown;
  const maxSent = Math.max(1, ...categories.map((row) => row.sent));
  return (
    <section className={cn(panelClass, 'overflow-hidden')}>
      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-white/90">Email categories</h2>
        </div>
        <Tag className="mt-0.5 size-4 shrink-0 text-white/30" aria-hidden="true" />
      </div>
      {categories.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Email activity grouped by category tag in the selected period
              </caption>
              <thead className="border-y border-white/[0.06] bg-white/[0.015] text-white/40">
                <tr>
                  <th scope="col" className="py-3 pr-3 pl-5 font-medium">
                    Category
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    Sent
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    Delivered
                  </th>
                  <th scope="col" className="py-3 pr-5 pl-3 text-right font-medium sm:pr-3">
                    Bounced
                  </th>
                  <th
                    scope="col"
                    className="hidden py-3 pr-5 pl-3 text-right font-medium sm:table-cell"
                  >
                    Recipients
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {categories.map((row, index) => {
                  const label = categoryLabel(row.category);
                  const content = (
                    <>
                      <span className="flex items-center gap-2">
                        <span className="truncate" title={row.category ?? undefined}>
                          {label}
                        </span>
                        {row.category !== null && (
                          <ArrowUpRight
                            className="size-3 shrink-0 text-white/25 group-hover:text-blue-300"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="mt-2 block h-1 w-full max-w-36 rounded-full bg-white/5">
                        <span
                          className={cn(
                            'block h-1 rounded-full',
                            row.category === null
                              ? 'bg-white/25'
                              : categoryColors[index % categoryColors.length],
                          )}
                          style={{ width: `${(row.sent / maxSent) * 100}%` }}
                        />
                      </span>
                    </>
                  );
                  return (
                    <tr
                      key={row.category === null ? 'uncategorized' : `category:${row.category}`}
                      className="group transition-colors hover:bg-white/[0.025]"
                    >
                      <th scope="row" className="max-w-44 py-4 pr-3 pl-5 font-medium text-white/75">
                        {row.category !== null ? (
                          <EventsLink
                            sourceId={sourceId}
                            range={overview.range}
                            tags={[`category:${row.category}`]}
                            className="block hover:text-blue-200"
                          >
                            {content}
                          </EventsLink>
                        ) : (
                          content
                        )}
                      </th>
                      <td className="px-3 py-4 text-right text-white/80 tabular-nums">
                        {integer(row.sent)}
                      </td>
                      <td className="px-3 py-4 text-right text-white/60 tabular-nums">
                        {integer(row.delivered)}
                      </td>
                      <td
                        className={cn(
                          'py-4 pr-5 pl-3 text-right tabular-nums sm:pr-3',
                          row.bounced ? 'text-rose-300' : 'text-white/30',
                        )}
                      >
                        {integer(row.bounced)}
                      </td>
                      <td className="hidden py-4 pr-5 pl-3 text-right text-white/60 tabular-nums sm:table-cell">
                        {integer(row.recipients)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/[0.06] px-5 py-3 text-[11px] leading-5 text-white/35">
            Grouped by the category tag. Emails with multiple categories appear in each.
          </p>
        </>
      ) : (
        <p className="px-5 pt-3 pb-8 text-sm text-white/45">
          No category activity in this period. Try a wider date range.
        </p>
      )}
    </section>
  );
}

function BounceInsights({ overview, sourceId }: { overview: OverviewResponse; sourceId: number }) {
  const { top_reasons, top_domains } = overview.failure_insights;
  if (top_reasons.length === 0 && top_domains.length === 0) {
    return null;
  }
  return (
    <section className={cn(panelClass, 'p-5')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white/90">Bounce details</h2>
        <EventsLink
          sourceId={sourceId}
          range={overview.range}
          eventTypes={['Bounce']}
          className="flex items-center gap-1 text-xs text-white/50 hover:text-white"
        >
          View bounces <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </EventsLink>
      </div>
      <div className="mt-5 grid gap-6 sm:grid-cols-2 sm:gap-10">
        {[
          { title: 'Reasons', rows: top_reasons },
          { title: 'Recipient domains', rows: top_domains },
        ].map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-xs text-white/40">{group.title}</h3>
            <div className="divide-y divide-white/[0.06]">
              {group.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <span className="truncate text-white/70" title={row.label}>
                    {row.label}
                  </span>
                  <span className="shrink-0 text-xs text-white/65 tabular-nums">
                    {integer(row.count)}
                    <span className="ml-3 inline-block w-11 text-right text-white/35">
                      {percent(row.percentage)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const sourceId = useActiveSourceId();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const period = search.period ?? '30';
  const today = startOfDayUtc(new Date());
  const range = {
    from: formatDay(new Date(today.getTime() - (Number(period) - 1) * 86_400_000)),
    to: formatDay(today),
  };
  const {
    data: sources = [],
    isLoading: loadingSources,
    error: sourcesError,
    refetch: refetchSources,
  } = useQuery(sourcesQueryOptions);
  const {
    data: overview,
    error,
    isPending,
    isFetching,
    refetch,
  } = useQuery(overviewQueryOptions(sourceId, range));

  if (!loadingSources && !sourcesError && !sourceId) {
    return <EmptySourceState sources={sources} />;
  }

  return (
    <PageLayout>
      <header className="mb-7 flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Overview</h1>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <Select
            value={period}
            onValueChange={(value) => {
              if (value && sourceId) {
                void navigate({
                  to: '/s/$sourceId/dashboard',
                  params: { sourceId: String(sourceId) },
                  search: { period: value as '7' | '30' | '90' },
                });
              }
            }}
          >
            <SelectTrigger
              aria-label="Date range"
              className={cn(toolbarControlClass, toolbarSecondaryClass)}
            >
              <CalendarDays className="text-white/50" aria-hidden="true" />
              <span>Last {period} days</span>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            aria-label="Refresh overview"
            disabled={isFetching || loadingSources}
            onClick={() => {
              void refetchSources();
              void refetch();
            }}
            className={cn(toolbarControlClass, toolbarSecondaryClass, 'w-9 px-0')}
          >
            <RefreshCw
              className={cn('size-3.5', isFetching && 'animate-spin motion-reduce:animate-none')}
              aria-hidden="true"
            />
          </button>
          {sourceId ? (
            <EventsLink
              sourceId={sourceId}
              range={range}
              className={cn(
                toolbarControlClass,
                'border-blue-400/20 bg-blue-400/10 text-blue-200 hover:bg-blue-400/20',
              )}
            >
              Explore events <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </EventsLink>
          ) : null}
        </div>
      </header>

      {sourcesError || error ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300"
        >
          {sourcesError?.message ?? error?.message}.{' '}
          <button
            type="button"
            onClick={() => {
              void refetchSources();
              void refetch();
            }}
            className={cn(focusClass, 'underline underline-offset-4')}
          >
            Try again
          </button>
        </div>
      ) : null}

      {loadingSources || (isPending && sourceId) ? <LoadingState /> : null}

      {overview && sourceId ? (
        <div className="space-y-5" aria-busy={isFetching}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/35">
            <span>
              {dateLabel(overview.range.from)} – {dateLabel(overview.range.to)},{' '}
              {overview.range.to.slice(0, 4)} <span className="ml-1 text-white/25">UTC</span>
            </span>
            {overview.activity.last_event_at !== null ? (
              <span>
                Last event{' '}
                <time
                  dateTime={new Date(overview.activity.last_event_at).toISOString()}
                  className="text-white/50"
                >
                  {new Intl.DateTimeFormat(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  }).format(overview.activity.last_event_at)}
                </time>
              </span>
            ) : null}
          </div>
          <SummarySection overview={overview} sourceId={sourceId} />
          {!overview.activity.last_event_at ? (
            <div
              className={cn(panelClass, 'flex flex-wrap items-center justify-between gap-4 p-5')}
            >
              <div>
                <h2 className="text-sm font-medium text-white/80">No events yet</h2>
                <p className="mt-1 text-xs text-white/45">
                  Configure Amazon SES event forwarding for this source.
                </p>
              </div>
              <Link
                to="/s/$sourceId/setup"
                params={{ sourceId: String(sourceId) }}
                className={cn(focusClass, 'flex items-center gap-2 text-sm text-blue-300')}
              >
                View setup <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          ) : null}
          <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
            <div className={cn(panelClass, 'p-5')}>
              <Suspense
                fallback={
                  <div
                    role="status"
                    className="flex h-80 items-center justify-center text-sm text-white/40"
                  >
                    Loading email volume…
                  </div>
                }
              >
                <DailyVolumeSection chart={overview.chart} />
              </Suspense>
            </div>
            <DeliveryHealth overview={overview} sourceId={sourceId} />
            <CategorySection overview={overview} sourceId={sourceId} />
            <div className={cn(panelClass, 'p-5')}>
              <Suspense
                fallback={
                  <div
                    role="status"
                    className="flex h-64 items-center justify-center text-sm text-white/40"
                  >
                    Loading audience…
                  </div>
                }
              >
                <RecipientReachSection
                  chart={overview.chart}
                  uniqueRecipients={overview.metrics.unique_emails}
                />
              </Suspense>
            </div>
          </div>
          <BounceInsights overview={overview} sourceId={sourceId} />
          <p className="px-1 pb-2 text-[11px] leading-5 text-white/30">
            Counts reflect recipient events in this period. Open and click rates include later
            activity on these deliveries.
          </p>
        </div>
      ) : null}
    </PageLayout>
  );
}
