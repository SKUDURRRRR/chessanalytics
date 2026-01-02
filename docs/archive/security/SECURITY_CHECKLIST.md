# Database Security Checklist

**Run this checklist after every database change or migration**

## Pre-Deployment Checks

- [ ] All public tables have RLS enabled
- [ ] No views with SECURITY DEFINER in public schema exposing auth data
- [ ] No auth.users data exposed to anon role
- [ ] All policies tested with actual user roles
- [ ] Migrations tested in staging environment first

## Post-Deployment Verification

### 1. Run Supabase Linter
- [ ] Dashboard → Security Advisor → Run Linter
- [ ] Verify 0 critical errors
- [ ] Review and address any warnings

### 2. Verify RLS on Critical Tables

```sql
-- Copy/paste into SQL Editor
SELECT
    tablename,
    CASE
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS DISABLED - FIX NOW!'
    END as rls_status,
    (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN (
    'authenticated_users',
    'payment_transactions',
    'user_credits',
    'usage_tracking',
    'games',
    'game_analyses',
    'move_analyses'
  )
ORDER BY tablename;
```

**Expected:** All tables should show "✅ RLS Enabled" with policy_count > 0

### 3. Check for Unsafe Views

```sql
SELECT
    viewname,
    definition
FROM pg_views
WHERE schemaname = 'public'
  AND (
    definition ILIKE '%auth.users%'
    OR definition ILIKE '%security definer%'
  );
```

**Expected:** No rows returned (or only views you explicitly created and secured)

### 4. Verify Grants

```sql
SELECT
    grantee,
    table_schema,
    table_name,
    string_agg(privilege_type, ', ') as privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name LIKE '%user%'
GROUP BY grantee, table_schema, table_name
ORDER BY table_name, grantee;
```

**Expected:** anon should have minimal access, authenticated should only access their own data

## Ongoing Monitoring

### Weekly
- [ ] Review Supabase Security Advisor
- [ ] Check for new linter warnings
- [ ] Review database access logs (if available)

### After Every Migration
- [ ] Run linter immediately after applying
- [ ] Verify RLS status on all modified tables
- [ ] Test with actual user accounts (not service role)

### Monthly
- [ ] Full security audit
- [ ] Review and update RLS policies
- [ ] Check for unused/orphaned policies
- [ ] Verify service role usage is appropriate

## Access Control

- [ ] Limit who has Supabase admin access
- [ ] Use service role only in backend, never in frontend
- [ ] All schema changes via migrations (not manual SQL)
- [ ] Require peer review for migration files
- [ ] Test migrations in staging before production

## Emergency Procedures

If linter shows critical errors:

1. **Immediately check what data is exposed**
2. **Fix the issue right away** (don't wait)
3. **Investigate how it happened**
4. **Review access logs for potential breach**
5. **Update this checklist** to prevent recurrence

## Quick Fix Commands

### Re-enable RLS
```sql
ALTER TABLE public.TABLE_NAME ENABLE ROW LEVEL SECURITY;
```

### Check RLS Status
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'TABLE_NAME';
```

### List All Policies
```sql
SELECT * FROM pg_policies WHERE tablename = 'TABLE_NAME';
```

---

## Last Security Check Performed

**Date:** November 3, 2025
**Issues Found:** 4 critical errors
**Issues Fixed:** All 4 errors resolved
**Next Check Due:** November 10, 2025

---

## Notes

- Security Advisor saved us from a major data exposure
- RLS was disabled, unknown how - investigate team access
- Added this checklist to prevent future issues
- All migrations should be reviewed for security implications
