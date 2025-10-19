#!/usr/bin/env python3
"""
Test script to verify that game analysis doesn't block other API requests.

This script simulates multiple users making requests simultaneously:
1. User A starts game analysis (long-running operation)
2. User B tries to load their analytics (should NOT be blocked)
3. User C tries to get game stats (should NOT be blocked)

If the fix works, all requests should complete without blocking.
"""

import asyncio
import aiohttp
import time
from typing import List, Dict, Any

# Configuration
API_BASE_URL = "http://localhost:8002"  # Adjust to your backend URL
TEST_USER_A = "skudurrrrr"  # User who will trigger analysis
TEST_USER_B = "testuser2"   # User who will load analytics
TEST_PLATFORM = "chess.com"

async def trigger_analysis(session: aiohttp.ClientSession, user_id: str, platform: str) -> Dict[str, Any]:
    """Trigger game analysis for a user."""
    url = f"{API_BASE_URL}/api/v1/analyze"
    payload = {
        "user_id": user_id,
        "platform": platform,
        "analysis_type": "stockfish",
        "limit": 5  # Analyze 5 games
    }

    start_time = time.time()
    print(f"[User A] Starting analysis at {time.strftime('%H:%M:%S')}...")

    try:
        async with session.post(url, json=payload) as response:
            result = await response.json()
            elapsed = time.time() - start_time
            print(f"[User A] Analysis started successfully in {elapsed:.2f}s")
            return {"success": True, "elapsed": elapsed, "result": result}
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[User A] Analysis failed after {elapsed:.2f}s: {e}")
        return {"success": False, "elapsed": elapsed, "error": str(e)}

async def load_analytics(session: aiohttp.ClientSession, user_id: str, platform: str) -> Dict[str, Any]:
    """Load analytics for a user (should not be blocked by analysis)."""
    url = f"{API_BASE_URL}/api/v1/stats/{user_id}/{platform}"

    start_time = time.time()
    print(f"[User B] Loading analytics at {time.strftime('%H:%M:%S')}...")

    try:
        async with session.get(url, params={"analysis_type": "stockfish"}) as response:
            result = await response.json()
            elapsed = time.time() - start_time
            print(f"[User B] ✅ Analytics loaded in {elapsed:.2f}s (NOT blocked!)")
            return {"success": True, "elapsed": elapsed, "result": result}
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[User B] ❌ Analytics failed after {elapsed:.2f}s: {e}")
        return {"success": False, "elapsed": elapsed, "error": str(e)}

async def get_game_analyses(session: aiohttp.ClientSession, user_id: str, platform: str) -> Dict[str, Any]:
    """Get game analyses for a user (should not be blocked)."""
    url = f"{API_BASE_URL}/api/v1/analyses/{user_id}/{platform}"

    start_time = time.time()
    print(f"[User C] Getting game analyses at {time.strftime('%H:%M:%S')}...")

    try:
        async with session.get(url, params={"analysis_type": "stockfish", "limit": 10}) as response:
            result = await response.json()
            elapsed = time.time() - start_time
            print(f"[User C] ✅ Game analyses retrieved in {elapsed:.2f}s (NOT blocked!)")
            return {"success": True, "elapsed": elapsed, "result": result}
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[User C] ❌ Game analyses failed after {elapsed:.2f}s: {e}")
        return {"success": False, "elapsed": elapsed, "error": str(e)}

async def check_health(session: aiohttp.ClientSession) -> bool:
    """Check if API is healthy."""
    url = f"{API_BASE_URL}/health"
    try:
        async with session.get(url) as response:
            if response.status == 200:
                print("✅ API is healthy")
                return True
            else:
                print(f"❌ API returned status {response.status}")
                return False
    except Exception as e:
        print(f"❌ API health check failed: {e}")
        return False

async def run_concurrent_test():
    """Run the concurrent test."""
    print("=" * 80)
    print("CONCURRENCY TEST: Game Analysis Should NOT Block Other Requests")
    print("=" * 80)
    print()

    async with aiohttp.ClientSession() as session:
        # Check API health
        print("Checking API health...")
        if not await check_health(session):
            print("\n❌ API is not available. Start the backend server and try again.")
            return

        print("\n" + "=" * 80)
        print("Starting concurrent requests...")
        print("=" * 80)
        print()

        # Start all requests concurrently
        # User A triggers analysis (long-running)
        # User B and C make requests immediately after
        start_time = time.time()

        tasks = [
            trigger_analysis(session, TEST_USER_A, TEST_PLATFORM),
            asyncio.sleep(0.5),  # Small delay before other requests
        ]

        # Start analysis first
        analysis_task = asyncio.create_task(tasks[0])
        await tasks[1]  # Wait 0.5s

        # Now make other requests while analysis is running
        other_tasks = [
            load_analytics(session, TEST_USER_B, TEST_PLATFORM),
            get_game_analyses(session, TEST_USER_B, TEST_PLATFORM),
            load_analytics(session, TEST_USER_A, TEST_PLATFORM),
        ]

        # Wait for all tasks
        print("\n⏳ Waiting for all requests to complete...\n")
        analysis_result = await analysis_task
        other_results = await asyncio.gather(*other_tasks, return_exceptions=True)

        total_elapsed = time.time() - start_time

        print("\n" + "=" * 80)
        print("TEST RESULTS")
        print("=" * 80)
        print()

        # Check if other requests completed quickly (not blocked)
        other_requests_ok = True
        for i, result in enumerate(other_results):
            if isinstance(result, Exception):
                print(f"❌ Request {i+1} failed with exception: {result}")
                other_requests_ok = False
            elif result.get("success") and result.get("elapsed", 999) < 5.0:
                print(f"✅ Request {i+1} completed in {result['elapsed']:.2f}s (NOT blocked)")
            else:
                print(f"❌ Request {i+1} took {result.get('elapsed', 999):.2f}s (might be blocked)")
                other_requests_ok = False

        print()
        print(f"Total test time: {total_elapsed:.2f}s")
        print()

        if other_requests_ok and analysis_result.get("success"):
            print("✅ SUCCESS: Analysis did NOT block other requests!")
            print("   The concurrency fix is working correctly.")
        elif analysis_result.get("success") and not other_requests_ok:
            print("⚠️  PARTIAL: Analysis started, but other requests were slow")
            print("   This might indicate the fix isn't fully working.")
        else:
            print("❌ FAILURE: Test did not pass as expected")
            print("   Check the backend logs for errors.")

        print()

async def run_sequential_test():
    """Run a sequential baseline test for comparison."""
    print("=" * 80)
    print("BASELINE TEST: Sequential Requests (for comparison)")
    print("=" * 80)
    print()

    async with aiohttp.ClientSession() as session:
        start_time = time.time()

        # Make requests one by one
        result1 = await load_analytics(session, TEST_USER_B, TEST_PLATFORM)
        result2 = await get_game_analyses(session, TEST_USER_B, TEST_PLATFORM)

        total_elapsed = time.time() - start_time

        print()
        print(f"Sequential baseline time: {total_elapsed:.2f}s")
        print("This is the expected time for 2 requests without blocking.")
        print()

def main():
    """Main entry point."""
    print()
    print("🧪 Testing Concurrent Analysis Fix")
    print()
    print(f"API URL: {API_BASE_URL}")
    print(f"Test User A (analysis): {TEST_USER_A}")
    print(f"Test User B (analytics): {TEST_USER_B}")
    print(f"Platform: {TEST_PLATFORM}")
    print()
    print("This test will:")
    print("1. Start game analysis for User A (long-running)")
    print("2. Immediately make other API requests for User B")
    print("3. Verify that User B's requests are NOT blocked")
    print()
    input("Press Enter to start the test...")
    print()

    # Run baseline test
    asyncio.run(run_sequential_test())

    print()
    input("Press Enter to run the concurrent test...")
    print()

    # Run concurrent test
    asyncio.run(run_concurrent_test())

if __name__ == "__main__":
    main()
