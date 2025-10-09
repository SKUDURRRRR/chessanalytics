#!/usr/bin/env python3
"""
Test script to verify the re-analysis fix is working.
This script will test the re-analysis functionality with a sample game.
"""

import requests
import json
import time

def test_reanalysis():
    """Test the re-analysis functionality."""
    
    # Sample game data (you can replace this with your actual game data)
    test_data = {
        "analysis_type": "stockfish",
        "user_id": "billel-bouasla",  # Replace with your username
        "platform": "lichess",        # Replace with your platform
        "game_id": "143917000916",    # Replace with your game ID
        "depth": 8,
        "skill_level": 8
    }
    
    print("🧪 Testing Re-analysis Fix")
    print("=" * 50)
    print(f"Testing game: {test_data['game_id']}")
    print(f"User: {test_data['user_id']}")
    print(f"Platform: {test_data['platform']}")
    print()
    
    # Test the re-analysis endpoint
    url = "http://localhost:8002/api/v1/analyze"
    
    try:
        print("📡 Sending re-analysis request...")
        response = requests.post(url, json=test_data, timeout=300)
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"📊 Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Re-analysis Response:")
            print(json.dumps(result, indent=2))
            
            if result.get('success'):
                print("\n🎉 SUCCESS: Re-analysis completed successfully!")
                print(f"   Analysis ID: {result.get('analysis_id')}")
                print(f"   Message: {result.get('message')}")
            else:
                print(f"\n❌ FAILED: {result.get('message')}")
                
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Backend server is not running")
        print("   Make sure the backend is started with: python main.py")
    except requests.exceptions.Timeout:
        print("❌ Timeout Error: Request took too long")
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")

def check_backend_status():
    """Check if the backend is running."""
    try:
        response = requests.get("http://localhost:8002/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running")
            return True
        else:
            print(f"⚠️  Backend responded with status: {response.status_code}")
            return False
    except:
        print("❌ Backend is not running")
        return False

if __name__ == "__main__":
    print("🔍 Checking backend status...")
    if check_backend_status():
        print()
        test_reanalysis()
    else:
        print("\n💡 To start the backend:")
        print("   cd python")
        print("   python main.py")
