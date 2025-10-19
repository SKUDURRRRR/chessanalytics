#!/usr/bin/env python3
"""Test recalibrated staleness formula"""
import math

def calc_staleness_new(total, unique, most_common_count):
    """New staleness formula"""
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 35.0
    repetition_bonus = repetition_ratio * 150.0
    diversity_penalty = diversity_score * 0.25
    
    return max(0.0, min(100.0, base + repetition_bonus - diversity_penalty))

def calc_novelty_adjusted(total, unique, most_common_count):
    """Adjusted novelty to maintain natural opposition"""
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 25.0  # Adjusted down to maintain opposition
    diversity_bonus = diversity_score * 0.6
    repetition_penalty = repetition_ratio * 80.0  # Increased to maintain opposition
    
    return max(0.0, min(100.0, base + diversity_bonus - repetition_penalty))

print("="*70)
print("RECALIBRATED STALENESS FORMULA TEST")
print("="*70)

# Test data
players = {
    'KRECETAS': (1000, 29, 234),  # King's Pawn 23.4%
    'SKUDURELIS': (1000, 27, 257),  # Caro-Kann 25.7%
}

for name, data in players.items():
    total, unique, most_common = data
    repetition_pct = most_common / total * 100
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    staleness_game = calc_staleness_new(*data)
    novelty_game = calc_novelty_adjusted(*data)
    
    print(f"\n{name}:")
    print(f"  {unique} unique, most common: {repetition_pct:.1f}%")
    print(f"  Diversity score: {diversity_score:.1f}")
    print(f"\n  Game-level (90% weight):")
    print(f"    Novelty: {novelty_game:.1f}")
    print(f"    Staleness: {staleness_game:.1f}")
    print(f"    Sum: {novelty_game + staleness_game:.1f}")
    print(f"    Diff: {abs(novelty_game - staleness_game):.1f}")
    
    # Assume low move-level (~10 for both)
    move_novelty = 10
    move_staleness = 10
    
    final_novelty = move_novelty * 0.1 + novelty_game * 0.9
    final_staleness = move_staleness * 0.1 + staleness_game * 0.9
    
    print(f"\n  Final scores (with move-level ~10):")
    print(f"    Novelty: {final_novelty:.1f}")
    print(f"    Staleness: {final_staleness:.1f}")

k_stal = calc_staleness_new(*players['KRECETAS'])
s_stal = calc_staleness_new(*players['SKUDURELIS'])

print(f"\n{'='*70}")
print(f"COMPARISON:")
print(f"  Staleness: Krecetas {k_stal:.1f} vs Skudurelis {s_stal:.1f}")
print(f"  Difference: {abs(k_stal - s_stal):.1f} points")
print(f"\n  Skudurelis is {s_stal - k_stal:.1f} points MORE stale")
print(f"  (plays Caro-Kann 25.7% vs King's Pawn 23.4%)")

if s_stal >= 55 and k_stal >= 50:
    print(f"\n  ✅ Good staleness scores (both players ARE somewhat repetitive)")
else:
    print(f"\n  ⚠️  May need more adjustment")

