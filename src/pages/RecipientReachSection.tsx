import type { EChartsOption, EChartsType, TooltipComponentFormatterCallbackParams } from 'echarts';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useState } from 'react';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const format = {
  integer: (value: number) => value.toLocaleString(),
};

const OVERVIEW_CHART_GROUP = 'dashboard-overview';

const connectOverviewChart = (instance: EChartsType) => {
  instance.group = OVERVIEW_CHART_GROUP;
  echarts.connect(OVERVIEW_CHART_GROUP);
};

const useIsNarrowViewport = () => {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 640px)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const update = () => setIsNarrow(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isNarrow;
};

type OverviewChart = {
  days: string[];
  sent: number[];
  delivered: number[];
  bounced: number[];
  unique_opens: number[];
  unique_recipients: number[];
};

export default function RecipientReachSection({
  chart,
  uniqueRecipients,
}: {
  chart: OverviewChart;
  uniqueRecipients: number;
}) {
  const isNarrow = useIsNarrowViewport();
  const chartData = chart.days.map((day, index) => ({
    day,
    sent: chart.sent[index] ?? 0,
    delivered: chart.delivered[index] ?? 0,
    unique_recipients: chart.unique_recipients[index] ?? 0,
  }));
  const labelInterval = Math.max(0, Math.ceil(chartData.length / (isNarrow ? 5 : 8)) - 1);

  const chartOption = {
    backgroundColor: 'transparent',
    animationDuration: 250,
    grid: {
      top: 8,
      right: isNarrow ? 6 : 10,
      bottom: isNarrow ? 26 : 34,
      left: isNarrow ? 28 : 34,
      containLabel: false,
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
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(255, 255, 255, 0.06)',
        },
      },
      formatter: (params: TooltipComponentFormatterCallbackParams) => {
        const rows = Array.isArray(params) ? params : [params];
        const title = rows[0]?.name ?? '';
        const rowData = chartData.find((item) => item.day === title);
        if (!rowData) {
          return title;
        }

        return [
          title,
          `Unique recipients: ${format.integer(rowData.unique_recipients)}`,
          `Sent: ${format.integer(rowData.sent)}`,
          `Delivered: ${format.integer(rowData.delivered)}`,
        ].join('<br />');
      },
    },
    xAxis: {
      type: 'category',
      data: chartData.map((item) => item.day),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.45)',
        interval: labelInterval,
        margin: isNarrow ? 6 : 10,
        formatter: (value: string) => value.slice(5),
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.3)',
        margin: isNarrow ? 4 : 8,
        fontSize: isNarrow ? 10 : 12,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)',
          type: 'dashed',
        },
      },
    },
    series: [
      {
        name: 'Unique recipients',
        type: 'bar',
        barMaxWidth: isNarrow ? 12 : 16,
        barCategoryGap: isNarrow ? '56%' : '48%',
        itemStyle: {
          color: 'rgba(129, 140, 248, 0.78)',
          borderRadius: [3, 3, 0, 0],
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: 'rgba(129, 140, 248, 0.95)',
          },
        },
        data: chartData.map((item) => item.unique_recipients),
      },
    ],
  } satisfies EChartsOption;

  return (
    <section className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 md:pb-4">
        <h2 className="text-lg font-semibold text-white">Recipient reach</h2>
        <span className="shrink-0 rounded bg-white/5 px-2 py-0.5 font-mono text-sm whitespace-nowrap text-white/45">
          {format.integer(uniqueRecipients)} recipients
        </span>
      </div>

      <ReactEChartsCore
        echarts={echarts}
        option={chartOption}
        notMerge
        lazyUpdate
        onChartReady={connectOverviewChart}
        className="h-[170px] w-full md:h-[200px]"
        style={{ height: isNarrow ? 170 : 200 }}
        opts={{ renderer: 'canvas' }}
      />
    </section>
  );
}
