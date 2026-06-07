import type { EChartsOption, TooltipComponentFormatterCallbackParams } from 'echarts';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/esm/core';

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const format = {
  integer: (value: number) => value.toLocaleString(),
  percent: (value: number) => `${(value * 100).toFixed(1)}%`,
};

type OverviewChart = {
  days: string[];
  sent: number[];
  delivered: number[];
  bounced: number[];
  unique_opens: number[];
};

export default function DailyVolumeSection({ chart }: { chart: OverviewChart }) {
  const chartData = chart.days.map((day, index) => ({
    day,
    sent: chart.sent[index] ?? 0,
    delivered: chart.delivered[index] ?? 0,
    bounced: chart.bounced[index] ?? 0,
    bounce_rate:
      (chart.sent[index] ?? 0) > 0
        ? Math.min(1, (chart.bounced[index] ?? 0) / (chart.sent[index] ?? 0))
        : 0,
    open_rate:
      (chart.delivered[index] ?? 0) > 0
        ? Math.min(1, (chart.unique_opens[index] ?? 0) / (chart.delivered[index] ?? 0))
        : 0,
  }));

  const chartSeries = [
    { label: 'Delivered', color: 'rgba(45, 212, 191, 0.42)', isRate: false },
    { label: 'Bounced', color: '#f43f5e', isRate: false },
    { label: 'Open rate', color: '#60a5fa', isRate: true },
  ] as const;

  const chartOption = {
    backgroundColor: 'transparent',
    color: chartSeries.map((series) => series.color),
    animationDuration: 250,
    grid: {
      top: 12,
      right: 44,
      bottom: 48,
      left: 40,
      containLabel: false,
    },
    legend: {
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 16,
      textStyle: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 12,
      },
      data: chartSeries.map((series) => series.label),
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: '#0B0C0E',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      padding: [8, 10],
      textStyle: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 12,
        lineHeight: 18,
        fontFamily: 'Inter Variable, Inter, sans-serif',
      },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.22)',
          width: 1,
        },
      },
      formatter: (params: TooltipComponentFormatterCallbackParams) => {
        const rows = Array.isArray(params) ? params : [params];
        const title = rows[0]?.name ?? '';
        const rowData = chartData.find((item) => item.day === title);
        const values = rows
          .map((row) => {
            const series = chartSeries.find((item) => item.label === row.seriesName);
            if (!series) {
              return null;
            }

            const value = Number(row.value);
            if (!Number.isFinite(value)) {
              return null;
            }

            return `${row.marker ?? ''} ${series.label}: ${
              series.isRate ? format.percent(value) : format.integer(value)
            }`;
          })
          .filter((row): row is string => row !== null);
        if (rowData) {
          values.unshift(`Sent: ${format.integer(rowData.sent)}`);
          values.splice(3, 0, `Bounce rate: ${format.percent(rowData.bounce_rate)}`);
        }

        return [title, ...values].join('<br />');
      },
    },
    xAxis: {
      type: 'category',
      data: chartData.map((item) => item.day),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.45)',
        margin: 10,
        formatter: (value: string) => value.slice(5),
      },
    },
    yAxis: [
      {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.28)',
          margin: 8,
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)',
            type: 'dashed',
          },
        },
      },
      {
        type: 'value',
        min: 0,
        max: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.55)',
          margin: 8,
          formatter: (value: number) => `${(value * 100).toFixed(0)}%`,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Delivered',
        type: 'bar',
        stack: 'outcome',
        yAxisIndex: 0,
        barMaxWidth: 18,
        barCategoryGap: '45%',
        itemStyle: {
          color: 'rgba(45, 212, 191, 0.14)',
          decal: {
            symbol: 'rect',
            symbolSize: 1,
            rotation: -Math.PI / 4,
            dashArrayX: [1, 0],
            dashArrayY: [4, 4],
            color: 'rgba(45, 212, 191, 0.5)',
            backgroundColor: 'rgba(45, 212, 191, 0.1)',
          },
        },
        emphasis: {
          focus: 'series',
        },
        data: chartData.map((item) => item.delivered),
      },
      {
        name: 'Bounced',
        type: 'bar',
        stack: 'outcome',
        yAxisIndex: 0,
        barMaxWidth: 18,
        barCategoryGap: '45%',
        itemStyle: {
          color: '#f43f5e',
          borderRadius: [3, 3, 0, 0],
        },
        emphasis: {
          focus: 'series',
        },
        data: chartData.map((item) => item.bounced),
      },
      {
        name: 'Open rate',
        type: 'line',
        yAxisIndex: 1,
        lineStyle: {
          width: 2.5,
          color: '#60a5fa',
        },
        smooth: true,
        showSymbol: false,
        symbol: 'circle',
        itemStyle: {
          color: '#60a5fa',
        },
        emphasis: {
          focus: 'series',
        },
        data: chartData.map((item) => item.open_rate),
      },
    ],
  } satisfies EChartsOption;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold text-white">Daily delivery trend</h2>
      </div>
      <ReactEChartsCore
        echarts={echarts}
        option={chartOption}
        notMerge
        lazyUpdate
        className="h-[260px] w-full"
        opts={{ renderer: 'canvas' }}
      />
    </section>
  );
}
