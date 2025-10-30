# Stripe Payment Testing Guide

## ✅ Pre-Testing Checklist

All configuration complete:
- ✅ Database migrations applied
- ✅ Supabase Authentication configured
- ✅ Stripe products created
- ✅ Stripe price IDs updated in database
- ✅ Environment variables set (Railway, Vercel, .env.local)
- ⏳ Ready to test!

## 🧪 Test 1: Frontend Checkout Flow

### Step 1: Start Your Applications

**Terminal 1 - Backend (if testing locally):**
```bash
python -m python.core.unified_api_server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### Step 2: Create a Test Account

1. Open http://localhost:5173 (or your Vercel URL)
2. Click **"Sign Up"**
3. Create account using:
   - **Email + Password**, OR
   - **Google OAuth**
4. Verify you can log in

### Step 3: Test the Pricing Page

1. Navigate to **Pricing** page (should be in navigation)
2. You should see 3 tiers:
   - **Free** - 100 imports/day, 5 analyses/day
   - **Pro Monthly** - €5.45/month - Unlimited
   - **Pro Yearly** - €49.05/year - Unlimited

### Step 4: Test Stripe Checkout

1. Click **"Upgrade to Pro"** on either Pro tier
2. You should be **redirected to Stripe Checkout**
3. Use **Stripe test card**:
   ```
   Card Number: 4242 4242 4242 4242
   Expiry: 12/28 (any future date)
   CVC: 123 (any 3 digits)
   Name: Test User
   Postal: 12345 (any 5 digits)
   ```
4. Click **"Subscribe"** or **"Pay"**
5. You should be **redirected back** to your app

### Step 5: Verify Subscription Activated

**In your app:**
- ✅ Navigation shows **"Unlimited"** for imports/analyses
- ✅ No more limit warnings
- ✅ Can import unlimited games
- ✅ Can analyze unlimited games

**In Stripe Dashboard:**
1. Go to https://dashboard.stripe.com/test/payments
2. ✅ Verify payment appears with status "Succeeded"
3. Go to https://dashboard.stripe.com/test/subscriptions
4. ✅ Verify subscription is "Active"

**In Database:**
Run this in Supabase SQL Editor:
```sql
SELECT
    au.id,
    u.email,
    au.username,
    au.account_tier,
    au.subscription_status,
    au.stripe_customer_id,
    au.stripe_subscription_id
FROM authenticated_users au
LEFT JOIN auth.users u ON au.id = u.id
ORDER BY au.created_at DESC
LIMIT 5;
```

Expected results:
- ✅ `account_tier` = `'pro'` or `'pro_monthly'` or `'pro_yearly'`
- ✅ `subscription_status` = `'active'`
- ✅ `stripe_customer_id` starts with `cus_`
- ✅ `stripe_subscription_id` starts with `sub_`

---

## 🧪 Test 2: Usage Limits (Before Upgrade)

### Test Free Tier Limits

1. **Create a new test account** (don't upgrade)
2. Navigate to analytics page
3. Check navigation shows:
   - **100/100** imports remaining
   - **5/5** analyses remaining
4. Import a game
5. Verify counter decrements: **99/100** imports
6. Analyze a game
7. Verify counter decrements: **4/5** analyses

### Test Limit Enforcement

Try to exceed limits (you'll need to import 100+ games):
1. When you hit 0 imports remaining:
   - ✅ Should show **"Usage Limit Reached"** modal
   - ✅ Modal suggests upgrading to Pro
   - ✅ Cannot import more games
2. Wait 24 hours or manually reset in database to test reset

---

## 🧪 Test 3: Authentication Flow

### Test Email Sign Up
1. Go to `/signup`
2. Enter email and password
3. ✅ Check email for confirmation link
4. ✅ Click link to verify email
5. ✅ Log in successfully

### Test Google OAuth
1. Go to `/login`
2. Click **"Sign in with Google"**
3. ✅ Redirected to Google auth
4. ✅ Select Google account
5. ✅ Redirected back and logged in

### Test Lichess OAuth (if configured)
1. Go to `/login`
2. Click **"Sign in with Lichess"**
3. ✅ Redirected to Lichess
4. ✅ Authorize app
5. ✅ Redirected back and logged in

---

## 🧪 Test 4: Webhook Processing

### Setup Stripe CLI (for local testing)

1. **Install Stripe CLI:**
   - Windows: Download from https://github.com/stripe/stripe-cli/releases
   - Mac: `brew install stripe/stripe-cli/stripe`
   - Linux: https://stripe.com/docs/stripe-cli

2. **Login to Stripe:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to local backend:**
   ```bash
   stripe listen --forward-to localhost:8002/api/v1/payments/webhook
   ```

4. **Test webhook:**
   Open new terminal and run:
   ```bash
   stripe trigger customer.subscription.created
   stripe trigger invoice.paid
   stripe trigger customer.subscription.updated
   ```

5. **Check logs:**
   - Your backend should log webhook events
   - Check Stripe CLI output for delivery confirmation

### Verify Webhook in Production

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Enter endpoint URL:
   - Railway: `https://your-app.railway.app/api/v1/payments/webhook`
   - Or your custom domain
4. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy **"Signing secret"** (starts with `whsec_`)
6. Add to Railway environment: `STRIPE_WEBHOOK_SECRET=whsec_xxx`
7. Redeploy Railway app

---

## 🐛 Troubleshooting

### Issue: Checkout button doesn't work
- **Check:** Browser console for errors
- **Check:** Backend logs for API errors
- **Verify:** `STRIPE_SECRET_KEY` is set in backend
- **Verify:** `VITE_STRIPE_PUBLISHABLE_KEY` is set in frontend

### Issue: Redirected back but still shows "Free" tier
- **Check:** Webhook is configured correctly
- **Check:** Backend logs for webhook processing errors
- **Check:** Database - is `stripe_customer_id` populated?
- **Wait:** Webhook might take a few seconds to process

### Issue: "Usage Limit Reached" even after upgrade
- **Check:** Database - verify `account_tier` changed to `'pro'`
- **Try:** Log out and log back in
- **Check:** Backend is using updated JWT tokens

### Issue: Payment succeeded but subscription not created
- **Check:** Stripe Dashboard → Events for any failed events
- **Check:** Backend logs for errors
- **Verify:** Webhook secret matches between Stripe and backend

---

## 📊 Success Criteria

All tests pass if:
- ✅ Can sign up and log in
- ✅ Can see pricing page with correct tiers
- ✅ Can initiate Stripe checkout
- ✅ Can complete payment with test card
- ✅ Subscription shows "Active" in Stripe
- ✅ User account_tier updated to "pro" in database
- ✅ Navigation shows "Unlimited" usage
- ✅ Can import/analyze unlimited games
- ✅ Webhooks process successfully

---

## 🚀 Next Steps After Testing

Once all tests pass:

1. **Switch to Live Mode:**
   - Go to Stripe Dashboard → switch to "Live" mode
   - Create products again in live mode
   - Update database with live price IDs
   - Update environment variables with live keys
   - Test with real (small) payment

2. **Deploy to Production:**
   - Ensure Railway and Vercel are using production env vars
   - Test on production URLs
   - Monitor logs for first few transactions

3. **Set up Monitoring:**
   - Configure Stripe email notifications
   - Set up error alerts for failed webhooks
   - Monitor database for subscription status

4. **Legal/Compliance:**
   - Add terms of service
   - Add privacy policy
   - Add refund policy
   - Ensure GDPR compliance (if applicable)

---

## 🎉 You're Ready!

Your authentication and payment system is fully configured. Test thoroughly in test mode before going live!

**Need help?** Check:
- Stripe Dashboard → Developers → Logs
- Backend logs for errors
- Supabase Dashboard → Logs
- Browser console for frontend errors
