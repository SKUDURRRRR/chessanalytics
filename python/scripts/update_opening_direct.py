"""
Direct update of opening name for game 145358485646
This updates the opening field from "Unknown" to "Philidor Defense"
"""

from supabase import create_client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')
load_dotenv()

# Get Supabase credentials
url = os.getenv('VITE_SUPABASE_URL')
service_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')
anon_key = os.getenv('VITE_SUPABASE_ANON_KEY')

key = service_key or anon_key

if not url or not key:
    print("[X] ERROR: Missing Supabase credentials")
    exit(1)

# Create Supabase client
client = create_client(url, key)

game_id_provider = '145358485646'
platform = 'chess.com'

print("=" * 80)
print(f"UPDATING OPENING FOR GAME: {game_id_provider}")
print("=" * 80)

# Find the game
print(f"\nFinding game...")
result = client.table('games').select(
    'id, opening, opening_family, opening_normalized'
).eq('provider_game_id', game_id_provider).eq('platform', platform).execute()

if not result.data or len(result.data) == 0:
    print(f"[X] ERROR: Game not found")
    exit(1)

game = result.data[0]
print(f"[OK] Found game: {game['id']}")
print(f"\nCurrent values:")
print(f"  opening:            '{game.get('opening')}'")
print(f"  opening_family:     '{game.get('opening_family')}'")
print(f"  opening_normalized: '{game.get('opening_normalized')}'")

# Update the opening field to Italian Game (from White's perspective)
# White played: 1.e4 e5 2.Nf3 d6 3.Bc4 - this is Italian Game
new_opening = "Italian Game"
new_eco = "C50"  # Italian Game ECO code
new_normalized = "Italian Game"

print(f"\nUpdating opening to: '{new_opening}' (ECO: {new_eco})")

try:
    client.table('games').update({
        'opening': new_opening,
        'opening_family': new_eco,
        'opening_normalized': new_normalized
    }).eq('id', game['id']).execute()

    print("[OK] Game updated successfully!")

    # Verify
    verify_result = client.table('games').select(
        'opening, opening_family, opening_normalized'
    ).eq('id', game['id']).execute()

    if verify_result.data:
        updated_game = verify_result.data[0]
        print(f"\nVerification - Updated values:")
        print(f"  opening:            '{updated_game.get('opening')}'")
        print(f"  opening_family:     '{updated_game.get('opening_family')}'")
        print(f"  opening_normalized: '{updated_game.get('opening_normalized')}'")
        print("\n[OK] Opening update complete!")
        print("[INFO] Refresh your browser to see the updated opening name.")

except Exception as e:
    print(f"[X] ERROR updating game: {e}")
    exit(1)
