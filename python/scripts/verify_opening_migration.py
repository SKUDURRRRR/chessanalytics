#!/usr/bin/env python3
"""
Verification Script: Check opening_normalized migration results
This script verifies that the migration successfully consolidated opening names
"""

import os
import sys

# Add parent directory to path to import core modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables from .env file
from dotenv import load_dotenv
project_root = os.path.join(os.path.dirname(__file__), '../..')
load_dotenv(os.path.join(project_root, '.env'))

from supabase import create_client
from collections import Counter


def get_supabase_client():
    """Initialize Supabase client"""
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_service_key:
        raise ValueError("Missing required environment variables")
    
    return create_client(supabase_url, supabase_service_key)


def verify_openings(user_id='steve12eo', platform='chess.com'):
    """Verify opening consolidation for a specific user"""
    print("=" * 80)
    print("Opening Migration Verification")
    print("=" * 80)
    print(f"Checking openings for user: {user_id} on platform: {platform}")
    print()
    
    client = get_supabase_client()
    
    # Fetch ALL games for the user (without limit)
    all_games = []
    offset = 0
    batch_size = 1000
    
    while True:
        response = client.table('games').select(
            'opening_normalized, result'
        ).eq('user_id', user_id).eq('platform', platform).range(
            offset, offset + batch_size - 1
        ).execute()
        
        if not response.data:
            break
        
        all_games.extend(response.data)
        if len(response.data) < batch_size:
            break
        offset += batch_size
    
    games = all_games
    print(f"Total games found: {len(games)}")
    print()
    
    # Count games by opening
    opening_counts = Counter()
    opening_wins = Counter()
    opening_total = Counter()
    
    for game in games:
        opening = game.get('opening_normalized', 'Unknown')
        result = game.get('result', 'unknown')
        
        opening_counts[opening] += 1
        opening_total[opening] += 1
        if result == 'win':
            opening_wins[opening] += 1
    
    # Calculate win rates
    opening_stats = []
    for opening, count in opening_counts.items():
        wins = opening_wins.get(opening, 0)
        win_rate = (wins / count * 100) if count > 0 else 0
        opening_stats.append((opening, count, wins, win_rate))
    
    # Sort by game count descending
    opening_stats.sort(key=lambda x: x[1], reverse=True)
    
    print("Top 20 Openings by Game Count:")
    print("-" * 80)
    print(f"{'Opening':<35} {'Games':>8} {'Wins':>8} {'Win Rate':>10}")
    print("-" * 80)
    
    for opening, count, wins, win_rate in opening_stats[:20]:
        print(f"{opening:<35} {count:>8} {wins:>8} {win_rate:>9.1f}%")
    
    print()
    print(f"Total unique openings (all): {len(opening_stats)}")
    print(f"Openings with 5+ games: {sum(1 for _, count, _, _ in opening_stats if count >= 5)}")
    print(f"Openings with 10+ games: {sum(1 for _, count, _, _ in opening_stats if count >= 10)}")
    print()
    
    # Check for ECO codes (should be none or very few)
    eco_codes = [opening for opening, _, _, _ in opening_stats if opening and len(opening) == 3 and opening[0] in 'ABCDE' and opening[1:].isdigit()]
    if eco_codes:
        print(f"⚠ Warning: Found {len(eco_codes)} ECO codes still present:")
        for code in eco_codes[:10]:
            count = opening_counts[code]
            print(f"  - {code}: {count} games")
        if len(eco_codes) > 10:
            print(f"  ... and {len(eco_codes) - 10} more")
    else:
        print("✓ No ECO codes found - all converted to opening names!")
    
    print()
    print("=" * 80)
    print("Verification Complete")
    print("=" * 80)
    print()
    print("Next steps:")
    print("1. Refresh your browser and navigate to the analytics page")
    print("2. You should now see more openings in the 'Winning Openings' section")
    print("3. Click on an opening name to filter the match history")
    print("4. The match history should now show games for that opening")


if __name__ == '__main__':
    try:
        verify_openings()
    except Exception as e:
        print(f"\n✗ Verification failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

