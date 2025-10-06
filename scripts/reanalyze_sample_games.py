#!/usr/bin/env python3
"""
Re-analyze a few games with the new accuracy settings.
This will update the database with improved accuracy calculations.
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

async def reanalyze_sample_games():
    """Re-analyze a few games with new settings."""
    
    print("Re-analyzing Sample Games with New Settings")
    print("=" * 50)
    
    # Get a few games to re-analyze
    db_client = supabase_service or supabase
    
    try:
        # Get all games that were previously analyzed
        result = db_client.table('games').select('*').eq('user_id', 'skudurelis').eq('platform', 'lichess').execute()
        
        if not result.data:
            print("No games found for re-analysis")
            return
            
        print(f"Re-analyzing {len(result.data)} games")
        
        engine = ChessAnalysisEngine()
        
        for i, game in enumerate(result.data, 1):
            print(f"\nRe-analyzing game {i}: {game['id']}")
            
            # Get PGN data from games_pgn table
            pgn_result = db_client.table('games_pgn').select('pgn').eq('user_id', 'skudurelis').eq('platform', 'lichess').eq('provider_game_id', game['provider_game_id']).execute()
            
            if not pgn_result.data or not pgn_result.data[0].get('pgn'):
                print(f"   No PGN data found for game {game['provider_game_id']}")
                continue
                
            pgn_data = pgn_result.data[0]['pgn']
            
            # Get old accuracy for comparison
            old_analysis = db_client.table('move_analyses').select('*').eq('game_id', game['provider_game_id']).execute()
            old_accuracy = old_analysis.data[0].get('best_move_percentage', 0) if old_analysis.data else 0
            
            print(f"   Old accuracy: {old_accuracy:.1f}%")
            
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
                new_accuracy = new_analysis.accuracy
                improvement = new_accuracy - old_accuracy
                
                print(f"   New accuracy: {new_accuracy:.1f}%")
                print(f"   Improvement: {improvement:+.1f}%")
                print(f"   Analysis time: {analysis_time:.1f}s")
                
                if improvement > 0:
                    print(f"   SUCCESS: Accuracy improved by {improvement:.1f}%!")
                else:
                    print(f"   Accuracy decreased by {abs(improvement):.1f}%")
            else:
                print(f"   Re-analysis failed")
        
        print(f"\nRE-ANALYSIS COMPLETE!")
        print(f"   These games now use the new accuracy settings")
        print(f"   You can see the improved accuracy in your app")
        print(f"   To re-analyze more games, run this script again")
        
    except Exception as e:
        print(f"Error during re-analysis: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("This will update your database with new accuracy calculations.")
    print("   ALL games for skudurelis will be re-analyzed with tightened brilliant criteria.")
    response = input("Continue? (y/N): ")
    
    if response.lower() == 'y':
        asyncio.run(reanalyze_sample_games())
    else:
        print("Cancelled.")
