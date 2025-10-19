#!/usr/bin/env python3
"""Test formulas against target ranges"""
import math

def calc_novelty_game(total, unique, most_common_count):
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 45.0
    diversity_bonus = diversity_score * 0.7
    repetition_penalty = repetition_ratio * 40.0
    
    return max(0.0, min(100.0, base + diversity_bonus - repetition_penalty))

def calc_staleness_game(total, unique, most_common_count):
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 45.0
    repetition_bonus = repetition_ratio * 100.0
    diversity_penalty = diversity_score * 0.3
    
    return max(0.0, min(100.0, base + repetition_bonus - diversity_penalty))

print("="*70)
print("TARGET RANGE TEST")
print("="*70)

test_cases = [
    ("Balanced (Krecetas)", 1000, 29, 234, 65, 45, "50-60", "50-60"),
    ("Balanced (Skudurelis)", 1000, 27, 257, 60, 50, "50-60", "50-60"),
    ("Very Novel", 1000, 60, 80, 90, 20, "80-95", "30-40"),
    ("Very Stale", 1000, 8, 600, 30, 80, "30-40", "80-95"),
]

for name, total, unique, most_common, move_nov, move_stal, target_nov, target_stal in test_cases:
    game_nov = calc_novelty_game(total, unique, most_common)
    game_stal = calc_staleness_game(total, unique, most_common)
    
    # 70/30 weighting
    final_nov = move_nov * 0.3 + game_nov * 0.7
    final_stal = move_stal * 0.3 + game_stal * 0.7
    
    diversity_pct = unique
    repetition_pct = most_common / total * 100
    
    print(f"\n{name}:")
    print(f"  Openings: {unique} unique, {repetition_pct:.1f}% most common")
    print(f"  Game-level: Nov {game_nov:.1f}, Stal {game_stal:.1f}")
    print(f"  Move-level: Nov {move_nov:.1f}, Stal {move_stal:.1f}")
    print(f"  🎯 Final: Novelty {final_nov:.1f} (target {target_nov}), Staleness {final_stal:.1f} (target {target_stal})")
    print(f"     Sum: {final_nov + final_stal:.1f}")
    
    # Check if in range
    nov_min, nov_max = map(int, target_nov.split('-'))
    stal_min, stal_max = map(int, target_stal.split('-'))
    
    nov_ok = nov_min <= final_nov <= nov_max
    stal_ok = stal_min <= final_stal <= stal_max
    
    print(f"     {'✅' if nov_ok and stal_ok else '❌'} {'In range!' if nov_ok and stal_ok else 'Out of range'}")

print(f"\n{'='*70}")
print("TARGET SUMMARY:")
print("="*70)
print("Balanced: Nov 50-60, Stal 50-60 (sum ~100-120)")
print("Very Novel: Nov 80-95, Stal 30-40 (sum ~110-134)")  
print("Very Stale: Nov 30-40, Stal 80-95 (sum ~110-135)")

