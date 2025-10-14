#!/usr/bin/env python3
"""Check if time management scores are being calculated"""
import requests
import json

BACKEND_URL = "http://localhost:8002"

def get_analyses(user_id, platform):
    url = f"{BACKEND_URL}/api/v1/analyses/{user_id}/{platform}?analysis_type=stockfish"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            return response.json()
        return []
    except (requests.exceptions.RequestException, requests.exceptions.Timeout) as e:
        print(f"Network error for {user_id}: {e}")
        return []
    except (json.JSONDecodeError, ValueError) as e:
        print(f"JSON parsing error for {user_id}: {e}")
        return []

print("="*70)
print("TIME MANAGEMENT SCORE CHECK")
print("="*70)

for user_id in ["krecetas", "skudurelis"]:
    analyses = get_analyses(user_id, "lichess")
    
    print(f"\n{user_id.upper()} ({len(analyses)} games):")
    
    if not analyses:
        print("  No analyses found")
        continue
    
    # Check time scores
    time_scores = []
    for analysis in analyses[:10]:  # Check first 10
        time_score = analysis.get('time_management_score', 'NOT FOUND')
        time_scores.append(time_score)
    
    print(f"  Time management scores (first 10 games):")
    for i, score in enumerate(time_scores, 1):
        print(f"    Game {i}: {score}")
    
    # Statistics
    valid_scores = [s for s in time_scores if isinstance(s, (int, float))]
    if valid_scores:
        avg = sum(valid_scores) / len(valid_scores)
        all_50 = all(s == 50.0 for s in valid_scores)
        print(f"\n  Average: {avg:.1f}")
        if all_50:
            print(f"  ⚠️  ALL scores are 50.0 - NEW CODE NOT BEING USED!")
        else:
            print(f"  ✅ Scores vary - new code IS working")
    else:
        print(f"\n  ❌ No valid time scores found!")

print(f"\n{'='*70}")
print("DIAGNOSIS")
print("="*70)
print("\nIf all scores are 50.0:")
print("  → Backend is running OLD code (before changes)")
print("  → Need to RESTART backend to load new code")
print("\nIf scores vary (not all 50.0):")
print("  → New code is working")
print("  → Problem is elsewhere (aggregation, calibration, etc.)")

