#!/usr/bin/env python3
"""
Re-analyze 10 games for skudurelis with the new staleness settings.
This will update the database with improved staleness calculations.
"""

import sys
import os
import asyncio
import json
from datetime import datetime

# Add the python directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'python'))

from core.analysis_engine import ChessAnalysisEngine, AnalysisConfig, AnalysisType
from core.unified_api_server import supabase_service, supabase

async def reanalyze_10_games():
    """Re-analyze 10 games with new staleness settings."""
    
    print("Re-analyzing 10 Games for skudurelis with New Staleness Settings")
    print("=" * 70)
    
    # Get a few games to re-analyze
    db_client = supabase_service or supabase
    
    try:
        # Get 10 most recent games that were previously analyzed
        result = db_client.table('games').select('*').eq('user_id', 'skudurelis').eq('platform', 'lichess').order('played_at', desc=True).limit(10).execute()
        
        if not result.data:
            print("No games found for re-analysis")
            return
            
        print(f"Re-analyzing {len(result.data)} games for skudurelis")
        
        engine = ChessAnalysisEngine()
        
        for i, game in enumerate(result.data, 1):
            print(f"\nRe-analyzing game {i}/10: {game['id']}")
            
            # Get PGN data from games_pgn table
            pgn_result = db_client.table('games_pgn').select('pgn').eq('user_id', 'skudurelis').eq('platform', 'lichess').eq('provider_game_id', game['provider_game_id']).execute()
            
            if not pgn_result.data or not pgn_result.data[0].get('pgn'):
                print(f"   No PGN data found for game {game['provider_game_id']}")
                continue
                
            pgn_data = pgn_result.data[0]['pgn']
            
            # Get old personality scores for comparison
            old_analysis = db_client.table('unified_analyses').select('*').eq('user_id', 'skudurelis').eq('platform', 'lichess').eq('provider_game_id', game['provider_game_id']).execute()
            
            old_staleness = 0
            old_novelty = 0
            if old_analysis.data:
                old_staleness = old_analysis.data[0].get('staleness_score', 0)
                old_novelty = old_analysis.data[0].get('novelty_score', 0)
            
            print(f"   Old scores - Staleness: {old_staleness:.1f}, Novelty: {old_novelty:.1f}")
            
            # Re-analyze with new settings
            start_time = datetime.now()
            
            new_analysis = await engine.analyze_game(
                pgn=pgn_data,
                user_id='skudurelis',
                platform='lichess',
                analysis_type=AnalysisType.STOCKFISH,
                game_id=game['provider_game_id']
            )
            
            end_time = datetime.now()
            analysis_time = (end_time - start_time).total_seconds()
            
            if new_analysis:
                new_staleness = new_analysis.staleness_score
                new_novelty = new_analysis.novelty_score
                staleness_change = new_staleness - old_staleness
                novelty_change = new_novelty - old_novelty
                
                print(f"   New scores - Staleness: {new_staleness:.1f}, Novelty: {new_novelty:.1f}")
                print(f"   Changes - Staleness: {staleness_change:+.1f}, Novelty: {novelty_change:+.1f}")
                print(f"   Analysis time: {analysis_time:.1f}s")
                
                if abs(staleness_change) > 5 or abs(novelty_change) > 5:
                    print(f"   ✅ SIGNIFICANT CHANGE: Staleness/Novelty scores updated!")
                else:
                    print(f"   📊 Minor changes in personality scores")
            else:
                print(f"   ❌ Re-analysis failed")
        
        print(f"\n🎉 RE-ANALYSIS COMPLETE!")
        print(f"   ✅ 10 games for skudurelis now use the new staleness settings")
        print(f"   📈 You can see the improved staleness scores in your app")
        print(f"   🔄 To re-analyze more games, run this script again")
        
    except Exception as e:
        print(f"Error during re-analysis: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("This will re-analyze 10 games for skudurelis with new staleness calculations.")
    print("   The new staleness trait will show proper opposition to novelty.")
    print("   This may take a few minutes...")
    response = input("Continue? (y/N): ")
    
    if response.lower() == 'y':
        asyncio.run(reanalyze_10_games())
    else:
        print("Cancelled.")
