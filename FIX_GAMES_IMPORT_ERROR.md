# Fix for "Column 'games_import_limit' does not exist" Error

## Problem
When importing games, you're getting the error:
```
Error: Import limit reached.
Column "games_import_limit" does not exist (code: 42703)
```

## Root Cause
The `check_usage_limits` database function is trying to query columns from the `authenticated_users` table that don't exist:
- `games_imported_count`
- `games_analyzed_count`
- `usage_reset_at`

## Solution
Apply the migration file: `supabase/migrations/20251102000012_add_usage_columns_to_authenticated_users.sql`

## How to Apply the Migration

### Method 1: Via Supabase Dashboard (Recommended) ✅

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Log in to your account

2. **Open SQL Editor**
   - Select your project
   - Click on "SQL Editor" in the left sidebar

3. **Run the Migration**
   - Click "New Query" button
   - Copy the ENTIRE contents of `supabase/migrations/20251102000012_add_usage_columns_to_authenticated_users.sql`
   - Paste into the SQL editor
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

4. **Verify Success**
   - You should see a success message
   - The migration adds 3 columns and creates 1 function

### Method 2: Using PostgreSQL CLI (Alternative)

If you have `psql` installed and your database connection string:

```bash
psql "YOUR_SUPABASE_CONNECTION_STRING" < supabase/migrations/20251102000012_add_usage_columns_to_authenticated_users.sql
```

### Method 3: Via Python Script

Run the helper script (it will guide you):

```bash
python apply_usage_columns_migration.py
```

## What the Migration Does

1. **Adds 3 new columns to `authenticated_users` table:**
   - `games_imported_count` (INTEGER) - Tracks imports in current period
   - `games_analyzed_count` (INTEGER) - Tracks analyses in current period
   - `usage_reset_at` (TIMESTAMPTZ) - When usage counters reset

2. **Creates a performance index:**
   - `idx_authenticated_users_usage_reset` on `usage_reset_at`

3. **Creates a helper function:**
   - `increment_user_usage()` - To safely increment usage counters

## Testing After Migration

1. **Go to your chess analytics app**
2. **Try importing games again**
3. **The error should be gone!**

## If You Still Have Issues

1. **Check if columns were added:**
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'authenticated_users'
   AND column_name IN ('games_imported_count', 'games_analyzed_count', 'usage_reset_at');
   ```

   Should return 3 rows.

2. **Check function exists:**
   ```sql
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_name IN ('check_usage_limits', 'increment_user_usage')
   AND routine_type = 'FUNCTION';
   ```

   Should return 2 rows.

3. **Restart your backend server** (if running locally):
   ```bash
   # Stop the backend
   # Then start it again
   python python/core/unified_api_server.py
   ```

## Need Help?

If you encounter any errors during migration, please share:
1. The error message from Supabase SQL Editor
2. Your Supabase project region
3. Any relevant logs

---

**Created:** 2025-11-02
**Migration File:** `supabase/migrations/20251102000012_add_usage_columns_to_authenticated_users.sql`
