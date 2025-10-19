"""
Re-analyze specific players by deleting their cached analysis data.
This forces the system to recalculate personality scores with the new formula.
"""

import os
import sys

# Add python directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

from core.parallel_analysis_engine import get_supabase_client

def reanalyze_player(user_id: str, platform: str):
    """Delete analysis data for a player to trigger re-analysis."""
    print(f"\n{'='*70}")
    print(f"RE-ANALYZING: {user_id} on {platform}")
    print(f"{'='*70}")
    
    client = get_supabase_client()
    
    try:
        # Delete from move_analyses (this is where personality scores are cached)
        print(f"Deleting move_analyses for {user_id}...")
        delete_response = client.table('move_analyses').delete().eq('user_id', user_id).eq('platform', platform).execute()
        deleted_count = len(delete_response.data) if delete_response.data else 0
        print(f"✓ Deleted {deleted_count} move analyses records")
        
        print(f"\n✓ Analysis data cleared for {user_id}")
        print(f"Refresh the page to trigger automatic re-analysis with new formula!")
        
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == '__main__':
    # Re-analyze both players
    reanalyze_player('krecetas', 'lichess')
    reanalyze_player('skudurrrr', 'chess.com')
    
    print(f"\n{'='*70}")
    print("RE-ANALYSIS TRIGGERED")
    print(f"{'='*70}")
    print("\nNext steps:")
    print("1. Wait 5-10 seconds for backend to fully start")
    print("2. Refresh the browser page")
    print("3. The system will automatically re-analyze with the new formula")
    print("4. You should see Novelty/Staleness scores properly differentiated!")
    print()


