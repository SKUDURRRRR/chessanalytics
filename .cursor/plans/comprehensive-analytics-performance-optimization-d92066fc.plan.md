<!-- d92066fc-768b-4baf-bdfc-c909a3a8da1a 95524b51-bcd4-46d1-8239-5dda830832fb -->
# Comprehensive Analytics Performance Optimization Plan

## Goal

Reduce first page load time from 20 seconds to 3-5 seconds by optimizing data fetching and processing.

## Implementation Steps

### 1. Parallelize Analysis Data Fetching (5-8s reduction)

**File:** `python/core/unified_api_server.py` (lines 2167-2234)

**Current:** Sequential execution - game_analyses → move_analyses → games_pgn
**Change:** Run all three query types in parallel using `asyncio.gather()`

- Create helper async functions for each query type that handle batching internally
- Use `asyncio.gather()` to fetch all three in parallel
- Merge results from all three parallel operations

**Code location:** Replace sequential loops (lines 2167-2234) with parallel execution using `asyncio.gather()`

### 2. Reduce Batch Delays (2-3s reduction)

**File:** `python/core/unified_api_server.py` (lines 2182, 2203, 2224)

**Current:** 0.1s delay between batches
**Change:** Reduce to 0.01s or remove entirely (evaluate which option is valid and will work correctly)

- Change `await asyncio.sleep(0.1)` to `await asyncio.sleep(0.01)`
- Or remove delays entirely if parallelization reduces connection pressure
- Keep delay only if connection errors occur

### 3. Increase Batch Sizes (1-2s reduction)

**File:** `python/core/unified_api_server.py` (line 2164)

**Current:** batch_size = 250
**Change:** Increase to 500

- Change `batch_size = 250` to `batch_size = 500`
- Monitor for connection termination errors
- If errors occur, fallback to 400 or 350

### 4. Make Analysis Data Optional/Async (10-15s reduction)

**File:** `python/core/unified_api_server.py` (lines 2155-2234, 2257-2314, 2642-2675)

**Strategy:** Calculate and return basic stats immediately, then calculate analysis-dependent stats if analysis data is available

**Implementation:**

- Split stats calculation into two phases:

1. **Basic stats** (uses games array only): colorStats, openingStats, win/draw/loss rates, ELO stats, basic distribution
2. **Enhanced stats** (requires analysis data): marathon performance accuracy, patience rating, comeback potential, personal records with accuracy

- Move analysis data fetching to run in parallel with opening color stats query
- Calculate basic stats first (lines 2404-2469)
- Calculate enhanced stats only if analysis data is available (lines 2257-2314)
- Return partial enhanced stats as None/null if analysis data not yet available

**Code changes:**

- Reorder code: calculate basic stats before analysis-dependent stats
- Make analysis-dependent calculations conditional on data availability
- Ensure response structure remains consistent (null values for missing analysis data)

### 5. Cache Opening Color Stats (2-3s reduction on subsequent loads)

**File:** `python/core/unified_api_server.py` (lines 2482-2513, 2042-2046)

**Current:** Opening color stats query runs every time
**Change:** Cache results with 5-minute TTL

- Add cache check before opening color stats query (similar to line 2042-2046)
- Cache key: `opening_color_stats:{canonical_user_id}:{platform}`
- Cache the `games_for_color_stats` array (not the processed stats)
- Invalidate cache when new games are imported (optional, can use TTL-only)

**Implementation:**

- Add cache check before line 2482
- If cache hit, use cached games_for_color_stats
- After fetching, store in cache with `_set_in_cache()`
- Use existing `CACHE_TTL_SECONDS` (300 seconds = 5 minutes)

## Expected Results

- **First load:** 3-5 seconds (basic stats immediately, analysis data may be partial)
- **Subsequent loads (within 5 min):** 1-2 seconds (cached opening stats)
- **Full data load:** 10-12 seconds (background analysis data)

## Testing Strategy

1. Test with 3885 games to verify all optimizations work
2. Monitor for connection termination errors with increased batch size
3. Verify basic stats return immediately even if analysis data fails
4. Test cache behavior (cache hit vs miss)
5. Verify parallel queries complete successfully

## Risk Mitigation

- If batch size 500 causes errors, reduce incrementally (450, 400, 350)
- If parallelization causes connection issues, add small delays between parallel groups
- Ensure basic stats always return even if all analysis queries fail
