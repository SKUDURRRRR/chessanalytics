#!/usr/bin/env python3
"""
Memory Monitoring System
Monitors memory usage and provides alerts/metrics.
"""

import asyncio
import time
import psutil
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class MemorySnapshot:
    """Snapshot of memory usage at a point in time."""
    timestamp: float
    total_mb: float
    used_mb: float
    available_mb: float
    percent: float
    process_mb: float

    def __str__(self) -> str:
        return (
            f"Memory: {self.used_mb:.0f}MB / {self.total_mb:.0f}MB ({self.percent:.1f}%) "
            f"| Process: {self.process_mb:.0f}MB"
        )


class MemoryMonitor:
    """
    Background memory monitoring with alerts and statistics.

    Features:
    - Periodic memory checks (60 seconds)
    - Warning alerts at 70% usage
    - Critical alerts at 85% usage
    - Memory trend tracking
    - Metrics endpoint data

    Usage:
        monitor = MemoryMonitor(interval=60, warning_threshold=0.70)
        await monitor.start()
        stats = monitor.get_stats()
        await monitor.stop()
    """

    def __init__(
        self,
        interval: float = 60.0,
        warning_threshold: float = 0.70,
        critical_threshold: float = 0.85,
        max_snapshots: int = 60  # Keep 1 hour of history (at 60s interval)
    ):
        """
        Initialize memory monitor.

        Args:
            interval: Check interval in seconds
            warning_threshold: Warn when memory exceeds this percentage
            critical_threshold: Critical alert at this percentage
            max_snapshots: Maximum history snapshots to keep
        """
        self.interval = interval
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold
        self.max_snapshots = max_snapshots

        self._task: Optional[asyncio.Task] = None
        self._process = psutil.Process()
        self._snapshots: list[MemorySnapshot] = []
        self._baseline: Optional[MemorySnapshot] = None
        self._peak: Optional[MemorySnapshot] = None
        self._warning_count = 0
        self._critical_count = 0

    def _take_snapshot(self) -> MemorySnapshot:
        """Take a memory snapshot."""
        vm = psutil.virtual_memory()
        process_info = self._process.memory_info()

        return MemorySnapshot(
            timestamp=time.time(),
            total_mb=vm.total / (1024 * 1024),
            used_mb=vm.used / (1024 * 1024),
            available_mb=vm.available / (1024 * 1024),
            percent=vm.percent,
            process_mb=process_info.rss / (1024 * 1024)
        )

    async def start(self) -> None:
        """Start monitoring background task."""
        if self._task is not None:
            return

        # Reset monitoring state for a fresh start
        self._snapshots.clear()
        self._warning_count = 0
        self._critical_count = 0
        self._peak = None

        # Take baseline snapshot
        self._baseline = self._take_snapshot()
        print(f"[MEMORY] Baseline: {self._baseline}")

        async def monitor_loop():
            print(f"[MEMORY] Starting monitor (interval: {self.interval}s, warning: {self.warning_threshold*100}%, critical: {self.critical_threshold*100}%)")

            while True:
                try:
                    await asyncio.sleep(self.interval)

                    # Take snapshot
                    snapshot = self._take_snapshot()
                    self._snapshots.append(snapshot)

                    # Trim history
                    if len(self._snapshots) > self.max_snapshots:
                        self._snapshots.pop(0)

                    # Update peak
                    if self._peak is None or snapshot.process_mb > self._peak.process_mb:
                        self._peak = snapshot

                    # Check thresholds
                    usage_ratio = snapshot.percent / 100.0

                    if usage_ratio >= self.critical_threshold:
                        self._critical_count += 1
                        print(f"[MEMORY] 🔴 CRITICAL: {snapshot}")
                    elif usage_ratio >= self.warning_threshold:
                        self._warning_count += 1
                        print(f"[MEMORY] ⚠️  WARNING: {snapshot}")
                    else:
                        # Log periodically even when healthy (every 10 minutes)
                        if len(self._snapshots) % 10 == 0:
                            print(f"[MEMORY] ✅ Healthy: {snapshot}")

                except asyncio.CancelledError:
                    print("[MEMORY] Monitor task cancelled")
                    break
                except Exception as e:
                    print(f"[MEMORY] Error in monitor: {e}")

        self._task = asyncio.create_task(monitor_loop())

    async def stop(self) -> None:
        """Stop monitoring task."""
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        # Final snapshot
        final = self._take_snapshot()
        print(f"[MEMORY] Final snapshot: {final}")
        print(f"[MEMORY] Peak process memory: {self._peak.process_mb:.0f}MB" if self._peak else "")
        print(f"[MEMORY] Warnings: {self._warning_count}, Critical: {self._critical_count}")

    def get_current(self) -> MemorySnapshot:
        """Get current memory snapshot."""
        return self._take_snapshot()

    def get_stats(self) -> dict:
        """
        Get memory statistics.

        Returns:
            Dictionary with memory stats and trends
        """
        current = self._take_snapshot()

        # Calculate average from recent snapshots
        if self._snapshots:
            avg_process_mb = sum(s.process_mb for s in self._snapshots) / len(self._snapshots)
            avg_percent = sum(s.percent for s in self._snapshots) / len(self._snapshots)
        else:
            avg_process_mb = current.process_mb
            avg_percent = current.percent

        stats = {
            "current": {
                "total_mb": current.total_mb,
                "used_mb": current.used_mb,
                "available_mb": current.available_mb,
                "percent": current.percent,
                "process_mb": current.process_mb
            },
            "baseline": {
                "process_mb": self._baseline.process_mb if self._baseline else 0,
                "percent": self._baseline.percent if self._baseline else 0
            } if self._baseline else None,
            "peak": {
                "process_mb": self._peak.process_mb if self._peak else 0,
                "percent": self._peak.percent if self._peak else 0,
                "timestamp": self._peak.timestamp if self._peak else 0
            } if self._peak else None,
            "average": {
                "process_mb": avg_process_mb,
                "percent": avg_percent
            },
            "trends": {
                "memory_growth_mb": (current.process_mb - self._baseline.process_mb) if self._baseline else 0,
                "warning_count": self._warning_count,
                "critical_count": self._critical_count
            },
            "history_size": len(self._snapshots),
            "monitoring_seconds": (current.timestamp - self._baseline.timestamp) if self._baseline else 0
        }

        return stats

    def get_process_memory_mb(self) -> float:
        """Get current process memory usage in MB."""
        return self._process.memory_info().rss / (1024 * 1024)

    def __repr__(self) -> str:
        current = self._take_snapshot()
        return f"MemoryMonitor(process={current.process_mb:.0f}MB, system={current.percent:.1f}%)"


# Global monitor instance
_memory_monitor: Optional[MemoryMonitor] = None


def get_memory_monitor(
    interval: float = 60.0,
    warning_threshold: float = 0.70,
    critical_threshold: float = 0.85
) -> MemoryMonitor:
    """
    Get or create global memory monitor.

    Args:
        interval: Monitoring interval in seconds
        warning_threshold: Warning threshold (0.0-1.0)
        critical_threshold: Critical threshold (0.0-1.0)

    Returns:
        MemoryMonitor instance
    """
    global _memory_monitor

    if _memory_monitor is None:
        _memory_monitor = MemoryMonitor(
            interval=interval,
            warning_threshold=warning_threshold,
            critical_threshold=critical_threshold
        )
        print(f"[MEMORY] Initialized global monitor (interval={interval}s)")

    return _memory_monitor


async def stop_memory_monitor() -> None:
    """Stop the global memory monitor."""
    global _memory_monitor

    if _memory_monitor is not None:
        await _memory_monitor.stop()
        _memory_monitor = None
