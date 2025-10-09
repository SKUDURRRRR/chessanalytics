#!/usr/bin/env python3
"""
Test re-analysis with the correct user and platform combinations.
"""

import requests
import json

def test_reanalysis_correct_user():
    """Test re-analysis with the correct user/platform combinations."""
    
    print("🧪 Testing Re-analysis with correct user/platform combinations")
    print("=" * 60)
    
    # Based on the debug results, we know:
    # - skudurrrrr has 2 games on chess.com
    # - skudurelis has 14 games on lichess
    
    test_cases = [
        {
            "user_id": "skudurrrrr",
            "platform": "chess.com",
            "game_id": "143603516752",  # From the debug output
            "description": "skudurrrrr on chess.com"
        },
        {
            "user_id": "skudurelis", 
            "platform": "lichess",
            "game_id": "a4kBSpQN",  # From the debug output
            "description": "skudurelis on lichess"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🔬 Test {i}: {test_case['description']}")
        print("-" * 40)
        
        test_data = {
            "analysis_type": "stockfish",
            "user_id": test_case["user_id"],
            "platform": test_case["platform"],
            "game_id": test_case["game_id"],
            "depth": 8,
            "skill_level": 8
        }
        
        url = "http://localhost:8002/api/v1/analyze"
        
        try:
            print(f"📡 Sending re-analysis request for game {test_case['game_id']}...")
            response = requests.post(url, json=test_data, timeout=300)
            
            print(f"📊 Response Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Re-analysis Response:")
                print(json.dumps(result, indent=2))
                
                if result.get('success'):
                    print(f"\n🎉 SUCCESS: Re-analysis completed for {test_case['description']}!")
                    print(f"   Analysis ID: {result.get('analysis_id')}")
                    print(f"   Message: {result.get('message')}")
                else:
                    print(f"\n❌ FAILED: {result.get('message')}")
                    
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                print(f"Response: {response.text}")
                
        except Exception as e:
            print(f"❌ Error during test: {e}")
        
        print()

if __name__ == "__main__":
    test_reanalysis_correct_user()
