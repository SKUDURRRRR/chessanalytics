# Debug Supabase Signup Issue - Step by Step

## Step 1: Check Supabase Logs (CRITICAL)

The frontend just shows "Database error saving new user", but the **real error** is in Supabase logs.

1. **Go to Supabase Dashboard**
2. **Click on your project**
3. **Go to "Logs" section** (left sidebar)
4. **Select "Database" or "Auth" logs**
5. **Try to sign up again** (trigger the error)
6. **Look for RED error messages** in the logs

### What to look for:

- Table not found errors
- Permission denied errors
- Constraint violation errors
- Trigger errors
- Foreign key errors

**Copy the exact error message** and share it!

---

## Step 2: Verify Trigger Exists

Run this in Supabase SQL Editor:

```sql
-- Check if trigger exists
SELECT
    trigger_schema,
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

**Expected**: Should show 1 row with trigger on `auth.users` table

---

## Step 3: Check Function Configuration

Run this in Supabase SQL Editor:

```sql
-- Check function configuration
SELECT
    p.proname as function_name,
    CASE p.prosecdef
        WHEN true THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as security_type,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.proconfig as configuration_settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'handle_new_user';
```

**Expected**: Should show `SECURITY DEFINER` and configuration should include `search_path=public`

---

## Step 4: Test Trigger Manually

Run this in Supabase SQL Editor to see if the trigger would work:

```sql
-- Test if we can manually call the function
DO $$
DECLARE
    test_record RECORD;
BEGIN
    -- Create a fake NEW record (simulating what the trigger receives)
    test_record := (gen_random_uuid())::RECORD;

    -- This simulates what the trigger does
    RAISE NOTICE 'Testing trigger with UUID: %', gen_random_uuid();

    -- Try to insert (will fail if UUID doesn't exist in auth.users, but we'll see the error)
    -- INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    -- VALUES (gen_random_uuid(), 'free', 'active');

END $$;
```

---

## Step 5: Check Table Permissions

Run this in Supabase SQL Editor:

```sql
-- Check who can insert into authenticated_users
SELECT
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'authenticated_users'
AND privilege_type = 'INSERT';
```

**Expected**: Should show permissions for `postgres`, `service_role`, `authenticated`, etc.

---

## Step 6: Check RLS Policies

Run this in Supabase SQL Editor:

```sql
-- Check RLS policies that might be blocking inserts
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'authenticated_users'
AND cmd IN ('INSERT', 'ALL');
```

**Expected**: Should show policies allowing inserts, especially for `service_role`

---

## Step 7: Check if authenticated_users Table Exists

Run this in Supabase SQL Editor:

```sql
-- Verify table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'authenticated_users'
ORDER BY ordinal_position;
```

**Expected**: Should show all columns including `id`, `account_tier`, `subscription_status`, etc.

---

## Step 8: Test Direct Insert (Service Role)

Run this in Supabase SQL Editor to test if we can insert at all:

```sql
-- Test direct insert (this should work in SQL editor which uses postgres role)
DO $$
DECLARE
    test_uuid UUID := gen_random_uuid();
BEGIN
    -- Try direct insert
    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (test_uuid, 'free', 'active');

    RAISE NOTICE 'Successfully inserted test record with id: %', test_uuid;

    -- Clean up test record
    DELETE FROM public.authenticated_users WHERE id = test_uuid;

    RAISE NOTICE 'Test complete - cleaned up test record';
END $$;
```

**Expected**: Should succeed with "Successfully inserted test record"

---

## Step 9: Check for Other Triggers on authenticated_users

Other triggers might be interfering:

```sql
-- Check all triggers on authenticated_users
SELECT
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'authenticated_users'
ORDER BY action_timing, event_manipulation;
```

**Look for**: `validate_subscription_data_trigger` or other BEFORE INSERT triggers that might be failing

---

## Step 10: Try Creating a Test User Manually

Let's test the complete flow:

```sql
-- IMPORTANT: Only run this in SQL Editor, not in your app
-- This simulates what should happen during signup

DO $$
DECLARE
    test_email TEXT := 'test_' || floor(random() * 1000000)::text || '@test.com';
    test_user_id UUID;
BEGIN
    RAISE NOTICE 'Creating test user with email: %', test_email;

    -- Note: We can't directly insert into auth.users from here
    -- But we can test if the authenticated_users insert would work

    test_user_id := gen_random_uuid();

    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (test_user_id, 'free', 'active');

    RAISE NOTICE 'Successfully created authenticated_users record for: %', test_user_id;

    -- Check the record
    SELECT * FROM public.authenticated_users WHERE id = test_user_id;

    -- Clean up
    DELETE FROM public.authenticated_users WHERE id = test_user_id;

    RAISE NOTICE 'Test complete - cleaned up';
END $$;
```

---

## Common Issues and Solutions

### Issue 1: Trigger doesn't exist
**Solution**: Run the migration again

### Issue 2: Function missing search_path
**Solution**: Already fixed (you ran this)

### Issue 3: RLS policy blocking insert
**Solution**: Ensure service_role policy exists:
```sql
CREATE POLICY IF NOT EXISTS "Service role full access" ON authenticated_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
```

### Issue 4: validate_subscription_data_trigger failing
**Solution**: Check if this trigger is raising an exception instead of just a warning

---

## Next Steps

1. **Run Step 1 FIRST** - Check Supabase logs for actual error
2. **Share the error message** from the logs
3. Run the other diagnostic queries to narrow down the issue

The logs will tell us exactly what's failing!
