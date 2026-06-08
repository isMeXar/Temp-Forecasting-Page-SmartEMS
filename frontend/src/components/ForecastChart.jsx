import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  Area,
  ComposedChart
} from 'recharts';

const ForecastChart = ({ data, loading }) => {
  const [brushStartIndex, setBrushStartIndex] = useState(null);
  const [brushEndIndex, setBrushEndIndex] = useState(null);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white rounded-2xl animate-pulse border border-gray-200/50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500 font-medium">Loading forecast data...</p>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit'
    });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-xl shadow-2xl border border-gray-200/50 ring-1 ring-black/5">
          <p className="font-bold text-gray-900 mb-2 text-sm">{formatTimestamp(label)}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-xs mb-1">
              <div 
                className="w-3 h-3 rounded-full ring-2 ring-white" 
                style={{ backgroundColor: entry.color }}
              ></div>
              <span className="text-gray-600 font-medium">{entry.name}:</span>
              <span className="font-bold text-gray-900">{entry.value} MW</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const now = new Date();
  const nowTimestamp = now.toISOString();

  return (
    <div className="backdrop-blur-xl bg-white/80 p-5 rounded-2xl shadow-xl border border-white/50 hover:shadow-2xl transition-all duration-500">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Interactive Forecast Chart</h4>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <div className="w-8 h-0.5 bg-blue-500"></div>
            Historical
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-8 h-0.5 bg-green-500 border-t-2 border-dashed"></div>
            Forecast
          </span>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart 
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
          
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatShortTime}
            stroke="#9ca3af"
            style={{ fontSize: '10px' }}
            tick={{ fill: '#6b7280' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          
          <YAxis 
            label={{ 
              value: 'Energy (MW)', 
              angle: -90, 
              position: 'insideLeft', 
              style: { fill: '#6b7280', fontSize: '11px', fontWeight: 600 } 
            }}
            stroke="#9ca3af"
            style={{ fontSize: '10px' }}
            tick={{ fill: '#6b7280' }}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          <Legend 
            wrapperStyle={{ paddingTop: '15px' }}
            iconType="line"
            iconSize={14}
          />
          
          <ReferenceLine 
            x={nowTimestamp} 
            stroke="#ef4444" 
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{ 
              value: 'Now', 
              position: 'top', 
              fill: '#ef4444', 
              fontSize: 11,
              fontWeight: 'bold'
            }}
          />
          
          <Area
            type="monotone"
            dataKey="actual"
            stroke="none"
            fill="url(#colorActual)"
            connectNulls={false}
          />
          
          <Area
            type="monotone"
            dataKey="forecasted"
            stroke="none"
            fill="url(#colorForecast)"
            connectNulls={false}
          />
          
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={false}
            name="Historical"
            connectNulls={false}
            animationDuration={800}
          />
          
          <Line
            type="monotone"
            dataKey="forecasted"
            stroke="#22c55e"
            strokeWidth={2.5}
            strokeDasharray="8 4"
            dot={false}
            name="Forecasted"
            connectNulls={false}
            animationDuration={800}
          />
          
          <Brush 
            dataKey="timestamp" 
            height={30} 
            stroke="#22c55e"
            fill="#f0fdf4"
            tickFormatter={formatShortTime}
            onChange={(e) => {
              if (e && e.startIndex !== undefined) {
                setBrushStartIndex(e.startIndex);
                setBrushEndIndex(e.endIndex);
              }
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          Drag on chart to zoom
        </span>
        <span className="inline-flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Use brush below to select period
        </span>
      </div>
    </div>
  );
};

export default ForecastChart;
