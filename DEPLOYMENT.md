# 🚀 SmartEMS Deployment Guide

Complete guide to deploy the Foum Tizi Energy Forecasting Platform.

## Prerequisites

### Required Software

- **Python 3.8+** with pip
- **Node.js 18+** with npm
- **Git** (optional)

### System Requirements

- Windows, Linux, or macOS
- 4GB RAM minimum
- 2GB free disk space

## Step-by-Step Installation

### 1. Backend Setup

#### Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

#### Verify Model and Data Files

Ensure these files exist:
- `backend/Models/xgb_NoCeemd&lookback_10_ft.joblib`
- `backend/Data/CourbeDeCharge_10min_24.csv`

#### Test Backend

```bash
# Start the server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open browser to `http://localhost:8000` - you should see:
```json
{
  "message": "SmartEMS Forecasting API - Foum Tizi",
  "status": "online",
  "version": "1.0.0",
  "site": "Foum Tizi",
  "model": "XGBoost"
}
```

#### Run API Tests

In a new terminal (while backend is running):
```bash
cd backend
python test_api.py
```

You should see all tests pass with ✓ marks.

### 2. Frontend Setup

#### Install Node Dependencies

```bash
cd frontend
npm install
```

#### Start Development Server

```bash
npm run dev
```

Frontend will be available at `http://localhost:5173`

### 3. Verify Full Stack

1. **Backend running**: `http://localhost:8000`
2. **Frontend running**: `http://localhost:5173`
3. Open frontend in browser
4. You should see the Foum Tizi dashboard with real data
5. Click horizon buttons (1H, 1D, 3D, 1W, 1M) to test different forecasts

## Quick Start Scripts

### Windows

Use the provided batch scripts:

```bash
# Terminal 1: Start Backend
start-backend.bat

# Terminal 2: Start Frontend
start-frontend.bat
```

### Linux/macOS

Create equivalent shell scripts:

**start-backend.sh**:
```bash
#!/bin/bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**start-frontend.sh**:
```bash
#!/bin/bash
cd frontend
npm run dev
```

Make executable:
```bash
chmod +x start-backend.sh start-frontend.sh
```

## Production Deployment

### Backend Production

Use Gunicorn or similar ASGI server:

```bash
cd backend
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```

### Frontend Production Build

```bash
cd frontend
npm run build
```

The optimized files will be in `frontend/dist/`. Deploy these to:
- **Nginx** or **Apache** static hosting
- **Vercel** / **Netlify** for easy deployment
- **Docker** container

#### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Docker Deployment (Optional)

### Backend Dockerfile

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Dockerfile

Create `frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - PYTHONUNBUFFERED=1

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

Run with:
```bash
docker-compose up -d
```

## Troubleshooting

### Backend Issues

**Error: Model file not found**
- Verify `backend/Models/xgb_NoCeemd&lookback_10_ft.joblib` exists
- Check file permissions

**Error: Data file not found**
- Verify `backend/Data/CourbeDeCharge_10min_24.csv` exists
- Check CSV format (must have `timestamp` and `FT` columns)

**Port 8000 already in use**
```bash
# Find process
netstat -ano | findstr :8000  # Windows
lsof -i :8000                 # Linux/macOS

# Kill process or use different port
python -m uvicorn main:app --port 8001
```

### Frontend Issues

**Error: Cannot connect to backend**
- Ensure backend is running on port 8000
- Check `frontend/src/App.jsx` has correct API_BASE URL
- Verify CORS settings in `backend/main.py`

**Port 5173 already in use**
```bash
# Vite will automatically try next available port
# Or specify a different port
npm run dev -- --port 3000
```

### Data Issues

**Forecast looks wrong**
- Verify the split_idx in model matches your data
- Check feature engineering matches training
- Clear cache: `POST http://localhost:8000/api/forecast/clear-cache`

## Performance Optimization

### Backend

1. **Enable caching** (already implemented)
2. **Use production ASGI server** (Gunicorn, Hypercorn)
3. **Add Redis** for distributed caching
4. **Precompute forecasts** on startup

### Frontend

1. **Enable compression** in Vite config
2. **Lazy load charts** for large datasets
3. **Debounce API calls** when switching horizons
4. **Use service workers** for offline support

## Monitoring

### Health Checks

Monitor these endpoints:
- `GET /api/health` - Backend health
- `GET /` - API status

### Metrics to Track

- Response time per horizon
- Forecast accuracy over time
- API error rates
- Memory usage

## Security

### Production Checklist

- [ ] Change CORS origins from `localhost` to your domain
- [ ] Add API rate limiting
- [ ] Enable HTTPS/TLS
- [ ] Set secure headers
- [ ] Use environment variables for config
- [ ] Implement authentication if needed

### Example Security Updates

In `backend/main.py`:

```python
# Production CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

## Support

For issues or questions:
1. Check logs: backend console and browser DevTools
2. Verify all prerequisites are installed
3. Test API endpoints manually with curl/Postman
4. Review model and data file formats

---

**Happy Forecasting!** ⚡
