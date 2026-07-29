import { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import ForecastChart from './components/ForecastChart';
import ErrorBoundary from './components/ErrorBoundary';
import HorizonSelector from './components/HorizonSelector';
import { TrendingUp, TrendingDown, PlayCircle, ChevronDown, ChevronRight } from 'lucide-react';

const WS_BASE = 'ws://localhost:8001';

function App() {
  const [horizon, setHorizon] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [allHistorical, setAllHistorical] = useState([]);
  const [prevForecasts, setPrevForecasts] = useState([]);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [cacheStatus, setCacheStatus] = useState(null);
  const [foumTiziOpen, setFoumTiziOpen] = useState(true);
  const wsRef = useRef(null);
  // Refs to avoid stale closures in WebSocket handler
  const forecastDataRef = useRef(null);

  // Check cache status when horizon changes
  useEffect(() => {
    const checkCache = async () => {
      try {
        const response = await fetch(`http://localhost:8001/api/cache/status/${horizon}`);
        const data = await response.json();
        setCacheStatus(data);
      } catch (err) {
        console.error('Failed to check cache:', err);
      }
    };
    checkCache();
  }, [horizon]);

  // Fetch and show cached forecasts on mount / horizon change
  useEffect(() => {
    const loadCached = async () => {
      try {
        const response = await fetch(`http://localhost:8001/api/cache/forecasts/${horizon}`);
        const data = await response.json();
        if (data.forecasts && data.forecasts.length > 0) {
          const histMap = new Map();
          const prevForecasts = [];

          for (let i = 0; i < data.forecasts.length; i++) {
            const fc = data.forecasts[i];
            if (fc.historical) {
              fc.historical.forEach(h => {
                if (h.actual != null) histMap.set(h.timestamp, h);
              });
            }
            if (i < data.forecasts.length - 1) {
              if (fc.forecast) prevForecasts.push(fc.forecast);
            }
          }

          const last = data.forecasts[data.forecasts.length - 1];

          setAllHistorical(Array.from(histMap.values()));
          setPrevForecasts(prevForecasts);
          setForecastData({
            horizon: horizon,
            horizon_index: last.horizon_index,
            forecast_start: last.forecast_start,
            forecast_end: last.forecast_end,
            historical: last.historical,
            forecast: last.forecast,
            stats: last.stats
          });
        }
      } catch (err) {
        console.error('Failed to load cached forecasts:', err);
      }
    };
    loadCached();
  }, [horizon]);

  const startForecast = () => {
    if (streaming) return;
    
    // Only set loading if there's no cached data to show
    if (!cacheStatus?.can_resume) {
      setLoading(true);
    }
    
    setStreaming(true);
    setError(null);
    
    // Always clear so WebSocket replay is the sole source of truth
    setForecastData(null);
    forecastDataRef.current = null;
    setAllHistorical([]);
    setPrevForecasts([]);
    setProgress({ current: 0, total: 0 });
    
    const ws = new WebSocket(`${WS_BASE}/ws/forecast/${horizon}`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
        return;
      }
      
      if (data.type === 'init') {
        setProgress({ current: data.resume_from || 0, total: data.max_horizons });
        setLoading(false);
      } else if (data.type === 'horizon_update') {
        setProgress(prev => ({ ...prev, current: data.horizon_index + 1 }));
        
        const newData = {
          horizon: horizon,
          horizon_index: data.horizon_index,
          forecast_start: data.forecast_start,
          forecast_end: data.forecast_end,
          historical: data.historical,
          forecast: data.forecast,
          stats: data.stats
        };
        
        // Accumulate previous horizon's data if we have one
        const lastForecastData = forecastDataRef.current;
        if (lastForecastData) {
          setAllHistorical(prev => {
            const existing = new Map(prev.map(d => [d.timestamp, d]));
            lastForecastData.historical.forEach(d => {
              if (!existing.has(d.timestamp)) existing.set(d.timestamp, d);
            });
            return Array.from(existing.values())
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          });
          setPrevForecasts(prev => [...prev, lastForecastData.forecast]);
        }
        setForecastData(newData);
        // Sync ref immediately so the next message sees the updated value
        forecastDataRef.current = newData;
      } else if (data.type === 'complete') {
        setStreaming(false);
        console.log('Forecasting complete');
      } else if (data.type === 'error') {
        setError(data.message);
        setStreaming(false);
        setLoading(false);
      }
    };
    
    ws.onerror = () => {
      setError('WebSocket error');
      setStreaming(false);
      setLoading(false);
    };
    
    ws.onclose = () => {
      setStreaming(false);
      setLoading(false);
    };
  };

  const stopForecast = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStreaming(false);
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Sync ref with latest forecastData to avoid stale closures in WebSocket handler
  useEffect(() => {
    forecastDataRef.current = forecastData;
  }, [forecastData]);

  // Merge actual + previous forecasts + current forecast into one dataset
  const chartData = forecastData ? (() => {
    const dataMap = new Map();

    // 1. Accumulated historical actual values
    allHistorical.forEach(d => {
      if (d.actual != null) {
        dataMap.set(d.timestamp, { ...(dataMap.get(d.timestamp) || {}), timestamp: d.timestamp, actual: d.actual });
      }
    });

    // 2. Current window's historical actual values (any not yet accumulated)
    forecastData.historical.forEach(d => {
      if (d.actual != null && !dataMap.has(d.timestamp)) {
        dataMap.set(d.timestamp, { timestamp: d.timestamp, actual: d.actual });
      }
    });

    // 3. Previous forecasts
    prevForecasts.forEach(segment => {
      segment.forEach(d => {
        const entry = dataMap.get(d.timestamp) || { timestamp: d.timestamp };
        entry.prevForecast = d.forecasted;
        dataMap.set(d.timestamp, entry);
      });
    });

    // 4. Current forecast
    forecastData.forecast.forEach(d => {
      const entry = dataMap.get(d.timestamp) || { timestamp: d.timestamp };
      entry.forecasted = d.forecasted;
      entry.confidenceUpper = d.forecasted * 1.05;
      entry.confidenceLower = d.forecasted * 0.95;
      dataMap.set(d.timestamp, entry);
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
  const meanForecast = stats.mean_forecast || 0;

  const mae = useMemo(() => {
    const errors = [];
    for (const d of chartData) {
      if (d.actual != null && d.prevForecast != null) {
        errors.push(Math.abs(d.actual - d.prevForecast));
      }
    }
    if (!errors.length) return null;
    return errors.reduce((a, b) => a + b, 0) / errors.length;
  }, [chartData]);

  const trend = useMemo(() => {
    const points = chartData.filter(d => d.forecasted != null);
    if (points.length < 4) return null;
    const half = Math.floor(points.length / 2);
    const sum = (arr, key) => arr.reduce((s, d) => s + d[key], 0);
    const firstAvg = sum(points.slice(0, half), 'forecasted') / half;
    const lastAvg = sum(points.slice(-half), 'forecasted') / half;
    const diff = lastAvg - firstAvg;
    const mean = (firstAvg + lastAvg) / 2;
    return Math.abs(diff) / mean > 0.01
      ? diff > 0 ? 'increasing' : 'decreasing'
      : 'stable';
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

  const horizonLabel = {
    '1h': '1 Hour',
    '1d': '1 Day',
    '3d': '3 Days',
    '1w': '1 Week',
    '1m': '1 Month',
  }[horizon] || horizon.toUpperCase();

  const intervalLabel = dataInterval
    ? `${dataInterval.value} ${dataInterval.unit}`
    : '—';

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-ambient-cyan" />
        <div className="absolute inset-0 bg-ambient-emerald" />
        <div className="absolute inset-0 bg-ambient-amber" />
      </div>

      <Header />

      <main className="relative z-10 max-w-[1600px] mx-auto px-4 md:px-6 pb-8">
        <div className="py-6 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="animate-fade-in bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-sm text-red-400">Error: {error}</p>
              <p className="text-xs text-ink-muted mt-1">Make sure backend is running on port 8001</p>
            </div>
          )}

          {/* Foum Tizi Section */}
          <div>
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setFoumTiziOpen(!foumTiziOpen)}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1 rounded-lg transition-all duration-300 ${foumTiziOpen ? 'bg-accent-cyan/10' : 'bg-surface-hover/30'}`}>
                  {foumTiziOpen ? (
                    <ChevronDown className="w-4 h-4 text-accent-cyan transition-transform duration-300" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-ink-muted transition-transform duration-300" />
                  )}
                </div>
                <div className="inline-block">
                  <h2 className="text-base font-heading font-bold text-ink">Foum Tizi Energy Forecast</h2>
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

            {foumTiziOpen && (
              <div className="mt-5 space-y-5">
                {/* Chart and Metrics Grid - 80/20 split */}
                <div className="flex gap-4 items-stretch">
                  {/* Chart Area - 80% */}
                  <div className="flex-[80] min-h-0">
                    <ErrorBoundary>
                      <ForecastChart
                        data={chartData}
                        loading={loading && !cacheStatus?.can_resume}
                        accent="cyan"
                        chartHeight={320}
                        horizon={horizon}
                        toolbarLeft={
                          <HorizonSelector
                            selectedHorizon={horizon}
                            onHorizonChange={setHorizon}
                            loading={streaming}
                          />
                        }
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
                                    await fetch(`http://localhost:8001/api/cache/clear/${horizon}`, { method: 'POST' });
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

                  {/* Forecast Metrics Panel - 20% */}
                  <div className="flex-[20]">
                    <div className="rounded-xl bg-surface-card/70 shadow-card h-full flex flex-col">
                      {/* Header */}
                      <div className="px-4 py-2.5 border-b border-surface-border/30">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-accent-cyan flex-shrink-0" />
                          <h3 className="text-base font-bold text-ink tracking-tight">Metrics</h3>
                        </div>
                      </div>
                      
                      {/* Metrics List */}
                      <div className="flex-1 px-3 py-5 flex flex-col justify-center space-y-3 overflow-y-auto">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-ink-muted font-medium">Average</span>
                          <span className="text-xs font-bold font-mono-num text-ink">{stats.mean_forecast != null ? `${stats.mean_forecast.toFixed(1)} MW` : '—'}</span>
                        </div>
                        
                        <div className="h-px bg-surface-border/20"></div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-ink-muted font-medium">Maximum</span>
                          <span className="text-xs font-bold font-mono-num text-accent-emerald">{stats.max_forecast != null ? `${stats.max_forecast.toFixed(1)} MW` : '—'}</span>
                        </div>
                        
                        <div className="h-px bg-surface-border/20"></div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-ink-muted font-medium">Minimum</span>
                          <span className="text-xs font-bold font-mono-num text-accent-violet">{stats.min_forecast != null ? `${stats.min_forecast.toFixed(1)} MW` : '—'}</span>
                        </div>
                        
                        <div className="h-px bg-surface-border/20"></div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-ink-muted font-medium">Range</span>
                          <span className="text-xs font-bold font-mono-num text-ink">{
                            stats.max_forecast != null && stats.min_forecast != null
                              ? `${(stats.max_forecast - stats.min_forecast).toFixed(1)} MW`
                              : '—'
                          }</span>
                        </div>
                        
                        <div className="h-px bg-surface-border/20"></div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-ink-muted font-medium">Std Dev</span>
                          <span className="text-xs font-bold font-mono-num text-ink">
                            {stats.std_forecast != null ? `${stats.std_forecast.toFixed(1)} MW` : '—'}
                          </span>
                        </div>
                        
                        <div className="h-px bg-surface-border/20"></div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-ink-muted font-medium">MAPE</span>
                          <span className="text-xs font-bold font-mono-num text-accent-amber">
                            {stats.mape != null ? `${stats.mape.toFixed(2)}%` : '—'}
                          </span>
                        </div>
                        
                        <div className="h-px bg-surface-border/20"></div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-ink-muted font-medium">MAE</span>
                          <span className="text-xs font-bold font-mono-num text-ink">
                            {mae != null ? `${mae.toFixed(0)} kW` : '—'}
                          </span>
                        </div>
                        
                        <div className="h-px bg-surface-border/20"></div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-ink-muted font-medium">Trend</span>
                          <span className="text-xs font-bold font-mono-num flex items-center gap-1">
                            {trend === 'increasing' ? (
                              <><TrendingUp className="w-3.5 h-3.5 text-accent-emerald" /><span className="text-accent-emerald">Increasing</span></>
                            ) : trend === 'decreasing' ? (
                              <><TrendingDown className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">Decreasing</span></>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Footer - Period Info */}
                      {forecastData && (
                        <div className="px-3 py-1.5 border-t border-surface-border/20 space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-ink-muted font-medium">Start</span>
                            <span className="text-[11px] font-mono-num text-ink">
                              {new Date(forecastData.forecast_start).toLocaleString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-ink-muted font-medium">End</span>
                            <span className="text-[11px] font-mono-num text-ink">
                              {new Date(forecastData.forecast_end).toLocaleString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                      )}
                    
                    </div>
                  </div>
                </div>

                 {/* Info Section */}
                {forecastData && (
                  <div className="animate-fade-in bg-surface-card/50 shadow-card rounded-xl p-4">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs">
                      <div>
                        <p className="text-ink-muted mb-1">Model</p>
                        <p className="text-ink font-semibold">XGBoost</p>
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
        </div>

        <footer className="relative mt-8 pt-6 border-t border-surface-border/40 text-center">
          <p className="text-[10px] text-ink-muted font-medium tracking-wide">
            SmartEMS &copy; {new Date().getFullYear()} &mdash; Powered by XGBoost &mdash; Real-time Streaming
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
