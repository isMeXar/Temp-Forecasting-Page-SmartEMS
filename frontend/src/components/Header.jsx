import { Activity, Cpu, Gauge, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Header = () => {
  const { isDark, toggleTheme } = useTheme();
  const lastUpdate = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const badges = [
    {
      icon: Activity,
      label: 'System',
      value: 'Online',
      color: 'text-accent-emerald',
      dot: 'bg-accent-emerald',
    },
    {
      icon: Cpu,
      label: 'Updated',
      value: lastUpdate,
      color: 'text-ink-faded',
    },
    {
      icon: Gauge,
      label: 'Accuracy',
      value: '95.2%',
      color: 'text-accent-cyan',
    },
  ];

  return (
    <header className="relative z-10 border-b border-surface-border/40 bg-surface/60 backdrop-blur-xl">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent-cyan/20 to-accent-emerald/20 flex items-center justify-center border border-surface-border/50 glow-cyan">
                <Activity className="w-5 h-5 text-accent-cyan" />
                <div className="absolute inset-0 rounded-xl bg-accent-cyan/5 animate-glow-pulse" />
              </div>
              <div>
                <h1 className="text-lg font-heading font-bold text-ink tracking-tight">
                  SmartEMS
                </h1>
                <p className="text-[11px] text-ink-muted font-medium tracking-wide uppercase">
                  Control Center
                </p>
              </div>
            </div>
            <div className="hidden md:flex h-8 w-px bg-surface-border/40" />
          </div>

          <div className="flex items-center gap-3">
            {badges.map((badge) => (
              <div
                key={badge.label}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-hover/30 border border-surface-border/40"
              >
                <badge.icon className="w-3.5 h-3.5 text-ink-muted" />
                <span className="text-[11px] font-medium text-ink-muted">{badge.label}:</span>
                <span className={`text-[11px] font-semibold font-mono-num ${badge.color}`}>
                  {badge.value}
                </span>
                {badge.dot && (
                  <span className="relative flex w-2 h-2 ml-0.5">
                    <span className={`absolute inline-flex w-full h-full rounded-full ${badge.dot} opacity-75 animate-ping`} />
                    <span className={`relative inline-flex w-2 h-2 rounded-full ${badge.dot}`} />
                  </span>
                )}
              </div>
            ))}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-surface-hover/30 border border-surface-border/40 text-ink-muted hover:text-ink hover:bg-surface-hover/50 transition-all duration-200"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
