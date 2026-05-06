#!/usr/bin/env python3
"""
Check how many games were imported on a specific date or date range.

Usage:
    python scripts/check_imports_by_date.py <start_date> [end_date]

Examples:
    python scripts/check_imports_by_date.py 2024-10-29
    python scripts/check_imports_by_date.py 2025-10-29
    python scripts/check_imports_by_date.py 2025-10-29 2025-11-06
"""
import os
import sys
from datetime import datetime, timezone
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables from multiple locations
from pathlib import Path
project_root = Path(__file__).resolve().parent.parent
load_dotenv(project_root / '.env', override=False)
load_dotenv(project_root / '.env.local', override=False)
load_dotenv(project_root / 'python' / '.env', override=False)
load_dotenv(project_root / 'python' / '.env.local', override=False)

# Initialize Supabase
supabase_url = os.environ.get('VITE_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
supabase_key = os.environ.get('VITE_SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_ANON_KEY')

if not supabase_url or not supabase_key:
    print("Error: Supabase credentials must be set")
    print("Please set one of the following in your .env file:")
    print("  - VITE_SUPABASE_URL or SUPABASE_URL")
    print("  - VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY")
    sys.exit(1)

supabase = create_client(supabase_url, supabase_key)

def check_imports_by_date(start_date_str: str, end_date_str: str = None):
    """Check how many games were imported on a specific date or date range."""

    try:
        # Parse the start date
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')

        # If end date provided, parse it; otherwise use start date
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
        else:
            end_date = start_date
    except ValueError:
        print(f"Error: Invalid date format. Use YYYY-MM-DD (e.g., 2024-10-29)")
        sys.exit(1)

    # Set time range
    start_datetime = start_date.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
    end_datetime = end_date.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)

    print(f"\n{'='*80}")
    if end_date_str and end_date != start_date:
        print(f"Checking games imported from {start_date_str} to {end_date_str}")
    else:
        print(f"Checking games imported on {start_date_str}")
    print(f"Time range: {start_datetime.isoformat()} to {end_datetime.isoformat()}")
    print(f"{'='*80}\n")

    # Query games imported on this date
    # We need to use gte (greater than or equal) and lte (less than or equal)
    # Supabase PostgREST uses ISO format strings for timestamp comparisons
    start_iso = start_datetime.isoformat()
    end_iso = end_datetime.isoformat()

    try:
        # Query for games created on this date range with pagination
        # First, get the count
        count_response = supabase.table('games').select('id', count='exact').gte('created_at', start_iso).lte('created_at', end_iso).limit(1).execute()
        total_count = count_response.count if hasattr(count_response, 'count') and count_response.count is not None else 0

        if end_date_str and end_date != start_date:
            print(f"✓ Found {total_count:,} games imported from {start_date_str} to {end_date_str}\n")
        else:
            print(f"✓ Found {total_count:,} games imported on {start_date_str}\n")

        if total_count == 0:
            print("No games found for this date range.")
            return

        # Fetch all data with pagination (Supabase default limit is 1000)
        all_games = []
        page_size = 1000
        offset = 0

        print(f"Fetching all games (this may take a moment for large datasets)...")
        while True:
            response = supabase.table('games').select('id, user_id, platform, created_at').gte('created_at', start_iso).lte('created_at', end_iso).order('created_at', desc=False).range(offset, offset + page_size - 1).execute()

            if not response.data or len(response.data) == 0:
                break

            all_games.extend(response.data)
            offset += page_size

            # Show progress for large datasets
            if len(all_games) % 5000 == 0:
                print(f"  Fetched {len(all_games):,} games so far...")

            # If we got fewer than page_size, we're done
            if len(response.data) < page_size:
                break

        actual_count = len(all_games)
        print(f"✓ Retrieved {actual_count:,} games from database\n")

        if actual_count != total_count:
            print(f"⚠️  WARNING: Count mismatch!")
            print(f"   Reported count: {total_count:,}")
            print(f"   Retrieved count: {actual_count:,}")
            print(f"   Difference: {abs(total_count - actual_count):,}\n")

        if all_games:
            # Group by user and platform
            by_user_platform = {}
            for game in all_games:
                key = f"{game['user_id']} ({game['platform']})"
                if key not in by_user_platform:
                    by_user_platform[key] = 0
                by_user_platform[key] += 1

            print(f"{'='*80}")
            print(f"Complete breakdown by user and platform ({len(by_user_platform)} unique users):")
            print(f"{'='*80}")

            # Show top users
            sorted_users = sorted(by_user_platform.items(), key=lambda x: x[1], reverse=True)
            total_from_breakdown = sum(count for _, count in sorted_users)

            for key, count in sorted_users:
                print(f"  {key:50s}: {count:8,} games")

            print(f"\n  {'TOTAL':50s}: {total_from_breakdown:8,} games")

            if total_from_breakdown != actual_count:
                print(f"\n⚠️  Breakdown total ({total_from_breakdown:,}) doesn't match retrieved count ({actual_count:,})")

            # Show date distribution
            print(f"\n{'='*80}")
            print("Import activity by date:")
            print(f"{'='*80}")
            by_date = {}
            for game in all_games:
                created_at = game['created_at']
                # Extract just the date part
                date_part = created_at.split('T')[0] if 'T' in created_at else created_at[:10]
                if date_part not in by_date:
                    by_date[date_part] = 0
                by_date[date_part] += 1

            for date_key in sorted(by_date.keys()):
                print(f"  {date_key}: {by_date[date_key]:,} games")

            # Show sample timestamps
            print(f"\n{'='*80}")
            print("Sample import timestamps (first 5):")
            print(f"{'='*80}")
            for game in all_games[:5]:
                created_at = game['created_at']
                print(f"  {created_at}")

            if len(all_games) > 5:
                print(f"  ... and {len(all_games) - 5:,} more")
        else:
            print("No games found for this date range.")

    except Exception as e:
        print(f"Error querying database: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python scripts/check_imports_by_date.py <start_date> [end_date]")
        print("\nExamples:")
        print("  python scripts/check_imports_by_date.py 2024-10-29")
        print("  python scripts/check_imports_by_date.py 2025-10-29")
        print("  python scripts/check_imports_by_date.py 2025-10-29 2025-11-06")
        print("\nDate format: YYYY-MM-DD")
        sys.exit(1)

    start_date_str = sys.argv[1]
    end_date_str = sys.argv[2] if len(sys.argv) > 2 else None
    check_imports_by_date(start_date_str, end_date_str)
