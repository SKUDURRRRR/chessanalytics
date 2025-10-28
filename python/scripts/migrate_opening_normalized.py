#!/usr/bin/env python3
"""
Database Migration Script: Fix opening_normalized column
This script updates all existing games to use normalized opening family names
instead of full variation names, matching frontend expectations.

Example transformations:
- "Sicilian Defense, Najdorf Variation" -> "Sicilian Defense"
- "Italian Game, Classical Variation" -> "Italian Game"
- "Queen's Gambit Declined, Orthodox Defense" -> "Queen's Gambit Declined"

This fixes two issues:
1. Match history filter not finding games when clicking opening names
2. Opening statistics showing too few openings due to fragmentation
"""

import os
import sys
from datetime import datetime

# Add parent directory to path to import core modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables from .env file
from dotenv import load_dotenv
project_root = os.path.join(os.path.dirname(__file__), '../..')
load_dotenv(os.path.join(project_root, '.env'))

from supabase import create_client
from core.opening_utils import normalize_opening_name


def get_supabase_client():
    """Initialize Supabase client with service role credentials"""
    # Support both VITE_ prefixed and non-prefixed environment variables
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

    if not supabase_url or not supabase_service_key:
        raise ValueError(
            "Missing required environment variables:\n"
            "- SUPABASE_URL\n"
            "- SUPABASE_SERVICE_ROLE_KEY\n"
            "Please set these in your .env file or environment."
        )

    return create_client(supabase_url, supabase_service_key)


def migrate_games(dry_run: bool = True, batch_size: int = 500):
    """
    Migrate all games to use normalized opening names

    Args:
        dry_run: If True, only shows what would be changed without updating
        batch_size: Number of games to process per batch
    """
    print("=" * 80)
    print("Opening Normalization Migration Script")
    print("=" * 80)
    print(f"Mode: {'DRY RUN (no changes will be made)' if dry_run else 'LIVE RUN (database will be updated)'}")
    print(f"Batch size: {batch_size}")
    print()

    # Initialize Supabase client
    try:
        client = get_supabase_client()
        print("[OK] Connected to Supabase")
    except Exception as e:
        print(f"[ERROR] Failed to connect to Supabase: {e}")
        return

    # Get total count of games
    try:
        count_response = client.table('games').select('id', count='exact').execute()
        total_games = count_response.count
        print(f"[OK] Found {total_games} total games in database")
        print()
    except Exception as e:
        print(f"[ERROR] Failed to count games: {e}")
        return

    # Process games in batches
    offset = 0
    total_processed = 0
    total_updated = 0
    changes_by_opening = {}
    errors = []

    while offset < total_games:
        print(f"\nProcessing batch: {offset} to {offset + batch_size}...")

        try:
            # Fetch batch of games
            response = client.table('games').select(
                'id, user_id, platform, provider_game_id, opening, opening_family, opening_normalized'
            ).range(offset, offset + batch_size - 1).execute()

            games = response.data
            if not games:
                break

            batch_updates = []
            batch_changes = []

            for game in games:
                total_processed += 1

                # Get raw opening from game
                raw_opening = game.get('opening_family') or game.get('opening') or 'Unknown'
                current_normalized = game.get('opening_normalized', '')

                # Apply normalization
                new_normalized = normalize_opening_name(raw_opening)

                # Check if it needs updating
                if new_normalized != current_normalized:
                    total_updated += 1

                    # Track what's changing
                    change_key = f"{current_normalized} -> {new_normalized}"
                    changes_by_opening[change_key] = changes_by_opening.get(change_key, 0) + 1

                    batch_changes.append({
                        'id': game['id'],
                        'user_id': game['user_id'],
                        'provider_game_id': game.get('provider_game_id'),
                        'old': current_normalized,
                        'new': new_normalized
                    })

                    batch_updates.append({
                        'id': game['id'],
                        'opening_normalized': new_normalized
                    })

            # Show changes for this batch
            if batch_changes:
                print(f"  Found {len(batch_changes)} games to update in this batch")
                if dry_run:
                    # In dry run, show first 5 examples
                    for change in batch_changes[:5]:
                        print(f"    • Game {change['provider_game_id']}: '{change['old']}' -> '{change['new']}'")
                    if len(batch_changes) > 5:
                        print(f"    ... and {len(batch_changes) - 5} more")

            # Perform updates if not dry run
            if not dry_run and batch_updates:
                try:
                    # Update games one by one using proper UPDATE queries
                    # This is safer than upsert and avoids creating new rows
                    updated_count = 0
                    for update in batch_updates:
                        try:
                            client.table('games').update({
                                'opening_normalized': update['opening_normalized']
                            }).eq('id', update['id']).execute()
                            updated_count += 1
                        except Exception as e:
                            # Log individual failures but continue
                            print(f"    [WARNING] Failed to update game {update['id']}: {str(e)}")
                    print(f"  [OK] Updated {updated_count}/{len(batch_updates)} games")
                except Exception as e:
                    error_msg = f"Failed to update batch at offset {offset}: {str(e)}"
                    print(f"  [ERROR] {error_msg}")
                    errors.append(error_msg)

            offset += batch_size

        except Exception as e:
            error_msg = f"Failed to process batch at offset {offset}: {str(e)}"
            print(f"[ERROR] {error_msg}")
            errors.append(error_msg)
            break

    # Print summary
    print()
    print("=" * 80)
    print("MIGRATION SUMMARY")
    print("=" * 80)
    print(f"Total games processed: {total_processed}")
    print(f"Games requiring updates: {total_updated}")
    print(f"Games unchanged: {total_processed - total_updated}")

    if errors:
        print(f"\n[WARNING] Errors encountered: {len(errors)}")
        for error in errors:
            print(f"  • {error}")

    if changes_by_opening:
        print(f"\nTop 20 Opening Changes:")
        sorted_changes = sorted(changes_by_opening.items(), key=lambda x: x[1], reverse=True)
        for change, count in sorted_changes[:20]:
            print(f"  {count:4d} games: {change}")

        if len(sorted_changes) > 20:
            print(f"  ... and {len(sorted_changes) - 20} more opening changes")

    if dry_run:
        print("\n" + "=" * 80)
        print("DRY RUN COMPLETE - No changes were made to the database")
        print("To apply these changes, run with: --live")
        print("=" * 80)
    else:
        print("\n" + "=" * 80)
        print("MIGRATION COMPLETE - Database has been updated")
        print("=" * 80)


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='Migrate opening_normalized column to use family names'
    )
    parser.add_argument(
        '--live',
        action='store_true',
        help='Execute migration (default is dry-run)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=500,
        help='Number of games to process per batch (default: 500)'
    )

    args = parser.parse_args()

    try:
        migrate_games(dry_run=not args.live, batch_size=args.batch_size)
    except KeyboardInterrupt:
        print("\n\n[WARNING] Migration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n[ERROR] Migration failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
