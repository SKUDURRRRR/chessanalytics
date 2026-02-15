# Fix Re-Analysis Issue

## Problem
When you try to re-analyze a game, you get an error:
```
duplicate key value violates unique constraint "idx_game_analyses_user_platform_game"
```

This error appears in the backend logs and prevents the analysis from being saved to the database.

## Root Cause
The database has an old unique constraint on `(user_id, platform, game_id)` that doesn't include `analysis_type`. This prevents:
1. Re-analyzing the same game with the same analysis type
2. Storing multiple analysis types (basic, stockfish, deep) for the same game
3. Updating existing analyses with new results

**Why this happens:**
- The Python backend expects a constraint on `(user_id, platform, game_id, analysis_type)` which allows reanalysis
- The database still has the old 3-column constraint from an earlier version
- The backend successfully completes the analysis but fails to save it to the database

## Solution
Apply the SQL migration to update the database constraint. This is a **one-time operation** that takes less than 1 minute.

**Migration File:** `supabase/migrations/20250111000001_fix_game_analyses_constraint.sql`

> **Note:** For complete step-by-step instructions with verification steps and troubleshooting, see `docs/APPLY_REANALYSIS_FIX.md`

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Migration
Copy and paste the following SQL into the editor and click **Run**:

```sql
-- Fix game_analyses unique constraint to include analysis_type
-- This allows re-analysis of games and multiple analysis types per game

BEGIN;

-- Drop the old constraint regardless of its exact name
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find and drop any unique constraint on (user_id, platform, game_id)
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.game_analyses'::regclass
        AND contype = 'u' -- unique constraint
        AND array_length(conkey, 1) = 3 -- 3 columns
    LOOP
        EXECUTE format('ALTER TABLE public.game_analyses DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Drop any index that might be enforcing uniqueness on (user_id, platform, game_id)
DROP INDEX IF EXISTS idx_game_analyses_user_platform_game;
DROP INDEX IF EXISTS game_analyses_user_id_platform_game_id_key;

-- Add the correct constraint with analysis_type included
ALTER TABLE public.game_analyses
DROP CONSTRAINT IF EXISTS game_analyses_user_platform_game_id_analysis_type_key;

ALTER TABLE public.game_analyses
ADD CONSTRAINT game_analyses_user_platform_game_id_analysis_type_key
UNIQUE (user_id, platform, game_id, analysis_type);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_game_analyses_user_platform_game
ON public.game_analyses (user_id, platform, game_id);

COMMIT;
```

### Step 3: Verify
After running the SQL:
1. You should see messages like "Dropped constraint: ..." in the results
2. The query should complete successfully
3. Try re-analyzing your game again - it should work now!

## What This Does
1. **Removes the old constraint** that was blocking re-analysis
2. **Adds the correct constraint** that includes `analysis_type`
3. **Creates a helpful index** for faster queries

## Benefits
After applying this fix:
- ✅ You can re-analyze games as many times as you want
- ✅ You can have multiple analysis types (basic, stockfish, deep) for the same game
- ✅ Each analysis type is tracked separately
- ✅ No data loss - all existing analyses are preserved
- ✅ Railway hobby settings are now properly applied to all analysis types
- ✅ Faster analysis with optimized depth (14) and time limits (0.8s)

## Recent Improvements (Fixed in this Update)

### 1. Railway Hobby Settings Now Respected
Previously, deep analysis used hardcoded settings (depth=18, time=3.0s) that were too slow for Railway hobby tier. Now all analysis types use optimized Railway hobby settings from environment variables:
- **Depth**: 14 (was 18 for deep analysis)
- **Time Limit**: 0.8s per position (was 3.0s)
- **Skill Level**: 20 (maximum strength)

This makes analysis 3-4x faster while maintaining high accuracy.

### 2. Better Error Messages
The backend now provides clear error messages when:
- Database migration is needed (with exact file to run)
- Game doesn't exist in database (must import first)
- Foreign key constraints are violated

Look for these messages in the backend logs (marked with `[PERSISTENCE]`).

## Need Help?
If you encounter any issues:
1. Check that you're using the Service Role key (not the Anon key)
2. Make sure you have the correct permissions
3. Check the Supabase logs for detailed error messages

## Alternative: Quick Fix (Temporary)
If you can't apply the migration right away, here's a workaround:
Delete the existing analysis for the game before re-analyzing it.

However, this is NOT recommended as:
- You'll lose your previous analysis data
- You can't have multiple analysis types
- It's not a proper solution

Apply the migration above for the permanent fix.
