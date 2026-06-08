import React from 'react';
import { Activity, CheckCircle2, Clock } from 'lucide-react';

const Header = () => {
  const lastUpdate = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <header className="bg-gradient-to-r from-primary-600 via-primary-600 to-primary-700 text-white shadow-lg border-b border-primary-800/20">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm ring-1 ring-white/10">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SmartEMS Forecasting</h1>
              <p className="text-primary-100 text-xs font-medium">AI Energy Management System</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg ring-1 ring-white/10 text-xs">
            <CheckCircle2 className="w-4 h-4 text-green-300" />
            <div className="flex items-center gap-2">
              <span className="text-primary-50 font-medium">Status:</span>
              <span className="font-bold">Online</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg ring-1 ring-white/10 text-xs">
            <Clock className="w-4 h-4 text-primary-200" />
            <div className="flex items-center gap-2">
              <span className="text-primary-50 font-medium">Updated:</span>
              <span className="font-bold">{lastUpdate}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg ring-1 ring-white/10 text-xs">
            <div className="relative">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary-50 font-medium">Accuracy:</span>
              <span className="font-bold">95.2%</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
