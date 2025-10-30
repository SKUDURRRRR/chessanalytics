# Personality Scores Cache Fix

## Problem

After importing and analyzing games, the personality scores (displayed in the Chess Personality Radar) were showing default values (all 50s) instead of calculated scores from the analyzed games.

### Symptoms

1. **Personality Radar**: All traits showing score of 50 (neutral)
2. **Game Style**: Showing "0 games" even after analysis
3. **Opening Analysis**: Showing contradictory data (0% win rate but mentions specific openings)

## Root Cause

The issue was caused by stale backend cache not being cleared after analysis completion:

1. When games are analyzed, new entries are created in the `game_analyses` table
2. The deep analysis endpoint (`/api/v1/deep-analysis/{user_id}/{platform}`) has its own backend cache
3. This cache was NOT being cleared after analysis, so it returned old data with:
   - Default personality scores (50 for all traits)
   - Outdated game counts
   - Missing analyzed game data

## Solution

### Backend Changes (`python/core/unified_api_server.py`)

1. **Added cache deletion function**:
```python
def _delete_from_cache(cache_key: str) -> None:
    """Delete a specific cache entry."""
    if cache_key in _analytics_cache:
        del _analytics_cache[cache_key]
```

2. **Added cache clearing endpoint**:
```python
@app.delete("/api/v1/clear-cache/{user_id}/{platform}")
async def clear_user_cache(user_id, platform):
    """Clear all cached data for a specific user and platform."""
    # Clears: deep_analysis, stats, comprehensive_analytics
```

3. **Added force_refresh parameter to deep analysis endpoint**:
```python
@app.get("/api/v1/deep-analysis/{user_id}/{platform}")
async def get_deep_analysis(user_id, platform, force_refresh: bool = False):
    """Get deep analysis with personality insights."""
    # Now supports force_refresh to bypass cache
```

### Frontend Changes

1. **Updated UnifiedAnalysisService** (`src/services/unifiedAnalysisService.ts`):
   - Added `clearBackendCache()` method to call the new DELETE endpoint
   - Updated `getDeepAnalysis()` to support `force_refresh` query parameter
   - Fixed TypeScript lint error in `validatePersonalityScores()`

2. **Updated apiCache** (`src/utils/apiCache.ts`):
   - Modified `clearUserCache()` to also clear backend cache via API call
   - Ensures both frontend and backend caches are cleared together

3. **Existing Integration** (`src/pages/SimpleAnalyticsPage.tsx`):
   - Already calls `clearUserCache()` after analysis completion (line 537)
   - Now automatically clears backend cache thanks to updated `clearUserCache()` function

## How It Works Now

1. User clicks "Analyze My Games"
2. Analysis runs and completes
3. `SimpleAnalyticsPage` calls `clearUserCache(userId, platform)` (line 537)
4. Frontend cache is cleared (existing behavior)
5. **NEW**: Backend cache is also cleared via DELETE `/api/v1/clear-cache/{user_id}/{platform}`
6. Next data fetch gets fresh data from database with updated personality scores

## Testing

To verify the fix:

1. Import and analyze games for a player (e.g., maine49)
2. Wait for analysis to complete
3. Check personality radar - should show calculated scores (not all 50s)
4. Check game style section - should show correct game count
5. Check opening analysis - should show consistent data

## Cache Keys Cleared

When `clearUserCache()` is called, these backend cache keys are cleared:
- `deep_analysis:{user_id}:{platform}`
- `stats:{user_id}:{platform}`
- `comprehensive_analytics:{user_id}:{platform}`

## Future Improvements

1. Consider adding automatic cache invalidation in the backend when analysis completes
2. Add cache version tracking to detect stale data
3. Implement Redis or similar for distributed caching instead of in-memory cache
