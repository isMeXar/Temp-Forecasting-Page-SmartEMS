import React from 'react';

const MetricCard = ({ icon: Icon, label, value, unit, trend, className = '' }) => {
  return (
    <div className={`backdrop-blur-xl bg-white/60 rounded-xl p-3 border border-white/60 hover:bg-white/80 hover:border-primary-200/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1 text-gray-500 text-xs mb-1.5">
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span className="font-medium">{label}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold bg-gradient-to-br from-gray-900 to-primary-700 bg-clip-text text-transparent">{value}</span>
            {unit && <span className="text-sm text-gray-500 font-medium">{unit}</span>}
          </div>
          {trend && (
            <div className={`mt-1.5 text-xs font-bold inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
              trend.direction === 'up' ? 'text-green-600 bg-green-50 ring-1 ring-green-200' : 
              trend.direction === 'down' ? 'text-red-600 bg-red-50 ring-1 ring-red-200' : 
              'text-gray-600 bg-gray-50'
            }`}>
              {trend.direction === 'up' && '↑'}
              {trend.direction === 'down' && '↓'}
              {trend.value}
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-2.5 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl shadow-sm">
            <Icon className="w-4 h-4 text-primary-600" />
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
