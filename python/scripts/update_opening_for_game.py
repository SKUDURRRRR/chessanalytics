"""
Update opening name for a specific game
This script updates the opening information for a single game based on its actual moves.
"""

from supabase import create_client
import os
from dotenv import load_dotenv
import sys
import chess
import chess.pgn
from io import StringIO

# Add parent directory to path to import from core
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))
from opening_utils import normalize_opening_name, get_opening_name_from_eco_code

# Load environment variables
load_dotenv('.env.local')
load_dotenv()

def identify_opening_from_moves(moves_list):
    """
    Identify chess opening from move list.
    Returns tuple: (opening_name, eco_code)
    """
    if not moves_list or len(moves_list) < 2:
        return "Unknown Opening", None

    # Get first 6 moves to identify opening accurately
    first_moves = [m.lower() for m in moves_list[:6]]

    # Check for specific Black responses after 1.e4 e5 2.Nf3
    if len(first_moves) >= 3:
        if (first_moves[0] in ['e4', 'e2e4'] and
            first_moves[1] in ['e5', 'e7e5'] and
            first_moves[2] in ['nf3', 'g1f3']):

            # Philidor Defense: 1.e4 e5 2.Nf3 d6
            if len(first_moves) >= 4 and first_moves[3] in ['d6', 'd7d6']:
                return "Philidor Defense", "C41"

            # Italian Game: 1.e4 e5 2.Nf3 Nc6 3.Bc4
            if (len(first_moves) >= 5 and
                first_moves[3] in ['nc6', 'b8c6'] and
                first_moves[4] in ['bc4', 'f1c4']):
                return "Italian Game", "C50"

            # Ruy Lopez: 1.e4 e5 2.Nf3 Nc6 3.Bb5
            if (len(first_moves) >= 5 and
                first_moves[3] in ['nc6', 'b8c6'] and
                first_moves[4] in ['bb5', 'f1b5']):
                return "Ruy Lopez", "C60"

            # Scotch Game: 1.e4 e5 2.Nf3 Nc6 3.d4
            if (len(first_moves) >= 5 and
                first_moves[3] in ['nc6', 'b8c6'] and
                first_moves[4] in ['d4', 'd2d4']):
                return "Scotch Game", "C45"

            # Petrov Defense: 1.e4 e5 2.Nf3 Nf6
            if len(first_moves) >= 4 and first_moves[3] in ['nf6', 'g8f6']:
                return "Petrov Defense", "C42"

            # King's Pawn Game (general, after 2.Nf3)
            return "King's Pawn Game", "C40"

    # General Open Game (1.e4 e5)
    if len(first_moves) >= 2:
        first_two = [first_moves[0], first_moves[1]]

        if first_two[0] in ['e4', 'e2e4']:
            if first_two[1] in ['e5', 'e7e5']:
                return "King's Pawn Game", "C20"
            elif first_two[1] in ['c5', 'c7c5']:
                return "Sicilian Defense", "B20"
            elif first_two[1] in ['e6', 'e7e6']:
                return "French Defense", "C00"
            elif first_two[1] in ['c6', 'c7c6']:
                return "Caro-Kann Defense", "B10"
            elif first_two[1] in ['d5', 'd7d5']:
                return "Scandinavian Defense", "B01"
            elif first_two[1] in ['nf6', 'g8f6']:
                return "Alekhine Defense", "B02"

        elif first_two[0] in ['d4', 'd2d4']:
            if first_two[1] in ['d5', 'd7d5']:
                return "Queen's Pawn Game", "D00"
            elif first_two[1] in ['nf6', 'g8f6']:
                return "Indian Defense", "A45"

        elif first_two[0] in ['nf3', 'g1f3']:
            return "Reti Opening", "A04"

        elif first_two[0] in ['c4', 'c2c4']:
            return "English Opening", "A10"

    return "Unknown Opening", None

def extract_moves_from_pgn(pgn_str):
    """Extract move list from PGN string"""
    try:
        pgn_io = StringIO(pgn_str)
        game = chess.pgn.read_game(pgn_io)

        if not game:
            return []

        moves = []
        board = game.board()
        for move in game.mainline_moves():
            moves.append(board.san(move))
            board.push(move)

        return moves
    except Exception as e:
        print(f"Error parsing PGN: {e}")
        return []

def update_game_opening(game_id_provider: str, platform: str = 'chess.com'):
    """
    Update opening information for a specific game.

    Args:
        game_id_provider: The provider_game_id (e.g., '145358485646' for chess.com)
        platform: Platform name (default: 'chess.com')
    """

    # Get Supabase credentials
    url = os.getenv('VITE_SUPABASE_URL')
    service_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')
    anon_key = os.getenv('VITE_SUPABASE_ANON_KEY')

    key = service_key or anon_key

    if not url or not key:
        print("[X] ERROR: Missing Supabase credentials")
        print("Need VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)")
        return False

    # Create Supabase client
    client = create_client(url, key)

    print("=" * 80)
    print(f"UPDATING OPENING FOR GAME: {game_id_provider} ({platform})")
    print("=" * 80)

    # Step 1: Find the game
    print(f"\nStep 1: Finding game with provider_game_id = {game_id_provider}...")

    try:
        result = client.table('games').select(
            'id, user_id, provider_game_id, platform, opening, opening_family, opening_normalized'
        ).eq('provider_game_id', game_id_provider).eq('platform', platform).execute()

        if not result.data or len(result.data) == 0:
            print(f"[X] ERROR: Game not found with provider_game_id = {game_id_provider} on {platform}")
            return False

        game = result.data[0]
        print(f"[OK] Found game: {game['id']}")
        print(f"   User ID: {game['user_id']}")
        print(f"   Current opening: {game.get('opening', 'N/A')}")
        print(f"   Current opening_family: {game.get('opening_family', 'N/A')}")
        print(f"   Current opening_normalized: {game.get('opening_normalized', 'N/A')}")

    except Exception as e:
        print(f"[X] ERROR finding game: {e}")
        return False

    # Step 2: Get PGN from games_pgn table
    print(f"\nStep 2: Fetching PGN data...")

    try:
        pgn_result = client.table('games_pgn').select('pgn').eq(
            'provider_game_id', game_id_provider
        ).eq('platform', platform).eq('user_id', game['user_id']).execute()

        if not pgn_result.data or len(pgn_result.data) == 0:
            print("[X] ERROR: No PGN data found for this game")
            print("   The game exists but PGN was not stored.")
            print("   Cannot identify opening without PGN.")
            return False

        pgn = pgn_result.data[0]['pgn']
        print(f"[OK] PGN data retrieved")

    except Exception as e:
        print(f"[X] ERROR fetching PGN: {e}")
        return False

    # Step 3: Extract moves from PGN
    print(f"\nStep 3: Analyzing game moves...")

    moves = extract_moves_from_pgn(pgn)
    if not moves:
        print("[X] ERROR: Could not extract moves from PGN")
        return False

    print(f"[OK] Extracted {len(moves)} moves")
    print(f"   First 6 moves: {' '.join(moves[:6])}")

    # Step 4: Identify the opening
    print(f"\nStep 4: Identifying opening...")

    opening_name, eco_code = identify_opening_from_moves(moves)

    print(f"[OK] Identified opening: {opening_name}")
    if eco_code:
        print(f"   ECO Code: {eco_code}")

    # Normalize the opening name
    opening_normalized = normalize_opening_name(opening_name)

    print(f"   Normalized: {opening_normalized}")

    # Step 5: Confirm update
    print(f"\n" + "=" * 80)
    print("PROPOSED UPDATE:")
    print("=" * 80)
    print(f"  opening:            '{game.get('opening')}' -> '{opening_name}'")
    print(f"  opening_family:     '{game.get('opening_family')}' -> '{eco_code or opening_name}'")
    print(f"  opening_normalized: '{game.get('opening_normalized')}' -> '{opening_normalized}'")
    print("=" * 80)

    response = input("\nProceed with update? (yes/no): ")

    if response.lower() != 'yes':
        print("[X] Update cancelled.")
        return False

    # Step 6: Update the game
    print(f"\nStep 6: Updating game in database...")

    try:
        update_data = {
            'opening': opening_name,
            'opening_family': eco_code or opening_name,
            'opening_normalized': opening_normalized
        }

        client.table('games').update(update_data).eq('id', game['id']).execute()

        print("[OK] Game updated successfully!")

        # Verify the update
        verify_result = client.table('games').select(
            'opening, opening_family, opening_normalized'
        ).eq('id', game['id']).execute()

        if verify_result.data:
            updated_game = verify_result.data[0]
            print(f"\n" + "=" * 80)
            print("VERIFICATION - Current values in database:")
            print("=" * 80)
            print(f"  opening:            {updated_game.get('opening')}")
            print(f"  opening_family:     {updated_game.get('opening_family')}")
            print(f"  opening_normalized: {updated_game.get('opening_normalized')}")
            print("=" * 80)

        return True

    except Exception as e:
        print(f"[X] ERROR updating game: {e}")
        return False

if __name__ == "__main__":
    # Get game ID from command line or use default
    if len(sys.argv) > 1:
        game_id = sys.argv[1]
        platform = sys.argv[2] if len(sys.argv) > 2 else 'chess.com'
    else:
        # Default to the requested game
        game_id = '145358485646'
        platform = 'chess.com'

    success = update_game_opening(game_id, platform)

    if success:
        print("\n[OK] Opening update complete!")
        print("[INFO] Refresh your browser to see the updated opening name.")
    else:
        print("\n[X] Opening update failed.")
        sys.exit(1)
