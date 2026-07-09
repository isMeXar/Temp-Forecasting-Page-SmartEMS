@echo off
echo Starting SmartEMS Backend on port 8001...
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
