#!/usr/bin/env python3
"""
Test script to validate personality radar improvements with real player data.
Compares Krecetas (slow, repetitive) vs Skudurelis (fast, aggressive, varied).
"""

import sys
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
PYTHON_DIR = PROJECT_ROOT / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

# Set environment to load .env
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client
from core.personality_scoring import PersonalityScorer


def get_supabase_client():
    """Get Supabase client"""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')
    
    if not url or not key:
        raise ValueError("Missing Supabase credentials in environment")
    
    return create_client(url, key)


def fetch_player_games(supabase, user_id, platform, limit=50):
    """Fetch games and their analyses for a player"""
    print(f"\n{'='*60}")
    print(f"Fetching data for {user_id} ({platform})")
    print(f"{'='*60}")
    
    # Get games with their analyses
    response = supabase.table('games') \
        .select('id, user_id, platform, played_at, time_control, opening, opening_family') \
        .eq('user_id', user_id) \
        .eq('platform', platform) \
        .order('played_at', desc=True) \
        .limit(limit) \
        .execute()
    
    games = response.data
    print(f"Found {len(games)} games")
    
    if not games:
        return [], []
    
    # Get analyses for these games
    game_ids = [g['id'] for g in games]
    analyses_response = supabase.table('game_analyses') \
        .select('game_id, total_moves, time_management_score, tactical_score, positional_score, aggressive_score, patient_score, novelty_score, staleness_score') \
        .in_('game_id', game_ids) \
        .execute()
    
    analyses = analyses_response.data
    print(f"Found {len(analyses)} analyses")
    
    # Get move analyses
    moves_response = supabase.table('move_analyses') \
        .select('game_id, move_san, ply_index, centipawn_loss, is_best, is_blunder, is_mistake, is_inaccuracy, opening_ply') \
        .in_('game_id', game_ids) \
        .order('game_id', desc=False) \
        .order('ply_index', desc=False) \
        .execute()
    
    moves_by_game = {}
    for move in moves_response.data:
        game_id = move['game_id']
        if game_id not in moves_by_game:
            moves_by_game[game_id] = []
        moves_by_game[game_id].append(move)
    
    print(f"Found moves for {len(moves_by_game)} games")
    
    return games, analyses, moves_by_game


def calculate_new_personality_scores(games, moves_by_game):
    """Calculate personality scores using the NEW improved formulas"""
    print("\n" + "="*60)
    print("CALCULATING NEW PERSONALITY SCORES")
    print("="*60)
    
    scorer = PersonalityScorer()
    
    # Calculate per-game scores
    game_scores = []
    weights = []
    
    for game in games:
        game_id = game['id']
        moves = moves_by_game.get(game_id, [])
        
        if not moves:
            continue
        
        # Filter to user moves only (every other move)
        user_moves = [m for i, m in enumerate(moves) if i % 2 == 0]
        
        if len(user_moves) < 5:
            continue
        
        # Calculate scores
        time_score = 75.0  # Placeholder, actual time management would be calculated
        scores = scorer.calculate_scores(user_moves, time_score, 'intermediate')
        
        game_scores.append(scores)
        weights.append(float(len(user_moves)))
    
    if not game_scores:
        print("No games with sufficient moves found!")
        return None
    
    print(f"Calculated scores for {len(game_scores)} games")
    
    # Aggregate scores
    aggregated = scorer.aggregate_scores(game_scores, weights)
    
    # Apply game-level adjustments for novelty/staleness
    if games:
        from core.unified_api_server import _estimate_novelty_from_games, _estimate_staleness_from_games
        
        novelty_signal = _estimate_novelty_from_games(games)
        staleness_signal = _estimate_staleness_from_games(games)
        
        # Get opening stats
        opening_families = [g.get('opening_family', 'Unknown') for g in games]
        unique_openings = len(set(opening_families))
        total_games = len(games)
        
        print(f"\nOpening Repertoire Analysis:")
        print(f"  Total games: {total_games}")
        print(f"  Unique opening families: {unique_openings}")
        print(f"  Variety ratio: {unique_openings/total_games:.2f}")
        print(f"  Game-level novelty signal: {novelty_signal:.1f}")
        print(f"  Game-level staleness signal: {staleness_signal:.1f}")
        
        # Apply 70% game-level weight (NEW formula)
        move_novelty = aggregated.novelty
        move_staleness = aggregated.staleness
        
        final_novelty = round(move_novelty * 0.3 + novelty_signal * 0.7, 1)
        final_staleness = round(move_staleness * 0.3 + staleness_signal * 0.7, 1)
        
        aggregated.novelty = final_novelty
        aggregated.staleness = final_staleness
        
        print(f"\nNovelty: move-level={move_novelty:.1f}, game-level={novelty_signal:.1f}, final={final_novelty:.1f}")
        print(f"Staleness: move-level={move_staleness:.1f}, game-level={staleness_signal:.1f}, final={final_staleness:.1f}")
    
    return aggregated


def get_old_scores(analyses):
    """Get the OLD scores that were stored in the database"""
    if not analyses:
        return None
    
    # Average the stored scores
    total = len(analyses)
    
    old_scores = {
        'tactical': sum(a.get('tactical_score', 50) for a in analyses) / total,
        'positional': sum(a.get('positional_score', 50) for a in analyses) / total,
        'aggressive': sum(a.get('aggressive_score', 50) for a in analyses) / total,
        'patient': sum(a.get('patient_score', 50) for a in analyses) / total,
        'novelty': sum(a.get('novelty_score', 50) for a in analyses) / total,
        'staleness': sum(a.get('staleness_score', 50) for a in analyses) / total,
    }
    
    return old_scores


def print_comparison(player_name, old_scores, new_scores):
    """Print before/after comparison"""
    print("\n" + "="*60)
    print(f"PERSONALITY COMPARISON: {player_name}")
    print("="*60)
    
    traits = ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']
    
    print(f"\n{'Trait':<15} {'OLD Score':<12} {'NEW Score':<12} {'Change':<10}")
    print("-" * 60)
    
    for trait in traits:
        old = old_scores.get(trait, 50) if old_scores else 50
        new = getattr(new_scores, trait) if new_scores else 50
        change = new - old
        change_str = f"{change:+.1f}"
        
        # Highlight significant changes
        marker = ""
        if abs(change) > 15:
            marker = " 🔥"
        elif abs(change) > 8:
            marker = " ⚡"
        
        print(f"{trait.capitalize():<15} {old:<12.1f} {new:<12.1f} {change_str:<10}{marker}")


def analyze_player_style(player_name, new_scores):
    """Analyze what the scores say about playing style"""
    print(f"\n{'='*60}")
    print(f"STYLE ANALYSIS: {player_name}")
    print(f"{'='*60}")
    
    if not new_scores:
        print("No scores available")
        return
    
    # Aggressive vs Patient
    if new_scores.aggressive > 70:
        print("✓ Aggressive player - loves forcing moves, attacks, and pressure")
    elif new_scores.aggressive < 50:
        print("• Calm player - avoids forcing sequences")
    
    if new_scores.patient > 70:
        print("✓ Patient player - takes time, plays disciplined chess")
    elif new_scores.patient < 50:
        print("• Fast player - quick decisions, less deliberation")
    
    # Novelty vs Staleness
    if new_scores.novelty > 70:
        print("✓ Novel player - explores varied openings and ideas")
    elif new_scores.novelty < 50:
        print("• Traditional player - sticks to familiar territory")
    
    if new_scores.staleness > 70:
        print("✓ Consistent player - repeats successful openings")
    elif new_scores.staleness < 50:
        print("• Versatile player - varies repertoire frequently")
    
    # Tactical vs Positional
    if new_scores.tactical > 70 and new_scores.positional > 70:
        print("✓ Well-rounded player - strong in both tactics and positional play")
    elif new_scores.tactical > new_scores.positional + 10:
        print("✓ Tactical player - excels in calculations and combinations")
    elif new_scores.positional > new_scores.tactical + 10:
        print("✓ Positional player - masters structures and long-term plans")


def main():
    print("\n" + "="*60)
    print("PERSONALITY RADAR IMPROVEMENTS TEST")
    print("Testing with real player data: Krecetas vs Skudurelis")
    print("="*60)
    
    try:
        supabase = get_supabase_client()
        
        # Test both players
        players = [
            ('krecetas', 'lichess'),
            ('skudurrrr', 'chess.com'),
        ]
        
        results = {}
        
        for user_id, platform in players:
            print(f"\n{'#'*60}")
            print(f"# ANALYZING: {user_id}")
            print(f"{'#'*60}")
            
            # Fetch data
            games, analyses, moves_by_game = fetch_player_games(supabase, user_id, platform, limit=100)
            
            if not games:
                print(f"No games found for {user_id}")
                continue
            
            # Get old scores
            old_scores = get_old_scores(analyses)
            
            # Calculate new scores
            new_scores = calculate_new_personality_scores(games, moves_by_game)
            
            # Store results
            results[user_id] = {
                'old': old_scores,
                'new': new_scores,
                'games': games
            }
            
            # Print comparison
            print_comparison(user_id, old_scores, new_scores)
            analyze_player_style(user_id, new_scores)
        
        # Final comparison
        print("\n" + "="*60)
        print("FINAL COMPARISON: KRECETAS vs SKUDURELIS")
        print("="*60)
        
        if 'krecetas' in results and 'skudurrrr' in results:
            krecetas = results['krecetas']['new']
            skudurelis = results['skudurrrr']['new']
            
            if krecetas and skudurelis:
                print("\n" + "Expected Differences:")
                print("-" * 60)
                print("Krecetas should be: MORE patient, LESS novelty, MORE staleness")
                print("Skudurelis should be: LESS patient, MORE novelty, LESS staleness, MORE aggressive")
                print()
                
                print("Actual Results:")
                print("-" * 60)
                print(f"Patient:     Krecetas={krecetas.patient:.1f}  vs  Skudurelis={skudurelis.patient:.1f}")
                print(f"             {'✓ Krecetas MORE patient!' if krecetas.patient > skudurelis.patient + 15 else '✗ Not enough difference'}")
                
                print(f"\nNovelty:     Krecetas={krecetas.novelty:.1f}  vs  Skudurelis={skudurelis.novelty:.1f}")
                print(f"             {'✓ Skudurelis MORE novel!' if skudurelis.novelty > krecetas.novelty + 15 else '✗ Not enough difference'}")
                
                print(f"\nStaleness:   Krecetas={krecetas.staleness:.1f}  vs  Skudurelis={skudurelis.staleness:.1f}")
                print(f"             {'✓ Krecetas MORE stale!' if krecetas.staleness > skudurelis.staleness + 15 else '✗ Not enough difference'}")
                
                print(f"\nAggressive:  Krecetas={krecetas.aggressive:.1f}  vs  Skudurelis={skudurelis.aggressive:.1f}")
                print(f"             {'✓ Skudurelis MORE aggressive!' if skudurelis.aggressive > krecetas.aggressive + 10 else '✗ Not enough difference'}")
        
        print("\n" + "="*60)
        print("TEST COMPLETE")
        print("="*60)
        
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()

