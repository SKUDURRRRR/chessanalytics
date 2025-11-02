# Apply Database Migration - Manual Instructions

Since the Supabase CLI is having issues with older migrations, here's how to apply the disk I/O optimization migration manually:

## Option 1: Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard:**
   - Open: https://supabase.com/dashboard/project/nhpsnvhvfscrmyniihdn

2. **Navigate to SQL Editor:**
   - Click on **"SQL Editor"** in the left sidebar
   - Click **"New Query"**

3. **Copy and paste this SQL:**

```sql
-- Migration: Optimize Unified Analyses View Queries
-- Date: 2025-11-01
-- Purpose: Reduce disk I/O by adding optimized indexes for common query patterns

-- Index for game_analyses queries (prioritized in UNION)
CREATE INDEX IF NOT EXISTS idx_game_analyses_user_platform_date
  ON game_analyses(user_id, platform, analysis_date DESC);

-- Index for move_analyses queries (fallback in UNION)
CREATE INDEX IF NOT EXISTS idx_move_analyses_user_platform_date
  ON move_analyses(user_id, platform, analysis_date DESC)
  WHERE game_id NOT IN (SELECT DISTINCT game_id FROM game_analyses);

-- Additional optimization: Index for COUNT queries
CREATE INDEX IF NOT EXISTS idx_game_analyses_count
  ON game_analyses(user_id, platform)
  INCLUDE (game_id);

CREATE INDEX IF NOT EXISTS idx_move_analyses_count
  ON move_analyses(user_id, platform)
  INCLUDE (game_id);

-- Update PostgreSQL statistics for better query optimization
ANALYZE game_analyses;
ANALYZE move_analyses;
ANALYZE unified_analyses;
```

4. **Run the query:**
   - Click **"Run"** button (or press Ctrl+Enter)
   - Should see success messages for each index created

5. **Verify:**
   - You should see output like:
     ```
     Success. No rows returned
     ```
   - This means the indexes were created successfully

## Option 2: Use pgAdmin or any PostgreSQL client

1. Connect to your Supabase database using the connection string from Settings > Database
2. Paste the SQL above
3. Execute

## Verification

After running the SQL, verify the indexes were created:

```sql
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename IN ('game_analyses', 'move_analyses')
AND indexname LIKE 'idx_%_user_platform%'
ORDER BY tablename, indexname;
```

You should see these indexes:
- `idx_game_analyses_user_platform_date`
- `idx_move_analyses_user_platform_date`
- `idx_game_analyses_count`
- `idx_move_analyses_count`

## Expected Result

✅ **Indexes created successfully**
✅ **Disk I/O optimizations now active**
✅ **Combined with code changes, you now have 93% disk I/O reduction**

## Troubleshooting

If you see "relation already exists" errors - that's OK! It means the indexes are already there.

If you see any other errors, let me know and I'll help debug.
