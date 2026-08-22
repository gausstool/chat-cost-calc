<script setup lang="ts">
import { ref, computed } from "vue";

interface RoundData {
  round: number;
  cacheHit: number;
  cacheMiss: number;
  output: number;
  cost: number;
  cumulativeContext: number;
}

interface StepData extends RoundData {
  step: number;
  label: string;
}

const props = defineProps<{
  rounds: RoundData[];
  steps: StepData[];
  cacheHitPrice: number;
  cacheMissPrice: number;
  outputPrice: number;
}>();

const chartGranularity = ref<'round' | 'step'>('round');

// 图表数据
const chartSeries = computed(() => {
  const data = chartGranularity.value === 'round' ? props.rounds : props.steps;
  if (!data || data.length === 0) return [];
  return [
    { name: '命中缓存输入', data: data.map(r => Math.round(r.cacheHit)) },
    { name: '未命中缓存输入', data: data.map(r => Math.round(r.cacheMiss)) },
    { name: '输出', data: data.map(r => Math.round(r.output)) },
  ];
});

// tooltip 函数
function tooltipFormatter({ series, dataPointIndex, w }: any) {
  const names = ['命中缓存输入', '未命中缓存输入', '输出'];
  const prices = [props.cacheHitPrice, props.cacheMissPrice, props.outputPrice];
  let total = 0;
  let rows = '';
  for (let i = 0; i < series.length; i++) {
    const v = series[i][dataPointIndex];
    const c = (v / 1e6) * prices[i];
    total += c;
    const token = v >= 1000 ? Math.round(v / 1000) + 'k' : v;
    rows += `<div style="display:flex;justify-content:space-between;gap:16px"><span>${names[i]}</span><span style="font-family:monospace">${token} <span style="opacity:.5">￥${c.toFixed(3)}</span></span></div>`;
  }
  const label = w.globals.categoryLabels[dataPointIndex] || '';
  return `<div style="padding:6px 10px;font-size:12px;line-height:1.6">
    <div style="font-weight:600;margin-bottom:4px">${label}</div>
    ${rows}
    <div style="border-top:1px solid rgba(128,128,128,.3);margin-top:4px;padding-top:4px;font-weight:600;display:flex;justify-content:space-between"><span>合计</span><span style="font-family:monospace">￥${total.toFixed(3)}</span></div>
  </div>`;
}

// 图表配置
const chartOptions = computed(() => {
  const isRound = chartGranularity.value === 'round';
  const data = isRound ? props.rounds : props.steps;
  const categories = data
    ? data.map(d => isRound ? `T${d.round}` : `R${d.round}:S${(d as StepData).step}`)
    : [];
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#9ca3af' : '#6b6375';
  const borderColor = isDark ? '#2e303a' : '#e5e4e7';
  const count = data ? data.length : 0;

  return {
    chart: {
      type: 'bar' as const,
      stacked: true,
      stackType: 'normal' as const,
      toolbar: { show: false },
      fontFamily: 'system-ui, sans-serif',
      background: 'transparent',
      animations: { enabled: false },
    },
    colors: ['#aa3bff', '#ff9500', '#34c759'],
    plotOptions: {
      bar: {
        columnWidth: count > 60 ? '85%' : '70%',
        borderRadius: 2,
        borderRadiusApplication: 'end' as const,
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    xaxis: {
      categories,
      labels: {
        show: isRound,
        style: { colors: textColor, fontSize: '11px' },
        rotate: count > 24 ? -45 : 0,
        rotateAlways: count > 40,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: textColor, fontSize: '11px' },
        decimalsInFloat: 0,
        formatter: (val: number) => {
          if (val >= 1000000) return (val / 1000000) + 'M';
          if (val >= 1000) return Math.round(val / 1000) + 'k';
          return Math.round(val).toString();
        },
      },
    },
    legend: {
      position: 'top' as const,
      horizontalAlign: 'right' as const,
      fontSize: '12px',
      labels: { colors: textColor },
      markers: { radius: 2 },
    },
    tooltip: {
      shared: true,
      intersect: false,
      theme: isDark ? 'dark' : 'light',
      custom: tooltipFormatter,
    },
    grid: {
      borderColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    fill: { opacity: 1 },
    noData: { text: '暂无数据' },
  };
});
</script>

<template>
  <div class="chart-section">
    <div class="chart-header">
      <h3>{{ chartGranularity === 'round' ? '每轮消耗趋势' : '每步消耗趋势' }}</h3>
      <div class="chart-toggle-group">
        <button
          :class="['toggle-btn', { active: chartGranularity === 'round' }]"
          @click="chartGranularity = 'round'"
        >轮次</button>
        <button
          :class="['toggle-btn', { active: chartGranularity === 'step' }]"
          @click="chartGranularity = 'step'"
        >步骤</button>
      </div>
    </div>
    <div class="chart-wrapper" v-if="chartSeries.length > 0">
      <apexchart
        :key="chartGranularity"
        type="bar"
        height="360"
        :options="chartOptions"
        :series="chartSeries"
      />
    </div>
  </div>
</template>

<style scoped>
.chart-section {
  margin-top: 30px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-header h3 {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-h);
  margin: 0;
}

.chart-toggle-group {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: var(--code-bg);
  border-radius: 8px;
}

.toggle-btn {
  padding: 5px 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: var(--accent);
  color: #fff;
}

.chart-wrapper {
  width: 100%;
}
</style>
