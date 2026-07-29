import React, { useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { RotateCcw, Search, Download } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const SLIDER_HEIGHT = 42;

const HORIZON_STEPS = {
  "1h": 6, "1d": 144, "3d": 432, "1w": 1008, "1m": 4320
};
const AXIS_INTERVAL = {
  "1h": 10 * 60 * 1000,
  "1d": 3 * 3600000,
  "3d": 6 * 3600000,
  "1w": 12 * 3600000,
  "1m": 86400000,
};
const WINDOW_SIZE = {
  "1h": 150, "1d": 432, "3d": 1296, "1w": 3024, "1m": 12960
};
const SLIDER_TO_LEGEND_GAP = 10;
const LEGEND_HEIGHT = 24;
const LEGEND_BOTTOM = SLIDER_HEIGHT + SLIDER_TO_LEGEND_GAP;
const GRID_BOTTOM = LEGEND_BOTTOM + LEGEND_HEIGHT + 6;

const TS2MS = (ts) => new Date(ts).getTime();

const formatTS = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatShort = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
};

const formatTimeOnly = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

const formatDayLabel = (d) => {
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${d.getDate()} ${month}`;
};

const smartAxisFormatter = () => {
  let lastDayKey = null;
  return (value) => {
    const d = new Date(value);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const time = formatTimeOnly(d);
    if (dayKey !== lastDayKey) {
      lastDayKey = dayKey;
      return `${formatDayLabel(d)}\n${time}`;
    }
    return time;
  };
};

const accentColors = {
  cyan: { main: '#06b6d4', band: 'rgba(6,182,212,0.15)' },
  emerald: { main: '#10b981', band: 'rgba(16,185,129,0.15)' },
  amber: { main: '#f59e0b', band: 'rgba(245,158,11,0.15)' },
  violet: { main: '#8b5cf6', band: 'rgba(139,92,246,0.15)' },
};

const ForecastChart = ({ data, loading, accent = 'cyan', chartHeight = 400, horizon = '1d', toolbarLeft, toolbarCenter }) => {
  const c = accentColors[accent] || accentColors.cyan;
  const { isDark } = useTheme();
  const actualColor = isDark ? '#f1f5f9' : '#000000';
  const zoomRef = useRef(null);
  const dataExtentRef = useRef({ min: 0, max: 0 });
  const chartRef = useRef(null);
  const [zoomEpoch, setZoomEpoch] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const splitIndex = useMemo(() => data.findIndex(d => d.forecasted !== null), [data]);

  if (data.length > 0) {
    dataExtentRef.current = {
      min: TS2MS(data[0].timestamp),
      max: TS2MS(data[data.length - 1].timestamp),
    };
  }

  const getDefaultZoom = () => {
    if (!data.length) return null;
    const forecastIdx = data.findIndex(d => d.forecasted !== null);
    if (forecastIdx >= 0) {
      const forecastStart = TS2MS(data[forecastIdx].timestamp);
      const forecastEnd = TS2MS(data[data.length - 1].timestamp);
      const horizonMs = (HORIZON_STEPS[horizon] || 144) * 10 * 60 * 1000;
      return {
        startValue: forecastStart - 2 * horizonMs,
        endValue: forecastEnd,
      };
    }
    const ws = WINDOW_SIZE[horizon] || 300;
    const startIdx = Math.max(0, data.length - ws);
    return {
      startValue: TS2MS(data[startIdx].timestamp),
      endValue: TS2MS(data[data.length - 1].timestamp),
    };
  };

  const zoomConfig = useMemo(() => {
    if (!data.length) return {};

    if (!zoomRef.current || zoomRef.current.horizon !== horizon) {
      // First load or horizon change
      const def = getDefaultZoom();
      if (def) zoomRef.current = { horizon, interacted: false, ...def };
    } else if (!zoomRef.current.interacted) {
      // User hasn't interacted — keep tracking the end
      const def = getDefaultZoom();
      if (def) zoomRef.current = { ...zoomRef.current, ...def };
    }

    return {
      startValue: zoomRef.current.startValue,
      endValue: zoomRef.current.endValue,
    };
  }, [data.length, horizon, zoomEpoch]);

  const handleReset = () => {
    if (!data.length) return;
    const def = getDefaultZoom();
    if (def) {
      zoomRef.current = { horizon, interacted: false, ...def };
      setZoomEpoch(n => n + 1);
    }
  };

  const applyDateRange = () => {
    if (!startDate || !endDate) return;
    const start = new Date(`${startDate}T00:00`);
    const end = new Date(`${endDate}T23:59`);
    zoomRef.current = {
      ...zoomRef.current,
      interacted: true,
      startValue: start.getTime(),
      endValue: end.getTime(),
    };
    setZoomEpoch(n => n + 1);
  };

  const handleDateKeyDown = (e) => {
    if (e.key === 'Enter') applyDateRange();
  };

  const saveAsPng = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast-${horizon}-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  const onEvents = useMemo(() => ({
    dataZoom: (params) => {
      const batch = params.batch ? params.batch[0] : params;
      if (!zoomRef.current) return;

      let startValue, endValue;

      if (batch.startValue != null && batch.endValue != null) {
        startValue = batch.startValue;
        endValue = batch.endValue;
      } else if (batch.start != null && batch.end != null) {
        const { min, max } = dataExtentRef.current;
        const range = max - min;
        startValue = Math.round(min + range * batch.start / 100);
        endValue = Math.round(min + range * batch.end / 100);
      } else {
        return;
      }

      zoomRef.current = {
        ...zoomRef.current,
        interacted: true,
        startValue,
        endValue,
      };
    },
  }), []);

  const option = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        tooltip: { trigger: 'axis' },
        legend: {
          bottom: LEGEND_BOTTOM,
          icon: 'roundRect',
          itemWidth: 14,
          itemHeight: 3,
          textStyle: { color: '#94a3b8', fontSize: 11, fontFamily: 'DM Sans, sans-serif' },
          inactiveColor: '#475569',
          data: ['Actual', 'Previous Forecast', 'Forecast', 'Forecast Start'],
        },
        grid: { left: 44, right: 24, top: 30, bottom: GRID_BOTTOM, containLabel: true },
        xAxis: {
          type: 'time',
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', margin: 8 },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          name: 'Power (kW)',
          nameTextStyle: { color: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', rotate: 90 },
          nameLocation: 'middle',
          nameGap: 48,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' },
          splitLine: { lineStyle: { color: 'rgba(148,163,184,0.08)', type: 'dashed' } },
        },
        series: [],
        dataZoom: [
          { type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false, minValueSpan: 3600000 },
          { type: 'slider', xAxisIndex: 0, bottom: 0, height: SLIDER_HEIGHT, borderColor: 'rgba(148,163,184,0.2)', backgroundColor: 'rgba(148,163,184,0.05)', fillerColor: 'rgba(6,182,212,0.15)', handleStyle: { color: '#06b6d4', borderColor: '#06b6d4', borderWidth: 1.5 }, textStyle: { color: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }, labelStyle: { color: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }, brushSelect: false },
        ],
      };
    }

    try {
      const timestampsMs = data.map(d => TS2MS(d.timestamp));

      const mkData = (values) => values.map((v, i) => v != null ? [timestampsMs[i], v] : null);

      const actualData = mkData(data.map(d => d.actual ?? null));
      const prevForecastData = mkData(data.map(d => d.prevForecast ?? null));
      const forecastData = mkData(data.map(d => d.forecasted ?? null));
      const upperData = mkData(data.map(d => d.confidenceUpper ?? null));
      const lowerData = mkData(data.map(d => d.confidenceLower ?? null));

      const series = [
        {
          name: 'Actual',
          type: 'line',
          data: actualData,
          lineStyle: { color: actualColor, width: 1 },
          itemStyle: { color: actualColor },
          showSymbol: false,
          connectNulls: false,
          smooth: true,
          smoothMonotone: 'x',
          z: 3,
        },
        {
          name: 'Previous Forecast',
          type: 'line',
          data: prevForecastData,
          lineStyle: { color: '#3b82f6', width: 2 },
          itemStyle: { color: '#3b82f6' },
          showSymbol: false,
          connectNulls: false,
          smooth: true,
          smoothMonotone: 'x',
          z: 2,
        },
        {
          name: 'Forecast',
          type: 'line',
          data: forecastData,
          lineStyle: { color: '#10b981', width: 2, type: 'dashed' },
          itemStyle: { color: '#10b981' },
          showSymbol: false,
          connectNulls: false,
          smooth: true,
          smoothMonotone: 'x',
          z: 4,
        },
      ];

      if (upperData.some(v => v != null) && lowerData.some(v => v != null)) {
        const bandData = upperData.map((u, i) => {
          const l = lowerData[i];
          if (u == null || l == null) return null;
          return [u[0], u[1] - l[1]];
        });
        series.push({
          name: 'Confidence Lower',
          type: 'line',
          data: lowerData,
          lineStyle: { opacity: 0 },
          stack: 'confBand',
          showSymbol: false,
          smooth: true,
          smoothMonotone: 'x',
          z: 0,
        });
        series.push({
          name: 'Confidence Band',
          type: 'line',
          data: bandData,
          lineStyle: { opacity: 0 },
          areaStyle: { color: c.band },
          stack: 'confBand',
          showSymbol: false,
          smooth: true,
          smoothMonotone: 'x',
          z: 0,
        });
      }

      if (splitIndex >= 0 && data[splitIndex]) {
        series.push({
          name: 'Forecast Start',
          type: 'line',
          data: [],
          lineStyle: { color: '#f43f5e', width: 1.5, type: 'dashed' },
          itemStyle: { color: '#f43f5e' },
          showSymbol: false,
          legendHoverLink: false,
          z: 5,
        });
      }

      const fcSeries = series.map(s => {
        if (s.name === 'Forecast' && splitIndex >= 0 && data[splitIndex]) {
          return {
            ...s,
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: '#f43f5e', width: 1.5, type: 'dashed' },
              label: { show: false },
              data: [{ xAxis: timestampsMs[splitIndex] }],
            },
          };
        }
        return s;
      });

      return {
        animationDuration: 500,
        animationEasing: 'cubicOut',
        animationDurationUpdate: 0,
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(15,23,42,0.95)',
          borderColor: 'rgba(148,163,184,0.3)',
          borderWidth: 1,
          textStyle: { color: '#e2e8f0', fontSize: 11 },
          formatter: (params) => {
            const ts = params[0]?.axisValue;
            if (!ts) return '';
            let html = `<div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:4px">${formatTS(ts)}</div>`;
            const shown = new Set();
            params.forEach(p => {
              if (p.value == null) return;
              if (shown.has(p.seriesName)) return;
              shown.add(p.seriesName);
              const names = { 'Actual': 'Actual', 'Previous Forecast': 'Previous', 'Forecast': 'Forecast' };
              const label = names[p.seriesName] || p.seriesName;
              html += `<div style="display:flex;align-items:center;gap:6px;padding:1px 0">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                <span style="color:#94a3b8">${label}:</span>
                <span style="font-family:JetBrains Mono,monospace;font-weight:700;color:#e2e8f0">${Number(Array.isArray(p.value) ? p.value[1] : p.value).toFixed(1)} MW</span>
              </div>`;
            });
            return html;
          },
        },
        legend: {
          bottom: LEGEND_BOTTOM,
          icon: 'roundRect',
          itemWidth: 14,
          itemHeight: 3,
          textStyle: { color: '#94a3b8', fontSize: 11, fontFamily: 'DM Sans, sans-serif' },
          inactiveColor: '#475569',
          data: ['Actual', 'Previous Forecast', 'Forecast', 'Forecast Start'],
        },
        grid: {
          left: 44,
          right: 24,
          top: 30,
          bottom: GRID_BOTTOM,
          containLabel: true,
        },
        xAxis: {
          type: 'time',
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#64748b',
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
            margin: 8,
            formatter: smartAxisFormatter(),
            interval: AXIS_INTERVAL[horizon] || 'auto',
            hideOverlap: false,
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          name: 'Power (kW)',
          nameTextStyle: { color: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', rotate: 90 },
          nameLocation: 'middle',
          nameGap: 48,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#64748b',
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
          },
          splitLine: {
            lineStyle: { color: 'rgba(148,163,184,0.08)', type: 'dashed' },
          },
        },
        dataZoom: [
          {
            type: 'inside',
            xAxisIndex: 0,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
            minValueSpan: 3600000,
            ...zoomConfig,
          },
          {
            type: 'slider',
            xAxisIndex: 0,
            bottom: 0,
            height: SLIDER_HEIGHT,
            borderColor: 'rgba(148,163,184,0.2)',
            backgroundColor: 'rgba(148,163,184,0.05)',
            fillerColor: 'rgba(6,182,212,0.15)',
            handleStyle: {
              color: '#06b6d4',
              borderColor: '#06b6d4',
              borderWidth: 1.5,
            },
            textStyle: {
              color: '#64748b',
              fontSize: 9,
              fontFamily: 'JetBrains Mono, monospace',
            },
            labelFormatter: (v) => formatShort(new Date(v)),
            minValueSpan: 3600000,
            ...zoomConfig,
          },
        ],
        series: fcSeries,
      };
    } catch (e) {
      console.error('Chart option error:', e);
      return {};
    }
  }, [data, c, splitIndex, zoomConfig, actualColor]);

  return (
    <div className="rounded-2xl bg-surface-card/60 shadow-card dark:border dark:border-surface-border/10 overflow-hidden">
      {/* Toolbar */}
      {(toolbarLeft || toolbarCenter) && (
        <div className="flex items-center px-4 py-2 border-b border-surface-border/30 bg-surface-card/20 gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">{toolbarLeft}</div>
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              onKeyDown={handleDateKeyDown}
              className="px-2 py-1 rounded-lg bg-surface-hover/30 border border-surface-border/40 text-ink text-xs font-mono-num w-28"
            />
            <span className="text-ink-muted text-xs font-mono-num">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              onKeyDown={handleDateKeyDown}
              className="px-2 py-1 rounded-lg bg-surface-hover/30 border border-surface-border/40 text-ink text-xs font-mono-num w-28"
            />
            <button
              onClick={applyDateRange}
              className="p-1.5 rounded-lg bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/30 text-accent-cyan transition-colors"
              title="Jump to range"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            {toolbarCenter}
            <button
              onClick={saveAsPng}
              className="p-1.5 rounded-lg bg-surface-hover/30 hover:bg-surface-hover/60 border border-surface-border/40 text-ink-muted hover:text-ink transition-colors"
              title="Save as PNG"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-surface-hover/30 hover:bg-surface-hover/60 border border-surface-border/40 text-ink-muted hover:text-ink transition-colors"
              title="Reset view to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Chart area */}
      <div className="relative pb-3" style={{ height: chartHeight + 80 }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="relative w-10 h-10 mx-auto">
                <div className="absolute inset-0 border-2 border-accent-cyan/30 rounded-full" />
                <div className="absolute inset-0 border-2 border-transparent border-t-accent-cyan rounded-full animate-spin" />
              </div>
              <p className="mt-4 text-xs text-ink-muted font-medium">Loading forecast data...</p>
            </div>
          </div>
        ) : (
          <ReactECharts
            ref={chartRef}
            option={option}
            notMerge={false}
            lazyUpdate
            onEvents={onEvents}
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </div>
    </div>
  );
};

export default ForecastChart;
