#!/usr/bin/env python3
"""Full re-analysis of all games for both players"""
import requests
import time

BACKEND_URL = "http://localhost:8002"

def get_scores(user_id, platform):
    url = f"{BACKEND_URL}/api/v1/deep-analysis/{user_id}/{platform}"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            return response.json().get('personality_scores', {})
        return None
    except:
        return None

def trigger_analysis(user_id, platform, limit):
    url = f"{BACKEND_URL}/api/v1/analyze?use_parallel=false"
    payload = {
        "user_id": user_id,
        "platform": platform,
        "analysis_type": "stockfish",
        "limit": limit
    }
    try:
        response = requests.post(url, json=payload, timeout=600)
        return response.status_code == 200
    except:
        return False

print("="*70)
print("FULL RE-ANALYSIS TEST - ALL GAMES")
print("="*70)

# Get current scores
print("\n📊 CURRENT SCORES")
print("="*70)

krecetas_before = get_scores("krecetas", "lichess")
skudurelis_before = get_scores("skudurelis", "lichess")

if krecetas_before:
    print(f"\nKRECETAS:")
    print(f"  Patient: {krecetas_before.get('patient', 0):.1f}")
    print(f"  Aggressive: {krecetas_before.get('aggressive', 0):.1f}")

if skudurelis_before:
    print(f"\nSKUDURELIS:")
    print(f"  Patient: {skudurelis_before.get('patient', 0):.1f}")
    print(f"  Aggressive: {skudurelis_before.get('aggressive', 0):.1f}")

# Trigger full re-analysis
print(f"\n{'='*70}")
print("🔄 TRIGGERING FULL RE-ANALYSIS")
print("="*70)

print("\nKrecetas (12 games)...")
if trigger_analysis("krecetas", "lichess", 15):
    print("  ✅ Started")
else:
    print("  ❌ Failed")

time.sleep(1)

print("\nSkudurelis (18 games)...")
if trigger_analysis("skudurelis", "lichess", 20):
    print("  ✅ Started")
else:
    print("  ❌ Failed")

# Wait for completion
print(f"\n{'='*70}")
print("⏳ WAITING FOR ANALYSIS (30 games total, ~45 seconds)")
print("="*70)

for i in range(45, 0, -1):
    print(f"  {i} seconds remaining...", end="\r")
    time.sleep(1)

print("\n")

# Get new scores
print("="*70)
print("📊 NEW SCORES (AFTER FULL RE-ANALYSIS)")
print("="*70)

krecetas_after = get_scores("krecetas", "lichess")
skudurelis_after = get_scores("skudurelis", "lichess")

if krecetas_after:
    print(f"\nKRECETAS:")
    print(f"  Tactical:    {krecetas_after.get('tactical', 0):.1f}")
    print(f"  Positional:  {krecetas_after.get('positional', 0):.1f}")
    print(f"  Aggressive:  {krecetas_after.get('aggressive', 0):.1f}")
    print(f"  Patient:     {krecetas_after.get('patient', 0):.1f}")
    print(f"  Novelty:     {krecetas_after.get('novelty', 0):.1f}")
    print(f"  Staleness:   {krecetas_after.get('staleness', 0):.1f}")

if skudurelis_after:
    print(f"\nSKUDURELIS:")
    print(f"  Tactical:    {skudurelis_after.get('tactical', 0):.1f}")
    print(f"  Positional:  {skudurelis_after.get('positional', 0):.1f}")
    print(f"  Aggressive:  {skudurelis_after.get('aggressive', 0):.1f}")
    print(f"  Patient:     {skudurelis_after.get('patient', 0):.1f}")
    print(f"  Novelty:     {skudurelis_after.get('novelty', 0):.1f}")
    print(f"  Staleness:   {skudurelis_after.get('staleness', 0):.1f}")

# Comparison
if all([krecetas_before, skudurelis_before, krecetas_after, skudurelis_after]):
    print(f"\n{'='*70}")
    print("📈 CHANGES")
    print("="*70)
    
    k_patient_change = krecetas_after.get('patient', 0) - krecetas_before.get('patient', 0)
    s_patient_change = skudurelis_after.get('patient', 0) - skudurelis_before.get('patient', 0)
    k_aggressive_change = krecetas_after.get('aggressive', 0) - krecetas_before.get('aggressive', 0)
    s_aggressive_change = skudurelis_after.get('aggressive', 0) - skudurelis_before.get('aggressive', 0)
    
    print(f"\nKRECETAS:")
    print(f"  Patient:    {krecetas_before.get('patient', 0):.1f} → {krecetas_after.get('patient', 0):.1f} ({k_patient_change:+.1f})")
    print(f"  Aggressive: {krecetas_before.get('aggressive', 0):.1f} → {krecetas_after.get('aggressive', 0):.1f} ({k_aggressive_change:+.1f})")
    
    print(f"\nSKUDURELIS:")
    print(f"  Patient:    {skudurelis_before.get('patient', 0):.1f} → {skudurelis_after.get('patient', 0):.1f} ({s_patient_change:+.1f})")
    print(f"  Aggressive: {skudurelis_before.get('aggressive', 0):.1f} → {skudurelis_after.get('aggressive', 0):.1f} ({s_aggressive_change:+.1f})")
    
    # Check differentiation
    old_diff = abs(krecetas_before.get('patient', 0) - skudurelis_before.get('patient', 0))
    new_diff = abs(krecetas_after.get('patient', 0) - skudurelis_after.get('patient', 0))
    
    print(f"\n{'='*70}")
    print("🎯 PATIENT SCORE DIFFERENTIATION")
    print("="*70)
    print(f"\nBefore: {old_diff:.1f} points apart")
    print(f"After:  {new_diff:.1f} points apart")
    print(f"Change: {new_diff - old_diff:+.1f} points")
    
    if new_diff >= 20:
        print("\n✅ EXCELLENT differentiation!")
    elif new_diff >= 15:
        print("\n✅ Good differentiation")
    elif new_diff >= 10:
        print("\n⚠️  Moderate differentiation - could be better")
    else:
        print("\n❌ Still too similar - need more calibration")
    
    # Expected vs actual
    print(f"\n{'='*70}")
    print("🎯 TARGET VALIDATION")
    print("="*70)
    
    k_patient = krecetas_after.get('patient', 0)
    s_patient = skudurelis_after.get('patient', 0)
    
    print(f"\nKrecetas (slow player):")
    print(f"  Target: 75-90")
    print(f"  Actual: {k_patient:.1f}")
    print(f"  Status: {'✅ Within range' if 75 <= k_patient <= 90 else '⚠️ Outside range'}")
    
    print(f"\nSkudurelis (fast player):")
    print(f"  Target: 45-65")
    print(f"  Actual: {s_patient:.1f}")
    print(f"  Status: {'✅ Within range' if 45 <= s_patient <= 65 else '⚠️ Outside range'}")

