# SmartEMS Forecasting Backend

## Overview
FastAPI backend for the SmartEMS Forecasting Platform. This will serve the ML models and provide forecasting endpoints.

## Setup (Future Implementation)

### Installation
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Running the Server
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`
API documentation at `http://localhost:8000/docs`

## Planned Endpoints

### GET /api/sites
Get all available energy sites with metadata

### GET /api/forecast/{site_id}
Get forecast data for a specific site
- Query params: `horizon` (1h, 1d, 3d, 1w, 1m)

### POST /api/forecast/generate
Generate new forecast using ML models
- Body: site_id, horizon, model_type

### GET /api/models/status
Get status and accuracy metrics for all loaded models

## ML Models Integration
The backend will load the models from the `../Models/` directory:
- `lgbm_ceemd&lookback_10_ft.joblib`
- `lgbm_NoCeemd&lookback_10_of.joblib`
- `xgb_ceemd&lookback_10_ft.joblib`
- `xgb_NoCeemd&lookback_10_of.joblib`

## Future Implementation Tasks
- [ ] Model loading and inference pipeline
- [ ] Data preprocessing and feature engineering
- [ ] CEEMD decomposition integration
- [ ] Database integration for historical data
- [ ] Caching layer for predictions
- [ ] Authentication and authorization
- [ ] Rate limiting
- [ ] Monitoring and logging
