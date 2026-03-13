# Security Fix Quick Start Guide

## TL;DR

Your database had **CRITICAL** security vulnerabilities. Anonymous users could view, modify, and delete all data, including granting themselves admin access.

**Status**: ✅ All fixes prepared and ready to deploy

## Immediate Action Required

### Step 1: Revoke Insecure Permissions (URGENT)

If the insecure migrations are already applied to your database:

```bash
# Run this IMMEDIATELY
psql $DATABASE_URL -f REVOKE_INSECURE_PERMISSIONS.sql
```

This will:
- Revoke anonymous access to `app_admins` table
- Remove anonymous write permissions on all tables
- Restrict admin functions to authenticated users only

### Step 2: Apply Secure RLS Policies

```bash
# Apply the fixed policies
psql $DATABASE_URL -f RESTORE_SECURE_RLS_POLICIES.sql
psql $DATABASE_URL -f supabase/migrations/20241220000001_complete_rls_policies_SECURE.sql
```

### Step 3: Verify Security

```bash
psql $DATABASE_URL << 'EOF'
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'games';

-- Check for insecure "OR true"
SELECT COUNT(*) as insecure_policies FROM pg_policies
WHERE qual::text LIKE '%OR true%'
AND tablename != 'user_profiles';
-- Should return 0

-- Check anonymous permissions
SELECT COUNT(*) as anon_write_grants
FROM information_schema.table_privileges
WHERE grantee = 'anon'
AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
-- Should return 0 or very few
EOF
```

## What Was Fixed

### Critical Issues (3)
1. ❌ Anonymous users could modify `app_admins` table → ✅ Fixed
2. ❌ Blanket access to all games via `OR true` → ✅ Fixed
3. ❌ Anonymous users could delete any game → ✅ Fixed

### High Priority Issues (4)
4. ❌ Anyone could modify user profiles → ✅ Fixed
5. ❌ All PGN data was public → ✅ Fixed
6. ❌ All game analyses visible to everyone → ✅ Fixed
7. ❌ All move analyses visible to everyone → ✅ Fixed

### Medium Priority Issues (2)
8. ❌ Import sessions exposed → ✅ Fixed
9. ❌ System logs could be tampered → ✅ Fixed

## New Security Model

### Default Access (after fixes)

| Table | Anonymous | Authenticated | Owner | Service Role |
|-------|-----------|---------------|-------|--------------|
| games | Read public only | Read own + public | Full control | Full access |
| games_pgn | Read public only | Read own + public | Full control | Full access |
| game_analyses | Read public only | Read own + public | Full control | Full access |
| user_profiles | Read all | Read all, write own | Full control | Full access |
| app_admins | No access | No access | No access | Full access |

### Making Data Public

By default, all data is now **private**. To share data:

```sql
-- Make a specific game public
UPDATE games SET is_public = true WHERE game_id = 'xxx';
UPDATE games_pgn SET is_public = true WHERE game_id = 'xxx';

-- Make all your games public
UPDATE games SET is_public = true WHERE user_id = 'your-user-id';
UPDATE games_pgn SET is_public = true WHERE user_id = 'your-user-id';
```

## Breaking Changes

⚠️ **Yes, this is a breaking change if your application expects:**
- Anonymous users to see all games
- Public access to all user data
- Anyone to be able to modify data

### Migration Path

1. **Update backend**: Ensure your API uses `service_role` key for admin operations
2. **Update frontend**: Ensure users are authenticated before accessing their data
3. **Test thoroughly**: Verify that legitimate users can still access their data
4. **Optional**: Set `is_public = true` on games that should be shared publicly

## Testing Checklist

After applying fixes:

- [ ] Anonymous users can view public games
- [ ] Anonymous users CANNOT view private games
- [ ] Anonymous users CANNOT insert/update/delete data
- [ ] Authenticated users can view their own games
- [ ] Authenticated users can modify only their own data
- [ ] Service role (backend) can access all data
- [ ] Leaderboards still work (user_profiles are public read)
- [ ] No errors in application logs

## Rollback Plan

If you need to temporarily allow more access (NOT RECOMMENDED):

```sql
-- Temporarily make all data public
UPDATE games SET is_public = true;
UPDATE games_pgn SET is_public = true;
```

To fully rollback (VERY INSECURE):
```sql
-- See commented "ALTERNATIVE" section in RESTORE_SECURE_RLS_POLICIES.sql
-- NOT RECOMMENDED
```

## Files Modified

### Core Security Fixes
- `RESTORE_SECURE_RLS_POLICIES.sql` - Main fix (removed "OR true")
- `REVOKE_INSECURE_PERMISSIONS.sql` - Immediate permission revocation
- `supabase/migrations/20241220000001_complete_rls_policies_SECURE.sql` - Secure policies

### Updated Migrations
- `supabase/migrations/20250107000001_fix_user_profiles_schema.sql`
- `supabase/migrations/20241220000003_create_games_pgn_table.sql`

### Deprecated (DO NOT USE)
- `supabase/migrations/20250107000002_fix_games_rls_for_anon_access.sql`
- `supabase/migrations/20240101000010_fix_rls_policy.sql`

## Documentation

For more details, see:
- `SECURITY_AUDIT_COMPLETE.md` - Full audit report
- `RLS_SECURITY_FIX_COMPLETE.md` - Detailed fix documentation
- `supabase/migrations/20240101000014_align_with_remote_SECURITY_WARNING.md` - Additional warnings

## Support

If you encounter issues:

1. Check application logs for "permission denied" errors
2. Verify users are properly authenticated
3. Check that service_role key is used for backend operations
4. Review RLS policies: `SELECT * FROM pg_policies WHERE schemaname = 'public';`

## Timeline

- ✅ Security audit: Complete
- ✅ Fixes prepared: Complete
- ⏳ Apply to database: **Ready to run**
- ⏳ Test in staging: Next step
- ⏳ Deploy to production: After testing

---

**Priority**: 🚨 URGENT
**Risk**: Critical → Low (after fixes)
**Effort**: 5 minutes to apply
**Impact**: High (breaking change, but necessary for security)

**Next Step**: Run `REVOKE_INSECURE_PERMISSIONS.sql` NOW if vulnerabilities are present in your database.
