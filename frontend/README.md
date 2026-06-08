# SmartEMS Forecasting Platform - Frontend

A modern, professional energy forecasting web application built with React, Vite, and Tailwind CSS.

## Features

- 🎨 **Modern Green-Themed UI** - Professional SaaS-style interface
- 📊 **Interactive Visualizations** - Recharts for time-series forecasting
- 🔄 **Multiple Forecast Horizons** - 1 hour to 1 month ahead predictions
- 📱 **Responsive Design** - Optimized for desktop and tablet
- ⚡ **Fast Performance** - Built with Vite for lightning-fast dev experience
- 🎭 **Smooth Animations** - Professional transitions and effects
- 📈 **Real-time Metrics** - KPI cards with live updates

## Tech Stack

- **React 19** - Latest React with hooks
- **Vite** - Next-generation frontend tooling
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Composable charting library
- **Lucide React** - Beautiful icon set

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header.jsx              # Platform header with status
│   │   ├── MetricCard.jsx          # Reusable KPI card
│   │   ├── HorizonSelector.jsx     # Forecast horizon selector
│   │   ├── ForecastChart.jsx       # Interactive time-series chart
│   │   ├── ForecastSection.jsx     # Collapsible forecast section
│   │   └── LoadingSkeleton.jsx     # Loading placeholder
│   ├── utils/
│   │   └── mockData.js             # Mock data generation
│   ├── App.jsx                     # Main app component
│   ├── main.jsx                    # App entry point
│   └── index.css                   # Global styles
├── public/                          # Static assets
└── package.json
```

## Features Overview

### Collapsible Forecast Sections
Each energy site has its own collapsible section with:
- Site name, location, and capacity
- Status indicator
- Expandable content with smooth animations

### Forecast Horizons
Switch between different prediction timeframes:
- 1 Hour Ahead
- 1 Day Ahead (default)
- 3 Days Ahead
- 1 Week Ahead
- 1 Month Ahead

### Interactive Charts
- Historical vs. forecasted data visualization
- Zoom and pan capabilities
- Hover tooltips with detailed information
- Responsive design

### KPI Metrics
- Current Consumption
- Forecasted Average
- Forecast Accuracy
- Data Points

## Mock Data
The application uses realistic synthetic energy data with:
- Daily seasonality (higher during business hours)
- Weekly patterns (lower on weekends)
- Random variations for realism
- Separate datasets for each forecast horizon

## Future Integration
This frontend is designed to integrate with the FastAPI backend. To connect:

1. Update API endpoint in components
2. Replace mock data with actual API calls
3. Add authentication if required
4. Implement error handling for API failures

## Customization

### Colors
Edit `tailwind.config.js` to customize the green theme:

```js
colors: {
  primary: {
    // Your custom green shades
  }
}
```

### Sites
Edit `src/utils/mockData.js` to add/remove energy sites:

```js
export const sites = [
  // Add your sites here
];
```

## License
Proprietary - SmartEMS Platform
