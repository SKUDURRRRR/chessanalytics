"""Check what's in the move_analyses table for these players."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

from core.parallel_analysis_engine import get_supabase_client

client = get_supabase_client()

# Check krecetas
print("Checking krecetas...")
response1 = client.table('move_analyses').select('user_id, platform, game_id, analysis_date').eq('user_id', 'krecetas').eq('platform', 'lichess').limit(5).execute()
print(f"Found {len(response1.data) if response1.data else 0} records")
if response1.data:
    print(f"Sample: {response1.data[0]}")

# Try with canonical_user_id
response2 = client.table('move_analyses').select('user_id, canonical_user_id, platform, game_id').eq('canonical_user_id', 'krecetas_lichess').limit(5).execute()
print(f"\nWith canonical_user_id: {len(response2.data) if response2.data else 0} records")
if response2.data:
    print(f"Sample: {response2.data[0]}")

print("\n" + "="*70)
print("Checking skudurrrr...")
response3 = client.table('move_analyses').select('user_id, platform, game_id').eq('user_id', 'skudurrrr').eq('platform', 'chess.com').limit(5).execute()
print(f"Found {len(response3.data) if response3.data else 0} records")

# List all columns
print("\n" + "="*70)
print("Checking table columns...")
response4 = client.table('move_analyses').select('*').limit(1).execute()
if response4.data:
    print(f"Columns: {list(response4.data[0].keys())}")


