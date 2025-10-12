# Complete Fix and Testing Guide

## Changes Made

### Backend Fixes (`python/core/unified_api_server.py`)

1. **Early return on games insert failure** - Prevents PGN insert if games fail
2. **Enhanced Chess.com result parsing** - Added 'repetition' and 'abandoned' handling  
3. **Database verification** - Now actually queries DB to confirm games were inserted
4. **Better error logging** - Shows exactly what's blocking the insert

### Frontend Fix (`src/utils/playerStats.ts`)

1. **Removed `.single()` bug** - Changed to array query to prevent "cannot coerce" error

## Steps to Apply Fixes

### 1. Restart Backend

In your PowerShell terminal where the backend is running:

```powershell
# Press Ctrl+C to stop the backend
# Then restart it:
cd "c:/my files/Projects/chess-analytics"
.\.venv\Scripts\Activate.ps1
python python/main.py
```

### 2. Rebuild Frontend

In a separate terminal:

```powershell
cd "c:/my files/Projects/chess-analytics"
npm run build
# OR if dev server:
# npm run dev
```

### 3. Clear Browser Cache

- Press `Ctrl+Shift+R` to hard refresh
- OR clear cache in DevTools (F12 → Network tab → Disable cache checkbox)

## Testing the Fix

### Test 1: Smart Import (100 games)

1. Go to `http://localhost:3000/simple-analytics?user=taterama&platform=chess.com`
2. Click "Import Games (100)"
3. **Watch the backend logs** for:

**SUCCESS indicators:**
```
[import_games] Upserting 100 game rows
[import_games] games upsert succeeded and verified: 100 rows affected, 3 verified in DB
[import_games] Upserting 100 PGN rows
[import_games] pgn upsert successful, 100 rows affected
[Smart import] Success: imported_games=100
```

**FAILURE indicators (these tell us what's wrong):**
```
[import_games] ERROR: games upsert reported success but games not found in database
```
This means RLS is blocking the insert.

### Test 2: Verify Games in Database

After import, run this in a Supabase SQL editor or database tool:

```sql
-- Check games were imported
SELECT COUNT(*) as game_count 
FROM games 
WHERE user_id = 'taterama' AND platform = 'chess.com';

-- Check PGN data was imported  
SELECT COUNT(*) as pgn_count
FROM games_pgn
WHERE user_id = 'taterama' AND platform = 'chess.com';

-- Both should show 100 (or your import count)
```

### Test 3: Analytics Display

After successful import:

1. Page should auto-refresh
2. Check these display correctly:
   - Total Games Analyzed: Should show number > 0
   - Highest Rating: Should show a number
   - Average Accuracy: Should show %
3. **No console errors** in browser DevTools

## If Import Still Fails

### Check 1: RLS Policies

The verification query will now tell us if RLS is blocking. If you see:

```
games upsert reported success but games not found in database - likely RLS blocking insert
```

Then run this SQL to check/fix RLS:

```sql
-- Check current policies on games table
SELECT * FROM pg_policies WHERE tablename = 'games';

-- If service_role doesn't have access, add it:
GRANT ALL ON games TO service_role;
GRANT ALL ON games_pgn TO service_role;

-- Verify service_role can bypass RLS:
ALTER TABLE games FORCE ROW LEVEL SECURITY;  -- or DISABLE
```

### Check 2: Service Role Configuration

Verify your `.env` or environment has correct Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-key
```

The service role key is different from the anon key!

### Check 3: Foreign Key Constraint

If PGN insert still fails, check the constraint:

```sql
-- View the constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'fk_games_pgn_games';

-- If needed, make it deferrable:
ALTER TABLE games_pgn 
DROP CONSTRAINT IF EXISTS fk_games_pgn_games;

ALTER TABLE games_pgn
ADD CONSTRAINT fk_games_pgn_games
FOREIGN KEY (user_id, platform, provider_game_id)
REFERENCES games(user_id, platform, provider_game_id)
ON DELETE CASCADE
DEFERRABLE INITIALLY DEFERRED;  -- This allows insert order flexibility
```

## Debug Checklist

- [ ] Backend restarted with latest code
- [ ] Frontend rebuilt (if using build) or dev server restarted
- [ ] Browser cache cleared
- [ ] Backend logs showing during import
- [ ] Database has service_role access to games and games_pgn tables
- [ ] RLS policies not blocking service_role
- [ ] No other errors in backend logs

## Expected Behavior After Fix

1. ✅ Import button clicked
2. ✅ Backend logs show "Verifying games were actually inserted..."
3. ✅ Backend logs show "games upsert succeeded and verified: 100 rows affected, 3 verified in DB"
4. ✅ Backend logs show "pgn upsert successful, 100 rows affected"  
5. ✅ Frontend shows "Import complete! Imported 100 new games"
6. ✅ Analytics refresh automatically
7. ✅ Stats display correctly
8. ✅ No errors in browser console
9. ✅ No errors in backend logs

## Contact Points

If you still see errors after following this guide, share:

1. **Backend log output** from the import attempt
2. **Browser console errors** (F12 → Console tab)
3. **Database query results** from the verification queries above
4. **RLS policy check results** from the SQL queries

This will help identify exactly where the issue is occurring.

