# Re-analysis Feature - Issue Documentation

## 📋 Problem Summary

**Issue:** The "Re-analyze" button fails to update existing game analysis. Users click "Re-analyze" but the comments and analysis remain unchanged.

**Status:** ❌ Broken (unrelated to capture comment fixes)

**Impact:** Users cannot update analysis for games that were analyzed with old/buggy logic. They must delete and re-import games to get updated comments.

## 🔍 Error Details

### Backend Logs:
```
ERROR:core.usage_tracker:Error incrementing anonymous usage for IP 127.0.0.1:
{'message': 'column "games_imported" does not exist', 'code': '42703', 'hint': None, 'details': None}

INFO: 127.0.0.1:49673 - "GET /api/v1/game/ItsRealfasho/chess.com/157282053987 HTTP/1.1" 500 Internal Server Error

Error fetching single game: {'message': 'Missing response', 'code': '20U', 'hint': 'Please check traceback of the code', 'details': "Postgrest couldn't retrieve response, please check traceback of the code. Please create an issue in 'supabase-community/postgrest-py' if needed."}
```

### Frontend Error:
```
Failed to re-analyze game. Please try again.
```

## 🎯 Root Causes

### 1. Database Schema Mismatch
**Error:** `column "games_imported" does not exist`

**Location:** Usage tracking system trying to increment a column that doesn't exist in the database.

**File:** `python/core/usage_tracker.py` or similar usage tracking code

**Issue:** The code expects a `games_imported` column in the usage tracking table, but the database schema doesn't have it.

### 2. Database Query Failures (Cascading)
**Error:** `500 Internal Server Error` when fetching game data

**Location:** `/api/v1/game/{user_id}/{platform}/{game_id}` endpoint

**File:** `python/core/unified_api_server.py` line ~3190

**Issue:** After the usage tracker fails, subsequent database queries also fail, preventing the game from being fetched for re-analysis.

### 3. Missing Response Handling
**Error:** `Postgrest couldn't retrieve response`

**Issue:** Supabase/Postgrest returning incomplete responses, possibly due to database connection issues or timeout.

## 🔧 Potential Solutions

### Solution 1: Fix Database Schema (Recommended)

**Add missing column to database:**

```sql
-- Add games_imported column to usage tracking table
ALTER TABLE usage_tracking
ADD COLUMN IF NOT EXISTS games_imported INTEGER DEFAULT 0;

-- Or if it's in a different table, find the correct table first:
-- Check which table is used for anonymous usage tracking
SELECT table_name
FROM information_schema.columns
WHERE column_name = 'ip_address';
```

**Steps:**
1. Connect to Supabase database (via dashboard or CLI)
2. Identify the usage tracking table (likely `anonymous_usage` or `usage_tracking`)
3. Run migration to add `games_imported` column
4. Verify column exists with `\d table_name` (in psql)

### Solution 2: Disable Usage Tracking for Re-analysis

**Skip usage tracking during re-analysis:**

```python
# In python/core/unified_api_server.py or usage_tracker.py
# Add a flag to skip usage tracking for re-analysis requests

@app.post("/api/v1/analyze")
async def unified_analyze(request: UnifiedAnalysisRequest, ...):
    # ...
    try:
        # Skip usage tracking for re-analysis
        if not is_reanalysis:
            await usage_tracker.increment_usage(user_id, action="game_analysis")
    except Exception as e:
        # Log but don't fail the request if usage tracking fails
        logger.warning(f"Usage tracking failed (non-critical): {e}")
        # Continue with analysis anyway
```

### Solution 3: Add Error Handling (Quick Fix)

**Make usage tracking failures non-blocking:**

```python
# In python/core/usage_tracker.py or wherever usage tracking is called
try:
    await usage_tracker.increment_anonymous_usage(ip_address, action="game_analysis")
except Exception as e:
    # Log the error but don't fail the entire request
    logger.warning(f"Failed to track anonymous usage: {e}")
    # Continue with the main operation
```

**AND**

```python
# In python/core/unified_api_server.py - get_single_game endpoint
@app.get("/api/v1/game/{user_id}/{platform}/{game_id}")
async def get_single_game(...):
    try:
        # ... existing code ...
    except Exception as e:
        logger.error(f"Error fetching single game: {e}")
        # Return more specific error instead of 500
        if "column" in str(e) and "does not exist" in str(e):
            # Database schema issue - return 503 Service Unavailable
            raise HTTPException(
                status_code=503,
                detail="Database schema mismatch. Please contact support."
            )
        raise HTTPException(status_code=500, detail=str(e))
```

## 📁 Files to Investigate

### Primary:
1. **`python/core/usage_tracker.py`** (or similar file)
   - Look for: `increment_anonymous_usage`, `games_imported` column reference
   - Fix: Add error handling or update column name

2. **`python/core/unified_api_server.py`**
   - Line ~3190: `get_single_game` endpoint
   - Line ~1206: `unified_analyze` endpoint
   - Fix: Add try/catch for usage tracking failures

3. **Database schema** (Supabase)
   - Table: `anonymous_usage` or `usage_tracking` or similar
   - Fix: Add missing `games_imported` column

### Secondary:
4. **`supabase/migrations/`** (if migrations exist)
   - Check for missing migration that should have added `games_imported`
   - Create new migration if needed

5. **`python/core/supabase_client.py`** (or database initialization)
   - Check table creation/initialization code
   - Verify schema matches code expectations

## 🧪 Testing Steps

After applying fix:

1. **Restart backend:**
   ```powershell
   cd "C:\my files\Projects\chess-analytics"
   Get-Process -Name python | Stop-Process -Force
   cd python
   python -m core.unified_api_server
   ```

2. **Test re-analysis:**
   - Open an already-analyzed game
   - Click "Re-analyze" button
   - Watch backend logs for errors
   - Verify no `500 Internal Server Error`
   - Verify no `column "games_imported" does not exist`

3. **Verify update:**
   - Check if comments change after re-analysis
   - Check if move classifications update
   - Check if stats (accuracy, etc.) recalculate

4. **Test edge cases:**
   - Re-analyze same game twice (should work both times)
   - Re-analyze multiple games in sequence
   - Re-analyze with different analysis types (stockfish vs deep)

## 🔍 Diagnostic Commands

### Find the problematic code:
```powershell
# Search for games_imported references
cd "C:\my files\Projects\chess-analytics"
grep -r "games_imported" python/
grep -r "increment_anonymous_usage" python/
grep -r "increment.*usage" python/
```

### Check database schema:
```sql
-- In Supabase SQL Editor
-- List all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Find tables with 'usage' in the name
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE '%usage%';

-- Check columns in usage tracking table (replace TABLE_NAME)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'anonymous_usage';
```

### Test endpoint directly:
```powershell
# Test if game fetch works
Invoke-RestMethod -Uri "http://localhost:8002/api/v1/game/ItsRealfasho/chess.com/157282053987"

# Test re-analysis endpoint
$body = @{
    user_id = "ItsRealfasho"
    platform = "chess.com"
    analysis_type = "deep"
    pgn = "YOUR_PGN_HERE"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8002/api/v1/analyze" -Method POST -Body $body -ContentType "application/json"
```

## 📊 Workaround (Until Fixed)

**For users who need updated analysis:**

1. Delete the old game from the database:
   - Go to Supabase dashboard
   - Tables → `games` table
   - Find and delete the game record
   - Also delete from `move_analyses` and `games_pgn` tables

2. Re-import the game:
   - Go to "Last Player" page
   - Find the game in match history
   - Click "Analyze" (not "Re-analyze")
   - New analysis will use updated comment logic

**OR** (easier):

1. Just analyze a different game
2. The updated capture comments work perfectly on new analyses
3. Old games can be updated later once re-analysis is fixed

## 🎯 Recommended Action Plan

### Immediate (5 minutes):
- Add error handling to make usage tracking non-blocking (Solution 3)
- This allows re-analysis to work even if usage tracking fails

### Short-term (30 minutes):
- Investigate database schema
- Find the missing `games_imported` column issue
- Either add the column or remove the code that references it

### Long-term (2 hours):
- Review entire usage tracking system
- Create proper database migrations
- Add comprehensive error handling
- Add logging for database schema issues

## 🔗 Related Issues

- ✅ **Capture comments fixed** - working for NEW game analysis
- ❌ **Re-analysis broken** - this issue
- 📝 **Tactical context accuracy** - separate follow-up (see `TACTICAL_CONTEXT_IMPROVEMENT_TASK.md`)
- 🗄️ **Database schema management** - needs systematic migration approach

## 📌 Priority

**Medium-High Priority** - Re-analysis is a core feature that users expect to work. However, the workaround (delete + re-import) is acceptable for now.

**Estimated Fix Time:**
- Quick fix (error handling): 15 minutes
- Proper fix (database schema): 1-2 hours
- Complete solution (migrations + testing): 3-4 hours

---

**Status:** DOCUMENTED - Ready for implementation
**Date:** 2025-11-15
**Next Action:** Investigate `python/core/usage_tracker.py` and find `games_imported` reference
