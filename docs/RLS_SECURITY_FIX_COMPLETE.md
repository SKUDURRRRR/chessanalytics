# Row Level Security (RLS) Fix Complete

## Summary

Fixed critical security vulnerabilities in `RESTORE_SECURE_RLS_POLICIES.sql` that were granting blanket public access to sensitive data through insecure "OR true" clauses.

## Changes Made

### 1. **Enabled Row Level Security (RLS)**
Added explicit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements for all affected tables:
- `games`
- `games_pgn`
- `user_profiles`

### 2. **Added is_public Column for Selective Public Access**
Instead of granting blanket access, added an `is_public` boolean column to:
- `games` table (defaults to false)
- `games_pgn` table (defaults to false)

**Benefits:**
- Selective public access control
- Performance-optimized with partial indexes on `WHERE is_public = true`
- Idempotent migrations that check for column existence before adding

### 3. **Removed Insecure "OR true" Clauses**

#### Before (INSECURE):
```sql
CREATE POLICY "games_select_own_or_public" ON games
  FOR SELECT
  USING (
    auth.uid()::text = user_id
    OR true  -- ⚠️ SECURITY RISK: Grants access to ALL data
  );
```

#### After (SECURE):
```sql
CREATE POLICY "games_select_own_or_public" ON games
  FOR SELECT
  USING (
    auth.uid()::text = user_id
    OR is_public = true  -- ✅ Only explicitly public data
  );
```

### 4. **Policy Updates**

**Games Table Policy:**
- Users can see their own games (authenticated)
- OR games explicitly marked as `is_public = true`

**Games PGN Table Policy:**
- Users can see their own PGN data (authenticated)
- OR PGN data explicitly marked as `is_public = true`

**User Profiles Table Policy:**
- Kept public read access (intentional for leaderboards)
- Only owners can update their profiles

### 5. **Service Role Policies**
- Maintained full access for service role
- Required for backend operations and batch processing

## Security Improvements

| Aspect | Before | After |
|--------|--------|-------|
| Games Access | Anyone can read ALL games | Users see only their games + explicitly public ones |
| PGN Access | Anyone can read ALL PGN data | Users see only their PGN + explicitly public ones |
| RLS Status | Not explicitly enabled | Explicitly enabled on all tables |
| Public Access | Blanket "OR true" | Selective via `is_public` column |

## Default Behavior

By default, all data is now **private** (`is_public = false`):
- New games are private by default
- New PGN data is private by default
- Only authenticated users see their own data
- Service role has full access for backend operations

## How to Make Data Public

To make specific games or PGN data public:

```sql
-- Make a specific game public
UPDATE games SET is_public = true WHERE game_id = 'some-game-id';

-- Make a specific PGN public
UPDATE games_pgn SET is_public = true WHERE game_id = 'some-game-id';
```

## Schema Reload

The script includes `NOTIFY pgrst, 'reload schema'` to immediately apply the policy changes to PostgREST.

## Next Steps

1. **Apply the migration**: Run `RESTORE_SECURE_RLS_POLICIES.sql` against your database
2. **Test access**:
   - Verify authenticated users can see their own data
   - Verify anonymous users cannot see private data
   - Verify service role operations still work
3. **Monitor logs**: Check for any access denied errors
4. **Update application logic**: If needed, add logic to set `is_public = true` for shareable content

## Rollback Plan

If you need to temporarily restore public access (NOT recommended):

```sql
-- Temporarily make all existing data public
UPDATE games SET is_public = true;
UPDATE games_pgn SET is_public = true;
```

For complete rollback to insecure state (NOT recommended), see the commented "ALTERNATIVE" section at the end of the SQL file.

## Additional Security Issues Found and Fixed

During the security audit, multiple insecure migration files were discovered and fixed:

### 1. **20250107000002_fix_games_rls_for_anon_access.sql**
**Issue**: Granted ALL permissions (SELECT, INSERT, UPDATE, DELETE) to anonymous users
```sql
CREATE POLICY "Allow anonymous access to games" ON games
  FOR ALL USING (true);  -- ⚠️ CRITICAL VULNERABILITY
GRANT ALL ON games TO anon;  -- ⚠️ ALLOWS ANONYMOUS DELETION
```
**Fix**: Deprecated the migration file with security warning

### 2. **20240101000010_fix_rls_policy.sql**
**Issue**: Same as above - blanket ALL permissions to anonymous users
**Fix**: Deprecated the migration file with security warning

### 3. **20241220000001_complete_rls_policies.sql**
**Issue**: Allowed all users to see ALL game analyses, move analyses, and game features
```sql
-- INSECURE: Anyone can see all analyses for all games
CREATE POLICY "game_analyses_select_all" ON game_analyses
    FOR SELECT USING (true);
```
**Fix**: Created secure version (`20241220000001_complete_rls_policies_SECURE.sql`) that:
- Restricts analyses to game owner OR public games
- Uses subquery to check game.is_public status
- Maintains data privacy while allowing selective sharing

## Security Impact Assessment

| File | Severity | Impact | Status |
|------|----------|--------|--------|
| RESTORE_SECURE_RLS_POLICIES.sql | High | Fixed "OR true" clauses | ✅ Fixed |
| 20250107000002_fix_games_rls_for_anon_access.sql | Critical | Anonymous could delete all data | ✅ Deprecated |
| 20240101000010_fix_rls_policy.sql | Critical | Anonymous could delete all data | ✅ Deprecated |
| 20241220000001_complete_rls_policies.sql | High | Data leakage across users | ✅ Secure version created |

## Migration Path

### For New Deployments
1. Skip the deprecated insecure migrations
2. Use `RESTORE_SECURE_RLS_POLICIES.sql`
3. Use `20241220000001_complete_rls_policies_SECURE.sql`

### For Existing Deployments
1. **Immediate**: Run `RESTORE_SECURE_RLS_POLICIES.sql` to secure games and games_pgn
2. **Then**: Run `20241220000001_complete_rls_policies_SECURE.sql` to secure analyses tables
3. **Verify**: Test that users can only see their own data
4. **Monitor**: Check logs for access denied errors

### Testing Security

```sql
-- Test 1: Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('games', 'games_pgn', 'game_analyses', 'move_analyses', 'game_features');
-- All should show rowsecurity = true

-- Test 2: Verify policies exist
SELECT tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- Test 3: Verify no "OR true" in policies (except user_profiles which is intentionally public)
SELECT tablename, policyname, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND qual::text LIKE '%OR true%'
AND tablename != 'user_profiles';
-- Should return 0 rows

-- Test 4: Test anonymous access (should fail for private data)
SET ROLE anon;
SELECT COUNT(*) FROM games WHERE is_public = false;
-- Should return 0 or error
RESET ROLE;
```

## References

- Original insecure policies: Lines 16-24, 32-40 (old RESTORE_SECURE_RLS_POLICIES.sql)
- User profiles intentionally public: For leaderboards and social features
- Service role policies: Required for backend operations
- Deprecated migrations: Listed above with security warnings

---

**Status**: ✅ Complete  
**Security Level**: High (proper RLS with selective public access)  
**Breaking Changes**: Yes (private by default)  
**Migration Safe**: Yes (idempotent, checks for existing columns)  
**Files Updated**: 4 files fixed (1 repaired, 2 deprecated, 1 secure replacement created)

