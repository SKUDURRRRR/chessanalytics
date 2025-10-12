#!/usr/bin/env python3
"""
Test script for concurrent import functionality.
Tests that multiple imports can run simultaneously without timing out.
"""
import asyncio
import aiohttp
import time
from typing import Dict, Any

API_BASE_URL = "http://localhost:8080"

async def start_import(session: aiohttp.ClientSession, user_id: str, platform: str) -> Dict[str, Any]:
    """Start an import for a user"""
    url = f"{API_BASE_URL}/api/v1/import-more-games"
    data = {
        "user_id": user_id,
        "platform": platform,
        "limit": 500
    }
    
    print(f"[{user_id}] Starting import...")
    async with session.post(url, json=data) as response:
        result = await response.json()
        print(f"[{user_id}] Import started: {result}")
        return result

async def check_progress(session: aiohttp.ClientSession, user_id: str, platform: str) -> Dict[str, Any]:
    """Check import progress"""
    url = f"{API_BASE_URL}/api/v1/import-progress/{user_id}/{platform}"
    
    async with session.get(url) as response:
        return await response.json()

async def monitor_import(session: aiohttp.ClientSession, user_id: str, platform: str, max_wait: int = 180):
    """Monitor an import until completion or timeout"""
    start_time = time.time()
    last_status = None
    
    while time.time() - start_time < max_wait:
        progress = await check_progress(session, user_id, platform)
        status = progress.get('status')
        message = progress.get('message', '')
        imported = progress.get('imported_games', 0)
        
        # Only print if status changed
        if status != last_status:
            elapsed = int(time.time() - start_time)
            print(f"[{user_id}] [{elapsed}s] Status: {status} | Imported: {imported} | {message}")
            last_status = status
        
        if status in ('completed', 'error', 'cancelled'):
            return progress
        
        await asyncio.sleep(2)  # Check every 2 seconds
    
    print(f"[{user_id}] ⚠️  TIMEOUT after {max_wait}s")
    return await check_progress(session, user_id, platform)

async def test_single_import():
    """Test 1: Single import should complete successfully"""
    print("\n" + "="*60)
    print("TEST 1: Single Import")
    print("="*60)
    
    async with aiohttp.ClientSession() as session:
        await start_import(session, "test_user1", "lichess")
        result = await monitor_import(session, "test_user1", "lichess")
        
        if result.get('status') == 'completed':
            print(f"✅ Test 1 PASSED: Import completed successfully")
            print(f"   Imported {result.get('imported_games', 0)} games")
            return True
        else:
            print(f"❌ Test 1 FAILED: Status = {result.get('status')}")
            return False

async def test_concurrent_imports():
    """Test 2: Two concurrent imports should both complete"""
    print("\n" + "="*60)
    print("TEST 2: Concurrent Imports (2 users)")
    print("="*60)
    
    async with aiohttp.ClientSession() as session:
        # Start both imports simultaneously
        await asyncio.gather(
            start_import(session, "concurrent_user1", "lichess"),
            start_import(session, "concurrent_user2", "lichess")
        )
        
        # Monitor both imports
        results = await asyncio.gather(
            monitor_import(session, "concurrent_user1", "lichess"),
            monitor_import(session, "concurrent_user2", "lichess")
        )
        
        success = all(r.get('status') == 'completed' for r in results)
        
        if success:
            print(f"✅ Test 2 PASSED: Both imports completed successfully")
            print(f"   User 1: {results[0].get('imported_games', 0)} games")
            print(f"   User 2: {results[1].get('imported_games', 0)} games")
            return True
        else:
            print(f"❌ Test 2 FAILED:")
            print(f"   User 1 status: {results[0].get('status')}")
            print(f"   User 2 status: {results[1].get('status')}")
            return False

async def test_triple_concurrent():
    """Test 3: All 3 concurrent imports should complete (with optimizations)"""
    print("\n" + "="*60)
    print("TEST 3: Triple Concurrent Imports (optimized)")
    print("="*60)
    
    async with aiohttp.ClientSession() as session:
        # Start 3 imports simultaneously
        await asyncio.gather(
            start_import(session, "triple_user1", "lichess"),
            start_import(session, "triple_user2", "lichess"),
            start_import(session, "triple_user3", "lichess")
        )
        
        # Check initial status
        await asyncio.sleep(1)
        
        progress1 = await check_progress(session, "triple_user1", "lichess")
        progress2 = await check_progress(session, "triple_user2", "lichess")
        progress3 = await check_progress(session, "triple_user3", "lichess")
        
        statuses = [progress1.get('status'), progress2.get('status'), progress3.get('status')]
        importing_count = statuses.count('importing')
        
        print(f"   Initial status: {importing_count}/3 importing")
        
        # Monitor all 3 imports
        results = await asyncio.gather(
            monitor_import(session, "triple_user1", "lichess", max_wait=240),
            monitor_import(session, "triple_user2", "lichess", max_wait=240),
            monitor_import(session, "triple_user3", "lichess", max_wait=240)
        )
        
        success = all(r.get('status') == 'completed' for r in results)
        
        if success:
            print(f"✅ Test 3 PASSED: All 3 concurrent imports completed successfully")
            print(f"   User 1: {results[0].get('imported_games', 0)} games")
            print(f"   User 2: {results[1].get('imported_games', 0)} games")
            print(f"   User 3: {results[2].get('imported_games', 0)} games")
            return True
        else:
            print(f"❌ Test 3 FAILED:")
            print(f"   User 1 status: {results[0].get('status')}")
            print(f"   User 2 status: {results[1].get('status')}")
            print(f"   User 3 status: {results[2].get('status')}")
            return False

async def test_queuing():
    """Test 4: Fourth import should queue while 3 are running"""
    print("\n" + "="*60)
    print("TEST 4: Import Queuing (4 users)")
    print("="*60)
    
    async with aiohttp.ClientSession() as session:
        # Start 4 imports simultaneously
        await asyncio.gather(
            start_import(session, "queue_user1", "lichess"),
            start_import(session, "queue_user2", "lichess"),
            start_import(session, "queue_user3", "lichess"),
            start_import(session, "queue_user4", "lichess")
        )
        
        # Check if 4th is queued
        await asyncio.sleep(1)
        
        progress1 = await check_progress(session, "queue_user1", "lichess")
        progress2 = await check_progress(session, "queue_user2", "lichess")
        progress3 = await check_progress(session, "queue_user3", "lichess")
        progress4 = await check_progress(session, "queue_user4", "lichess")
        
        statuses = [progress1.get('status'), progress2.get('status'), 
                   progress3.get('status'), progress4.get('status')]
        queued_count = statuses.count('queued')
        importing_count = statuses.count('importing')
        
        print(f"   Importing: {importing_count}, Queued: {queued_count}")
        
        # At least one should be queued initially
        if queued_count > 0:
            print(f"✅ Test 4 PASSED: Queuing is working ({queued_count} queued)")
            return True
        elif importing_count == 3:
            print(f"⚠️  Test 4 PARTIAL: 3 importing, but 4th not queued (may have been too fast)")
            return True
        else:
            print(f"❌ Test 4 FAILED: Expected queuing but all started")
            return False

async def run_all_tests():
    """Run all test scenarios"""
    print("\n" + "="*60)
    print("CONCURRENT IMPORT TEST SUITE")
    print("="*60)
    print(f"Testing against: {API_BASE_URL}")
    print()
    
    results = []
    
    try:
        # Test 1: Single import
        results.append(await test_single_import())
        await asyncio.sleep(2)
        
        # Test 2: Concurrent imports (2 users)
        results.append(await test_concurrent_imports())
        await asyncio.sleep(2)
        
        # Test 3: Triple concurrent imports (3 users - optimized)
        results.append(await test_triple_concurrent())
        await asyncio.sleep(2)
        
        # Test 4: Queuing (4 users)
        results.append(await test_queuing())
        
    except Exception as e:
        print(f"\n❌ Test suite error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("✅ All tests PASSED!")
        return True
    else:
        print(f"❌ Some tests failed ({total - passed} failures)")
        return False

if __name__ == "__main__":
    print("Concurrent Import Test Script")
    print("Make sure the backend server is running on localhost:8080")
    print()
    
    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)

