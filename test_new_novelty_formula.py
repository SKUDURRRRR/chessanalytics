#!/usr/bin/env python3
"""Test the new Novelty/Staleness formula with actual data"""
import math

# Actual data from database
players = {
    'KRECETAS': {
        'total_games': 1000,
        'unique_openings': 79,
        'most_common_count': 159,  # C44: 15.9%
        'most_common_pct': 15.9,
    },
    'SKUDURELIS': {
        'total_games': 1000,
        'unique_openings': 59,
        'most_common_count': 257,  # Caro-Kann: 25.7%
        'most_common_pct': 25.7,
    }
}

def calculate_novelty_new(total, unique_openings, most_common_count):
    """New novelty formula"""
    opening_repetition_ratio = most_common_count / total
    
    # Logarithmic scale for large datasets
    opening_diversity_score = min(100, (math.log(unique_openings + 1) / math.log(40)) * 100)
    
    base = 20.0
    diversity_bonus = opening_diversity_score * 0.5
    repetition_penalty = opening_repetition_ratio * 30.0
    
    score = base + diversity_bonus - repetition_penalty
    return max(0.0, min(100.0, score))

def calculate_staleness_new(total, unique_openings, most_common_count):
    """New staleness formula"""
    opening_repetition_ratio = most_common_count / total
    
    # Logarithmic scale for large datasets
    opening_diversity_score = min(100, (math.log(unique_openings + 1) / math.log(40)) * 100)
    
    base = 20.0
    repetition_bonus = opening_repetition_ratio * 60.0
    diversity_penalty = opening_diversity_score * 0.5
    
    score = base + repetition_bonus - diversity_penalty
    return max(0.0, min(100.0, score))

print("="*70)
print("NEW NOVELTY/STALENESS FORMULA TEST")
print("="*70)

for name, data in players.items():
    print(f"\n{'='*70}")
    print(f"{name}")
    print(f"{'='*70}")
    
    total = data['total_games']
    unique = data['unique_openings']
    most_common = data['most_common_count']
    
    print(f"\nData:")
    print(f"  Total games: {total}")
    print(f"  Unique openings: {unique}")
    print(f"  Most common: {most_common} ({data['most_common_pct']:.1f}%)")
    
    # Calculate metrics
    repetition_ratio = most_common / total
    diversity_score = min(100, (math.log(unique + 1) / math.log(40)) * 100)
    
    print(f"\nIntermediate values:")
    print(f"  Repetition ratio: {repetition_ratio:.3f}")
    print(f"  Diversity score: {diversity_score:.1f}")
    
    # Calculate scores
    novelty = calculate_novelty_new(total, unique, most_common)
    staleness = calculate_staleness_new(total, unique, most_common)
    
    print(f"\n🎯 CALCULATED SCORES:")
    print(f"  Novelty: {novelty:.1f}")
    print(f"  Staleness: {staleness:.1f}")
    
    # Natural opposition check
    print(f"\n  Sum: {novelty + staleness:.1f} (should be ~70-90 for natural opposition)")
    print(f"  Difference: {abs(novelty - staleness):.1f} points apart")

print(f"\n{'='*70}")
print("INTERPRETATION")
print("="*70)

krecetas_novelty = calculate_novelty_new(1000, 79, 159)
krecetas_staleness = calculate_staleness_new(1000, 79, 159)
skudurelis_novelty = calculate_novelty_new(1000, 59, 257)
skudurelis_staleness = calculate_staleness_new(1000, 59, 257)

print(f"\nKrecetas:")
print(f"  79 unique openings, most common 15.9%")
print(f"  → Diverse repertoire")
print(f"  Expected: Novelty {krecetas_novelty:.0f}, Staleness {krecetas_staleness:.0f}")

print(f"\nSkudurelis:")
print(f"  59 unique openings, Caro-Kann 25.7%")
print(f"  → Somewhat repetitive (relies on Caro-Kann)")
print(f"  Expected: Novelty {skudurelis_novelty:.0f}, Staleness {skudurelis_staleness:.0f}")

diff_novelty = abs(krecetas_novelty - skudurelis_novelty)
diff_staleness = abs(krecetas_staleness - skudurelis_staleness)

print(f"\nDifferentiation:")
print(f"  Novelty difference: {diff_novelty:.0f} points")
print(f"  Staleness difference: {diff_staleness:.0f} points")

if diff_novelty > 10 or diff_staleness > 10:
    print(f"  ✅ Good differentiation!")
else:
    print(f"  ❌ Still too similar")

print(f"\n{'='*70}")
print("THESE ARE GAME-LEVEL ONLY (70% of final score)")
print("Move-level (30%) will be added by the backend")
print("="*70)

