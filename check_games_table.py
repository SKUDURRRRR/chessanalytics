#!/usr/bin/env python3
"""Check if games table has opening data"""
import sys
from pathlib import Path
import os

PROJECT_ROOT = Path(__file__).resolve().parent
PYTHON_DIR = PROJECT_ROOT / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

# Load environment
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Supabase credentials not found")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("="*70)
print("GAMES TABLE - OPENING DATA CHECK")
print("="*70)

for user_id in ['krecetas', 'skudurelis']:
    print(f"\n{user_id.upper()}:")
    
    # Get games from games table
    response = supabase.table('games').select('opening, opening_family, opening_normalized').eq('user_id', user_id).eq('platform', 'lichess').limit(10).execute()
    
    games = response.data if response.data else []
    print(f"  Found {len(games)} games in games table")
    
    if games:
        print(f"\n  Sample openings:")
        for i, game in enumerate(games[:5], 1):
            opening = game.get('opening') or 'NULL'
            family = game.get('opening_family') or 'NULL'
            normalized = game.get('opening_normalized') or 'NULL'
            print(f"    Game {i}:")
            print(f"      opening: {opening}")
            print(f"      opening_family: {family}")
            print(f"      opening_normalized: {normalized}")
        
        # Check if ANY have opening data
        has_opening = sum(1 for g in games if g.get('opening'))
        has_family = sum(1 for g in games if g.get('opening_family'))
        has_normalized = sum(1 for g in games if g.get('opening_normalized'))
        
        print(f"\n  Summary:")
        print(f"    Games with opening: {has_opening}/{len(games)}")
        print(f"    Games with opening_family: {has_family}/{len(games)}")
        print(f"    Games with opening_normalized: {has_normalized}/{len(games)}")
        
        if has_opening == 0 and has_family == 0:
            print(f"    ❌ NO OPENING DATA! This breaks Novelty/Staleness!")
        else:
            print(f"    ✅ Has opening data")

print(f"\n{'='*70}")
print("DIAGNOSIS")
print("="*70)
print("\nIf games have NO opening data:")
print("  → Import process didn't extract opening info from PGN/API")
print("  → Need to re-import games OR populate opening field")
print("\nIf games HAVE opening data:")
print("  → Problem is in analysis retrieval (wrong field being read)")

