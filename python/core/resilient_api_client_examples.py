#!/usr/bin/env python3
"""
Example usage and testing for the Resilient API Client

This script demonstrates how to use the resilient API client
and provides test scenarios to verify its behavior.
"""

import asyncio
import time
from python.core.resilient_api_client import ResilientAPIClient, get_api_client


async def example_basic_usage():
    """Example: Basic user validation"""
    print("\n" + "="*70)
    print("EXAMPLE 1: Basic User Validation")
    print("="*70)

    client = get_api_client()

    # Validate a Lichess user
    print("\n1. Validating Lichess user 'DrNykterstein'...")
    exists, message = await client.validate_lichess_user("DrNykterstein")
    print(f"   Result: exists={exists}, message={message}")

    # Validate a non-existent user
    print("\n2. Validating non-existent user 'gmud'...")
    exists, message = await client.validate_lichess_user("gmud")
    print(f"   Result: exists={exists}, message={message}")

    # Validate a Chess.com user
    print("\n3. Validating Chess.com user 'hikaru'...")
    exists, message = await client.validate_chesscom_user("hikaru")
    print(f"   Result: exists={exists}, message={message}")


async def example_caching():
    """Example: Demonstrate caching behavior"""
    print("\n" + "="*70)
    print("EXAMPLE 2: Caching Behavior")
    print("="*70)

    client = get_api_client()

    # First request - cache miss
    print("\n1. First request (cache miss)...")
    start = time.time()
    exists, message = await client.validate_lichess_user("DrNykterstein")
    elapsed = time.time() - start
    print(f"   Time: {elapsed:.3f}s")
    print(f"   Result: {message}")

    # Second request - cache hit
    print("\n2. Second request (cache hit)...")
    start = time.time()
    exists, message = await client.validate_lichess_user("DrNykterstein")
    elapsed = time.time() - start
    print(f"   Time: {elapsed:.3f}s (should be <10ms)")
    print(f"   Result: {message}")

    # Check stats
    stats = client.get_stats()
    print(f"\n3. Cache stats: {stats['cache_size']} entries cached")


async def example_request_deduplication():
    """Example: Demonstrate request deduplication"""
    print("\n" + "="*70)
    print("EXAMPLE 3: Request Deduplication")
    print("="*70)

    client = get_api_client()

    # Clear cache to ensure fresh test
    client.cache.clear()

    print("\n1. Sending 10 concurrent requests for same user...")
    start = time.time()

    # Send 10 concurrent requests for the same user
    tasks = [
        client.validate_lichess_user("DrNykterstein")
        for _ in range(10)
    ]
    results = await asyncio.gather(*tasks)

    elapsed = time.time() - start
    print(f"   Time: {elapsed:.3f}s")
    print(f"   Results: All {len(results)} requests succeeded")
    print(f"   Note: Only 1 API call was made, others waited for result")

    # Check stats
    stats = client.get_stats()
    print(f"\n2. Client stats after test:")
    print(f"   Pending requests during test: {stats['pending_requests']}")


async def example_rate_limiting():
    """Example: Demonstrate rate limiting"""
    print("\n" + "="*70)
    print("EXAMPLE 4: Rate Limiting")
    print("="*70)

    client = get_api_client()

    print("\n1. Initial token count:")
    stats = client.get_stats()
    print(f"   Lichess tokens: {stats['lichess_tokens']}")

    print("\n2. Sending 20 requests rapidly...")
    start = time.time()

    # Send 20 requests (will be rate limited)
    for i in range(20):
        username = f"user{i}"
        try:
            await client.validate_lichess_user(username)
        except Exception as e:
            print(f"   Request {i+1}: Rate limited")

    elapsed = time.time() - start
    print(f"\n3. Total time: {elapsed:.3f}s")
    print(f"   Note: Requests were automatically rate-limited")
    print(f"   Expected time: ~2.5s (20 requests at 8 req/s)")

    stats = client.get_stats()
    print(f"\n4. Final token count: {stats['lichess_tokens']}")


async def example_circuit_breaker():
    """Example: Demonstrate circuit breaker (conceptual)"""
    print("\n" + "="*70)
    print("EXAMPLE 5: Circuit Breaker (Conceptual)")
    print("="*70)

    client = get_api_client()

    print("\n1. Initial circuit state:")
    stats = client.get_stats()
    print(f"   Lichess: {stats['lichess_circuit']}")
    print(f"   Chess.com: {stats['chesscom_circuit']}")

    print("\n2. Circuit breaker behavior:")
    print("   • CLOSED: Normal operation, requests go through")
    print("   • After 5 failures: Opens circuit")
    print("   • OPEN: Fast-fail, reject requests immediately")
    print("   • After 60s: Moves to HALF_OPEN")
    print("   • HALF_OPEN: Test if service recovered")
    print("   • After 2 successes: Back to CLOSED")

    print("\n3. When circuit is OPEN:")
    print("   • Users get immediate error: 'temporarily unavailable'")
    print("   • No waiting for timeouts")
    print("   • Automatic recovery testing after timeout")


async def example_error_handling():
    """Example: Demonstrate error handling"""
    print("\n" + "="*70)
    print("EXAMPLE 6: Error Handling")
    print("="*70)

    client = get_api_client()

    # Non-existent user (404)
    print("\n1. Non-existent user (404)...")
    try:
        exists, message = await client.validate_lichess_user("this_user_definitely_does_not_exist_12345")
        print(f"   Result: exists={exists}")
        print(f"   Message: {message}")
    except Exception as e:
        print(f"   Error: {e}")

    # Invalid username format
    print("\n2. Invalid username format...")
    try:
        exists, message = await client.validate_lichess_user("")
        print(f"   Result: exists={exists}")
        print(f"   Message: {message}")
    except Exception as e:
        print(f"   Error: {e}")


async def example_monitoring():
    """Example: Monitor client statistics"""
    print("\n" + "="*70)
    print("EXAMPLE 7: Monitoring Client Statistics")
    print("="*70)

    client = get_api_client()

    # Make some requests
    await client.validate_lichess_user("DrNykterstein")
    await client.validate_lichess_user("penguingim1")
    await client.validate_chesscom_user("hikaru")

    # Get stats
    stats = client.get_stats()

    print("\nClient Statistics:")
    print(f"  Cache size: {stats['cache_size']} entries")
    print(f"  Pending requests: {stats['pending_requests']}")
    print(f"  Lichess circuit: {stats['lichess_circuit']}")
    print(f"  Chess.com circuit: {stats['chesscom_circuit']}")
    print(f"  Lichess tokens: {stats['lichess_tokens']:.2f}/16")
    print(f"  Chess.com tokens: {stats['chesscom_tokens']:.2f}/16")

    print("\nKey Metrics to Watch:")
    print("  • cache_size: Should grow during traffic")
    print("  • pending_requests: Shows deduplication in action")
    print("  • circuit states: Watch for 'open' indicating API issues")
    print("  • token counts: Low values mean rate limiting is active")


async def run_all_examples():
    """Run all examples"""
    print("\n" + "="*70)
    print("RESILIENT API CLIENT - USAGE EXAMPLES")
    print("="*70)

    try:
        await example_basic_usage()
        await example_caching()
        await example_request_deduplication()
        await example_rate_limiting()
        await example_circuit_breaker()
        await example_error_handling()
        await example_monitoring()

        print("\n" + "="*70)
        print("ALL EXAMPLES COMPLETED")
        print("="*70)

    except Exception as e:
        print(f"\nError running examples: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        from python.core.resilient_api_client import cleanup_api_client
        await cleanup_api_client()
        print("\nCleaned up API client")


async def test_validate_user_endpoint():
    """Test the actual API endpoint"""
    print("\n" + "="*70)
    print("TESTING /api/v1/validate-user ENDPOINT")
    print("="*70)

    import httpx

    base_url = "http://localhost:8000"  # Change to your API URL

    print("\n1. Testing valid Lichess user...")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/api/v1/validate-user",
            json={"user_id": "DrNykterstein", "platform": "lichess"}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")

    print("\n2. Testing invalid user...")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/api/v1/validate-user",
            json={"user_id": "gmud", "platform": "lichess"}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")

    print("\n3. Testing Chess.com user...")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/api/v1/validate-user",
            json={"user_id": "hikaru", "platform": "chess.com"}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")

    print("\n4. Checking API client stats...")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{base_url}/api/v1/api-client-stats")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")


if __name__ == "__main__":
    # Run examples
    print("\nRunning resilient API client examples...")
    print("Note: These examples demonstrate the client's capabilities")
    print("      Some examples may fail if run without API access\n")

    # Choose which example to run:
    # asyncio.run(run_all_examples())
    # asyncio.run(test_validate_user_endpoint())

    print("\nTo run examples, uncomment one of the asyncio.run() calls above")
    print("\nAvailable functions:")
    print("  • run_all_examples() - Run all examples")
    print("  • test_validate_user_endpoint() - Test the actual API endpoint")
    print("  • Individual example functions (see above)")
