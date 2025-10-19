#!/usr/bin/env python3
"""Test balanced weighting for Novelty vs Staleness"""
import math

def calc_novelty_game(total, unique, most_common_count):
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 25.0
    diversity_bonus = diversity_score * 0.6
    repetition_penalty = repetition_ratio * 80.0
    
    return max(0.0, min(100.0, base + diversity_bonus - repetition_penalty))

def calc_staleness_game(total, unique, most_common_count):
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 35.0
    repetition_bonus = repetition_ratio * 150.0
    diversity_penalty = diversity_score * 0.25
    
    return max(0.0, min(100.0, base + repetition_bonus - diversity_penalty))

print("="*70)
print("BALANCED WEIGHTING TEST")
print("="*70)

# Test data
players = {
    'KRECETAS': {
        'total': 1000,
        'unique': 29,
        'most_common': 234,
        'move_novelty': 70,  # High in-game creativity
        'move_staleness': 20,
    },
    'SKUDURELIS': {
        'total': 1000,
        'unique': 27,
        'most_common': 257,
        'move_novelty': 50,  # Moderate creativity
        'move_staleness': 30,
    }
}

for name, data in players.items():
    game_novelty = calc_novelty_game(data['total'], data['unique'], data['most_common'])
    game_staleness = calc_staleness_game(data['total'], data['unique'], data['most_common'])
    
    move_novelty = data['move_novelty']
    move_staleness = data['move_staleness']
    
    # New weighting: Novelty 40/60, Staleness 20/80
    final_novelty = move_novelty * 0.4 + game_novelty * 0.6
    final_staleness = move_staleness * 0.2 + game_staleness * 0.8
    
    print(f"\n{'='*70}")
    print(f"{name}")
    print(f"{'='*70}")
    print(f"\nOpenings:")
    print(f"  {data['unique']} unique, most common {data['most_common']/data['total']*100:.1f}%")
    
    print(f"\nGame-level (opening repertoire):")
    print(f"  Novelty: {game_novelty:.1f}")
    print(f"  Staleness: {game_staleness:.1f}")
    
    print(f"\nMove-level (in-game creativity):")
    print(f"  Novelty: {move_novelty:.1f}")
    print(f"  Staleness: {move_staleness:.1f}")
    
    print(f"\n🎯 FINAL SCORES:")
    print(f"  Novelty:   {move_novelty:.1f} × 0.4 + {game_novelty:.1f} × 0.6 = {final_novelty:.1f}")
    print(f"  Staleness: {move_staleness:.1f} × 0.2 + {game_staleness:.1f} × 0.8 = {final_staleness:.1f}")
    print(f"\n  Sum: {final_novelty + final_staleness:.1f}")
    print(f"  Diff: {abs(final_novelty - final_staleness):.1f}")

k_nov = calc_novelty_game(1000, 29, 234)
k_move_nov = 70
k_final = k_move_nov * 0.4 + k_nov * 0.6

s_nov = calc_novelty_game(1000, 27, 257)
s_move_nov = 50
s_final = s_move_nov * 0.4 + s_nov * 0.6

print(f"\n{'='*70}")
print("COMPARISON")
print("="*70)
print(f"\nIf Krecetas has high in-game creativity (move-novelty 70):")
print(f"  Final Novelty: {k_final:.1f}")
print(f"\nIf Skudurelis has moderate creativity (move-novelty 50):")
print(f"  Final Novelty: {s_final:.1f}")
print(f"\nDifference: {abs(k_final - s_final):.1f} points")
print(f"\n✅ In-game creativity now matters! (40% weight for Novelty)")
print(f"✅ Opening repetition dominates Staleness (80% weight)")

