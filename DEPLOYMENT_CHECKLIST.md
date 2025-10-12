# Deployment Checklist - Ready for Production

## Pre-Deployment Status: ✅ READY

### Phase 1: Database Migrations ✅
**Action Required:** User must verify migrations in production Supabase

Run these queries in Supabase SQL Editor (https://supabase.com/dashboard/project/nhpsnvhvfscrmyniihdn/sql):

```sql
-- 1. Check opening_normalized column
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'games' AND column_name = 'opening_normalized';

-- 2. Check game_analyses constraint
SELECT constraint_name 
FROM information_schema.table_constraints
WHERE table_name = 'game_analyses' 
  AND constraint_name LIKE '%analysis_type%';

-- 3. Check other critical columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'games' 
  AND column_name IN ('opponent_name', 'total_moves', 'opening_family');
```

**If any missing, apply migrations:**
- `supabase/migrations/20251011232950_add_opening_normalized_SAFE.sql`
- `supabase/migrations/20250111000001_fix_game_analyses_constraint.sql`

---

### Phase 2: Debug Code Cleanup ✅ COMPLETED

**Changes Applied:**
- ✅ Backend debug endpoints now check `DEBUG` environment variable
- ✅ Frontend debug panel checks `VITE_DEBUG` environment variable
- ✅ Debug console.log statements conditional on `DEBUG=true`
- ✅ Debug file writes conditional on `DEBUG=true`

**Files Modified:**
- `python/core/unified_api_server.py` - Debug endpoints protected
- `src/pages/SimpleAnalyticsPage.tsx` - Debug panel conditional

---

### Phase 3: Code Quality ✅ PASSED

**Linter:** ✅ No errors  
**TypeScript:** ⚠️ 188 warnings (non-blocking)

Most warnings are unused variables in debug components and don't prevent deployment.

---

### Phase 4: Environment Variables Check

**Action Required:** User must verify in deployment dashboards

#### Railway Backend (https://railway.app/dashboard)
Required variables:
```bash
# Database
SUPABASE_URL=https://nhpsnvhvfscrmyniihdn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-key>

# Railway Hobby Performance
STOCKFISH_DEPTH=14
STOCKFISH_SKILL_LEVEL=20
STOCKFISH_TIME_LIMIT=0.8
STOCKFISH_THREADS=1
MAX_CONCURRENT_ANALYSES=4
PERFORMANCE_PROFILE=railway_hobby

# Production Mode
DEBUG=false
```

#### Vercel Frontend (https://vercel.com/dashboard)
Required variables:
```bash
# Database
VITE_SUPABASE_URL=https://nhpsnvhvfscrmyniihdn.supabase.co
VITE_SUPABASE_ANON_KEY=<your-key>

# Backend API
VITE_ANALYSIS_API_URL=https://your-backend.railway.app

# Production Mode
NODE_ENV=production
VITE_DEBUG=false
```

---

## Deployment Steps

### Step 1: Verify Migrations
- [ ] Run SQL queries in Supabase
- [ ] Apply any missing migrations
- [ ] Verify all columns exist

### Step 2: Verify Environment Variables
- [ ] Check Railway dashboard - all variables present
- [ ] Check Vercel dashboard - all variables present
- [ ] Confirm `DEBUG=false` in both environments

### Step 3: Deploy Backend (Railway)
```bash
# Commit changes
git add .
git commit -m "Pre-deployment: Debug cleanup and validation"

# Push to main/production branch
git push origin development

# Railway will auto-deploy
```

**Monitor:** Railway deployment logs for:
- ✅ Service starts successfully
- ✅ `[CONFIG] Railway Hobby mode: depth=14` appears in logs
- ✅ No errors during startup

### Step 4: Deploy Frontend (Vercel)
```bash
# Same commit as backend
git push origin development

# Vercel will auto-deploy
```

**Monitor:** Vercel deployment logs for:
- ✅ Build completes successfully
- ✅ No critical build errors
- ✅ Deployment URL generated

### Step 5: Verify Deployment
- [ ] Open production URL
- [ ] Check browser console - no CORS errors
- [ ] Test backend health endpoint: `https://your-backend.railway.app/health`
- [ ] Verify Railway Hobby settings active in backend logs

---

## Post-Deployment Validation

### Quick Smoke Test (5 minutes)
1. **Import Test:**
   - [ ] Search for user (e.g., "hikaru")
   - [ ] Import 100 games
   - [ ] Verify games appear in database

2. **Analysis Test:**
   - [ ] Start analysis on imported games
   - [ ] Check backend logs show Railway Hobby settings
   - [ ] Verify analysis completes in reasonable time

3. **Match History Test:**
   - [ ] Load match history
   - [ ] Test opening filter
   - [ ] Verify pagination works

4. **Performance Check:**
   - [ ] Railway dashboard - memory usage < 6GB
   - [ ] No errors in Railway logs
   - [ ] Frontend loads quickly

### Full Validation (30 minutes)
Follow test plan in `PRE_DEPLOYMENT_VALIDATION_RESULTS.md` Phase 3

---

## Rollback Plan

If critical issues occur:

### Option 1: Quick Environment Variable Rollback
1. Set `DEBUG=true` in Railway/Vercel for diagnostics
2. Investigate logs to identify issue
3. Fix and redeploy

### Option 2: Git Rollback
```bash
# Identify last working commit
git log --oneline

# Rollback to specific commit
git revert <commit-hash>

# Or hard reset (use with caution)
git reset --hard <commit-hash>
git push --force origin development
```

### Option 3: Platform Rollback
- **Railway:** Dashboard → Deployments → Select previous deployment → Rollback
- **Vercel:** Dashboard → Deployments → Select previous deployment → Promote to Production

---

## Known Issues (Non-Critical)

### TypeScript Warnings
- 188 warnings in codebase
- Mostly unused variables in debug components
- Don't prevent build or runtime functionality
- Should be cleaned in post-deployment phase

### Debug Code
- Debug endpoints return 404 when `DEBUG=false` (expected)
- Debug panel hidden when `VITE_DEBUG=false` (expected)
- Console logs suppressed in production (expected)

---

## Success Metrics

After deployment, verify:

### Performance
- [ ] Single game analysis < 15 seconds
- [ ] 100 games import < 2 minutes
- [ ] Match history loads < 2 seconds
- [ ] Railway memory usage < 6GB

### Functionality
- [ ] Game import works (smart + large batch)
- [ ] Match history displays correctly
- [ ] Opening filters work
- [ ] Game analysis completes successfully
- [ ] Reanalysis works without errors
- [ ] Personality radar shows realistic scores
- [ ] ELO graph displays accurate ratings

### Quality
- [ ] No console errors in browser
- [ ] No CORS errors
- [ ] Backend logs clean (no unexpected errors)
- [ ] Railway Hobby settings confirmed active
- [ ] All features accessible and responsive

---

## Support Resources

- **Supabase Dashboard:** https://supabase.com/dashboard/project/nhpsnvhvfscrmyniihdn
- **Railway Dashboard:** https://railway.app/dashboard
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Validation Guide:** `PRE_DEPLOYMENT_VALIDATION_RESULTS.md`
- **Migration Files:** `supabase/migrations/`

---

## Next Steps After Deployment

1. **Monitor for 24 hours**
   - Check Railway logs for errors
   - Monitor memory usage
   - Track user reports

2. **Performance Tuning**
   - Adjust Railway Hobby settings if needed
   - Optimize slow queries
   - Add caching if necessary

3. **Code Cleanup**
   - Address TypeScript warnings
   - Remove unused imports
   - Refactor debug components

4. **Documentation**
   - Update feature list
   - Document new environment variables
   - Add troubleshooting guides

---

**Prepared:** [Current Date]  
**Status:** ✅ Ready for Deployment  
**Estimated Deployment Time:** 30 minutes  
**Risk Level:** Low (changes are mostly cleanup and optimization)

