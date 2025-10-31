# Environment Variables Configuration Guide

This guide helps you configure environment variables for both development and production deployments.

## Problem: "Profile page not loading after login"

**Symptom**: Users see a blank profile page or spinning loader after successful login.

**Cause**: The frontend is missing the `VITE_API_URL` environment variable pointing to your backend API.

---

## Required Environment Variables

### Frontend (Vercel)

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_API_URL` | `https://your-backend.up.railway.app` | ✅ Yes |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | ✅ Yes |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiI...` | ✅ Yes |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` or `pk_test_...` | ✅ Yes (for payments) |
| `VITE_CLARITY_PROJECT_ID` | Your Clarity ID | ❌ Optional |

### Backend (Railway)

| Variable | Value | Required |
|----------|-------|----------|
| `SUPABASE_URL` | `https://your-project.supabase.co` | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiI...` | ✅ Yes |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiI...` | ✅ Yes |
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` | ✅ Yes (for payments) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | ✅ Yes (for payments) |
| `JWT_SECRET` | Random 32+ char string | ✅ Yes |
| `PORT` | `8080` (Railway default) | ✅ Yes |
| `DEPLOYMENT_TIER` | `railway_hobby` | ❌ Optional |
| `CORS_ORIGINS` | Your frontend URLs | ✅ Yes |

---

## Step-by-Step: Fix Profile Loading Issue

### 1. Get Your Railway Backend URL

1. Open your Railway project
2. Click on your backend service
3. Go to **Settings** tab
4. Under **Networking**, find your **Public Domain**
5. Copy the URL (e.g., `https://chess-analytics-production.up.railway.app`)

### 2. Add Environment Variable to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (e.g., `chess-analytics`)
3. Click **Settings** in the top navigation
4. Click **Environment Variables** in the sidebar
5. Click **Add New** button
6. Fill in:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://your-backend-url.up.railway.app`
   - Select all environments: ✅ Production ✅ Preview ✅ Development
7. Click **Save**

### 3. Redeploy Your Frontend

After adding the environment variable, you **MUST** redeploy:

**Option A: Trigger Redeploy in Vercel**
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the three dots (...) menu
4. Select **Redeploy**

**Option B: Push a New Commit**
```bash
git commit --allow-empty -m "Trigger redeploy after env var update"
git push origin feature/user-auth-payments
```

### 4. Verify the Fix

1. Open your deployed site: `https://chessdata.app`
2. Sign in with your test account
3. Click **Profile** in the navigation
4. You should now see your profile page with:
   - Email address
   - Account tier
   - Usage statistics
   - Subscription management buttons

---

## How to Check if Environment Variables Are Set

### Check Vercel Environment Variables

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Pull environment variables
vercel env pull .env.local
```

### Check Railway Environment Variables

1. Go to Railway project
2. Click your service
3. Go to **Variables** tab
4. Verify all required variables are present

---

## Debugging Tips

### Frontend Issues

**Problem**: Profile page shows loading forever

```bash
# Check browser console (F12)
# Look for errors like:
# "Failed to fetch" - VITE_API_URL is wrong or missing
# "Network error" - Backend is down or CORS issue
# "401 Unauthorized" - Supabase keys are wrong
```

**Fix**:
- Verify `VITE_API_URL` is set correctly
- Check browser Network tab to see the actual request URL
- Make sure the URL starts with `https://` and has no trailing slash

### Backend Issues

**Problem**: Backend returns 500 errors

```bash
# Check Railway logs
# Look for:
# "Database connection error" - Supabase credentials wrong
# "Stripe error" - Stripe keys invalid
```

**Fix**:
- Verify all backend environment variables
- Check Railway logs for specific error messages

---

## Environment Variable Naming Convention

**Frontend (Vite)**: Must start with `VITE_`
- ✅ `VITE_API_URL`
- ✅ `VITE_SUPABASE_URL`
- ❌ `API_URL` (won't work - missing VITE_ prefix)

**Backend**: No special prefix needed
- ✅ `SUPABASE_URL`
- ✅ `STRIPE_SECRET_KEY`

---

## Production Checklist

Before deploying to production, verify:

- [ ] Frontend `VITE_API_URL` points to Railway backend (not localhost)
- [ ] Frontend `VITE_SUPABASE_URL` is set correctly
- [ ] Frontend `VITE_SUPABASE_ANON_KEY` is set correctly
- [ ] Frontend `VITE_STRIPE_PUBLISHABLE_KEY` uses production key (pk_live_)
- [ ] Backend `SUPABASE_URL` matches frontend
- [ ] Backend `SUPABASE_SERVICE_ROLE_KEY` is set (NOT anon key)
- [ ] Backend `STRIPE_SECRET_KEY` uses production key (sk_live_)
- [ ] Backend `CORS_ORIGINS` includes your production domain
- [ ] Both deployments are redeployed after env changes

---

## Quick Reference: Common URLs

```bash
# Development
VITE_API_URL=http://localhost:8002

# Production (Example)
VITE_API_URL=https://chess-analytics-production.up.railway.app

# Your Supabase URL format
VITE_SUPABASE_URL=https://[project-id].supabase.co
```

---

## Need Help?

If profile still doesn't load after following these steps:

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for error messages
4. Go to **Network** tab
5. Check if API requests are going to the correct URL
6. Share the error message for further assistance
