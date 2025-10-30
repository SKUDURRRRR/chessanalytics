# Anonymous User Limits - Complete Implementation Guide

## Overview

This guide provides all the code changes needed to implement anonymous user limitations:
- **100 game imports** (one-time limit)
- **1 analysis** (one-time limit)
- **No auto-sync** for anonymous users
- **Registration invitation modal** when limits reached

## Files Created

### 1. ✅ `src/services/anonymousUsageTracker.ts` - CREATED
Tracks anonymous usage in localStorage.

### 2. ✅ `src/components/AnonymousLimitModal.tsx` - CREATED
Modal shown when anonymous user hits limits.

### 3. ✅ `supabase/migrations/20250131000001_allow_anon_read_access.sql` - CREATED
Allows anonymous users to read data (but not write).

## Files to Modify

### 3. `src/pages/SimpleAnalyticsPage.tsx`

Add imports at the top:
```typescript
import { AnonymousUsageTracker } from '../services/anonymousUsageTracker'
import AnonymousLimitModal from '../components/AnonymousLimitModal'
```

Add state variables (around line 80):
```typescript
const [anonymousLimitModalOpen, setAnonymousLimitModalOpen] = useState(false)
const [anonymousLimitType, setAnonymousLimitType] = useState<'import' | 'analyze'>('import')
```

Update `startAnalysis` function (around line 300):
```typescript
const startAnalysis = async () => {
  console.log('[SimpleAnalytics] Starting analysis...')

  // Check anonymous user limits
  if (!user) {
    if (!AnonymousUsageTracker.canAnalyze()) {
      console.log('[SimpleAnalytics] Anonymous user reached analysis limit')
      setAnonymousLimitType('analyze')
      setAnonymousLimitModalOpen(true)
      return
    }
  }

  if (analyzing || !userId) {
    console.log('[SimpleAnalytics] Already analyzing or no user ID')
    return
  }

  // ... rest of existing startAnalysis code ...

  // After successful analysis, increment anonymous usage
  try {
    const result = await UnifiedAnalysisService.startBatchAnalysis({
      user_id: userId,
      platform: platform as 'lichess' | 'chess.com',
      analysis_type: 'stockfish',
      limit: 10,
      depth: 14,
      skill_level: 20
    })

    // Increment anonymous usage after successful start
    if (!user && result.success) {
      AnonymousUsageTracker.incrementAnalyses()
    }
  } catch (error) {
    console.error('[SimpleAnalytics] Analysis error:', error)
  }
}
```

Update auto-sync UI (around line 820) - hide for anonymous users:
```typescript
{/* Show auto-sync only for authenticated users */}
{user && (
  <div className="flex items-center gap-2">
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={autoSync}
        onChange={(e) => setAutoSync(e.target.checked)}
        className="rounded"
      />
      Auto-sync latest games
    </label>
  </div>
)}

{/* Explain to anonymous users why they can't use auto-sync */}
{!user && (
  <div className="text-sm text-slate-400 italic">
    Sign in to enable auto-sync
  </div>
)}
```

Add modal at the end of the component (before closing tags):
```typescript
{/* Anonymous limit modal */}
<AnonymousLimitModal
  isOpen={anonymousLimitModalOpen}
  onClose={() => setAnonymousLimitModalOpen(false)}
  limitType={anonymousLimitType}
/>
```

### 4. `src/components/simple/PlayerSearch.tsx`

Add imports at the top:
```typescript
import { AnonymousUsageTracker } from '../../services/anonymousUsageTracker'
import AnonymousLimitModal from '../AnonymousLimitModal'
```

Add state variables:
```typescript
const [anonymousLimitModalOpen, setAnonymousLimitModalOpen] = useState(false)
const [anonymousLimitType, setAnonymousLimitType] = useState<'import' | 'analyze'>('import')
```

Update `handleAutoImport` function to check limits:
```typescript
const handleAutoImport = async () => {
  // Check anonymous user import limits
  if (!user) {
    if (!AnonymousUsageTracker.canImport()) {
      console.log('[PlayerSearch] Anonymous user reached import limit')
      setAnonymousLimitType('import')
      setAnonymousLimitModalOpen(true)
      return
    }
  }

  if (importing || !validated) return

  // ... rest of existing import code ...

  try {
    const result = await AutoImportService.smartImport(
      normalizedUserId,
      selectedPlatform as 'lichess' | 'chess.com'
    )

    if (result.success) {
      // Increment anonymous usage after successful import
      if (!user && result.games_imported) {
        AnonymousUsageTracker.incrementImports(result.games_imported)
      }

      // ... rest of success handling ...
    }
  } catch (error) {
    console.error('[PlayerSearch] Import error:', error)
  }
}
```

Add modal before the closing tags:
```typescript
{/* Anonymous limit modal */}
<AnonymousLimitModal
  isOpen={anonymousLimitModalOpen}
  onClose={() => setAnonymousLimitModalOpen(false)}
  limitType={anonymousLimitType}
/>
```

### 5. Backend: No Changes Required!

The backend already:
- ✅ Uses service_role key to write data (bypasses RLS)
- ✅ Has optional authentication
- ✅ Has rate limiting (prevents abuse)

Frontend will gate-keep before making API calls.

## Apply Database Migration

Run this migration to allow anonymous users to **read** data:

```bash
psql $DATABASE_URL -f supabase/migrations/20250131000001_allow_anon_read_access.sql
```

Or in Supabase Studio:
1. Go to SQL Editor
2. Paste the migration file contents
3. Click "Run"

## Testing Checklist

### Anonymous User Testing

1. **Initial State**
   - [ ] Open browser in incognito mode
   - [ ] Visit the site (no login)
   - [ ] Verify you can search for a player

2. **Import Testing**
   - [ ] Import games (should work)
   - [ ] Check console: should see "Anonymous usage: X/100 imports used"
   - [ ] Try to import 100+ games total
   - [ ] Should see registration modal after 100
   - [ ] Modal should mention "100 imports per 24 hours" for free tier

3. **Analysis Testing**
   - [ ] Click "Analyze games" (should work first time)
   - [ ] Check console: should see "Anonymous usage: 1/1 analyses used"
   - [ ] Try to analyze again
   - [ ] Should see registration modal
   - [ ] Modal should mention "5 analyses per 24 hours" for free tier

4. **Auto-Sync Testing**
   - [ ] Look for auto-sync toggle
   - [ ] Should NOT see toggle for anonymous users
   - [ ] Should see message: "Sign in to enable auto-sync"

5. **Modal Testing**
   - [ ] Hit a limit
   - [ ] Modal should appear
   - [ ] Should have "Sign Up Free" button
   - [ ] Should have "Log In" button
   - [ ] Should mention "No credit card required"
   - [ ] Click "Maybe later" - modal closes
   - [ ] Try action again - modal appears again

6. **Bypass Testing**
   - [ ] Open DevTools → Application → Local Storage
   - [ ] Delete `chess_analytics_anonymous_usage` key
   - [ ] Refresh page
   - [ ] Limits should be reset (this is expected behavior)

### Authenticated User Testing

1. **Free Tier User**
   - [ ] Sign in as free tier user
   - [ ] Should NOT see anonymous limit modals
   - [ ] Should see "100 imports per 24 hours" in usage stats
   - [ ] Should see "5 analyses per 24 hours" in usage stats
   - [ ] Auto-sync toggle should appear

2. **Pro User**
   - [ ] Sign in as pro user
   - [ ] Should see "Unlimited" in navigation
   - [ ] No import/analysis limits
   - [ ] Auto-sync toggle should appear

## Summary

### What We Built

1. **localStorage-based tracking** for anonymous users
2. **Registration invitation modal** with clear benefits
3. **Frontend gate-keeping** before API calls
4. **Auto-sync disabled** for anonymous users
5. **Clear messaging** about free tier benefits

### Why This Approach?

**Pros:**
- ✅ Simple implementation
- ✅ Good UX (no forced registration)
- ✅ Clear conversion funnel
- ✅ Encourages registration
- ✅ Protects against casual abuse
- ✅ Backend still has rate limiting

**Cons:**
- ⚠️ Can be bypassed (acceptable trade-off)
- ⚠️ Per-browser limits (acceptable)

### Security Notes

- Anonymous limits can be bypassed by clearing localStorage
- This is **acceptable** because:
  - Backend still has rate limiting (protects resources)
  - Data is public anyway (no privacy risk)
  - Goal is conversion, not perfect security
  - Sophisticated users who bypass will likely register
  - It provides friction for casual users

## Next Steps

1. ✅ Apply the database migration
2. ✅ Make the frontend code changes
3. ✅ Test thoroughly in incognito mode
4. ✅ Monitor conversion rates
5. 📊 Track how many anonymous users hit limits
6. 📊 Track conversion rate from modal to registration

## Future Enhancements

Consider adding:
- Analytics tracking when modal is shown
- A/B testing different modal messages
- Different limits for different regions
- Referral codes for extended anonymous limits
- "Share on social" to get +1 analysis
