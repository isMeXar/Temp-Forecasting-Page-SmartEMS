const colorMap = {
  cyan: {
    bg: 'from-accent-cyan/5 to-transparent',
    border: 'group-hover:border-accent-cyan/30',
    text: 'text-accent-cyan',
    glow: 'glow-cyan',
  },
  emerald: {
    bg: 'from-accent-emerald/5 to-transparent',
    border: 'group-hover:border-accent-emerald/30',
    text: 'text-accent-emerald',
    glow: 'glow-emerald',
  },
  amber: {
    bg: 'from-accent-amber/5 to-transparent',
    border: 'group-hover:border-accent-amber/30',
    text: 'text-accent-amber',
    glow: 'glow-amber',
  },
  rose: {
    bg: 'from-accent-rose/5 to-transparent',
    border: 'group-hover:border-accent-rose/30',
    text: 'text-accent-rose',
    glow: 'glow-rose',
  },
  violet: {
    bg: 'from-accent-violet/5 to-transparent',
    border: 'group-hover:border-accent-violet/30',
    text: 'text-accent-violet',
    glow: 'glow-violet',
  },
};

const MetricCard = ({ icon: Icon, label, value, unit, trend, accent = 'cyan', compact = false }) => {
  const c = colorMap[accent] || colorMap.cyan;

  if (compact) {
    return (
      <div
        className={`group relative overflow-hidden rounded-lg bg-surface-card/80 border border-surface-border/30
          transition-all duration-200 ${c.glow} h-full flex items-center`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${c.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        <div className="relative w-full px-2.5 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {Icon && <Icon className={`w-3 h-3 shrink-0 ${c.text}`} />}
            <span className="text-[10px] font-medium text-ink-muted truncate">{label}</span>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className={`text-xs font-bold font-mono-num text-ink tracking-tight`}>
              {value ?? '--'}
            </span>
            {unit && <span className="text-[9px] text-ink-muted">{unit}</span>}
          </div>
          {trend && (
            <span className={`text-[9px] font-semibold shrink-0 ${
              trend.direction === 'up' ? 'text-accent-emerald' : 'text-accent-rose'
            }`}>
              {trend.direction === 'up' ? '\u2191' : '\u2193'}{trend.value}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-xl bg-surface-card/90 border border-surface-border/30
        transition-all duration-300 hover:border-surface-border/60 hover:-translate-y-[1px] shadow-card ${c.glow}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${c.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative p-3.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-widest">
            {label}
          </span>
          {Icon && (
            <div className={`p-1.5 rounded-lg bg-surface-hover/30 border border-surface-border/30 group-hover:scale-110 transition-all duration-300 ${c.text}`}>
              <Icon className="w-3 h-3" />
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-xl font-bold font-mono-num text-ink tracking-tight`}>
            {value ?? '--'}
          </span>
          {unit && <span className="text-xs font-medium text-ink-muted">{unit}</span>}
        </div>
        {trend && (
          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold
            ${trend.direction === 'up'
              ? 'bg-accent-emerald/10 text-accent-emerald'
              : 'bg-accent-rose/10 text-accent-rose'}`}
          >
            <span>{trend.direction === 'up' ? '\u2191' : '\u2193'}</span>
            {trend.value}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
