# Usage Counter Fix - Import Counter Not Updating

## Issue

User `skalbiankee@gmail.com` reported that after importing 100 games, the import counter at the top of the page still shows `100/100` imports remaining instead of decreasing to `0/100`.

## Root Cause

The issue was found in the frontend code where `refreshUsageStats()` was being called but NOT awaited after import and analysis operations. This meant the UI would render before the usage stats were actually fetched from the backend.

### Affected Files:
1. `src/pages/SimpleAnalyticsPage.tsx` - Two instances:
   - Line 316: After game import completion
   - Line 615: After game analysis completion

2. `src/pages/ProfilePage.tsx` - One instance:
   - Line 34: In useEffect when page loads

## Fix Applied

### 1. SimpleAnalyticsPage.tsx - Import Completion (Line 316)

**Before:**
```typescript
if (user) {
  refreshUsageStats()  // ❌ Not awaited
}
```

**After:**
```typescript
if (user) {
  await refreshUsageStats()  // ✅ Properly awaited
}
```

### 2. SimpleAnalyticsPage.tsx - Analysis Completion (Line 615)

**Before:**
```typescript
// Refresh usage stats after analysis
refreshUsageStats()  // ❌ Not awaited
```

**After:**
```typescript
// Refresh usage stats after analysis
await refreshUsageStats()  // ✅ Properly awaited
```

### 3. ProfilePage.tsx - Page Load (Line 34)

**Before:**
```typescript
refreshUsageStats()  // ❌ Not awaited in useEffect
```

**After:**
```typescript
// Call refreshUsageStats without await since we're in useEffect
refreshUsageStats().catch(err => logger.error('Error refreshing usage stats:', err))  // ✅ Properly handled
```

**Note:** In the ProfilePage useEffect, we cannot use `await` directly, so we call the promise and handle errors with `.catch()`.

## Backend Code (Already Correct)

The backend code was already correctly implemented:

### Usage Tracking Increment (unified_api_server.py, Line 5956)
```python
# After successful import, increment usage
if auth_user_id and usage_tracker:
    await usage_tracker.increment_usage(auth_user_id, 'import', count=result.imported_games)
```

### Usage Stats Calculation (usage_tracker.py, Lines 276-278)
```python
# Calculate remaining
imports_remaining = None if import_limit is None else max(0, import_limit - current_imports)
analyses_remaining = None if analysis_limit is None else max(0, analysis_limit - current_analyses)
```

## How It Works

1. **User imports 100 games** (for example, user `fanfanfan`)
2. **Backend increments usage counter:**
   - Before: `games_imported = 0`
   - After: `games_imported = 100`
3. **Frontend calls `refreshUsageStats()`** to fetch updated stats
4. **Backend calculates remaining:**
   - `imports_remaining = max(0, 100 - 100) = 0`
5. **UI displays:** `0/100` imports remaining

## Expected Behavior After Fix

- ✅ Import counter updates immediately after import completion
- ✅ Analysis counter updates immediately after analysis completion
- ✅ Usage stats refresh on profile page load
- ✅ All async operations properly awaited for accurate UI state

## Testing

To verify the fix:

1. **As an authenticated user with Free tier (100 imports/day):**
   - Initial state: `100/100` imports remaining
   - Import 100 games
   - Expected: Counter shows `0/100` imports remaining
   - Expected: "Import More Games" button should be disabled or show limit reached

2. **Edge cases:**
   - Importing fewer than limit (e.g., 50 games): Should show `50/100` remaining
   - Importing when already at limit: Should show modal preventing import
   - Importing as Pro user (unlimited): Should show `∞` or "Unlimited"

## Files Modified

- ✅ `src/pages/SimpleAnalyticsPage.tsx` (2 changes)
- ✅ `src/pages/ProfilePage.tsx` (1 change)

## Related Files (No changes needed)

- ✅ `python/core/unified_api_server.py` - Backend already correct
- ✅ `python/core/usage_tracker.py` - Backend already correct
- ✅ `src/components/simple/PlayerSearch.tsx` - Already using `await refreshUsageStats()`
- ✅ `src/contexts/AuthContext.tsx` - No changes needed

## Status

✅ **FIXED** - All instances of `refreshUsageStats()` are now properly awaited or handled.
