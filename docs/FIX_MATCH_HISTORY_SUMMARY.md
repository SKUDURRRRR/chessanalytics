# Match History Fix Summary

## Problem
Match History was failing to load with 400 (Bad Request) errors from Supabase.

## Root Cause
The frontend code was querying a database column `opening_normalized` that doesn't exist in the `games` table. 

### Why the Column Doesn't Exist
- ✅ Migration file created: `supabase/migrations/20251011232950_add_opening_normalized_SAFE.sql`
- ❌ Migration never applied to the remote Supabase database
- ❌ The column was never created

## Temporary Fix Applied
Modified `src/components/simple/MatchHistory.tsx` to:
1. Remove `opening_normalized` from SELECT query
2. Use client-side filtering instead of database filtering
3. This allows Match History to load successfully

## Current Status
✅ Match History now loads correctly
✅ Opening filters still work (via client-side filtering)
⚠️ Slightly slower performance with large datasets (but fine for current use)

## Recommended Next Steps

### Step 1: Apply the Migration (Choose One Method)

#### Method A: Supabase Dashboard (Quickest)
1. Go to https://supabase.com/dashboard/project/nkeaifrhtyigfmicfwch/sql/new
2. Copy contents of `supabase/migrations/20251011232950_add_opening_normalized_SAFE.sql`
3. Paste and click **Run**

#### Method B: Quick SQL (Also Fast)
Run this in Supabase SQL Editor:

```sql
-- Add column
ALTER TABLE games ADD COLUMN opening_normalized TEXT;

-- Populate with data
UPDATE games 
SET opening_normalized = COALESCE(
  NULLIF(TRIM(opening_family), ''),
  NULLIF(TRIM(opening), ''),
  'Unknown'
);

-- Set constraints
ALTER TABLE games ALTER COLUMN opening_normalized SET DEFAULT 'Unknown';
ALTER TABLE games ALTER COLUMN opening_normalized SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_games_opening_normalized ON games(opening_normalized);
```

#### Method C: Link Supabase CLI (Best for Future)
```powershell
# Install if needed
npm install -g supabase

# Login and link
supabase login
supabase link --project-ref nkeaifrhtyigfmicfwch

# Apply all pending migrations
supabase db push
```

### Step 2: Restore Database-Level Filtering
After applying the migration, revert the temporary fix:

1. In `src/components/simple/MatchHistory.tsx` line 339:
   - Add `opening_normalized` back to SELECT query
   
2. In line 345:
   - Restore: `query = query.eq('opening_normalized', openingFilter.normalized)`
   
3. In line 371-380:
   - Remove client-side filtering logic
   - Keep just: `const mappedData = data.map(mapGameRow)`

Or I can do this for you after you confirm the migration is applied.

## Why This Happened

**Migrations in Remote Supabase require manual application**. Unlike local development where `supabase db push` automatically applies migrations, with a remote instance you need to either:

1. Run the SQL manually in the dashboard
2. Use `supabase link` + `supabase db push` to sync migrations
3. Set up CI/CD to automatically apply migrations

## Files Changed
- `src/components/simple/MatchHistory.tsx` - Temporary client-side filtering

## Files to Apply
- `supabase/migrations/20251011232950_add_opening_normalized_SAFE.sql` - Adds the missing column

