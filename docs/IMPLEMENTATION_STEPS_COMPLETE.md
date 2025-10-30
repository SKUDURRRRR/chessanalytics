# Step-by-Step Implementation Guide

## ✅ Step 2: Frontend Changes - COMPLETE!

All frontend files have been updated:

1. ✅ `src/services/anonymousUsageTracker.ts` - Created
2. ✅ `src/components/AnonymousLimitModal.tsx` - Created
3. ✅ `src/pages/SimpleAnalyticsPage.tsx` - Updated
4. ✅ `src/components/simple/PlayerSearch.tsx` - Updated
5. ✅ No linter errors

## 🔄 Step 1: Apply Database Migration

You need to apply the migration to allow anonymous users to **read** data.

### Option A: Using psql Command Line

If you have psql installed and your database URL:

```bash
psql $DATABASE_URL -f supabase/migrations/20250131000001_allow_anon_read_access.sql
```

Or with explicit connection string:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" -f supabase/migrations/20250131000001_allow_anon_read_access.sql
```

### Option B: Using Supabase Studio (Recommended)

1. **Open Supabase Studio:**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Click "SQL Editor" in the left sidebar

2. **Open the Migration File:**
   - Open `supabase/migrations/20250131000001_allow_anon_read_access.sql` in your editor
   - Copy all the contents

3. **Run the Migration:**
   - Paste the SQL into Supabase SQL Editor
   - Click "Run" button
   - You should see success message

4. **Verify it Worked:**
   - Run this query in SQL Editor:

```sql
-- Check anonymous user permissions
SELECT table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'anon'
AND table_schema = 'public'
AND table_name IN ('games', 'games_pgn', 'move_analyses')
ORDER BY table_name, privilege_type;
```

Expected result: You should see `SELECT` permissions for those tables.

### Option C: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project (if not already done)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

## 🧪 Testing the Implementation

### Test 1: Anonymous User Can Import (Up to 100)

1. Open browser in **Incognito/Private mode**
2. Visit your app (e.g., http://localhost:3000)
3. Search for a player (e.g., "Magnus Carlsen")
4. Click "Import games"
5. **Expected:** Import works
6. Check browser console: `Anonymous usage: X/100 imports used`
7. Try importing more games (total >100)
8. **Expected:** Registration modal appears

### Test 2: Anonymous User Can Analyze (Once)

1. Still in incognito mode
2. After importing games, click "Analyze games"
3. **Expected:** Analysis starts
4. Check console: `Anonymous usage: 1/1 analyses used`
5. Try to analyze again
6. **Expected:** Registration modal appears

### Test 3: Auto-Sync Disabled for Anonymous

1. Still in incognito mode
2. Look for auto-sync toggle
3. **Expected:** No auto-sync toggle visible
4. Should see "Sign in to enable auto-sync"

### Test 4: Modal Content

When limit is reached:
- ✅ Modal should appear
- ✅ Title: "Import Limit Reached" or "Analysis Limit Reached"
- ✅ Message about free tier: "100 imports per 24 hours"
- ✅ Message about free tier: "5 analyses per 24 hours"
- ✅ "No credit card required"
- ✅ "Sign Up Free" button
- ✅ "Log In" button
- ✅ "Maybe later" button

### Test 5: Clearing Limits (Expected Behavior)

1. Open DevTools → Application → Local Storage
2. Find key `chess_analytics_anonymous_usage`
3. Delete it
4. Refresh page
5. **Expected:** Limits reset (this is by design)

### Test 6: Authenticated User Flow

1. Sign in with a real account
2. **Expected:** Should NOT see anonymous limit modals
3. **Expected:** Should see usage stats in navigation
4. **Expected:** Auto-sync toggle should appear
5. Import/analyze should use server-side tracking

## 🐛 Troubleshooting

### Problem: "Permission denied" when importing

**Cause:** Migration not applied yet

**Solution:** Apply the migration using one of the methods above

### Problem: Modal doesn't appear

**Cause:** localStorage not being checked

**Solution:**
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check console for errors

### Problem: Auto-sync still running for anonymous users

**Cause:** Browser cache

**Solution:**
1. Clear browser cache
2. Open incognito mode
3. Test again

### Problem: Limits not persisting

**Cause:** localStorage being cleared

**Solution:** This is expected behavior. The goal is to provide friction, not perfect security.

## 📊 What's Next?

After successful implementation:

1. **Monitor Conversion Rates:**
   - Track how many anonymous users hit limits
   - Track how many convert to registration
   - Optimize modal messaging based on data

2. **Consider A/B Testing:**
   - Different limit values (50 vs 100 imports)
   - Different modal messages
   - Different call-to-action buttons

3. **Add Analytics:**
   - Track when modal is shown
   - Track which button is clicked
   - Track time to conversion

4. **Future Enhancements:**
   - Referral codes for extended limits
   - Social sharing for +1 analysis
   - Progressive disclosure of features

## ✅ Completion Checklist

- [ ] Database migration applied successfully
- [ ] Tested import flow as anonymous user
- [ ] Tested analysis flow as anonymous user
- [ ] Verified auto-sync is disabled for anonymous
- [ ] Tested limit modals appear correctly
- [ ] Tested authenticated user flow still works
- [ ] Verified usage stats in navigation
- [ ] Confirmed no console errors
- [ ] Tested in production environment

## 🎉 You're Done!

Once you've completed the checklist above, your anonymous user limitations are fully implemented and working!

**What you've built:**
- ✅ Anonymous users can try the app (100 imports, 1 analysis)
- ✅ Clear conversion funnel to registration
- ✅ Beautiful invitation modal with benefits
- ✅ Protected against casual abuse
- ✅ Good user experience

**Remember:** The goal isn't perfect security, but rather:
1. Provide value to visitors
2. Encourage registration
3. Prevent casual overuse
4. Convert visitors to users
