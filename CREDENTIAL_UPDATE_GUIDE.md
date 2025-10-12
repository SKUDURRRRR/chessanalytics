# Complete Credential Update Guide

## 🔍 Why Did We Have the 401 Error?

### Root Cause Analysis:

1. **Your Supabase project had OLD API keys** that were either:
   - ✅ Expired
   - ✅ Revoked when you created new ones
   - ✅ From a different/test project

2. **Your `.env.local` file was NOT updated** with the fresh keys from the Supabase dashboard

3. **Vite dev server caches environment variables** - even after updating `.env.local`, the old keys were still in memory until restart

4. **Browser cached the old configuration** - JavaScript bundles with old keys were still being used

## 📋 All Files That Need Credential Updates

### Local Development Files (Already Done ✅)
- ✅ `.env.local` - Frontend environment variables (Vite)
- ✅ Python shell environment variables - Set via `START_BACKEND_LOCAL.ps1`

### Production/Deployment Files (Need Review)

1. **Railway (Backend Python)**
   - Environment variables in Railway dashboard
   
2. **Vercel/Netlify (Frontend)**
   - Environment variables in deployment platform dashboard

3. **GitHub Actions (CI/CD)**
   - Repository secrets if you have automated deployments

## 🔐 Current Correct Credentials

### Supabase Project: `nhpsnvhvfscrmyniihdn`

```env
# Project URL
https://nhpsnvhvfscrmyniihdn.supabase.co

# Anon Key (Public - for frontend)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4ODIzMTcsImV4cCI6MjA3NTQ1ODMxN30.ed1X0YIg_ccm6Kare0Bdul-5869xYL4Ua-tIv6UnyGQ

# Service Role Key (Secret - for backend only!)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg4MjMxNywiZXhwIjoyMDc1NDU4MzE3fQ.DStrQSLMktOibIkN8EJTiLlvvbSSNLQ0dzsBS2HHrd0
```

## 📝 Step-by-Step Update Process

### 1. Local Development (✅ DONE)

#### Frontend (.env.local)
```env
VITE_SUPABASE_URL=https://nhpsnvhvfscrmyniihdn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4ODIzMTcsImV4cCI6MjA3NTQ1ODMxN30.ed1X0YIg_ccm6Kare0Bdul-5869xYL4Ua-tIv6UnyGQ
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg4MjMxNywiZXhwIjoyMDc1NDU4MzE3fQ.DStrQSLMktOibIkN8EJTiLlvvbSSNLQ0dzsBS2HHrd0
VITE_ANALYSIS_API_URL=http://localhost:8002
```

#### Backend (Use START_BACKEND_LOCAL.ps1)
The script already sets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 2. Production - Railway (Backend)

Go to: https://railway.app/dashboard

Find your project → Variables tab → Update:

```env
SUPABASE_URL=https://nhpsnvhvfscrmyniihdn.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4ODIzMTcsImV4cCI6MjA3NTQ1ODMxN30.ed1X0YIg_ccm6Kare0Bdul-5869xYL4Ua-tIv6UnyGQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg4MjMxNywiZXhwIjoyMDc1NDU4MzE3fQ.DStrQSLMktOibIkN8EJTiLlvvbSSNLQ0dzsBS2HHrd0
```

### 3. Production - Vercel/Netlify (Frontend)

#### For Vercel:
1. Go to: https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Update these variables:

```env
VITE_SUPABASE_URL=https://nhpsnvhvfscrmyniihdn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4ODIzMTcsImV4cCI6MjA3NTQ1ODMxN30.ed1X0YIg_ccm6Kare0Bdul-5869xYL4Ua-tIv6UnyGQ
VITE_ANALYSIS_API_URL=https://your-backend.railway.app
```

#### For Netlify:
1. Go to: https://app.netlify.com
2. Select your site
3. Site settings → Environment variables
4. Update same variables as above

### 4. GitHub Actions (CI/CD)

If you have GitHub Actions for deployment:

1. Go to: https://github.com/your-username/chess-analytics/settings/secrets/actions
2. Update these secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 🚀 After Updating Credentials

### Local Development:
```powershell
# 1. Stop everything
# Press Ctrl+C in both terminals

# 2. Clear caches
Remove-Item -Recurse -Force node_modules/.vite
Remove-Item -Recurse -Force .next (if using Next.js)

# 3. Restart backend
.\START_BACKEND_LOCAL.ps1

# 4. Restart frontend (new terminal)
npm run dev

# 5. Hard refresh browser
# Press Ctrl+Shift+R
```

### Production:
```powershell
# After updating environment variables in Railway/Vercel:

# 1. Trigger redeployment
# - Railway: Automatically redeploys on env var change
# - Vercel: Go to Deployments tab → Redeploy

# 2. Verify deployment logs
# Check for successful startup and no auth errors
```

## ✅ Verification Checklist

### Local:
- [ ] `.env.local` has correct keys
- [ ] Backend started with `START_BACKEND_LOCAL.ps1`
- [ ] Frontend restarted with `npm run dev`
- [ ] Browser cache cleared (Ctrl+Shift+R)
- [ ] No 401 errors in console
- [ ] Import games works
- [ ] Analytics display correctly

### Production:
- [ ] Railway environment variables updated
- [ ] Vercel/Netlify environment variables updated
- [ ] Backend redeployed successfully
- [ ] Frontend redeployed successfully
- [ ] Production site loads without auth errors
- [ ] Production imports work

## 🔒 Security Best Practices

### DO:
- ✅ Keep service_role keys **SECRET** (never commit to git)
- ✅ Use `.env.local` for local development (git ignored)
- ✅ Store production keys in platform dashboards only
- ✅ Rotate keys if they're ever exposed publicly
- ✅ Use different keys for development vs production (if possible)

### DON'T:
- ❌ Commit `.env` or `.env.local` to git
- ❌ Share service_role keys publicly
- ❌ Hardcode keys in source code
- ❌ Use production keys in development
- ❌ Store keys in unencrypted documents

## 📂 Files to NEVER Commit

Your `.gitignore` should have:
```gitignore
# Environment variables
.env
.env.local
.env.production
.env.development

# Secrets
*.key
*.pem
secrets/
```

## 🆘 If Keys Are Compromised

1. **Immediately go to Supabase dashboard**
2. **Settings → API → Regenerate keys**
3. **Update ALL environments** (local + production)
4. **Redeploy everything**
5. **Verify all services work with new keys**

## 📞 Need Help?

If you see 401 errors again:

1. Check the EXACT error message
2. Verify which endpoint is failing
3. Check if keys match in:
   - `.env.local` (frontend)
   - `START_BACKEND_LOCAL.ps1` (backend)
   - Supabase dashboard
4. Ensure Vite dev server was restarted
5. Ensure browser cache was cleared

