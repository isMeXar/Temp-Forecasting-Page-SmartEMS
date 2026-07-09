import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ForecastChart from './components/ForecastChart';
import HorizonSelector from './components/HorizonSelector';
import MetricCard from './components/MetricCard';
import { Activity, Zap, TrendingUp, TrendingDown, Calendar, PlayCircle } from 'lucide-react';

const WS_BASE = 'ws://localhost:8001';

function App() {
  const [horizon, setHorizon] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const wsRef = useRef(null);

  const startForecast = () => {
    if (streaming) return;
    
    setLoading(true);
    setStreaming(true);
    setError(null);
    setForecastData(null);
    setProgress({ current: 0, total: 0 });
    
    const ws = new WebSocket(`${WS_BASE}/ws/forecast/${horizon}`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'init') {
        setProgress({ current: 0, total: data.max_horizons });
        setLoading(false);
      } else if (data.type === 'horizon_update') {
        setProgress(prev => ({ ...prev, current: data.horizon_index + 1 }));
        setForecastData({
          horizon: horizon,
          horizon_index: data.horizon_index,
          forecast_start: data.forecast_start,
          forecast_end: data.forecast_end,
          historical: data.historical,
          forecast: data.forecast,
          stats: data.stats
        });
      } else if (data.type === 'complete') {
        setStreaming(false);
        console.log('Forecasting complete');
      } else if (data.type === 'error') {
        setError(data.message);
        setStreaming(false);
        setLoading(false);
      }
    };
    
    ws.onerror = (error) => {
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

  // Prepare chart data
  const chartData = forecastData ? [
    ...forecastData.historical.map(d => ({
      timestamp: d.timestamp,
      actual: d.actual,
      forecasted: null,
      confidenceUpper: null,
      confidenceLower: null,
      isHistorical: true
    })),
    ...forecastData.forecast.map(d => ({
      timestamp: d.timestamp,
      actual: d.actual,
      forecasted: d.forecasted,
      confidenceUpper: d.forecasted * 1.05,
      confidenceLower: d.forecasted * 0.95,
      isHistorical: false
    }))
  ] : [];

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
              <div className="p-2 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20">
                <Activity className="w-5 h-5 text-accent-cyan" />
              </div>
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

          {/* Horizon Selector + Start Button */}
          <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <HorizonSelector
              selectedHorizon={horizon}
              onHorizonChange={setHorizon}
              loading={streaming}
            />
            
            {!streaming ? (
              <button
                onClick={startForecast}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/30 text-accent-cyan font-semibold text-sm transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
              >
                <PlayCircle className="w-4 h-4" />
                Start Forecast
              </button>
            ) : (
              <button
                onClick={stopForecast}
                className="px-6 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-semibold text-sm transition-all duration-200"
              >
                Stop
              </button>
            )}
          </div>

          {/* Chart */}
          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {loading ? (
              <div className="rounded-2xl bg-surface-card/40 border border-surface-border/30 p-4 h-[450px] flex items-center justify-center">
                <div className="text-center">
                  <div className="relative w-10 h-10 mx-auto mb-4">
                    <div className="absolute inset-0 border-2 border-accent-cyan/30 rounded-full" />
                    <div className="absolute inset-0 border-2 border-transparent border-t-accent-cyan rounded-full animate-spin" />
                  </div>
                  <p className="text-sm text-ink-muted">Initializing forecast...</p>
                </div>
              </div>
            ) : forecastData ? (
              <ForecastChart
                data={chartData}
                loading={false}
                accent="cyan"
                chartHeight={400}
              />
            ) : (
              <div className="rounded-2xl bg-surface-card/40 border border-surface-border/30 p-4 h-[450px] flex items-center justify-center">
                <div className="text-center">
                  <PlayCircle className="w-12 h-12 text-ink-muted/50 mx-auto mb-3" />
                  <p className="text-sm text-ink-muted">Select a horizon and click "Start Forecast"</p>
                </div>
              </div>
            )}
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
