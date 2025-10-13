#!/usr/bin/env python3
"""Find where opening data actually is stored"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
PYTHON_DIR = PROJECT_ROOT / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

SUPABASE_URL = "https://nhpsnvhvfscrmyniihdn.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg4MjMxNywiZXhwIjoyMDc1NDU4MzE3fQ.DStrQSLMktOibIkN8EJTiLlvvbSSNLQ0dzsBS2HHrd0"

from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

print("="*70)
print("SEARCHING FOR OPENING DATA")
print("="*70)

for user_id in ['krecetas', 'skudurelis']:
    print(f"\n{'='*70}")
    print(f"{user_id.upper()}")
    print(f"{'='*70}")
    
    # Check games table
    print("\n1. GAMES TABLE:")
    response = supabase.table('games').select('provider_game_id, opening, opening_family, opening_normalized').eq('user_id', user_id).eq('platform', 'lichess').limit(5).execute()
    games = response.data if response.data else []
    print(f"   Found {len(games)} games")
    if games:
        for i, game in enumerate(games[:3], 1):
            print(f"   Game {i}:")
            print(f"     opening: {game.get('opening')}")
            print(f"     opening_family: {game.get('opening_family')}")
            print(f"     opening_normalized: {game.get('opening_normalized')}")
    
    # Check move_analyses table
    print("\n2. MOVE_ANALYSES TABLE:")
    response = supabase.table('move_analyses').select('game_id, opening, opening_family').eq('user_id', user_id).eq('platform', 'lichess').limit(5).execute()
    analyses = response.data if response.data else []
    print(f"   Found {len(analyses)} analyses")
    if analyses:
        for i, analysis in enumerate(analyses[:3], 1):
            print(f"   Analysis {i}:")
            print(f"     game_id: {analysis.get('game_id')}")
            print(f"     opening: {analysis.get('opening')}")
            print(f"     opening_family: {analysis.get('opening_family')}")
    
    # Check if analyses have opening data that games don't
    if games and analyses:
        games_with_opening = sum(1 for g in games if g.get('opening') and g.get('opening') != 'Unknown')
        analyses_with_opening = sum(1 for a in analyses if a.get('opening') and a.get('opening') != 'Unknown')
        
        print(f"\n3. COMPARISON:")
        print(f"   Games with opening: {games_with_opening}/{len(games)}")
        print(f"   Analyses with opening: {analyses_with_opening}/{len(analyses)}")
        
        if analyses_with_opening > games_with_opening:
            print(f"   → Opening data is in ANALYSES table!")
        elif games_with_opening > 0:
            print(f"   → Opening data is in GAMES table!")
        else:
            print(f"   → No opening data found in either table!")

print(f"\n{'='*70}")
print("DIAGNOSIS")
print("="*70)
print("\nIf opening data is in move_analyses but not games:")
print("  → Personality calculation reads from wrong place")
print("  → Need to fix _estimate_novelty_from_games() to read analyses")
print("\nIf opening data is in games:")
print("  → Query in investigate script was correct")
print("  → Frontend shows it, backend doesn't read it properly")

