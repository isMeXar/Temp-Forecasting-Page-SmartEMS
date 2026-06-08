import React from 'react';
import Header from './components/Header';
import ForecastSection from './components/ForecastSection';
import { sites } from './utils/mockData';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6 relative">
        {/* Floating animated background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-200/20 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-blue-200/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-green-200/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>

        {/* Welcome Section */}
        <div className="relative mb-6 backdrop-blur-xl bg-white/60 rounded-2xl p-5 border border-white/50 shadow-xl shadow-primary-500/5 animate-fade-in hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-blue-500/5 rounded-2xl"></div>
          <div className="relative">
            <h2 className="text-lg font-bold bg-gradient-to-r from-gray-900 via-primary-800 to-blue-900 bg-clip-text text-transparent mb-2">
              SmartEMS Forecasting Platform
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Monitor and predict energy consumption with AI-powered forecasting models. 
              Drag on charts to zoom, click and drag to pan through time.
            </p>
          </div>
        </div>

        {/* Forecast Sections */}
        <div className="relative space-y-5">
          {sites.map((site, index) => (
            <div 
              key={site.id}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <ForecastSection 
                site={site} 
                defaultExpanded={index === 0}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="relative mt-8 text-center text-gray-500 text-xs pb-6">
          <p>© 2026 SmartEMS Forecasting Platform</p>
          <p className="mt-1">Models: LightGBM & XGBoost | CEEMD Features</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
