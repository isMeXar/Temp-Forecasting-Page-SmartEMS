import { Zap, BarChart3, Target, Activity, TrendingUp } from 'lucide-react';

const GlobalStats = ({ siteData }) => {
  const allCurrent = Object.values(siteData).map(d => d.currentConsumption || 0);
  const totalCurrent = allCurrent.reduce((s, v) => s + v, 0);
  const totalCapacity = 425;
  const avgAccuracy = Object.values(siteData).reduce((s, d) => s + (d.accuracy || 0), 0) / Math.max(1, Object.keys(siteData).length);

  const stats = [
    {
      icon: Zap,
      label: 'Total Load',
      value: `${totalCurrent.toFixed(0)}`,
      unit: 'MW',
      sub: `${((totalCurrent / totalCapacity) * 100).toFixed(0)}% capacity`,
      accent: 'text-accent-cyan',
    },
    {
      icon: BarChart3,
      label: 'Total Capacity',
      value: `${totalCapacity}`,
      unit: 'MW',
      accent: 'text-accent-emerald',
    },
    {
      icon: Target,
      label: 'Avg Accuracy',
      value: `${avgAccuracy.toFixed(1)}`,
      unit: '%',
      accent: 'text-accent-amber',
    },
    {
      icon: Activity,
      label: 'Active Sites',
      value: `${Object.keys(siteData).length}`,
      unit: '/ 4',
      accent: 'text-accent-emerald',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="relative overflow-hidden rounded-xl bg-surface-card/60 border border-surface-border/40 p-4 shadow-card"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-widest">
              {stat.label}
            </span>
            <stat.icon className={`w-4 h-4 ${stat.accent} opacity-70`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono-num text-ink tracking-tight">
              {stat.value}
            </span>
            <span className="text-xs font-medium text-ink-muted">{stat.unit}</span>
          </div>
          {stat.sub && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-muted">
              <TrendingUp className="w-3 h-3" />
              {stat.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default GlobalStats;
