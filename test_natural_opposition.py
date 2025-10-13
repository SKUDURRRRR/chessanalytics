#!/usr/bin/env python3
"""Test natural opposition without forced summing"""
import math

def calc_novelty_game(total, unique, most_common_count):
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 20.0
    diversity_bonus = diversity_score * 0.5
    repetition_penalty = repetition_ratio * 60.0
    
    return max(0.0, min(100.0, base + diversity_bonus - repetition_penalty))

def calc_staleness_game(total, unique, most_common_count):
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 45.0
    repetition_bonus = repetition_ratio * 120.0
    diversity_penalty = diversity_score * 0.35
    
    return max(0.0, min(100.0, base + repetition_bonus - diversity_penalty))

print("="*70)
print("NATURAL OPPOSITION TEST (NO FORCED SUMMING)")
print("="*70)

# Test different player types
test_cases = [
    ("Krecetas (balanced)", 1000, 29, 234, 70, 20),
    ("Skudurelis (slightly stale)", 1000, 27, 257, 60, 30),
    ("Very Novel Player", 1000, 50, 100, 80, 10),
    ("Very Stale Player", 1000, 10, 500, 30, 70),
]

for name, total, unique, most_common, move_nov, move_stal in test_cases:
    game_nov = calc_novelty_game(total, unique, most_common)
    game_stal = calc_staleness_game(total, unique, most_common)
    
    # 70/30 weighting
    final_nov = move_nov * 0.3 + game_nov * 0.7
    final_stal = move_stal * 0.3 + game_stal * 0.7
    
    print(f"\n{name}:")
    print(f"  Openings: {unique} unique, {most_common/total*100:.1f}% most common")
    print(f"  Game-level: Nov {game_nov:.1f}, Stal {game_stal:.1f}")
    print(f"  Move-level: Nov {move_nov:.1f}, Stal {move_stal:.1f}")
    print(f"  🎯 Final: Novelty {final_nov:.1f}, Staleness {final_stal:.1f}")
    print(f"     Sum: {final_nov + final_stal:.1f} (doesn't need to be 100!)")
    print(f"     Opposition: {'✅' if final_nov > final_stal else '⚖️ balanced' if abs(final_nov - final_stal) < 10 else '✅'}")

print(f"\n{'='*70}")
print("KEY INSIGHT:")
print("="*70)
print("Natural opposition means:")
print("  ✅ Diverse openings → Higher Novelty, Lower Staleness")
print("  ✅ Repetitive openings → Lower Novelty, Higher Staleness")
print("  ❌ NOT that they must sum to 100!")
print("\nScores should reflect player style independently.")

