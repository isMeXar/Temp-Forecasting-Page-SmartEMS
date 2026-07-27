import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

const SLIDER_HEIGHT = 42;

const HORIZON_STEPS = {
  "1h": 6, "1d": 144, "3d": 432, "1w": 1008, "1m": 4320
};
const HISTORY_WINDOW = {
  "1h": 144, "1d": 288, "3d": 864, "1w": 2016, "1m": 8640
};
const SLIDER_TO_LEGEND_GAP = 10;
const LEGEND_HEIGHT = 24;
const LEGEND_BOTTOM = SLIDER_HEIGHT + SLIDER_TO_LEGEND_GAP;
const GRID_BOTTOM = LEGEND_BOTTOM + LEGEND_HEIGHT + 6;

const formatTS = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatShort = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
};

const accentColors = {
  cyan: { main: '#06b6d4', band: 'rgba(6,182,212,0.15)' },
  emerald: { main: '#10b981', band: 'rgba(16,185,129,0.15)' },
  amber: { main: '#f59e0b', band: 'rgba(245,158,11,0.15)' },
  violet: { main: '#8b5cf6', band: 'rgba(139,92,246,0.15)' },
};

const ForecastChart = ({ data, loading, accent = 'cyan', chartHeight = 400, horizon = '1d' }) => {
  const c = accentColors[accent] || accentColors.cyan;

  const splitIndex = useMemo(() => data.findIndex(d => d.forecasted !== null), [data]);

  const defaultZoom = useMemo(() => {
    if (splitIndex < 0 || !data.length) return {};
    const histWindow = HISTORY_WINDOW[horizon] || 144;
    const fcSteps = HORIZON_STEPS[horizon] || 144;
    return {
      startValue: Math.max(0, splitIndex - histWindow),
      endValue: Math.min(data.length - 1, splitIndex + fcSteps),
    };
  }, [data.length, splitIndex, horizon]);

  const option = useMemo(() => {
    if (!data || data.length === 0) return {};

    try {
      const timestamps = data.map(d => d.timestamp);
      const actualValues = data.map(d => d.actual ?? null);
      const prevForecastValues = data.map(d => d.prevForecast ?? null);
      const forecastValues = data.map(d => d.forecasted ?? null);
      const upperValues = data.map(d => d.confidenceUpper ?? null);
      const lowerValues = data.map(d => d.confidenceLower ?? null);

      const series = [
        {
          name: 'Actual',
          type: 'line',
          data: actualValues,
          lineStyle: { color: '#000000', width: 1 },
          showSymbol: false,
          connectNulls: false,
          smooth: true,
          smoothMonotone: 'x',
          z: 3,
        },
        {
          name: 'Previous Forecast',
          type: 'line',
          data: prevForecastValues,
          lineStyle: { color: '#3b82f6', width: 2 },
          showSymbol: false,
          connectNulls: false,
          smooth: true,
          smoothMonotone: 'x',
          z: 2,
        },
        {
          name: 'Forecast',
          type: 'line',
          data: forecastValues,
          lineStyle: { color: c.main, width: 2, type: 'dashed' },
          showSymbol: false,
          connectNulls: false,
          smooth: true,
          smoothMonotone: 'x',
          z: 4,
        },
      ];

      if (upperValues.some(v => v != null) && lowerValues.some(v => v != null)) {
        const bandData = upperValues.map((u, i) => {
          const l = lowerValues[i];
          if (u == null || l == null) return null;
          return u - l;
        });
        series.push({
          name: 'Confidence Lower',
          type: 'line',
          data: lowerValues,
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

      const out = {
        animationDuration: 400,
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
                <span style="font-family:JetBrains Mono,monospace;font-weight:700;color:#e2e8f0">${Number(p.value).toFixed(1)} MW</span>
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
          selected: { 'Confidence Lower': false, 'Confidence Band': false },
        },
        grid: {
          left: 8,
          right: 8,
          top: 12,
          bottom: GRID_BOTTOM,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: timestamps,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#64748b',
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
            rotate: 35,
            margin: 8,
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          name: 'MW',
          nameTextStyle: { color: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
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
            minSpan: 5,
            ...defaultZoom,
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
            labelFormatter: (v) => {
              const idx = Math.round(v);
              return data[idx] ? formatShort(data[idx].timestamp) : String(v);
            },
            minSpan: 5,
            ...defaultZoom,
          },
        ],
        series,
      };

      if (splitIndex >= 0 && data[splitIndex]) {
        out.series = series.map(s => {
          if (s.name === 'Forecast') {
            return {
              ...s,
              markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: { color: '#f43f5e', width: 1.5, type: 'dashed' },
                label: {
                  formatter: 'Forecast Start',
                  color: '#f43f5e',
                  fontSize: 9,
                  fontFamily: 'JetBrains Mono, monospace',
                  position: 'start',
                },
                data: [{ xAxis: data[splitIndex].timestamp }],
              },
            };
          }
          return s;
        });
      }

      return out;
    } catch (e) {
      console.error('Chart option error:', e);
      return {};
    }
  }, [data, c, splitIndex]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-surface-card/40 border border-surface-border/30 p-4" style={{ height: chartHeight + 80 }}>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-10 h-10 mx-auto">
              <div className="absolute inset-0 border-2 border-accent-cyan/30 rounded-full" />
              <div className="absolute inset-0 border-2 border-transparent border-t-accent-cyan rounded-full animate-spin" />
            </div>
            <p className="mt-4 text-xs text-ink-muted font-medium">Loading forecast data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-card/40 border border-surface-border/30 p-4" style={{ height: chartHeight + 80 }}>
        <div className="h-full flex items-center justify-center">
          <p className="text-xs text-ink-muted">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-card/40 border border-surface-border/30 p-4 overflow-hidden">
      <div style={{ height: chartHeight + 80 }}>
        <ReactECharts
          option={option}
          notMerge={false}
          lazyUpdate
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};

export default ForecastChart;
