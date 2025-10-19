#!/usr/bin/env python3
"""
Quick diagnostic script to check if production analysis is working.
Usage: python check_production_analysis.py https://your-railway-app.railway.app
"""

import sys
import requests
import json

def check_production_analysis(base_url):
    """Check if production analysis endpoint is working."""

    print("🔍 CHECKING PRODUCTION ANALYSIS")
    print("=" * 60)
    print(f"Base URL: {base_url}")
    print()

    # Test 1: Health Check
    print("1️⃣  Testing Health Endpoint...")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Backend is running")
            print(f"   Status: {data.get('status')}")
            print(f"   Stockfish: {data.get('stockfish', 'UNKNOWN')}")
            print(f"   Database: {data.get('database', 'UNKNOWN')}")

            # Check stockfish specifically
            if data.get('stockfish') != 'available':
                print(f"   ⚠️  WARNING: Stockfish is NOT available!")
                print(f"   This is likely why analysis isn't working.")
                print()
                print(f"   FIX: Add STOCKFISH_PATH=stockfish to Railway environment variables")
                return False
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Cannot connect to backend: {e}")
        print(f"   Is the backend running? Check Railway logs.")
        return False
    print()

    # Test 2: Analysis Endpoint
    print("2️⃣  Testing Analysis Endpoint...")
    try:
        payload = {
            "user_id": "test_user",
            "platform": "lichess",
            "analysis_type": "stockfish",
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "move": "e2e4"
        }

        response = requests.post(
            f"{base_url}/api/v1/analyze",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Analysis endpoint is working!")
            print(f"   Success: {data.get('success')}")
            print(f"   Message: {data.get('message', 'No message')}")
        else:
            print(f"   ❌ Analysis failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('detail', error_data.get('message', response.text))}")
            except:
                print(f"   Response: {response.text[:200]}")
            return False
    except requests.exceptions.Timeout:
        print(f"   ⏱️  Request timed out after 30 seconds")
        print(f"   This might indicate Stockfish is running but slow,")
        print(f"   or the backend is overloaded.")
        return False
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Request failed: {e}")
        return False
    print()

    # Test 3: Check Logs Endpoint (if exists)
    print("3️⃣  Additional Checks...")
    print(f"   Check Railway logs for:")
    print(f"   - 'STOCKFISH_PATH' in startup logs")
    print(f"   - 'Found stockfish at' messages")
    print(f"   - Any 'exit code -9' (OOM kills)")
    print(f"   - Database connection errors")
    print()

    print("=" * 60)
    print("✅ PRODUCTION ANALYSIS APPEARS TO BE WORKING")
    print("=" * 60)
    print()
    print("If users still can't analyze games:")
    print("1. Check frontend is pointing to correct API URL")
    print("2. Verify CORS is configured correctly")
    print("3. Check browser console for errors")
    print("4. Verify user has games imported in database")
    print()
    return True

def main():
    if len(sys.argv) < 2:
        print("Usage: python check_production_analysis.py <base-url>")
        print("Example: python check_production_analysis.py https://your-app.railway.app")
        sys.exit(1)

    base_url = sys.argv[1].rstrip('/')
    success = check_production_analysis(base_url)

    if not success:
        print()
        print("=" * 60)
        print("❌ PRODUCTION ANALYSIS IS NOT WORKING")
        print("=" * 60)
        print()
        print("COMMON FIXES:")
        print()
        print("1. Missing Stockfish:")
        print("   → Add to Railway variables: STOCKFISH_PATH=stockfish")
        print()
        print("2. Backend not deployed:")
        print("   → Run: railway up")
        print("   → Or push to GitHub if auto-deploy is configured")
        print()
        print("3. Environment variables missing:")
        print("   → Check Railway dashboard has all required vars:")
        print("     - SUPABASE_URL")
        print("     - SUPABASE_SERVICE_ROLE_KEY")
        print("     - STOCKFISH_PATH")
        print()
        print("4. Memory issues (OOM kills):")
        print("   → Check Railway logs for 'exit code -9'")
        print("   → Add: DEPLOYMENT_TIER=production")
        print()
        print("5. Check Railway logs:")
        print("   → Run: railway logs")
        print("   → Look for errors during startup or analysis")
        print()
        sys.exit(1)

if __name__ == "__main__":
    main()
