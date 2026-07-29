# SmartEMS Forecasting Platform — Frontend

React 19 + Vite + TailwindCSS 3 dashboard for real-time energy forecasting visualization. Communicates with the FastAPI backend via WebSocket for streaming predictions and REST for cache/health.

## Tech Stack

- **React 19** — Latest with hooks, concurrent rendering
- **Vite 6** — Fast dev server and rolldown-based build
- **TailwindCSS 3** — Utility-first CSS with custom theme (surface/ink/accent colors)
- **ECharts** (`echarts-for-react`) — High-performance time-series charts with zoom, slider, tooltip
- **Lucide React** — Consistent icon library

## Project Structure

```
frontend/
├── src/
│   ├── App.jsx                         # Root: header + global stats + ForecastSite × N
│   ├── main.jsx                        # Entry point
│   ├── index.css                       # Tailwind directives + custom utilities
│   ├── components/
│   │   ├── ForecastSite.jsx            # ** Per-site container **
│   │   │                                # Manages WebSocket, cache loading, chartData merge,
│   │   │                                #   metrics computation (MAE, trend), collapsible UI
│   │   ├── ForecastChart.jsx           # ** ECharts wrapper **
│   │   │                                # Zoom logic, toolbar (horizon selector, date filter,
│   │   │                                #   start/stop/clear, PNG export, reset view), responsive
│   │   ├── GlobalStats.jsx             # System stat cards (models, sites, posts, processes, status)
│   │   ├── Header.jsx                  # App header + live badges + dark/light toggle
│   │   ├── HorizonSelector.jsx         # Horizon button group (1H/1D/3D/1W/1M)
│   │   └── ErrorBoundary.jsx           # Catches render errors per site
│   └── context/
│       └── ThemeContext.jsx             # Dark mode provider, toggles `dark` class on <html>
├── tailwind.config.js                  # Custom colors, shadows, fonts
├── vite.config.js
└── package.json
```

## Component Architecture

### App.jsx
```
<Header />
<GlobalStats />           ← fetches /api/health every 15s
<ForecastSite site="ft" label="Foum Tizi" … />
<ForecastSite site="of" label="Oulad Fares" … />
<footer />
```

### ForecastSite — State & Data Flow

```
User clicks Start
  └─► WebSocket connects to /ws/forecast/{site}/{horizon}
       ├─ "init" message → sets progress.total
       ├─ "horizon_update" messages (one per horizon window) →
       │     setForecastData(newData)         ← latest window
       │     setAllHistorical(prev + new)     ← cumulative actuals
       │     setPrevForecasts(prev + old)     ← previous window forecasts
       └─ "complete" → streaming done

chartData computed from:
  allHistorical (actuals) + prevForecasts (earlier forecasts) + forecastData.forecast (latest)

Metrics computed from chartData:
  MAE        ← |actual - prevForecast| averaged over overlapping points
  Trend      ← first-half vs second-half average of forecasted values (>1% diff)
```

### ForecastChart — Zoom Logic

- On first load / horizon change: `zoomRef` sets default view = forecast start − 2×horizon to forecast end
- On new data arriving (auto-tracking): same default recomputed, updates `zoomRef` — *unless* user has interacted
- On user zoom/pan: `interacted = true` flag set, auto-tracking stops
- Reset button: clears `interacted`, calls `getDefaultZoom()`, forces re-render via `zoomEpoch` state
- Date range filter: sets absolute `startValue/endValue`, sets `interacted = true`
- Slider is hidden on mobile (`< 768px`)

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `< 768px`  | Chart + metrics stack vertically, slider hidden, smaller fonts/tighter margins |
| `≥ 768px`  | 80/20 horizontal split, slider visible |
| `≥ 1024px` | Global stats in 4 columns, info grid in 6 columns |

## Development

```bash
npm install
npm run dev       # → http://localhost:5173
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

## Configuration

- **Backend URL**: Update `WS_BASE` and `API_BASE` in `ForecastSite.jsx` and `GlobalStats.jsx` (default `localhost:8001`)
- **Accent colors**: Defined per-site via `accent` prop (`"cyan"`, `"emerald"`, etc.) mapped in `ForecastChart.jsx`
- **Horizons**: Defined in `HorizonSelector.jsx` and `ForecastChart.jsx` (steps, axis interval, window size)
- **New site**: Add a `<ForecastSite>` in `App.jsx` + add config in `backend/SITES_CONFIG`
