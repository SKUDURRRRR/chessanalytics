# 🔧 Payment System Fix - "Payment system not configured" Error

## 🐛 Problem Identified

Your live website shows: **"Failed to create checkout session: Payment system not configured"**

### Root Cause
The Stripe Python library (`stripe>=7.0.0`) was **not being installed** on Railway, causing:
```python
WARNING:root:Stripe library not installed. Payment features will be disabled.
ERROR:core.stripe_service:Stripe library not available
```

## 🎯 Why This Happened

### Issue 1: Docker Build Context Mismatch
- **Railway config**: `dockerfilePath = "python/Dockerfile"`
- **Build context**: Defaulted to `python/` directory
- **Problem**: `requirements.txt` is in the **root** directory, not `python/`
- **Result**: Dockerfile couldn't find `requirements.txt`, so pip install was skipped

### Issue 2: Dockerfile Path
The Dockerfile tried to copy:
```dockerfile
COPY requirements.txt .    # ❌ File doesn't exist in python/ directory
```

## ✅ Fix Applied

### 1. Updated `python/railway.toml`
Added explicit build context:
```toml
[build]
builder = "dockerfile"
dockerfilePath = "python/Dockerfile"
buildContext = "."    # ← NEW: Build from root directory

[deploy]
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### 2. Updated `python/Dockerfile`
Fixed file paths to work with root build context:
```dockerfile
# Copy requirements and install Python dependencies
# requirements.txt is in root directory
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code from python directory
COPY python/ .
```

## 🚀 Deployment Steps

### Step 1: Commit and Push Changes
```bash
git add python/Dockerfile python/railway.toml
git commit -m "Fix: Railway not installing Stripe library - update build context"
git push origin feature/user-auth-payments
```

### Step 2: Deploy to Railway
Railway should automatically detect the push and redeploy. Watch the build logs for:

**✅ Success indicators:**
```
Step 5/12 : COPY requirements.txt .
 ---> Using cache
Step 6/12 : RUN pip install --no-cache-dir -r requirements.txt
 ---> Running in abc123...
Collecting stripe>=7.0.0
  Downloading stripe-7.x.x-py3-none-any.whl (...)
Successfully installed stripe-7.x.x ...
```

**Then in runtime logs:**
```
INFO:core.unified_api_server:STRIPE_SECRET_KEY loaded
INFO:core.stripe_service:Stripe service initialized successfully  ← KEY SUCCESS MESSAGE
```

### Step 3: Verify Environment Variables
Make sure Railway has these variables set:

```bash
STRIPE_SECRET_KEY=sk_live_...           # ⚠️ CRITICAL
STRIPE_WEBHOOK_SECRET=whsec_...         # For webhook verification
SUPABASE_URL=https://nhpsnvhvfscrmyniihdn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
JWT_SECRET=...
```

### Step 4: Test the Fix
1. Go to https://chessdata.app/pricing
2. Click "Upgrade to Pro Monthly"
3. Should redirect to Stripe Checkout (no error message)
4. Complete test payment with card: `4242 4242 4242 4242`

## 📋 Complete Environment Variables Checklist

### 🚂 Railway (Backend) - Required:

| Variable | Value Format | Where to Get It | Status |
|----------|-------------|-----------------|---------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys) | ⚠️ CHECK |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) | ⚠️ CHECK |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Dashboard → Settings → API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase Dashboard → Settings → API | ✅ |
| `SUPABASE_ANON_KEY` | `eyJ...` | Supabase Dashboard → Settings → API | ✅ |
| `JWT_SECRET` | 64+ random chars | Generate: `openssl rand -hex 32` | ✅ |
| `VITE_API_URL` | `https://chessdata.app` | Your frontend URL | Optional |

### ▲ Vercel (Frontend) - Required:

| Variable | Value Format | Where to Get It | Status |
|----------|-------------|-----------------|---------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys) | ⚠️ CHECK |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Dashboard → Settings → API | ✅ |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase Dashboard → Settings → API | ✅ |
| `VITE_ANALYSIS_API_URL` | Railway backend URL | Your Railway service URL | ✅ |

## 🔐 Getting Your Stripe Keys

### For Production (LIVE MODE) - Use These:

1. Go to: https://dashboard.stripe.com/apikeys
2. **Toggle to "Live mode"** (top-right corner - toggle should be OFF/blue)
3. Copy keys:
   - **Secret key**: Click "Reveal test key" → Copy `sk_live_...`
   - **Publishable key**: Copy `pk_live_...`

### Webhook Secret:

1. Go to: https://dashboard.stripe.com/webhooks (in LIVE mode)
2. Find your webhook endpoint or create new one:
   - **Endpoint URL**: `https://chess-analytics-production-up.railway.app/api/v1/payments/webhook`
   - **Events to select**:
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
3. Copy the **Signing secret**: `whsec_...`

## 🧪 Testing After Deployment

### Test 1: Check Backend Logs
Railway logs should show:
```
✅ STRIPE_SECRET_KEY loaded
✅ Stripe service initialized successfully
❌ STRIPE_SECRET_KEY not configured. Payment features disabled.  ← Should NOT see this
```

### Test 2: Try Checkout
1. Go to https://chessdata.app/pricing
2. Click "Upgrade Now"
3. **Before fix**: Shows error "Payment system not configured"
4. **After fix**: Redirects to Stripe Checkout page

### Test 3: Complete Payment
Use Stripe test card (if in test mode):
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

For live mode, use a real card (you can cancel immediately after).

## 📊 Verification Checklist

- [ ] Committed and pushed Dockerfile + railway.toml changes
- [ ] Railway redeployed successfully
- [ ] Railway logs show "Stripe service initialized successfully"
- [ ] No "Stripe library not installed" errors in logs
- [ ] STRIPE_SECRET_KEY environment variable is set (check Railway dashboard)
- [ ] STRIPE_WEBHOOK_SECRET environment variable is set
- [ ] VITE_STRIPE_PUBLISHABLE_KEY is set in Vercel
- [ ] Clicking "Upgrade Now" redirects to Stripe (no error message)
- [ ] Can complete test checkout
- [ ] After payment, user's tier updates to "Pro Monthly"
- [ ] Subscription shows in user profile

## 🚨 Troubleshooting

### Still seeing "Payment system not configured"?

**Check Railway Logs:**
```bash
# In Railway dashboard → your service → Deployments → View Logs

# Look for:
INFO:core.unified_api_server:STRIPE_SECRET_KEY loaded
INFO:core.stripe_service:Stripe service initialized successfully

# If you see:
WARNING:root:Stripe library not installed
# → Redeploy didn't work, try manual redeploy in Railway dashboard
```

**Verify Environment Variables:**
1. Railway Dashboard → Your Service → Variables tab
2. Check `STRIPE_SECRET_KEY` exists and starts with `sk_test_` or `sk_live_`
3. No extra spaces or quotes around the value

**Manual Redeploy:**
1. Railway Dashboard → Your Service
2. Click "..." menu → Redeploy
3. Watch the build logs closely

### Stripe library still not installing?

Check build logs for:
```
Step X: COPY requirements.txt .
 ---> ERROR: requirements.txt not found
```

If you see this, the build context fix didn't work. Try:
1. Move `requirements.txt` to `python/requirements.txt`
2. Or adjust Dockerfile further

## 🎉 Success Criteria

You'll know everything works when:

1. ✅ Railway logs: `Stripe service initialized successfully`
2. ✅ No Stripe library errors in logs
3. ✅ Clicking "Upgrade Now" opens Stripe Checkout
4. ✅ Test payment completes successfully
5. ✅ User's tier changes to "Pro Monthly" in database
6. ✅ Profile page shows active subscription
7. ✅ Usage limits updated to unlimited

---

## 📝 Summary

**What was wrong:**
- Railway's build context was set to `python/` directory
- `requirements.txt` is in root directory
- Dockerfile couldn't find `requirements.txt`
- pip install never ran
- Stripe library never installed
- `stripe_service.enabled = False`
- Payment endpoints returned 503 error

**What we fixed:**
- Set Railway build context to root (`.`)
- Updated Dockerfile to copy from correct paths
- Now pip will install all dependencies including Stripe

**Next steps:**
1. Push changes to git
2. Let Railway redeploy
3. Verify Stripe library is installed from logs
4. Test checkout functionality

---

**Need help?** Check the logs carefully and follow the troubleshooting section above.
