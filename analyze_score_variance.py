#!/usr/bin/env python3
"""Analyze score variance for Krecetas and Skudurelis"""
import sys
import os
import logging
import traceback
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
PYTHON_DIR = PROJECT_ROOT / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

# Load backend URL from environment variable
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8002")

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_personality_scores(user_id, platform):
    """Get personality scores from API"""
    url = f"{BACKEND_URL}/api/v1/deep-analysis/{user_id}/{platform}"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            return response.json().get('personality_scores', {})
        logger.warning(f"API returned status code {response.status_code} for {user_id}")
        return None
    except (requests.RequestException, requests.Timeout) as e:
        logger.error(f"Request failed for {user_id}: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error occurred while fetching scores for {user_id}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return None

print("="*70)
print("PERSONALITY SCORE VARIANCE ANALYSIS")
print("="*70)

players = ['krecetas', 'skudurelis']
all_scores = {}

for user_id in players:
    print(f"\nFetching scores for {user_id}...")
    scores = get_personality_scores(user_id, 'lichess')
    if scores:
        all_scores[user_id] = scores
        print(f"✓ {user_id}:")
        print(f"  Tactical: {scores.get('tactical', 0):.1f}")
        print(f"  Positional: {scores.get('positional', 0):.1f}")
        print(f"  Aggressive: {scores.get('aggressive', 0):.1f}")
        print(f"  Patient: {scores.get('patient', 0):.1f}")
        print(f"  Novelty: {scores.get('novelty', 0):.1f}")
        print(f"  Staleness: {scores.get('staleness', 0):.1f}")

if len(all_scores) == 2:
    print(f"\n{'='*70}")
    print("VARIANCE ANALYSIS")
    print("="*70)

    traits = ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']

    k_scores = all_scores['krecetas']
    s_scores = all_scores['skudurelis']

    print(f"\n{'Trait':<15} {'Krecetas':<12} {'Skudurelis':<12} {'Difference':<12} {'Status'}")
    print("-" * 70)

    for trait in traits:
        k_val = k_scores.get(trait, 0)
        s_val = s_scores.get(trait, 0)
        diff = abs(k_val - s_val)

        if diff < 5:
            status = "❌ Too similar"
        elif diff < 10:
            status = "⚠️ Low variance"
        elif diff < 20:
            status = "✓ Good"
        else:
            status = "✓✓ Great!"

        print(f"{trait:<15} {k_val:<12.1f} {s_val:<12.1f} {diff:<12.1f} {status}")

    # Overall statistics
    avg_k = sum(k_scores.values()) / len(k_scores)
    avg_s = sum(s_scores.values()) / len(s_scores)

    print(f"\n{'='*70}")
    print("OVERALL STATISTICS")
    print("="*70)
    print(f"Krecetas average: {avg_k:.1f}")
    print(f"Skudurelis average: {avg_s:.1f}")
    print(f"Average difference per trait: {sum(abs(k_scores[t] - s_scores[t]) for t in traits) / len(traits):.1f}")

    # Check if all scores are in narrow range
    all_vals = list(k_scores.values()) + list(s_scores.values())
    min_score = min(all_vals)
    max_score = max(all_vals)
    score_range = max_score - min_score

    print(f"\nScore range: {min_score:.1f} to {max_score:.1f} (spread: {score_range:.1f})")

    if score_range < 30:
        print("❌ PROBLEM: Scores are too clustered! Need more variance.")
    elif score_range < 50:
        print("⚠️ Scores have moderate variance. Could be improved.")
    else:
        print("✓ Good score variance!")

    print(f"\n{'='*70}")
    print("RECOMMENDATIONS")
    print("="*70)
    print("\nTo increase variance:")
    print("1. Reduce base scores (50 → 30-40)")
    print("2. Increase bonus/penalty multipliers (×1.5 to ×2)")
    print("3. Add exponential scaling for extreme values")
    print("4. Ensure skill level adjustments don't compress scores")
