import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ForecastChart from './components/ForecastChart';
import ErrorBoundary from './components/ErrorBoundary';
import HorizonSelector from './components/HorizonSelector';
import MetricCard from './components/MetricCard';
import { Zap, TrendingUp, Calendar, PlayCircle } from 'lucide-react';

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

  const startForecast = () => {
    if (streaming) return;
    
    // Only set loading if there's no cached data to show
    if (!cacheStatus?.can_resume) {
      setLoading(true);
    }
    
    setStreaming(true);
    setError(null);
    
    // Don't reset forecast data if resuming
    if (!cacheStatus?.can_resume) {
      setForecastData(null);
      setAllHistorical([]);
      setPrevForecasts([]);
      setProgress({ current: 0, total: 0 });
    }
    
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

  return (
    <div className="min-h-screen bg-surface bg-grid overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-ambient-cyan" />
        <div className="absolute inset-0 bg-ambient-emerald" />
        <div className="absolute inset-0 bg-ambient-amber" />
      </div>

      <Header />

      <main className="relative z-10 max-w-[1600px] mx-auto px-4 md:px-6 pb-8">
        <div className="py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              {/* <div className="p-2 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20">
                <Activity className="w-5 h-5 text-accent-cyan" />
              </div> */}
              <div>
                <h2 className="text-xl font-heading font-bold text-ink">Foum Tizi Energy Forecast</h2>
                <p className="text-xs text-ink-muted">
                  XGBoost real-time streaming • 10-min intervals
                </p>
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

          {/* Error Display */}
          {error && (
            <div className="animate-fade-in bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-sm text-red-400">Error: {error}</p>
              <p className="text-xs text-ink-muted mt-1">Make sure backend is running on port 8001</p>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <MetricCard
              icon={Zap}
              label="Horizon"
              value={horizon.toUpperCase()}
              accent="cyan"
            />
            <MetricCard
              icon={TrendingUp}
              label="Current Mean"
              value={meanForecast.toFixed(1)}
              unit="MW"
              accent="emerald"
            />
            <MetricCard
              icon={Calendar}
              label="Progress"
              value={progress.total > 0 ? `${progress.current}/${progress.total}` : '—'}
              accent="violet"
            />
            <MetricCard
              icon={PlayCircle}
              label="Status"
              value={streaming ? 'Live' : forecastData ? 'Done' : 'Ready'}
              accent={streaming ? 'amber' : forecastData ? 'emerald' : 'cyan'}
            />
          </div>

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
                  emptyMessage={
                    <div className="text-center">
                      <PlayCircle className="w-12 h-12 text-ink-muted/50 mx-auto mb-3" />
                      <p className="text-sm text-ink-muted">Select a horizon and click "Start Forecast"</p>
                    </div>
                  }
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
              {forecastData ? (
                <div className="rounded-xl bg-surface-card/60 border border-surface-border/30 h-full flex flex-col">
                  {/* Header */}
                  <div className="px-3 py-3 border-b border-surface-border/20">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-accent-cyan flex-shrink-0" />
                      <h3 className="text-xs font-bold text-ink">Metrics</h3>
                    </div>
                    <span className="text-[10px] font-mono-num text-ink-muted">
                      {horizon.toUpperCase()} #{forecastData.horizon_index + 1}
                    </span>
                  </div>
                  
                  {/* Metrics List */}
                  <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-ink-muted">Average</span>
                      <span className="text-xs font-bold font-mono-num text-ink">{stats.mean_forecast?.toFixed(1)} MW</span>
                    </div>
                    
                    <div className="h-px bg-surface-border/20"></div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-ink-muted">Maximum</span>
                      <span className="text-xs font-bold font-mono-num text-accent-emerald">{stats.max_forecast?.toFixed(1)} MW</span>
                    </div>
                    
                    <div className="h-px bg-surface-border/20"></div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-ink-muted">Minimum</span>
                      <span className="text-xs font-bold font-mono-num text-accent-violet">{stats.min_forecast?.toFixed(1)} MW</span>
                    </div>
                    
                    <div className="h-px bg-surface-border/20"></div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-ink-muted">Range</span>
                      <span className="text-xs font-bold font-mono-num text-ink">{(stats.max_forecast - stats.min_forecast)?.toFixed(1)} MW</span>
                    </div>
                    
                    <div className="h-px bg-surface-border/20"></div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-ink-muted">Std Dev</span>
                      <span className="text-xs font-bold font-mono-num text-ink">
                        {stats.std_forecast ? stats.std_forecast.toFixed(1) : '—'} MW
                      </span>
                    </div>
                    
                    <div className="h-px bg-surface-border/20"></div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-ink-muted">MAPE</span>
                      <span className="text-xs font-bold font-mono-num text-accent-amber">
                        {stats.mape ? stats.mape.toFixed(2) : '—'}%
                      </span>
                    </div>
                  </div>

                  {/* Footer - Period Info */}
                  <div className="px-3 py-3 border-t border-surface-border/20 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-ink-muted">Start</span>
                      <span className="text-[10px] font-mono-num text-ink">
                        {new Date(forecastData.forecast_start).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-ink-muted">End</span>
                      <span className="text-[10px] font-mono-num text-ink">
                        {new Date(forecastData.forecast_end).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-surface-card/60 border border-surface-border/30 h-full flex items-center justify-center p-4">
                  <p className="text-[10px] text-ink-muted text-center leading-relaxed">
                    Metrics will<br/>appear here<br/>once forecasting<br/>starts
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Info Section */}
          {forecastData && (
            <div className="animate-fade-in bg-surface-card/40 border border-surface-border/30 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-ink-muted mb-1">Horizon</p>
                  <p className="text-ink font-semibold">{horizon.toUpperCase()} #{forecastData.horizon_index + 1}</p>
                </div>
                <div>
                  <p className="text-ink-muted mb-1">Period Start</p>
                  <p className="text-ink font-semibold font-mono-num">
                    {new Date(forecastData.forecast_start).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-ink-muted mb-1">Period End</p>
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
