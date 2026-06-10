import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from 'recharts';

const accentColors = {
  cyan: { main: '#06b6d4', band: 'rgba(6,182,212,0.08)', histFill: 'rgba(59,130,246,0.08)' },
  emerald: { main: '#10b981', band: 'rgba(16,185,129,0.08)', histFill: 'rgba(59,130,246,0.08)' },
  amber: { main: '#f59e0b', band: 'rgba(245,158,11,0.08)', histFill: 'rgba(59,130,246,0.08)' },
  violet: { main: '#8b5cf6', band: 'rgba(139,92,246,0.08)', histFill: 'rgba(59,130,246,0.08)' },
};

const formatTS = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatShort = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-card/95 backdrop-blur-xl p-3.5 rounded-xl border border-surface-border/60 shadow-card">
      <p className="text-xs font-semibold text-ink-faded mb-2">{formatTS(label)}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-[11px] py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-ink-muted">{entry.name}:</span>
          <span className="font-mono-num font-bold text-ink">{Number(entry.value).toFixed(1)} MW</span>
        </div>
      ))}
    </div>
  );
};

const ForecastChart = ({ data, loading, accent = 'cyan', chartHeight = 260 }) => {
  const c = accentColors[accent] || accentColors.cyan;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center rounded-2xl bg-surface-card/40 border border-surface-border/30">
        <div className="text-center">
          <div className="relative w-10 h-10 mx-auto">
            <div className="absolute inset-0 border-2 border-accent-cyan/30 rounded-full" />
            <div className="absolute inset-0 border-2 border-transparent border-t-accent-cyan rounded-full animate-spin" />
          </div>
          <p className="mt-4 text-xs text-ink-muted font-medium">Loading forecast...</p>
        </div>
      </div>
    );
  }

  const now = new Date().toISOString();

  return (
    <div className="rounded-2xl bg-surface-card/40 border border-surface-border/30 p-4">
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={`confBand-${accent}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.main} stopOpacity={0.12} />
                <stop offset="100%" stopColor={c.main} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={`histArea-${accent}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, rgba(148,163,184,0.08))" />

            <XAxis
              dataKey="timestamp"
              tickFormatter={formatShort}
              stroke="var(--chart-grid, rgba(148,163,184,0.25))"
              tick={{ fill: 'var(--chart-text, #64748b)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              angle={-35}
              textAnchor="end"
              height={50}
              interval="preserveStartEnd"
            />

            <YAxis
              stroke="var(--chart-grid, rgba(148,163,184,0.25))"
              tick={{ fill: 'var(--chart-text, #64748b)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--chart-grid, rgba(148,163,184,0.15))', strokeWidth: 1 }} />

            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              iconType="line"
              iconSize={10}
              formatter={(value) => (
                <span style={{ color: 'var(--chart-text, #94a3b8)', fontSize: 11, fontFamily: 'DM Sans' }}>{value}</span>
              )}
            />

            <ReferenceLine
              x={now}
              stroke="rgba(244,63,94,0.5)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'Now',
                position: 'top',
                fill: '#f43f5e',
                fontSize: 9,
                fontFamily: 'JetBrains Mono',
              }}
            />

            <Area
              type="monotone"
              dataKey="confidenceUpper"
              stroke="none"
              fill={`url(#confBand-${accent})`}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="confidenceLower"
              stroke="none"
              fill={`url(#confBand-${accent})`}
              connectNulls
            />

            <Area
              type="monotone"
              dataKey="actual"
              stroke="none"
              fill={`url(#histArea-${accent})`}
              connectNulls={false}
            />

            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              name="Historical"
              connectNulls={false}
              animationDuration={600}
            />

            <Line
              type="monotone"
              dataKey="forecasted"
              stroke={c.main}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              name="Forecast"
              connectNulls={false}
              animationDuration={600}
            />

            <Brush
              dataKey="timestamp"
              height={20}
              stroke={c.main}
              fill="var(--brush-fill, rgba(15,23,42,0.4))"
              tickFormatter={formatShort}
              travellerWidth={8}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ForecastChart;
