# Supabase Security Audit Report

## Overview
This document evaluates the security warnings reported by Supabase's database linter for the Chess Analytics application. The app has been running for a couple of days.

## Executive Summary

**Overall Risk Level:** ⚠️ **MEDIUM**

- **Critical Issues:** 0
- **High Priority:** 1 (Password Protection)
- **Medium Priority:** 2 (Function Search Paths, Materialized Views)
- **Low Priority:** 0

---

## Issue 1: Function Search Path Mutable
**Level:** WARN
**Category:** SECURITY
**Priority:** Medium

### Description
Multiple database functions do not have their `search_path` explicitly set, making them potentially vulnerable to search path injection attacks.

### Affected Functions (12 unique):
1. `track_player_search` (appears twice in warnings)
2. `update_updated_at_column` ✅ **FOUND IN CODE**
3. `track_game_analysis` (appears twice)
4. `track_pricing_page_view` (appears twice)
5. `get_dashboard_metrics`
6. `get_analyzed_players_stats`
7. `get_registration_details`
8. `get_user_analysis_stats`
9. `validate_subscription_data` ✅ **FOUND IN CODE**
10. `refresh_analytics_views`
11. `get_registration_stats`
12. `get_player_search_stats`

### Current Status
**Partially Fixed:** Some functions already have `SET search_path = public`:
- ✅ `update_updated_at_column` - **MISSING** `SET search_path` (found in line 259 of 20251030000001_create_user_accounts.sql)
- ✅ `validate_subscription_data` - **MISSING** `SET search_path` (found in line 45 of 20251030000007_fix_authenticated_users_schema.sql)
- ✅ `handle_new_user()` - Already has `SET search_path = public` ✓

**Not Found in Codebase:**
- `track_player_search`
- `track_game_analysis`
- `track_pricing_page_view`
- `get_dashboard_metrics`
- `get_analyzed_players_stats`
- `get_registration_details`
- `get_user_analysis_stats`
- `refresh_analytics_views`
- `get_registration_stats`
- `get_player_search_stats`

### Risk Assessment
**Current Risk: MEDIUM** 🟡

**Why it matters:**
- Without explicit `search_path`, functions can be vulnerable to search path injection
- Attackers could potentially create malicious functions/tables in schemas that appear before 'public' in the search path
- Functions with `SECURITY DEFINER` are especially vulnerable as they run with elevated privileges

**Mitigating factors:**
- Your app is very new (only a couple of days old)
- Limited user base reduces attack surface
- Most functions appear to not exist in your codebase (possibly created directly in Supabase Dashboard)
- The functions that do exist (`update_updated_at_column`, `validate_subscription_data`) are simple triggers with limited scope

### Recommended Action
**Priority: Fix Before Going to Production** 🔶

1. **Immediate**: Add `SET search_path = public` to the 2 functions found in your migrations:
   - `update_updated_at_column`
   - `validate_subscription_data`

2. **Investigate**: The 10 functions not found in your codebase:
   - Check if they exist in your Supabase Dashboard (SQL Editor)
   - If they exist, add `SET search_path = public` to each
   - If they don't exist, these warnings may be stale/false positives

3. **Reference**: Supabase provides a migration file example at:
   https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

---

## Issue 2: Materialized Views Exposed in API
**Level:** WARN
**Category:** SECURITY
**Priority:** Medium

### Description
Four materialized views are accessible via the Data APIs to anonymous and authenticated roles.

### Affected Views:
1. `analytics_hourly`
2. `analytics_daily`
3. `analytics_weekly`
4. `analytics_monthly`

### Current Status
**Not Found in Codebase:** These materialized views are not present in your migration files or codebase.

### Risk Assessment
**Current Risk: MEDIUM** 🟡

**Why it matters:**
- Materialized views can expose aggregated data that shouldn't be public
- Anonymous access means anyone can query this data without authentication
- Could expose business intelligence or user patterns

**Mitigating factors:**
- Views don't exist in your codebase (likely created manually or warnings are stale)
- If they do exist, they probably show aggregate analytics, not sensitive personal data
- RLS (Row Level Security) may still protect the underlying data

### Recommended Action
**Priority: Investigate Before Launch** 🔶

1. **Check Supabase Dashboard:**
   ```sql
   -- Run this in SQL Editor to check if views exist
   SELECT schemaname, matviewname, matviewowner
   FROM pg_matviews
   WHERE matviewname IN ('analytics_hourly', 'analytics_daily', 'analytics_weekly', 'analytics_monthly');
   ```

2. **If they exist:**
   - Review what data they expose
   - Remove API access for anonymous users:
     ```sql
     REVOKE SELECT ON analytics_hourly FROM anon;
     REVOKE SELECT ON analytics_hourly FROM authenticated;
     -- Repeat for other views
     ```
   - Grant access only to service_role:
     ```sql
     GRANT SELECT ON analytics_hourly TO service_role;
     ```

3. **If they don't exist:**
   - These warnings are likely stale
   - You can safely ignore them

---

## Issue 3: Leaked Password Protection Disabled ⚠️
**Level:** WARN
**Category:** SECURITY
**Priority:** HIGH 🔴

### Description
Supabase Auth's leaked password protection feature is currently disabled. This feature checks passwords against the HaveIBeenPwned.org database to prevent users from using compromised passwords.

### Current Status
**DISABLED** - This is a critical security feature that should be enabled.

### Risk Assessment
**Current Risk: HIGH** 🔴

**Why it matters:**
- Users may choose passwords that have been exposed in data breaches
- Compromised passwords are the #1 cause of account takeovers
- Simple to fix and provides significant security improvement

**Mitigating factors:**
- Your app is very new with limited users
- No known breaches yet
- Can be enabled quickly

### Recommended Action
**Priority: FIX IMMEDIATELY** 🚨

This is the easiest and most impactful fix of all the warnings.

**How to Fix:**
1. Go to Supabase Dashboard → Authentication → Settings
2. Find "Password strength and leaked password protection"
3. Enable "Leaked Password Protection"
4. Save changes

**No code changes required** - this is a configuration setting.

**Benefits:**
- Prevents users from using passwords found in 600M+ breached passwords
- Minimal performance impact (< 100ms on signup/password change)
- Free to use (HaveIBeenPwned API is free)
- No changes needed to existing passwords

---

## Recommended Action Plan

### Phase 1: Immediate (Do Today) ⚡
1. **Enable Leaked Password Protection** in Supabase Dashboard (5 minutes)
   - Risk: HIGH → LOW
   - Effort: Very Low
   - Impact: High

### Phase 2: Before Production Launch (This Week) 📋
1. **Fix `update_updated_at_column` function** - Add `SET search_path = public`
2. **Fix `validate_subscription_data` function** - Add `SET search_path = public`
3. **Investigate materialized views** - Check if they exist and secure them
4. **Investigate missing functions** - Check if the 10 unaccounted functions exist

### Phase 3: Ongoing (Next Week) 🔄
1. **Create a SQL script** to check for search_path issues periodically
2. **Document** all custom functions in migration files
3. **Set up monitoring** for new security warnings from Supabase

---

## SQL Fixes to Apply

### Fix 1: Update `update_updated_at_column` function

Run this in Supabase SQL Editor:

```sql
-- Fix update_updated_at_column with proper search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at_column() IS 'Auto-updates updated_at timestamp. Search path set to public for security.';
```

### Fix 2: Update `validate_subscription_data` function

Run this in Supabase SQL Editor:

```sql
-- Fix validate_subscription_data with proper search_path
CREATE OR REPLACE FUNCTION validate_subscription_data()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- If account_tier is paid but no stripe_customer_id, log warning
    IF NEW.account_tier IN ('pro_monthly', 'pro_yearly', 'pro', 'enterprise') THEN
        IF NEW.stripe_customer_id IS NULL THEN
            RAISE WARNING 'User % has paid tier % but no stripe_customer_id', NEW.id, NEW.account_tier;
        END IF;

        -- If subscription is active, should have subscription_id (unless enterprise custom)
        IF NEW.subscription_status = 'active' AND NEW.stripe_subscription_id IS NULL AND NEW.account_tier != 'enterprise' THEN
            RAISE WARNING 'User % has active subscription but no stripe_subscription_id', NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_subscription_data() IS 'Validates subscription data consistency. Search path set to public for security.';
```

### Fix 3: Investigate Missing Functions

Run this query to see all functions in your database:

```sql
-- List all functions in the public schema
SELECT
    routine_name as function_name,
    routine_definition as definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
AND routine_name IN (
    'track_player_search',
    'track_game_analysis',
    'track_pricing_page_view',
    'get_dashboard_metrics',
    'get_analyzed_players_stats',
    'get_registration_details',
    'get_user_analysis_stats',
    'refresh_analytics_views',
    'get_registration_stats',
    'get_player_search_stats'
)
ORDER BY routine_name;
```

### Fix 4: Investigate Materialized Views

```sql
-- Check if materialized views exist
SELECT
    schemaname,
    matviewname,
    matviewowner,
    definition
FROM pg_matviews
WHERE schemaname = 'public'
AND matviewname IN ('analytics_hourly', 'analytics_daily', 'analytics_weekly', 'analytics_monthly');

-- If they exist, check who has access
SELECT
    table_schema,
    table_name,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name IN ('analytics_hourly', 'analytics_daily', 'analytics_weekly', 'analytics_monthly')
ORDER BY table_name, grantee;
```

---

## Conclusion

Your Chess Analytics app has **good security fundamentals** with RLS enabled and proper authentication. The warnings identified are:

1. **Password Protection** - Quick fix, high impact ✅ **DO THIS FIRST**
2. **Function Search Paths** - Medium priority, straightforward fixes
3. **Materialized Views** - Need investigation to confirm they exist

Since your app is only a couple of days old, **now is the perfect time** to address these issues before you have significant user data or traffic.

**Estimated time to fix everything:** 1-2 hours

---

## Additional Security Recommendations

While investigating these warnings, consider also:

1. **Rate Limiting**: Implement rate limiting on API endpoints
2. **Audit Logging**: Enable Supabase audit logging for sensitive operations
3. **Environment Security**: Ensure all secrets are properly stored (not in git)
4. **CORS Configuration**: Verify CORS settings are production-ready
5. **Database Backups**: Enable automated backups in Supabase

---

## References

- [Supabase Database Linter Documentation](https://supabase.com/docs/guides/database/database-linter)
- [Function Search Path Security](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Materialized Views in API](https://supabase.com/docs/guides/database/database-linter?lint=0016_materialized_view_in_api)
- [Password Security Best Practices](https://supabase.com/docs/guides/auth/password-security)
- [PostgreSQL Search Path Security](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)

---

**Report Generated:** 2025-11-02
**App Status:** Early Development (2 days old)
**Overall Assessment:** Medium risk, easily addressable
