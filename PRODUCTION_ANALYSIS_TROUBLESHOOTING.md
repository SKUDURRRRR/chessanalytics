# Production Analysis Not Running - Troubleshooting Guide

## Quick Diagnosis

Run this command to check your production backend:
```bash
python check_production_analysis.py https://your-railway-app.railway.app
```

---

## Common Issues & Fixes

### 1. ❌ Stockfish Not Found (Most Common - 90% of cases)

**Symptoms:**
- Backend health check shows `"stockfish": "not_available"`
- Analysis requests return "Stockfish executable not found"
- Railway logs show `[STOCKFISH] No stockfish executable found`

**Fix:**
```bash
# Add to Railway environment variables:
STOCKFISH_PATH=stockfish
```

**How to add:**
1. Go to https://railway.app/dashboard
2. Select your project
3. Click "Variables" tab
4. Add: `STOCKFISH_PATH=stockfish`
5. Service will auto-restart in ~30 seconds

**Verify:**
```bash
railway logs --tail 20

# Look for:
# ✅ "Found stockfish at: /usr/games/stockfish"
# ❌ "Stockfish executable not found"
```

---

### 2. ❌ Backend Not Running

**Symptoms:**
- Cannot access `https://your-app.railway.app/health`
- 404 or connection timeout errors
- Frontend shows "Cannot connect to API"

**Fix:**
```bash
# Check if backend is deployed
railway status

# If not running, deploy:
railway up

# Or push to GitHub (if auto-deploy configured):
git push origin development
```

**Check deployment logs:**
```bash
railway logs --follow
```

---

### 3. ❌ Frontend Can't Connect to Backend

**Symptoms:**
- Backend `/health` works fine
- But frontend shows "Failed to fetch" errors
- Browser console shows CORS errors or wrong URL

**Fix - Option A: Environment Variable (Production)**

Create/update `.env.production`:
```bash
VITE_ANALYSIS_API_URL=https://your-railway-app.railway.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Fix - Option B: Vercel Deployment**

If deploying frontend to Vercel, add these environment variables in Vercel dashboard:
```
VITE_ANALYSIS_API_URL = https://your-railway-app.railway.app
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = your-anon-key
```

**Verify:**
1. Open browser dev tools (F12)
2. Go to Network tab
3. Try to analyze a game
4. Check if requests go to correct URL

---

### 4. ❌ Memory Issues (OOM Kills)

**Symptoms:**
- Railway logs show `exit code -9`
- Backend randomly crashes during analysis
- "Out of Memory" errors

**Fix:**
```bash
# Add to Railway environment variables:
DEPLOYMENT_TIER=production
```

This enables memory-optimized settings:
- Reduced Stockfish hash size (8MB instead of 96MB)
- Limited concurrent analyses (1-2 instead of 4)
- Lower depth settings for memory efficiency

**Check memory usage:**
1. Go to Railway dashboard
2. Select your service
3. Click "Metrics" tab
4. Monitor memory during analysis

---

### 5. ❌ Database Connection Failed

**Symptoms:**
- Backend health check shows `"database": "disconnected"`
- Logs show "Database connection failed"
- Analysis starts but doesn't save results

**Fix:**
```bash
# Add/verify these in Railway environment variables:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Get these values:**
1. Go to https://app.supabase.com
2. Select your project
3. Settings → API
4. Copy the values

**Important:** Remove trailing slashes from URLs!
- ✅ `https://xxx.supabase.co`
- ❌ `https://xxx.supabase.co/`

---

### 6. ❌ CORS Errors

**Symptoms:**
- Browser console shows CORS errors
- "Access-Control-Allow-Origin" errors
- Backend logs show OPTIONS requests

**Fix:**
```bash
# Add to Railway environment variables:
CORS_ORIGINS=*

# Or for specific domains:
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## Complete Railway Environment Variables Checklist

### Required Variables:
```bash
# Backend
STOCKFISH_PATH=stockfish
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
API_HOST=0.0.0.0
API_PORT=$PORT

# CORS (adjust for your domain)
CORS_ORIGINS=*
```

### Optional (but recommended):
```bash
# Performance
DEPLOYMENT_TIER=production
STOCKFISH_DEPTH=14
STOCKFISH_SKILL_LEVEL=20
STOCKFISH_TIME_LIMIT=0.8
STOCKFISH_MAX_CONCURRENT=4

# Python
PYTHONPATH=/app/python
PYTHON_VERSION=3.11
```

---

## Verification Steps

### Step 1: Test Backend Health
```bash
curl https://your-railway-app.railway.app/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "stockfish": "available",
  "database": "connected",
  "version": "1.0.0"
}
```

### Step 2: Test Analysis Endpoint
```bash
curl -X POST https://your-railway-app.railway.app/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test",
    "platform": "lichess",
    "analysis_type": "stockfish",
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "move": "e2e4"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "Move analysis completed",
  "data": {
    "evaluation": {...},
    "classification": "good"
  }
}
```

### Step 3: Check Railway Logs
```bash
railway logs --tail 50
```

**Look for:**
- ✅ `Found stockfish at: /usr/games/stockfish`
- ✅ `[ENGINE] Using Stockfish from config`
- ✅ `Database connection successful`
- ✅ `Uvicorn running on http://0.0.0.0:$PORT`

**Red flags:**
- ❌ `Stockfish executable not found`
- ❌ `exit code -9` (OOM kill)
- ❌ `Database connection failed`
- ❌ `ModuleNotFoundError`

---

## Railway-Specific Commands

```bash
# Check service status
railway status

# View live logs
railway logs --follow

# List environment variables
railway variables

# Add environment variable
railway variables set STOCKFISH_PATH=stockfish

# Restart service
railway restart

# Open Railway dashboard
railway open

# SSH into container (for debugging)
railway shell
```

---

## Quick Fixes Summary

| Issue | Quick Fix |
|-------|-----------|
| Stockfish not found | Add `STOCKFISH_PATH=stockfish` to Railway vars |
| Backend not running | Run `railway up` or push to GitHub |
| Frontend can't connect | Set `VITE_ANALYSIS_API_URL` in frontend env |
| Memory issues (OOM) | Add `DEPLOYMENT_TIER=production` |
| Database connection | Verify Supabase credentials in Railway vars |
| CORS errors | Add `CORS_ORIGINS=*` to Railway vars |

---

## Still Not Working?

### Diagnostic Script
```bash
python check_production_analysis.py https://your-railway-app.railway.app
```

### Check Specific Issues

1. **Stockfish:**
   ```bash
   railway shell
   which stockfish
   stockfish  # Should start Stockfish
   ```

2. **Database:**
   ```bash
   # Check Supabase dashboard
   # Verify RLS policies allow service_role access
   ```

3. **Memory:**
   ```bash
   # Railway dashboard → Metrics
   # Check memory usage during analysis
   ```

4. **Network:**
   ```bash
   # Browser DevTools → Network tab
   # Check API requests are reaching backend
   ```

---

## Performance Expectations

| Scenario | Expected Time |
|----------|---------------|
| Single move analysis | 1-2 seconds |
| 40-move game | 15-20 seconds |
| 80-move game | 20-30 seconds |
| Batch (5 games) | 1-3 minutes |

If significantly slower:
- Check Railway CPU/memory limits
- Consider upgrading from free tier
- Optimize Stockfish settings

---

## Support Resources

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Supabase Docs:** https://supabase.com/docs
- **Your backend health:** `https://your-app.railway.app/health`

---

## Emergency Recovery

If nothing works:

1. **Redeploy from scratch:**
   ```bash
   railway down
   railway up
   ```

2. **Check Railway service logs for startup errors:**
   ```bash
   railway logs --tail 200
   ```

3. **Verify Railway environment variables match production requirements:**
   ```bash
   railway variables
   ```

4. **Test locally first:**
   ```bash
   # Run backend locally
   python -m uvicorn python.core.unified_api_server:app --host 127.0.0.1 --port 8002

   # Test health
   curl http://localhost:8002/health
   ```

If local works but Railway doesn't → Environment variable issue
If local doesn't work → Code/dependency issue

---

**Last Updated:** October 14, 2025
