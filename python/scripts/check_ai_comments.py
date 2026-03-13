#!/usr/bin/env python3
"""
Quick script to check if AI comments are actually in the database.
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase import create_client

# Get credentials from environment
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] Missing SUPABASE_URL or SUPABASE_KEY")
    print("Make sure your .env.local is loaded")
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Query the specific game
user_id = 'skudurrrrr'
platform = 'chess.com'
game_id = '145358485646'

print(f"Checking game: {game_id} for user {user_id} on {platform}")
print("=" * 60)

response = client.table('move_analyses').select('moves_analysis').eq('user_id', user_id).eq('platform', platform).eq('game_id', game_id).execute()

if response.data and len(response.data) > 0:
    moves = response.data[0]['moves_analysis']
    print(f"[OK] Found analysis with {len(moves)} moves")
    print()

    # Check for coaching comments
    moves_with_comments = [m for m in moves if m.get('coaching_comment')]
    print(f"Moves with coaching_comment: {len(moves_with_comments)}/{len(moves)}")
    print()

    # Show first 5 moves with comments
    print("Sample comments:")
    for i, move in enumerate(moves_with_comments[:5]):
        comment = move['coaching_comment'][:80] + '...' if len(move['coaching_comment']) > 80 else move['coaching_comment']
        print(f"  Move {move.get('move_san', '?')}: {comment}")

    # Check if they're just templates or actual AI comments
    template_indicators = ['lose a small advantage', 'Better was a different move']
    ai_comments = [m for m in moves_with_comments if not any(ind in m['coaching_comment'] for ind in template_indicators)]
    print()
    print(f"AI-generated comments (non-template): {len(ai_comments)}/{len(moves_with_comments)}")

else:
    print("[ERROR] No analysis found in database")
