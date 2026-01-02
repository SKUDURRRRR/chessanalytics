# User Registration Fix

## Problem
Users were unable to register with email, receiving the error: **"Database error saving new user"**

## Root Cause Analysis

### The Issue
The frontend code in `AuthContext.tsx` was **manually trying to insert** a record into the `authenticated_users` table after signup:

```typescript
// Lines 191-194 (OLD CODE - REMOVED)
await supabase.from('authenticated_users').insert({
  id: session.session.user.id,
  account_tier: 'free'
})
```

However, the database already has a **trigger** that automatically creates the `authenticated_users` record:

```sql
-- From migration: 20251030000004_auto_create_authenticated_user.sql
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
```

### Why This Caused the Error

1. **User signs up** → Supabase creates entry in `auth.users`
2. **Database trigger fires** → `handle_new_user()` creates entry in `authenticated_users` with **elevated privileges** (SECURITY DEFINER)
3. **Frontend code tries to insert** → Attempts to create the same record
4. **Conflict/RLS violation** → Either:
   - The record already exists (conflict)
   - The user's session isn't fully established yet, so `auth.uid()` returns null
   - RLS policy `"Users can insert own profile on signup"` fails because `auth.uid() != id`

## The Fix

### 1. Removed Manual Insert from Frontend
**File**: `src/contexts/AuthContext.tsx`

**Changed**: Removed lines 186-201 that manually inserted into `authenticated_users`

**Reason**: The database trigger `on_auth_user_created` handles this automatically with elevated permissions, ensuring it works reliably.

```typescript
// NEW CODE (simplified)
try {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`
    }
  })

  // The database trigger (on_auth_user_created) automatically creates
  // the authenticated_users record when a new user signs up.
  // No need to manually insert - the trigger handles it with elevated permissions.

  if (error) {
    logger.warn('Sign up failed:', error.message)
  } else {
    logger.log('Sign up successful')
  }

  return { error }
}
```

## How It Works Now

1. **User submits registration form**
2. **Frontend calls** `supabase.auth.signUp()`
3. **Supabase creates user** in `auth.users` table
4. **Database trigger fires** → `on_auth_user_created` trigger
5. **Trigger executes** `handle_new_user()` function with **SECURITY DEFINER** (elevated privileges)
6. **Function inserts** into `authenticated_users`:
   ```sql
   INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
   VALUES (NEW.id, 'free', 'active')
   ON CONFLICT (id) DO NOTHING;
   ```
7. **User is registered** successfully!

## Database Migrations Involved

1. **`20251030000001_create_user_accounts.sql`**
   - Creates `authenticated_users` table
   - Sets up RLS policies
   - Creates initial trigger

2. **`20251030000004_auto_create_authenticated_user.sql`**
   - Ensures `handle_new_user()` function is created correctly
   - Ensures `on_auth_user_created` trigger is set up
   - Backfills existing users

3. **`20251030000007_fix_authenticated_users_schema.sql`**
   - Adds validation trigger
   - Adds username field
   - Improves subscription status constraints

## Testing Checklist

- [ ] Test email registration (should work now)
- [ ] Test Google OAuth registration
- [ ] Test Chess.com OAuth registration
- [ ] Verify `authenticated_users` record is created automatically
- [ ] Check that user can login after registration
- [ ] Verify email confirmation flow works

## Verification Steps

1. **Try to register a new user** with email/password
2. **Check database** - Run this in Supabase SQL Editor:
   ```sql
   -- Check if user was created in both tables
   SELECT
       au.id,
       au.email,
       au.created_at as auth_created,
       pu.account_tier,
       pu.subscription_status,
       pu.created_at as profile_created
   FROM auth.users au
   LEFT JOIN authenticated_users pu ON pu.id = au.id
   ORDER BY au.created_at DESC
   LIMIT 5;
   ```
3. **Verify trigger is working**:
   ```sql
   -- Check trigger exists
   SELECT trigger_name, event_manipulation, event_object_table
   FROM information_schema.triggers
   WHERE trigger_name = 'on_auth_user_created';
   ```

## Files Modified

- `src/contexts/AuthContext.tsx` - Removed manual insert logic

## Files for Testing

- `test_registration.sql` - SQL queries to verify setup

## Additional Notes

- The trigger uses `SECURITY DEFINER` which means it runs with **elevated privileges** regardless of who triggers it
- This ensures the insert succeeds even when the user's session isn't fully established
- The `ON CONFLICT (id) DO NOTHING` ensures idempotency (safe to run multiple times)
- The trigger is already applied in production via the migration files

## Deployment

✅ **No database changes needed** - migrations are already applied
✅ **Frontend fix only** - just deploy the updated `AuthContext.tsx`

## Related Issues

- This fix also resolves any OAuth registration issues
- Dashboard tracking should now work correctly since users are properly created
