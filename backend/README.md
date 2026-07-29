# SmartEMS Forecasting Platform — Backend

FastAPI application that loads XGBoost models and streams recursive energy forecasts over WebSocket. Supports multiple sites with independent models and data columns.

## Quick Start

```bash
pip install -r requirements.txt
python main.py
# → http://localhost:8001
# → Swagger docs at http://localhost:8001/docs
```

## Data Files Required

```
Data/
  CourbeDeCharge_10min_24.csv     ← 10-min resolution load data, must have `timestamp`,
                                     `FT` and `OF` columns (configurable per site)
Models/
  xgb_NoCeemd&lookback_10_ft.joblib   ← XGBoost for Foum Tizi
  xgb_NoCeemd&lookback_10_of.joblib   ← XGBoost for Oulad Fares
```

Each `.joblib` file contains a 3-tuple: `(model, scaler, split_idx)` where `split_idx` is the index in the CSV that separates training from testing.

## Configuration

### Sites (`SITES_CONFIG`)

```python
{
    "ft": { "model_path": "Models/...ft.joblib", "data_column": "FT", "label": "Foum Tizi" },
    "of": { "model_path": "Models/...of.joblib", "data_column": "OF", "label": "Oulad Fares" },
}
```

Add a new entry to support additional sites.

### Horizons (`HORIZON_MAP`)

| Key | Steps (10-min) | Duration |
|-----|----------------|----------|
| `1h` | 6 | 1 hour |
| `1d` | 144 | 1 day |
| `3d` | 432 | 3 days |
| `1w` | 1008 | 1 week |
| `1m` | 4320 | 1 month |

Each horizon also has a `CONTEXT_MAP` defining how many historical data points to send as reference (for chart context before the forecast window).

## Forecasting Pipeline

```
Start at split_idx
  │
  ├─ Lookback = last 4320 actual values (30 days @ 10min)
  │
  ├─ For each horizon window of N steps:
  │     │
  │     ├─ For t in 0..N-1:
  │     │     ├─ Scale last 4320 values from lookback buffer
  │     │     ├─ Concat with feature vector (hour, dow, weekend, winter, cycle, season)
  │     │     ├─ model.predict(X) → scaled prediction
  │     │     ├─ Inverse-transform → actual-scale kW
  │     │     ├─ Append prediction to lookback (blind recursive — **no ground truth**)
  │     │
  │     ├─ Compute stats (min, max, mean, std, median, MAPE)
  │     ├─ Save to cache
  │     └─ Send "horizon_update" via WebSocket
  │
  └─ Advance lookback by N steps (includes real actuals from just-forecasted window)
       Repeat until data exhausted
```

**Key detail**: Within a horizon window, predictions are fed back recursively (`memory.append(p)` not `memory.append(y[t])`). After the window completes, the lookback advances by the full window length using the real actuals from `y`. This gives a clean test of model skill — each horizon is blind, and the next horizon starts from known ground truth.

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Root status page (HTML) |
| `GET` | `/api/health` | System health: models loaded, sites, cached counts, posts, processes, status |
| `GET` | `/api/cache/status/{site}/{horizon}` | Cache state for a site+horizon (last index, count, can_resume) |
| `GET` | `/api/cache/forecasts/{site}/{horizon}` | All cached forecast data for a site+horizon |
| `POST` | `/api/cache/clear/{site}/{horizon}` | Clear cache for a specific site+horizon |
| `POST` | `/api/cache/clear/all` | Clear all cached forecasts |

## WebSocket

```
ws://localhost:8001/ws/forecast/{site}/{horizon}
```

### Protocol

**1. Server → Client: `init`**

```json
{
  "type": "init",
  "site": "ft",
  "training_end": "2024-01-15 00:00:00",
  "horizon": "1d",
  "horizon_steps": 144,
  "max_horizons": 208,
  "total_points": 30000,
  "resume_from": 0,
  "cached_count": 0
}
```

**2. Server → Client: `horizon_update`** (one per horizon window)

```json
{
  "type": "horizon_update",
  "from_cache": false,
  "horizon_index": 0,
  "current_position": 4320,
  "forecast_start": "2024-01-15 00:00:00",
  "forecast_end": "2024-01-16 00:00:00",
  "historical": [ /* N context points before forecast */ ],
  "forecast": [ /* N predicted points */ ],
  "stats": {
    "min_forecast": 120.5,
    "max_forecast": 380.2,
    "mean_forecast": 250.1,
    "std_forecast": 45.3,
    "median_forecast": 245.0,
    "mape": 8.7
  }
}
```

If `from_cache` is `true`, the data is replayed from a previous session. When resuming, cached forecasts are sent first (with `"is_resume": true`), then new ones are generated.

**3. Server → Client: `complete`**

```json
{ "type": "complete", "total_horizons": 208, "message": "Forecasting complete" }
```

**4. Server → Client: `error`** (on failure)

```json
{ "type": "error", "message": "..." }
```

### Resume Flow

1. Client fetches `GET /api/cache/status/{site}/{horizon}` before connecting
2. If `can_resume` is true, client shows "Resume" button
3. On connect, server loads cache, increments `start_index`, replays cached horizons, then continues from where it left off
4. Position is computed as `split_idx + horizon_index * horizon_steps`, verified against the last cached entry

## Cache System

- Each site has its own JSON file: `forecast_cache/forecasts_{site}.json`
- Format: `{ "1d": { "forecasts": [...] }, "1w": { "forecasts": [...] }, ... }`
- Forecasts are stored with all their fields (historical, forecast, stats)
- On save, if `horizon_index < len(forecasts)`, it replaces in place (supports overlapping/re-forecasting)
- Cache clearing is per-horizon or per-site

## Feature Engineering

For each prediction, the model receives:

```
Input = [scaled_last_4320_values (4320)] + [features (5)]
```

Features derived from the timestamp:
- **Hour** (0–23, scaled)
- **Day of week** (0–6, scaled)
- **Weekend** (binary)
- **Winter** (Oct–Mar binary)
- **Cycle** — time-of-use period (0/1/2): peak hours × season
- **Season** (0–3): quarter-based

All features are fed through `MinMaxScaler`.
