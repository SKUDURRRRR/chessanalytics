# Stockfish OOM Fix for Railway Free Tier

## Issues Identified

### 1. **Exit Code -9 (OOM Killer)**
- **Cause**: Railway's free tier has ~512 MB RAM. Running multiple Stockfish instances with 32 MB hash each was exhausting memory.
- **Symptoms**: `engine process died unexpectedly (exit code: -9)`

### 2. **Illegal Move Detection**
- **Cause**: When Stockfish crashes and falls back to basic analysis, corrupted PGN data or parsing errors could cause illegal moves.
- **Symptoms**: `Illegal move detected in basic analysis`

## Fixes Applied

### Memory Optimization

#### 1. Fixed Performance Configuration (CRITICAL)
**File**: `python/core/performance_config.py`

This was the **root cause** - the performance config was overriding all other settings!

```python
# BEFORE (PRODUCTION profile)
stockfish_threads=2,
stockfish_hash_size=64,  # 64 MB!
max_concurrent_analyses=4,

# AFTER (PRODUCTION profile - Railway Free Tier optimized)
stockfish_threads=1,  # CRITICAL: Only 1 thread
stockfish_hash_size=8,  # CRITICAL: 8 MB instead of 64 MB
max_concurrent_analyses=1,  # CRITICAL: Only 1 concurrent analysis
```

#### 2. Reduced Stockfish Hash Size in Engine
**File**: `python/core/analysis_engine.py`

```python
# BEFORE
engine.configure({
    'Hash': 32  # 32 MB hash
})

# AFTER
engine.configure({
    'Hash': 8  # Reduced to 8 MB to prevent OOM kills on Railway
})
```

#### 3. Limited Concurrent Analysis in Engine
**File**: `python/core/analysis_engine.py`

```python
# BEFORE
max_concurrent = min(8, len(move_data))  # Up to 8 Stockfish instances at once

# AFTER
max_concurrent = 1  # Only 1 concurrent Stockfish instance to prevent memory exhaustion
```

**Impact**: This will make analysis slower (sequential instead of parallel), but it's necessary for Railway's free tier. Each move will be analyzed one at a time.

**Note**: The performance configuration in `performance_config.py` was the main culprit - it was setting 64 MB hash and 4 concurrent analyses, which immediately caused OOM kills even before the engine-level settings could take effect.

### Improved Error Handling

#### 1. Better PGN Validation
Added validation during PGN parsing to catch illegal moves early:

```python
for ply_index, move in enumerate(game.mainline_moves(), start=1):
    # Validate move is legal before adding to move_data
    if not board.is_legal(move):
        print(f"⚠️  WARNING: Illegal move detected during PGN parsing...")
        continue  # Skip illegal moves instead of crashing
```

#### 2. Enhanced Error Messages
Added specific error messages for OOM-related crashes:

```python
if "exit code: -9" in error_msg or "died unexpectedly" in error_msg:
    print(f"⚠️  Stockfish move analysis failed (likely OOM): {e}")
    print(f"   This is usually caused by memory constraints on Railway free tier.")
    print(f"   Falling back to basic heuristic analysis...")
```

#### 3. Improved Logging
Added detailed logging throughout the analysis pipeline:
- PGN preview before parsing
- Number of moves successfully parsed
- Detection of illegal moves with position details
- Clear indication when falling back to basic analysis

## Expected Behavior After Fix

1. **Memory Usage**: Stockfish will use only 8 MB hash + engine overhead (~20-30 MB per instance)
2. **Concurrency**: Only 1 move analyzed at a time (prevents memory spikes)
3. **Fallback**: If Stockfish still crashes, analysis will gracefully fall back to basic heuristics
4. **Error Handling**: Illegal moves in PGN will be skipped instead of causing analysis to fail

## Trade-offs

### Pros
- ✅ Prevents OOM kills on Railway free tier
- ✅ Analysis completes successfully even with resource constraints
- ✅ Graceful fallback to basic analysis if needed
- ✅ Better error messages and logging

### Cons
- ❌ Analysis will be **slower** (sequential vs parallel)
- ❌ Slightly less accurate Stockfish analysis due to lower hash size
- ❌ May still fall back to basic analysis under extreme memory pressure

## Performance Estimates

With these changes on Railway free tier:
- **Old**: 8 moves analyzed in parallel → ~10 seconds for 40-move game (but crashes)
- **New**: 1 move at a time → ~40-50 seconds for 40-move game (but completes successfully)

## Alternative Solutions

If you upgrade from Railway's free tier, you can adjust these settings:

### For Railway Starter ($5/month, 512 MB RAM)
```python
# Can increase slightly but stay conservative
'Hash': 16  # 16 MB hash
max_concurrent = 2  # 2 concurrent instances
```

### For Railway Pro ($20/month, 2 GB RAM)
```python
# More room to breathe
'Hash': 64  # 64 MB hash
max_concurrent = 4  # 4 concurrent instances
```

### For Railway Enterprise (4+ GB RAM)
```python
# Full performance
'Hash': 128  # 128 MB hash
max_concurrent = 8  # 8 concurrent instances (original setting)
```

## Next Steps

1. **Deploy these changes to Railway**
2. **Test game analysis** - it should complete without OOM errors
3. **Monitor logs** for:
   - No more "exit code: -9" errors
   - No "Illegal move detected" errors
   - Successful analysis completion messages
4. **Consider upgrading Railway tier** if analysis speed is too slow

## Testing Checklist

- [ ] Deploy changes to Railway
- [ ] Attempt to analyze a game
- [ ] Verify analysis completes without OOM errors
- [ ] Check that moves are analyzed (even if slower)
- [ ] Confirm data is saved to database
- [ ] Review logs for any remaining errors

