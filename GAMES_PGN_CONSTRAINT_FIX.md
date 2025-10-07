# Games PGN Constraint Fix

## Problem Identified

The analysis system is failing because the `games_pgn` table in Supabase is **missing the unique constraint** required for upserts.

### Error from Production Logs:
```
[import_games] ❌ PGN upsert error: {
  'message': 'there is no unique or exclusion constraint matching the ON CONFLICT specification', 
  'code': '42P10'
}
```

### What's Happening:
1. ✅ Games import successfully to `games` table (100 games)
2. ❌ PGN data **fails to save** to `games_pgn` table
3. ❌ Analysis requests fail because PGN is missing

## Solution

### Step 1: Add Unique Constraint to Supabase

Run this SQL in your **Supabase SQL Editor**:

```sql
-- Add the missing unique constraint
ALTER TABLE games_pgn 
ADD CONSTRAINT games_pgn_user_platform_provider_unique 
UNIQUE (user_id, platform, provider_game_id);

-- Verify it was created
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'games_pgn'::regclass;
```

Expected output:
```
games_pgn_user_platform_provider_unique | u (unique)
```

### Step 2: Verify Table Structure

Check your table has these columns:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'games_pgn'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (uuid, primary key)
- `user_id` (text)
- `platform` (text)
- `provider_game_id` (text)
- `pgn` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Step 3: Deploy Updated Backend

The code has been updated to:
- ✅ Remove references to non-existent `game_id` column
- ✅ Auto-fetch PGN from platform if missing (safety net)
- ✅ Better error logging

After running the SQL fix:
```bash
git add python/core/unified_api_server.py
git commit -m "fix: remove game_id column reference from games_pgn queries"
git push origin development
```

## Testing After Fix

1. **Import games again:**
   - Should see: `[import_games] pgn upsert response: count= 100`
   - NO more 400 Bad Request errors

2. **Click "Analyze" on a game:**
   - Should find PGN in database
   - Analysis should complete successfully

## Why This Happened

The `games_pgn` table constraint was likely:
- Not created during initial migration
- Dropped/altered accidentally
- Not present in your Supabase project

The code expects this constraint to exist for the `on_conflict` upsert strategy to work.

## Verification Query

After the fix, verify PGN data is being saved:

```sql
SELECT 
  user_id, 
  platform, 
  COUNT(*) as pgn_count,
  MAX(created_at) as latest_import
FROM games_pgn
GROUP BY user_id, platform;
```

You should see entries after importing games.

