import { useState, useEffect } from 'react';
import { Brain, Factory, Zap, CheckCircle } from 'lucide-react';

const API_BASE = 'http://localhost:8001';

function GlobalStats() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        const json = await res.json();
        if (mounted) {
          setData({
            posts: json.posts,
            processes: json.processes,
            models: json.models_loaded,
            modelsUnit: 'loaded',
            status: json.status.charAt(0).toUpperCase() + json.status.slice(1),
            statusOk: true,
          });
        }
      } catch {
        if (mounted)
          setData({ posts: 0, processes: 0, models: 0, modelsUnit: '', status: 'Offline', statusOk: false });
      }
    };
    fetchHealth();
    const intv = setInterval(fetchHealth, 15000);
    return () => { mounted = false; clearInterval(intv); };
  }, []);

  const cards = [
    {
      key: 'posts', label: 'Posts', icon: Zap, accent: 'text-accent-cyan',
      value: data?.posts, unit: 'active',
    },
    {
      key: 'processes', label: 'Processes', icon: Factory, accent: 'text-accent-amber',
      value: data?.processes, unit: 'running',
    },
    {
      key: 'models', label: 'Models', icon: Brain, accent: 'text-accent-emerald',
      value: data?.models, unit: data?.modelsUnit ?? '',
    },
    {
      key: 'status', label: 'System Status', icon: CheckCircle, accent: data?.statusOk ? 'text-accent-emerald' : 'text-red-400',
      custom: data && (
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${data.statusOk ? 'bg-accent-emerald' : 'bg-red-400'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${data.statusOk ? 'bg-accent-emerald' : 'bg-red-400'}`} />
          </span>
          {data.status}
        </span>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className="relative overflow-hidden rounded-xl bg-surface-card/60 border border-surface-border/40 p-4 shadow-card"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-widest">
              {card.label}
            </span>
            <card.icon className={`w-4 h-4 ${card.accent} opacity-70`} />
          </div>
          <div className="flex items-baseline gap-1.5 min-h-[32px]">
            {card.value != null ? (
              <>
                <span className="text-2xl font-bold font-mono-num text-ink tracking-tight">
                  {card.value}
                </span>
                {card.unit && (
                  <span className="text-xs font-medium text-ink-muted">{card.unit}</span>
                )}
              </>
            ) : card.custom ? (
              card.custom
            ) : (
              <span className="text-base font-mono-num text-ink-muted/50">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default GlobalStats;
