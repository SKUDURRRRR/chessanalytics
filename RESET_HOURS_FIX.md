# Reset Hours Display Fix

## Issue

The "Limits reset in hours" text was not showing the correct number of hours remaining until the usage limits reset. The text displayed as "Limits reset in hours" without any actual number value.

## Root Cause

The issue was in `python/core/usage_tracker.py` where the code was mixing timezone-aware and timezone-naive datetime objects:

1. **Timezone-aware datetime** (from database):
   ```python
   reset_at = datetime.fromisoformat(record['reset_at'].replace('Z', '+00:00'))
   ```
   This creates a timezone-aware datetime object.

2. **Timezone-naive datetime** (in calculations):
   ```python
   datetime.now()  # ❌ Timezone-naive
   ```
   This creates a timezone-naive datetime object.

When trying to subtract timezone-naive from timezone-aware datetime objects (or vice versa), Python throws a `TypeError`, causing the calculation to fail and return `undefined` to the frontend.

## Fix Applied

Updated all `datetime.now()` calls to use UTC timezone:

### Changes Made:

1. **Import timezone module** (Line 11):
   ```python
   from datetime import datetime, timedelta, timezone
   ```

2. **Update increment_usage method** (Lines 136-137):
   ```python
   today = datetime.now(timezone.utc).date()
   reset_at = datetime.now(timezone.utc)
   ```

3. **Update reset check in increment_usage** (Line 156):
   ```python
   if datetime.now(timezone.utc) - record_reset_at > timedelta(hours=24):
   ```

4. **Update get_usage_stats method** (Line 253):
   ```python
   today = datetime.now(timezone.utc).date()
   ```

5. **Update usage window check** (Line 269):
   ```python
   if datetime.now(timezone.utc) - reset_at <= timedelta(hours=24):
   ```

6. **Update resets_in_hours calculation** (Line 300):
   ```python
   round((reset_at + timedelta(hours=24) - datetime.now(timezone.utc)).total_seconds() / 3600, 1)
   ```

## How It Works

1. **When user has active usage:**
   - `reset_at` is parsed from database as timezone-aware datetime
   - Current time is `datetime.now(timezone.utc)` (also timezone-aware)
   - Calculation: `(reset_at + 24 hours - current_time) / 3600 seconds`
   - Returns hours remaining until reset (e.g., `15.3` hours)

2. **When user has no usage yet:**
   - `reset_at` is `None`
   - Returns default value: `24.0` hours

## Expected Behavior After Fix

- ✅ "Limits reset in 23.5 hours" (when close to reset)
- ✅ "Limits reset in 15.0 hours" (mid-way through window)
- ✅ "Limits reset in 24.0 hours" (no usage yet)
- ✅ Consistent timezone handling across all operations

## Frontend Display

The frontend (`src/pages/ProfilePage.tsx`, line 440) correctly displays the value:

```typescript
<p className="text-sm text-slate-400">
  Limits reset in {usageStats.resets_in_hours?.toFixed(1)} hours
</p>
```

## Testing

To verify the fix:

1. **Login as Free tier user**
2. **Navigate to Profile page**
3. **Check Usage Statistics section**
4. **Expected:** "Limits reset in X.X hours" with actual number displayed

## Files Modified

- ✅ `python/core/usage_tracker.py` (6 changes)

## Status

✅ **FIXED** - All datetime operations now use timezone-aware datetime objects with UTC timezone.
