# SmartEMS Energy Forecasting Platform

Real-time multi-site energy forecasting dashboard powered by XGBoost. Streams predictions over WebSocket, visualizes historical vs forecasted load curves with ECharts, and provides per-horizon accuracy metrics.

## Architecture

```
┌─────────────────────┐      WebSocket (horizon_update)      ┌──────────────────────┐
│                     │ ◄────────────────────────────────── │                      │
│   React Frontend    │      GET /api/health, /cache/*       │   FastAPI Backend    │
│   (Vite + Tailwind) │ ◄────────────────────────────────── │   (Python 3.10+)     │
│                     │                                      │                      │
│  ForecastSite.jsx   │                                      │  main.py             │
│  ForecastChart.jsx  │                                      │  XGBoost models      │
│  GlobalStats.jsx    │                                      │  CourbeDeCharge.csv  │
└─────────────────────┘                                      └──────────────────────┘
```

| Layer | Technology | Role |
|-------|-----------|------|
| **Backend** | FastAPI + XGBoost | Load models, generate recursive forecasts, cache results |
| **Frontend** | React 19 + Vite + TailwindCSS 3 | Real-time charts, metrics panel, multi-site UI |
| **Communication** | WebSocket (`/ws/forecast/{site}/{horizon}`) | Stream horizon-by-horizon predictions + REST for cache/health |

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
# → http://localhost:8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## Features

- **Multi-site forecasting** — Currently Foum Tizi (`ft`) and Oulad Fares (`of`), each with its own XGBoost model and data column
- **5 forecast horizons** — 1 hour / 1 day / 3 days / 1 week / 1 month
- **Blind recursive forecasting** — Each horizon window is predicted autoregressively (predicted values feed back as input, not ground truth)
- **Real-time streaming** — WebSocket pushes each completed horizon to the frontend as it's generated
- **Caching + Resume** — Forecasts are cached to disk; disconnecting and reconnecting resumes from the last cached point
- **Interactive ECharts** — Zoom, pan, date-range filter, PNG export, auto-tracking viewport
- **Per-site metrics** — Mean, max, min, range, std dev, trend direction, MAE, MAPE
- **Dark / light mode** — Theme toggle persisted via context
- **Responsive** — Stacks vertically on mobile, hides slider, scales fonts and grids
- **Global system cards** — Models loaded, sites, processes, posts, system status (live-ping indicator)

## Project Structure

```
SmartEMS/
├── backend/
│   ├── main.py                 # FastAPI app: models, WS, REST, cache
│   ├── requirements.txt
│   ├── README.md
│   ├── Data/
│   │   └── CourbeDeCharge_10min_24.csv
│   ├── Models/
│   │   ├── xgb_NoCeemd&lookback_10_ft.joblib
│   │   └── xgb_NoCeemd&lookback_10_of.joblib
│   └── forecast_cache/         # Created at runtime
│       ├── forecasts_ft.json
│       └── forecasts_of.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ForecastSite.jsx    # Per-site container (WS, state, chart, metrics)
│   │   │   ├── ForecastChart.jsx   # ECharts wrapper (zoom, toolbar, responsive)
│   │   │   ├── GlobalStats.jsx     # System-level stat cards
│   │   │   ├── Header.jsx          # App header + theme toggle
│   │   │   ├── HorizonSelector.jsx # Horizon button group
│   │   │   └── ErrorBoundary.jsx   # React error boundary
│   │   ├── context/
│   │   │   └── ThemeContext.jsx     # Dark/light mode provider
│   │   └── index.css               # Tailwind + custom styles
│   ├── tailwind.config.js
│   └── README.md
└── README.md
```
