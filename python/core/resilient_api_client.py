#!/usr/bin/env python3
"""
Resilient API Client for External Chess Platform APIs

This module provides a robust client for making API calls to Lichess and Chess.com
with the following features:
- Connection pooling (reusable HTTP sessions)
- Rate limiting (token bucket algorithm)
- Response caching (in-memory with TTL)
- Retry logic with exponential backoff
- Request deduplication (prevent concurrent duplicate requests)
- Circuit breaker pattern (fail fast when external APIs are down)
"""

import asyncio
import aiohttp
import httpx
import time
from typing import Dict, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import hashlib
import json
from urllib.parse import quote


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CacheEntry:
    """Cache entry with TTL"""
    data: Any
    expires_at: datetime


@dataclass
class RateLimiter:
    """Token bucket rate limiter"""
    capacity: int
    tokens: float = field(init=False)
    last_update: float = field(init=False)
    refill_rate: float  # tokens per second

    def __post_init__(self):
        self.tokens = float(self.capacity)
        self.last_update = time.time()

    def _refill(self):
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self.last_update
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_update = now

    async def acquire(self, tokens: int = 1) -> bool:
        """Try to acquire tokens, return True if successful"""
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    async def wait_for_token(self, tokens: int = 1, timeout: float = 30.0):
        """Wait until tokens are available or timeout"""
        start = time.time()
        while time.time() - start < timeout:
            if await self.acquire(tokens):
                return True
            await asyncio.sleep(0.1)
        return False


@dataclass
class CircuitBreaker:
    """Circuit breaker to prevent cascading failures"""
    failure_threshold: int = 5  # Open circuit after N failures
    recovery_timeout: float = 60.0  # Seconds before trying half-open
    success_threshold: int = 2  # Successes needed in half-open to close

    state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    failure_count: int = field(default=0, init=False)
    success_count: int = field(default=0, init=False)
    last_failure_time: Optional[float] = field(default=None, init=False)

    def record_success(self):
        """Record a successful request"""
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                print(f"[CIRCUIT] Closing circuit, service recovered")
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.success_count = 0
        elif self.state == CircuitState.CLOSED:
            # Reset failure count on success
            self.failure_count = 0

    def record_failure(self):
        """Record a failed request"""
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN:
            # Failed while testing, go back to open
            print(f"[CIRCUIT] Half-open test failed, reopening circuit")
            self.state = CircuitState.OPEN
            self.success_count = 0
            self.failure_count += 1
        elif self.state == CircuitState.CLOSED:
            self.failure_count += 1
            if self.failure_count >= self.failure_threshold:
                print(f"[CIRCUIT] Opening circuit after {self.failure_count} failures")
                self.state = CircuitState.OPEN

    def can_attempt(self) -> bool:
        """Check if we can attempt a request"""
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            # Check if recovery timeout has elapsed
            if self.last_failure_time:
                elapsed = time.time() - self.last_failure_time
                if elapsed >= self.recovery_timeout:
                    print(f"[CIRCUIT] Moving to half-open state for testing")
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                    return True
            return False

        # HALF_OPEN: allow request to test
        return True

    def get_state_info(self) -> str:
        """Get current state as string"""
        return f"{self.state.value} (failures: {self.failure_count})"


class ResilientAPIClient:
    """
    Resilient HTTP client for external chess platform APIs.

    Features:
    - Connection pooling for better performance
    - Rate limiting to respect API limits
    - Caching to reduce redundant requests
    - Retry logic with exponential backoff
    - Request deduplication
    - Circuit breaker for fault tolerance
    """

    def __init__(
        self,
        lichess_rate_limit: int = 10,  # requests per second
        chesscom_rate_limit: int = 10,  # requests per second
        cache_ttl_seconds: int = 300,  # 5 minutes
        max_retries: int = 3,
    ):
        # HTTP clients with connection pooling
        self._aiohttp_session: Optional[aiohttp.ClientSession] = None
        self._httpx_client: Optional[httpx.AsyncClient] = None

        # Rate limiters
        self.lichess_limiter = RateLimiter(
            capacity=lichess_rate_limit * 2,  # Burst capacity
            refill_rate=lichess_rate_limit
        )
        self.chesscom_limiter = RateLimiter(
            capacity=chesscom_rate_limit * 2,
            refill_rate=chesscom_rate_limit
        )

        # Circuit breakers
        self.lichess_circuit = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60.0,
            success_threshold=2
        )
        self.chesscom_circuit = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60.0,
            success_threshold=2
        )

        # Cache
        self.cache: Dict[str, CacheEntry] = {}
        self.cache_ttl = timedelta(seconds=cache_ttl_seconds)

        # Request deduplication
        self.pending_requests: Dict[str, asyncio.Future] = {}

        # Config
        self.max_retries = max_retries

    def _get_cache_key(self, method: str, url: str, params: Optional[Dict] = None) -> str:
        """Generate cache key for request"""
        key_data = f"{method}:{url}"
        if params:
            key_data += f":{json.dumps(params, sort_keys=True)}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def _get_cached(self, cache_key: str) -> Optional[Any]:
        """Get cached response if not expired"""
        if cache_key in self.cache:
            entry = self.cache[cache_key]
            if datetime.now() < entry.expires_at:
                print(f"[CACHE] Cache hit for {cache_key[:8]}...")
                return entry.data
            else:
                # Expired, remove
                del self.cache[cache_key]
        return None

    def _set_cache(self, cache_key: str, data: Any):
        """Store response in cache"""
        self.cache[cache_key] = CacheEntry(
            data=data,
            expires_at=datetime.now() + self.cache_ttl
        )
        print(f"[CACHE] Cached response for {cache_key[:8]}...")

    def _clean_expired_cache(self):
        """Remove expired cache entries"""
        now = datetime.now()
        expired = [k for k, v in self.cache.items() if now >= v.expires_at]
        for key in expired:
            del self.cache[key]

    async def get_aiohttp_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._aiohttp_session is None or self._aiohttp_session.closed:
            timeout = aiohttp.ClientTimeout(total=10, connect=5)
            self._aiohttp_session = aiohttp.ClientSession(timeout=timeout)
            print("[SESSION] Created new aiohttp session")
        return self._aiohttp_session

    async def get_httpx_client(self) -> httpx.AsyncClient:
        """Get or create httpx client"""
        if self._httpx_client is None:
            self._httpx_client = httpx.AsyncClient(timeout=10.0)
            print("[SESSION] Created new httpx client")
        return self._httpx_client

    async def close(self):
        """Close all HTTP sessions"""
        if self._aiohttp_session and not self._aiohttp_session.closed:
            await self._aiohttp_session.close()
            print("[SESSION] Closed aiohttp session")

        if self._httpx_client:
            await self._httpx_client.aclose()
            print("[SESSION] Closed httpx client")

    async def _make_request_with_retry(
        self,
        request_func,
        max_retries: int,
        circuit_breaker: CircuitBreaker,
    ) -> Any:
        """Execute request with retry logic and exponential backoff"""
        last_exception = None

        for attempt in range(max_retries + 1):
            try:
                # Check circuit breaker
                if not circuit_breaker.can_attempt():
                    raise Exception(
                        f"Circuit breaker is {circuit_breaker.state.value}, "
                        "service temporarily unavailable"
                    )

                # Make request
                result = await request_func()

                # Success!
                circuit_breaker.record_success()
                return result

            except asyncio.TimeoutError as e:
                last_exception = e
                circuit_breaker.record_failure()
                if attempt < max_retries:
                    backoff = (2 ** attempt) * 0.5  # 0.5s, 1s, 2s
                    print(f"[RETRY] Timeout on attempt {attempt + 1}, retrying in {backoff}s...")
                    await asyncio.sleep(backoff)

            except (aiohttp.ClientError, httpx.RequestError) as e:
                last_exception = e
                circuit_breaker.record_failure()
                if attempt < max_retries:
                    backoff = (2 ** attempt) * 0.5
                    print(f"[RETRY] Error on attempt {attempt + 1}: {e}, retrying in {backoff}s...")
                    await asyncio.sleep(backoff)

            except Exception as e:
                # Don't retry on non-network errors
                circuit_breaker.record_failure()
                raise

        # All retries exhausted
        raise last_exception or Exception("Max retries exceeded")

    async def validate_lichess_user(self, username: str) -> Tuple[bool, str]:
        """
        Validate if user exists on Lichess.

        Returns:
            Tuple of (exists: bool, message: str)
        """
        cache_key = self._get_cache_key("GET", f"lichess_user_{username}")

        # Check cache
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # Check for duplicate in-flight request
        if cache_key in self.pending_requests:
            print(f"[DEDUP] Waiting for existing Lichess validation for {username}")
            return await self.pending_requests[cache_key]

        # Create future for deduplication
        future = asyncio.Future()
        self.pending_requests[cache_key] = future

        try:
            # Wait for rate limit
            if not await self.lichess_limiter.wait_for_token(timeout=30.0):
                result = (False, "Rate limit exceeded, please try again")
                self._set_cache(cache_key, result)
                future.set_result(result)
                return result

            # Make request with retry
            async def request_func():
                session = await self.get_aiohttp_session()
                url = f"https://lichess.org/api/user/{username}"
                async with session.get(url) as response:
                    if response.status == 200:
                        return (True, "User found on Lichess")
                    elif response.status == 404:
                        return (False, f"User '{username}' not found on Lichess")
                    elif response.status == 429:
                        raise Exception("Lichess API rate limit exceeded")
                    else:
                        raise Exception(f"Lichess API returned status {response.status}")

            result = await self._make_request_with_retry(
                request_func,
                self.max_retries,
                self.lichess_circuit
            )

            # Cache and return
            self._set_cache(cache_key, result)
            future.set_result(result)
            return result

        except Exception as e:
            error_msg = str(e)
            result = (False, f"Error validating Lichess user: {error_msg}")
            future.set_exception(e)
            # Don't cache errors
            raise

        finally:
            # Remove from pending
            if cache_key in self.pending_requests:
                del self.pending_requests[cache_key]

    async def validate_chesscom_user(self, username: str) -> Tuple[bool, str]:
        """
        Validate if user exists on Chess.com.

        Returns:
            Tuple of (exists: bool, message: str)
        """
        cache_key = self._get_cache_key("GET", f"chesscom_user_{username}")

        # Check cache
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # Check for duplicate in-flight request
        if cache_key in self.pending_requests:
            print(f"[DEDUP] Waiting for existing Chess.com validation for {username}")
            return await self.pending_requests[cache_key]

        # Create future for deduplication
        future = asyncio.Future()
        self.pending_requests[cache_key] = future

        try:
            # Wait for rate limit
            if not await self.chesscom_limiter.wait_for_token(timeout=30.0):
                result = (False, "Rate limit exceeded, please try again")
                self._set_cache(cache_key, result)
                future.set_result(result)
                return result

            # Make request with retry
            async def request_func():
                client = await self.get_httpx_client()
                # Chess.com API is case-insensitive, but preserve original case for better error messages
                # Strip whitespace but don't lowercase - let Chess.com API handle case insensitivity
                canonical_username = username.strip()
                # URL encode the username, but keep hyphens and underscores safe (they're valid in URLs)
                # This handles special characters while preserving common username characters
                encoded_username = quote(canonical_username, safe='-_')
                url = f"https://api.chess.com/pub/player/{encoded_username}"
                headers = {
                    'User-Agent': 'ChessAnalytics/1.0 (Contact: your-email@example.com)'
                }
                response = await client.get(url, headers=headers)

                if response.status_code == 200:
                    return (True, "User found on Chess.com")
                elif response.status_code == 404:
                    return (False, f"User '{username}' not found on Chess.com")
                elif response.status_code == 429:
                    raise Exception("Chess.com API rate limit exceeded")
                else:
                    raise Exception(f"Chess.com API returned status {response.status_code}")

            result = await self._make_request_with_retry(
                request_func,
                self.max_retries,
                self.chesscom_circuit
            )

            # Cache and return
            self._set_cache(cache_key, result)
            future.set_result(result)
            return result

        except Exception as e:
            error_msg = str(e)
            result = (False, f"Error validating Chess.com user: {error_msg}")
            future.set_exception(e)
            # Don't cache errors
            raise

        finally:
            # Remove from pending
            if cache_key in self.pending_requests:
                del self.pending_requests[cache_key]

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the client"""
        return {
            "cache_size": len(self.cache),
            "pending_requests": len(self.pending_requests),
            "lichess_circuit": self.lichess_circuit.get_state_info(),
            "chesscom_circuit": self.chesscom_circuit.get_state_info(),
            "lichess_tokens": round(self.lichess_limiter.tokens, 2),
            "chesscom_tokens": round(self.chesscom_limiter.tokens, 2),
        }


# Global client instance
_api_client: Optional[ResilientAPIClient] = None


def get_api_client() -> ResilientAPIClient:
    """Get the global resilient API client instance"""
    global _api_client
    if _api_client is None:
        _api_client = ResilientAPIClient(
            lichess_rate_limit=8,  # Conservative: 8 req/s
            chesscom_rate_limit=8,  # Conservative: 8 req/s
            cache_ttl_seconds=300,  # 5 minutes
            max_retries=3
        )
        print("[CLIENT] Created resilient API client")
    return _api_client


async def cleanup_api_client():
    """Cleanup the global API client"""
    global _api_client
    if _api_client:
        await _api_client.close()
        _api_client = None
        print("[CLIENT] Cleaned up API client")
