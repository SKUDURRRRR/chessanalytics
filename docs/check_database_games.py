#!/usr/bin/env python3
"""
Script to check what games are actually in the database for testing.
"""

import requests
import json

def check_database_games():
    """Check what games are available in the database."""
    
    print("🔍 Checking games in database...")
    print("=" * 50)
    
    # Check for games in the database
    try:
        # Try to get some games from the database
        url = "http://localhost:8002/api/v1/analyses/billel-bouasla/lichess"
        
        print(f"📡 Fetching games from: {url}")
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found {len(data)} games in database")
            
            if data:
                print("\n📋 Sample games:")
                for i, game in enumerate(data[:5]):  # Show first 5 games
                    print(f"  {i+1}. Game ID: {game.get('game_id', 'N/A')}")
                    print(f"     Result: {game.get('result', 'N/A')}")
                    print(f"     Opening: {game.get('opening', 'N/A')}")
                    print(f"     Moves: {game.get('total_moves', 'N/A')}")
                    print()
                
                # Use the first game for testing
                first_game = data[0]
                game_id = first_game.get('game_id')
                if game_id:
                    print(f"🎯 Using game {game_id} for re-analysis test")
                    return game_id
            else:
                print("❌ No games found in database")
                return None
        else:
            print(f"❌ Failed to fetch games: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error checking database: {e}")
        return None

def test_reanalysis_with_real_game(game_id):
    """Test re-analysis with a real game from the database."""
    
    if not game_id:
        print("❌ No game ID provided for testing")
        return
    
    test_data = {
        "analysis_type": "stockfish",
        "user_id": "billel-bouasla",
        "platform": "lichess",
        "game_id": game_id,
        "depth": 8,
        "skill_level": 8
    }
    
    print(f"\n🧪 Testing Re-analysis with real game: {game_id}")
    print("=" * 50)
    
    url = "http://localhost:8002/api/v1/analyze"
    
    try:
        print("📡 Sending re-analysis request...")
        response = requests.post(url, json=test_data, timeout=300)
        
        print(f"📊 Response Status: {response.status_code}")
        
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
            
    except Exception as e:
        print(f"❌ Error during test: {e}")

if __name__ == "__main__":
    # First check what games are available
    game_id = check_database_games()
    
    # Then test re-analysis with a real game
    if game_id:
        test_reanalysis_with_real_game(game_id)
    else:
        print("\n💡 No games found in database. You may need to:")
        print("   1. Import some games first")
        print("   2. Check if the user ID is correct")
        print("   3. Verify the database connection")
