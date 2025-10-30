#!/usr/bin/env python3
"""
Real-time capacity monitoring for Chess Analytics API
Monitors current load, resource usage, and capacity metrics
"""

import asyncio
import aiohttp
import time
import os
from datetime import datetime
from typing import Optional


class CapacityMonitor:
    """Monitor API capacity and performance in real-time"""

    def __init__(self, api_url: str, auth_token: str, interval: int = 10):
        self.api_url = api_url
        self.auth_token = auth_token
        self.interval = interval
        self.headers = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}

    async def get_metrics(self, session: aiohttp.ClientSession) -> Optional[dict]:
        """Fetch current metrics from API"""
        try:
            url = f"{self.api_url}/api/v1/metrics/memory"
            async with session.get(url, headers=self.headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    try:
                        return await resp.json()
                    except (aiohttp.ContentTypeError, ValueError) as e:
                        print(f"❌ Metrics endpoint returned non-JSON payload: {e}")
                        return None
                else:
                    print(f"❌ API returned status {resp.status}")
                    return None
        except Exception as e:
            print(f"❌ Failed to fetch metrics: {e}")
            return None

    async def monitor(self, duration_seconds: Optional[int] = None):
        """Monitor capacity in real-time"""
        print("=" * 80)
        print("CHESS ANALYTICS CAPACITY MONITOR")
        print("=" * 80)
        print(f"API URL: {self.api_url}")
        print(f"Monitoring interval: {self.interval}s")
        if duration_seconds:
            print(f"Duration: {duration_seconds}s")
        else:
            print("Duration: Continuous (Ctrl+C to stop)")
        print("=" * 80)
        print()

        start_time = time.time()
        connector = aiohttp.TCPConnector(limit=10)

        # Track metrics over time
        memory_history = []
        cpu_history = []
        queue_history = []

        async with aiohttp.ClientSession(connector=connector) as session:
            try:
                while True:
                    # Check duration
                    if duration_seconds and (time.time() - start_time > duration_seconds):
                        break

                    # Fetch metrics
                    metrics = await self.get_metrics(session)

                    if metrics:
                        self.display_metrics(metrics)

                        # Track history
                        if 'memory' in metrics:
                            memory_history.append(metrics['memory'].get('percent', 0))

                        # Check for issues
                        self.check_alerts(metrics)
                    else:
                        print(f"⚠️  [{datetime.now().strftime('%H:%M:%S')}] Unable to fetch metrics")

                    # Wait for next interval
                    await asyncio.sleep(self.interval)

            except KeyboardInterrupt:
                print("\n\n⏹️  Monitoring stopped by user")

        # Print summary
        if memory_history:
            self.print_summary(memory_history, cpu_history, queue_history)

    def display_metrics(self, metrics: dict):
        """Display current metrics"""
        timestamp = datetime.now().strftime('%H:%M:%S')

        # Memory
        memory = metrics.get('memory', {})
        memory_mb = memory.get('used_mb', 0)
        memory_percent = memory.get('percent', 0)
        memory_baseline = memory.get('baseline_mb', 0)

        # Engine pool
        engine_pool = metrics.get('engine_pool', {})
        pool_size = engine_pool.get('size', 0)
        pool_in_use = engine_pool.get('in_use', 0)
        pool_available = engine_pool.get('available', 0)

        # Caches
        caches = metrics.get('caches', {})
        cache_stats = []
        for name, stats in caches.items():
            if isinstance(stats, dict):
                size = stats.get('size', 0)
                max_size = stats.get('maxsize', 0)
                hit_rate = stats.get('hit_rate', 0)
                cache_stats.append(f"{name}={size}/{max_size} ({hit_rate:.0f}% hits)")

        # Build status line
        memory_icon = self._get_memory_icon(memory_percent)
        pool_icon = self._get_pool_icon(pool_in_use, pool_size)

        print(f"[{timestamp}] {memory_icon} Memory: {memory_mb:.0f}MB ({memory_percent:.1f}%) | "
              f"Baseline: {memory_baseline:.0f}MB | "
              f"{pool_icon} Engines: {pool_in_use}/{pool_size} | "
              f"Caches: {len(caches)}")

        if cache_stats:
            print(f"           {', '.join(cache_stats[:3])}")  # Show first 3 caches

    def _get_memory_icon(self, percent: float) -> str:
        """Get icon for memory usage"""
        if percent < 50:
            return "✅"
        elif percent < 70:
            return "⚠️ "
        else:
            return "🔴"

    def _get_pool_icon(self, in_use: int, total: int) -> str:
        """Get icon for engine pool usage"""
        if total == 0:
            return "⚪"
        utilization = in_use / total
        if utilization < 0.7:
            return "✅"
        elif utilization < 0.9:
            return "⚠️ "
        else:
            return "🔴"

    def check_alerts(self, metrics: dict):
        """Check for alert conditions"""
        memory = metrics.get('memory', {})
        memory_percent = memory.get('percent', 0)

        engine_pool = metrics.get('engine_pool', {})
        pool_size = engine_pool.get('size', 0)
        pool_in_use = engine_pool.get('in_use', 0)

        # Memory alerts
        if memory_percent > 85:
            print(f"           🚨 CRITICAL: Memory usage at {memory_percent:.1f}%!")
        elif memory_percent > 70:
            print(f"           ⚠️  WARNING: Memory usage at {memory_percent:.1f}%")

        # Engine pool alerts
        if pool_size > 0 and pool_in_use == pool_size:
            print(f"           🚨 Engine pool exhausted! All {pool_size} engines in use")
        elif pool_size > 0 and pool_in_use / pool_size > 0.8:
            print(f"           ⚠️  Engine pool highly utilized: {pool_in_use}/{pool_size}")

        # Cache alerts
        caches = metrics.get('caches', {})
        for name, stats in caches.items():
            if isinstance(stats, dict):
                hit_rate = stats.get('hit_rate', 0)
                if hit_rate < 40 and stats.get('hits', 0) + stats.get('misses', 0) > 100:
                    print(f"           ⚠️  Low cache hit rate for {name}: {hit_rate:.0f}%")

    def print_summary(self, memory_history: list, cpu_history: list, queue_history: list):
        """Print monitoring summary"""
        print("\n" + "=" * 80)
        print("MONITORING SUMMARY")
        print("=" * 80)

        if memory_history:
            avg_memory = sum(memory_history) / len(memory_history)
            max_memory = max(memory_history)
            min_memory = min(memory_history)

            print(f"\n📊 Memory Usage:")
            print(f"  Average: {avg_memory:.1f}%")
            print(f"  Min: {min_memory:.1f}%")
            print(f"  Max: {max_memory:.1f}%")

            if max_memory > 85:
                print(f"  ⚠️  Peak memory exceeded 85% - consider scaling up")
            elif max_memory > 70:
                print(f"  ⚠️  Peak memory exceeded 70% - monitor closely")
            else:
                print(f"  ✅ Memory usage healthy")

        print("\n" + "=" * 80)


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Monitor Chess Analytics API capacity")
    parser.add_argument("--api-url", default=os.getenv("API_URL", "http://localhost:8002"),
                       help="API URL")
    parser.add_argument("--token", default=os.getenv("AUTH_TOKEN", ""),
                       help="Auth token")
    parser.add_argument("--interval", type=int, default=10,
                       help="Monitoring interval in seconds")
    parser.add_argument("--duration", type=int, default=None,
                       help="Monitoring duration in seconds (default: continuous)")

    args = parser.parse_args()

    if not args.token:
        print("⚠️  Warning: No auth token provided. Some endpoints may not be accessible.")
        print("   Set AUTH_TOKEN environment variable or use --token argument")

    monitor = CapacityMonitor(
        api_url=args.api_url,
        auth_token=args.token,
        interval=args.interval
    )

    await monitor.monitor(duration_seconds=args.duration)


if __name__ == "__main__":
    asyncio.run(main())
