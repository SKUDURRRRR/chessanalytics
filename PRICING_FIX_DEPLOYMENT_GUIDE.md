# Pricing Page Fix - Deployment Guide

## Problem Identified

The pricing page was not working in production because it was using the wrong environment variable name.

### Root Cause
- Code was using: `VITE_API_URL`
- Environment validation expected: `VITE_ANALYSIS_API_URL`
- Production environment had `VITE_ANALYSIS_API_URL` set, but not `VITE_API_URL`
- This caused the API calls to fail, resulting in empty pricing tiers

### Why It Worked in Development
In development, the code fell back to `http://localhost:8002`, which was running and accessible.
In production, the fallback `http://localhost:8002` doesn't exist, and `VITE_API_URL` was undefined.

## Files Fixed

### Frontend Source Files (Critical)
1. ✅ `src/pages/PricingPage.tsx` - Fixed 2 instances
2. ✅ `src/pages/ProfilePage.tsx` - Fixed 1 instance
3. ✅ `src/contexts/AuthContext.tsx` - Fixed 1 instance

### Configuration Files
4. ✅ `env.example` - Updated documentation

## Deployment Steps

### 1. Verify Environment Variable in Production

**For Vercel:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify you have: `VITE_ANALYSIS_API_URL` set to your backend URL
3. Example: `VITE_ANALYSIS_API_URL=https://your-backend.railway.app`

**Important:** Make sure the variable name is exactly `VITE_ANALYSIS_API_URL`, not `VITE_API_URL`

### 2. Deploy the Frontend Changes

```bash
# Commit the changes
git add .
git commit -m "fix: use correct environment variable for API URL (VITE_ANALYSIS_API_URL)"
git push
```

### 3. Verify the Fix

After deployment:
1. Visit `https://chessdata.app/pricing`
2. Open browser DevTools → Console
3. Look for successful API call to `/api/v1/payment-tiers`
4. Verify pricing cards are visible

### Expected Behavior After Fix
- ✅ Pricing cards should display (Free, Pro Monthly, Pro Yearly)
- ✅ Console should show: "Pricing tiers fetched successfully"
- ✅ No 404 or network errors for API calls

## Testing Locally

Before deploying, test locally:

```bash
# Make sure your .env has VITE_ANALYSIS_API_URL (not VITE_API_URL)
echo "VITE_ANALYSIS_API_URL=http://localhost:8002" >> .env

# Run the development server
npm run dev

# Visit http://localhost:3000/pricing
# Verify pricing cards display correctly
```

## Environment Variable Checklist

### Required Frontend Variables (Vercel)
- ✅ `VITE_ANALYSIS_API_URL` - Backend API URL
- ✅ `VITE_SUPABASE_URL` - Supabase project URL
- ✅ `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- ✅ `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe public key

### Required Backend Variables (Railway)
- ✅ `SUPABASE_URL` - Supabase project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- ✅ `STRIPE_SECRET_KEY` - Stripe secret key
- ✅ `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- ✅ `STRIPE_PRICE_ID_PRO_MONTHLY` - Stripe price ID
- ✅ `STRIPE_PRICE_ID_PRO_YEARLY` - Stripe price ID

## Troubleshooting

### If pricing cards still don't show:

1. **Check browser console for errors:**
   - Press F12 → Console tab
   - Look for red error messages
   - Check Network tab for failed API calls

2. **Verify environment variable:**
   ```bash
   # In Vercel dashboard, check the variable is set
   # It should be: VITE_ANALYSIS_API_URL=https://your-backend-url.com
   ```

3. **Check backend is running:**
   - Visit `https://your-backend-url.com/api/v1/payment-tiers`
   - Should return JSON with pricing tiers
   - If 404 or error, backend may be down

4. **Check CORS settings:**
   - Backend must allow requests from `https://chessdata.app`
   - Verify CORS_ORIGINS includes your frontend domain

5. **Verify backend endpoint:**
   - Ensure `/api/v1/payment-tiers` endpoint exists
   - Check backend logs for any errors

## Backend Payment Tiers Endpoint

The pricing page fetches data from:
```
GET /api/v1/payment-tiers
```

Expected response:
```json
{
  "tiers": [
    {
      "id": "free",
      "name": "Free",
      "description": "Perfect for trying out chess analytics",
      "price_monthly": null,
      "price_yearly": null,
      "import_limit": 100,
      "features": [...]
    },
    {
      "id": "pro_monthly",
      "name": "Pro Monthly",
      "description": "Unlimited access to all chess analytics features",
      "price_monthly": 5.45,
      "price_yearly": null,
      "import_limit": null,
      "features": [...]
    },
    {
      "id": "pro_yearly",
      "name": "Pro Yearly",
      "description": "Save 25% with annual billing",
      "price_monthly": null,
      "price_yearly": 49.05,
      "import_limit": null,
      "features": [...]
    }
  ]
}
```

## Summary

This fix ensures consistent use of `VITE_ANALYSIS_API_URL` throughout the codebase, matching the environment validation schema and production environment configuration.

**Next Steps:**
1. Deploy frontend changes to Vercel
2. Verify environment variable is correctly set
3. Test the pricing page in production
4. Monitor for any errors in production logs
