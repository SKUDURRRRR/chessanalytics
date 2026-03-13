# Production Pricing Page Debug Guide

## Issue Fixed
Updated environment validation to accept `VITE_API_URL` instead of `VITE_ANALYSIS_API_URL`.

## Critical Steps to Fix Production

### Step 1: Check Vercel Environment Variables

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

**Required Variables:**
```bash
VITE_API_URL=https://your-backend.railway.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

⚠️ **IMPORTANT**: Make sure `VITE_API_URL` is set, NOT `VITE_ANALYSIS_API_URL`

### Step 2: Force Rebuild in Vercel

After adding the environment variable:
1. Go to **Deployments** tab
2. Click the **three dots** (•••) on the latest deployment
3. Click **Redeploy**
4. Check **"Use existing build cache"** should be **UNCHECKED**

### Step 3: Check Browser Console

Once redeployed, visit `https://chessdata.app/pricing` and:
1. Press **F12** to open DevTools
2. Go to **Console** tab
3. Look for errors

**Expected Output (Success):**
```
Pricing tiers fetched successfully
```

**Common Error Messages:**

#### Error 1: "VITE_API_URL must be a valid URL"
**Cause**: Environment variable not set in Vercel
**Fix**: Add `VITE_API_URL` in Vercel settings

#### Error 2: "Failed to fetch" or CORS error
**Cause**: Backend not allowing requests from frontend domain
**Fix**: Check backend CORS settings (see below)

#### Error 3: "Network request failed" or timeout
**Cause**: Backend might be down or unreachable
**Fix**: Test backend directly (see Step 4)

### Step 4: Test Backend Directly

Open a new tab and visit:
```
https://your-backend.railway.app/api/v1/payment-tiers
```

**Expected Response:**
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
      "analysis_limit": 5,
      "features": [...],
      "stripe_price_id_monthly": null,
      "stripe_price_id_yearly": null,
      "is_active": true,
      "display_order": 0
    },
    {
      "id": "pro_monthly",
      "name": "Pro Monthly",
      ...
    },
    {
      "id": "pro_yearly",
      "name": "Pro Yearly",
      ...
    }
  ]
}
```

**If you see 404 or error:**
- Backend is not running or not deployed correctly
- Check Railway logs for errors

**If you see empty tiers array:**
- Database doesn't have payment tiers data
- Run the seeding migration (see Step 5)

### Step 5: Verify Database Has Payment Tiers

Connect to your Supabase database and run:
```sql
SELECT id, name, price_monthly, price_yearly, is_active
FROM payment_tiers
WHERE is_active = true
ORDER BY display_order;
```

**Expected Results:**
- free tier
- pro_monthly tier
- pro_yearly tier

**If empty:** Run this SQL to insert tiers:
```sql
INSERT INTO payment_tiers (id, name, description, price_monthly, price_yearly, import_limit, analysis_limit, features, is_active, display_order)
VALUES
  ('free', 'Free', 'Perfect for trying out chess analytics', NULL, NULL, 100, 5,
   '["100 game imports per day", "5 game analyses per day", "Basic chess analytics", "Opening analysis", "Personality scores", "Performance tracking"]'::jsonb,
   true, 0),

  ('pro_monthly', 'Pro Monthly', 'Unlimited access to all chess analytics features', 5.45, NULL, NULL, NULL,
   '["Unlimited game imports", "Unlimited game analyses", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Opponent preparation", "Personality insights"]'::jsonb,
   true, 1),

  ('pro_yearly', 'Pro Yearly', 'Save 25% with annual billing', NULL, 49.05, NULL, NULL,
   '["Unlimited game imports", "Unlimited game analyses", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Opponent preparation", "Personality insights", "25% savings vs monthly"]'::jsonb,
   true, 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  import_limit = EXCLUDED.import_limit,
  analysis_limit = EXCLUDED.analysis_limit,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();
```

### Step 6: Check CORS Configuration

In your backend (Railway), verify the `CORS_ORIGINS` environment variable includes your frontend domain:

```bash
CORS_ORIGINS=https://chessdata.app,https://www.chessdata.app,http://localhost:3000,http://localhost:5173
```

### Step 7: Network Tab Inspection

In browser DevTools:
1. Go to **Network** tab
2. Reload the pricing page
3. Look for request to `/api/v1/payment-tiers`

**Check these details:**
- **Status**: Should be `200 OK`
- **Response**: Should contain tiers data
- **Request URL**: Should point to your backend URL

**Common Issues:**

| Status | Meaning | Fix |
|--------|---------|-----|
| 404 | Endpoint not found | Backend not deployed or wrong URL |
| 500 | Server error | Check backend logs in Railway |
| 502/504 | Gateway timeout | Backend might be down or slow |
| CORS error | Cross-origin blocked | Add frontend domain to CORS_ORIGINS |

## Quick Test Script

Add this to your browser console on the pricing page:

```javascript
// Test if API URL is defined
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);

// Test API endpoint manually
fetch('https://your-backend.railway.app/api/v1/payment-tiers')
  .then(r => r.json())
  .then(data => {
    console.log('✅ API Response:', data);
    console.log('✅ Tiers found:', data.tiers?.length || 0);
  })
  .catch(err => {
    console.error('❌ API Error:', err);
  });
```

Replace `your-backend.railway.app` with your actual backend URL.

## Deployment Checklist

- [ ] Updated `src/lib/env.ts` to use `VITE_API_URL`
- [ ] Pushed changes to GitHub
- [ ] Added `VITE_API_URL` environment variable in Vercel
- [ ] Forced rebuild in Vercel (unchecked build cache)
- [ ] Verified backend `/api/v1/payment-tiers` endpoint works
- [ ] Verified database has payment tiers data
- [ ] Verified CORS includes frontend domain
- [ ] Tested pricing page in production
- [ ] No console errors in browser

## Still Not Working?

If you've done all the above and it's still not working, check:

### 1. Is the build actually using the new code?
- Go to Vercel deployment logs
- Search for "VITE_API_URL"
- Make sure it's being loaded

### 2. Is there a browser cache issue?
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Or open in incognito/private window

### 3. Check the actual deployed code
- In browser DevTools, go to **Sources** tab
- Find `PricingPage.tsx` or main bundle
- Search for `VITE_API_URL`
- Verify the code is using the correct variable

### 4. Enable debug logging
Add this to your Vercel environment variables:
```
VITE_DEBUG=true
VITE_LOG_LEVEL=debug
```

Then check console for more detailed logs.

## Contact Info for Further Debug

If still stuck, provide:
1. Screenshot of browser console errors
2. Screenshot of Network tab showing the API request
3. Backend URL so we can test the endpoint
4. Screenshot of Vercel environment variables (hide sensitive values)
