#!/usr/bin/env python3
"""Test formula with opening_normalized data"""
import math

def calc_novelty(total, unique, most_common_count):
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 30.0
    diversity_bonus = diversity_score * 0.5
    repetition_penalty = repetition_ratio * 60.0
    
    return max(0.0, min(100.0, base + diversity_bonus - repetition_penalty))

def calc_staleness(total, unique, most_common_count):
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 30.0
    repetition_bonus = repetition_ratio * 110.0
    diversity_penalty = diversity_score * 0.3
    
    return max(0.0, min(100.0, base + repetition_bonus - diversity_penalty))

print("="*70)
print("FORMULA TEST WITH OPENING_NORMALIZED")
print("="*70)

# Using opening_normalized data from check_actual_opening_variety.py output:
# Krecetas: 29 unique, most common "King's Pawn Game" 234/1000 (23.4%)
# Skudurelis: 27 unique, most common "Caro-Kann Defense" 257/1000 (25.7%)

krecetas = (1000, 29, 234)  # King's Pawn Game 23.4%
skudurelis = (1000, 27, 257)  # Caro-Kann 25.7%

for name, data in [('KRECETAS', krecetas), ('SKUDURELIS', skudurelis)]:
    total, unique, most_common = data
    repetition_pct = most_common / total * 100
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    novelty = calc_novelty(*data)
    staleness = calc_staleness(*data)
    
    print(f"\n{name}:")
    print(f"  {unique} unique openings (normalized), most common: {repetition_pct:.1f}%")
    print(f"  Diversity score: {diversity_score:.1f}")
    print(f"  🎯 Novelty: {novelty:.1f}")
    print(f"  🎯 Staleness: {staleness:.1f}")
    print(f"     Sum: {novelty + staleness:.1f}, Diff: {abs(novelty - staleness):.1f}")

k_nov = calc_novelty(*krecetas)
k_stal = calc_staleness(*krecetas)
s_nov = calc_novelty(*skudurelis)
s_stal = calc_staleness(*skudurelis)

print(f"\n{'='*70}")
print(f"COMPARISON:")
print(f"  Novelty:   Krecetas {k_nov:.1f} vs Skudurelis {s_nov:.1f} ({abs(k_nov - s_nov):.1f} apart)")
print(f"  Staleness: Krecetas {k_stal:.1f} vs Skudurelis {s_stal:.1f} ({abs(k_stal - s_stal):.1f} apart)")

if abs(k_stal - s_stal) > 10:
    print(f"\n  ✅ EXCELLENT DIFFERENTIATION!")
    print(f"  Both play similar openings frequently:")
    print(f"    Krecetas: King's Pawn Game 23.4%")
    print(f"    Skudurelis: Caro-Kann 25.7% (slightly more repetitive)")
else:
    print(f"\n  ❌ Needs more differentiation")

print(f"\n{'='*70}")
print("With opening_normalized:")
print("  - Better grouping (Italian Game vs C50/C53/C54)")
print("  - Fewer unique values (29 vs 79) - more meaningful")
print("  - Higher repetition percentages (more realistic)")
print("="*70)

