#!/usr/bin/env python3
"""Quick test: Re-analyze 5 games each for Krecetas and Skudurelis"""
import requests
import time
import sys

BACKEND_URL = "http://localhost:8002"
TEST_PLAYERS = [
    {"user_id": "krecetas", "platform": "lichess"},
    {"user_id": "skudurelis", "platform": "lichess"}
]

def check_backend():
    """Check if backend is running"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        return response.status_code == 200
    except:
        return False

def get_current_scores(user_id, platform):
    """Fetch current personality scores"""
    try:
        url = f"{BACKEND_URL}/api/v1/deep-analysis/{user_id}/{platform}"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            return data.get('personality_scores', {})
        return None
    except Exception as e:
        print(f"Error fetching scores: {e}")
        return None

def trigger_analysis(user_id, platform, limit=5):
    """Trigger re-analysis"""
    try:
        url = f"{BACKEND_URL}/api/v1/analyze?use_parallel=false"
        payload = {
            "user_id": user_id,
            "platform": platform,
            "analysis_type": "stockfish",
            "limit": limit
        }
        response = requests.post(url, json=payload, timeout=600)
        return response.status_code == 200
    except Exception as e:
        print(f"Error triggering analysis: {e}")
        return False

def main():
    print("="*70)
    print("PERSONALITY RADAR TEST - 5 GAMES PER PLAYER")
    print("="*70)
    print()
    
    # Check backend
    print("Checking backend status...")
    if not check_backend():
        print("❌ Backend is not running!")
        print("\nPlease start the backend first:")
        print("  .\\START_BACKEND_LOCAL.ps1")
        sys.exit(1)
    print("✅ Backend is running\n")
    
    # Get current scores
    print("="*70)
    print("CURRENT SCORES (BEFORE RE-ANALYSIS)")
    print("="*70)
    
    current_scores = {}
    for player in TEST_PLAYERS:
        user_id = player["user_id"]
        scores = get_current_scores(user_id, player["platform"])
        if scores:
            current_scores[user_id] = scores
            print(f"\n{user_id.upper()}:")
            print(f"  Tactical:    {scores.get('tactical', 0):.1f}")
            print(f"  Positional:  {scores.get('positional', 0):.1f}")
            print(f"  Aggressive:  {scores.get('aggressive', 0):.1f}")
            print(f"  Patient:     {scores.get('patient', 0):.1f}")
            print(f"  Novelty:     {scores.get('novelty', 0):.1f}")
            print(f"  Staleness:   {scores.get('staleness', 0):.1f}")
    
    # Trigger re-analysis
    print(f"\n{'='*70}")
    print("RE-ANALYZING (5 games each)...")
    print("="*70)
    
    for player in TEST_PLAYERS:
        user_id = player["user_id"]
        print(f"\nTriggering analysis for {user_id}...")
        success = trigger_analysis(user_id, player["platform"], limit=5)
        if success:
            print(f"  ✅ Analysis started")
        else:
            print(f"  ❌ Analysis failed")
        time.sleep(1)
    
    # Wait for analysis
    print("\nWaiting 20 seconds for analysis to complete...")
    for i in range(20, 0, -1):
        print(f"  {i}...", end="\r")
        time.sleep(1)
    print("\n")
    
    # Get new scores
    print("="*70)
    print("NEW SCORES (AFTER RE-ANALYSIS)")
    print("="*70)
    
    new_scores = {}
    for player in TEST_PLAYERS:
        user_id = player["user_id"]
        scores = get_current_scores(user_id, player["platform"])
        if scores:
            new_scores[user_id] = scores
            print(f"\n{user_id.upper()}:")
            print(f"  Tactical:    {scores.get('tactical', 0):.1f}")
            print(f"  Positional:  {scores.get('positional', 0):.1f}")
            print(f"  Aggressive:  {scores.get('aggressive', 0):.1f}")
            print(f"  Patient:     {scores.get('patient', 0):.1f}")
            print(f"  Novelty:     {scores.get('novelty', 0):.1f}")
            print(f"  Staleness:   {scores.get('staleness', 0):.1f}")
    
    # Show comparison
    if current_scores and new_scores:
        print(f"\n{'='*70}")
        print("COMPARISON (BEFORE → AFTER)")
        print("="*70)
        
        for user_id in ["krecetas", "skudurelis"]:
            if user_id in current_scores and user_id in new_scores:
                old = current_scores[user_id]
                new = new_scores[user_id]
                
                print(f"\n{user_id.upper()}:")
                for trait in ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']:
                    old_val = old.get(trait, 0)
                    new_val = new.get(trait, 0)
                    diff = new_val - old_val
                    arrow = "→"
                    emoji = "✓" if abs(diff) < 3 else "📊"
                    print(f"  {trait.capitalize():<12}: {old_val:>5.1f} {arrow} {new_val:>5.1f}  ({diff:+.1f}) {emoji}")
        
        # Check key improvements
        print(f"\n{'='*70}")
        print("KEY METRICS")
        print("="*70)
        
        k_old_patient = current_scores.get('krecetas', {}).get('patient', 0)
        k_new_patient = new_scores.get('krecetas', {}).get('patient', 0)
        s_old_patient = current_scores.get('skudurelis', {}).get('patient', 0)
        s_new_patient = new_scores.get('skudurelis', {}).get('patient', 0)
        
        old_diff = abs(k_old_patient - s_old_patient)
        new_diff = abs(k_new_patient - s_new_patient)
        
        print(f"\nPatient Score Differentiation:")
        print(f"  Before: {old_diff:.1f} points apart")
        print(f"  After:  {new_diff:.1f} points apart")
        print(f"  Change: {new_diff - old_diff:+.1f} points")
        
        if new_diff > 15:
            print("  ✅ Good differentiation!")
        else:
            print("  ⚠️  Still needs more differentiation")
        
        # Expected results
        print(f"\nExpected vs Actual:")
        print(f"  Krecetas Patient:   Expected 80-90, Got {k_new_patient:.1f}")
        print(f"  Skudurelis Patient: Expected 45-60, Got {s_new_patient:.1f}")
        
        k_ok = 80 <= k_new_patient <= 90
        s_ok = 45 <= s_new_patient <= 60
        
        if k_ok and s_ok:
            print("  ✅ Both within expected ranges!")
        elif k_ok:
            print("  ✅ Krecetas within range")
            print("  ⚠️  Skudurelis outside range")
        elif s_ok:
            print("  ⚠️  Krecetas outside range")
            print("  ✅ Skudurelis within range")
        else:
            print("  ⚠️  Both outside expected ranges - may need further calibration")

if __name__ == "__main__":
    main()

