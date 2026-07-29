import { useState, useEffect, useRef, useMemo } from 'react';
import ForecastChart from './ForecastChart';
import ErrorBoundary from './ErrorBoundary';
import HorizonSelector from './HorizonSelector';
import { TrendingUp, PlayCircle, ChevronDown, ChevronRight } from 'lucide-react';

const WS_BASE = 'ws://localhost:8001';

const ForecastSite = ({ site, label, modelName = 'XGBoost', accent = 'cyan' }) => {
  const [open, setOpen] = useState(true);
  const [horizon, setHorizon] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [allHistorical, setAllHistorical] = useState([]);
  const [prevForecasts, setPrevForecasts] = useState([]);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [cacheStatus, setCacheStatus] = useState(null);
  const wsRef = useRef(null);
  const forecastDataRef = useRef(null);

  useEffect(() => {
    forecastDataRef.current = forecastData;
  }, [forecastData]);

  // Check cache status
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`http://localhost:8001/api/cache/status/${site}/${horizon}`);
        const d = await res.json();
        setCacheStatus(d);
      } catch { setCacheStatus(null); }
    };
    check();
  }, [site, horizon]);

  // Load cached forecasts on mount/horizon change
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`http://localhost:8001/api/cache/forecasts/${site}/${horizon}`);
        const d = await res.json();
        if (d.forecasts && d.forecasts.length > 0) {
          const histMap = new Map();
          const prevs = [];
          for (let i = 0; i < d.forecasts.length; i++) {
            const fc = d.forecasts[i];
            if (fc.historical) {
              fc.historical.forEach(h => { if (h.actual != null) histMap.set(h.timestamp, h); });
            }
            if (i < d.forecasts.length - 1 && fc.forecast) prevs.push(fc.forecast);
          }
          const last = d.forecasts[d.forecasts.length - 1];
          setAllHistorical(Array.from(histMap.values()));
          setPrevForecasts(prevs);
          setForecastData({
            horizon,
            horizon_index: last.horizon_index,
            forecast_start: last.forecast_start,
            forecast_end: last.forecast_end,
            historical: last.historical,
            forecast: last.forecast,
            stats: last.stats
          });
        }
      } catch {}
    };
    load();
  }, [site, horizon]);

  const startForecast = () => {
    if (streaming) return;
    if (!cacheStatus?.can_resume) setLoading(true);
    setStreaming(true);
    setError(null);
    setForecastData(null);
    forecastDataRef.current = null;
    setAllHistorical([]);
    setPrevForecasts([]);
    setProgress({ current: 0, total: 0 });

    const ws = new WebSocket(`${WS_BASE}/ws/forecast/${site}/${horizon}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }

      if (data.type === 'init') {
        setProgress({ current: data.resume_from || 0, total: data.max_horizons });
        setLoading(false);
      } else if (data.type === 'horizon_update') {
        setProgress(prev => ({ ...prev, current: data.horizon_index + 1 }));
        const newData = {
          horizon,
          horizon_index: data.horizon_index,
          forecast_start: data.forecast_start,
          forecast_end: data.forecast_end,
          historical: data.historical,
          forecast: data.forecast,
          stats: data.stats
        };
        const last = forecastDataRef.current;
        if (last) {
          setAllHistorical(prev => {
            const m = new Map(prev.map(d => [d.timestamp, d]));
            last.historical.forEach(d => { if (!m.has(d.timestamp)) m.set(d.timestamp, d); });
            return Array.from(m.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          });
          setPrevForecasts(prev => [...prev, last.forecast]);
        }
        setForecastData(newData);
        forecastDataRef.current = newData;
      } else if (data.type === 'complete') {
        setStreaming(false);
      } else if (data.type === 'error') {
        setError(data.message);
        setStreaming(false);
        setLoading(false);
      }
    };

    ws.onclose = () => { setStreaming(false); setLoading(false); };
    ws.onerror = () => { setError('WebSocket connection failed'); setStreaming(false); setLoading(false); };
  };

  const stopForecast = () => {
    wsRef.current?.close();
    setStreaming(false);
    setLoading(false);
  };

  // Merge chart data
  const chartData = forecastData ? (() => {
    const dataMap = new Map();
    allHistorical.forEach(d => {
      if (d.actual != null) dataMap.set(d.timestamp, { ...(dataMap.get(d.timestamp) || {}), timestamp: d.timestamp, actual: d.actual });
    });
    forecastData.historical.forEach(d => {
      if (d.actual != null && !dataMap.has(d.timestamp)) dataMap.set(d.timestamp, { timestamp: d.timestamp, actual: d.actual });
    });
    prevForecasts.forEach(seg => {
      seg.forEach(d => {
        const e = dataMap.get(d.timestamp) || { timestamp: d.timestamp };
        e.prevForecast = d.forecasted;
        dataMap.set(d.timestamp, e);
      });
    });
    forecastData.forecast.forEach(d => {
      const e = dataMap.get(d.timestamp) || { timestamp: d.timestamp };
      e.forecasted = d.forecasted;
      e.confidenceUpper = d.forecasted * 1.05;
      e.confidenceLower = d.forecasted * 0.95;
      dataMap.set(d.timestamp, e);
    });
    return Array.from(dataMap.values())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(d => ({
        timestamp: d.timestamp,
        actual: d.actual ?? null,
        prevForecast: d.prevForecast ?? null,
        forecasted: d.forecasted ?? null,
        confidenceUpper: d.confidenceUpper ?? null,
        confidenceLower: d.confidenceLower ?? null,
      }));
  })() : [];

  const stats = forecastData?.stats || {};

  const mae = useMemo(() => {
    const errs = [];
    for (const d of chartData) {
      if (d.actual != null && d.prevForecast != null) errs.push(Math.abs(d.actual - d.prevForecast));
    }
    if (!errs.length) return null;
    return errs.reduce((a, b) => a + b, 0) / errs.length;
  }, [chartData]);

  const trend = useMemo(() => {
    const pts = chartData.filter(d => d.forecasted != null);
    if (pts.length < 4) return null;
    const half = Math.floor(pts.length / 2);
    const sum = (arr, key) => arr.reduce((s, d) => s + d[key], 0);
    const firstAvg = sum(pts.slice(0, half), 'forecasted') / half;
    const lastAvg = sum(pts.slice(-half), 'forecasted') / half;
    const diff = lastAvg - firstAvg;
    const mean = (firstAvg + lastAvg) / 2;
    return Math.abs(diff) / mean > 0.01 ? (diff > 0 ? 'increasing' : 'decreasing') : 'stable';
  }, [chartData]);

  const dataInterval = useMemo(() => {
    if (chartData.length < 2) return null;
    const ts1 = new Date(chartData[0].timestamp).getTime();
    const ts2 = new Date(chartData[1].timestamp).getTime();
    const diffMin = Math.abs(ts2 - ts1) / 60000;
    if (diffMin < 1) return { value: Math.round(diffMin * 60), unit: 'seconds' };
    if (diffMin >= 1440) return { value: Math.round(diffMin / 1440), unit: 'days' };
    if (diffMin >= 60) return { value: Math.round(diffMin / 60), unit: 'hours' };
    return { value: Math.round(diffMin), unit: 'minutes' };
  }, [chartData]);

  const horizonLabel = { '1h': '1 Hour', '1d': '1 Day', '3d': '3 Days', '1w': '1 Week', '1m': '1 Month' }[horizon] || horizon.toUpperCase();
  const intervalLabel = dataInterval ? `${dataInterval.value} ${dataInterval.unit}` : '—';

  return (
    <div>
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <div className="p-1 rounded-lg transition-all duration-300">
                {open ? (
                  <ChevronDown className="w-4 h-4 text-accent-cyan transition-transform duration-300" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-ink-muted transition-transform duration-300" />
                )}
              </div>
              <h2 className="text-base font-heading font-bold text-ink">{label}</h2>
            </div>
            <div className="mt-1.5 h-0.5 rounded-full bg-accent-emerald" style={{ width: 'calc(100% + 20px)' }} />
          </div>
        </div>
        {streaming && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-cyan/10 border border-accent-cyan/20 rounded-lg">
            <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-accent-cyan">
              Forecasting {progress.current}/{progress.total}
            </span>
          </div>
        )}
      </div>

      {open && (
        <div className="mt-5 space-y-5">
          {error && (
            <div className="animate-fade-in bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-sm text-red-400">Error: {error}</p>
            </div>
          )}

          {/* Chart and Metrics Grid - 80/20 split */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            <div className="w-full lg:flex-[80] min-h-0">
              <ErrorBoundary>
                <ForecastChart
                  data={chartData}
                  loading={loading && !cacheStatus?.can_resume}
                  accent={accent}
                  chartHeight={320}
                  horizon={horizon}
                  toolbarLeft={<HorizonSelector selectedHorizon={horizon} onHorizonChange={setHorizon} loading={streaming} />}
                  toolbarCenter={
                    !streaming ? (
                      <>
                        <button
                          onClick={startForecast}
                          disabled={loading}
                          className="px-4 py-1.5 rounded-lg bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/30 text-accent-cyan font-semibold text-xs transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          {cacheStatus?.can_resume ? 'Resume' : 'Start'}
                        </button>
                        {cacheStatus?.can_resume && (
                          <button
                            onClick={async () => {
                              await fetch(`http://localhost:8001/api/cache/clear/${site}/${horizon}`, { method: 'POST' });
                              setCacheStatus({ ...cacheStatus, can_resume: false, cached_count: 0 });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-surface-hover/50 hover:bg-surface-hover border border-surface-border/40 text-ink-muted hover:text-ink font-semibold text-xs transition-all duration-200"
                          >
                            Clear
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={stopForecast}
                        className="px-4 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-semibold text-xs transition-all duration-200"
                      >
                        Stop
                      </button>
                    )
                  }
                />
              </ErrorBoundary>
            </div>

            <div className="w-full lg:flex-[20] lg:min-w-[200px]">
              <div className="rounded-xl bg-surface-card/70 shadow-card dark:border dark:border-surface-border/10 h-full flex flex-col">
                <div className="px-4 py-2.5 border-b border-surface-border/30">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent-cyan flex-shrink-0" />
                    <h3 className="text-base font-bold text-ink tracking-tight">Metrics</h3>
                  </div>
                </div>

                <div className="flex-1 px-3 py-5 flex flex-col justify-center space-y-3 overflow-y-auto">
                  {[
                    { label: 'Average', value: stats.mean_forecast != null ? `${stats.mean_forecast.toFixed(1)} MW` : '—', cls: 'text-ink' },
                    { label: 'Maximum', value: stats.max_forecast != null ? `${stats.max_forecast.toFixed(1)} MW` : '—', cls: 'text-accent-emerald' },
                    { label: 'Minimum', value: stats.min_forecast != null ? `${stats.min_forecast.toFixed(1)} MW` : '—', cls: 'text-accent-violet' },
                    { label: 'Range', value: stats.max_forecast != null && stats.min_forecast != null ? `${(stats.max_forecast - stats.min_forecast).toFixed(1)} MW` : '—', cls: 'text-ink' },
                    { label: 'Std Dev', value: stats.std_forecast != null ? `${stats.std_forecast.toFixed(1)} MW` : '—', cls: 'text-ink' },
                    { label: 'Trend', value: trend === 'increasing' ? '↗ Increasing' : trend === 'decreasing' ? '↘ Decreasing' : '—', cls: trend === 'increasing' ? 'text-accent-emerald' : trend === 'decreasing' ? 'text-red-400' : 'text-ink-muted' },
                    { label: 'MAE', value: mae != null ? `${mae.toFixed(0)} kW` : '—', cls: 'text-ink' },
                    { label: 'MAPE', value: stats.mape != null ? `${stats.mape.toFixed(2)}%` : '—', cls: 'text-accent-amber', mono: true },
                  ].map((m, i) => (
                    <div key={m.label}>
                      {i > 0 && <div className="h-px bg-surface-border/20 mb-3" />}
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-ink-muted font-medium">{m.label}</span>
                        <span className={`text-xs font-bold font-mono-num ${m.cls}`}>{m.value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {forecastData && (
                  <div className="px-3 py-1.5 border-t border-surface-border/20 space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-ink-muted font-medium">Start</span>
                      <span className="text-[11px] font-mono-num text-ink">
                        {new Date(forecastData.forecast_start).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-ink-muted font-medium">End</span>
                      <span className="text-[11px] font-mono-num text-ink">
                        {new Date(forecastData.forecast_end).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info Section */}
          {forecastData && (
            <div className="animate-fade-in bg-surface-card/50 shadow-card dark:border dark:border-surface-border/10 rounded-xl p-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs">
                <div>
                  <p className="text-ink-muted mb-1">Model</p>
                  <p className="text-ink font-semibold">{modelName}</p>
                </div>
                <div>
                  <p className="text-ink-muted mb-1">Horizon</p>
                  <p className="text-ink font-semibold">{horizonLabel}</p>
                </div>
                <div>
                  <p className="text-ink-muted mb-1">Interval</p>
                  <p className="text-ink font-semibold font-mono-num">{intervalLabel}</p>
                </div>
                <div>
                  <p className="text-ink-muted mb-1">Forecast Start</p>
                  <p className="text-ink font-semibold font-mono-num">
                    {new Date(forecastData.forecast_start).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-ink-muted mb-1">Forecast End</p>
                  <p className="text-ink font-semibold font-mono-num">
                    {new Date(forecastData.forecast_end).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-ink-muted mb-1">Forecast Range</p>
                  <p className="text-ink font-semibold">{stats.min_forecast?.toFixed(1)} - {stats.max_forecast?.toFixed(1)} MW</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ForecastSite;
