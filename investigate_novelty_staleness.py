#!/usr/bin/env python3
"""Investigate Novelty/Staleness calculation"""
import requests

BACKEND_URL = "http://localhost:8002"

def get_games(user_id, platform):
    """Get games for a player"""
    url = f"{BACKEND_URL}/api/v1/analyses/{user_id}/{platform}?analysis_type=stockfish"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            return response.json()
        return []
    except:
        return []

def analyze_opening_variety(user_id, platform):
    """Analyze opening variety for novelty/staleness"""
    games = get_games(user_id, platform)
    
    if not games:
        print(f"No games found for {user_id}")
        return
    
    print(f"\n{'='*70}")
    print(f"{user_id.upper()} - OPENING VARIETY ANALYSIS")
    print(f"{'='*70}")
    print(f"\nTotal games analyzed: {len(games)}")
    
    # Extract opening information
    openings = []
    for game in games:
        # Try to get opening from the game data
        opening = game.get('opening') or game.get('opening_family') or 'Unknown'
        openings.append(opening)
    
    # Count unique openings
    from collections import Counter
    opening_counts = Counter(openings)
    unique_openings = len(opening_counts)
    most_common = opening_counts.most_common(5)
    
    print(f"\nOpening Statistics:")
    print(f"  Unique openings: {unique_openings}")
    print(f"  Diversity ratio: {unique_openings/len(openings):.2f}")
    
    print(f"\nMost played openings:")
    for opening, count in most_common:
        percentage = (count / len(openings)) * 100
        print(f"  {opening}: {count} games ({percentage:.1f}%)")
    
    # Calculate novelty/staleness indicators
    diversity_ratio = unique_openings / len(openings)
    most_common_ratio = most_common[0][1] / len(openings) if most_common else 0
    
    print(f"\nNovelty Indicators:")
    print(f"  High diversity ({diversity_ratio:.2f}): {'✅ Novel' if diversity_ratio > 0.5 else '❌ Repetitive'}")
    print(f"  Most common opening: {most_common_ratio*100:.1f}%")
    
    print(f"\nStaleness Indicators:")
    print(f"  High repetition ({most_common_ratio:.2f}): {'✅ Stale' if most_common_ratio > 0.5 else '❌ Varied'}")
    
    # Expected scores
    print(f"\nExpected Personality Scores:")
    if diversity_ratio > 0.5:
        print(f"  Novelty: HIGH (70-90)")
        print(f"  Staleness: LOW (30-50)")
    else:
        print(f"  Novelty: LOW (30-50)")
        print(f"  Staleness: HIGH (70-90)")
    
    return {
        'total_games': len(games),
        'unique_openings': unique_openings,
        'diversity_ratio': diversity_ratio,
        'most_common_ratio': most_common_ratio
    }

def get_personality_scores(user_id, platform):
    """Get current personality scores"""
    url = f"{BACKEND_URL}/api/v1/deep-analysis/{user_id}/{platform}"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            return response.json().get('personality_scores', {})
        return None
    except:
        return None

print("="*70)
print("NOVELTY/STALENESS INVESTIGATION")
print("="*70)

# Analyze both players
krecetas_stats = analyze_opening_variety('krecetas', 'lichess')
skudurelis_stats = analyze_opening_variety('skudurelis', 'lichess')

# Get actual personality scores
print(f"\n{'='*70}")
print("ACTUAL PERSONALITY SCORES")
print("="*70)

for user_id in ['krecetas', 'skudurelis']:
    scores = get_personality_scores(user_id, 'lichess')
    if scores:
        print(f"\n{user_id.upper()}:")
        print(f"  Novelty: {scores.get('novelty', 0):.1f}")
        print(f"  Staleness: {scores.get('staleness', 0):.1f}")

# Comparison
if krecetas_stats and skudurelis_stats:
    print(f"\n{'='*70}")
    print("COMPARISON")
    print("="*70)
    
    print(f"\n{'Metric':<25} {'Krecetas':<15} {'Skudurelis':<15}")
    print("-" * 55)
    print(f"{'Unique openings':<25} {krecetas_stats['unique_openings']:<15} {skudurelis_stats['unique_openings']:<15}")
    print(f"{'Diversity ratio':<25} {krecetas_stats['diversity_ratio']:<15.2f} {skudurelis_stats['diversity_ratio']:<15.2f}")
    print(f"{'Most common %':<25} {krecetas_stats['most_common_ratio']*100:<15.1f} {skudurelis_stats['most_common_ratio']*100:<15.1f}")
    
    print(f"\nExpectation:")
    print(f"  Krecetas: Should be REPETITIVE (LOW novelty, HIGH staleness)")
    print(f"  Skudurelis: Should be VARIED (HIGH novelty, LOW staleness)")

