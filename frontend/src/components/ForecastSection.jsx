import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, MapPin, Zap, TrendingUp, Target } from 'lucide-react';
import MetricCard from './MetricCard';
import HorizonSelector from './HorizonSelector';
import ForecastChart from './ForecastChart';
import { generateEnergyData, calculateMetrics } from '../utils/mockData';

const ForecastSection = ({ site, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedHorizon, setSelectedHorizon] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState({});

  useEffect(() => {
    // Initial load
    loadForecastData(selectedHorizon);
  }, []);

  const loadForecastData = async (horizon) => {
    setLoading(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const newData = generateEnergyData(7, horizon);
    const newMetrics = calculateMetrics(newData);
    
    setData(newData);
    setMetrics(newMetrics);
    setLoading(false);
  };

  const handleHorizonChange = (horizon) => {
    setSelectedHorizon(horizon);
    loadForecastData(horizon);
  };

  const getTypeColor = (type) => {
    const colors = {
      'Solar': 'text-yellow-600 bg-yellow-50',
      'Wind': 'text-blue-600 bg-blue-50',
      'Hydro': 'text-cyan-600 bg-cyan-50',
      'Mixed': 'text-purple-600 bg-purple-50'
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="backdrop-blur-xl bg-white/70 rounded-2xl shadow-xl border border-white/50 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 hover:border-primary-200/50">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer bg-gradient-to-r from-transparent to-primary-50/30 hover:to-primary-50/50 transition-all"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <button className="text-primary-600 hover:text-primary-700 transition-all hover:scale-110 p-1 hover:bg-primary-50 rounded-lg">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
          <div>
            <h3 className="text-base font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">{site.name}</h3>
            <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                <MapPin className="w-3 h-3" />
                {site.location}
              </span>
              <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                <Zap className="w-3 h-3" />
                {site.capacity}
              </span>
              <span className={`px-2 py-0.5 rounded font-medium ${getTypeColor(site.type)}`}>
                {site.type}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-full shadow-sm">
          <div className="relative">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
          </div>
          <span className="text-xs font-semibold text-green-700">Active</span>
        </div>
      </div>

      {/* Expandable Content */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-3 pt-0 space-y-3">
          {/* Horizon Selector */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Forecast Horizon
            </label>
            <HorizonSelector 
              selected={selectedHorizon}
              onChange={handleHorizonChange}
              loading={loading}
            />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <MetricCard
              icon={Zap}
              label="Current"
              value={metrics.currentConsumption || '--'}
              unit="MW"
              className="animate-fade-in"
            />
            <MetricCard
              icon={TrendingUp}
              label="Forecast Avg"
              value={metrics.forecastedConsumption || '--'}
              unit="MW"
              className="animate-fade-in"
              style={{ animationDelay: '0.1s' }}
            />
            <MetricCard
              icon={Target}
              label="Accuracy"
              value={metrics.accuracy || '--'}
              unit="%"
              trend={{ direction: 'up', value: '+2.3%' }}
              className="animate-fade-in"
              style={{ animationDelay: '0.2s' }}
            />
            <MetricCard
              label="Data Points"
              value={metrics.dataPoints || '--'}
              unit="hrs"
              className="animate-fade-in"
              style={{ animationDelay: '0.3s' }}
            />
          </div>

          {/* Chart */}
          <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">
              Energy Forecast
            </h4>
            <ForecastChart data={data} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastSection;
