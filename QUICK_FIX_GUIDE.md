# Production Deployment Quick Reference

## 🎯 TL;DR - Your Issue

**Problem:** App shows "0 games" and "Data unavailable"
**Cause:** Backend API not deployed or not connected
**Solution:** Deploy backend + Set `VITE_ANALYSIS_API_URL` environment variable

---

## 📦 What You Need to Deploy

### 1. Frontend (React/Vite)
**Current Status:** ✅ Deployed (chessdata.app)
**Hosts:** Vercel, Netlify, etc.

**Environment Variables Needed:**
```bash
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_ANALYSIS_API_URL=https://[backend-url]
```

### 2. Backend (Python/FastAPI)
**Current Status:** ❌ **NOT DEPLOYED** ← This is the problem!
**Hosts:** Railway, Render, Fly.io, etc.

**Environment Variables Needed:**
```bash
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
STOCKFISH_PATH=stockfish
API_HOST=0.0.0.0
API_PORT=$PORT
```

---

## ⚡ Quick Fix Steps

### Step 1: Deploy Backend (Choose One)

#### Option A: Railway (Fastest)
```bash
# 1. Install CLI
npm i -g railway

# 2. Login
railway login

# 3. Create new project
railway init

# 4. Set environment variables
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_ANON_KEY=your-anon-key
railway variables set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
railway variables set STOCKFISH_PATH=stockfish

# 5. Deploy
railway up

# 6. Get URL
railway domain
```

#### Option B: Render (Dashboard)
1. Go to render.com
2. New → Web Service
3. Connect GitHub repo
4. Build: `pip install -r requirements.txt`
5. Start: `cd python && uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables
7. Create service

### Step 2: Update Frontend

#### Vercel
```bash
# Via CLI
vercel env add VITE_ANALYSIS_API_URL production

# Or via dashboard:
# Settings → Environment Variables → Add
# Name: VITE_ANALYSIS_API_URL
# Value: https://your-backend-url.railway.app
```

#### Netlify
```bash
# Via CLI
netlify env:set VITE_ANALYSIS_API_URL https://your-backend-url.railway.app

# Or via dashboard:
# Site settings → Environment variables → Add
```

### Step 3: Redeploy Frontend
```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod

# Or trigger redeploy from dashboard
```

---

## 🧪 Testing

### Test Backend
```bash
curl https://your-backend-url.railway.app/health
# Expected: {"status":"healthy"}
```

### Test API Endpoint
```bash
curl "https://your-backend-url.railway.app/api/v1/analysis/stats/skudurrrrr/chess.com/stockfish"
# Expected: JSON with game stats
```

### Test Frontend
1. Open browser console (F12)
2. Go to your site
3. Look for: `🔧 UNIFIED_API_URL configured as: https://...`
4. Should NOT be localhost or undefined

---

## 🐛 Common Issues

### Issue 1: Still showing localhost
**Cause:** Frontend not redeployed after env var change
**Fix:** Redeploy frontend

### Issue 2: CORS errors
**Cause:** Backend doesn't allow frontend domain
**Fix:** Check `python/core/unified_api_server.py` CORS settings

### Issue 3: 401 Unauthorized from Supabase
**Cause:** Wrong Supabase credentials
**Fix:** Double-check keys in backend env vars

### Issue 4: Backend URL not working
**Cause:** Backend not deployed or crashed
**Fix:** Check deployment logs on Railway/Render

### Issue 5: "Module not found" in backend logs
**Cause:** Missing dependencies
**Fix:** Ensure `requirements.txt` is complete

---

## 📋 Checklist

### Backend Deployment
- [ ] Backend deployed to Railway/Render/Fly
- [ ] All environment variables set
- [ ] `/health` endpoint returns 200
- [ ] No errors in deployment logs
- [ ] Stockfish is available

### Frontend Configuration
- [ ] `VITE_ANALYSIS_API_URL` set to backend URL
- [ ] No trailing slash in URL
- [ ] Frontend redeployed after env var change
- [ ] Browser console shows correct backend URL
- [ ] No CORS errors in console

### Data Access
- [ ] Supabase credentials are correct
- [ ] RLS policies allow anon read access
- [ ] Games exist in database
- [ ] Backend can query Supabase

---

## 📞 Get Your Credentials

### Supabase Credentials
1. Go to https://app.supabase.com
2. Select your project
3. Settings → API
4. Copy:
   - Project URL → `SUPABASE_URL`
   - anon/public key → `SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

### Backend URL
- **Railway:** Project → Settings → Domains
- **Render:** Dashboard → Service → URL (top right)
- **Fly:** Run `fly status` or check dashboard

---

## 🔍 Diagnostic Tools

### Quick Python Check
```bash
cd chess-analytics
python diagnose_backend.py
```

### Browser Diagnostic
Open `diagnose_production.html` in your browser

### Manual Check
```bash
# Check if backend is accessible
curl -I https://your-backend-url.com/health

# Check if API works
curl "https://your-backend-url.com/api/v1/analysis/stats/skudurrrrr/chess.com/stockfish"

# Check frontend config
# Open browser console and look for UNIFIED_API_URL
```

---

## ⏱️ Time Estimate

| Task | Time |
|------|------|
| Deploy backend to Railway | 5-10 min |
| Set environment variables | 2 min |
| Update frontend env vars | 2 min |
| Redeploy frontend | 2 min |
| **Total** | **~15 min** |

---

## 📚 Additional Resources

- `URGENT_PRODUCTION_FIX.md` - Detailed step-by-step guide
- `PRODUCTION_ISSUE_DIAGNOSIS.md` - Problem diagnosis
- `DEPLOYMENT_SETUP.md` - General deployment guide
- `env.example` - Environment variable template

---

## 🆘 Still Stuck?

1. Run `python diagnose_backend.py`
2. Check browser console for errors
3. Share:
   - Backend deployment logs
   - Browser console output
   - Which hosting platforms you're using
