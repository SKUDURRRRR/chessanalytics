#!/usr/bin/env python3
"""Extract opening names from stored PGN data"""
import sys
from pathlib import Path
import os
import chess.pgn
import io

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

def extract_opening_from_pgn(pgn_text):
    """Extract opening name from PGN headers"""
    if not pgn_text:
        return None, None
    
    try:
        pgn_io = io.StringIO(pgn_text)
        game = chess.pgn.read_game(pgn_io)
        if game:
            opening = game.headers.get('Opening', None)
            eco = game.headers.get('ECO', None)
            return opening, eco
    except:
        pass
    
    return None, None

print("="*70)
print("EXTRACT OPENINGS FROM PGN DATA")
print("="*70)

for user_id in ['krecetas', 'skudurelis']:
    print(f"\n{user_id.upper()}:")
    
    # Get games with PGN
    response = supabase.table('games').select('provider_game_id, opening, opening_family, pgn').eq('user_id', user_id).eq('platform', 'lichess').limit(10).execute()
    
    games = response.data if response.data else []
    print(f"  Found {len(games)} games")
    
    if not games:
        continue
    
    # Check first few games
    print(f"\n  Checking PGN for opening data:")
    openings_found = 0
    
    for i, game in enumerate(games[:5], 1):
        current_opening = game.get('opening') or 'NULL'
        pgn = game.get('pgn')
        
        if pgn:
            opening, eco = extract_opening_from_pgn(pgn)
            if opening or eco:
                openings_found += 1
                print(f"    Game {i}:")
                print(f"      Current DB: {current_opening}")
                print(f"      From PGN:   {opening or 'N/A'} ({eco or 'N/A'})")
                print(f"      → Can extract!")
        else:
            print(f"    Game {i}: No PGN data")
    
    print(f"\n  Summary: {openings_found}/5 games have opening data in PGN")

print(f"\n{'='*70}")
print("SOLUTION")
print("="*70)
print("\nIf PGN contains opening data:")
print("  → Can run SQL update to extract openings from PGN")
print("  → Update games table with proper opening names")
print("  → Re-analyze to recalculate Novelty/Staleness")
print("\nIf PGN doesn't have opening data:")
print("  → Need to re-import games from Lichess/Chess.com")
print("  → Their APIs provide opening information")

