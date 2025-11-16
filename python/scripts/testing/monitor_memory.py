#!/usr/bin/env python3
"""
Automated Memory Monitoring Dashboard
Continuously monitors your Chess Analytics app and alerts on issues.

Usage:
    python monitor_memory.py --url https://your-api.railway.app
    python monitor_memory.py --url https://your-api.railway.app --interval 300  # Check every 5 min
    python monitor_memory.py --url https://your-api.railway.app --webhook https://discord.webhook.url
"""

import requests
import time
import argparse
import json
from datetime import datetime
from typing import Optional, Dict, Any

class MemoryMonitor:
    """Automated monitoring for Chess Analytics memory optimization."""

    def __init__(
        self,
        api_url: str,
        interval: int = 300,  # 5 minutes
        webhook_url: Optional[str] = None
    ):
        self.api_url = api_url.rstrip('/')
        self.interval = interval
        self.webhook_url = webhook_url

        # Thresholds
        self.baseline_threshold = 500  # MB
        self.warning_threshold = 800   # MB
        self.critical_threshold = 1200 # MB
        self.cache_hit_rate_min = 0.40 # 40%

        # State tracking
        self.baseline_memory = None
        self.alert_counts = {
            'high_memory': 0,
            'low_hit_rate': 0,
            'engines_stuck': 0
        }

        print("🔍 Chess Analytics Memory Monitor Starting...")
        print(f"   API URL: {self.api_url}")
        print(f"   Check Interval: {self.interval}s ({self.interval/60:.1f} minutes)")
        print(f"   Webhook: {'✅ Enabled' if self.webhook_url else '❌ Disabled'}")
        print("-" * 80)

    def fetch_metrics(self) -> Optional[Dict[str, Any]]:
        """Fetch memory metrics from API."""
        try:
            response = requests.get(
                f"{self.api_url}/api/v1/metrics/memory",
                timeout=10
            )

            if response.status_code == 200:
                try:
                    return response.json()
                except ValueError as exc:
                    print(f"❌ Invalid metrics payload: {exc}")
                    return None
            else:
                print(f"❌ API returned status {response.status_code}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to fetch metrics: {e}")
            return None

    def check_health(self) -> Optional[Dict[str, Any]]:
        """Check if API is healthy."""
        try:
            response = requests.get(
                f"{self.api_url}/health",
                timeout=5
            )
            if response.status_code == 200:
                return response.json()
            return None
        except requests.exceptions.RequestException as exc:
            print(f"❌ Health check request failed: {exc}")
            return None
        except ValueError as exc:
            print(f"❌ Invalid health payload: {exc}")
            return None

    def analyze_metrics(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze metrics and detect issues."""
        issues = []
        warnings = []
        stats = {}

        if not data.get('success'):
            issues.append("⚠️ Metrics endpoint returned error")
            return {'status': 'error', 'issues': issues, 'warnings': warnings, 'stats': stats}

        memory = data.get('memory', {})
        caches = data.get('caches', [])
        engine_pool = data.get('engine_pool', {})

        # Extract current memory
        current_memory = memory.get('current', {})
        process_mb = current_memory.get('process_mb', 0)
        percent = current_memory.get('percent', 0)

        # Set baseline on first run
        if self.baseline_memory is None:
            self.baseline_memory = process_mb
            print(f"📊 Baseline memory set: {process_mb:.0f} MB")

        stats = {
            'process_mb': process_mb,
            'system_percent': percent,
            'baseline_mb': self.baseline_memory,
            'growth_mb': process_mb - self.baseline_memory if self.baseline_memory else 0
        }

        # Check 1: High baseline memory
        if process_mb > self.baseline_threshold:
            issues.append(f"🔴 High baseline memory: {process_mb:.0f} MB (expected < {self.baseline_threshold} MB)")
            self.alert_counts['high_memory'] += 1

        # Check 2: Critical memory usage
        if process_mb > self.critical_threshold:
            issues.append(f"🚨 CRITICAL: Memory at {process_mb:.0f} MB (threshold: {self.critical_threshold} MB)")
        elif process_mb > self.warning_threshold:
            warnings.append(f"⚠️  Warning: Memory at {process_mb:.0f} MB (threshold: {self.warning_threshold} MB)")

        # Check 3: Memory growth trend
        if self.baseline_memory and stats['growth_mb'] > 300:
            issues.append(f"📈 Memory leak suspected: grew {stats['growth_mb']:.0f} MB from baseline")

        # Check 4: Cache hit rates
        for cache in caches:
            cache_name = cache.get('name', 'unknown')
            hit_rate = cache.get('hit_rate', 0)
            size = cache.get('size', 0)
            maxsize = cache.get('maxsize', 0)

            if hit_rate < self.cache_hit_rate_min and cache.get('hits', 0) > 100:
                warnings.append(f"📉 Low cache hit rate for {cache_name}: {hit_rate*100:.1f}%")
                self.alert_counts['low_hit_rate'] += 1

            # Check if cache is full (might need larger size)
            if maxsize and size >= maxsize * 0.95:
                warnings.append(f"💾 Cache {cache_name} nearly full: {size}/{maxsize}")

        # Check 5: Engine pool stuck
        pool_size = engine_pool.get('pool_size', 0)
        in_use = engine_pool.get('in_use', 0)
        max_size = engine_pool.get('max_size', 3)

        if pool_size == max_size and in_use == 0:
            warnings.append(f"🔧 Engine pool at capacity but none in use (possible stuck engines)")
            self.alert_counts['engines_stuck'] += 1

        stats['cache_stats'] = caches
        stats['engine_pool'] = engine_pool

        # Determine overall status
        if issues:
            status = 'critical' if any('CRITICAL' in i for i in issues) else 'warning'
        elif warnings:
            status = 'warning'
        else:
            status = 'healthy'

        return {
            'status': status,
            'issues': issues,
            'warnings': warnings,
            'stats': stats
        }

    def send_alert(self, analysis: Dict[str, Any]):
        """Send alert to webhook if configured."""
        if not self.webhook_url:
            return

        status = analysis['status']
        issues = analysis['issues']
        warnings = analysis['warnings']

        if status == 'healthy':
            return  # Don't spam on healthy status

        # Build alert message
        color = {
            'healthy': 0x00FF00,
            'warning': 0xFFA500,
            'critical': 0xFF0000,
            'error': 0x808080
        }.get(status, 0x808080)

        stats = analysis.get('stats', {})

        embed = {
            "title": f"🔍 Memory Monitor Alert - {status.upper()}",
            "color": color,
            "fields": [
                {
                    "name": "Process Memory",
                    "value": f"{stats.get('process_mb', 0):.0f} MB",
                    "inline": True
                },
                {
                    "name": "Baseline",
                    "value": f"{stats.get('baseline_mb', 0):.0f} MB",
                    "inline": True
                },
                {
                    "name": "Growth",
                    "value": f"+{stats.get('growth_mb', 0):.0f} MB",
                    "inline": True
                }
            ],
            "timestamp": datetime.utcnow().isoformat()
        }

        if issues:
            embed['fields'].append({
                "name": "🔴 Issues",
                "value": "\n".join(issues),
                "inline": False
            })

        if warnings:
            embed['fields'].append({
                "name": "⚠️ Warnings",
                "value": "\n".join(warnings),
                "inline": False
            })

        try:
            response = requests.post(
                self.webhook_url,
                json={"embeds": [embed]},
                timeout=5
            )
            if response.status_code != 204:
                print(f"❌ Webhook failed: {response.status_code}")
        except requests.exceptions.RequestException as exc:
            print(f"❌ Failed to send webhook: {exc}")

    def print_status(self, analysis: Dict[str, Any]):
        """Print current status to console."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        status = analysis['status']
        stats = analysis.get('stats', {})

        # Status emoji
        status_emoji = {
            'healthy': '✅',
            'warning': '⚠️',
            'critical': '🔴',
            'error': '❌'
        }.get(status, '❓')

        print(f"\n[{timestamp}] {status_emoji} Status: {status.upper()}")
        print(f"   Memory: {stats.get('process_mb', 0):.0f} MB (baseline: {stats.get('baseline_mb', 0):.0f} MB, growth: +{stats.get('growth_mb', 0):.0f} MB)")
        print(f"   System: {stats.get('system_percent', 0):.1f}%")

        # Cache stats
        cache_stats = stats.get('cache_stats', [])
        if cache_stats:
            print("   Caches:")
            for cache in cache_stats:
                name = cache.get('name', 'unknown')
                size = cache.get('size', 0)
                hit_rate = cache.get('hit_rate', 0)
                print(f"      - {name}: {size} entries, {hit_rate*100:.1f}% hit rate")

        # Engine pool
        engine_pool = stats.get('engine_pool', {})
        if engine_pool:
            pool_size = engine_pool.get('pool_size', 0)
            in_use = engine_pool.get('in_use', 0)
            available = engine_pool.get('available', 0)
            print(f"   Engine Pool: {pool_size} total ({in_use} in use, {available} available)")

        # Issues and warnings
        if analysis.get('issues'):
            print("   🔴 Issues:")
            for issue in analysis['issues']:
                print(f"      {issue}")

        if analysis.get('warnings'):
            print("   ⚠️  Warnings:")
            for warning in analysis['warnings']:
                print(f"      {warning}")

        print("-" * 80)

    def generate_report(self) -> str:
        """Generate summary report."""
        report = [
            "\n" + "=" * 80,
            "📊 MONITORING REPORT",
            "=" * 80,
            "Total Alerts:",
            f"   High Memory: {self.alert_counts['high_memory']}",
            f"   Low Hit Rate: {self.alert_counts['low_hit_rate']}",
            f"   Engines Stuck: {self.alert_counts['engines_stuck']}",
            "=" * 80
        ]
        return "\n".join(report)

    def run(self):
        """Run monitoring loop."""
        print(f"✅ Monitor started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("Press Ctrl+C to stop\n")

        try:
            while True:
                # Check health first
                health = self.check_health()
                if not health:
                    print(f"❌ API health check failed - is server running?")
                    time.sleep(60)
                    continue

                # Fetch and analyze metrics
                data = self.fetch_metrics()
                if data:
                    analysis = self.analyze_metrics(data)
                    self.print_status(analysis)

                    # Send alerts if needed
                    if analysis['status'] in ['warning', 'critical']:
                        self.send_alert(analysis)

                # Wait for next check
                time.sleep(self.interval)

        except KeyboardInterrupt:
            print(f"\n\n🛑 Monitor stopped at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(self.generate_report())

def main():
    parser = argparse.ArgumentParser(
        description="Automated memory monitoring for Chess Analytics"
    )
    parser.add_argument(
        '--url',
        required=True,
        help='API URL (e.g., https://your-api.railway.app)'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=300,
        help='Check interval in seconds (default: 300 = 5 minutes)'
    )
    parser.add_argument(
        '--webhook',
        help='Discord/Slack webhook URL for alerts (optional)'
    )

    args = parser.parse_args()

    monitor = MemoryMonitor(
        api_url=args.url,
        interval=args.interval,
        webhook_url=args.webhook
    )

    monitor.run()

if __name__ == '__main__':
    main()
