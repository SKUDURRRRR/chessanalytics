
# CRITICAL FIX: User Registration "Database error saving new user"

## Root Cause Identified

The issue was **NOT** in the frontend code. The problem is in the **database trigger function** itself.

### The Problem

Migration `20251030000004_auto_create_authenticated_user.sql` **overwrote** the `handle_new_user()` function and **removed** a critical setting:

**Missing**: `SET search_path = public`

```sql
-- BAD (Migration 20251030000004, line 9-18)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- ❌ Missing SET search_path!
```

### Why This Breaks Registration

Without `SET search_path = public`:
1. The trigger runs when a user signs up
2. The function tries to INSERT into `authenticated_users`
3. But it can't find the table because the search_path isn't set
4. The INSERT fails silently or with "table not found" error
5. Supabase returns "Database error saving new user"

### The Fix

I created a new migration that adds back the missing `SET search_path = public`:

**File**: `supabase/migrations/20251102000001_fix_handle_new_user_search_path.sql`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER  -- Runs with elevated privileges
SET search_path = public  -- ✅ CRITICAL: Ensures function finds the correct schema
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;
```

## Deployment Steps

### Option 1: Run the Migration (RECOMMENDED)

1. **Go to Supabase Dashboard** → SQL Editor
2. **Copy and paste** the contents of `supabase/migrations/20251102000001_fix_handle_new_user_search_path.sql`
3. **Click "Run"**
4. **Verify** - You should see the function is recreated

### Option 2: Quick Fix (Run SQL Directly)

Run this single SQL command in Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;
```

## Verification

After running the fix, test registration:

1. **Try to register** a new user with email/password
2. **Should work now!** ✅

You can also run the diagnostic script to verify:
```bash
# File: diagnose_signup_issue.sql
# Run in Supabase SQL Editor
```

## Files Involved

### Modified/Created:
- ✅ `src/contexts/AuthContext.tsx` - Removed redundant manual insert (still good to have)
- ✅ `supabase/migrations/20251102000001_fix_handle_new_user_search_path.sql` - **THE ACTUAL FIX**

### Diagnostic Files (optional):
- `diagnose_signup_issue.sql` - Run to check database state
- `fix_handle_new_user_search_path.sql` - Same as migration, kept for reference

## Why Both Fixes Were Needed

1. **Frontend fix** (AuthContext.tsx): Removed conflict/race condition
2. **Database fix** (this one): Fixed the actual broken trigger

Both issues existed, but the database trigger was the **primary blocker**.

## Technical Details

### What is `SET search_path`?

In PostgreSQL, `search_path` determines which schemas are searched for tables/functions. When a function has `SECURITY DEFINER`, it runs with the creator's privileges, but the search_path might not include `public` by default.

Without `SET search_path = public`:
- The function looks for `authenticated_users` in the default schema
- It might not find it, causing the INSERT to fail
- This results in "Database error saving new user"

With `SET search_path = public`:
- The function explicitly looks in the `public` schema
- It finds `authenticated_users` correctly
- The INSERT succeeds ✅

## Timeline of Issue

1. **Migration 20251030000001**: Created `handle_new_user()` with `SET search_path = public` ✅
2. **Migration 20251030000004**: Overwrote function, forgot `SET search_path` ❌
3. **Yesterday**: Added dashboard tracking - noticed registration broken
4. **Today**: Fixed frontend (removed redundant insert) - still broken
5. **Now**: Fixed database trigger (added back search_path) - **SHOULD WORK NOW!** ✅

## Next Steps

1. **Deploy the migration** to Supabase (run the SQL)
2. **Test registration** - should work immediately
3. **Check dashboard tracking** - should see new users
4. **Monitor** - verify no more "Database error saving new user"

## Prevention

Going forward, when creating migrations that modify functions:
- Always include `SET search_path = public` for functions that access public schema tables
- Test migrations in a staging environment first
- Review previous versions before modifying functions
