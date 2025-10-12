#!/usr/bin/env python3
"""Re-analyze test players with new time management scoring"""
import sys
import asyncio
import requests
from pathlib import Path

# Configuration
BACKEND_URL = "http://localhost:3001"  # Adjust if different
TEST_PLAYERS = [
    {"user_id": "krecetas", "platform": "lichess"},
    {"user_id": "skudurelis", "platform": "lichess"}
]

async def reanalyze_player(user_id: str, platform: str, limit: int = 20):
    """Trigger re-analysis for a player"""
    print(f"\n{'='*60}")
    print(f"Re-analyzing: {user_id} on {platform}")
    print(f"{'='*60}\n")
    
    # Trigger analysis
    analyze_url = f"{BACKEND_URL}/api/v1/analyze"
    payload = {
        "user_id": user_id,
        "platform": platform,
        "analysis_type": "stockfish",
        "limit": limit
    }
    
    try:
        print(f"Sending analysis request to {analyze_url}...")
        response = requests.post(f"{analyze_url}?use_parallel=false", json=payload, timeout=600)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Analysis started successfully")
            print(f"  Message: {result.get('message', 'N/A')}")
            print(f"  Status: {result.get('data', {}).get('status', 'N/A')}")
            return True
        else:
            print(f"✗ Analysis request failed: {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

async def check_personality_scores(user_id: str, platform: str):
    """Fetch and display personality scores"""
    deep_analysis_url = f"{BACKEND_URL}/api/v1/deep-analysis/{user_id}/{platform}"
    
    try:
        print(f"\nFetching personality scores for {user_id}...")
        response = requests.get(deep_analysis_url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            scores = data.get('personality_scores', {})
            
            print(f"\n{user_id.upper()} - Personality Scores:")
            print(f"  Tactical:    {scores.get('tactical', 0):.1f}")
            print(f"  Positional:  {scores.get('positional', 0):.1f}")
            print(f"  Aggressive:  {scores.get('aggressive', 0):.1f}")
            print(f"  Patient:     {scores.get('patient', 0):.1f}")
            print(f"  Novelty:     {scores.get('novelty', 0):.1f}")
            print(f"  Staleness:   {scores.get('staleness', 0):.1f}")
            
            return scores
        else:
            print(f"✗ Failed to fetch scores: {response.status_code}")
            return None
    except Exception as e:
        print(f"✗ Error fetching scores: {e}")
        return None

async def main():
    print("="*60)
    print("CHESS PERSONALITY RADAR - TEST PLAYER RE-ANALYSIS")
    print("="*60)
    print("\nThis will re-analyze both test players with the new")
    print("time management scoring implementation.")
    print()
    
    # Check if backend is running
    try:
        health_response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if health_response.status_code != 200:
            print(f"✗ Backend not responding properly at {BACKEND_URL}")
            print("  Please start the backend first!")
            return
        print(f"✓ Backend is running at {BACKEND_URL}\n")
    except Exception as e:
        print(f"✗ Cannot reach backend at {BACKEND_URL}")
        print(f"  Error: {e}")
        print("  Please start the backend first!")
        return
    
    # Re-analyze players
    success_count = 0
    for player in TEST_PLAYERS:
        result = await reanalyze_player(player["user_id"], player["platform"], limit=20)
        if result:
            success_count += 1
        await asyncio.sleep(2)  # Brief pause between requests
    
    print(f"\n{'='*60}")
    print(f"Re-analysis Summary: {success_count}/{len(TEST_PLAYERS)} players processed")
    print(f"{'='*60}\n")
    
    if success_count > 0:
        print("Waiting 10 seconds for analysis to complete...\n")
        await asyncio.sleep(10)
        
        # Fetch updated personality scores
        print(f"{'='*60}")
        print("UPDATED PERSONALITY SCORES")
        print(f"{'='*60}")
        
        all_scores = {}
        for player in TEST_PLAYERS:
            scores = await check_personality_scores(player["user_id"], player["platform"])
            if scores:
                all_scores[player["user_id"]] = scores
            await asyncio.sleep(1)
        
        # Compare players
        if len(all_scores) == 2:
            print(f"\n{'='*60}")
            print("COMPARISON")
            print(f"{'='*60}\n")
            
            krecetas = all_scores.get('krecetas', {})
            skudurelis = all_scores.get('skudurelis', {})
            
            print(f"{'Trait':<12} | {'Krecetas':<8} | {'Skudurelis':<10} | Difference")
            print("-" * 50)
            for trait in ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']:
                k_score = krecetas.get(trait, 0)
                s_score = skudurelis.get(trait, 0)
                diff = s_score - k_score
                diff_str = f"+{diff:.1f}" if diff > 0 else f"{diff:.1f}"
                print(f"{trait.capitalize():<12} | {k_score:>7.1f} | {s_score:>9.1f} | {diff_str}")
            
            # Analysis
            print(f"\n{'='*60}")
            print("EXPECTED vs ACTUAL")
            print(f"{'='*60}\n")
            
            print("KRECETAS (slow, methodical, repetitive):")
            patient_ok = krecetas.get('patient', 0) >= 70
            novelty_ok = krecetas.get('novelty', 0) <= 50
            staleness_ok = krecetas.get('staleness', 0) >= 60
            print(f"  Patient: {krecetas.get('patient', 0):.1f} (expect 70+) {'✓' if patient_ok else '✗'}")
            print(f"  Novelty: {krecetas.get('novelty', 0):.1f} (expect ≤50) {'✓' if novelty_ok else '✗'}")
            print(f"  Staleness: {krecetas.get('staleness', 0):.1f} (expect 60+) {'✓' if staleness_ok else '✗'}")
            
            print("\nSKUDURELIS (fast, aggressive, varied):")
            patient_ok2 = skudurelis.get('patient', 0) <= 60
            aggressive_ok = skudurelis.get('aggressive', 0) >= 70
            novelty_ok2 = skudurelis.get('novelty', 0) >= 60
            print(f"  Patient: {skudurelis.get('patient', 0):.1f} (expect ≤60) {'✓' if patient_ok2 else '✗'}")
            print(f"  Aggressive: {skudurelis.get('aggressive', 0):.1f} (expect 70+) {'✓' if aggressive_ok else '✗'}")
            print(f"  Novelty: {skudurelis.get('novelty', 0):.1f} (expect 60+) {'✓' if novelty_ok2 else '✗'}")
            
            # Check if differentiation improved
            patient_diff = abs(krecetas.get('patient', 0) - skudurelis.get('patient', 0))
            print(f"\nPatient score difference: {patient_diff:.1f} points")
            if patient_diff >= 15:
                print("✓ Good differentiation between fast/slow players!")
            else:
                print("✗ Still not enough differentiation - may need further calibration")

if __name__ == "__main__":
    asyncio.run(main())

