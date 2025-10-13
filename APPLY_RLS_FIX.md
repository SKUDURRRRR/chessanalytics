# Quick Guide: Apply RLS Security Fix

## 🚨 What This Fixes
Removes `OR true` vulnerability that allowed anonymous users to access all games data.

## ⚡ Quick Apply (3 Steps)

### Step 1: Apply the SQL
Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Drop the insecure anonymous policies
DROP POLICY IF EXISTS "Allow anonymous access to games" ON games;
DROP POLICY IF EXISTS "Allow anonymous access to games_pgn" ON games_pgn;

-- GAMES TABLE - Secure policy
DROP POLICY IF EXISTS "games_select_own_or_public" ON games;
CREATE POLICY "games_select_own_or_public" ON games
  FOR SELECT
  USING (
    auth.uid()::text = user_id
  );

-- Service role access
DROP POLICY IF EXISTS "games_service_role_all" ON games;
CREATE POLICY "games_service_role_all" ON games
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- GAMES_PGN TABLE - Secure policy
DROP POLICY IF EXISTS "games_pgn_select_own_or_public" ON games_pgn;
CREATE POLICY "games_pgn_select_own_or_public" ON games_pgn
  FOR SELECT
  USING (
    auth.uid()::text = user_id
  );

-- Service role access
DROP POLICY IF EXISTS "games_pgn_service_role_all" ON games_pgn;
CREATE POLICY "games_pgn_service_role_all" ON games_pgn
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
```

### Step 2: Test It
```bash
python test_rls_policies.py
```

Expected output:
```
✅ PASS: Anonymous Access Blocked
✅ PASS: Service Role Access
✅ PASS: User Isolation Check
```

### Step 3: Verify Manually
1. Open app in incognito (logged out) → Should see NO games
2. Log in → Should see YOUR games only

## 📋 One-Liner Commands

### Using Supabase CLI:
```bash
supabase db execute < RESTORE_SECURE_RLS_POLICIES.sql
```

### Using psql:
```bash
psql "$DATABASE_URL" -f RESTORE_SECURE_RLS_POLICIES.sql
```

## ✅ Success Indicators

After applying the fix, you should see:
- ✅ No errors when running the SQL
- ✅ Test script passes all checks
- ✅ Anonymous users cannot see games
- ✅ Logged-in users can see their own games

## ⚠️ Rollback (If Needed)

If something breaks and you need to temporarily restore access:

```sql
-- TEMPORARY - DO NOT USE IN PRODUCTION
DROP POLICY IF EXISTS "games_select_own_or_public" ON games;
CREATE POLICY "games_select_own_or_public" ON games
  FOR SELECT
  USING (true);  -- WARNING: This allows anonymous access!
```

But better approach: Fix the underlying issue instead of rolling back security!

## 🆘 Troubleshooting

### Error: "permission denied for table games"
**Solution**: Make sure RLS is enabled:
```sql
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_pgn ENABLE ROW LEVEL SECURITY;
```

### Error: "policy already exists"
**Solution**: Policies already applied! Verify with test script.

### Test fails: "Anonymous users can read games"
**Problem**: The OR true clause is still present
**Solution**: Re-run the SQL commands to drop and recreate policies

### Logged-in users can't see their games
**Problem**: Policy might be too restrictive or auth.uid() is null
**Solution**: Check that users are properly authenticated
```sql
-- Debug query (run in SQL Editor while logged in)
SELECT auth.uid()::text as my_user_id, 
       COUNT(*) as my_games_count 
FROM games 
WHERE user_id = auth.uid()::text;
```

## 📞 Need Help?

Check the detailed guide: `SECURITY_FIX_RLS_POLICIES.md`

---
**Remember**: Security > Convenience. Don't skip the testing step!

