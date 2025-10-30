#!/usr/bin/env python3
"""
Load testing script for Chess Analytics API
Tests the capacity to handle multiple concurrent users
"""

import asyncio
import aiohttp
import time
import random
import json
import os
from typing import List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
from statistics import mean, median, stdev


@dataclass
class TestResult:
    """Result of a single API call"""
    endpoint: str
    status: int
    duration_ms: float
    success: bool
    error: str = ""
    timestamp: float = field(default_factory=time.time)


@dataclass
class LoadTestConfig:
    """Configuration for load testing"""
    api_url: str
    auth_token: str
    num_users: int = 10
    duration_seconds: int = 300  # 5 minutes
    ramp_up_seconds: int = 30

    # Activity mix (percentages)
    analytics_percent: int = 40
    analysis_percent: int = 30
    import_percent: int = 20
    idle_percent: int = 10


class LoadTester:
    """Load testing orchestrator"""

    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.results: List[TestResult] = []
        self.active_users = 0
        self.start_time = None

    async def simulate_user(self, user_id: int, session: aiohttp.ClientSession):
        """Simulate a single user's activity"""
        headers = {"Authorization": f"Bearer {self.config.auth_token}"}

        while True:
            # Check if test is still running
            if self.start_time and (time.time() - self.start_time > self.config.duration_seconds):
                break

            # Choose activity based on mix
            activity = self._choose_activity()

            try:
                if activity == "analytics":
                    result = await self._call_analytics(session, headers, user_id)
                elif activity == "analysis":
                    result = await self._call_analysis(session, headers, user_id)
                elif activity == "import":
                    result = await self._call_import(session, headers, user_id)
                else:  # idle
                    await asyncio.sleep(random.uniform(5, 15))
                    continue

                self.results.append(result)

                # Wait between actions
                await asyncio.sleep(random.uniform(2, 8))

            except Exception as e:
                print(f"User {user_id} error: {e}")
                await asyncio.sleep(5)

    def _choose_activity(self) -> str:
        """Choose activity based on configured mix"""
        rand = random.randint(1, 100)
        if rand <= self.config.analytics_percent:
            return "analytics"
        elif rand <= self.config.analytics_percent + self.config.analysis_percent:
            return "analysis"
        elif rand <= self.config.analytics_percent + self.config.analysis_percent + self.config.import_percent:
            return "import"
        else:
            return "idle"

    async def _call_analytics(self, session: aiohttp.ClientSession, headers: dict, user_id: int) -> TestResult:
        """Call analytics endpoint"""
        start = time.time()
        endpoint = "/api/v1/analytics/comprehensive"

        # Use test users
        test_users = ["lakis5", "magnus", "hikaru", "testuser"]
        username = random.choice(test_users)
        platform = random.choice(["lichess", "chesscom"])

        url = f"{self.config.api_url}{endpoint}?username={username}&platform={platform}"

        try:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                duration_ms = (time.time() - start) * 1000
                await resp.text()  # Read response body

                return TestResult(
                    endpoint=endpoint,
                    status=resp.status,
                    duration_ms=duration_ms,
                    success=resp.status == 200
                )
        except asyncio.TimeoutError:
            return TestResult(
                endpoint=endpoint,
                status=504,
                duration_ms=(time.time() - start) * 1000,
                success=False,
                error="Timeout"
            )
        except Exception as e:
            return TestResult(
                endpoint=endpoint,
                status=500,
                duration_ms=(time.time() - start) * 1000,
                success=False,
                error=str(e)
            )

    async def _call_analysis(self, session: aiohttp.ClientSession, headers: dict, user_id: int) -> TestResult:
        """Call game analysis endpoint"""
        start = time.time()
        endpoint = "/api/v1/unified/analyze"

        # Sample PGN (short game)
        pgn = """[Event "Test Game"]
[Site "Load Test"]
[Date "2024.10.29"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6
8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 1-0"""

        payload = {
            "pgn": pgn,
            "user_id": f"loadtest_{user_id}",
            "platform": "lichess",
            "analysis_type": "deep"
        }

        url = f"{self.config.api_url}{endpoint}"

        try:
            async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                duration_ms = (time.time() - start) * 1000
                await resp.text()

                return TestResult(
                    endpoint=endpoint,
                    status=resp.status,
                    duration_ms=duration_ms,
                    success=resp.status in [200, 201]
                )
        except asyncio.TimeoutError:
            return TestResult(
                endpoint=endpoint,
                status=504,
                duration_ms=(time.time() - start) * 1000,
                success=False,
                error="Timeout"
            )
        except Exception as e:
            return TestResult(
                endpoint=endpoint,
                status=500,
                duration_ms=(time.time() - start) * 1000,
                success=False,
                error=str(e)
            )

    async def _call_import(self, session: aiohttp.ClientSession, headers: dict, user_id: int) -> TestResult:
        """Call import endpoint (simulated)"""
        start = time.time()
        endpoint = "/api/v1/import"

        # Small import for load testing
        payload = {
            "username": f"loadtest_{user_id}",
            "platform": random.choice(["lichess", "chesscom"]),
            "max_games": 10  # Small import
        }

        url = f"{self.config.api_url}{endpoint}"

        try:
            async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=120)) as resp:
                duration_ms = (time.time() - start) * 1000
                await resp.text()

                return TestResult(
                    endpoint=endpoint,
                    status=resp.status,
                    duration_ms=duration_ms,
                    success=resp.status in [200, 201, 202]
                )
        except asyncio.TimeoutError:
            return TestResult(
                endpoint=endpoint,
                status=504,
                duration_ms=(time.time() - start) * 1000,
                success=False,
                error="Timeout"
            )
        except Exception as e:
            return TestResult(
                endpoint=endpoint,
                status=500,
                duration_ms=(time.time() - start) * 1000,
                success=False,
                error=str(e)
            )

    async def run(self):
        """Run the load test"""
        print("=" * 80)
        print("CHESS ANALYTICS LOAD TEST")
        print("=" * 80)
        print(f"\nConfiguration:")
        print(f"  API URL: {self.config.api_url}")
        print(f"  Target Users: {self.config.num_users}")
        print(f"  Duration: {self.config.duration_seconds}s")
        print(f"  Ramp-up: {self.config.ramp_up_seconds}s")
        print(f"\nActivity Mix:")
        print(f"  Analytics: {self.config.analytics_percent}%")
        print(f"  Analysis: {self.config.analysis_percent}%")
        print(f"  Import: {self.config.import_percent}%")
        print(f"  Idle: {self.config.idle_percent}%")
        print("\n" + "=" * 80)

        self.start_time = time.time()

        # Create HTTP session
        connector = aiohttp.TCPConnector(limit=100)
        timeout = aiohttp.ClientTimeout(total=300)

        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            tasks = []

            # Ramp up users
            if self.config.ramp_up_seconds > 0:
                delay = self.config.ramp_up_seconds / self.config.num_users
                print(f"\nRamping up {self.config.num_users} users over {self.config.ramp_up_seconds}s...")

                for i in range(self.config.num_users):
                    task = asyncio.create_task(self.simulate_user(i, session))
                    tasks.append(task)
                    self.active_users += 1
                    print(f"  Started user {i+1}/{self.config.num_users}")
                    await asyncio.sleep(delay)
            else:
                # Start all users immediately
                print(f"\nStarting {self.config.num_users} users immediately...")
                for i in range(self.config.num_users):
                    task = asyncio.create_task(self.simulate_user(i, session))
                    tasks.append(task)
                    self.active_users += 1

            print(f"\n✅ All {self.active_users} users active")
            print(f"Running test for {self.config.duration_seconds}s...")

            # Wait for test duration
            await asyncio.sleep(self.config.duration_seconds)

            print("\n⏱️  Test duration reached, waiting for tasks to complete...")

            # Cancel all tasks
            for task in tasks:
                task.cancel()

            # Wait for tasks to finish
            await asyncio.gather(*tasks, return_exceptions=True)

        print("\n✅ Load test complete!\n")

        # Generate report
        self.generate_report()

    def generate_report(self):
        """Generate test report"""
        if not self.results:
            print("No results to report")
            return

        # Calculate statistics
        total_requests = len(self.results)
        successful_requests = sum(1 for r in self.results if r.success)
        failed_requests = total_requests - successful_requests

        # Response times
        durations = [r.duration_ms for r in self.results]
        avg_duration = mean(durations)
        median_duration = median(durations)
        p95_duration = sorted(durations)[int(len(durations) * 0.95)]
        p99_duration = sorted(durations)[int(len(durations) * 0.99)]

        # By endpoint
        by_endpoint: Dict[str, List[TestResult]] = {}
        for result in self.results:
            if result.endpoint not in by_endpoint:
                by_endpoint[result.endpoint] = []
            by_endpoint[result.endpoint].append(result)

        # Print report
        print("=" * 80)
        print("LOAD TEST RESULTS")
        print("=" * 80)

        print(f"\n📊 Overall Statistics:")
        print(f"  Total Requests: {total_requests}")
        print(f"  Successful: {successful_requests} ({successful_requests/total_requests*100:.1f}%)")
        print(f"  Failed: {failed_requests} ({failed_requests/total_requests*100:.1f}%)")
        print(f"  Duration: {self.config.duration_seconds}s")
        print(f"  Throughput: {total_requests/self.config.duration_seconds:.2f} req/s")

        print(f"\n⏱️  Response Times (all endpoints):")
        print(f"  Average: {avg_duration:.0f}ms")
        print(f"  Median: {median_duration:.0f}ms")
        print(f"  P95: {p95_duration:.0f}ms")
        print(f"  P99: {p99_duration:.0f}ms")

        print(f"\n📈 By Endpoint:")
        for endpoint, results in by_endpoint.items():
            success_rate = sum(1 for r in results if r.success) / len(results) * 100
            avg_time = mean([r.duration_ms for r in results])
            print(f"\n  {endpoint}:")
            print(f"    Requests: {len(results)}")
            print(f"    Success Rate: {success_rate:.1f}%")
            print(f"    Avg Response Time: {avg_time:.0f}ms")

        # Errors
        errors = [r for r in self.results if not r.success]
        if errors:
            print(f"\n❌ Errors ({len(errors)} total):")
            error_counts: Dict[str, int] = {}
            for error in errors:
                key = f"{error.status} - {error.error}"
                error_counts[key] = error_counts.get(key, 0) + 1

            for error_type, count in sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
                print(f"  {error_type}: {count}")

        print("\n" + "=" * 80)

        # Save detailed results
        report_file = f"load_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_data = {
            "config": {
                "num_users": self.config.num_users,
                "duration_seconds": self.config.duration_seconds,
                "ramp_up_seconds": self.config.ramp_up_seconds,
            },
            "summary": {
                "total_requests": total_requests,
                "successful_requests": successful_requests,
                "failed_requests": failed_requests,
                "success_rate": successful_requests / total_requests * 100,
                "throughput_rps": total_requests / self.config.duration_seconds,
                "avg_duration_ms": avg_duration,
                "median_duration_ms": median_duration,
                "p95_duration_ms": p95_duration,
                "p99_duration_ms": p99_duration,
            },
            "by_endpoint": {
                endpoint: {
                    "count": len(results),
                    "success_rate": sum(1 for r in results if r.success) / len(results) * 100,
                    "avg_duration_ms": mean([r.duration_ms for r in results]),
                }
                for endpoint, results in by_endpoint.items()
            }
        }

        with open(report_file, 'w') as f:
            json.dump(report_data, f, indent=2)

        print(f"\n💾 Detailed results saved to: {report_file}")


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Load test Chess Analytics API")
    parser.add_argument("--api-url", default=os.getenv("API_URL", "http://localhost:8002"), help="API URL")
    parser.add_argument("--token", default=os.getenv("AUTH_TOKEN", "test-token"), help="Auth token")
    parser.add_argument("--users", type=int, default=10, help="Number of concurrent users")
    parser.add_argument("--duration", type=int, default=300, help="Test duration in seconds")
    parser.add_argument("--ramp-up", type=int, default=30, help="Ramp-up time in seconds")

    # Preset scenarios
    parser.add_argument("--scenario", choices=["light", "moderate", "heavy", "spike"],
                       help="Pre-configured test scenario")

    args = parser.parse_args()

    # Apply scenario presets
    if args.scenario == "light":
        args.users = 10
        args.duration = 300
        args.ramp_up = 30
    elif args.scenario == "moderate":
        args.users = 25
        args.duration = 600
        args.ramp_up = 60
    elif args.scenario == "heavy":
        args.users = 50
        args.duration = 900
        args.ramp_up = 120
    elif args.scenario == "spike":
        args.users = 50
        args.duration = 300
        args.ramp_up = 10  # Fast ramp-up

    config = LoadTestConfig(
        api_url=args.api_url,
        auth_token=args.token,
        num_users=args.users,
        duration_seconds=args.duration,
        ramp_up_seconds=args.ramp_up
    )

    tester = LoadTester(config)
    await tester.run()


if __name__ == "__main__":
    asyncio.run(main())
