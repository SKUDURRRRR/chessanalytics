# Engine Pool Shutdown Fix - Preventing Resource Leaks

## Issue Identified by CodeRabbit

**Severity**: Critical ⚠️
**Type**: Resource Leak
**Status**: ✅ Fixed

## Problem Description

The `close_all()` method in `python/core/engine_pool.py` had a race condition that could leak Stockfish engine processes during shutdown.

### The Race Condition

1. **Line 251** (OLD): `close_all()` took a snapshot of the pool ONCE outside the wait loop:
   ```python
   engines = list(self._pool)  # Snapshot taken once
   ```

2. **Line 278** (OLD): It then released the lock and slept:
   ```python
   await asyncio.sleep(0.1)
   ```

3. **During the sleep**: Another coroutine could call `acquire()`, which would:
   - Acquire the lock
   - Create a NEW engine
   - Append it to `self._pool`
   - Mark it `in_use=True`

4. **When close_all() resumed**: It only checked/destroyed engines from the ORIGINAL snapshot

5. **Line 265/273** (OLD): Finally it called `self._pool.clear()`, which cleared ALL engines

6. **Result**: The newly created engine was removed from the pool but NEVER had `_destroy_engine()` called on it, leaving an orphaned Stockfish process

### Impact

This leak caused:
- **Memory leaks**: Each Stockfish process uses ~96 MB of hash memory
- **CPU waste**: Orphaned processes continue consuming CPU cycles
- **File descriptor leaks**: Each engine keeps file handles open
- **Process table pollution**: Zombie processes accumulate over time

## Solution Implemented

### Fix #1: Re-snapshot Pool Inside Loop

Moved the pool snapshot INSIDE the while loop so it captures any engines created during shutdown:

```python
while True:
    async with self._lock:
        # Re-snapshot the pool each iteration to catch newly created engines
        engines = list(self._pool)  # Now inside the loop!
        busy = [info for info in engines if info.in_use]

        if not busy:
            # All engines are free, destroy them
            for info in engines:
                await self._destroy_engine(info)
            self._pool.clear()
            break
        # ... rest of logic
```

### Fix #2: Shutdown Flag to Prevent New Engines

Added a `_is_shutting_down` flag to prevent new engine creation during shutdown:

**In `__init__`:**
```python
self._is_shutting_down = False  # Flag to prevent new engines during shutdown
```

**In `close_all()`:**
```python
# Set shutdown flag to prevent new engine creation
async with self._lock:
    self._is_shutting_down = True
    logger.info("Engine pool shutdown initiated - no new engines will be created")
```

**In `acquire()`:**
```python
async with self._lock:
    # Prevent new engine creation during shutdown
    if self._is_shutting_down:
        raise RuntimeError("Engine pool is shutting down, cannot acquire new engines")

    # ... existing acquisition logic
```

Also added check in the wait loop:
```python
while engine_info is None:
    await asyncio.sleep(0.1)
    async with self._lock:
        # Check shutdown flag even while waiting
        if self._is_shutting_down:
            raise RuntimeError("Engine pool is shutting down, cannot acquire new engines")
        # ... rest of wait logic
```

## Files Modified

- `python/core/engine_pool.py`:
  - Added `_is_shutting_down` flag to `__init__`
  - Updated `acquire()` to check shutdown flag in two places
  - Fixed `close_all()` to re-snapshot pool inside loop
  - Added detailed comments explaining the fix

## Testing Recommendations

1. **Stress test shutdown**: Start multiple analysis jobs, then trigger shutdown immediately
2. **Monitor process table**: Use `ps aux | grep stockfish` to verify no orphaned processes
3. **Memory monitoring**: Check that memory is properly released during shutdown
4. **Race condition test**: Simulate rapid acquire/shutdown cycles

## Verification Commands

```bash
# Before shutdown - count Stockfish processes
ps aux | grep stockfish | grep -v grep | wc -l

# Trigger shutdown
# (send SIGTERM to FastAPI server)

# After shutdown - verify no Stockfish processes remain
ps aux | grep stockfish | grep -v grep | wc -l
# Should return 0
```

## Related Code

- Engine pool initialization: `python/core/unified_api_server.py` (lines 344-356)
- Shutdown handler: `python/core/unified_api_server.py` (lines 438-442)
- Global pool cleanup: `python/core/engine_pool.py` (lines 346-354)

## Additional Notes

This fix ensures:
1. ✅ All engines (including those created during shutdown) are properly destroyed
2. ✅ No new engines are created once shutdown begins
3. ✅ Coroutines waiting for engines receive proper error messages
4. ✅ No resource leaks (memory, CPU, file descriptors)
5. ✅ Clean shutdown with proper logging

## Credit

- **Issue discovered by**: CodeRabbit automated code review
- **Fixed by**: Development team
- **Date**: October 30, 2025
