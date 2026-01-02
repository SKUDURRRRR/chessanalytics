# Stripe Environment Verification Script

## How to Verify if You're Using Live or Test Keys

Stripe price IDs look the same in test and live mode, so you need to verify which mode you're actually using.

### 1. Check Your Stripe Secret Key

Look at your environment variables (Railway/Render backend):

```bash
STRIPE_SECRET_KEY=sk_????_...
```

**If it starts with:**
- `sk_test_` → You're using TEST mode ⚠️
- `sk_live_` → You're using LIVE mode ✅

**Where to check:**
- Railway: Dashboard → Project → Backend Service → Variables tab
- Render: Dashboard → Service → Environment tab
- Local: `python/.env.local` file

### 2. Check Your Stripe Publishable Key

Look at your frontend environment variables (Vercel/Netlify):

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_????_...
```

**If it starts with:**
- `pk_test_` → You're using TEST mode ⚠️
- `pk_live_` → You're using LIVE mode ✅

**Where to check:**
- Vercel: Dashboard → Project → Settings → Environment Variables
- Netlify: Dashboard → Site → Site settings → Environment variables
- Local: `.env.local` file

### 3. Verify in Stripe Dashboard

The price IDs you have are:
- Monthly: `price_1SNk0Q0CDBdO3EY30yDl3NMQ`
- Yearly: `price_1SNyJt0CDBdO3EY3KWhzm6er`

**To check which mode they're from:**

1. Go to https://dashboard.stripe.com/products
2. Look at the toggle in the top-right corner:
   - If it says "Viewing test data" → These are TEST price IDs
   - If it says "Viewing live data" → These are LIVE price IDs
3. Search for one of your price IDs (e.g., `price_1SNk0Q0CDBdO3EY30yDl3NMQ`)
4. If you find it in the current mode, that's the mode it belongs to

**To check BOTH modes:**
1. While in TEST mode, search for your price ID
2. Toggle to LIVE mode (top-right corner)
3. Search for the same price ID
4. It will only appear in ONE mode

### 4. Quick Test: Make a Payment

**If using test mode:**
- ✅ Test card `4242 4242 4242 4242` will work
- ❌ Real credit cards will be declined

**If using live mode:**
- ❌ Test card `4242 4242 4242 4242` will be declined
- ✅ Real credit cards will work and charge real money

## Common Scenarios

### Scenario A: Everything is Test Mode ⚠️
**Signs:**
- `STRIPE_SECRET_KEY` starts with `sk_test_`
- `VITE_STRIPE_PUBLISHABLE_KEY` starts with `pk_test_`
- Price IDs found in Stripe TEST mode
- Test cards work, real cards don't

**What to do:**
- Follow `STRIPE_PRODUCTION_DEPLOYMENT.md` to switch to live mode
- Create new products in LIVE mode
- Update all keys and price IDs

### Scenario B: Everything is Live Mode ✅
**Signs:**
- `STRIPE_SECRET_KEY` starts with `sk_live_`
- `VITE_STRIPE_PUBLISHABLE_KEY` starts with `pk_live_`
- Price IDs found in Stripe LIVE mode
- Real cards work, test cards don't
- Webhook configured for production URL

**What to do:**
- ✅ You're all set for production!
- Just verify webhook is configured
- Monitor initial real payments

### Scenario C: Mixed Mode (DANGEROUS!) 🔴
**Signs:**
- Secret key is `sk_test_` but publishable is `pk_live_` (or vice versa)
- Frontend shows test mode but backend is live (or vice versa)
- Payments fail with cryptic errors

**What to do:**
- STOP using the system immediately
- All keys must be from the same mode
- Update ALL keys to match (either all test or all live)
- Test thoroughly before accepting payments

### Scenario D: Price IDs Don't Match Key Mode 🔴
**Signs:**
- Keys are `sk_live_` but price IDs are from test mode
- Checkout fails with "No such price" error
- Stripe Dashboard shows "Price not found" errors

**What to do:**
- Create products in LIVE mode (if using live keys)
- Update database with new live price IDs
- Or switch keys to test mode to match price IDs

## Verification Checklist

Run through this checklist:

### Backend Environment
- [ ] Check `STRIPE_SECRET_KEY` in production backend
- [ ] Verify it starts with `sk_test_` or `sk_live_`
- [ ] Note which one: __________

### Frontend Environment
- [ ] Check `VITE_STRIPE_PUBLISHABLE_KEY` in production frontend
- [ ] Verify it starts with `pk_test_` or `pk_live_`
- [ ] Note which one: __________

### Price IDs
- [ ] Go to Stripe Dashboard
- [ ] Note which mode you're viewing: __________
- [ ] Search for `price_1SNk0Q0CDBdO3EY30yDl3NMQ`
- [ ] Found in: ☐ Test Mode  ☐ Live Mode

### Webhook
- [ ] Go to Stripe Dashboard → Developers → Webhooks
- [ ] Note which mode you're viewing: __________
- [ ] Check if webhook exists for production URL
- [ ] Webhook secret starts with: __________

### Result Analysis

**If all Test Mode:**
- Status: Development/Testing ✅
- Action: Follow production deployment guide when ready
- Safety: ✅ No real money at risk

**If all Live Mode:**
- Status: Production Ready ✅
- Action: Monitor payments closely
- Safety: ⚠️ Real money involved - test thoroughly first

**If Mixed:**
- Status: CONFIGURATION ERROR 🔴
- Action: Fix immediately - align all to same mode
- Safety: 🔴 System may not work correctly

## Quick Commands to Check

### Check Backend Stripe Key (if you have access)
```python
import os
from dotenv import load_dotenv

load_dotenv('.env.local')
key = os.getenv('STRIPE_SECRET_KEY', 'NOT SET')

if key.startswith('sk_test_'):
    print("✅ Backend using TEST mode")
elif key.startswith('sk_live_'):
    print("✅ Backend using LIVE mode")
else:
    print("❌ Invalid or missing STRIPE_SECRET_KEY")
```

### Check Frontend Stripe Key (if you have access)
```bash
# In your frontend project root
grep VITE_STRIPE_PUBLISHABLE_KEY .env.local
```

## Next Steps

**After verifying:**

1. If everything is test mode and you want production:
   - → Follow `STRIPE_PRODUCTION_DEPLOYMENT.md`

2. If everything is live mode:
   - → You're ready for production!
   - → Double-check webhook is configured
   - → Test with a real small payment

3. If mixed or errors:
   - → Fix configuration first
   - → Align all keys to same mode
   - → Test thoroughly

---

**Created:** 2025-10-30
**Purpose:** Verify Stripe configuration mode
**Related:** STRIPE_PRODUCTION_DEPLOYMENT.md
