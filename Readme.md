# SmartEMS Forecasting Platform

**SmartEMS (Energy Management System)** is an AI-powered energy forecasting dashboard that monitors and predicts energy consumption across multiple sites. It combines a polished React frontend with interactive time-series visualizations and a FastAPI backend designed to serve predictions from pre-trained ML models (LightGBM, XGBoost).

The project is a **monorepo** with three main areas:

- **Frontend** — Fully functional React + Vite + Tailwind CSS dashboard with interactive charts, KPI cards, and realistic synthetic mock data.
- **Backend** — FastAPI skeleton (placeholder) ready for ML model integration, with planned REST endpoints for serving forecasts.
- **Models** — Pre-trained `.joblib` models referenced by the backend (LightGBM and XGBoost, with/without CEEMD feature decomposition).

---

## Architecture & Data Flow

1. **Entry** — `index.html` loads the Vite-bundled React app via `src/main.jsx`.
2. **Dashboard Layout** — `App.jsx` renders a header and a list of `<ForecastSection>` components — one per energy site.
3. **Per-Site State** — Each `<ForecastSection>` manages its own forecast horizon, loading state, generated data, and computed metrics.
4. **Data Simulation** — On mount or horizon change, `generateEnergyData()` produces synthetic time-series with realistic daily seasonality (higher during business hours), weekly patterns (lower on weekends), random noise, and accuracy degradation over time.
5. **KPI Calculation** — `calculateMetrics()` derives metrics like current consumption, min/max forecast, accuracy, and data point count from the generated data.
6. **Rendering** — Data flows into `<ForecastChart>` (Recharts ComposedChart with brush zoom/pan) and 6 `<MetricCard>` components per site.
7. **Future Backend** — Mock data is a placeholder; planned API endpoints will replace it with real ML model predictions.

---

## Features

### Dashboard

- **4 Energy Sites** — Solar Farm Alpha (50 MW), Wind Park Beta (75 MW), Hydro Station Gamma (100 MW), Industrial Complex Delta (200 MW)
- **Collapsible Site Sections** — Expand/collapse per site to keep the interface clean
- **5 Forecast Horizons** — Toggle between 1 hour, 1 day, 3 days, 1 week, and 1 month
- **Interactive Charts** — Recharts ComposedChart with:
  - Area fills for historical (blue) and forecast (green) data
  - Solid line for historical values, dashed line for forecast
  - Reference line marking "Now"
  - Brush slider for time-range zoom/pan
  - Custom tooltip with colored indicator dots
- **6 KPI Metric Cards** per site:
  - Current Consumption (MW)
  - Average Forecast (MW)
  - Min / Max Forecast (MW)
  - Forecast Accuracy (%) with trend badge
  - Data Points (hours)
- **Simulated Loading States** — 800ms API delay emulation with spinner animations
- **Live Status Indicator** — Header shows online/offline status, last-updated timestamp, and live accuracy reading

### Visual Design

- **Professional Green Theme** — Custom Tailwind `primary` color palette (emerald/green shades)
- **Glassmorphism Effects** — `backdrop-blur`, semi-transparent backgrounds, soft shadow layers
- **Smooth Animations** — Fade-in, slide-up, blob floating backgrounds, shimmer loading effects, pulse status indicators
- **Responsive Layout** — Max-width container, flex-based chart/metrics layout, mobile-friendly collapsible sections

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **UI Framework** | React | ^19.2.6 |
| **Build Tool** | Vite | ^8.0.12 |
| **Styling** | Tailwind CSS | ^3.4.19 |
| **Charts** | Recharts | ^2.15.4 |
| **Icons** | Lucide React | ^0.468.0 |
| **Linting** | ESLint | ^10.3.0 |
| **Backend (planned)** | FastAPI | 0.115.0 |
| **ML Models** | LightGBM, XGBoost (with CEEMD features) | — |

---

## Project Structure

```
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── main.jsx             # App entry point
│   │   ├── App.jsx              # Root component (layout, sections)
│   │   ├── index.css            # Tailwind + custom animations
│   │   ├── utils/
│   │   │   └── mockData.js      # Synthetic data generator & site configs
│   │   └── components/
│   │       ├── Header.jsx            # App header with status/accuracy
│   │       ├── MetricCard.jsx        # KPI card component
│   │       ├── HorizonSelector.jsx   # Forecast horizon toggle buttons
│   │       ├── ForecastChart.jsx     # Interactive Recharts chart
│   │       ├── ForecastSection.jsx   # Collapsible per-site section
│   │       └── LoadingSkeleton.jsx   # Placeholder loading UI
│   ├── public/                  # Static assets
│   ├── index.html               # Vite HTML entry
│   ├── tailwind.config.js       # Custom green theme + animations
│   ├── vite.config.js           # Vite + React config
│   └── package.json             # Dependencies & scripts
├── backend/                     # FastAPI backend (placeholder)
│   ├── main.py                  # API skeleton with CORS + health endpoint
│   └── requirements.txt         # Python dependencies
├── Models/                      # Pre-trained .joblib ML models (referenced)
├── INSTALL.md                   # Installation guide
└── Readme.md                    # This file
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9

### Install & Run

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
cd frontend
npm run build
npm run preview    # Serve the production build locally
```

### Backend (Placeholder)

The backend is a minimal FastAPI skeleton. To run it:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## Backend & ML Model Integration

The backend is structured but not yet fully implemented. Planned endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sites` | List all energy sites |
| `GET` | `/api/forecast/{site_id}` | Get forecast for a specific site |
| `POST` | `/api/forecast/generate` | Generate a new forecast |

The backend is designed to load pre-trained `.joblib` models:
- `lgbm_ceemd&lookback_10_ft.joblib` (LightGBM with CEEMD features)
- `lgbm_NoCeemd&lookback_10_of.joblib` (LightGBM without CEEMD)
- `xgb_ceemd&lookback_10_ft.joblib` (XGBoost with CEEMD)
- `xgb_NoCeemd&lookback_10_of.joblib` (XGBoost without CEEMD)

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
