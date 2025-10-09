#!/usr/bin/env python3
"""
Debug script to check what's actually in the database.
"""

import requests
import json

def check_all_users():
    """Check what users and games are actually in the database."""
    
    print("🔍 Debugging database contents...")
    print("=" * 50)
    
    # Try different user ID variations
    user_variations = [
        "skudurrrrr",
        "skudurelis", 
        "skudurrrr",
        "skudurrr",
        "skudurr"
    ]
    
    platforms = ["lichess", "chess.com"]
    
    for user in user_variations:
        print(f"\n👤 Checking user: {user}")
        for platform in platforms:
            try:
                url = f"http://localhost:8002/api/v1/analyses/{user}/{platform}"
                print(f"  📡 {platform}: {url}")
                
                response = requests.get(url, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data:
                        print(f"  ✅ Found {len(data)} games on {platform}")
                        # Show first game details
                        first_game = data[0]
                        print(f"     First game: {first_game.get('game_id', 'N/A')} - {first_game.get('result', 'N/A')}")
                    else:
                        print(f"  ❌ No games on {platform}")
                else:
                    print(f"  ❌ Error {response.status_code} on {platform}")
                    
            except Exception as e:
                print(f"  ❌ Exception on {platform}: {e}")

def check_recent_analysis_logs():
    """Check if there are any recent analysis logs that might give us clues."""
    
    print(f"\n🔍 Checking for recent analysis activity...")
    print("=" * 50)
    
    # Try to get some stats that might show recent activity
    try:
        # Try different user variations for stats
        for user in ["skudurrrrr", "skudurelis"]:
            for platform in ["lichess", "chess.com"]:
                try:
                    url = f"http://localhost:8002/api/v1/stats/{user}/{platform}"
                    print(f"📊 Stats for {user}@{platform}: {url}")
                    
                    response = requests.get(url, timeout=10)
                    
                    if response.status_code == 200:
                        data = response.json()
                        print(f"  ✅ Stats available: {json.dumps(data, indent=2)}")
                    else:
                        print(f"  ❌ No stats: {response.status_code}")
                        
                except Exception as e:
                    print(f"  ❌ Stats error: {e}")
                    
    except Exception as e:
        print(f"❌ Error checking stats: {e}")

if __name__ == "__main__":
    check_all_users()
    check_recent_analysis_logs()
