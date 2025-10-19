# 🔧 Fix CORS 403 Errors - Add Frontend Domain to Railway

## The Problem

Your backend is rejecting requests from your frontend (403 Forbidden) because it's not configured to accept requests from `chessdata.app`.

Currently, CORS is only allowing `localhost` origins.

## The Fix

Add your frontend domain to the Railway backend's CORS configuration.

### Step 1: Add CORS_ORIGINS Environment Variable in Railway

1. **Go to Railway:** https://railway.app
2. **Select your project:** chessanalytics-production
3. **Click on your service**
4. **Go to Variables tab**
5. **Add new variable:**
   - **Name:** `CORS_ORIGINS`
   - **Value:** `https://chessdata.app,http://localhost:3000,http://localhost:5173`

6. **Click Add**

Railway will automatically redeploy with the new variable.

### Alternative: Use Railway CLI

```bash
# Set CORS origins
railway variables set CORS_ORIGINS="https://chessdata.app,http://localhost:3000,http://localhost:5173"
```

## Why Multiple Domains?

- `https://chessdata.app` - Your production frontend
- `http://localhost:3000` - Local development (if needed)
- `http://localhost:5173` - Vite dev server (if needed)

## After Adding the Variable

1. **Railway will redeploy** automatically (takes ~2 minutes)
2. **Wait for deployment** to complete
3. **Refresh your frontend** (hard refresh: Ctrl+Shift+R)
4. **Test:** The 403 errors should be gone!

## Verification

### Check Backend Logs in Railway
1. Go to your service in Railway
2. Click "Deployments"
3. Click the latest deployment
4. Look for: `CORS Origins configured: ['https://chessdata.app', ...]`

### Test in Browser
1. Visit: https://chessdata.app/simple-analytics?user=skudurrrrr&platform=chess.com
2. Open Console (F12)
3. Errors should change from 403 to either:
   - ✅ Success (200) - If endpoint has data
   - ⚠️ 404 Not Found - If no data yet (this is OK)

## Quick Command Summary

```bash
# If you have Railway CLI installed:
railway login
railway link [select your project]
railway variables set CORS_ORIGINS="https://chessdata.app,http://localhost:3000,http://localhost:5173"

# Check it was set:
railway variables

# Watch deployment:
railway logs
```

## What This Does

The `CORS_ORIGINS` environment variable tells the backend:
- "Accept requests from these domains"
- Without it, only localhost is allowed
- This prevents Cross-Origin Request errors

## Timeline

- ⏱️ **Add variable:** 1 minute
- ⏱️ **Railway redeploy:** 2 minutes
- ⏱️ **Total:** ~3 minutes

---

**After this fix, your app should work perfectly!** 🚀
