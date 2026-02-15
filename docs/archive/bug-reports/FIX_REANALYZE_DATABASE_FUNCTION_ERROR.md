# Fix: Re-analyze "Failed to Fetch" - Database Function Error

## Problem
When clicking "Re-analyze", you get a "Failed to fetch" error. The actual error is:

```
Could not find the function public.check_anonymous_usage_limits(p_action_type, p_ip_address)
in the schema cache
```

## Root Causes

1. **For Registered Users (Most Common)**: The frontend wasn't sending the JWT authentication token, so the backend treated registered users as anonymous and tried to check anonymous limits, which failed because:
   - The migration hasn't been applied, OR
   - The database function doesn't exist

2. **For Anonymous Users**: The database migration that creates the `check_anonymous_usage_limits` function hasn't been applied.

## Fixes Applied

### ✅ Frontend Fix (Registered Users)
The frontend now automatically includes the JWT token in analyze requests:
- `UnifiedAnalysisService` now gets the session token from Supabase
- Includes `Authorization: Bearer <token>` header in requests
- Backend can now properly identify registered users

**This fix is already in place** - just refresh your browser to get the updated code.

### Database Migration (Still Needed)
The migration still needs to be applied for anonymous user support.

## Solution: Apply the Migration

### Option 1: Apply via Supabase Dashboard (Easiest)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Go to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Run the Migration**
   - Open the file: `supabase/migrations/20250104000001_create_anonymous_usage_tracking.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

4. **Verify Success**
   - You should see "Success. No rows returned"
   - The function should now exist

### Option 2: Apply via Supabase CLI

```powershell
# If you have Supabase CLI installed
cd "C:\my files\Projects\chess-analytics"
supabase db push
```

### Option 3: Apply via psql (Direct PostgreSQL)

```powershell
# Get your database connection string from Supabase dashboard
# Settings > Database > Connection string > Connection pooling: Session mode

# Then run:
psql "your-connection-string" -f supabase/migrations/20250104000001_create_anonymous_usage_tracking.sql
```

## What the Migration Creates

The migration creates:
1. **Table**: `anonymous_usage_tracking` - Tracks usage by IP address
2. **Function**: `check_anonymous_usage_limits(p_ip_address, p_action_type)` - Checks if limits exceeded
3. **Function**: `increment_anonymous_usage(p_ip_address, p_action_type, p_count)` - Increments counters

## Verify Migration Applied

After applying, test with:

```sql
-- Check if function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'check_anonymous_usage_limits';

-- Should return:
-- routine_name                   | routine_type
-- check_anonymous_usage_limits   | FUNCTION

-- Test the function
SELECT check_anonymous_usage_limits('127.0.0.1', 'analyze');
-- Should return JSON with can_proceed: true
```

## After Applying Migration

1. **Restart Backend Server** (if running)
   ```powershell
   # Stop current server (Ctrl+C)
   # Then restart:
   cd "C:\my files\Projects\chess-analytics\python"
   python -m uvicorn core.unified_api_server:app --reload --host 0.0.0.0 --port 8002
   ```

2. **Try Re-analyze Again**
   - Go back to your game analysis page
   - Click "Re-analyze"
   - Should work now!

## Temporary Workaround

If you can't apply the migration immediately, the backend has been updated to:
- Log a clear error message about the missing migration
- Allow requests to proceed (fail-open) if migration not applied
- This prevents blocking all analysis requests during setup

However, **you should still apply the migration** for proper limit enforcement.

## Why This Happened

The migration file exists in your codebase, but it needs to be applied to your actual database. Migrations are separate from code - they need to be run against the database.

## Prevention

To avoid this in the future:
1. Always apply migrations when pulling new code
2. Check migration status in Supabase dashboard
3. Use Supabase CLI for automated migration management
