import React from 'react';

const LoadingSkeleton = () => {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-32"></div>
        ))}
      </div>
      <div className="bg-gray-200 rounded-xl h-96"></div>
    </div>
  );
};

export default LoadingSkeleton;
