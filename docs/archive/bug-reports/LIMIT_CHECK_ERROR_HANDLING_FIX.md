# Limit Check Error Handling Fix

## Problem

When users reach their import/analysis limits (e.g., 100/100 imports), the system was returning **500 Internal Server Error** instead of the proper **429 Too Many Requests** response. This was causing CORS errors and "Failed to fetch" messages in the browser.

## Root Cause

The limit checking code had a flaw:
1. When `usage_tracker.check_import_limit()` or `check_analysis_limit()` was called
2. If the database RPC call to `check_usage_limits` failed (timeout, connection error, etc.)
3. The exception could propagate and cause a 500 error instead of being handled gracefully
4. Even when limits were correctly detected, if the database check threw an exception, it would cause a 500 error

## Solution

Added proper error handling around limit checks to:
1. **Catch database errors gracefully** - If the limit check fails due to a database error, log it but don't block the request
2. **Preserve 429 responses** - When limits are actually exceeded, still return proper 429 status code
3. **Prevent 500 errors** - Database failures in limit checks no longer cause 500 errors

## Changes Made

### Analysis Limit Check (`/api/v1/analyze`)
**File**: `python/core/unified_api_server.py` (lines 1193-1213)

**Before**:
```python
if auth_user_id and usage_tracker:
    can_proceed, stats = await usage_tracker.check_analysis_limit(auth_user_id)
    if not can_proceed:
        raise HTTPException(status_code=429, ...)
```

**After**:
```python
if auth_user_id and usage_tracker:
    try:
        can_proceed, stats = await usage_tracker.check_analysis_limit(auth_user_id)
        if not can_proceed:
            raise HTTPException(status_code=429, ...)
    except HTTPException:
        raise  # Re-raise HTTP exceptions (429 limit errors)
    except Exception as e:
        # If limit check fails, log but don't block - prevents 500 errors
        logger.warning(f"Analysis limit check failed for user {auth_user_id} (non-critical): {e}")
        # Continue without limit check - better to allow than to block with 500 error
```

### Import Limit Checks
Applied the same fix to both import endpoints:
- `/api/v1/import-games-smart` (line 6628-6643)
- `/api/v1/import-games` (line 6902-6917)

## Impact

### Before Fix
- ❌ Users with 100/100 imports saw 500 errors when trying to analyze
- ❌ CORS errors masked the real issue
- ❌ Database connection issues in limit checks caused complete API failures

### After Fix
- ✅ Users with exceeded limits get proper 429 responses
- ✅ Database errors in limit checks are logged but don't break the API
- ✅ CORS errors should be resolved (with CORS_ORIGINS fix)
- ✅ Better error messages for users

## Testing

To verify the fix works:

1. **Test limit exceeded (should return 429)**:
   - User with 100/100 imports tries to import more
   - Should see: `429 Import limit reached` (not 500 error)

2. **Test database failure (should not cause 500)**:
   - If database is down or `check_usage_limits` function fails
   - Should log warning but allow request to proceed
   - Should NOT return 500 error

3. **Test normal operation**:
   - User with available limits should work normally
   - No impact on normal functionality

## Related Fixes

This fix works together with:
1. **CORS configuration fix** - Ensures 429 responses aren't blocked by CORS
2. **Database function fix** - Ensures `check_usage_limits` function works correctly

## Next Steps

1. Deploy the updated code to production
2. Monitor logs for limit check warnings
3. Verify users see proper 429 responses (not 500 errors)
4. Check that CORS errors are resolved
