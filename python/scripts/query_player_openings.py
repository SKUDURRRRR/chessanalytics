#!/usr/bin/env python3
"""
Query script to count openings and games for a player with white pieces.
Usage: python query_player_openings.py <username> [platform]
"""

import sys
import os
from pathlib import Path
from collections import Counter

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env.local')
load_dotenv(BASE_DIR / '.env')

def should_count_opening_for_color(opening: str, player_color: str) -> bool:
    """
    Check if an opening should be counted for a specific player color.
    This prevents counting opponent's openings (e.g., skip Caro-Kann when player is white).
    """
    if not opening:
        return False

    opening_lower = opening.lower()

    # Black openings (defenses) - only count when player is black
    black_openings = [
        'sicilian', 'french', 'caro-kann', 'pirc', 'modern defense',
        'scandinavian', 'alekhine', 'nimzowitsch defense', 'petrov', 'philidor',
        "king's indian", 'grunfeld', 'grünfeld', 'nimzo-indian',
        "queen's gambit declined", "queen's gambit accepted", 'slav', 'semi-slav',
        "queen's indian", 'benoni', 'benko', 'dutch', 'budapest', 'tarrasch defense',
        'two knights defense', 'hungarian defense', 'latvian gambit',
        'elephant gambit', 'damiano defense', 'portuguese opening'
    ]

    # White openings (systems/attacks) - only count when player is white
    white_openings = [
        'italian', 'ruy lopez', 'spanish', 'scotch', 'four knights', 'vienna',
        "king's gambit", "bishop's opening", 'center game', 'giuoco piano',
        "queen's gambit", 'london', 'colle', 'torre', 'trompowsky',
        'blackmar-diemer', 'english', 'reti', 'réti', "bird's", "larsen's",
        'catalan', 'benko gambit declined', 'ponziani', 'danish gambit',
        'alapin', 'morra', 'smith-morra', 'wing gambit', 'evans gambit',
        'fried liver', 'max lange', 'greco', 'italian gambit',
        'mieses opening', 'barnes opening', 'polish', 'orangutan', 'sokolsky',
        'nimzowitsch-larsen', 'zukertort', 'old indian attack',
        'kingside fianchetto', 'queenside fianchetto', 'stonewall'
    ]

    # Check if it's a black opening
    for black_op in black_openings:
        if black_op in opening_lower:
            return player_color == 'black'

    # Check if it's a white opening
    for white_op in white_openings:
        if white_op in opening_lower:
            return player_color == 'white'

    # Heuristics
    if 'defense' in opening_lower or 'defence' in opening_lower:
        return player_color == 'black'

    if 'attack' in opening_lower or 'system' in opening_lower or 'gambit' in opening_lower:
        return player_color == 'white'

    # Neutral or unknown - count for both (but be conservative)
    # For white games, we're more strict - only count if it's clearly a white opening
    if player_color == 'white':
        return False  # When in doubt, don't count for white

    # For black, we can be more lenient
    return True

def canonicalize_user_id(user_id: str, platform: str) -> str:
    """Canonicalize user ID based on platform."""
    if platform == 'chess.com':
        return user_id.strip().lower()
    else:  # lichess
        return user_id.strip()

def get_supabase_client() -> Client:
    """Initialize and return Supabase client."""
    supabase_url = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')

    if not supabase_url or not supabase_key:
        raise ValueError("Missing Supabase credentials. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY")

    return create_client(supabase_url, supabase_key)

def query_player_white_openings(username: str, platform: str = None):
    """Query openings and games for a player with white pieces."""
    client = get_supabase_client()

    # Canonicalize user ID
    canonical_user_id = canonicalize_user_id(username, platform if platform else 'lichess')

    print(f"Querying for player: {username}")
    print(f"Canonical user ID: {canonical_user_id}")
    print(f"Platform: {platform if platform else 'all'}")
    print("-" * 60)

    # If no platform specified, query both platforms separately
    if not platform:
        results = {}
        for p in ['lichess', 'chess.com']:
            platform_id = canonicalize_user_id(username, p)
            try:
                # First get count
                count_response = client.table('games').select('id', count='exact', head=True).eq('user_id', platform_id).eq('platform', p).eq('color', 'white').execute()
                total_count = getattr(count_response, 'count', 0) or 0

                if total_count == 0:
                    continue

                print(f"\nFound {total_count} total games with white pieces on {p}")

                # Fetch all games with pagination if needed
                all_platform_games = []
                page_size = 1000
                offset = 0

                while offset < total_count:
                    page_query = client.table('games').select(
                        'id, opening, opening_family, opening_normalized, color, platform'
                    ).eq('user_id', platform_id).eq('platform', p).eq('color', 'white').range(offset, offset + page_size - 1)

                    response = page_query.execute()
                    if response.data:
                        all_platform_games.extend(response.data)

                    if len(response.data) < page_size:
                        break

                    offset += page_size

                results[p] = all_platform_games
                print(f"Fetched {len(all_platform_games)} games from {p}")
            except Exception as e:
                print(f"Error querying {p}: {e}")
                import traceback
                traceback.print_exc()

        # Combine results
        all_games = []
        for games in results.values():
            all_games.extend(games)

        if not all_games:
            print(f"\nNo games found for player '{username}' with white pieces.")
            return

        # Analyze openings - FILTER OUT BLACK OPENINGS for white games
        opening_normalized = []
        openings = []
        opening_families = []
        filtered_out = Counter()  # Track what we filtered

        for game in all_games:
            # Get the opening name
            raw_opening = game.get('opening_normalized') or game.get('opening_family') or game.get('opening')

            if not raw_opening or raw_opening.strip() == '' or raw_opening == 'Unknown' or raw_opening == 'null':
                continue

            # 🚨 CRITICAL: Filter out black openings when player is white
            if not should_count_opening_for_color(raw_opening, 'white'):
                filtered_out[raw_opening] += 1
                continue  # Skip this game - it's a black opening

            # Only count openings that the player actually played
            opening_normalized.append(raw_opening)

            if game.get('opening'):
                openings.append(game['opening'])
            if game.get('opening_family'):
                opening_families.append(game['opening_family'])

        # Count distinct openings (after filtering)
        distinct_normalized = len(set([o for o in opening_normalized if o and o.strip()]))
        distinct_openings = len(set([o for o in openings if o and o.strip()]))
        distinct_families = len(set([o for o in opening_families if o and o.strip()]))

        print(f"\n{'='*60}")
        print(f"RESULTS FOR {username.upper()} (WHITE PIECES)")
        print(f"{'='*60}")
        print(f"Total games with white pieces: {len(all_games)}")
        print(f"Games with valid player openings (after filtering): {len(opening_normalized)}")
        print(f"Distinct openings (normalized): {distinct_normalized}")
        print(f"Distinct openings (raw): {distinct_openings}")
        print(f"Distinct opening families: {distinct_families}")
        print(f"\nBreakdown by platform:")
        for p, games in results.items():
            print(f"  {p}: {len(games)} games")

        # Show filtered openings for debugging
        if filtered_out:
            print(f"\n[FILTERED] Filtered out {sum(filtered_out.values())} games with black openings:")
            for opening, count in filtered_out.most_common(5):
                print(f"  - {opening}: {count} games")

        # Show opening distribution (only player's actual openings)
        opening_counts = Counter([o for o in opening_normalized if o and o.strip()])
        if opening_counts:
            print(f"\nTop 10 most played openings (player's actual openings):")
            for opening, count in opening_counts.most_common(10):
                print(f"  {opening}: {count} games")

        return

    # Platform-specific query - first get count
    try:
        count_response = client.table('games').select('id', count='exact', head=True).eq('user_id', canonical_user_id).eq('platform', platform).eq('color', 'white').execute()
        total_count = getattr(count_response, 'count', 0) or 0

        if total_count == 0:
            print(f"\nNo games found for player '{username}' with white pieces on platform '{platform}'.")
            return

        print(f"\nFound {total_count} total games with white pieces")

        # Fetch all games with pagination if needed
        games = []
        page_size = 1000
        offset = 0

        while offset < total_count:
            page_query = client.table('games').select(
                'id, opening, opening_family, opening_normalized, color'
            ).eq('user_id', canonical_user_id).eq('platform', platform).eq('color', 'white').range(offset, offset + page_size - 1)

            response = page_query.execute()
            if response.data:
                games.extend(response.data)

            if len(response.data) < page_size:
                break

            offset += page_size

        print(f"Fetched {len(games)} games total")

        if not games:
            print(f"\nNo games found for player '{username}' with white pieces on platform '{platform}'.")
            return

        # Analyze openings - FILTER OUT BLACK OPENINGS for white games
        opening_normalized = []
        openings = []
        opening_families = []
        filtered_out = Counter()  # Track what we filtered

        for game in games:
            # Get the opening name
            raw_opening = game.get('opening_normalized') or game.get('opening_family') or game.get('opening')

            if not raw_opening or raw_opening.strip() == '' or raw_opening == 'Unknown' or raw_opening == 'null':
                continue

            # 🚨 CRITICAL: Filter out black openings when player is white
            if not should_count_opening_for_color(raw_opening, 'white'):
                filtered_out[raw_opening] += 1
                continue  # Skip this game - it's a black opening

            # Only count openings that the player actually played
            opening_normalized.append(raw_opening)

            if game.get('opening'):
                openings.append(game['opening'])
            if game.get('opening_family'):
                opening_families.append(game['opening_family'])

        # Count distinct openings (after filtering)
        distinct_normalized = len(set([o for o in opening_normalized if o and o.strip()]))
        distinct_openings = len(set([o for o in openings if o and o.strip()]))
        distinct_families = len(set([o for o in opening_families if o and o.strip()]))

        print(f"\n{'='*60}")
        print(f"RESULTS FOR {username.upper()} (WHITE PIECES)")
        print(f"{'='*60}")
        print(f"Total games with white pieces: {len(games)}")
        print(f"Games with valid player openings (after filtering): {len(opening_normalized)}")
        print(f"Distinct openings (normalized): {distinct_normalized}")
        print(f"Distinct openings (raw): {distinct_openings}")
        print(f"Distinct opening families: {distinct_families}")

        # Show filtered openings for debugging
        if filtered_out:
            print(f"\n[FILTERED] Filtered out {sum(filtered_out.values())} games with black openings:")
            for opening, count in filtered_out.most_common(5):
                print(f"  - {opening}: {count} games")

        # Show opening distribution (only player's actual openings)
        opening_counts = Counter([o for o in opening_normalized if o and o.strip()])
        if opening_counts:
            print(f"\nTop 10 most played openings (player's actual openings):")
            for opening, count in opening_counts.most_common(10):
                print(f"  {opening}: {count} games")

    except Exception as e:
        print(f"Error querying database: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python query_player_openings.py <username> [platform]")
        print("  username: The chess player's username")
        print("  platform: Optional - 'lichess' or 'chess.com' (default: query both)")
        sys.exit(1)

    username = sys.argv[1]
    platform = sys.argv[2] if len(sys.argv) > 2 else None

    if platform and platform not in ['lichess', 'chess.com']:
        print(f"Error: Platform must be 'lichess' or 'chess.com'")
        sys.exit(1)

    query_player_white_openings(username, platform)
