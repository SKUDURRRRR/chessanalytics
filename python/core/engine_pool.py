#!/usr/bin/env python3
"""
Stockfish Engine Pool with TTL Management
Manages a pool of Stockfish engines with automatic cleanup of idle engines.

Security Features:
- Input validation
- Resource limits
- Safe error handling
- Graceful shutdown
"""

import asyncio
import time
import logging
import chess.engine
from typing import Optional
from contextlib import asynccontextmanager
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class EngineInfo:
    """Information about a pooled engine."""
    engine: chess.engine.SimpleEngine
    last_used: float
    in_use: bool = False


class StockfishEnginePool:
    """
    Thread-safe pool of Stockfish engines with TTL-based cleanup.

    Features:
    - Pool size limit (2-3 engines)
    - TTL-based eviction (5 minutes idle)
    - Async context manager for safe acquisition
    - Automatic cleanup of unused engines
    - Memory efficient

    Usage:
        pool = StockfishEnginePool(stockfish_path, max_size=3, ttl=300)

        async with pool.acquire() as engine:
            result = await engine.analyze(board, limit)
    """

    def __init__(
        self,
        stockfish_path: str,
        max_size: int = 4,  # Increased from 3 to 4 for Railway Pro
        ttl: float = 300.0,  # 5 minutes
        config: Optional[dict] = None
    ):
        """
        Initialize engine pool with validation.

        Args:
            stockfish_path: Path to Stockfish binary (must be non-empty)
            max_size: Maximum number of engines in pool (1-10)
            ttl: Time-to-live for idle engines in seconds (must be positive)
            config: Engine configuration dict

        Raises:
            ValueError: If parameters are invalid
        """
        # Input validation
        if not stockfish_path or not isinstance(stockfish_path, str) or not stockfish_path.strip():
            raise ValueError("stockfish_path must be a non-empty string")
        if not isinstance(max_size, int) or max_size < 1 or max_size > 10:
            raise ValueError("max_size must be between 1 and 10")
        if not isinstance(ttl, (int, float)) or ttl <= 0:
            raise ValueError("ttl must be a positive number")

        self.stockfish_path = stockfish_path.strip()
        self.max_size = max_size
        self.ttl = ttl
        self.config = config or {
            'Skill Level': 20,
            'UCI_LimitStrength': False,
            'Threads': 1,
            'Hash': 96
        }

        self._pool: list[EngineInfo] = []
        self._lock = asyncio.Lock()
        self._total_created = 0
        self._total_destroyed = 0
        self._cleanup_task: Optional[asyncio.Task] = None
        self._is_shutting_down = False  # Flag to prevent new engines during shutdown

        logger.info(f"Initialized StockfishEnginePool (max_size={max_size}, ttl={ttl}s)")

    async def _create_engine(self) -> chess.engine.SimpleEngine:
        """Create a new Stockfish engine instance with error handling."""
        try:
            engine = chess.engine.SimpleEngine.popen_uci(self.stockfish_path)

            # Configure engine
            try:
                engine.configure(self.config)
            except Exception as e:
                logger.warning(f"Could not configure engine: {e}")

            self._total_created += 1
            logger.debug(f"Created new engine (total created: {self._total_created})")
            return engine

        except FileNotFoundError:
            logger.error(f"Stockfish binary not found at: {self.stockfish_path}")
            raise ValueError(f"Stockfish binary not found: {self.stockfish_path}")
        except Exception as e:
            logger.error(f"Error creating engine: {e}")
            raise

    async def _destroy_engine(self, engine_info: EngineInfo) -> None:
        """Safely destroy an engine instance."""
        try:
            if engine_info.engine:
                engine_info.engine.quit()
                self._total_destroyed += 1
                logger.debug(f"Destroyed idle engine (total destroyed: {self._total_destroyed})")
        except Exception as e:
            logger.error(f"Error destroying engine: {e}")

    @asynccontextmanager
    async def acquire(self):
        """
        Acquire an engine from the pool.

        Usage:
            async with pool.acquire() as engine:
                result = await engine.analyze(board, limit)

        Yields:
            chess.engine.SimpleEngine: Engine instance

        Raises:
            RuntimeError: If pool is shutting down
        """
        engine_info = None

        async with self._lock:
            # Prevent new engine creation during shutdown
            if self._is_shutting_down:
                raise RuntimeError("Engine pool is shutting down, cannot acquire new engines")

            # Try to find an available engine
            for info in self._pool:
                if not info.in_use:
                    info.in_use = True
                    info.last_used = time.time()
                    engine_info = info
                    break

            # Create new engine if none available and under limit
            if engine_info is None and len(self._pool) < self.max_size:
                engine = await self._create_engine()
                engine_info = EngineInfo(
                    engine=engine,
                    last_used=time.time(),
                    in_use=True
                )
                self._pool.append(engine_info)

            # Wait for available engine if at capacity
            if engine_info is None:
                logger.warning(f"Pool at capacity ({self.max_size}), waiting for engine...")

        # Wait loop if no engine available
        while engine_info is None:
            await asyncio.sleep(0.1)
            async with self._lock:
                # Check shutdown flag even while waiting
                if self._is_shutting_down:
                    raise RuntimeError("Engine pool is shutting down, cannot acquire new engines")

                for info in self._pool:
                    if not info.in_use:
                        info.in_use = True
                        info.last_used = time.time()
                        engine_info = info
                        break

        try:
            yield engine_info.engine
        finally:
            # Release engine back to pool
            async with self._lock:
                engine_info.in_use = False
                engine_info.last_used = time.time()

    async def cleanup_idle_engines(self) -> int:
        """
        Remove engines that have been idle longer than TTL.

        Returns:
            Number of engines destroyed
        """
        destroyed_count = 0
        now = time.time()

        async with self._lock:
            # Find idle engines past TTL
            engines_to_remove = []
            for info in self._pool:
                if not info.in_use and (now - info.last_used) > self.ttl:
                    engines_to_remove.append(info)

            # Destroy and remove them
            for info in engines_to_remove:
                await self._destroy_engine(info)
                self._pool.remove(info)
                destroyed_count += 1

        if destroyed_count > 0:
            logger.info(f"Cleaned up {destroyed_count} idle engines")

        return destroyed_count

    async def start_cleanup_task(self) -> None:
        """Start background task for periodic cleanup."""
        if self._cleanup_task is not None:
            return

        async def cleanup_loop():
            logger.info(f"Starting cleanup task (interval: 60s, TTL: {self.ttl}s)")
            while True:
                try:
                    await asyncio.sleep(60)  # Check every 60 seconds
                    await self.cleanup_idle_engines()
                except asyncio.CancelledError:
                    logger.info("Cleanup task cancelled")
                    break
                except Exception as e:
                    logger.error(f"Error in cleanup task: {e}")

        self._cleanup_task = asyncio.create_task(cleanup_loop())

    async def stop_cleanup_task(self) -> None:
        """Stop background cleanup task."""
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

    async def close_all(self) -> None:
        """
        Close all engines in the pool.

        Waits for engines that are currently in use to be released before destroying them.
        This prevents EngineTerminatedError and corrupted results.

        Fixed: Re-computes engine list inside the loop to catch newly created engines
        during shutdown, preventing resource leaks.
        """
        # Set shutdown flag to prevent new engine creation
        async with self._lock:
            self._is_shutting_down = True
            logger.info("Engine pool shutdown initiated - no new engines will be created")

        # Wait for active engines to be released (with timeout)
        max_wait = 30.0  # 30 seconds timeout
        start_time = time.time()

        while True:
            async with self._lock:
                # Re-snapshot the pool each iteration to catch newly created engines
                # This prevents leaking engines that were created while close_all()
                # was waiting for busy engines to be released
                engines = list(self._pool)
                busy = [info for info in engines if info.in_use]

                if not busy:
                    # All engines are free, destroy them
                    for info in engines:
                        await self._destroy_engine(info)
                    self._pool.clear()
                    break

                # Check timeout
                if time.time() - start_time > max_wait:
                    logger.warning(f"Timeout waiting for {len(busy)} engines to be released")
                    # Force destroy remaining engines (including any created during shutdown)
                    for info in engines:
                        await self._destroy_engine(info)
                    self._pool.clear()
                    break

            # Wait a bit before checking again
            await asyncio.sleep(0.1)

        logger.info(f"Closed all engines (created: {self._total_created}, destroyed: {self._total_destroyed})")

    def stats(self) -> dict:
        """
        Get pool statistics.

        Returns:
            Dictionary with pool stats
        """
        return {
            "pool_size": len(self._pool),
            "max_size": self.max_size,
            "in_use": sum(1 for info in self._pool if info.in_use),
            "available": sum(1 for info in self._pool if not info.in_use),
            "total_created": self._total_created,
            "total_destroyed": self._total_destroyed,
            "ttl": self.ttl
        }

    def __repr__(self) -> str:
        stats = self.stats()
        return (
            f"StockfishEnginePool(size={stats['pool_size']}/{stats['max_size']}, "
            f"in_use={stats['in_use']}, available={stats['available']})"
        )


# Global engine pool instance
_engine_pool: Optional[StockfishEnginePool] = None


def get_engine_pool(
    stockfish_path: str,
    max_size: int = 3,
    ttl: float = 300.0,
    config: Optional[dict] = None
) -> StockfishEnginePool:
    """
    Get or create global engine pool with validation.

    Args:
        stockfish_path: Path to Stockfish binary (must be non-empty)
        max_size: Maximum pool size (1-10)
        ttl: Engine idle TTL (must be positive)
        config: Engine configuration

    Returns:
        StockfishEnginePool instance

    Raises:
        ValueError: If parameters are invalid
    """
    global _engine_pool

    if _engine_pool is None:
        _engine_pool = StockfishEnginePool(
            stockfish_path=stockfish_path,
            max_size=max_size,
            ttl=ttl,
            config=config
        )
        logger.info(f"Initialized global pool (max_size={max_size}, ttl={ttl}s)")

    return _engine_pool


async def close_global_engine_pool() -> None:
    """Close the global engine pool."""
    global _engine_pool

    if _engine_pool is not None:
        await _engine_pool.stop_cleanup_task()
        await _engine_pool.close_all()
        _engine_pool = None
        logger.info("Closed global pool")
