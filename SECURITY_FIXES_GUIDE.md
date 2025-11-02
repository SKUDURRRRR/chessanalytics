# Security Fixes Guide

This guide covers the security issues identified in the Supabase database linter report.

## Issues Identified

### 1. Function Search Path Mutable (5 functions) ⚠️ **WARN**
### 2. Leaked Password Protection Disabled ⚠️ **WARN**

---

## ✅ Fix 1: Function Search Path Security

### What's the Problem?
Functions without a fixed `search_path` are vulnerable to search path manipulation attacks. A malicious user could create objects in their own schema that get called instead of the intended ones.

### Affected Functions:
- `update_updated_at_column`
- `claim_anonymous_data`
- `check_usage_limits`
- `cleanup_old_metrics`
- `handle_new_user`

### Solution Applied:
Created migration: `supabase/migrations/20251101000002_fix_function_search_path_security.sql`

This migration adds `SET search_path = public, pg_temp` to all affected functions.

### How to Apply:

#### Option 1: Using Supabase CLI (Recommended)
```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

#### Option 2: Manual Application
1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor**
3. Copy the contents of `supabase/migrations/20251101000002_fix_function_search_path_security.sql`
4. Paste and run the SQL

#### Option 3: Using psql
```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT].supabase.co:5432/postgres" \
  -f supabase/migrations/20251101000002_fix_function_search_path_security.sql
```

### Verification:
After applying, run this query in SQL Editor to verify:

```sql
SELECT
    p.proname AS function_name,
    CASE
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%'
        THEN '✅ Fixed'
        ELSE '❌ Missing'
    END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'update_updated_at_column',
    'claim_anonymous_data',
    'check_usage_limits',
    'cleanup_old_metrics',
    'handle_new_user'
  )
ORDER BY p.proname;
```

Expected result: All 5 functions should show "✅ Fixed"

---

## ✅ Fix 2: Enable Leaked Password Protection

### What's the Problem?
Leaked password protection prevents users from using passwords that have been compromised in data breaches (checked against HaveIBeenPwned.org database).

### Solution:
This cannot be fixed via SQL migration - it must be enabled in Supabase Dashboard.

### How to Apply:

1. Go to your Supabase Dashboard
2. Navigate to: **Authentication** → **Policies**
3. Scroll down to **Password Settings**
4. Find **"Leaked Password Protection"**
5. Toggle it **ON** ✅

### Settings Recommendation:
- **Leaked Password Protection**: `ON`
- **Minimum Password Length**: `8` (or higher)
- **Password Strength**: Consider setting to "Fair" or "Good"

---

## 🔍 Post-Deployment Verification

### 1. Run Supabase Linter Again
After applying all fixes, run the database linter to confirm issues are resolved:

```bash
# In Supabase Dashboard
# Go to: Database → Linter
# Click "Run Linter"
```

### 2. Expected Results:
- ✅ All 5 function warnings should be **GONE**
- ✅ Leaked password protection warning should be **GONE** (if enabled in dashboard)

---

## 📊 Impact Assessment

### Security Impact: **MEDIUM-HIGH**
- **Function Search Path Issues**: Could lead to privilege escalation or data manipulation
- **Leaked Password Protection**: Users could use compromised passwords, making accounts vulnerable

### Performance Impact: **NONE**
- These are security-only fixes
- No performance degradation expected
- Functions will execute identically

### Breaking Changes: **NONE**
- All function signatures remain the same
- Existing code will continue to work without changes

---

## 🚨 Rollback Plan

If something goes wrong, you can revert the migration:

```sql
-- Rollback: Remove search_path settings
-- (Not recommended unless absolutely necessary)

-- WARNING: This will re-introduce the security vulnerabilities!
-- Only use in emergency if migration causes issues.

-- You can manually recreate the original functions without
-- the SET search_path clause from the previous migration files.
```

---

## 📝 Additional Notes

### Why `pg_temp` is included:
- `SET search_path = public, pg_temp` is the recommended pattern
- `pg_temp` allows temporary tables to work correctly within functions
- It's still secure because temp tables are session-isolated

### `SECURITY DEFINER` functions:
Some functions have `SECURITY DEFINER`, which means they run with the privileges of the function owner (not the caller). These require extra security precautions, which is why setting `search_path` is critical.

Functions with `SECURITY DEFINER`:
- `claim_anonymous_data`
- `check_usage_limits`
- `cleanup_old_metrics`
- `handle_new_user`

---

## ✅ Checklist

- [ ] Review migration file: `supabase/migrations/20251101000002_fix_function_search_path_security.sql`
- [ ] Apply migration to database
- [ ] Verify all functions have search_path set
- [ ] Enable Leaked Password Protection in Supabase Dashboard
- [ ] Run Supabase Linter to confirm all warnings resolved
- [ ] Test key functionality (user registration, data claiming, etc.)
- [ ] Document deployment in your changelog

---

## 🔗 References

- [Supabase Linter: Function Search Path Mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Supabase Auth: Password Security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [PostgreSQL: Writing SECURITY DEFINER Functions Safely](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)

---

## Support

If you encounter any issues:
1. Check the Supabase logs for error messages
2. Verify the migration file syntax
3. Ensure you have proper database permissions
4. Contact Supabase support if needed
