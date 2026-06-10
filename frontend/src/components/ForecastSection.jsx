import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, MapPin, Zap, Activity, TrendingUp, TrendingDown, BarChart3, Database, Target, ChevronRight } from 'lucide-react';
import MetricCard from './MetricCard';
import HorizonSelector from './HorizonSelector';
import ForecastChart from './ForecastChart';
import { generateEnergyData, calculateMetrics } from '../utils/mockData';

const iconMap = {
  Activity, TrendingUp, TrendingDown, BarChart3, Database, Target,
};

const CHART_HEIGHT = 260;

const ForecastSection = ({ site, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedHorizon, setSelectedHorizon] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState({});

  const loadForecastData = useCallback(async (horizon) => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    const newData = generateEnergyData(7, horizon, site.id);
    const newMetrics = calculateMetrics(newData, site.id);
    setData(newData);
    setMetrics(newMetrics);
    setLoading(false);
  }, [site.id]);

  useEffect(() => { loadForecastData('1d'); }, [loadForecastData]); // eslint-disable-line react-hooks/set-state-in-effect

  const typeColors = {
    Solar: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
    Wind: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20',
    Hydro: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20',
    Mixed: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20',
  };

  const metricCards = [
    { icon: 'Activity', label: 'Current', value: metrics.currentConsumption, unit: 'MW' },
    { icon: 'BarChart3', label: 'Avg Forecast', value: metrics.forecastedConsumption, unit: 'MW' },
    { icon: 'TrendingDown', label: 'Min', value: metrics.minForecast, unit: 'MW' },
    { icon: 'TrendingUp', label: 'Max', value: metrics.maxForecast, unit: 'MW' },
    {
      icon: 'Target',
      label: 'Accuracy',
      value: metrics.accuracy,
      unit: '%',
      trend: { direction: metrics.trend || 'up', value: `${metrics.trendValue || '0'}%` },
    },
    { icon: 'Database', label: 'Points', value: metrics.dataPoints, unit: 'hrs' },
  ];

  const containerPadding = 32;
  const metricsHeight = CHART_HEIGHT + containerPadding;

  return (
    <div
      className={`glass-panel-hover overflow-hidden transition-all duration-500
        ${isExpanded ? 'ring-1 ring-accent-cyan/20' : ''}`}
    >
      <div
        className="flex items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button
            className={`p-1.5 rounded-lg transition-all duration-300 hover:bg-surface-hover/50
              ${isExpanded ? 'text-accent-cyan' : 'text-ink-muted'}`}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isExpanded ? 'bg-accent-emerald' : 'bg-ink-muted'}`}>
              {isExpanded && (
                <div className="w-2 h-2 bg-accent-emerald rounded-full animate-ping opacity-75" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-heading font-bold text-ink">{site.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                  <MapPin className="w-3 h-3" />
                  {site.location}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                  <Zap className="w-3 h-3" />
                  {site.capacity}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${typeColors[site.type] || ''}`}>
                  {site.type}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
      >
        <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center justify-between pt-2 border-t border-surface-border/40">
            <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-widest">
              Forecast Horizon
            </span>
            <HorizonSelector
              selected={selectedHorizon}
              onChange={(h) => { setSelectedHorizon(h); loadForecastData(h); }}
              loading={loading}
            />
          </div>

          <div className="flex flex-col xl:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <ForecastChart data={data} loading={loading} accent={site.accent} chartHeight={CHART_HEIGHT} />
            </div>

            <div
              className="grid grid-cols-3 xl:grid-cols-1 gap-1.5 xl:w-56 shrink-0"
              style={{ height: metricsHeight }}
            >
              {metricCards.map((mc) => (
                <MetricCard
                  key={mc.label}
                  icon={iconMap[mc.icon]}
                  label={mc.label}
                  value={mc.value ?? '--'}
                  unit={mc.unit}
                  trend={mc.trend}
                  accent={site.accent}
                  compact={true}
                  className="animate-fade-in"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastSection;
