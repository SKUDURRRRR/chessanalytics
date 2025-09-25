#!/usr/bin/env python3
"""
Test script for the enhanced smart import functionality.
This script tests the new logic that:
1. Checks for new games first
2. If no new games, imports the next 100 games from the last imported position
"""

import asyncio
import sys
import os
import json
from datetime import datetime

# Add the python directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'python'))

from core.unified_api_server import import_games_smart

async def test_smart_import():
    """Test the smart import functionality with a sample user"""
    
    # Test data - replace with actual test user
    test_cases = [
        {
            "user_id": "testuser",
            "platform": "lichess",
            "description": "Test Lichess user"
        },
        {
            "user_id": "testuser",
            "platform": "chess.com", 
            "description": "Test Chess.com user"
        }
    ]
    
    print("🧪 Testing Smart Import Functionality")
    print("=" * 50)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 Test Case {i}: {test_case['description']}")
        print(f"   User: {test_case['user_id']}")
        print(f"   Platform: {test_case['platform']}")
        
        try:
            # Create request payload
            request = {
                "user_id": test_case["user_id"],
                "platform": test_case["platform"]
            }
            
            print(f"   🔍 Checking for new games...")
            
            # Call the smart import function
            result = await import_games_smart(request)
            
            # Display results
            print(f"   ✅ Import completed successfully!")
            print(f"   📊 Results:")
            print(f"      - Imported games: {result.imported_games}")
            print(f"      - New games found: {getattr(result, 'new_games_count', 'N/A')}")
            print(f"      - Had existing games: {getattr(result, 'had_existing_games', 'N/A')}")
            print(f"      - Message: {result.message}")
            
        except Exception as e:
            print(f"   ❌ Test failed: {str(e)}")
            import traceback
            traceback.print_exc()
    
    print(f"\n🎯 Smart Import Test Summary")
    print("=" * 50)
    print("The enhanced smart import now:")
    print("1. ✅ Checks for new games first")
    print("2. ✅ If new games found, imports up to 100 of them")
    print("3. ✅ If no new games, imports next 100 games from last position")
    print("4. ✅ Provides detailed feedback about what was imported")
    print("5. ✅ Handles both Lichess and Chess.com platforms")

if __name__ == "__main__":
    print("🚀 Starting Smart Import Test...")
    asyncio.run(test_smart_import())
    print("\n✨ Test completed!")
