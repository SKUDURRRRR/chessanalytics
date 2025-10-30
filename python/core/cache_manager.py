#!/usr/bin/env python3
"""
LRU Cache Manager with TTL Support
Provides memory-bounded caches with automatic eviction.

Security Features:
- Thread-safe operations with RLock
- Input validation
- Safe error handling
"""

import time
import threading
import logging
from collections import OrderedDict
from typing import Any, Optional, Tuple, Callable

logger = logging.getLogger(__name__)


class LRUCache:
    """
    Thread-safe LRU (Least Recently Used) cache with TTL support.

    Features:
    - Maximum size limit (oldest entries evicted first)
    - Time-to-live (TTL) expiration
    - Thread-safe operations
    - Memory efficient

    Usage:
        cache = LRUCache(maxsize=1000, ttl=300)  # 1000 items, 5 min TTL
        cache.set("key", "value")
        value = cache.get("key")
        cache.clear()
    """

    def __init__(self, maxsize: int = 1000, ttl: Optional[float] = None, name: str = "cache"):
        """
        Initialize LRU cache with validation.

        Args:
            maxsize: Maximum number of entries (default 1000, min 1, max 1000000)
            ttl: Time-to-live in seconds (None = no expiration, must be positive if set)
            name: Cache name for logging

        Raises:
            ValueError: If parameters are invalid
        """
        if not isinstance(maxsize, int) or maxsize < 1:
            raise ValueError("maxsize must be a positive integer")
        if maxsize > 1000000:
            raise ValueError("maxsize cannot exceed 1,000,000 (memory safety)")
        if ttl is not None and (not isinstance(ttl, (int, float)) or ttl <= 0):
            raise ValueError("ttl must be a positive number")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("name must be a non-empty string")

        self.maxsize = maxsize
        self.ttl = ttl
        self.name = name.strip()
        self._cache: OrderedDict[str, Tuple[Any, float]] = OrderedDict()
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0

        logger.debug(f"Initialized LRU cache '{self.name}' with maxsize={maxsize}, ttl={ttl}")

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get value from cache with validation.

        Args:
            key: Cache key (must be non-empty string)
            default: Default value if not found

        Returns:
            Cached value or default

        Raises:
            ValueError: If key is invalid
        """
        if not isinstance(key, str) or not key:
            raise ValueError("key must be a non-empty string")

        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return default

            value, timestamp = self._cache[key]

            # Check TTL expiration
            if self.ttl is not None and time.time() - timestamp > self.ttl:
                del self._cache[key]
                self._misses += 1
                return default

            # Move to end (mark as recently used)
            self._cache.move_to_end(key)
            self._hits += 1
            return value

    def set(self, key: str, value: Any) -> None:
        """
        Set value in cache with validation.

        Args:
            key: Cache key (must be non-empty string)
            value: Value to cache

        Raises:
            ValueError: If key is invalid
        """
        if not isinstance(key, str) or not key:
            raise ValueError("key must be a non-empty string")

        with self._lock:
            timestamp = time.time()

            # Update existing key
            if key in self._cache:
                self._cache[key] = (value, timestamp)
                self._cache.move_to_end(key)
                return

            # Add new key
            self._cache[key] = (value, timestamp)

            # Evict oldest if over size limit
            if len(self._cache) > self.maxsize:
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]

    def delete(self, key: str) -> bool:
        """
        Delete key from cache.

        Args:
            key: Cache key

        Returns:
            True if key existed, False otherwise
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self) -> int:
        """
        Clear all entries from cache.

        Returns:
            Number of entries cleared
        """
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            return count

    def cleanup_expired(self) -> int:
        """
        Remove all expired entries.

        Returns:
            Number of entries removed
        """
        if self.ttl is None:
            return 0

        with self._lock:
            now = time.time()
            expired_keys = [
                key for key, (_, timestamp) in self._cache.items()
                if now - timestamp > self.ttl
            ]

            for key in expired_keys:
                del self._cache[key]

            return len(expired_keys)

    def size(self) -> int:
        """Get current number of entries."""
        with self._lock:
            return len(self._cache)

    def stats(self) -> dict:
        """
        Get cache statistics.

        Returns:
            Dictionary with hits, misses, size, hit_rate
        """
        with self._lock:
            total = self._hits + self._misses
            hit_rate = self._hits / total if total > 0 else 0.0

            return {
                "name": self.name,
                "size": len(self._cache),
                "maxsize": self.maxsize,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": hit_rate,
                "ttl": self.ttl
            }

    def reset_stats(self) -> None:
        """Reset hit/miss counters."""
        with self._lock:
            self._hits = 0
            self._misses = 0


class TTLDict:
    """
    Simple dictionary with TTL expiration.
    Lighter weight than LRUCache when you don't need LRU eviction.
    """

    def __init__(self, ttl: float, name: str = "ttl_dict"):
        """
        Initialize TTL dictionary.

        Args:
            ttl: Time-to-live in seconds
            name: Dictionary name for logging
        """
        self.ttl = ttl
        self.name = name
        self._data: dict[str, Tuple[Any, float]] = {}
        self._lock = threading.RLock()

    def set(self, key: str, value: Any) -> None:
        """Set value with current timestamp."""
        with self._lock:
            self._data[key] = (value, time.time())

    def get(self, key: str, default: Any = None) -> Any:
        """Get value if not expired."""
        with self._lock:
            if key not in self._data:
                return default

            value, timestamp = self._data[key]
            if time.time() - timestamp > self.ttl:
                del self._data[key]
                return default

            return value

    def delete(self, key: str) -> bool:
        """Delete key."""
        with self._lock:
            if key in self._data:
                del self._data[key]
                return True
            return False

    def cleanup_expired(self) -> int:
        """Remove expired entries."""
        with self._lock:
            now = time.time()
            expired_keys = [
                key for key, (_, timestamp) in self._data.items()
                if now - timestamp > self.ttl
            ]

            for key in expired_keys:
                del self._data[key]

            return len(expired_keys)

    def clear(self) -> int:
        """Clear all entries."""
        with self._lock:
            count = len(self._data)
            self._data.clear()
            return count

    def size(self) -> int:
        """Get current number of entries."""
        with self._lock:
            return len(self._data)

    def items(self):
        """Get all non-expired items."""
        with self._lock:
            now = time.time()
            return [
                (key, value) for key, (value, timestamp) in self._data.items()
                if now - timestamp <= self.ttl
            ]


# Global cache registry for monitoring
_cache_registry: list[LRUCache | TTLDict] = []


def register_cache(cache: LRUCache | TTLDict) -> None:
    """Register a cache for global monitoring."""
    _cache_registry.append(cache)


def get_all_cache_stats() -> list[dict]:
    """Get statistics for all registered caches."""
    stats = []
    for cache in _cache_registry:
        if isinstance(cache, LRUCache):
            stats.append(cache.stats())
        elif isinstance(cache, TTLDict):
            stats.append({
                "name": cache.name,
                "size": cache.size(),
                "ttl": cache.ttl
            })
    return stats


def cleanup_all_caches() -> dict[str, int]:
    """Cleanup expired entries in all registered caches."""
    results = {}
    for cache in _cache_registry:
        removed = cache.cleanup_expired()
        results[cache.name] = removed
    return results
