# Stripe Production Deployment Checklist

## ⚠️ IMPORTANT: Current Status
- ✅ Development/Test Mode: Working locally with test keys
- ❌ Production/Live Mode: NOT YET CONFIGURED

## 🚨 Critical Issues if You Deploy Without Changes

If you deploy to production right now with current config:
1. ❌ Checkout will use TEST Stripe keys → Real payments will fail
2. ❌ Database has TEST price IDs → Checkouts will fail or charge wrong amounts
3. ❌ Webhooks pointing to test mode → Subscriptions won't activate
4. ❌ Users will see "test mode" warnings in Stripe checkout

## ✅ Production Deployment Steps

### Step 1: Create Live Stripe Products (15 min)

- [ ] Log into Stripe Dashboard: https://dashboard.stripe.com
- [ ] **Switch to LIVE MODE** (toggle in top-right corner)
- [ ] Go to Products → Create Product
  - [ ] Create "Pro Monthly" product:
    - Name: "Pro Monthly"
    - Price: $5.45
    - Billing: Monthly recurring
    - Copy price ID (starts with `price_`)
  - [ ] Create "Pro Yearly" product:
    - Name: "Pro Yearly"
    - Price: $49.05
    - Billing: Yearly recurring
    - Copy price ID (starts with `price_`)
- [ ] Save both price IDs somewhere safe

### Step 2: Get Live Stripe API Keys (5 min)

- [ ] In Stripe Dashboard (LIVE MODE) → Developers → API Keys
- [ ] Copy **Publishable key** (starts with `pk_live_`)
- [ ] Click "Reveal test key token" for **Secret key** (starts with `sk_live_`)
- [ ] Save both keys somewhere safe (password manager recommended)

⚠️ **Security Note:** NEVER commit live keys to git!

### Step 3: Configure Production Webhook (10 min)

- [ ] In Stripe Dashboard (LIVE MODE) → Developers → Webhooks
- [ ] Click "Add endpoint"
- [ ] Enter endpoint URL: `https://YOUR_PRODUCTION_API_URL/api/v1/stripe/webhook`
  - Replace `YOUR_PRODUCTION_API_URL` with your actual backend URL
  - Example: `https://chess-analytics-api.railway.app/api/v1/stripe/webhook`
- [ ] Click "Select events" and choose:
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.paid`
  - [ ] `invoice.payment_failed`
  - [ ] `invoice.payment_action_required`
- [ ] Click "Add endpoint"
- [ ] Copy the **Signing secret** (starts with `whsec_`)
- [ ] Save signing secret somewhere safe

### Step 4: Update Production Backend Environment Variables (10 min)

**Location:** Railway Dashboard → Your Project → Backend Service → Variables

Update these environment variables:

```bash
# Stripe Live Keys
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_WEBHOOK_SECRET_HERE

# CORS (update with your production domain)
# Multiple origins: comma-separated, no spaces
CORS_ORIGINS=https://your-production-frontend-domain.com,https://www.your-production-frontend-domain.com

# Verify these are set correctly
SUPABASE_URL=https://nhpsnvhvfscrmyniihdn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
```

**Format Validation Requirements:**
- **CORS_ORIGINS**: Multiple origins should be comma-separated (no spaces)
  - ✅ Correct: `https://example.com,https://www.example.com`
  - ❌ Wrong: `https://example.com, https://www.example.com` (has spaces)
- **SUPABASE_URL**: Must start with `https://` (minimum length check)
- **JWT_SECRET**: Must be at least 32 characters (use `openssl rand -hex 32` to generate)

**Checklist:**
- [ ] STRIPE_SECRET_KEY starts with `sk_live_` (NOT `sk_test_`)
- [ ] STRIPE_WEBHOOK_SECRET starts with `whsec_`
- [ ] CORS_ORIGINS includes your production frontend URL(s) - comma-separated, no spaces
- [ ] SUPABASE_URL starts with `https://`
- [ ] JWT_SECRET is at least 32 characters long
- [ ] Click "Save" and redeploy backend

### Step 5: Update Production Frontend Environment Variables (5 min)

**Location:** Vercel Dashboard → Your Project → Settings → Environment Variables

Update these environment variables:

```bash
# Stripe Live Key (Frontend)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY_HERE

# Verify these are set correctly
VITE_API_URL=https://your-production-backend-url.com
VITE_SUPABASE_URL=https://nhpsnvhvfscrmyniihdn.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Checklist:**
- [ ] VITE_STRIPE_PUBLISHABLE_KEY starts with `pk_live_` (NOT `pk_test_`)
- [ ] VITE_API_URL points to production backend
- [ ] Click "Save" and redeploy frontend

### Step 6: Update Production Database with Live Price IDs (5 min)

**Location:** Supabase Dashboard → SQL Editor

Run this SQL (replace with your LIVE price IDs from Step 1):

```sql
-- Verify current price IDs (should be test mode)
SELECT id, name, stripe_price_id_monthly, stripe_price_id_yearly
FROM payment_tiers
WHERE id IN ('pro_monthly', 'pro_yearly');

-- Update with LIVE price IDs
UPDATE payment_tiers
SET stripe_price_id_monthly = 'price_YOUR_LIVE_MONTHLY_PRICE_ID_HERE'
WHERE id = 'pro_monthly';

UPDATE payment_tiers
SET stripe_price_id_yearly = 'price_YOUR_LIVE_YEARLY_PRICE_ID_HERE'
WHERE id = 'pro_yearly';

-- Verify the update
SELECT id, name, stripe_price_id_monthly, stripe_price_id_yearly
FROM payment_tiers
WHERE id IN ('pro_monthly', 'pro_yearly');
```

**Checklist:**
- [ ] Ran first query to see current (test) price IDs
- [ ] Ran UPDATE queries with your live price IDs
- [ ] Ran verification query to confirm changes
- [ ] Both price IDs start with `price_` and look different from test IDs

### Step 7: Deploy Backend and Frontend (5 min)

**Backend:**
- [ ] Push latest code to git (if not already deployed)
- [ ] Trigger redeploy in Railway/Render dashboard (or auto-deploys)
- [ ] Wait for deployment to complete
- [ ] Check logs for "Stripe service initialized successfully"

**Frontend:**
- [ ] Push latest code to git (if not already deployed)
- [ ] Trigger redeploy in Vercel/Netlify dashboard (or auto-deploys)
- [ ] Wait for deployment to complete

### Step 8: Test Production Payment Flow (15 min)

⚠️ **Important:** First test with a small real payment, then refund it!

**Test with Real Card (Small Amount):**
- [ ] Go to your production site: `https://your-domain.com`
- [ ] Sign up for a new test account
- [ ] Navigate to pricing page
- [ ] Click "Upgrade to Pro Monthly" ($5.45)
- [ ] Enter REAL credit card details (your own card)
- [ ] Complete checkout
- [ ] Verify you're redirected back to your site
- [ ] Verify subscription shows as "Pro" in your profile

**Verify in Dashboards:**
- [ ] Stripe Dashboard (LIVE MODE) → Payments: See $5.45 payment
- [ ] Stripe Dashboard → Customers: See new customer created
- [ ] Stripe Dashboard → Subscriptions: See active subscription
- [ ] Supabase Dashboard → Table Editor → authenticated_users: User's account_tier = "pro"

**Refund Test Payment:**
- [ ] Stripe Dashboard → Payments → Find test payment → Refund
- [ ] Optional: Cancel test subscription

### Step 9: Verify Webhook Processing (10 min)

**Check Webhook Delivery:**
- [ ] Stripe Dashboard (LIVE MODE) → Developers → Webhooks
- [ ] Click on your webhook endpoint
- [ ] Check "Events" tab - should see events sent
- [ ] All events should show green checkmarks (200 response)
- [ ] If any failures, check backend logs for errors

**Test Webhook Events:**
- [ ] Create another test subscription (or use existing)
- [ ] In Stripe Dashboard, simulate events:
  - [ ] Cancel subscription → Verify user downgraded in database
  - [ ] Reactivate subscription → Verify user upgraded in database

### Step 10: Monitor Production (Ongoing)

**For First 24-48 Hours:**
- [ ] Check Stripe Dashboard → Events (should show successful payments)
- [ ] Check Backend Logs (Railway/Render) for errors
- [ ] Check Supabase Logs for database errors
- [ ] Monitor actual user signups and upgrades

**Set Up Alerts:**
- [ ] Stripe Dashboard → Webhooks → Configure failure notifications
- [ ] Backend monitoring/error tracking (if available)
- [ ] Database monitoring (Supabase dashboard)

---

## 🎯 Quick Reference: Test vs Live

| Item | Test Mode (Development) | Live Mode (Production) |
|------|------------------------|------------------------|
| Stripe Secret Key | `sk_test_...` | `sk_live_...` |
| Stripe Publishable Key | `pk_test_...` | `pk_live_...` |
| Stripe Price IDs | `price_1SNk0Q...` (test) | `price_...` (live, different) |
| Webhook Secret | `whsec_...` (test) | `whsec_...` (live, different) |
| Stripe Dashboard Toggle | "Test mode" | "Live mode" |
| Real Money | ❌ No | ✅ Yes |

---

## 🚨 Common Mistakes to Avoid

1. ❌ **Mixing test and live keys** - All keys must be from same mode
2. ❌ **Forgetting to update price IDs in database** - Will cause checkout failures
3. ❌ **Wrong webhook URL** - Subscriptions won't activate
4. ❌ **Deploying without testing** - Always test with a real payment first
5. ❌ **Not setting CORS correctly** - Frontend won't be able to call backend
6. ❌ **Committing live keys to git** - Security vulnerability

---

## ✅ Success Criteria

You'll know it's working when:

- ✅ Checkout page loads without errors
- ✅ Checkout form shows "Live mode" (or no test mode banner)
- ✅ Real payment succeeds
- ✅ User's account tier updates to "pro" in database
- ✅ User sees "Unlimited" usage limits
- ✅ Stripe webhook events show as delivered (200)
- ✅ No errors in backend logs

---

## 🆘 Troubleshooting

### "Invalid API Key" Error
- Check environment variables are set in production
- Verify key starts with `sk_live_` (not `sk_test_`)
- Redeploy backend after changing env vars

### "No such price" Error
- Database still has test price IDs
- Run Step 6 to update database with live price IDs

### Webhook Not Receiving Events
- Verify webhook URL is correct and accessible
- Check webhook signing secret matches environment variable
- Test webhook with Stripe CLI: `stripe listen --forward-to https://your-api.com/api/v1/stripe/webhook`

### Payment Succeeds but User Not Upgraded
- Check backend logs for webhook processing errors
- Verify webhook events are being delivered (Stripe Dashboard)
- Check Supabase service role key has permission to update users table

---

## 📞 Support Resources

- **Stripe Docs:** https://stripe.com/docs
- **Stripe Test Cards:** https://stripe.com/docs/testing
- **Supabase Docs:** https://supabase.com/docs
- **Your Stripe Dashboard:** https://dashboard.stripe.com
- **Your Supabase Dashboard:** https://supabase.com/dashboard/project/nhpsnvhvfscrmyniihdn

---

**Time Estimate:** ~1-2 hours total
**Complexity:** Medium (mostly configuration, minimal code changes)
**Risk Level:** Low (if following checklist carefully)

**Created:** 2025-10-30
**Status:** Ready to execute
