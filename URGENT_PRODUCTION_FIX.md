# 🚨 URGENT: Production Backend Not Connected

## The Problem

Your Chess Analytics app **REQUIRES TWO SERVICES** to work:

1. ✅ **Frontend (React)** - Currently deployed at chessdata.app
2. ❌ **Backend API (Python)** - **NOT DEPLOYED** or not accessible

**Result:** Frontend shows "0 games analyzed" and "Data unavailable" because it can't reach the backend to fetch data from Supabase.

---

## 🔍 How to Verify the Issue

### 1. Open Browser Console on Your Site

1. Go to https://chessdata.app/simple-analytics?user=skudurrrrr&platform=chess.com
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Look for:
   ```
   🔧 UNIFIED_API_URL configured as: [some_url]
   ```

**If you see:**
- `http://localhost:8002` → ❌ **This won't work in production!**
- `undefined` → ❌ **Environment variable not set!**
- A production URL (e.g., `https://...railway.app`) → Check if backend is running

### 2. Check Network Tab

1. Stay in Developer Tools
2. Go to Network tab
3. Refresh the page
4. Look for failed requests (red text) to URLs like:
   - `/api/v1/analysis/stats/...`
   - `/api/v1/comprehensive-analytics/...`
   - `/api/v1/player-stats/...`

These failures confirm the backend is not reachable.

---

## ✅ Solution: Deploy Your Backend

### Option 1: Railway (Recommended - 5 minutes)

1. **Go to [railway.app](https://railway.app) and sign in**

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your chess-analytics repository

3. **Configure Service**
   - Click on the service
   - Go to Settings → Start Command
   - Set: `cd python && uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Add Environment Variables**
   Go to Variables tab and add:
   ```
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   STOCKFISH_PATH=stockfish
   API_HOST=0.0.0.0
   API_PORT=$PORT
   ```

   **Where to find these:**
   - Go to your Supabase project
   - Settings → API
   - Copy URL and both keys

5. **Deploy**
   - Railway will auto-deploy
   - Wait ~2 minutes
   - Copy the public URL (e.g., `https://chess-api-production-XXXX.railway.app`)

6. **Test Backend**
   Visit: `https://your-backend-url.railway.app/health`

   Should see: `{"status":"healthy"}`

---

### Option 2: Render (Free Tier)

1. **Go to [render.com](https://render.com) and sign in**

2. **Create New Web Service**
   - Click "New +" → Web Service
   - Connect your GitHub repository

3. **Configure Service**
   - Name: `chess-analytics-api`
   - Region: Choose nearest
   - Branch: `master`
   - Root Directory: `.` (leave empty)
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `cd python && uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Add Environment Variables** (same as Railway above)

5. **Create Web Service**
   - Wait ~5 minutes for first deploy
   - Copy the URL

---

## 🔄 Update Frontend Configuration

Once your backend is deployed:

### If using Vercel:

1. Go to [vercel.com](https://vercel.com)
2. Select your chess-analytics project
3. Go to Settings → Environment Variables
4. Add or update:
   ```
   Name: VITE_ANALYSIS_API_URL
   Value: https://your-backend-url.railway.app
   ```
   **⚠️ REMOVE trailing slash if present!**

5. Go to Deployments tab
6. Click on the latest deployment → "..." menu → Redeploy

### If using Netlify:

1. Go to [netlify.com](https://netlify.com)
2. Select your site
3. Go to Site settings → Environment variables
4. Add or update:
   ```
   Key: VITE_ANALYSIS_API_URL
   Value: https://your-backend-url.railway.app
   ```

5. Go to Deploys
6. Click "Trigger deploy" → "Deploy site"

---

## ✅ Verification Steps

After deploying both services:

### 1. Test Backend Directly
```bash
curl https://your-backend-url.railway.app/health
# Should return: {"status":"healthy"}

curl "https://your-backend-url.railway.app/api/v1/analysis/stats/skudurrrrr/chess.com/stockfish"
# Should return game stats JSON
```

### 2. Check Frontend
1. Visit your site
2. Open browser console (F12)
3. Should see: `🔧 UNIFIED_API_URL configured as: https://your-backend-url.railway.app`
4. No red errors in console
5. Data should load!

### 3. Test User Page
Visit: `https://chessdata.app/simple-analytics?user=skudurrrrr&platform=chess.com`

Should now show:
- ✅ Total games analyzed (3696)
- ✅ Average accuracy
- ✅ Rating data
- ✅ Game history

---

## 📋 Quick Checklist

- [ ] Backend deployed to Railway/Render
- [ ] Backend `/health` endpoint returns 200 OK
- [ ] Backend environment variables set (Supabase URL, keys, Stockfish path)
- [ ] `VITE_ANALYSIS_API_URL` set in Vercel/Netlify
- [ ] Frontend redeployed after env var change
- [ ] Browser console shows correct API URL
- [ ] No CORS errors in console
- [ ] User data loads successfully

---

## 🆘 Still Not Working?

### Check Backend Logs
- Railway: Click service → Deployments → View Logs
- Render: Click service → Logs tab

Look for errors like:
- `SUPABASE_URL not set`
- `Connection refused`
- `ModuleNotFoundError`

### Check Frontend Console
Press F12 on your site and look for:
- Failed fetch requests (red in Network tab)
- CORS errors
- "Failed to fetch" messages

### Common Issues

**Issue:** Backend shows "ModuleNotFoundError"
**Fix:** Check `requirements.txt` includes all dependencies

**Issue:** CORS errors in browser
**Fix:** Backend should allow your frontend domain. Check `python/core/unified_api_server.py` CORS settings

**Issue:** "Failed to fetch"
**Fix:** Backend is not accessible. Check Railway/Render deployment status

**Issue:** Still showing localhost:8002
**Fix:** Redeploy frontend AFTER setting environment variable

---

## 📞 Need Help?

1. Share your backend deployment logs
2. Share browser console errors (F12 → Console tab)
3. Confirm which hosting platforms you're using (frontend & backend)

---

## 🎯 Expected Timeline

- Deploy backend: **10 minutes**
- Set env vars: **2 minutes**
- Redeploy frontend: **2 minutes**
- Propagation: **2 minutes**
- **Total: ~15 minutes**

After this, your app should work perfectly! 🎉
