import React from 'react';
import { horizonOptions } from '../utils/mockData';

const HorizonSelector = ({ selected, onChange, loading }) => {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
      {horizonOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          disabled={loading}
          className={`
            relative px-3 py-1.5 rounded-md font-medium text-xs transition-all duration-300
            ${selected === option.value
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }
            ${loading ? 'opacity-50 cursor-not-allowed' : ''}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default HorizonSelector;
