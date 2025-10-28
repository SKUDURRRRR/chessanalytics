"""
Quick script to verify test user has games in the database
"""
import sys
sys.path.append('python')

from core.database import get_supabase_client

# Test users
LICHESS_USER = "Pakrovejas69"
CHESSCOM_USER = "hikaru"

def check_games(user_id, platform):
    print(f"\nChecking {platform} user: {user_id}")
    print("=" * 60)

    supabase = get_supabase_client()

    # Check for games
    result = supabase.table('games').select('id').eq('user_id', user_id).eq('platform', platform).limit(10).execute()

    game_count = len(result.data) if result.data else 0
    print(f"Games found: {game_count}")

    if game_count > 0:
        print(f"✅ User {user_id} has games on {platform}")
        print(f"Sample game IDs: {[g['id'] for g in result.data[:3]]}")
    else:
        print(f"❌ User {user_id} has NO games on {platform}")
        print(f"Action needed: Import games for {user_id} on {platform}")

    return game_count > 0

if __name__ == "__main__":
    print("Chess Analytics - Test User Verification")
    print("=" * 60)

    lichess_ok = check_games(LICHESS_USER, 'lichess')
    chesscom_ok = check_games(CHESSCOM_USER, 'chess.com')

    print("\n" + "=" * 60)
    print("SUMMARY:")
    print(f"Lichess ({LICHESS_USER}): {'✅ Ready' if lichess_ok else '❌ Needs games'}")
    print(f"Chess.com ({CHESSCOM_USER}): {'✅ Ready' if chesscom_ok else '❌ Needs games'}")
    print("=" * 60)
