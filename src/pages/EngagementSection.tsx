import type { EChartsOption, TooltipComponentFormatterCallbackParams } from 'echarts';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useId, useState } from 'react';

import { formatDay, startOfDayUtc } from '../../shared/event-filters';
import type { OverviewResponse } from '../lib/queries';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const series = [
  { label: 'Open rate', color: '#5cc9ae', key: 'open_rate' },
  { label: 'Click rate', color: '#7da8fa', key: 'click_rate' },
] as const;

// Opens and clicks keep arriving after delivery, so the newest cohorts read low.
const PROVISIONAL_DAYS = 2;

const shortDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const fullDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeZone: 'UTC',
});
const percent = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 1,
});
const utcDate = (day: string) => new Date(`${day}T00:00:00Z`);

export default function EngagementSection({
  chart,
  uniqueRecipients,
}: {
  chart: OverviewResponse['chart'];
  uniqueRecipients: number;
}) {
  const headingId = useId();
  const [firstProvisionalDay] = useState(() =>
    formatDay(new Date(startOfDayUtc(new Date()).getTime() - (PROVISIONAL_DAYS - 1) * 86_400_000)),
  );
  const chartData = chart.days.map((day, index) => ({
    day,
    deliveries: chart.cohort_deliveries[index] ?? 0,
    opened: chart.opened_deliveries[index] ?? 0,
    clicked: chart.clicked_deliveries[index] ?? 0,
    open_rate: chart.open_rate[index] ?? null,
    click_rate: chart.click_rate[index] ?? null,
    provisional: day >= firstProvisionalDay,
  }));
  const hasDeliveries = chartData.some((item) => item.deliveries > 0);
  // Settled and provisional segments share the boundary point so the line stays continuous.
  const boundary = chartData.findIndex((item) => item.provisional);
  const segment = (key: (typeof series)[number]['key'], provisional: boolean) =>
    chartData.map((item, index) => {
      if (boundary === -1) {
        return provisional ? null : item[key];
      }
      const inSegment = provisional ? index >= boundary - 1 : index < boundary;
      return inSegment ? item[key] : null;
    });

  const chartOption = {
    backgroundColor: 'transparent',
    animation: false,
    textStyle: { fontFamily: 'Inter Variable, Inter, sans-serif' },
    grid: { top: 8, right: 4, bottom: 6, left: 0, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: '#14191f',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: {
        color: '#e2e8f0',
        fontSize: 12,
        lineHeight: 22,
        fontFamily: 'Inter Variable, Inter, sans-serif',
      },
      axisPointer: {
        type: 'line',
        lineStyle: { color: 'rgba(255, 255, 255, 0.18)' },
      },
      formatter: (params: TooltipComponentFormatterCallbackParams) => {
        const point = Array.isArray(params) ? params[0] : params;
        const row = point ? chartData[point.dataIndex] : undefined;
        if (!row) {
          return '';
        }
        const lines = [`${fullDate.format(utcDate(row.day))} · UTC`];
        if (!row.deliveries) {
          lines.push('<span style="opacity:0.6">No deliveries</span>');
          return lines.join('<br />');
        }
        lines.push(
          `<span style="color:${series[0].color}">●</span> Opened: ${percent.format(row.open_rate ?? 0)} · ${row.opened.toLocaleString()} of ${row.deliveries.toLocaleString()}`,
          `<span style="color:${series[1].color}">●</span> Clicked: ${percent.format(row.click_rate ?? 0)} · ${row.clicked.toLocaleString()} of ${row.deliveries.toLocaleString()}`,
        );
        if (row.provisional) {
          lines.push('<span style="opacity:0.6">Still collecting opens and clicks</span>');
        }
        return lines.join('<br />');
      },
    },
    xAxis: {
      type: 'category',
      data: chart.days,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#87929e',
        fontSize: 11,
        interval: Math.max(0, Math.ceil(chart.days.length / 4) - 1),
        hideOverlap: true,
        margin: 12,
        formatter: (day: string) => shortDate.format(utcDate(day)),
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      interval: 0.5,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#87929e',
        fontSize: 11,
        margin: 8,
        formatter: (value: number) => percent.format(value),
      },
      splitLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.055)', type: 'dashed' },
      },
    },
    series: series.flatMap((item) =>
      [false, true].map((provisional) => ({
        name: item.label,
        type: 'line' as const,
        connectNulls: false,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 5,
        smooth: false,
        lineStyle: {
          width: 2,
          color: item.color,
          type: provisional ? ('dashed' as const) : ('solid' as const),
          opacity: provisional ? 0.6 : 1,
        },
        itemStyle: { color: item.color },
        data: segment(item.key, provisional),
      })),
    ),
  } satisfies EChartsOption;

  return (
    <section aria-labelledby={headingId} className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-sm font-semibold text-white/90">
          Engagement
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-white/55">
          {series.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-white/40">
        <span className="text-white/75 tabular-nums">{uniqueRecipients.toLocaleString()}</span>{' '}
        unique recipients in this period
      </p>
      <figure className="mt-4 flex flex-1 flex-col">
        {hasDeliveries ? (
          <div aria-hidden="true" className="min-h-[160px] flex-1">
            <ReactEChartsCore
              echarts={echarts}
              option={chartOption}
              notMerge
              lazyUpdate
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        ) : (
          <div className="flex min-h-[160px] flex-1 items-center justify-center text-center">
            <p className="max-w-56 text-sm text-white/40">No deliveries in this period.</p>
          </div>
        )}
        <figcaption className="mt-3 text-[11px] leading-4 text-white/35">
          By delivery day · UTC · Dashed days are still collecting activity
        </figcaption>
        <div className="sr-only">
          <table>
            <caption>Daily open and click rate by delivery day, UTC</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Deliveries</th>
                <th scope="col">Open rate</th>
                <th scope="col">Click rate</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr key={row.day}>
                  <th scope="row">{fullDate.format(utcDate(row.day))}</th>
                  <td>{row.deliveries.toLocaleString()}</td>
                  <td>{row.open_rate === null ? '—' : percent.format(row.open_rate)}</td>
                  <td>{row.click_rate === null ? '—' : percent.format(row.click_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    </section>
  );
}
