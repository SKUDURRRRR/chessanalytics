#!/usr/bin/env python3
"""Test FINAL Novelty/Staleness formula"""
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
print("FINAL FORMULA TEST (Game-level only, 70% weight)")
print("="*70)

# Actual data
krecetas = (1000, 79, 159)  # 15.9% most common (C44)
skudurelis = (1000, 59, 257)  # 25.7% most common (Caro-Kann!)

for name, data in [('KRECETAS', krecetas), ('SKUDURELIS', skudurelis)]:
    total, unique, most_common = data
    repetition_pct = most_common / total * 100
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    novelty = calc_novelty(*data)
    staleness = calc_staleness(*data)
    
    print(f"\n{name}:")
    print(f"  {unique} unique openings, most common: {repetition_pct:.1f}%")
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
    print(f"\n  ✅ GOOD DIFFERENTIATION!")
    print(f"  Skudurelis is {s_stal - k_stal:.1f} points MORE stale (plays Caro-Kann 25.7%!)")
else:
    print(f"\n  ❌ Still needs more differentiation")

print(f"\n{'='*70}")
print("NOTE: These are game-level scores (70% weight)")
print("Move-level scores (30%) will be added by backend")
print("Final scores will be different!")
print("="*70)

