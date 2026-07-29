"""
FastAPI Backend for SmartEMS Forecasting Platform
Real-time streaming forecasting with WebSocket
Supports multiple sites (FT, OF, ...)
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import json
import asyncio
import os
from datetime import datetime

app = FastAPI(
    title="SmartEMS Forecasting API",
    description="AI-Powered Energy Management & Prediction System",
    version="1.0.0"
)

templates = Jinja2Templates(directory="templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LOOKBACK = 4320  # Number of past 10-min readings to use as model input (30 days)

# Number of forecast steps per horizon: e.g. 1 day = 144 × 10 min = 1440 min
HORIZON_MAP = {
    "1h": 6,
    "1d": 144,
    "3d": 432,
    "1w": 1008,
    "1m": 4320
}

# How many historical points to send to the frontend for chart context
CONTEXT_MAP = {
    "1h": 144,
    "1d": 432,
    "3d": 1008,
    "1w": 4320,
    "1m": 21600
}

# Per-site configuration: model file, CSV column name, display label
SITES_CONFIG = {
    "ft": {
        "model_path": "Models/xgb_NoCeemd&lookback_10_ft.joblib",
        "data_column": "FT",
        "label": "Foum Tizi",
    },
    "of": {
        "model_path": "Models/xgb_NoCeemd&lookback_10_of.joblib",
        "data_column": "OF",
        "label": "Oulad Fares",
    }
}

# Cache directory
CACHE_DIR = Path("forecast_cache")
CACHE_DIR.mkdir(exist_ok=True)

# Runtime site data: populated on startup
sites = {}

# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------
def generate_features(df):
    """Derive time-based features from the DataFrame index (timestamp).

    Returns a 2D array scaled to [0,1] with columns:
      hour, dayofweek, weekend, winter, cycle (TOU period), season (quarter)
    """
    hour = df.index.hour.values
    dow = df.index.dayofweek.values
    month = df.index.month.values
    weekend = (dow >= 5).astype(int)
    winter = np.isin(month, [10, 11, 12, 1, 2, 3]).astype(int)

    # Time-of-use cycle: peak (2), mid-peak (1), off-peak (0)
    # Varies by winter vs summer hours
    cycle = np.select(
        [
            (winter == 1) & (hour >= 17) & (hour < 22),
            (winter == 1) & (hour >= 7) & (hour < 17),
            (winter == 0) & (hour >= 18) & (hour < 23),
            (winter == 0) & (hour >= 7) & (hour < 18)
        ],
        [2, 1, 2, 1],
        default=0
    )

    season = np.select(
        [
            np.isin(month, [12, 1, 2]),
            np.isin(month, [3, 4, 5]),
            np.isin(month, [6, 7, 8]),
            np.isin(month, [9, 10, 11])
        ],
        [0, 1, 2, 3]
    )

    return MinMaxScaler().fit_transform(
        np.column_stack([hour, dow, weekend, winter, cycle, season])
    )

# ---------------------------------------------------------------------------
# Site loading
# ---------------------------------------------------------------------------
def load_site(site_key):
    """Load model + scaler + data for one site.

    Each .joblib file contains a 3-tuple: (model, MinMaxScaler, split_idx).
    split_idx is the row index separating training data from test data.
    The CSV is read, interpolated, and stored alongside derived features.
    """
    config = SITES_CONFIG[site_key]
    model_path = Path(config["model_path"])
    data_path = Path("Data/CourbeDeCharge_10min_24.csv")

    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    if not data_path.exists():
        raise FileNotFoundError(f"Data not found: {data_path}")

    model, scaler, split_idx = joblib.load(model_path)

    df = pd.read_csv(data_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").set_index("timestamp")
    col = config["data_column"]
    df[col] = df[col].astype(float).interpolate(method="time")

    y = df[col].values        # Raw load values
    feats = generate_features(df)  # Pre-computed features for every row

    sites[site_key] = {
        "model": model,
        "scaler": scaler,
        "split_idx": split_idx,
        "df": df,
        "y": y,
        "feats": feats,
        "label": config["label"],
    }

    print(f"? Loaded {config['label']} ({site_key}) — training ended: {df.index[split_idx-1]}, total points after training: {len(y) - split_idx}")

# ---------------------------------------------------------------------------
# Cache layer (JSON file per site)
# ---------------------------------------------------------------------------
# Format: { "1d": { "forecasts": [{horizon_index, forecast_start, ...}, ...] }, ... }

def get_cache_file(site):
    return CACHE_DIR / f"forecasts_{site}.json"

def load_cache(site):
    """Load the full JSON cache for a site. Returns {} if missing or empty."""
    file = get_cache_file(site)
    if file.exists() and file.stat().st_size > 0:
        with open(file, 'r') as f:
            return json.load(f)
    return {}

def save_cache(cache, site):
    file = get_cache_file(site)
    with open(file, 'w') as f:
        json.dump(cache, f, indent=2)

def save_forecast_to_cache(site, horizon, horizon_index, data):
    """Store one horizon's forecast data.

    If horizon_index already exists in the list, replace it in-place
    (supports re-forecasting the same index). Otherwise append.
    """
    cache = load_cache(site)
    if horizon not in cache:
        cache[horizon] = {"forecasts": []}
    forecasts = cache[horizon]["forecasts"]
    if horizon_index < len(forecasts):
        forecasts[horizon_index] = data
    else:
        forecasts.append(data)
    save_cache(cache, site)
    print(f"? Saved {site}/{horizon}[{horizon_index}] to cache")

def load_forecasts_from_cache(site, horizon):
    """Return sorted list of cached forecasts for a (site, horizon)."""
    cache = load_cache(site)
    return cache.get(horizon, {}).get("forecasts", [])

def clear_cache(site=None, horizon=None):
    """Clear cache files. Scope: all / per-site / per-horizon."""
    if site:
        cache = load_cache(site)
        if horizon:
            if horizon in cache:
                del cache[horizon]
                save_cache(cache, site)
            print(f"? Cleared cache for {site}/{horizon}")
        else:
            file = get_cache_file(site)
            if file.exists():
                file.unlink()
            print(f"? Cleared all cache for {site}")
    else:
        for f in CACHE_DIR.glob("forecasts_*.json"):
            f.unlink()
        print(f"? Cleared all site caches")

@app.on_event("startup")
async def startup_event():
    for key in SITES_CONFIG:
        try:
            load_site(key)
        except Exception as e:
            print(f"ERROR loading {key}: {e}")

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "site": "SmartEMS",
            "model": "XGBoost",
            "version": "1.0.0",
            "status": "Online",
        },
    )

@app.get("/api/health")
async def health_check():
    site_details = {}
    total_cached = 0
    for site_id, cfg in sites.items():
        cached_count = 0
        for horizon in HORIZON_MAP:
            forecasts = load_forecasts_from_cache(site_id, horizon)
            cached_count += len(forecasts)
        total_cached += cached_count
        config = SITES_CONFIG[site_id]
        site_details[site_id] = {
            "label": cfg["label"],
            "model": config["model_path"],
            "loaded": True,
            "forecasts_cached": cached_count,
        }
    return {
        "status": "healthy",
        "models_loaded": len(sites),
        "sites": site_details,
        "total_forecasts_cached": total_cached,
        "horizons_available": list(HORIZON_MAP.keys()),
        "data_interval_minutes": 10,
        "posts": 2,
        "processes": 0,
    }

@app.get("/api/cache/status/{site}/{horizon}")
async def cache_status(site: str, horizon: str):
    if site not in SITES_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid site")
    if horizon not in HORIZON_MAP:
        raise HTTPException(status_code=400, detail="Invalid horizon")
    forecasts = load_forecasts_from_cache(site, horizon)
    return {
        "site": site,
        "horizon": horizon,
        "last_cached_index": len(forecasts) - 1 if forecasts else -1,
        "cached_count": len(forecasts),
        "can_resume": len(forecasts) > 0
    }

@app.post("/api/cache/clear/{site}/{horizon}")
async def clear_horizon_cache(site: str, horizon: str):
    if site not in SITES_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid site")
    if horizon not in HORIZON_MAP:
        raise HTTPException(status_code=400, detail="Invalid horizon")
    clear_cache(site, horizon)
    return {"message": f"Cache cleared for {site}/{horizon}"}

@app.post("/api/cache/clear/{site}")
async def clear_site_cache(site: str):
    if site not in SITES_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid site")
    clear_cache(site)
    return {"message": f"All cache cleared for {site}"}

@app.post("/api/cache/clear")
async def clear_all_cache():
    clear_cache()
    return {"message": "All cache cleared"}

@app.get("/api/cache/forecasts/{site}/{horizon}")
async def get_cached_forecasts(site: str, horizon: str):
    if site not in SITES_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid site")
    if horizon not in HORIZON_MAP:
        raise HTTPException(status_code=400, detail="Invalid horizon")
    forecasts = load_forecasts_from_cache(site, horizon)
    return {"site": site, "horizon": horizon, "forecasts": forecasts, "count": len(forecasts)}

@app.get("/api/horizons")
async def get_horizons():
    return {
        "horizons": [
            {"value": "1h", "label": "1 Hour", "steps": 6},
            {"value": "1d", "label": "1 Day", "steps": 144},
            {"value": "3d", "label": "3 Days", "steps": 432},
            {"value": "1w", "label": "1 Week", "steps": 1008},
            {"value": "1m", "label": "1 Month", "steps": 4320}
        ]
    }

@app.websocket("/ws/forecast/{site}/{horizon}")
async def websocket_forecast(websocket: WebSocket, site: str, horizon: str):
    """Stream recursive forecasts for one (site, horizon) over WebSocket.

    Protocol:
      1. Send "init" with metadata (horizon steps, total count, resume info)
      2. If cache exists, replay cached forecasts as "horizon_update" (from_cache=True)
      3. For each remaining horizon window, blind-recursively forecast N steps:
           - Use 30-day lookback of actuals
           - Predict one step at a time, feeding back the prediction (not actual)
           - Send "horizon_update" with forecast array + stats
      4. Send "complete" when done
    """
    await websocket.accept()

    if site not in sites:
        await websocket.send_json({"error": f"Site '{site}' not loaded"})
        await websocket.close()
        return

    if horizon not in HORIZON_MAP:
        await websocket.send_json({"error": f"Invalid horizon: {horizon}"})
        await websocket.close()
        return

    sd = sites[site]
    model = sd["model"]
    scaler = sd["scaler"]
    split_idx = sd["split_idx"]
    df = sd["df"]
    y = sd["y"]
    feats = sd["feats"]

    horizon_steps = HORIZON_MAP[horizon]
    context_steps = CONTEXT_MAP[horizon]

    try:
        cached_forecasts = load_forecasts_from_cache(site, horizon)
        start_index = len(cached_forecasts)

        current_position = split_idx
        horizon_index = 0

        total_available = len(y) - split_idx
        max_horizons = total_available // horizon_steps

        await websocket.send_json({
            "type": "init",
            "site": site,
            "training_end": str(df.index[split_idx]),
            "horizon": horizon,
            "horizon_steps": horizon_steps,
            "max_horizons": max_horizons,
            "total_points": total_available,
            "resume_from": start_index,
            "cached_count": len(cached_forecasts)
        })

        if cached_forecasts:
            for cached in cached_forecasts:
                await websocket.send_json({
                    "type": "horizon_update",
                    "from_cache": True,
                    "is_resume": True,
                    **cached
                })
                await asyncio.sleep(0.02)

        if start_index > 0:
            last_cached = cached_forecasts[-1]
            if last_cached.get("horizon_index") != start_index - 1:
                print(f"? {site}: Last cached forecast index mismatch (expected {start_index - 1}, got {last_cached.get('horizon_index')}), adjusting...")
                start_index = last_cached.get("horizon_index", -1) + 1
                cached_forecasts = load_forecasts_from_cache(site, horizon)[:start_index]

        horizon_index = start_index
        current_position = split_idx + (horizon_index * horizon_steps)

        while current_position < len(y) and horizon_index < max_horizons:
            forecast_start = current_position
            forecast_end = min(current_position + horizon_steps, len(y))

            # Build the historical context array for chart display
            hist_start = max(0, current_position - context_steps)
            historical = []

            for i in range(hist_start, current_position):
                show_actual = i < split_idx or i >= split_idx
                historical.append({
                    "timestamp": str(df.index[i]),
                    "actual": float(y[i]) if show_actual else None,
                    "forecasted": None
                })

            # Initial lookback: 30 days of actuals before forecast start
            memory = y[forecast_start - LOOKBACK:forecast_start].tolist()
            preds = []

            # --- Blind recursive forecast ---
            # For each step, predict using the last 4320 values from the
            # lookback buffer. The prediction is then appended to the buffer
            # for use in the next step — ground truth is NOT fed back.
            for t in range(forecast_start, forecast_end):
                # Scale the lookback window
                values = scaler.transform(np.array(memory[-LOOKBACK:]).reshape(-1, 1)).flatten()
                cal = feats[t - LOOKBACK:t].flatten()
                X = np.concatenate([values, cal]).reshape(1, -1)
                p = model.predict(X)[0]
                p = scaler.inverse_transform([[p]])[0, 0]
                preds.append(float(p))
                memory.append(p)  # Feed prediction back, NOT y[t]

            forecast = [
                {
                    "timestamp": str(df.index[forecast_start + i]),
                    "actual": None,
                    "forecasted": float(preds[i])
                }
                for i in range(len(preds))
            ]

            response_data = {
                "horizon_index": horizon_index,
                "current_position": current_position,
                "forecast_start": str(df.index[forecast_start]),
                "forecast_end": str(df.index[forecast_end - 1]),
                "historical": historical,
                "forecast": forecast,
                "stats": {
                    "min_forecast": float(np.min(preds)),
                    "max_forecast": float(np.max(preds)),
                    "mean_forecast": float(np.mean(preds)),
                    "std_forecast": float(np.std(preds)),
                    "median_forecast": float(np.median(preds)),
                    "mape": float(np.mean(np.abs((y[forecast_start:forecast_end] - preds) / y[forecast_start:forecast_end])) * 100) if forecast_end <= len(y) else None
                }
            }

            save_forecast_to_cache(site, horizon, horizon_index, response_data)

            await websocket.send_json({
                "type": "horizon_update",
                "from_cache": False,
                **response_data
            })

            # Advance lookback by the full horizon window, pulling in real
            # actuals from the just-forecasted period for the next iteration
            current_position = forecast_end
            horizon_index += 1
            await asyncio.sleep(1)

        await websocket.send_json({
            "type": "complete",
            "total_horizons": horizon_index,
            "message": "Forecasting complete"
        })

    except WebSocketDisconnect:
        print(f"{site}: Client disconnected at horizon {horizon_index}")
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except RuntimeError:
            pass
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass
