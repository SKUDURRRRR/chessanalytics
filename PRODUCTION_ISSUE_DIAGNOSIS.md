# Production Issue Diagnosis & Fix

## Problem
The frontend is showing "0 games analyzed" and "Data unavailable" even though games exist in the database for the user "skudurrrrr" (3696 games).

## Root Cause
Your Chess Analytics app has a **two-part architecture**:

1. **Frontend (React/Vite)** - Currently deployed (e.g., Vercel/Netlify)
2. **Backend API (Python/FastAPI)** - **NOT DEPLOYED OR NOT ACCESSIBLE**

The frontend is trying to fetch data from the backend API but failing because:
- The backend is not deployed to production
- OR the `VITE_ANALYSIS_API_URL` environment variable is not configured correctly in production
- OR the backend URL is set to `http://localhost:8002` (which doesn't work in production)

## How to Check

### 1. Check Frontend Environment Variable
Open your browser console on the production site and look for:
```
🔧 UNIFIED_API_URL configured as: [some_url]
```

If you see:
- `http://localhost:8002` → ❌ This won't work in production
- `undefined` or empty → ❌ Environment variable not set
- A valid production URL → ✓ But backend might be down

### 2. Check Backend Status
Try accessing these URLs in your browser:
- `[YOUR_BACKEND_URL]/health` → Should return status OK
- `[YOUR_BACKEND_URL]/api/v1/analysis/stats/skudurrrrr/chess.com/stockfish` → Should return game stats

## Solutions

### Solution 1: Deploy Backend API (Recommended)

#### Option A: Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Create new project
3. Connect your GitHub repository
4. Select the `python` folder or use nixpacks.toml
5. Set environment variables:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   STOCKFISH_PATH=stockfish
   API_HOST=0.0.0.0
   API_PORT=8002
   ```
6. Deploy
7. Copy the public URL (e.g., `https://your-app.railway.app`)

#### Option B: Deploy to Render
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect your GitHub repository
4. Use the existing `render.yaml` configuration
5. Set environment variables (same as Railway)
6. Deploy
7. Copy the public URL

### Solution 2: Update Frontend Environment Variable
Once your backend is deployed:

1. Go to your frontend hosting platform (Vercel/Netlify)
2. Navigate to Environment Variables
3. Add or update:
   ```
   VITE_ANALYSIS_API_URL=https://your-backend-url.com
   ```
4. **Important**: Remove any trailing slashes
5. Redeploy frontend

### Solution 3: Alternative - Frontend-Only Mode (Temporary Workaround)

If you can't deploy the backend right now, you can temporarily modify the frontend to use direct Supabase queries for read operations.

**Note**: This won't allow analysis features but will show existing data.

## Quick Test Commands

### Test Backend Locally
```bash
cd python
python main.py
# Should start on http://localhost:8002
```

### Test Frontend Locally
```bash
npm run dev
# Check if it can connect to local backend
```

### Test Production Backend
```bash
curl https://your-backend-url.com/health
# Should return: {"status":"healthy"}
```

## Verification Checklist

- [ ] Backend is deployed and accessible
- [ ] Backend `/health` endpoint returns 200 OK
- [ ] `VITE_ANALYSIS_API_URL` is set correctly in frontend environment
- [ ] Frontend can make requests to backend (check browser network tab)
- [ ] Backend has correct Supabase credentials
- [ ] Backend has Stockfish installed
- [ ] CORS is configured correctly on backend

## Expected Architecture

```
Production Setup:
┌─────────────────────────────────────────┐
│ Frontend (Vercel/Netlify)               │
│ https://chessdata.app                   │
│ VITE_ANALYSIS_API_URL → Backend URL     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Backend API (Railway/Render)            │
│ https://chess-api.railway.app           │
│ SUPABASE_URL → Supabase Project         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Database (Supabase)                     │
│ https://xyz.supabase.co                 │
│ Contains: games, analyses, user data    │
└─────────────────────────────────────────┘
```

## Debug Steps

1. **Check browser console** - Look for API errors
2. **Check browser network tab** - See which API calls are failing
3. **Check backend logs** - If deployed, check Railway/Render logs
4. **Check Supabase RLS policies** - Ensure anon key can read data

## Common Errors

### Error: "Failed to fetch"
- Backend is not accessible
- CORS issue
- Backend is down

### Error: "401 Unauthorized"
- Supabase credentials are wrong
- RLS policies are too restrictive

### Error: "0 games analyzed" but games exist
- This is your current issue
- Backend can't reach database OR frontend can't reach backend

## Next Steps

1. Deploy backend to Railway or Render (15 minutes)
2. Set `VITE_ANALYSIS_API_URL` in Vercel/Netlify (2 minutes)
3. Redeploy frontend (2 minutes)
4. Test the app (should work immediately)

## Need Help?
Check these files for configuration:
- `env.example` - Environment variable examples
- `nixpacks.toml` - Railway deployment config
- `render.yaml` - Render deployment config
- `vercel.json` - Frontend deployment config
