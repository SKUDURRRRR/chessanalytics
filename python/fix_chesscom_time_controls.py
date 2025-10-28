#!/usr/bin/env python3
"""
Fix Chess.com Time Controls
Extracts accurate time controls from PGN data for Chess.com games
that currently only have category data (bullet, blitz, rapid)
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Initialize Supabase client"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

    return create_client(url, key)

def extract_time_control_from_pgn(pgn: str) -> Optional[str]:
    """Extract TimeControl header from PGN"""
    if not pgn:
        return None

    lines = pgn.split('\n')
    for line in lines:
        if line.startswith('[TimeControl '):
            try:
                time_control = line.split('"')[1]
                if time_control and time_control != '-':
                    return time_control
            except:
                pass

    return None

def fix_chesscom_time_controls(user_id: Optional[str] = None, dry_run: bool = True):
    """
    Fix time controls for Chess.com games

    Args:
        user_id: Optional user ID to fix games for (if None, fixes all users)
        dry_run: If True, only shows what would be changed without updating
    """
    supabase = get_supabase_client()

    print("🔍 Finding Chess.com games with category-only time controls...")

    # Build query
    query = supabase.table('games').select('id, user_id, time_control, pgn')
    query = query.eq('platform', 'chess.com')
    query = query.in_('time_control', ['bullet', 'blitz', 'rapid', 'classical'])

    if user_id:
        query = query.eq('user_id', user_id)
        print(f"   Filtering for user: {user_id}")

    result = query.limit(10000).execute()

    if not result.data:
        print("✅ No games found that need fixing!")
        return

    games = result.data
    print(f"📊 Found {len(games)} games to process\n")

    updated_count = 0
    failed_count = 0
    no_pgn_count = 0

    for i, game in enumerate(games, 1):
        game_id = game['id']
        old_time_control = game['time_control']
        pgn = game.get('pgn', '')

        if not pgn:
            no_pgn_count += 1
            continue

        # Extract time control from PGN
        new_time_control = extract_time_control_from_pgn(pgn)

        if new_time_control:
            if dry_run:
                print(f"[{i}/{len(games)}] Would update game {game_id}: {old_time_control} → {new_time_control}")
            else:
                try:
                    supabase.table('games').update({
                        'time_control': new_time_control
                    }).eq('id', game_id).execute()

                    print(f"[{i}/{len(games)}] ✅ Updated game {game_id}: {old_time_control} → {new_time_control}")
                    updated_count += 1
                except Exception as e:
                    print(f"[{i}/{len(games)}] ❌ Failed to update game {game_id}: {e}")
                    failed_count += 1
        else:
            failed_count += 1

    print(f"\n{'=' * 60}")
    print(f"📈 Summary:")
    print(f"   Total games processed: {len(games)}")
    print(f"   Successfully updated: {updated_count}")
    print(f"   Failed (no PGN time control): {failed_count}")
    print(f"   No PGN data: {no_pgn_count}")

    if dry_run:
        print(f"\n⚠️  This was a DRY RUN - no changes were made")
        print(f"   Run with --apply to actually update the database")
    else:
        print(f"\n✅ Database updated successfully!")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Fix Chess.com time controls from PGN data')
    parser.add_argument('--user', help='User ID to fix games for (optional)')
    parser.add_argument('--apply', action='store_true', help='Actually apply changes (default is dry run)')

    args = parser.parse_args()

    print("🔧 Chess.com Time Control Fixer\n")

    if not args.apply:
        print("⚠️  Running in DRY RUN mode (use --apply to make changes)\n")

    fix_chesscom_time_controls(
        user_id=args.user,
        dry_run=not args.apply
    )
