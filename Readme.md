# SmartEMS - Foum Tizi Energy Forecasting Platform

AI-powered energy consumption forecasting using XGBoost for the Foum Tizi site with 10-minute interval predictions.

## 🚀 Quick Start

### Backend Setup

1. Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Start the backend server:
```bash
# Option 1: Using the batch script (Windows)
start-backend.bat

# Option 2: Manual start
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will run at: `http://localhost:8000`

### Frontend Setup

1. Install Node dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
# Option 1: Using the batch script (Windows)
start-frontend.bat

# Option 2: Manual start
cd frontend
npm run dev
```

Frontend will run at: `http://localhost:5173`

## 📊 Features

- **Real-time Forecasting**: XGBoost model predicting energy consumption
- **Multiple Horizons**: 1 hour, 1 day, 3 days, 1 week, 1 month ahead
- **Rolling Forecast**: Model continues from where training stopped
- **10-min Intervals**: High-resolution time series data
- **Cached Results**: JSON-based caching for faster retrieval
- **Interactive Charts**: Visualize actual vs forecasted data

## 🔧 Model Details

- **Model**: XGBoost (`xgb_NoCeemd&lookback_10_ft.joblib`)
- **Lookback Window**: 4320 steps (30 days)
- **Features**: Hour, day of week, weekend, winter, cycle, season
- **Site**: Foum Tizi
- **Data**: 2024 full year with 10-minute intervals

## 📡 API Endpoints

- `GET /` - API status
- `GET /api/health` - Health check
- `GET /api/forecast/{horizon}` - Get forecast for specific horizon
  - Horizons: `1h`, `1d`, `3d`, `1w`, `1m`
- `GET /api/horizons` - List available horizons
- `POST /api/forecast/clear-cache` - Clear forecast cache

## 🎨 Frontend

Built with:
- React + Vite
- Tailwind CSS
- Recharts for visualization
- Lucide icons

## 📁 Project Structure

```
.
├── backend/
│   ├── main.py                 # FastAPI server with forecasting logic
│   ├── requirements.txt        # Python dependencies
│   ├── Data/
│   │   └── CourbeDeCharge_10min_24.csv
│   └── Models/
│       └── xgb_NoCeemd&lookback_10_ft.joblib
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main app component
│   │   ├── components/
│   │   │   ├── ForecastChart.jsx
│   │   │   ├── HorizonSelector.jsx
│   │   │   └── MetricCard.jsx
│   │   └── ...
│   └── package.json
├── start-backend.bat          # Backend startup script
└── start-frontend.bat         # Frontend startup script
```

## 🔄 How It Works

1. Backend loads the XGBoost model and historical data on startup
2. Model generates forecasts using rolling horizon approach
3. Features are extracted (hour, day of week, seasonal patterns, etc.)
4. Frontend fetches forecasts from API and displays them
5. Charts show actual historical data + forecasted values
6. Results are cached for faster subsequent requests

## 💡 Usage

1. Start backend server (port 8000)
2. Start frontend dev server (port 5173)
3. Open browser to `http://localhost:5173`
4. Select forecast horizon (default: 1 day)
5. View actual vs forecasted energy consumption

## 📈 Data Flow

```
Historical Data → Feature Engineering → XGBoost Model → Predictions → API → Frontend → Chart
```

---

**Powered by XGBoost** • **Foum Tizi Energy Site** • **10-min Intervals**
