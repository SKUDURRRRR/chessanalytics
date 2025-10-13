# Local Testing Guide - Opening Filter Fix

## Current Status

✅ **Code Changes**: Implemented and committed locally  
✅ **Pushed to Remote**: Code is on GitHub (development branch)  
⏳ **Database Migration**: NEEDS TO BE APPLIED  
⏳ **Local Backend**: NEEDS TO BE STARTED  
⏳ **Local Frontend**: NEEDS TO BE STARTED  
❌ **Production Deploy**: NOT deployed (staying local)

## Step-by-Step Local Testing

### Step 1: Apply Database Migration ⚠️ CRITICAL

**You MUST apply this migration to your Supabase database before testing!**

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste this SQL:

```sql
-- Add opening_normalized column for efficient filtering
ALTER TABLE games ADD COLUMN IF NOT EXISTS opening_normalized TEXT;

-- Populate existing games
UPDATE games 
SET opening_normalized = COALESCE(
  NULLIF(TRIM(opening_family), ''),
  NULLIF(TRIM(opening), ''),
  'Unknown'
)
WHERE opening_normalized IS NULL;

-- Normalize unknown values
UPDATE games 
SET opening_normalized = 'Unknown'
WHERE opening_normalized IN ('null', 'NULL', '');

-- Set default for new records
ALTER TABLE games ALTER COLUMN opening_normalized SET DEFAULT 'Unknown';

-- Make non-null
ALTER TABLE games ALTER COLUMN opening_normalized SET NOT NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_games_opening_normalized ON games(opening_normalized);

-- Add constraint
ALTER TABLE games ADD CONSTRAINT opening_normalized_valid 
  CHECK (opening_normalized IS NOT NULL AND opening_normalized != '');

-- Add comment
COMMENT ON COLUMN games.opening_normalized IS 'Normalized opening name for efficient filtering. Uses COALESCE(opening_family, opening, ''Unknown'') logic.';
```

6. Click **RUN** (or press Ctrl+Enter)
7. Wait for "Success" message (30-60 seconds)

**Verify Migration Worked**:
```sql
-- Check column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'games' AND column_name = 'opening_normalized';

-- Check sample data
SELECT opening, opening_family, opening_normalized 
FROM games 
WHERE opening_normalized IS NOT NULL
LIMIT 10;

-- Check index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'games' AND indexname = 'idx_games_opening_normalized';
```

Expected results:
- Column shows as TEXT, NOT NULL
- Sample data shows opening_normalized populated
- Index exists

---

### Step 2: Start Backend Locally

Open a **NEW terminal window** and run:

```powershell
cd "C:\my files\Projects\chess-analytics\python"
python -m uvicorn core.unified_api_server:app --reload --host 0.0.0.0 --port 8000
```

**Verify Backend Started**:
- Look for: `Uvicorn running on http://0.0.0.0:8000`
- Test: Open http://localhost:8000/health in browser
- Should see: `{"status": "healthy"}`

**Leave this terminal running!**

---

### Step 3: Start Frontend Locally

Open **ANOTHER terminal window** and run:

```powershell
cd "C:\my files\Projects\chess-analytics"
npm run dev
```

**Verify Frontend Started**:
- Look for: `Local: http://localhost:5173/`
- Open: http://localhost:5173 in browser
- Should see: Chess Analytics app

**Leave this terminal running too!**

---

### Step 4: Test the Opening Filter Fix

#### Test Case 1: Opening Performance (Winning)
1. Navigate to Analytics tab
2. Find "Opening Performance" section
3. Look at "Winning Openings" - note the game count (e.g., "Caro-Kann Defense: 220 games")
4. **Click on the opening**
5. **Expected**: Match History should load and show the SAME number of games
6. **Verify**: Pagination works - you can scroll through all games

#### Test Case 2: Opening Performance (Losing)
1. In "Opening Performance" section
2. Look at "Losing Openings" - note the game count
3. **Click on a losing opening**
4. **Expected**: Match History shows correct count
5. **Verify**: Games displayed are actually losing games

#### Test Case 3: Opening by Color (White)
1. Find "Opening Performance by Color" section
2. Look at "Best White Openings" - note game count
3. **Click on a white opening**
4. **Expected**: Match History shows only white games with correct count
5. **Verify**: All games shown are white games

#### Test Case 4: Opening by Color (Black)
1. Look at "Best Black Openings" - note game count
2. **Click on a black opening**
3. **Expected**: Match History shows only black games with correct count
4. **Verify**: All games shown are black games

#### Test Case 5: Pagination
1. Click any opening with 20+ games
2. **Scroll down** in Match History
3. **Expected**: "Load More" button appears or auto-loads next 20 games
4. **Verify**: Can load all games through pagination

---

### Step 5: Test with Browser DevTools

Open **Browser Console** (F12) and check:

1. **Network Tab**:
   - Filter by "games"
   - Click an opening
   - Look for database query
   - **Expected**: Query should have `opening_normalized=<opening-name>` parameter
   - **Expected**: Response should return exactly 20 games (or less if fewer exist)

2. **Console Tab**:
   - Should see no errors
   - May see debug logs showing filtering

---

## Troubleshooting

### Problem: "Column does not exist"
**Cause**: Migration not applied  
**Fix**: Go back to Step 1 and apply the migration

### Problem: Match History shows 0 games
**Cause**: Migration applied but opening_normalized values don't match  
**Debug**:
```sql
-- Check what normalized values exist
SELECT DISTINCT opening_normalized, COUNT(*) 
FROM games 
GROUP BY opening_normalized 
ORDER BY COUNT(*) DESC;
```
**Fix**: Values should match what frontend sends (check browser DevTools Network tab)

### Problem: Backend won't start
**Cause**: Port already in use or dependency issue  
**Fix**:
```powershell
# Check if port 8000 is in use
netstat -ano | findstr :8000

# Kill process if needed (replace PID with actual process ID)
taskkill /PID <PID> /F

# Reinstall dependencies
cd python
pip install -r requirements.txt
```

### Problem: Frontend won't start
**Cause**: Port already in use or node_modules issue  
**Fix**:
```powershell
# Kill process on port 5173
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Reinstall dependencies
npm install
```

### Problem: Changes not reflected
**Cause**: Browser cache or hot reload not working  
**Fix**:
- Hard refresh: Ctrl+Shift+R
- Clear browser cache
- Restart frontend dev server

---

## When You're Ready to Deploy to Production

Once local testing is complete and everything works:

1. **The code is already pushed** to GitHub (development branch)
2. **Railway will auto-deploy** when you merge to main (or manually trigger)
3. **Frontend will auto-deploy** on Vercel/hosting when you push
4. **Database migration is already applied** to your Supabase (same database for dev/prod)

**To deploy**:
```bash
# Merge development to main
git checkout main
git merge development
git push origin main

# Railway and Vercel will auto-deploy
```

---

## Success Criteria

✅ Migration applied successfully  
✅ Backend starts without errors  
✅ Frontend starts without errors  
✅ Clicking any opening shows correct game count  
✅ Pagination works through all games  
✅ No console errors  
✅ Network requests show opening_normalized in query  

## Files Changed in This Fix

- `python/core/unified_api_server.py` - Backend game import logic
- `src/components/simple/MatchHistory.tsx` - Frontend filtering logic
- `supabase/migrations/20251011232950_add_opening_normalized.sql` - Database migration
- `OPENING_FILTER_FIX_IMPLEMENTATION.md` - Technical documentation
- `docs/OPENING_NORMALIZED_REPROCESSING.md` - Future enhancement docs
- `DEPLOYMENT_STEPS.md` - Production deployment guide
- `LOCAL_TESTING_GUIDE.md` - This file

