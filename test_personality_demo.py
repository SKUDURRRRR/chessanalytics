#!/usr/bin/env python3
"""
Demonstration of personality radar improvements with synthetic player data.
Shows how the improved formulas differentiate between distinct playing styles.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
PYTHON_DIR = PROJECT_ROOT / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from core.personality_scoring import PersonalityScorer


def create_krecetas_style_moves():
    """Create moves representing Krecetas' style:
    - Slow, thoughtful (high time management)
    - Repetitive openings (same moves)
    - Conservative, quiet moves
    """
    moves = []
    
    # Opening: Repetitive, same pattern (e4, d4, Nf3, etc)
    opening_moves = ['e4', 'd4', 'Nf3', 'Nc3', 'Be2', 'O-O', 'Re1', 'Bf1', 'Qd2', 'Rad1']
    
    # Create 40 moves with conservative, quiet style
    for i in range(40):
        ply = i * 2 + 1
        
        if i < len(opening_moves):
            san = opening_moves[i]
        else:
            # Middlegame: lots of quiet moves
            san = f'Nf{(i % 6) + 1}'  # Quiet knight moves
        
        # Low centipawn loss (careful play)
        cpl = 8.0 + (i % 3) * 3.0
        
        moves.append({
            'move_san': san,
            'ply_index': ply,
            'centipawn_loss': cpl,
            'is_best': cpl <= 15.0,
            'is_blunder': False,
            'is_mistake': False,
            'is_inaccuracy': cpl > 15.0 and cpl <= 25.0,
        })
    
    return moves


def create_skudurelis_style_moves():
    """Create moves representing Skudurelis' style:
    - Fast, aggressive (low time management)
    - Varied openings
    - Lots of forcing moves (checks, captures)
    """
    moves = []
    
    # Opening: Varied, novel moves
    opening_moves = ['e4', 'Nf3', 'Bc4', 'd3', 'c3', 'Qe2', 'Be3', 'Nbd2']
    
    # Create 40 moves with aggressive style
    for i in range(40):
        ply = i * 2 + 1
        
        if i < len(opening_moves):
            san = opening_moves[i]
        else:
            # Middlegame: lots of forcing moves
            if i % 3 == 0:
                san = f'Bxf{(i % 6) + 1}+'  # Checks and captures
            elif i % 3 == 1:
                san = f'Qh{(i % 6) + 3}+'  # Queen checks
            else:
                san = f'Nxd{(i % 6) + 1}'  # Knight captures
        
        # Slightly higher centipawn loss (aggressive play, takes risks)
        cpl = 12.0 + (i % 4) * 5.0
        
        moves.append({
            'move_san': san,
            'ply_index': ply,
            'centipawn_loss': cpl,
            'is_best': cpl <= 15.0,
            'is_blunder': cpl > 150.0,
            'is_mistake': cpl > 50.0 and cpl <= 150.0,
            'is_inaccuracy': cpl > 15.0 and cpl <= 50.0,
        })
    
    return moves


def create_krecetas_games():
    """Simulate Krecetas' game collection with repetitive openings"""
    games = []
    
    # Plays mostly Scandinavian Defense (repetitive)
    openings = [
        'Scandinavian Defense',
        'Scandinavian Defense',
        'Scandinavian Defense',
        'Scandinavian Defense',
        'Scandinavian Defense',
        'Scandinavian Defense',
        'Scandinavian Defense',
        'Scandinavian Defense',
        'French Defense',  # Occasionally varies
        'Scandinavian Defense',
    ] * 5  # 50 games total
    
    for i, opening in enumerate(openings[:50]):
        games.append({
            'id': f'krecetas_game_{i}',
            'opening_family': opening,
            'opening': opening,
            'time_control': '600+0',  # Mostly same time control
        })
    
    return games


def create_skudurelis_games():
    """Simulate Skudurelis' game collection with varied openings"""
    games = []
    
    # Plays many different openings (varied)
    openings = [
        'Sicilian Defense', 'King\'s Indian Defense', 'French Defense',
        'Caro-Kann Defense', 'Pirc Defense', 'Alekhine Defense',
        'Scandinavian Defense', 'Modern Defense', 'Nimzo-Indian Defense',
        'Queen\'s Gambit Declined', 'Slav Defense', 'Benoni Defense',
        'Dutch Defense', 'English Opening', 'Reti Opening',
        'Italian Game', 'Spanish Opening', 'Scotch Game',
        'Vienna Game', 'King\'s Gambit',
    ]
    
    for i in range(50):
        games.append({
            'id': f'skudurelis_game_{i}',
            'opening_family': openings[i % len(openings)],
            'opening': openings[i % len(openings)],
            'time_control': ['180+0', '300+0', '600+0'][i % 3],  # Varies time controls
        })
    
    return games


def calculate_scores(moves, games, time_management_score, player_name):
    """Calculate personality scores"""
    print(f"\n{'='*70}")
    print(f"ANALYZING: {player_name}")
    print(f"{'='*70}")
    
    scorer = PersonalityScorer()
    
    # Calculate move-level scores
    scores = scorer.calculate_scores(moves, time_management_score, 'intermediate')
    
    print(f"\nMove-level Analysis:")
    print(f"  Total moves: {len(moves)}")
    print(f"  Forcing moves: {sum(1 for m in moves if 'x' in m['move_san'] or '+' in m['move_san'])}")
    print(f"  Quiet moves: {sum(1 for m in moves if 'x' not in m['move_san'] and '+' not in m['move_san'])}")
    print(f"  Time management: {time_management_score:.1f}")
    
    # Apply game-level adjustments
    from core.unified_api_server import _estimate_novelty_from_games, _estimate_staleness_from_games
    
    novelty_signal = _estimate_novelty_from_games(games)
    staleness_signal = _estimate_staleness_from_games(games)
    
    opening_families = [g.get('opening_family', 'Unknown') for g in games]
    unique_openings = len(set(opening_families))
    
    print(f"\nGame-level Analysis:")
    print(f"  Total games: {len(games)}")
    print(f"  Unique opening families: {unique_openings}")
    print(f"  Variety ratio: {unique_openings/len(games):.2f}")
    print(f"  Game-level novelty: {novelty_signal:.1f}")
    print(f"  Game-level staleness: {staleness_signal:.1f}")
    
    # Apply 70% game-level weight (NEW formula)
    move_novelty = scores.novelty
    move_staleness = scores.staleness
    
    final_novelty = round(move_novelty * 0.3 + novelty_signal * 0.7, 1)
    final_staleness = round(move_staleness * 0.3 + staleness_signal * 0.7, 1)
    
    scores.novelty = final_novelty
    scores.staleness = final_staleness
    
    print(f"\nFinal Personality Scores:")
    print(f"  Tactical:    {scores.tactical:.1f}")
    print(f"  Positional:  {scores.positional:.1f}")
    print(f"  Aggressive:  {scores.aggressive:.1f}")
    print(f"  Patient:     {scores.patient:.1f}")
    print(f"  Novelty:     {scores.novelty:.1f} (move={move_novelty:.1f} + game={novelty_signal:.1f})")
    print(f"  Staleness:   {scores.staleness:.1f} (move={move_staleness:.1f} + game={staleness_signal:.1f})")
    
    return scores


def print_comparison(krecetas_scores, skudurelis_scores):
    """Print side-by-side comparison"""
    print(f"\n{'='*70}")
    print("SIDE-BY-SIDE COMPARISON")
    print(f"{'='*70}")
    
    print(f"\n{'Trait':<15} {'Krecetas':<15} {'Skudurelis':<15} {'Difference':<15}")
    print("-" * 70)
    
    traits = [
        ('tactical', 'Tactical'),
        ('positional', 'Positional'),
        ('aggressive', 'Aggressive'),
        ('patient', 'Patient'),
        ('novelty', 'Novelty'),
        ('staleness', 'Staleness'),
    ]
    
    for attr, label in traits:
        k_score = getattr(krecetas_scores, attr)
        s_score = getattr(skudurelis_scores, attr)
        diff = s_score - k_score
        
        # Determine winner
        if attr in ['aggressive', 'novelty']:
            winner = "Skudurelis ✓" if diff > 5 else ("Same ~" if abs(diff) <= 5 else "Krecetas ✓")
        elif attr in ['patient', 'staleness']:
            winner = "Krecetas ✓" if diff < -5 else ("Same ~" if abs(diff) <= 5 else "Skudurelis ✓")
        else:
            winner = f"{diff:+.1f}"
        
        print(f"{label:<15} {k_score:<15.1f} {s_score:<15.1f} {winner:<15}")


def main():
    print("="*70)
    print("PERSONALITY RADAR IMPROVEMENTS - DEMONSTRATION")
    print("="*70)
    print("\nThis demo shows how the improved formulas differentiate between:")
    print("  • Krecetas: Slow, repetitive, conservative player")
    print("  • Skudurelis: Fast, aggressive, varied player")
    
    # Create player data
    krecetas_moves = create_krecetas_style_moves()
    krecetas_games = create_krecetas_games()
    
    skudurelis_moves = create_skudurelis_style_moves()
    skudurelis_games = create_skudurelis_games()
    
    # Calculate scores
    # Krecetas: High time management (slow, thoughtful)
    krecetas_scores = calculate_scores(krecetas_moves, krecetas_games, 85.0, "KRECETAS")
    
    # Skudurelis: Low time management (fast, quick decisions)
    skudurelis_scores = calculate_scores(skudurelis_moves, skudurelis_games, 45.0, "SKUDURELIS")
    
    # Print comparison
    print_comparison(krecetas_scores, skudurelis_scores)
    
    # Validate expectations
    print(f"\n{'='*70}")
    print("VALIDATION CHECKS")
    print(f"{'='*70}")
    
    checks = [
        ("Krecetas MORE patient than Skudurelis", 
         krecetas_scores.patient > skudurelis_scores.patient + 15,
         f"Krecetas={krecetas_scores.patient:.1f}, Skudurelis={skudurelis_scores.patient:.1f}"),
        
        ("Skudurelis MORE aggressive than Krecetas",
         skudurelis_scores.aggressive > krecetas_scores.aggressive + 10,
         f"Skudurelis={skudurelis_scores.aggressive:.1f}, Krecetas={krecetas_scores.aggressive:.1f}"),
        
        ("Krecetas MORE stale than Skudurelis",
         krecetas_scores.staleness > skudurelis_scores.staleness + 20,
         f"Krecetas={krecetas_scores.staleness:.1f}, Skudurelis={skudurelis_scores.staleness:.1f}"),
        
        ("Skudurelis MORE novel than Krecetas",
         skudurelis_scores.novelty > krecetas_scores.novelty + 20,
         f"Skudurelis={skudurelis_scores.novelty:.1f}, Krecetas={krecetas_scores.novelty:.1f}"),
        
        ("Aggressive and Patient are opposed",
         (krecetas_scores.aggressive + krecetas_scores.patient) < 130,
         f"Sum={krecetas_scores.aggressive + krecetas_scores.patient:.1f}"),
        
        ("Novelty and Staleness are opposed",
         (skudurelis_scores.novelty + skudurelis_scores.staleness) < 130,
         f"Sum={skudurelis_scores.novelty + skudurelis_scores.staleness:.1f}"),
    ]
    
    passed = 0
    for check_name, result, details in checks:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"\n{status}: {check_name}")
        print(f"  {details}")
        if result:
            passed += 1
    
    print(f"\n{'='*70}")
    print(f"RESULTS: {passed}/{len(checks)} checks passed")
    print(f"{'='*70}")
    
    if passed == len(checks):
        print("\n🎉 SUCCESS! All validation checks passed!")
        print("The improved formulas correctly differentiate playing styles.")
    else:
        print("\n⚠️  Some checks failed. Formulas may need further tuning.")


if __name__ == '__main__':
    main()

