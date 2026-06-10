import { horizonOptions } from '../utils/mockData';

const HorizonSelector = ({ selected, onChange, loading }) => {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-hover/30 border border-surface-border/40">
      {horizonOptions.map((option) => {
        const isActive = selected === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            disabled={loading}
            className={`
              relative px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-300
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
