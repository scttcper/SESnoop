import type { EChartsOption, TooltipComponentFormatterCallbackParams } from 'echarts';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useId } from 'react';

import type { OverviewResponse } from '../lib/queries';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const series = [
  { label: 'Sent', color: '#7da8fa', key: 'sent' },
  { label: 'Delivered', color: '#5cc9ae', key: 'delivered' },
  { label: 'Bounced', color: '#e68b99', key: 'bounced' },
] as const;

const shortDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const fullDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeZone: 'UTC',
});
const compactNumber = new Intl.NumberFormat(undefined, { notation: 'compact' });
const utcDate = (day: string) => new Date(`${day}T00:00:00Z`);
const ROUNDED_BAR_CAP: [number, number, number, number] = [3, 3, 0, 0];

export default function DailyVolumeSection({ chart }: { chart: OverviewResponse['chart'] }) {
  const headingId = useId();
  const chartData = chart.days.map((day, index) => ({
    day,
    sent: chart.sent[index] ?? 0,
    delivered: chart.delivered[index] ?? 0,
    bounced: chart.bounced[index] ?? 0,
  }));
  const totals = series.map((item) => ({
    ...item,
    total: chartData.reduce((sum, day) => sum + day[item.key], 0),
  }));
  const hasActivity = totals.some((item) => item.total > 0);
  const firstDay = chartData.at(0)?.day;
  const lastDay = chartData.at(-1)?.day;
  const summary = [
    firstDay && lastDay
      ? `Daily email volume from ${fullDate.format(utcDate(firstDay))} to ${fullDate.format(utcDate(lastDay))}, UTC.`
      : 'Daily email volume.',
    totals.map((item) => `${item.total.toLocaleString()} ${item.label.toLowerCase()}`).join(', '),
  ].join(' ');

  const chartOption = {
    backgroundColor: 'transparent',
    animation: false,
    textStyle: { fontFamily: 'Inter Variable, Inter, sans-serif' },
    grid: { top: 16, right: 4, bottom: 6, left: 0, containLabel: true },
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
        const rows = Array.isArray(params) ? params : [params];
        const day = chartData[rows[0]?.dataIndex ?? -1];
        if (!day) {
          return '';
        }
        return [
          `${fullDate.format(utcDate(day.day))} · UTC`,
          ...series.map(
            (item) =>
              `<span style="color:${item.color}">●</span> ${item.label}: ${day[item.key].toLocaleString()}`,
          ),
        ].join('<br />');
      },
    },
    xAxis: {
      type: 'category',
      data: chartData.map((item) => item.day),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#87929e',
        fontSize: 11,
        interval: Math.max(0, Math.ceil(chartData.length / 6) - 1),
        hideOverlap: true,
        margin: 12,
        formatter: (day: string) => shortDate.format(utcDate(day)),
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      splitNumber: 3,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#87929e',
        fontSize: 11,
        margin: 12,
        formatter: (value: number) => compactNumber.format(value),
      },
      splitLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.055)', type: 'dashed' },
      },
    },
    series: [
      {
        name: 'Sent',
        type: 'line',
        z: 3,
        lineStyle: { width: 2, color: series[0].color },
        itemStyle: { color: series[0].color },
        showSymbol: chartData.length === 1,
        symbol: 'circle',
        symbolSize: 6,
        smooth: false,
        data: chartData.map((item) => item.sent),
      },
      {
        name: 'Delivered',
        type: 'bar',
        stack: 'delivery-events',
        barMaxWidth: 16,
        itemStyle: { color: 'rgba(92, 201, 174, 0.7)' },
        data: chartData.map((item) => ({
          value: item.delivered,
          itemStyle: { borderRadius: item.bounced > 0 ? 0 : ROUNDED_BAR_CAP },
        })),
      },
      {
        name: 'Bounced',
        type: 'bar',
        stack: 'delivery-events',
        barMaxWidth: 16,
        itemStyle: { color: series[2].color, borderRadius: ROUNDED_BAR_CAP },
        data: chartData.map((item) => item.bounced),
      },
    ],
  } satisfies EChartsOption;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <h2 id={headingId} className="text-sm font-semibold text-white/90">
            Email volume
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-white/55">
          {series.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={item.key === 'sent' ? 'h-0.5 w-3 rounded-full' : 'size-2 rounded-sm'}
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      {hasActivity ? (
        <div role="img" aria-label={summary} className="mt-5 h-[224px] sm:h-[248px]">
          <div aria-hidden="true" className="h-full">
            <ReactEChartsCore
              echarts={echarts}
              option={chartOption}
              notMerge
              lazyUpdate
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-5 flex h-[224px] items-center justify-center text-center sm:h-[248px]">
          <p className="max-w-64 text-sm text-white/40">
            No sends or delivery events in this period.
          </p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-white/35">Event counts · Dates in UTC</p>
    </section>
  );
}
