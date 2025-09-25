#!/usr/bin/env python3
"""
Update tactical scores using the new formula without re-analyzing games.
This script recalculates personality scores using existing move analysis data.
"""

import sys
import os
import json
from datetime import datetime

# Add the python directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'python'))

from core.unified_api_server import supabase_service, supabase
from core.analysis_engine import ChessAnalysisEngine

def calculate_new_tactical_score(moves_analysis_data):
    """Calculate tactical score using the new formula."""
    if not moves_analysis_data:
        return 50.0
    
    total_moves = len(moves_analysis_data)
    
    # Count move types
    blunders = sum(1 for m in moves_analysis_data if m.get('is_blunder', False))
    mistakes = sum(1 for m in moves_analysis_data if m.get('is_mistake', False))
    brilliant_moves = sum(1 for m in moves_analysis_data if m.get('centipawn_loss', 0) < -100)
    best_moves = sum(1 for m in moves_analysis_data if m.get('is_best', False))
    
    # Calculate average centipawn loss
    avg_centipawn_loss = sum(m.get('centipawn_loss', 0) for m in moves_analysis_data) / total_moves
    
    # New formula
    error_penalty = (blunders * 5 + mistakes * 3) / total_moves * 100
    centipawn_penalty = min(10, avg_centipawn_loss / 6)
    best_move_bonus = (best_moves / total_moves) * 25
    brilliant_bonus = (brilliant_moves / total_moves) * 35
    pattern_bonus = 0  # No patterns in this data
    
    tactical_score = 100 - error_penalty - centipawn_penalty + best_move_bonus + brilliant_bonus + pattern_bonus
    return max(0, min(100, tactical_score))

def update_tactical_scores():
    """Update tactical scores for existing analyses."""
    
    print("🔄 Updating Tactical Scores with New Formula")
    print("=" * 50)
    
    db_client = supabase_service or supabase
    
    try:
        # Get all move analyses for the user
        response = db_client.table('move_analyses').select('*').eq('user_id', 'skudurelis').eq('platform', 'lichess').execute()
        
        if not response.data:
            print("❌ No move analyses found")
            return
            
        print(f"📊 Found {len(response.data)} analyses to update")
        
        updated_count = 0
        
        for analysis in response.data:
            analysis_id = analysis['id']
            old_tactical_score = analysis.get('tactical_score', 0)
            moves_analysis = analysis.get('moves_analysis', [])
            
            if not moves_analysis:
                print(f"⚠️  Skipping {analysis_id} - no moves analysis data")
                continue
            
            # Calculate new tactical score
            new_tactical_score = calculate_new_tactical_score(moves_analysis)
            
            # Update the database
            update_response = db_client.table('move_analyses').update({
                'tactical_score': new_tactical_score,
                'updated_at': datetime.now().isoformat()
            }).eq('id', analysis_id).execute()
            
            if update_response.data:
                improvement = old_tactical_score - new_tactical_score
                print(f"✅ Updated {analysis_id}")
                print(f"   Old: {old_tactical_score:.1f} → New: {new_tactical_score:.1f} ({improvement:+.1f})")
                updated_count += 1
            else:
                print(f"❌ Failed to update {analysis_id}")
        
        print(f"\n📋 UPDATE COMPLETE!")
        print(f"   • Updated {updated_count} analyses")
        print(f"   • New tactical scores are now more realistic")
        print(f"   • Refresh your app to see the updated scores")
        
    except Exception as e:
        print(f"❌ Error during update: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("⚠️  This will update tactical scores in your database with the new formula.")
    print("   The new scores will be more realistic based on actual blunders and mistakes.")
    response = input("Continue? (y/N): ")
    
    if response.lower() == 'y':
        update_tactical_scores()
    else:
        print("Cancelled.")
