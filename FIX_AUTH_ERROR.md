# 🔧 Fix "Not authenticated" Error - Disable Auth for Public Access

## The Problem

The backend is returning "Not authenticated" because authentication is enabled by default.

Your app needs **public access** (no login required) to work properly.

## The Fix

Add the `AUTH_ENABLED` environment variable to Railway and set it to `false`.

### Step 1: Add AUTH_ENABLED to Railway

1. **Go to Railway:** https://railway.app
2. **Select your service:** chessanalytics-production
3. **Go to Variables tab**
4. **Add new variable:**
   - **Name:** `AUTH_ENABLED`
   - **Value:** `false`

5. **Click Add** (Railway will auto-redeploy)

### Alternative: Use Railway CLI

```bash
railway variables set AUTH_ENABLED="false"
```

## What This Does

- **`AUTH_ENABLED=true`** (default): Requires authentication tokens for all API calls
- **`AUTH_ENABLED=false`**: Allows public access without authentication

Since your app is a **public chess analytics tool**, you want `AUTH_ENABLED=false`.

## After Adding the Variable

1. **Railway will redeploy** (~2 minutes)
2. **Frontend will work** without authentication errors
3. **Anyone can view chess data** (which is what you want!)

## Security Note

This is **safe for your use case** because:
- ✅ Data is publicly viewable chess games
- ✅ RLS (Row Level Security) is still enforced in Supabase
- ✅ Write operations still require the service role key (which only backend has)
- ✅ Users can only read data, not modify it

## Verification

After deployment, test:

```bash
# Should return data, not "Not authenticated"
curl "https://chessanalytics-production.up.railway.app/api/v1/player-stats/skudurrrrr/chess.com"
```

## Timeline

- ⏱️ **Add variable:** 30 seconds
- ⏱️ **Railway redeploy:** 2 minutes
- ⏱️ **Total:** ~3 minutes

---

**After this fix, your app will be fully functional!** 🎉
