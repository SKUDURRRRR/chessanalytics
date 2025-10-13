#!/usr/bin/env python3
"""Test UPDATED Novelty/Staleness formula"""
import math

def calc_novelty(total, unique, most_common_count):
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 10.0
    diversity_bonus = diversity_score * 0.6
    repetition_penalty = repetition_ratio * 50.0
    
    return max(0.0, min(100.0, base + diversity_bonus - repetition_penalty))

def calc_staleness(total, unique, most_common_count):
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 10.0
    repetition_bonus = repetition_ratio * 100.0
    diversity_penalty = diversity_score * 0.6
    
    return max(0.0, min(100.0, base + repetition_bonus - diversity_penalty))

print("="*70)
print("UPDATED FORMULA TEST")
print("="*70)

# Test with actual data
krecetas_data = (1000, 79, 159)  # 15.9% repetition
skudurelis_data = (1000, 59, 257)  # 25.7% repetition

for name, data in [('KRECETAS', krecetas_data), ('SKUDURELIS', skudurelis_data)]:
    total, unique, most_common = data
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    novelty = calc_novelty(*data)
    staleness = calc_staleness(*data)
    
    print(f"\n{name}:")
    print(f"  Unique: {unique}, Most common: {most_common/total*100:.1f}%")
    print(f"  Diversity score: {diversity_score:.1f}")
    print(f"  → Novelty: {novelty:.1f}, Staleness: {staleness:.1f}")
    print(f"  Sum: {novelty + staleness:.1f}, Diff: {abs(novelty - staleness):.1f}")

k_nov = calc_novelty(*krecetas_data)
k_stal = calc_staleness(*krecetas_data)
s_nov = calc_novelty(*skudurelis_data)
s_stal = calc_staleness(*skudurelis_data)

print(f"\n{'='*70}")
print(f"DIFFERENTIATION:")
print(f"  Novelty: {abs(k_nov - s_nov):.1f} points apart")
print(f"  Staleness: {abs(k_stal - s_stal):.1f} points apart")
print(f"  {'✅ Good!' if abs(k_stal - s_stal) > 15 else '❌ Needs more'}")

