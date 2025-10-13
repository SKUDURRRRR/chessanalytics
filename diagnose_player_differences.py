"""
Diagnostic script to understand why Krecetas and Skudurelis have similar personality scores
despite having very different playing styles.
"""

import os
import sys
from collections import Counter

# Add python directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

from core.parallel_analysis_engine import get_supabase_client
from core.personality_scoring import PersonalityScorer

def analyze_player(user_id: str, platform: str = 'lichess'):
    """Analyze a player's games and show detailed breakdown."""
    print(f"\n{'='*70}")
    print(f"DIAGNOSTIC ANALYSIS: {user_id}")
    print(f"{'='*70}\n")
    
    client = get_supabase_client()
    
    # Create canonical user ID
    canonical_user_id = f"{user_id}_{platform}"
    print(f"User ID: {user_id}")
    print(f"Platform: {platform}")
    print(f"Canonical: {canonical_user_id}")
    
    # Query the games table (has opening metadata)
    games_response = client.table('games').select('*').eq('user_id', user_id).eq('platform', platform).limit(1000).execute()
    games = games_response.data
    
    print(f"Total games: {len(games)}")
    
    # Get analyses
    analyses_response = client.table('move_analyses').select('*').eq('user_id', user_id).eq('platform', platform).execute()
    analyses = analyses_response.data
    print(f"Total analyses: {len(analyses)}")
    
    if not analyses:
        print("❌ No analyses found")
        return
    
    # Analyze opening variety
    print(f"\n{'-'*70}")
    print("OPENING VARIETY")
    print(f"{'-'*70}")
    opening_families = [g.get('opening_family') or g.get('opening') or 'Unknown' for g in games]
    opening_counts = Counter(opening_families)
    unique_openings = len(opening_counts)
    opening_diversity_ratio = unique_openings / len(games) if games else 0
    most_common_opening = opening_counts.most_common(1)[0] if opening_counts else ('None', 0)
    repetition_ratio = most_common_opening[1] / len(games) if games else 0
    
    print(f"Unique opening families: {unique_openings} / {len(games)}")
    print(f"Opening diversity ratio: {opening_diversity_ratio:.3f}")
    print(f"Most played opening: {most_common_opening[0]} ({most_common_opening[1]} games, {repetition_ratio:.1%})")
    print(f"\nTop 10 openings:")
    for opening, count in opening_counts.most_common(10):
        percentage = count / len(games) * 100
        print(f"  {opening}: {count} games ({percentage:.1f}%)")
    
    # Analyze time management
    print(f"\n{'-'*70}")
    print("TIME MANAGEMENT")
    print(f"{'-'*70}")
    time_scores = [a.get('time_management_score', 0) for a in analyses if a.get('time_management_score')]
    if time_scores:
        avg_time_score = sum(time_scores) / len(time_scores)
        min_time = min(time_scores)
        max_time = max(time_scores)
        print(f"Average time management: {avg_time_score:.1f}")
        print(f"Range: {min_time:.1f} - {max_time:.1f}")
        
        # Distribution
        fast_games = sum(1 for t in time_scores if t < 40)
        medium_games = sum(1 for t in time_scores if 40 <= t < 70)
        slow_games = sum(1 for t in time_scores if t >= 70)
        print(f"Fast games (<40): {fast_games} ({fast_games/len(time_scores)*100:.1f}%)")
        print(f"Medium games (40-70): {medium_games} ({medium_games/len(time_scores)*100:.1f}%)")
        print(f"Slow games (>=70): {slow_games} ({slow_games/len(time_scores)*100:.1f}%)")
    else:
        print("⚠️  No time management data found")
    
    # Analyze forcing/quiet ratio
    print(f"\n{'-'*70}")
    print("FORCING vs QUIET MOVES")
    print(f"{'-'*70}")
    
    # Create scorer instance to reuse for forcing move detection
    scorer = PersonalityScorer()
    
    total_forcing = 0
    total_quiet = 0
    game_forcing_ratios = []
    
    for analysis in analyses[:100]:  # Sample first 100 for speed
        moves = analysis.get('moves_analysis', [])
        if not moves:
            continue
        
        game_forcing = 0
        game_quiet = 0
        for move in moves:
            if isinstance(move, dict):
                move_san = move.get('move_san', '')
                is_forcing = scorer.is_forcing_move(move_san)
                if is_forcing:
                    game_forcing += 1
                else:
                    game_quiet += 1
        
        total_forcing += game_forcing
        total_quiet += game_quiet
        if game_forcing + game_quiet > 0:
            game_forcing_ratios.append(game_forcing / (game_forcing + game_quiet))
    
    if game_forcing_ratios:
        avg_forcing_ratio = sum(game_forcing_ratios) / len(game_forcing_ratios)
        print(f"Sample size: {len(game_forcing_ratios)} games")
        print(f"Total forcing moves: {total_forcing}")
        print(f"Total quiet moves: {total_quiet}")
        print(f"Average forcing ratio: {avg_forcing_ratio:.3f} ({avg_forcing_ratio*100:.1f}%)")
        print(f"Average quiet ratio: {1-avg_forcing_ratio:.3f} ({(1-avg_forcing_ratio)*100:.1f}%)")
        
        # Distribution
        aggressive_games = sum(1 for r in game_forcing_ratios if r >= 0.5)
        balanced_games = sum(1 for r in game_forcing_ratios if 0.3 <= r < 0.5)
        quiet_games = sum(1 for r in game_forcing_ratios if r < 0.3)
        print(f"Aggressive games (>=50% forcing): {aggressive_games} ({aggressive_games/len(game_forcing_ratios)*100:.1f}%)")
        print(f"Balanced games (30-50% forcing): {balanced_games} ({balanced_games/len(game_forcing_ratios)*100:.1f}%)")
        print(f"Quiet games (<30% forcing): {quiet_games} ({quiet_games/len(game_forcing_ratios)*100:.1f}%)")
    
    # Sample individual game scores
    print(f"\n{'-'*70}")
    print("SAMPLE INDIVIDUAL GAME SCORES (first 5 games)")
    print(f"{'-'*70}")
    
    for i, analysis in enumerate(analyses[:5]):
        moves_data = analysis.get('moves_analysis', [])
        if not moves_data:
            continue
        
        moves = []
        for move in moves_data:
            if isinstance(move, dict):
                moves.append({
                    'move_san': move.get('move_san', ''),
                    'ply_index': move.get('ply_index', 0),
                    'centipawn_loss': move.get('centipawn_loss', 0.0),
                    'is_best': move.get('is_best', False),
                    'is_blunder': move.get('is_blunder', False),
                    'is_mistake': move.get('is_mistake', False),
                    'is_inaccuracy': move.get('is_inaccuracy', False),
                })
        
        time_score = analysis.get('time_management_score', 0.0)
        scores = scorer.calculate_scores(moves, time_score, 'intermediate')
        
        print(f"\nGame {i+1} (Time: {time_score:.0f}):")
        print(f"  Tactical: {scores.tactical:.0f}, Positional: {scores.positional:.0f}")
        print(f"  Aggressive: {scores.aggressive:.0f}, Patient: {scores.patient:.0f}")
        print(f"  Novelty: {scores.novelty:.0f}, Staleness: {scores.staleness:.0f}")

if __name__ == '__main__':
    # Analyze both players
    analyze_player('krecetas', 'lichess')
    analyze_player('skudurrrr', 'chess.com')
    
    print(f"\n{'='*70}")
    print("DIAGNOSIS COMPLETE")
    print(f"{'='*70}\n")

