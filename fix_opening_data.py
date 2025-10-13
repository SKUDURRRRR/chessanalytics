#!/usr/bin/env python3
"""Fix opening data by re-fetching from Lichess API"""
import requests
import time
import sys
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
PYTHON_DIR = PROJECT_ROOT / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

# Load credentials from environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")
    print("Please run START_BACKEND_LOCAL.ps1 first or set these variables manually")
    sys.exit(1)

from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def fetch_lichess_game_opening(game_id: str):
    """Fetch opening info from Lichess API"""
    try:
        url = f"https://lichess.org/game/export/{game_id}"
        headers = {'Accept': 'application/x-chess-pgn'}
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            pgn = response.text
            
            # Parse opening from PGN headers
            opening = None
            eco = None
            for line in pgn.split('\n'):
                if line.startswith('[Opening "'):
                    opening = line.split('"')[1]
                elif line.startswith('[ECO "'):
                    eco = line.split('"')[1]
            
            return opening, eco
        return None, None
    except Exception as e:
        print(f"    Error fetching game {game_id}: {e}")
        return None, None

def fix_openings_for_player(user_id: str, platform: str, limit: int = 50):
    """Fix opening data for a player's games"""
    print(f"\n{'='*70}")
    print(f"FIXING OPENINGS: {user_id.upper()}")
    print(f"{'='*70}")
    
    # Get games with missing opening data
    response = supabase.table('games').select('provider_game_id, opening, opening_family').eq('user_id', user_id).eq('platform', platform).limit(limit).execute()
    
    games = response.data if response.data else []
    print(f"\nFound {len(games)} games to check")
    
    missing_count = sum(1 for g in games if not g.get('opening') or g.get('opening') == 'Unknown')
    print(f"Games with missing/unknown opening: {missing_count}")
    
    if missing_count == 0:
        print("✅ All games have opening data!")
        return
    
    # Fix each game
    fixed = 0
    errors = 0
    
    for i, game in enumerate(games, 1):
        if not game.get('opening') or game.get('opening') == 'Unknown':
            game_id = game['provider_game_id']
            
            print(f"\n[{i}/{len(games)}] Fetching opening for game {game_id}...")
            
            opening, eco = fetch_lichess_game_opening(game_id)
            
            if opening or eco:
                # Update database
                try:
                    supabase.table('games').update({
                        'opening': opening or 'Unknown',
                        'opening_family': eco or 'Unknown'
                    }).eq('provider_game_id', game_id).eq('user_id', user_id).execute()
                    
                    fixed += 1
                    print(f"    ✅ Updated: {opening} ({eco})")
                except Exception as e:
                    errors += 1
                    print(f"    ❌ Error updating: {e}")
            else:
                errors += 1
                print(f"    ❌ No opening data found")
            
            # Rate limit: Lichess allows 1 request per second
            time.sleep(1.1)
    
    print(f"\n{'='*70}")
    print(f"RESULTS: {user_id.upper()}")
    print(f"{'='*70}")
    print(f"Fixed: {fixed}")
    print(f"Errors: {errors}")
    print(f"Total processed: {len(games)}")

print("="*70)
print("OPENING DATA FIX SCRIPT")
print("="*70)
print("\nThis will fetch opening data from Lichess API")
print("and update your games table.")
print("\nRate limit: ~1 game per second (Lichess API limit)")
print("\nEstimated time:")
print("  Krecetas (22 games): ~25 seconds")
print("  Skudurelis (38 games): ~40 seconds")
print("  Total: ~65 seconds")

input("\nPress ENTER to continue...")

# Fix both players
fix_openings_for_player('krecetas', 'lichess', limit=50)
fix_openings_for_player('skudurelis', 'lichess', limit=50)

print(f"\n{'='*70}")
print("NEXT STEPS")
print(f"{'='*70}")
print("\n1. Verify opening data:")
print("   python investigate_novelty_staleness.py")
print("\n2. Clean old analyses:")
print("   DELETE FROM move_analyses WHERE user_id IN ('krecetas', 'skudurelis');")
print("\n3. Re-analyze all games:")
print("   python reanalyze_test_players.py")
print("\n4. Check personality scores:")
print("   Refresh your browser!")

