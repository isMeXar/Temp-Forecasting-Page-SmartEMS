import React, { useMemo, useRef, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { RotateCcw, Search, Download } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// ECharts layout constants
const SLIDER_HEIGHT = 42;

// Number of steps per horizon (used for default zoom extent)
const HORIZON_STEPS = {
  "1h": 6, "1d": 144, "3d": 432, "1w": 1008, "1m": 4320
};
// Tick interval for x-axis labels (in ms)
const AXIS_INTERVAL = {
  "1h": 10 * 60 * 1000,
  "1d": 3 * 3600000,
  "3d": 6 * 3600000,
  "1w": 12 * 3600000,
  "1m": 86400000,
};
// Default window size (data points shown when no forecast exists yet)
const WINDOW_SIZE = {
  "1h": 150, "1d": 432, "3d": 1296, "1w": 3024, "1m": 12960
};
const SLIDER_TO_LEGEND_GAP = 10;
const LEGEND_HEIGHT = 24;

// Compute chart grid bottom — on mobile we hide the slider, so less space needed
const getGridBottom = (isMobile) => {
  const legendBottom = isMobile ? 4 : SLIDER_HEIGHT + SLIDER_TO_LEGEND_GAP;
  return legendBottom + LEGEND_HEIGHT + 6;
};

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

/**
 * ForecastChart — ECharts wrapper for time-series energy forecasts.
 *
 * Zoom behaviour:
 *   - On first load / horizon change: default view = 2× horizon before forecast start
 *   - On new data arriving (auto-tracking): same default recomputed, updates zoomRef
 *     UNLESS user has interacted (interacted flag)
 *   - On user zoom/pan: interacted = true, auto-tracking stops
 *   - Reset button: clears interacted, recomputes default
 *
 * Responsive (isMobile < 768px):
 *   - Hides slider, reduces margins, smaller fonts, no animation
 */
const ForecastChart = ({ data, loading, accent = 'cyan', chartHeight = 400, horizon = '1d', toolbarLeft, toolbarCenter }) => {
  const c = accentColors[accent] || accentColors.cyan;
  const { isDark } = useTheme();
  const actualColor = isDark ? '#f1f5f9' : '#000000';
  const zoomRef = useRef(null);           // { horizon, interacted, startValue, endValue }
  const dataExtentRef = useRef({ min: 0, max: 0 });
  const chartRef = useRef(null);
  const [zoomEpoch, setZoomEpoch] = useState(0);  // increment to force re-render
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  // Track window width for responsive breakpoints
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = windowWidth < 768;

  const splitIndex = useMemo(() => data.findIndex(d => d.forecasted !== null), [data]);

  if (data.length > 0) {
    dataExtentRef.current = {
      min: TS2MS(data[0].timestamp),
      max: TS2MS(data[data.length - 1].timestamp),
    };
  }

  // Compute the default zoom: 2× horizon duration before forecast start → forecast end.
  // This gives context before the forecast while keeping the forecast in focus.
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

  // Sync zoom with latest data: auto-track if user hasn't interacted.
  // Triggers re-render when data.length, horizon, or zoomEpoch changes.
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

  // dataZoom event handler — converts percentage or absolute zoom from the slider
  // into absolute timestamps and stores them in zoomRef + marks as interacted.
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

  // Build the full ECharts option. Two branches:
  //   1. Empty data → axes/grid/legend with no series (always renders)
  //   2. Data available → series for actual, prevForecast, forecast, confidence band
  const option = useMemo(() => {
    // --- Empty state: show just axes and legend ---
    if (!data || data.length === 0) {
      return {
        tooltip: { trigger: 'axis' },
        legend: {
          bottom: isMobile ? 4 : SLIDER_HEIGHT + SLIDER_TO_LEGEND_GAP,
          icon: 'roundRect',
          itemWidth: isMobile ? 10 : 14,
          itemHeight: isMobile ? 2 : 3,
          textStyle: { color: '#94a3b8', fontSize: isMobile ? 9 : 11, fontFamily: 'DM Sans, sans-serif' },
          inactiveColor: '#475569',
          data: ['Actual', 'Previous Forecast', 'Forecast', 'Forecast Start'],
        },
        grid: { left: isMobile ? 8 : 44, right: isMobile ? 8 : 24, top: 30, bottom: getGridBottom(isMobile), containLabel: true },
        xAxis: {
          type: 'time',
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#64748b', fontSize: isMobile ? 7 : 9, fontFamily: 'JetBrains Mono, monospace', margin: 4 },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          name: 'Power (kW)',
          nameTextStyle: { color: '#64748b', fontSize: isMobile ? 8 : 10, fontFamily: 'JetBrains Mono, monospace', rotate: 90 },
          nameLocation: 'middle',
          nameGap: isMobile ? 28 : 48,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#64748b', fontSize: isMobile ? 7 : 9, fontFamily: 'JetBrains Mono, monospace' },
          splitLine: { lineStyle: { color: 'rgba(148,163,184,0.08)', type: 'dashed' } },
        },
        series: [],
        dataZoom: [
          { type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false, minValueSpan: 3600000 },
          isMobile ? null : { type: 'slider', xAxisIndex: 0, bottom: 0, height: SLIDER_HEIGHT, borderColor: 'rgba(148,163,184,0.2)', backgroundColor: 'rgba(148,163,184,0.05)', fillerColor: 'rgba(6,182,212,0.15)', handleStyle: { color: '#06b6d4', borderColor: '#06b6d4', borderWidth: 1.5 }, textStyle: { color: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }, labelStyle: { color: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }, brushSelect: false },
        ].filter(Boolean),
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
        animationDuration: isMobile ? 0 : 500,
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
          bottom: isMobile ? 4 : SLIDER_HEIGHT + SLIDER_TO_LEGEND_GAP,
          icon: 'roundRect',
          itemWidth: isMobile ? 10 : 14,
          itemHeight: isMobile ? 2 : 3,
          textStyle: { color: '#94a3b8', fontSize: isMobile ? 9 : 11, fontFamily: 'DM Sans, sans-serif' },
          inactiveColor: '#475569',
          data: ['Actual', 'Previous Forecast', 'Forecast', 'Forecast Start'],
        },
        grid: {
          left: isMobile ? 8 : 44,
          right: isMobile ? 8 : 24,
          top: 24,
          bottom: getGridBottom(isMobile),
          containLabel: true,
        },
        xAxis: {
          type: 'time',
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#64748b',
            fontSize: isMobile ? 7 : 9,
            fontFamily: 'JetBrains Mono, monospace',
            margin: isMobile ? 2 : 8,
            formatter: smartAxisFormatter(),
            interval: AXIS_INTERVAL[horizon] || 'auto',
            hideOverlap: false,
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          name: 'Power (kW)',
          nameTextStyle: { color: '#64748b', fontSize: isMobile ? 8 : 10, fontFamily: 'JetBrains Mono, monospace', rotate: 90 },
          nameLocation: 'middle',
          nameGap: isMobile ? 28 : 48,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#64748b',
            fontSize: isMobile ? 7 : 9,
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
          ...(isMobile ? [] : [{
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
          }]),
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
        <div className="flex flex-wrap items-center px-3 md:px-4 py-2 border-b border-surface-border/30 bg-surface-card/20 gap-1.5 md:gap-2">
          <div className="flex items-center gap-3 flex-[1_1_auto] min-w-0">{toolbarLeft}</div>
          <div className="flex items-center gap-1.5 flex-[1_1_auto] justify-center order-last md:order-none md:flex-1">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              onKeyDown={handleDateKeyDown}
              className="px-2 py-1 rounded-lg bg-surface-hover/30 border border-surface-border/40 text-ink text-xs font-mono-num w-24 md:w-28"
            />
            <span className="text-ink-muted text-xs font-mono-num hidden xs:inline">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              onKeyDown={handleDateKeyDown}
              className="px-2 py-1 rounded-lg bg-surface-hover/30 border border-surface-border/40 text-ink text-xs font-mono-num w-24 md:w-28"
            />
            <button
              onClick={applyDateRange}
              className="p-1.5 rounded-lg bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/30 text-accent-cyan transition-colors"
              title="Jump to range"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-[1_1_auto] justify-end">
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
      <div className="relative" style={{ height: isMobile ? chartHeight + 40 : chartHeight + 80 }}>
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
