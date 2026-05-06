"""
Backfill opening_normalized for games with ECO codes
This script updates games where opening_normalized is 'Unknown' or NULL
but opening_family contains a valid ECO code that can be converted to a name.
"""

from supabase import create_client
import os
from dotenv import load_dotenv
import sys

# Import the normalize_opening_name function from the backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python', 'core'))
from opening_utils import normalize_opening_name

load_dotenv()

url = os.getenv('VITE_SUPABASE_URL')
key = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

if not url or not key:
    print("ERROR: Missing Supabase credentials")
    print("Need VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)")
    exit(1)

client = create_client(url, key)

print("=" * 80)
print("BACKFILLING OPENING_NORMALIZED FIELD")
print("=" * 80)

# Step 1: Find games that need backfilling
print("\nStep 1: Finding games that need backfilling...")
result = client.table('games').select('id, opening, opening_family, opening_normalized').execute()

needs_update = []
for game in result.data:
    opening_normalized = game.get('opening_normalized', '')
    opening_family = game.get('opening_family', '')
    opening = game.get('opening', '')

    # Check if needs updating:
    # - opening_normalized is NULL, empty, or "Unknown"
    # - AND opening_family or opening has a value that could be normalized
    if (not opening_normalized or opening_normalized.strip() == '' or opening_normalized == 'Unknown'):
        # Try to normalize from opening_family first, then opening
        raw_value = opening_family if opening_family and opening_family != 'Unknown' else opening

        if raw_value and raw_value != 'Unknown':
            normalized = normalize_opening_name(raw_value)

            # Only update if normalization produced a different result
            if normalized and normalized != 'Unknown' and normalized != raw_value:
                needs_update.append({
                    'id': game['id'],
                    'current_normalized': opening_normalized,
                    'opening_family': opening_family,
                    'opening': opening,
                    'new_normalized': normalized
                })

print(f"Found {len(needs_update)} games that need backfilling")

if len(needs_update) == 0:
    print("\nAll games already have proper opening_normalized values!")
    print("No backfilling needed.")
    exit(0)

# Show sample
print("\nSample games to be updated (first 5):")
for i, game in enumerate(needs_update[:5], 1):
    print(f"\n  Game {i}:")
    print(f"    Current normalized: '{game['current_normalized']}'")
    print(f"    Opening family: '{game['opening_family']}'")
    print(f"    Opening: '{game['opening']}'")
    print(f"    NEW normalized: '{game['new_normalized']}'")

# Step 2: Ask for confirmation
print(f"\n" + "=" * 80)
print(f"About to update {len(needs_update)} games")
print("=" * 80)
response = input("\nProceed with backfill? (yes/no): ")

if response.lower() != 'yes':
    print("Backfill cancelled.")
    exit(0)

# Step 3: Update games in batches
print("\nStep 3: Updating games...")
batch_size = 100
total_updated = 0
failed = 0

for i in range(0, len(needs_update), batch_size):
    batch = needs_update[i:i+batch_size]

    for game in batch:
        try:
            client.table('games').update({
                'opening_normalized': game['new_normalized']
            }).eq('id', game['id']).execute()
            total_updated += 1

            if total_updated % 100 == 0:
                print(f"  Updated {total_updated}/{len(needs_update)} games...")
        except Exception as e:
            print(f"  Error updating game {game['id']}: {e}")
            failed += 1

print(f"\n" + "=" * 80)
print("BACKFILL COMPLETE")
print("=" * 80)
print(f"Successfully updated: {total_updated} games")
if failed > 0:
    print(f"Failed: {failed} games")

# Step 4: Verify the results
print("\nStep 4: Verifying results...")
verify_result = client.table('games').select('opening_normalized').execute()
total_games = len(verify_result.data)
unknown_count = sum(1 for g in verify_result.data if g.get('opening_normalized') == 'Unknown' or not g.get('opening_normalized'))

print(f"\nTotal games: {total_games}")
print(f"Games still marked as 'Unknown': {unknown_count} ({(unknown_count/total_games*100):.1f}%)")
print(f"Games with proper openings: {total_games - unknown_count} ({((total_games-unknown_count)/total_games*100):.1f}%)")

print("\nBackfill complete! Opening statistics should now display correctly.")
