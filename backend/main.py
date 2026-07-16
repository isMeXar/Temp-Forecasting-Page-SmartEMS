"""
FastAPI Backend for SmartEMS Forecasting Platform
Real-time streaming forecasting with WebSocket
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model and data
MODEL = None
SCALER = None
SPLIT_IDX = None
DF = None
Y = None
FEATS = None
LOOKBACK = 4320

# Cache directory and file
CACHE_DIR = Path("forecast_cache")
CACHE_DIR.mkdir(exist_ok=True)
CACHE_FILE = CACHE_DIR / "forecasts.json"

# Current forecasting state
CURRENT_HORIZON_INDEX = 0
HORIZON_MAP = {
    "1h": 6,
    "1d": 144,
    "3d": 432,
    "1w": 1008,
    "1m": 4320
}

def load_cache():
    """Load entire cache from single JSON file"""
    if CACHE_FILE.exists():
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_cache(cache):
    """Save entire cache to single JSON file"""
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)

def save_forecast_to_cache(horizon: str, horizon_index: int, data: dict):
    """Save forecast data to cache"""
    cache = load_cache()
    
    if horizon not in cache:
        cache[horizon] = {"forecasts": []}
    
    cache[horizon]["forecasts"].append(data)
    save_cache(cache)
    
    print(f"✓ Saved forecast {horizon}[{horizon_index}] to cache")

def load_forecasts_from_cache(horizon: str):
    """Load all forecasts for a horizon"""
    cache = load_cache()
    return cache.get(horizon, {}).get("forecasts", [])

def get_cached_progress(horizon: str):
    """Get the last cached horizon index"""
    forecasts = load_forecasts_from_cache(horizon)
    return len(forecasts) - 1 if forecasts else -1

def clear_cache(horizon: str = None):
    """Clear cached forecasts"""
    if horizon:
        cache = load_cache()
        if horizon in cache:
            del cache[horizon]
            save_cache(cache)
        print(f"✓ Cleared cache for {horizon}")
    else:
        if CACHE_FILE.exists():
            CACHE_FILE.unlink()
        print(f"✓ Cleared all cache")

def load_model_and_data():
    """Load XGBoost model and prepare data"""
    global MODEL, SCALER, SPLIT_IDX, DF, Y, FEATS
    
    model_path = Path("Models/xgb_NoCeemd&lookback_10_ft.joblib")
    data_path = Path("Data/CourbeDeCharge_10min_24.csv")
    
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    if not data_path.exists():
        raise FileNotFoundError(f"Data not found: {data_path}")
    
    # Load model
    MODEL, SCALER, SPLIT_IDX = joblib.load(model_path)
    
    # Load and prepare data
    df = pd.read_csv(data_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").set_index("timestamp")
    df["FT"] = df["FT"].astype(float).interpolate(method="time")
    
    DF = df
    Y = df["FT"].values
    
    # Generate features
    hour = df.index.hour.values
    dow = df.index.dayofweek.values
    month = df.index.month.values
    weekend = (dow >= 5).astype(int)
    winter = np.isin(month, [10, 11, 12, 1, 2, 3]).astype(int)
    
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
    
    FEATS = MinMaxScaler().fit_transform(
        np.column_stack([hour, dow, weekend, winter, cycle, season])
    )
    
    print(f"✓ Model loaded successfully")
    print(f"✓ Training ended: {df.index[SPLIT_IDX-1]}")
    print(f"✓ Data available until: {df.index[-1]}")
    print(f"✓ Total points after training: {len(Y) - SPLIT_IDX}")

@app.on_event("startup")
async def startup_event():
    """Initialize model on startup"""
    try:
        load_model_and_data()
    except Exception as e:
        print(f"ERROR loading model: {e}")

@app.get("/")
async def root():
    return {
        "message": "SmartEMS Forecasting API - Foum Tizi",
        "status": "online",
        "version": "1.0.0",
        "site": "Foum Tizi",
        "model": "XGBoost"
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "models_loaded": MODEL is not None,
        "site": "Foum Tizi",
        "data_points": len(Y) if Y is not None else 0,
        "training_end": str(DF.index[SPLIT_IDX]) if DF is not None else None,
        "cache_dir": str(CACHE_DIR),
        "cache_file": str(CACHE_FILE)
    }

@app.get("/api/cache/status/{horizon}")
async def cache_status(horizon: str):
    """Get cache status for a horizon"""
    if horizon not in HORIZON_MAP:
        raise HTTPException(status_code=400, detail="Invalid horizon")
    
    forecasts = load_forecasts_from_cache(horizon)
    last_cached = len(forecasts) - 1 if forecasts else -1
    
    return {
        "horizon": horizon,
        "last_cached_index": last_cached,
        "cached_count": len(forecasts),
        "can_resume": len(forecasts) > 0
    }

@app.post("/api/cache/clear/{horizon}")
async def clear_horizon_cache(horizon: str):
    """Clear cache for specific horizon"""
    if horizon not in HORIZON_MAP:
        raise HTTPException(status_code=400, detail="Invalid horizon")
    
    clear_cache(horizon)
    return {"message": f"Cache cleared for {horizon}"}

@app.post("/api/cache/clear")
async def clear_all_cache():
    """Clear all cached forecasts"""
    clear_cache()
    return {"message": "All cache cleared"}

@app.websocket("/ws/forecast/{horizon}")
async def websocket_forecast(websocket: WebSocket, horizon: str):
    """
    Real-time streaming forecast via WebSocket
    Forecasts one horizon at a time and streams updates
    Supports pause/resume via caching
    """
    await websocket.accept()
    
    if MODEL is None:
        await websocket.send_json({"error": "Model not loaded"})
        await websocket.close()
        return
    
    if horizon not in HORIZON_MAP:
        await websocket.send_json({"error": f"Invalid horizon: {horizon}"})
        await websocket.close()
        return
    
    horizon_steps = HORIZON_MAP[horizon]
    
    # Context windows
    context_map = {
        "1h": 144,
        "1d": 432,
        "3d": 1008,
        "1w": 4320,
        "1m": 21600
    }
    context_steps = context_map[horizon]
    
    try:
        # Check if we can resume from cache
        cached_forecasts = load_forecasts_from_cache(horizon)
        start_index = len(cached_forecasts)
        
        # Start from where training ended
        current_position = SPLIT_IDX
        horizon_index = 0
        
        # Calculate total horizons available
        total_available = len(Y) - SPLIT_IDX
        max_horizons = total_available // horizon_steps
        
        # Send initial info
        await websocket.send_json({
            "type": "init",
            "training_end": str(DF.index[SPLIT_IDX]),
            "horizon": horizon,
            "horizon_steps": horizon_steps,
            "max_horizons": max_horizons,
            "total_points": total_available,
            "resume_from": start_index,
            "cached_count": len(cached_forecasts)
        })
        
        # If resuming, send the last cached forecast to display current state
        if cached_forecasts:
            last_cached = cached_forecasts[-1]
            await websocket.send_json({
                "type": "horizon_update",
                "from_cache": True,
                "is_resume": True,
                **last_cached
            })
        
        # Continue from where cache left off
        horizon_index = start_index
        current_position = SPLIT_IDX + (horizon_index * horizon_steps)
        
        # Stream each new horizon
        while current_position < len(Y) and horizon_index < max_horizons:
            forecast_start = current_position
            forecast_end = min(current_position + horizon_steps, len(Y))
            
            # Historical context - show actual data up to current_position
            hist_start = max(0, current_position - context_steps)
            historical = []
            
            for i in range(hist_start, current_position):
                show_actual = i < SPLIT_IDX or i >= SPLIT_IDX
                
                historical.append({
                    "timestamp": str(DF.index[i]),
                    "actual": float(Y[i]) if show_actual else None,
                    "forecasted": None
                })
            
            # Forecast this horizon
            memory = Y[forecast_start - LOOKBACK:forecast_start].tolist()
            preds = []
            
            for t in range(forecast_start, forecast_end):
                values = SCALER.transform(np.array(memory[-LOOKBACK:]).reshape(-1, 1)).flatten()
                cal = FEATS[t - LOOKBACK:t].flatten()
                X = np.concatenate([values, cal]).reshape(1, -1)
                p = MODEL.predict(X)[0]
                p = SCALER.inverse_transform([[p]])[0, 0]
                preds.append(float(p))
                memory.append(Y[t])
                
                await asyncio.sleep(0.001)
            
            # Forecast data
            forecast = [
                {
                    "timestamp": str(DF.index[forecast_start + i]),
                    "actual": None,
                    "forecasted": float(preds[i])
                }
                for i in range(len(preds))
            ]
            
            # Prepare response
            response_data = {
                "horizon_index": horizon_index,
                "current_position": current_position,
                "forecast_start": str(DF.index[forecast_start]),
                "forecast_end": str(DF.index[forecast_end - 1]),
                "historical": historical,
                "forecast": forecast,
                "stats": {
                    "min_forecast": float(np.min(preds)),
                    "max_forecast": float(np.max(preds)),
                    "mean_forecast": float(np.mean(preds)),
                    "std_forecast": float(np.std(preds)),
                    "median_forecast": float(np.median(preds)),
                    "mape": float(np.mean(np.abs((Y[forecast_start:forecast_end] - preds) / Y[forecast_start:forecast_end])) * 100) if forecast_end <= len(Y) else None
                }
            }
            
            # Save to cache
            save_forecast_to_cache(horizon, horizon_index, response_data)
            
            # Send horizon update
            await websocket.send_json({
                "type": "horizon_update",
                "from_cache": False,
                **response_data
            })
            
            # Move to next horizon
            current_position = forecast_end
            horizon_index += 1
            
            # Wait before next horizon
            await asyncio.sleep(1)
        
        # Send completion
        await websocket.send_json({
            "type": "complete",
            "total_horizons": horizon_index,
            "message": "Forecasting complete"
        })
        
    except WebSocketDisconnect:
        print(f"Client disconnected at horizon {horizon_index}")
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        await websocket.close()

@app.get("/api/horizons")
async def get_horizons():
    """Get available forecast horizons"""
    return {
        "horizons": [
            {"value": "1h", "label": "1 Hour", "steps": 6},
            {"value": "1d", "label": "1 Day", "steps": 144},
            {"value": "3d", "label": "3 Days", "steps": 432},
            {"value": "1w", "label": "1 Week", "steps": 1008},
            {"value": "1m", "label": "1 Month", "steps": 4320}
        ]
    }
