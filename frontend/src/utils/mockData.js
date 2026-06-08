// Generate realistic energy consumption data with seasonality and patterns

export const generateEnergyData = (days, horizon = '1d') => {
  const data = [];
  const now = new Date();
  const hoursMap = {
    '1h': 1,
    '1d': 24,
    '3d': 72,
    '1w': 168,
    '1m': 720
  };
  
  const hours = hoursMap[horizon] || 24;
  const historicalHours = 168; // 1 week of historical data
  
  // Generate historical data
  for (let i = -historicalHours; i < 0; i++) {
    const timestamp = new Date(now.getTime() + i * 3600000);
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    
    // Base load with daily and weekly seasonality
    let baseLoad = 150;
    
    // Daily pattern: higher during business hours
    if (hour >= 8 && hour <= 18) {
      baseLoad += 80 + Math.sin((hour - 8) / 10 * Math.PI) * 40;
    } else if (hour >= 19 && hour <= 22) {
      baseLoad += 60;
    } else {
      baseLoad += 20;
    }
    
    // Weekly pattern: lower on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseLoad *= 0.7;
    }
    
    // Add some random variation
    const noise = (Math.random() - 0.5) * 30;
    const actual = Math.max(50, baseLoad + noise);
    
    data.push({
      timestamp: timestamp.toISOString(),
      actual: Math.round(actual * 10) / 10,
      forecasted: null,
      isHistorical: true
    });
  }
  
  // Generate forecast data
  for (let i = 0; i < hours; i++) {
    const timestamp = new Date(now.getTime() + i * 3600000);
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    
    let baseLoad = 150;
    
    if (hour >= 8 && hour <= 18) {
      baseLoad += 80 + Math.sin((hour - 8) / 10 * Math.PI) * 40;
    } else if (hour >= 19 && hour <= 22) {
      baseLoad += 60;
    } else {
      baseLoad += 20;
    }
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseLoad *= 0.7;
    }
    
    // Forecast has less noise and slight degradation over time
    const accuracy = Math.max(0.85, 1 - (i / hours) * 0.15);
    const noise = (Math.random() - 0.5) * 20 * (1 - accuracy);
    const forecasted = Math.max(50, baseLoad + noise);
    
    data.push({
      timestamp: timestamp.toISOString(),
      actual: null,
      forecasted: Math.round(forecasted * 10) / 10,
      isHistorical: false
    });
  }
  
  return data;
};

export const calculateMetrics = (data) => {
  const historical = data.filter(d => d.isHistorical && d.actual);
  const forecast = data.filter(d => !d.isHistorical && d.forecasted);
  
  const currentConsumption = historical.length > 0 
    ? historical[historical.length - 1].actual 
    : 0;
  
  const forecastedConsumption = forecast.length > 0
    ? forecast.reduce((sum, d) => sum + d.forecasted, 0) / forecast.length
    : 0;
  
  // Simulate forecast accuracy (would be calculated from actual vs predicted in production)
  const accuracy = 92 + Math.random() * 6; // 92-98% range
  
  return {
    currentConsumption: Math.round(currentConsumption * 10) / 10,
    forecastedConsumption: Math.round(forecastedConsumption * 10) / 10,
    accuracy: Math.round(accuracy * 10) / 10,
    dataPoints: forecast.length
  };
};

export const sites = [
  {
    id: 'site-a',
    name: 'Solar Farm Alpha',
    location: 'Northern Region',
    capacity: '50 MW',
    type: 'Solar'
  },
  {
    id: 'site-b',
    name: 'Wind Park Beta',
    location: 'Coastal Region',
    capacity: '75 MW',
    type: 'Wind'
  },
  {
    id: 'site-c',
    name: 'Hydro Station Gamma',
    location: 'Mountain Region',
    capacity: '100 MW',
    type: 'Hydro'
  },
  {
    id: 'site-d',
    name: 'Industrial Complex Delta',
    location: 'Urban Zone',
    capacity: '200 MW',
    type: 'Mixed'
  }
];

export const horizonOptions = [
  { value: '1h', label: '1 Hour Ahead', hours: 1 },
  { value: '1d', label: '1 Day Ahead', hours: 24 },
  { value: '3d', label: '3 Days Ahead', hours: 72 },
  { value: '1w', label: '1 Week Ahead', hours: 168 },
  { value: '1m', label: '1 Month Ahead', hours: 720 }
];
