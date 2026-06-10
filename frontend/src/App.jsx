import { useState, useMemo } from 'react';
import Header from './components/Header';
import ForecastSection from './components/ForecastSection';
import GlobalStats from './components/GlobalStats';
import { sites, generateEnergyData, calculateMetrics } from './utils/mockData';
import { Activity, Sun, Wind, Droplets, Factory } from 'lucide-react';

const siteIconMap = { sun: Sun, wind: Wind, droplets: Droplets, factory: Factory };

const accentColorMap = {
  amber: { bg: 'from-accent-amber/10 to-transparent', border: 'border-accent-amber/20', text: 'text-accent-amber' },
  cyan: { bg: 'from-accent-cyan/10 to-transparent', border: 'border-accent-cyan/20', text: 'text-accent-cyan' },
  emerald: { bg: 'from-accent-emerald/10 to-transparent', border: 'border-accent-emerald/20', text: 'text-accent-emerald' },
  violet: { bg: 'from-accent-violet/10 to-transparent', border: 'border-accent-violet/20', text: 'text-accent-violet' },
};

function App() {
  const [expandedSite, setExpandedSite] = useState('site-a');

  const siteMetrics = useMemo(() => {
    const metrics = {};
    sites.forEach(site => {
      const data = generateEnergyData(7, '1d', site.id);
      metrics[site.id] = calculateMetrics(data, site.id);
    });
    return metrics;
  }, []);

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
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="p-2 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20">
              <Activity className="w-5 h-5 text-accent-cyan" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold text-ink">Energy Forecast</h2>
              <p className="text-xs text-ink-muted">AI-powered consumption prediction across all sites</p>
            </div>
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <GlobalStats siteData={siteMetrics} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            {sites.map((site) => {
              const ac = accentColorMap[site.accent] || accentColorMap.cyan;
              const Icon = siteIconMap[site.icon] || Activity;
              const metrics = siteMetrics[site.id] || {};
              const capNum = parseInt(site.capacity) || 1;
              const percentage = metrics.currentConsumption
                ? Math.round((metrics.currentConsumption / capNum) * 100)
                : 0;

              return (
                <button
                  key={site.id}
                  onClick={() => setExpandedSite(site.id)}
                  className={`group relative overflow-hidden rounded-xl bg-surface-card/60 border text-left
                    transition-all duration-300 p-4 shadow-card
                    ${expandedSite === site.id
                      ? `${ac.border} ring-1 ring-surface-border/50`
                      : 'border-surface-border/40 hover:border-surface-border/70'
                    }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${ac.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <Icon className={`w-4 h-4 ${ac.text}`} />
                      <span className={`text-[10px] font-mono-num font-semibold ${ac.text}`}>
                        {percentage}%
                      </span>
                    </div>
                    <p className="text-sm font-heading font-bold text-ink mb-1">{site.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-ink-muted">
                      <span>{metrics.currentConsumption || '--'} MW</span>
                      <span className="text-ink-muted/50">/</span>
                      <span>{site.capacity}</span>
                    </div>
                    <div className="mt-2.5 h-1 rounded-full bg-surface-hover/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          site.accent === 'amber' ? 'bg-accent-amber' :
                          site.accent === 'cyan' ? 'bg-accent-cyan' :
                          site.accent === 'emerald' ? 'bg-accent-emerald' :
                          site.accent === 'violet' ? 'bg-accent-violet' : 'bg-accent-cyan'
                        }`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {sites.map((site, index) => (
              <div
                key={site.id}
                className="animate-fade-in"
                style={{ animationDelay: `${0.2 + index * 0.08}s` }}
              >
                <ForecastSection
                  site={site}
                  defaultExpanded={site.id === expandedSite}
                />
              </div>
            ))}
          </div>
        </div>

        <footer className="relative mt-8 pt-6 border-t border-surface-border/40 text-center">
          <p className="text-[10px] text-ink-muted font-medium tracking-wide">
            SmartEMS &copy; {new Date().getFullYear()} &mdash; Powered by LightGBM &amp; XGBoost &mdash; CEEMD Feature Engineering
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
