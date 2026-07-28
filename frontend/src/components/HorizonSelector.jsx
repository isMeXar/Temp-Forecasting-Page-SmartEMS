const horizonOptions = [
  { value: '1h', label: '1H', labelLong: '1 Hour Ahead' },
  { value: '1d', label: '1D', labelLong: '1 Day Ahead' },
  { value: '3d', label: '3D', labelLong: '3 Days Ahead' },
  { value: '1w', label: '1W', labelLong: '1 Week Ahead' },
  { value: '1m', label: '1M', labelLong: '1 Month Ahead' },
];

const HorizonSelector = ({ selectedHorizon, onHorizonChange, loading }) => {
  return (
    <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-surface-hover/30 border border-surface-border/40">
      {horizonOptions.map((option) => {
        const isActive = selectedHorizon === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onHorizonChange(option.value)}
            disabled={loading}
            className={`
              relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300
              ${isActive
                ? 'bg-accent-cyan/15 text-accent-cyan shadow-[0_0_20px_rgba(6,182,212,0.1)]'
                : 'text-ink-muted hover:text-ink hover:bg-surface-hover/50'
              }
              ${loading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
            title={option.labelLong}
          >
            {isActive && (
              <div className="absolute inset-0 rounded-lg border border-accent-cyan/30" />
            )}
            <span className="relative z-10 font-mono-num">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default HorizonSelector;
