"""
Quick test script to verify the backend API is working
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    print("Testing /api/health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_forecast(horizon="1d"):
    print(f"\nTesting /api/forecast/{horizon} endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/forecast/{horizon}")
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Forecast points: {len(data.get('forecast', []))}")
        print(f"Historical points: {len(data.get('historical', []))}")
        print(f"Stats: {json.dumps(data.get('stats', {}), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_horizons():
    print("\nTesting /api/horizons endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/horizons")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("SmartEMS Backend API Test")
    print("=" * 60)
    print("\nMake sure backend is running on http://localhost:8000\n")
    
    results = []
    results.append(("Health Check", test_health()))
    results.append(("Horizons List", test_horizons()))
    results.append(("1 Day Forecast", test_forecast("1d")))
    
    print("\n" + "=" * 60)
    print("Test Results:")
    print("=" * 60)
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status} - {name}")
