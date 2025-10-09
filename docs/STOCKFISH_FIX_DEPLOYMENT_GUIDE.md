# Stockfish Analysis Fix - Deployment Guide

## What Was Fixed

### Issue
After security key changes, Stockfish analysis stopped working with error:
```
Error analyzing game: Stockfish executable not found
```

### Root Cause
The analysis engine was not using the config system's Stockfish path detection, which meant it only checked Windows paths and never found `/usr/games/stockfish` on Railway/Linux production servers.

### Changes Made

1. **python/core/unified_api_server.py** - `get_analysis_engine()` now passes config stockfish path
2. **python/core/api_server.py** - Same fix for legacy API
3. **python/core/analysis_engine.py** - `_find_stockfish_path()` now checks Linux paths including `/usr/games/stockfish`
4. **python/Dockerfile** - Properly sets `STOCKFISH_PATH` environment variable

## Deployment Instructions

### Step 1: Deploy Code Changes

The code fixes have been committed. To deploy:

```bash
# Commit the changes
git add python/core/unified_api_server.py python/core/api_server.py python/core/analysis_engine.py python/Dockerfile
git commit -m "Fix: Stockfish path detection for Linux/Railway production"
git push origin development
```

Railway will automatically rebuild and redeploy when you push.

### Step 2: Add Environment Variable to Railway (IMPORTANT)

1. Go to Railway dashboard: https://railway.app/dashboard
2. Select your project (`chess-analytics-backend` or similar)
3. Click on **Variables** tab
4. Add new variable:
   - **Key**: `STOCKFISH_PATH`
   - **Value**: `/usr/games/stockfish`
5. Click **Add** or **Save**

Railway will automatically restart the service with the new environment variable.

### Step 3: Verify the Fix

#### Check Logs
After deployment, check Railway logs for these indicators:

**✅ SUCCESS - You should see:**
```
[STOCKFISH] Environment STOCKFISH_PATH: /usr/games/stockfish
[STOCKFISH] Found Stockfish at /usr/games/stockfish (Railway path)
[ENGINE] Using Stockfish from config: /usr/games/stockfish
```

**❌ FAILURE - If you see:**
```
[STOCKFISH] No stockfish executable found
[ENGINE] Warning: No Stockfish path found in config
Error analyzing game: Stockfish executable not found
```

This means the environment variable wasn't set or Stockfish isn't installed.

#### Test Health Endpoint
```bash
curl https://your-backend.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "stockfish_available": true,  // ← Should be true!
  "timestamp": "..."
}
```

#### Test Analysis Endpoint
In your webapp at https://chessdata.app:
1. Go to a game that needs analysis
2. Click "Analyze" button
3. Check browser console/network tab for the API response

**Expected:**
- Analysis completes with realistic timing (not 0.0ms)
- No "Stockfish executable not found" errors
- Move analysis appears with centipawn loss, best moves, etc.

### Step 4: Monitor Initial Analysis Requests

After deployment, monitor the first few analysis requests:

```bash
# In Railway logs, watch for:
railway logs --follow

# Look for:
# - Successful Stockfish initialization
# - Move analysis completing in realistic time (e.g., 50-500ms per move)
# - No errors or fallbacks to basic analysis
```

## Troubleshooting

### Issue: Still getting "Stockfish executable not found"

**Solution 1: Verify Environment Variable**
```bash
# In Railway dashboard, check Variables tab
# Ensure STOCKFISH_PATH=/usr/games/stockfish is set
```

**Solution 2: Rebuild Container**
```bash
# Force a rebuild in Railway:
# 1. Go to Deployments tab
# 2. Click the three dots on latest deployment
# 3. Select "Redeploy"
```

**Solution 3: Check Stockfish Installation in Container**
```bash
# If you have Railway CLI:
railway run bash
ls -la /usr/games/stockfish
/usr/games/stockfish --version
```

### Issue: Stockfish crashes with "exit code: -9" (OOM)

This means out-of-memory. The code already has OOM protection with fallback to basic analysis.

**Solution**: This is expected on Railway's free tier with complex positions. The system will automatically fall back to heuristic analysis.

### Issue: Analysis is slow

**Expected Behavior**: 
- Each move takes ~0.5 seconds with Stockfish
- 40-move game = ~20 seconds total
- This is normal and expected

**If Much Slower**:
Check Railway resource limits and consider upgrading if needed.

## Rollback Plan

If the fix causes issues, rollback:

```bash
# Revert the changes
git revert HEAD
git push origin development

# Or checkout previous working commit
git checkout <previous-commit-hash> -- python/
git commit -m "Rollback Stockfish fix"
git push origin development
```

## Testing Locally (Optional)

To test these changes locally on Windows:

1. Ensure Stockfish is in your project's `stockfish/` directory
2. Run backend:
```powershell
cd python
python main.py
```

3. Check startup logs for:
```
[STOCKFISH] Found stockfish at: ...\stockfish\stockfish-windows-x86-64-avx2.exe
[ENGINE] Using Stockfish from config: ...\stockfish\stockfish-windows-x86-64-avx2.exe
```

## Expected Behavior After Fix

### Startup Logs
```
[STOCKFISH] Environment STOCKFISH_PATH: /usr/games/stockfish
[STOCKFISH] Found Stockfish at /usr/games/stockfish (Railway path)
[ENGINE] Using Stockfish from config: /usr/games/stockfish
✅ Configuration is valid!
```

### Analysis Logs
```
[CurrentPosition "8/6bk/6pp/P4p2/1P3P2/4p1P1/2Q4P/5BK1 b - - 0 37"]
Move analysis completed in 487.3ms  ← Real timing!
INFO: "POST /api/v1/analyze?use_parallel=false HTTP/1.1" 200 OK
```

### Health Check Response
```json
{
  "status": "healthy",
  "service": "unified-chess-analysis-api",
  "version": "3.0",
  "stockfish_available": true,  ← TRUE!
  "database_connected": true,
  "timestamp": "2025-10-08T..."
}
```

## Post-Deployment Checklist

- [ ] Code pushed to repository
- [ ] Railway environment variable `STOCKFISH_PATH=/usr/games/stockfish` added
- [ ] Railway automatically redeployed
- [ ] Checked deployment logs for successful Stockfish detection
- [ ] Tested health endpoint shows `stockfish_available: true`
- [ ] Tested analysis on webapp - analysis completes successfully
- [ ] No more "Stockfish executable not found" errors
- [ ] Analysis timing is realistic (not 0.0ms)

## Questions?

If you encounter issues:

1. Check Railway logs first
2. Verify environment variable is set
3. Test health endpoint
4. Review the investigation report: `STOCKFISH_ANALYSIS_INVESTIGATION.md`

The fix is multi-layered:
- Config system detects Stockfish
- Engine receives config path
- Engine also checks Linux paths directly
- Dockerfile sets environment variable
- Environment variable can override everything

This redundancy ensures Stockfish is found even if one layer fails.

