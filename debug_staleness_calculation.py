#!/usr/bin/env python3
"""Debug why staleness is so low"""
import math

def calc_staleness(total, unique, most_common_count):
    """Current staleness formula"""
    repetition_ratio = most_common_count / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    base = 30.0
    repetition_bonus = repetition_ratio * 110.0
    diversity_penalty = diversity_score * 0.3
    
    score = base + repetition_bonus - diversity_penalty
    return max(0.0, min(100.0, score))

print("="*70)
print("STALENESS CALCULATION DEBUG")
print("="*70)

# Actual data
players = {
    'KRECETAS': {
        'total': 1000,
        'unique': 29,
        'most_common': 234,  # King's Pawn Game 23.4%
        'most_common_name': "King's Pawn Game",
        'most_common_pct': 23.4
    },
    'SKUDURELIS': {
        'total': 1000,
        'unique': 27,
        'most_common': 257,  # Caro-Kann 25.7%
        'most_common_name': 'Caro-Kann Defense',
        'most_common_pct': 25.7
    }
}

for name, data in players.items():
    total = data['total']
    unique = data['unique']
    most_common = data['most_common']
    
    print(f"\n{'='*70}")
    print(f"{name}")
    print(f"{'='*70}")
    print(f"\nInput data:")
    print(f"  Total games: {total}")
    print(f"  Unique openings: {unique}")
    print(f"  Most common: {data['most_common_name']} - {most_common} games ({data['most_common_pct']:.1f}%)")
    
    # Calculate step by step
    repetition_ratio = most_common / total
    diversity_score = min(100, (math.sqrt(unique) / math.sqrt(100)) * 100)
    
    print(f"\nIntermediate calculations:")
    print(f"  repetition_ratio: {repetition_ratio:.3f}")
    print(f"  diversity_score: {diversity_score:.1f}")
    
    base = 30.0
    repetition_bonus = repetition_ratio * 110.0
    diversity_penalty = diversity_score * 0.3
    
    print(f"\nFormula breakdown:")
    print(f"  base: {base:.1f}")
    print(f"  repetition_bonus: {repetition_ratio:.3f} * 110.0 = {repetition_bonus:.1f}")
    print(f"  diversity_penalty: {diversity_score:.1f} * 0.3 = {diversity_penalty:.1f}")
    
    raw_score = base + repetition_bonus - diversity_penalty
    final_score = max(0.0, min(100.0, raw_score))
    
    print(f"\n  raw_score: {base:.1f} + {repetition_bonus:.1f} - {diversity_penalty:.1f} = {raw_score:.1f}")
    print(f"  final_score (clamped): {final_score:.1f}")
    
    print(f"\n🎯 GAME-LEVEL Staleness: {final_score:.1f}")
    
    # This is 70% of final score
    print(f"\n⚠️  This is only game-level (70% weight)")
    print(f"   If move-level staleness is 50, final would be:")
    print(f"   {final_score:.1f} * 0.7 + 50 * 0.3 = {final_score * 0.7 + 50 * 0.3:.1f}")

print(f"\n{'='*70}")
print("DIAGNOSIS")
print("="*70)

skud_game_level = calc_staleness(1000, 27, 257)
print(f"\nSkudurelis game-level staleness: {skud_game_level:.1f}")
print(f"Skudurelis shows: 31")
print(f"\nIf move-level is low (e.g., 0-20), then:")
print(f"  {skud_game_level:.1f} * 0.7 + 20 * 0.3 = {skud_game_level * 0.7 + 20 * 0.3:.1f}")
print(f"  {skud_game_level:.1f} * 0.7 + 10 * 0.3 = {skud_game_level * 0.7 + 10 * 0.3:.1f}")
print(f"  {skud_game_level:.1f} * 0.7 + 0 * 0.3 = {skud_game_level * 0.7:.1f}")

print(f"\n💡 HYPOTHESIS:")
print(f"   Move-level staleness is calculating very LOW")
print(f"   This drags down the final score even though game-level is correct")
print(f"\n   Need to check PersonalityScorer.score_staleness() formula!")

