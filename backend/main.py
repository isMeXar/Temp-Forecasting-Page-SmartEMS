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

# Current forecasting state
CURRENT_HORIZON_INDEX = 0
HORIZON_MAP = {
    "1h": 6,
    "1d": 144,
    "3d": 432,
    "1w": 1008,
    "1m": 4320
}

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
        "training_end": str(DF.index[SPLIT_IDX]) if DF is not None else None
    }

@app.websocket("/ws/forecast/{horizon}")
async def websocket_forecast(websocket: WebSocket, horizon: str):
    """
    Real-time streaming forecast via WebSocket
    Forecasts one horizon at a time and streams updates
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
            "total_points": total_available
        })
        
        # Stream each horizon
        while current_position < len(Y) and horizon_index < max_horizons:
            forecast_start = current_position
            forecast_end = min(current_position + horizon_steps, len(Y))
            
            # Historical context
            hist_start = max(0, current_position - context_steps)
            historical = [
                {
                    "timestamp": str(DF.index[i]),
                    "actual": float(Y[i]) if i < SPLIT_IDX else None,
                    "forecasted": None
                }
                for i in range(hist_start, current_position)
            ]
            
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
                memory.append(Y[t])  # Use real data for next lookback
                
                # Small delay to simulate real-time
                await asyncio.sleep(0.01)
            
            # Forecast data
            forecast = [
                {
                    "timestamp": str(DF.index[forecast_start + i]),
                    "actual": None,
                    "forecasted": float(preds[i])
                }
                for i in range(len(preds))
            ]
            
            # Send horizon update
            await websocket.send_json({
                "type": "horizon_update",
                "horizon_index": horizon_index,
                "current_position": current_position,
                "forecast_start": str(DF.index[forecast_start]),
                "forecast_end": str(DF.index[forecast_end - 1]),
                "historical": historical,
                "forecast": forecast,
                "stats": {
                    "min_forecast": float(np.min(preds)),
                    "max_forecast": float(np.max(preds)),
                    "mean_forecast": float(np.mean(preds))
                }
            })
            
            # Move to next horizon
            current_position = forecast_end
            horizon_index += 1
            
            # Wait a bit before next horizon
            await asyncio.sleep(1)
        
        # Send completion
        await websocket.send_json({
            "type": "complete",
            "total_horizons": horizon_index,
            "message": "Forecasting complete"
        })
        
    except WebSocketDisconnect:
        print("Client disconnected")
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
