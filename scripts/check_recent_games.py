#!/usr/bin/env python3
"""
Check recent games data freshness and identify discrepancies

Usage:
    python scripts/check_recent_games.py <user_id> <platform> [time_control_category]

Examples:
    python scripts/check_recent_games.py skudurrrrr chess.com
    python scripts/check_recent_games.py skudurrrrr chess.com Rapid
    python scripts/check_recent_games.py skudurrrrr lichess Blitz
"""
import os
import sys
from datetime import datetime
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase
supabase_url = os.environ.get('VITE_SUPABASE_URL')
supabase_key = os.environ.get('VITE_SUPABASE_ANON_KEY')

if not supabase_url or not supabase_key:
    print("Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables must be set")
    print("Make sure you have a .env file with these variables")
    sys.exit(1)

supabase = create_client(supabase_url, supabase_key)

def get_time_control_category(time_control: str) -> str:
    """Categorize time control - matches frontend logic and backend implementation.

    Properly parses time control strings and categorizes them based on total time.
    Aligned with Lichess boundaries.

    Args:
        time_control: Time control string (e.g., "180+0", "600+5", "blitz", "1800+20")

    Returns:
        Category string: 'Bullet', 'Blitz', 'Rapid', 'Classical', 'Correspondence', or 'Unknown'
    """
    if not time_control or time_control == '-' or time_control.lower() == 'unknown':
        return 'Unknown'

    tc = time_control.strip()
    tc_lower = tc.lower()

    # Handle correspondence/daily games (Lichess uses "-" or formats like "1/1")
    if 'correspondence' in tc_lower or 'daily' in tc_lower or '/' in tc:
        return 'Correspondence'

    # Check if it's a pre-labeled category (e.g., "bullet", "blitz", "rapid")
    if tc_lower in ['bullet', 'blitz', 'rapid', 'classical', 'correspondence']:
        return tc_lower.capitalize()

    # Parse time control to calculate total time
    total_time = 0

    try:
        if '+' in tc:
            # Format: "base+increment" (e.g., "180+0", "600+5")
            parts = tc.split('+')
            if len(parts) != 2:
                return 'Unknown'

            base = float(parts[0])
            increment = float(parts[1])

            # Determine if base is in minutes or seconds based on typical values
            # Lichess formats: 60, 180, 300, 600, 900, 1800 (seconds)
            # Or: 1, 3, 5, 10, 15, 30 (minutes)
            if base >= 60 and base % 60 == 0 and base <= 1800:
                # Seconds format (60, 180, 300, 600, 900, 1800)
                base_seconds = base
                increment_seconds = increment
                # Total time estimate: base + (increment * 40 moves average)
                total_time = base_seconds + increment_seconds * 40
            elif base <= 30:
                # Minutes format (1, 3, 5, 10, 15, 30)
                base_seconds = base * 60
                increment_seconds = increment
                total_time = base_seconds + increment_seconds * 40
            else:
                # Fallback: assume seconds
                total_time = base + increment * 40

        elif tc.replace('.', '', 1).isdigit():
            # Format: just a number (e.g., "180", "600")
            base = float(tc)

            if base >= 60 and base % 60 == 0 and base <= 1800:
                # Seconds format
                total_time = base
            elif base <= 30:
                # Minutes format
                total_time = base * 60
            else:
                # Fallback: assume seconds
                total_time = base
        else:
            # Unrecognized format
            return 'Unknown'

    except (ValueError, AttributeError):
        # Failed to parse
        return 'Unknown'

    # Categorize based on total time - aligned with Lichess boundaries
    # Lichess uses: Bullet (< 3 min), Blitz (3-8 min), Rapid (8-25 min), Classical (25+ min)
    if total_time < 180:
        # Less than 3 minutes (e.g., 60+0, 120+1)
        return 'Bullet'
    elif total_time < 480:
        # 3-8 minutes (e.g., 180+0, 180+2, 300+0)
        return 'Blitz'
    elif total_time < 1500:
        # 8-25 minutes (e.g., 600+0, 600+5, 900+10)
        return 'Rapid'
    else:
        # 25+ minutes (e.g., 1800+0, 1800+20)
        return 'Classical'

def check_recent_games(user_id: str, platform: str, time_control_category: str = None):
    """Check recent games data for a specific user and platform"""

    print(f"\n{'='*80}")
    print(f"Checking Recent Games Data")
    print(f"User: {user_id}, Platform: {platform}")
    if time_control_category:
        print(f"Time Control Filter: {time_control_category}")
    print(f"{'='*80}\n")

    # Fetch all games with ratings, ordered by played_at
    query = supabase.table('games').select(
        'id, played_at, time_control, my_rating, opponent_rating, result'
    ).eq('user_id', user_id.lower()).eq('platform', platform).not_('my_rating', 'is', None).order('played_at', desc=False)

    response = query.execute()

    if not response.data:
        print("❌ No games found in database")
        return

    games = response.data
    print(f"✓ Found {len(games)} games with ratings in database\n")

    # Categorize games by time control
    games_by_tc = {}
    for game in games:
        tc = get_time_control_category(game['time_control'] or 'Unknown')
        if tc not in games_by_tc:
            games_by_tc[tc] = []
        games_by_tc[tc].append(game)

    print(f"{'='*80}")
    print("Games by Time Control Category:")
    print(f"{'='*80}")
    for tc, tc_games in sorted(games_by_tc.items(), key=lambda x: len(x[1]), reverse=True):
        most_recent = tc_games[-1] if tc_games else None
        if most_recent:
            days_ago = (datetime.now() - datetime.fromisoformat(most_recent['played_at'].replace('Z', '+00:00'))).days
            rating = most_recent['my_rating']
            print(f"  {tc:20s}: {len(tc_games):4d} games | Current Rating: {rating:4d} | Last game: {days_ago:3d} days ago")
        else:
            print(f"  {tc:20s}: {len(tc_games):4d} games")

    # If specific time control requested, show detailed analysis
    if time_control_category:
        print(f"\n{'='*80}")
        print(f"Detailed Analysis for {time_control_category}")
        print(f"{'='*80}\n")

        if time_control_category not in games_by_tc:
            print(f"❌ No games found for time control category: {time_control_category}")
            return

        tc_games = games_by_tc[time_control_category]

        # Get last 50 games
        recent_games = tc_games[-50:] if len(tc_games) >= 50 else tc_games

        print(f"Total {time_control_category} games: {len(tc_games)}")
        print(f"Analyzing last {len(recent_games)} games\n")

        # Check for large rating changes
        large_changes = []
        for i in range(1, len(recent_games)):
            prev_rating = recent_games[i-1]['my_rating']
            curr_rating = recent_games[i]['my_rating']
            change = curr_rating - prev_rating

            if abs(change) > 50:
                large_changes.append({
                    'index': i + 1,
                    'prev_rating': prev_rating,
                    'curr_rating': curr_rating,
                    'change': change,
                    'played_at': recent_games[i]['played_at']
                })

        if large_changes:
            print(f"⚠️  Found {len(large_changes)} large rating changes (>50 points):\n")
            for item in large_changes[:10]:
                print(f"  Game {item['index']}: {item['prev_rating']} → {item['curr_rating']} ({item['change']:+d} ELO)")
                print(f"    Played: {item['played_at']}")
        else:
            print("✓ No suspiciously large rating changes detected\n")

        # Show current rating and recent trend
        if recent_games:
            current_rating = recent_games[-1]['my_rating']
            first_rating = recent_games[0]['my_rating']
            rating_change = current_rating - first_rating

            print(f"\nRating Statistics (last {len(recent_games)} games):")
            print(f"  Current Rating: {current_rating}")
            print(f"  Starting Rating: {first_rating}")
            print(f"  Net Change: {rating_change:+d}")
            print(f"  Highest: {max(g['my_rating'] for g in recent_games)}")
            print(f"  Lowest: {min(g['my_rating'] for g in recent_games)}")

            # Calculate trend
            if len(recent_games) >= 10:
                first_half = recent_games[:len(recent_games)//2]
                second_half = recent_games[len(recent_games)//2:]
                first_avg = sum(g['my_rating'] for g in first_half) / len(first_half)
                second_avg = sum(g['my_rating'] for g in second_half) / len(second_half)

                if second_avg > first_avg + 10:
                    trend = "IMPROVING ↗"
                elif second_avg < first_avg - 10:
                    trend = "DECLINING ↘"
                else:
                    trend = "STABLE →"

                print(f"  Trend: {trend}")

    # Data freshness check
    print(f"\n{'='*80}")
    print("Data Freshness Check:")
    print(f"{'='*80}")

    most_recent_game = games[-1]
    most_recent_date = datetime.fromisoformat(most_recent_game['played_at'].replace('Z', '+00:00'))
    days_since = (datetime.now() - most_recent_date).days

    print(f"  Most recent game: {most_recent_date.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Days since last game: {days_since}")

    if days_since > 7:
        print(f"\n  ⚠️  WARNING: Data may be stale! Last game was {days_since} days ago.")
        print(f"  → Consider running import to fetch latest games from {platform}")
    elif days_since > 0:
        print(f"\n  ℹ️  Data is recent (last game {days_since} day(s) ago)")
    else:
        print(f"\n  ✓ Data is up-to-date (game played today)")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python scripts/check_recent_games.py <user_id> <platform> [time_control_category]")
        print("\nExamples:")
        print("  python scripts/check_recent_games.py skudurrrrr chess.com")
        print("  python scripts/check_recent_games.py skudurrrrr chess.com Rapid")
        print("  python scripts/check_recent_games.py skudurrrrr lichess Blitz")
        print("\nAvailable time control categories: Bullet, Blitz, Rapid, Classical, Correspondence, Unknown")
        sys.exit(1)

    user_id = sys.argv[1]
    platform = sys.argv[2]
    time_control = sys.argv[3] if len(sys.argv) > 3 else None

    check_recent_games(user_id, platform, time_control)
