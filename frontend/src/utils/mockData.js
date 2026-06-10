const siteProfiles = {
  'site-a': {
    name: 'Solar Farm Alpha',
    baseLoad: 120,
    peakAmplitude: 120,
    nightLoad: 10,
    peakStart: 7,
    peakEnd: 19,
    noiseScale: 12,
    weekendScale: 0.75,
    weeklyBaseDecay: 0,
    type: 'Solar',
    location: 'Northern Region',
    capacity: '50 MW',
  },
  'site-b': {
    name: 'Wind Park Beta',
    baseLoad: 160,
    peakAmplitude: 40,
    nightLoad: 130,
    peakStart: 20,
    peakEnd: 6,
    noiseScale: 28,
    weekendScale: 0.9,
    weeklyBaseDecay: 0,
    type: 'Wind',
    location: 'Coastal Region',
    capacity: '75 MW',
  },
  'site-c': {
    name: 'Hydro Station Gamma',
    baseLoad: 200,
    peakAmplitude: 30,
    nightLoad: 180,
    peakStart: 6,
    peakEnd: 22,
    noiseScale: 8,
    weekendScale: 0.95,
    weeklyBaseDecay: -5,
    type: 'Hydro',
    location: 'Mountain Region',
    capacity: '100 MW',
  },
  'site-d': {
    name: 'Industrial Complex Delta',
    baseLoad: 250,
    peakAmplitude: 100,
    nightLoad: 160,
    peakStart: 6,
    peakEnd: 22,
    noiseScale: 20,
    weekendScale: 0.6,
    weeklyBaseDecay: 3,
    type: 'Mixed',
    location: 'Urban Zone',
    capacity: '200 MW',
  },
};

export const generateEnergyData = (days, horizon = '1d', siteId = 'site-a') => {
  const profile = siteProfiles[siteId] || siteProfiles['site-a'];
  const data = [];
  const now = new Date();
  const hoursMap = { '1h': 1, '1d': 24, '3d': 72, '1w': 168, '1m': 720 };
  const hours = hoursMap[horizon] || 24;
  const historicalHours = 168;

  const getLoad = (timestamp, profile) => {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    const dayIndex = Math.floor(timestamp.getTime() / 86400000);

    let baseLoad = profile.baseLoad + profile.weeklyBaseDecay * (dayIndex % 30);

    if (profile.peakStart <= profile.peakEnd) {
      if (hour >= profile.peakStart && hour <= profile.peakEnd) {
        const peakPos = (hour - profile.peakStart) / (profile.peakEnd - profile.peakStart);
        baseLoad += profile.peakAmplitude * Math.sin(peakPos * Math.PI);
      }
    } else {
      if (hour >= profile.peakStart || hour <= profile.peakEnd) {
        const effectiveHour = hour < profile.peakStart ? hour + 24 : hour;
        const range = (24 - profile.peakStart) + profile.peakEnd;
        const peakPos = (effectiveHour - profile.peakStart) / range;
        baseLoad += profile.peakAmplitude * Math.sin(peakPos * Math.PI);
      }
    }

    if (hour < profile.peakStart || hour > profile.peakEnd) {
      baseLoad = baseLoad * 0.3 + profile.nightLoad * 0.7;
    }

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseLoad *= profile.weekendScale;
    }

    return Math.max(10, baseLoad);
  };

  for (let i = -historicalHours; i < 0; i++) {
    const timestamp = new Date(now.getTime() + i * 3600000);
    const baseLoad = getLoad(timestamp, profile);
    const noise = (Math.random() - 0.5) * profile.noiseScale * 1.5;
    const actual = Math.max(10, baseLoad + noise);
    data.push({
      timestamp: timestamp.toISOString(),
      actual: Math.round(actual * 10) / 10,
      forecasted: null,
      confidenceUpper: null,
      confidenceLower: null,
      isHistorical: true,
    });
  }

  for (let i = 0; i < hours; i++) {
    const timestamp = new Date(now.getTime() + i * 3600000);
    const baseLoad = getLoad(timestamp, profile);
    const accuracyDecay = Math.max(0.75, 1 - (i / hours) * 0.25);
    const noise = (Math.random() - 0.5) * profile.noiseScale * (1 - accuracyDecay * 0.5);
    const forecasted = Math.max(10, baseLoad + noise);
    const confidenceWidth = profile.noiseScale * (1.5 + (i / hours) * 3);
    const confidenceUpper = forecasted + confidenceWidth;
    const confidenceLower = Math.max(0, forecasted - confidenceWidth);
    data.push({
      timestamp: timestamp.toISOString(),
      actual: null,
      forecasted: Math.round(forecasted * 10) / 10,
      confidenceUpper: Math.round(confidenceUpper * 10) / 10,
      confidenceLower: Math.round(confidenceLower * 10) / 10,
      isHistorical: false,
    });
  }

  return data;
};

export const calculateMetrics = (data, siteId) => {
  const historical = data.filter(d => d.isHistorical && d.actual);
  const forecast = data.filter(d => !d.isHistorical && d.forecasted);

  const currentConsumption = historical.length > 0
    ? historical[historical.length - 1].actual
    : 0;

  const forecastValues = forecast.map(d => d.forecasted);
  const forecastAvg = forecastValues.length > 0
    ? forecastValues.reduce((s, v) => s + v, 0) / forecastValues.length
    : 0;

  const minForecast = forecastValues.length > 0 ? Math.min(...forecastValues) : 0;
  const maxForecast = forecastValues.length > 0 ? Math.max(...forecastValues) : 0;

  const baseAccuracy = {
    'site-a': 94.5,
    'site-b': 91.2,
    'site-c': 96.8,
    'site-d': 88.3,
  };
  const baseAcc = baseAccuracy[siteId] || 92;
  const jitter = (Math.random() - 0.5) * 3;
  const accuracy = Math.round((baseAcc + jitter) * 10) / 10;

  const avg = forecastAvg > 0 ? forecastAvg : currentConsumption;
  const current = currentConsumption > 0 ? currentConsumption : avg * 0.95;
  const change = ((current - avg) / avg) * 100;

  return {
    currentConsumption: Math.round(current * 10) / 10,
    forecastedConsumption: Math.round(forecastAvg * 10) / 10,
    minForecast: Math.round(minForecast * 10) / 10,
    maxForecast: Math.round(maxForecast * 10) / 10,
    accuracy,
    dataPoints: forecast.length,
    trend: change > 0 ? 'up' : 'down',
    trendValue: Math.abs(change).toFixed(1),
  };
};

export const sites = [
  {
    id: 'site-a',
    name: 'Solar Farm Alpha',
    location: 'Northern Region',
    capacity: '50 MW',
    type: 'Solar',
    accent: 'amber',
    status: 'active',
    icon: 'sun',
  },
  {
    id: 'site-b',
    name: 'Wind Park Beta',
    location: 'Coastal Region',
    capacity: '75 MW',
    type: 'Wind',
    accent: 'cyan',
    status: 'active',
    icon: 'wind',
  },
  {
    id: 'site-c',
    name: 'Hydro Station Gamma',
    location: 'Mountain Region',
    capacity: '100 MW',
    type: 'Hydro',
    accent: 'emerald',
    status: 'active',
    icon: 'droplets',
  },
  {
    id: 'site-d',
    name: 'Industrial Complex Delta',
    location: 'Urban Zone',
    capacity: '200 MW',
    type: 'Mixed',
    accent: 'violet',
    status: 'active',
    icon: 'factory',
  },
];

export const horizonOptions = [
  { value: '1h', label: '1H', labelLong: '1 Hour Ahead', hours: 1 },
  { value: '1d', label: '1D', labelLong: '1 Day Ahead', hours: 24 },
  { value: '3d', label: '3D', labelLong: '3 Days Ahead', hours: 72 },
  { value: '1w', label: '1W', labelLong: '1 Week Ahead', hours: 168 },
  { value: '1m', label: '1M', labelLong: '1 Month Ahead', hours: 720 },
];
