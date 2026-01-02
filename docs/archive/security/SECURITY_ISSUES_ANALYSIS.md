# Security Issues Analysis - Supabase Linter Report

**Date**: November 3, 2025
**Severity**: 🚨 **CRITICAL**
**Status**: Requires Immediate Action

---

## Executive Summary

Your Supabase database has **4 critical security errors** that need immediate attention. Since your app has only been running for a couple of days, the exposure window is limited, but these issues could expose sensitive user data including payment information.

---

## Issues Identified

### 1. ❌ **auth_users_exposed** - ERROR
**View**: `user_registration_status` in `public` schema
**Risk**: Exposes `auth.users` data to anonymous roles
**Severity**: HIGH

**Details:**
- A view named `user_registration_status` may expose sensitive authentication data
- View is accessible to `anon` (unauthenticated) users
- This view is **NOT** in your migration files (likely created manually or by mistake)

---

### 2. 🚨 **policy_exists_rls_disabled** - ERROR
**Table**: `public.authenticated_users`
**Risk**: RLS policies exist but RLS is **NOT ENABLED**
**Severity**: CRITICAL

**Details:**
- Table has 4 RLS policies defined:
  - "Service role full access"
  - "Users can insert own profile on signup"
  - "Users can update own profile"
  - "Users can view own profile"
- **But RLS is disabled**, meaning policies are not enforced
- All user data is accessible without restrictions

**Data at Risk:**
- User IDs (UUIDs)
- Stripe customer IDs
- Stripe subscription IDs
- Account tiers (free/pro/enterprise)
- Subscription status
- Subscription end dates
- Created/updated timestamps

---

### 3. ⚠️ **security_definer_view** - ERROR
**View**: `public.user_registration_status`
**Risk**: View defined with SECURITY DEFINER property
**Severity**: HIGH

**Details:**
- View runs with elevated privileges (view creator's permissions)
- Bypasses normal user permission checks
- Can expose data users shouldn't have access to

---

### 4. 🚨 **rls_disabled_in_public** - ERROR
**Table**: `public.authenticated_users`
**Risk**: Public table without RLS enabled
**Severity**: CRITICAL

**Details:**
- Table is exposed via PostgREST API
- RLS is not enabled, allowing unrestricted access
- Anyone with API access can read all user data

---

## Root Cause Analysis

### Why Did This Happen?

1. **RLS Was Disabled After Migration**
   - Your migration file (`20251030000001_create_user_accounts.sql`) explicitly enables RLS on line 26
   - Someone or something disabled it afterward (possibly via Supabase dashboard)

2. **Unknown View Created**
   - `user_registration_status` view doesn't exist in any migration
   - Likely created manually or by a debugging session

### Expected vs Actual State

| Component | Expected | Actual | Status |
|-----------|----------|--------|--------|
| `authenticated_users` RLS | ✅ Enabled | ❌ Disabled | 🚨 BROKEN |
| RLS Policies | ✅ 4 policies | ✅ 4 policies | ✅ EXISTS |
| `user_registration_status` view | ❌ Should not exist | ✅ Exists | 🚨 UNSAFE |

---

## Immediate Action Required

### Step 1: Verify Current State (Run in Supabase SQL Editor)

```sql
-- Check RLS status
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'authenticated_users' AND schemaname = 'public';

-- Check policies
SELECT
    policyname,
    cmd as operation,
    roles
FROM pg_policies
WHERE tablename = 'authenticated_users' AND schemaname = 'public'
ORDER BY policyname;

-- Check for unsafe view
SELECT
    viewname,
    definition
FROM pg_views
WHERE viewname = 'user_registration_status' AND schemaname = 'public';
```

### Step 2: Apply Security Fix (URGENT)

**Option A: Run the new migration**
```bash
# The migration file has been created for you
# Apply it via Supabase dashboard or CLI
```

**Option B: Run SQL directly in Supabase SQL Editor**
```sql
-- Re-enable RLS on authenticated_users
ALTER TABLE public.authenticated_users ENABLE ROW LEVEL SECURITY;

-- Drop unsafe view
DROP VIEW IF EXISTS public.user_registration_status CASCADE;

-- Verify fix
SELECT
    'RLS Status' as check_type,
    CASE
        WHEN rowsecurity THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END as status
FROM pg_tables
WHERE tablename = 'authenticated_users' AND schemaname = 'public'
UNION ALL
SELECT
    'Policy Count' as check_type,
    COUNT(*)::text || ' policies' as status
FROM pg_policies
WHERE tablename = 'authenticated_users' AND schemaname = 'public';
```

### Step 3: Verify Fix Applied

After running the fix, verify:

```sql
-- This should return TRUE
SELECT rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'authenticated_users';

-- This should return 0 rows (view should not exist)
SELECT * FROM pg_views WHERE viewname = 'user_registration_status';
```

---

## Risk Assessment

### Exposure Window
- **Duration**: ~2 days (since app launch)
- **Scope**: All users in `authenticated_users` table
- **Access Method**: Via PostgREST API (if accessed directly)

### Data Exposed
✅ **What was vulnerable:**
- All user account data
- Payment/subscription information
- Stripe customer IDs

❌ **What was NOT exposed:**
- Passwords (stored in `auth.users`, separate table)
- Payment card details (stored by Stripe, not in your DB)
- PGN/game data (has its own RLS policies)

### Likelihood of Exploitation

**LOW** - Because:
1. Your app is brand new (2 days old)
2. Most users access via your frontend (which uses service role)
3. Direct API access requires knowledge of Supabase URL
4. No evidence of malicious access (yet)

**BUT** - Fix immediately to prevent future exposure.

---

## Post-Fix Actions

### 1. Audit Database Access
```sql
-- Check recent activity (if you have logging enabled)
-- This depends on your Supabase plan and logging setup
```

### 2. Monitor Linter Going Forward

Run Supabase linter regularly:
```bash
# Via Supabase CLI
supabase db lint

# Or check in Supabase Dashboard
# Settings > Database > Linter
```

### 3. Add Security Checks to CI/CD

Create a verification script:

```bash
# scripts/verify-security.sh
echo "Checking database security..."
psql $DATABASE_URL -c "
  SELECT CASE
    WHEN rowsecurity THEN 'PASS'
    ELSE 'FAIL - RLS NOT ENABLED!'
  END
  FROM pg_tables
  WHERE tablename = 'authenticated_users';
"
```

### 4. Document Required Security Settings

Create a checklist for database changes:
- [ ] All public tables have RLS enabled
- [ ] No views with SECURITY DEFINER in public schema
- [ ] No auth.users data exposed to anon role
- [ ] Test with anonymous access before deploying

---

## Prevention Measures

### Add Migration Verification

After each migration, run:
```sql
-- Verify authenticated_users security
SELECT
    CASE
        WHEN NOT rowsecurity THEN
            'ERROR: RLS not enabled on authenticated_users'
        WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'authenticated_users') < 4 THEN
            'ERROR: Missing RLS policies'
        ELSE
            'OK: Security configured correctly'
    END as security_check
FROM pg_tables
WHERE tablename = 'authenticated_users';
```

### Lock Down Database Modifications

1. **Disable direct schema changes** via dashboard (for production)
2. **All changes via migrations** only
3. **Require review** before applying migrations
4. **Test in staging** first

---

## What to Tell Your Users

**IF** you find evidence of unauthorized access:
> "We identified and immediately fixed a security configuration issue that may have temporarily exposed account information. No passwords or payment card details were affected. We've implemented additional security measures to prevent similar issues."

**IF** no evidence of access (most likely):
> No need to notify users. This was caught early and fixed proactively.

---

## Questions to Answer

1. **How did RLS get disabled?**
   - Check who has admin access to Supabase
   - Review recent SQL query history
   - Check if any scripts or tools modify RLS settings

2. **Where did the view come from?**
   - Search codebase for "user_registration_status"
   - Check if any debugging/testing scripts create views
   - Ask team members if anyone created it manually

3. **Has anyone accessed the data?**
   - Check Supabase logs (if available)
   - Review API access logs
   - Monitor for suspicious activity

---

## Conclusion

✅ **Good News:**
- Caught early (only 2 days of exposure)
- Fix is simple (enable RLS + drop view)
- No passwords or card data exposed
- Migration file already created for you

🚨 **Action Items:**
1. ✅ Run the security fix **NOW** (migration created)
2. ⏳ Verify RLS is enabled after fix
3. ⏳ Drop the unsafe view
4. ⏳ Investigate how RLS was disabled
5. ⏳ Add security checks to deployment process

---

## Files Created

1. `supabase/migrations/20251103000001_verify_security_settings.sql` - Run this to fix issues
2. `SECURITY_ISSUES_ANALYSIS.md` - This document

## Next Steps

**RIGHT NOW:**
1. Open Supabase SQL Editor
2. Copy contents of `supabase/migrations/20251103000001_verify_security_settings.sql`
3. Run the migration
4. Verify all checks pass
5. Re-run Supabase linter to confirm errors are gone

**After Fix:**
1. Investigate how RLS was disabled
2. Add security verification to your deployment checklist
3. Enable Supabase linter in CI/CD pipeline
4. Review who has database admin access

---

**Status**: ⏳ Awaiting fix deployment
**Priority**: 🚨 CRITICAL - Do not wait
**Estimated Fix Time**: < 5 minutes
