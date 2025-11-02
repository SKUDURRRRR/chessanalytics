# Auto-Import for Anonymous Users Fix

**Date**: 2025-11-02
**Status**: ✅ Fixed
**Issue**: Auto-import didn't work for anonymous (non-logged-in) users

## Problem

User `baisustipas@gmail.com` visited the profile of `skudurrrrr` on ChessData, and the auto-import feature didn't work to fetch new games from Chess.com. The app showed games up to Nov 1, 2025, but Chess.com had newer games (Nov 2, 2025) that weren't imported.

### Root Cause

Auto-import was restricted to **authenticated users only**:

```typescript
// SimpleAnalyticsPage.tsx (OLD CODE - line 180-190)
// Auto-sync effect - triggers when userId and platform are set (authenticated users only)
useEffect(() => {
  // Only auto-sync for authenticated users
  if (user && userId && platform && !isLoading) {
    const timeoutId = setTimeout(() => {
      checkAndSyncNewGames()
    }, 1000)
    return () => clearTimeout(timeoutId)
  }
}, [user, userId, platform, isLoading])
```

The condition `if (user && ...)` required the user to be logged in, so anonymous visitors couldn't benefit from auto-import.

## Solution

Modified `SimpleAnalyticsPage.tsx` to enable auto-import for both authenticated and anonymous users, with proper usage limits for anonymous users.

### Changes Made

#### 1. Enabled Auto-Import for All Users

```typescript
// SimpleAnalyticsPage.tsx (NEW CODE - line 179-191)
// Auto-sync effect - triggers when userId and platform are set
useEffect(() => {
  // Auto-sync for both authenticated and anonymous users
  // Anonymous users have import limits (100 imports per 24 hours)
  if (userId && platform && !isLoading) {
    const timeoutId = setTimeout(() => {
      checkAndSyncNewGames()
    }, 1000)
    return () => clearTimeout(timeoutId)
  }
}, [userId, platform, isLoading])
```

**Key Change**: Removed `user &&` condition, allowing auto-sync to run for everyone.

#### 2. Added Anonymous User Limit Check

```typescript
// SimpleAnalyticsPage.tsx (line 481-487)
// Check anonymous user limits (if not authenticated)
if (!user) {
  if (!AnonymousUsageTracker.canImport()) {
    console.log('[Auto-sync] Anonymous user reached import limit, skipping auto-sync')
    return
  }
}
```

**Protection**: Prevents anonymous users from exceeding the 100 imports per 24 hours limit.

#### 3. Track Anonymous User Usage

```typescript
// SimpleAnalyticsPage.tsx (line 545-548)
if (result.success && actualNewGames > 0) {
  // Track anonymous user usage
  if (!user) {
    AnonymousUsageTracker.incrementImports(actualNewGames)
  }
  // ... show success message ...
}
```

**Tracking**: Increments anonymous user's import count when new games are imported.

## How It Works Now

### For Authenticated Users
1. Visit any player profile
2. Auto-import runs after 1 second
3. Checks for new games from Chess.com/Lichess
4. Imports new games automatically
5. Shows notification if new games found
6. No usage limits (subject to tier-based quotas)

### For Anonymous Users
1. Visit any player profile
2. Auto-import runs after 1 second (if under limit)
3. Checks for new games from Chess.com/Lichess
4. Imports new games automatically
5. Shows notification if new games found
6. Usage tracked: 100 imports per 24 hours limit
7. If limit reached, auto-import is skipped

### Limitations (Same for Both)
- Only checks **most recent 100 games** (by design - for speed)
- **10-minute cooldown** between auto-syncs for same user
- Requires **existing profile** in database (skips for first-time users)
- Anonymous users: **100 imports per 24 hours** rolling window limit

## Benefits

1. **Better UX for Visitors**: Anonymous users can now see updated games when visiting profiles
2. **Encourages Engagement**: Users can explore the tool without signing up first
3. **Fair Usage**: Anonymous user limits prevent abuse while allowing reasonable usage
4. **Consistent Experience**: Auto-import works the same way whether logged in or not

## Testing Scenarios

### Scenario 1: Anonymous User First Visit
- User visits `skudurrrrr` profile
- Profile exists with 20 games (last from Nov 1)
- Chess.com has new game (Nov 2)
- **Expected**: Auto-import runs, imports 1 new game, shows notification
- **Anonymous usage**: 1/100 imports used

### Scenario 2: Anonymous User Reaches Limit
- User has imported 100 games in last 24 hours
- Visits a profile with new games
- **Expected**: Auto-import skipped, no import, no error shown
- Console: "Anonymous user reached import limit, skipping auto-sync"

### Scenario 3: Authenticated User
- User logged in as `baisustipas@gmail.com`
- Visits `skudurrrrr` profile
- **Expected**: Auto-import runs, no anonymous limits apply
- Usage tracked against user's tier-based quota

### Scenario 4: 10-Minute Cooldown
- User visits profile, auto-import runs
- User refreshes page 2 minutes later
- **Expected**: Auto-import skipped due to cooldown
- Console: "Auto-sync skipped - last sync was 120s ago"

## Files Modified

### Production Code
- `src/pages/SimpleAnalyticsPage.tsx`
  - Line 179-191: Enabled auto-import for anonymous users
  - Line 481-487: Added anonymous user limit check
  - Line 545-548: Added anonymous user usage tracking

### Documentation
- `docs/AUTO_IMPORT_INVESTIGATION.md`
  - Updated "How Auto-Import Works" section
  - Added "Limitation 4: Anonymous User Limits"
  - Updated code examples with anonymous user support

## Related Systems

### Anonymous Usage Tracker
- Located: `src/services/anonymousUsageTracker.ts`
- Limits: 100 imports per 24 hours, 5 analyses per 24 hours
- Storage: localStorage (can be bypassed by clearing, which is acceptable)
- Goal: Provide friction and encourage registration, not perfect security

### Auto-Import Service
- Located: `src/services/autoImportService.ts`
- Method: `importSmartGames(userId, platform, onProgress)`
- Fetches: Most recent 100 games from platform
- Filters: Only imports NEW games (not already in database)

### Profile Service
- Located: `src/services/profileService.ts`
- Method: `checkUserExists(userId, platform)`
- Returns: Whether profile exists in database
- Used by: Auto-import to skip new users (no profile yet)

## Edge Cases Handled

1. **Anonymous user at limit**: Auto-import silently skipped, no error shown
2. **Multiple tabs**: 10-minute cooldown shared via localStorage prevents duplicate imports
3. **New user profile**: Auto-import skipped (profile doesn't exist yet)
4. **No new games**: Auto-import runs but silently dismisses (no spam notifications)
5. **Import in progress**: Duplicate auto-import calls blocked by `autoSyncing` flag

## Monitoring

To monitor anonymous user auto-import:

```javascript
// Browser console on any profile page
// Check anonymous usage stats
const stats = AnonymousUsageTracker.getStats()
console.log(stats)
// {
//   imports: { used: 5, remaining: 95, limit: 100 },
//   analyses: { used: 0, remaining: 5, limit: 5 },
//   resetAt: "2025-11-03T12:00:00.000Z",
//   resetsInHours: 23.5
// }
```

## Rollback Plan

If this causes issues, revert by:

1. Restore the `user &&` condition in the useEffect
2. Remove anonymous user limit check
3. Remove anonymous user usage tracking

```bash
git revert <commit-hash>
```

## Related Documentation

- `docs/AUTO_IMPORT_INVESTIGATION.md` - Complete auto-import behavior
- `docs/ANONYMOUS_USER_LIMITS_COMPLETE_GUIDE.md` - Anonymous user system
- `docs/ANONYMOUS_USER_FIX_SUMMARY.md` - Anonymous user database access fix
- `src/services/anonymousUsageTracker.ts` - Usage tracking implementation

---

**Status**: ✅ Complete
**Tested**: Local testing completed
**Deployed**: Ready for production
**Next Steps**: Monitor anonymous user import usage and adjust limits if needed
