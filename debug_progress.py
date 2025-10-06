#!/usr/bin/env python3
"""
Debug script to check progress tracking for a specific user.
Usage: python debug_progress.py <user_id> <platform>
"""

import sys
import requests
import json

def debug_progress(user_id, platform):
    """Debug progress tracking for a user."""
    base_url = "http://localhost:8002"
    
    print(f"Debugging progress for user: {user_id} on platform: {platform}")
    print("=" * 50)
    
    # Check debug endpoint
    try:
        response = requests.get(f"{base_url}/api/v1/debug/progress")
        if response.status_code == 200:
            debug_data = response.json()
            print("Current progress state:")
            print(f"  Total keys: {debug_data['total_keys']}")
            print(f"  Keys: {debug_data['keys']}")
            if debug_data['analysis_progress']:
                for key, value in debug_data['analysis_progress'].items():
                    print(f"  Key '{key}': {value}")
            else:
                print("  No progress data found")
        else:
            print(f"Debug endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"Error calling debug endpoint: {e}")
    
    print("\n" + "=" * 50)
    
    # Check realtime progress
    try:
        response = requests.get(f"{base_url}/api/v1/progress-realtime/{user_id}/{platform}?analysis_type=stockfish")
        if response.status_code == 200:
            progress_data = response.json()
            print("Realtime progress response:")
            print(json.dumps(progress_data, indent=2))
        else:
            print(f"Realtime progress failed: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error calling realtime progress: {e}")
    
    print("\n" + "=" * 50)
    
    # Check analysis stats
    try:
        response = requests.get(f"{base_url}/api/v1/stats/{user_id}/{platform}?analysis_type=stockfish")
        if response.status_code == 200:
            stats_data = response.json()
            print("Analysis stats response:")
            print(f"  Total games: {stats_data.get('total_games', 'N/A')}")
            print(f"  Analyzed games: {stats_data.get('analyzed_games', 'N/A')}")
            print(f"  Success: {stats_data.get('success', 'N/A')}")
        else:
            print(f"Analysis stats failed: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error calling analysis stats: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python debug_progress.py <user_id> <platform>")
        print("Example: python debug_progress.py skudurrrrr chess.com")
        sys.exit(1)
    
    user_id = sys.argv[1]
    platform = sys.argv[2]
    debug_progress(user_id, platform)
