import type { EChartsOption, TooltipComponentFormatterCallbackParams } from 'echarts';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import type { OverviewResponse } from '../lib/queries';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const shortDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const fullDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export default function RecipientReachSection({
  chart,
  uniqueRecipients,
}: {
  chart: OverviewResponse['chart'];
  uniqueRecipients: number;
}) {
  const chartData = chart.days.map((day, index) => ({
    day,
    recipients: chart.unique_recipients[index] ?? 0,
  }));
  const chartOption = {
    backgroundColor: 'transparent',
    animation: false,
    textStyle: { fontFamily: 'Inter Variable, Inter, sans-serif' },
    grid: { top: 8, right: 8, bottom: 24, left: 8 },
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
        type: 'shadow',
        shadowStyle: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      formatter: (params: TooltipComponentFormatterCallbackParams) => {
        const point = Array.isArray(params) ? params[0] : params;
        const row = point ? chartData[point.dataIndex] : undefined;
        if (!row) {
          return '';
        }

        return `${fullDate.format(new Date(`${row.day}T00:00:00Z`))} · UTC<br />${row.recipients.toLocaleString()} unique recipients`;
      },
    },
    xAxis: {
      type: 'category',
      data: chart.days,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#87929e',
        fontSize: 11,
        interval: Math.max(0, Math.ceil(chart.days.length / 4) - 1),
        hideOverlap: true,
        margin: 12,
        formatter: (value: string) => shortDate.format(new Date(`${value}T00:00:00Z`)),
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitNumber: 2,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.055)', type: 'dashed' },
      },
    },
    series: [
      {
        name: 'Unique recipients',
        type: 'bar',
        barMaxWidth: 16,
        barCategoryGap: '40%',
        itemStyle: { color: '#818cf8', borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { color: '#a5b4fc' } },
        data: chartData.map((item) => item.recipients),
      },
    ],
  } satisfies EChartsOption;

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-white/90">Audience</h2>
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-3xl font-medium tracking-tight text-white tabular-nums">
            {uniqueRecipients.toLocaleString()}
          </span>
          <span className="text-sm text-white/45">unique recipients</span>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-white/40">
          Recipients with activity in this period.
        </p>
      </div>
      <figure>
        <figcaption className="flex items-center justify-between text-[11px] text-white/35">
          <span>Daily unique recipients</span>
          <span>UTC</span>
        </figcaption>
        <div aria-hidden="true">
          <ReactEChartsCore
            echarts={echarts}
            option={chartOption}
            notMerge
            lazyUpdate
            style={{ height: 120 }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
        <table className="sr-only">
          <caption>Daily unique recipients, UTC</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Unique recipients</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map(({ day, recipients }) => (
              <tr key={day}>
                <th scope="row">{fullDate.format(new Date(`${day}T00:00:00Z`))}</th>
                <td>{recipients.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </section>
  );
}
