#!/usr/bin/env python3
"""Quick script to verify Stockfish is available in production."""

import requests
import sys
import time

URL = "https://chessanalytics-production.up.railway.app/health"

print("🔍 Checking if Stockfish is now available...")
print("=" * 60)
print()

try:
    response = requests.get(URL, timeout=10)
    data = response.json()

    print(f"✅ Backend Status: {data.get('status', 'UNKNOWN')}")

    stockfish_status = data.get('stockfish', 'UNKNOWN')
    print(f"🔧 Stockfish: {stockfish_status}")

    if stockfish_status == 'available':
        print()
        print("=" * 60)
        print("🎉 SUCCESS! Stockfish is now available!")
        print("=" * 60)
        print()
        print("Analysis should now work in production.")
        print("Try analyzing a game in your app!")
        sys.exit(0)
    else:
        print()
        print("=" * 60)
        print("⚠️  Stockfish is still not available")
        print("=" * 60)
        print()
        print("Possible reasons:")
        print("1. Railway hasn't finished restarting yet (wait 30s)")
        print("2. STOCKFISH_PATH variable wasn't added correctly")
        print("3. Check Railway logs for errors")
        print()
        print("Next steps:")
        print("1. Wait 30 seconds and run this script again")
        print("2. Check Railway dashboard → Deployments tab")
        print("3. Check Railway logs for Stockfish messages")
        sys.exit(1)

except requests.exceptions.RequestException as e:
    print(f"❌ Cannot connect to backend: {e}")
    print()
    print("Check if Railway service is running:")
    print("https://railway.app/dashboard")
    sys.exit(1)
