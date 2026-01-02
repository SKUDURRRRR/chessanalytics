# 🔑 Required Environment Variables - Quick Reference

## 🚂 Railway (Backend)

Copy these to Railway Dashboard → Your Service → Variables:

```bash
# === STRIPE (Payment Processing) ===
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# === SUPABASE (Database) ===
SUPABASE_URL=https://nhpsnvhvfscrmyniihdn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx

# === SECURITY ===
JWT_SECRET=your_64_character_random_string_here_no_spaces

# === OPTIONAL (for redirect URLs) ===
VITE_API_URL=https://chessdata.app
```

---

## ▲ Vercel (Frontend)

Copy these to Vercel Dashboard → Your Project → Settings → Environment Variables:

```bash
# === STRIPE (Payment Processing) ===
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx

# === SUPABASE (Database) ===
VITE_SUPABASE_URL=https://nhpsnvhvfscrmyniihdn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx

# === API URL ===
VITE_ANALYSIS_API_URL=https://chess-analytics-production-up.railway.app
```

---

## 🔍 Where to Get These Values

### Stripe Keys (Get from https://dashboard.stripe.com)

**⚠️ IMPORTANT: Use LIVE MODE for production**

1. Go to: https://dashboard.stripe.com/apikeys
2. **Toggle to "Live mode"** (top-right corner)
3. Copy:
   - **Secret key** (Railway): Click "Reveal test key" → `sk_live_...`
   - **Publishable key** (Vercel): `pk_live_...`

### Stripe Webhook Secret

1. Go to: https://dashboard.stripe.com/webhooks (LIVE mode)
2. Click your webhook endpoint (or create new)
3. Endpoint URL: `https://chess-analytics-production-up.railway.app/api/v1/payments/webhook`
4. Select events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy **Signing secret**: `whsec_...`

### Supabase Keys (Get from https://app.supabase.com)

1. Go to: https://app.supabase.com
2. Select your project (nhpsnvhvfscrmyniihdn)
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL**: `https://nhpsnvhvfscrmyniihdn.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: Click "Reveal" → `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### JWT Secret (Generate)

**Option 1: OpenSSL (recommended)**
```bash
openssl rand -hex 32
```

**Option 2: PowerShell (Windows)**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Option 3: Python**
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## ✅ Verification

### Check Railway Logs
After setting variables and redeploying, look for:

```
✅ STRIPE_SECRET_KEY loaded
✅ Stripe service initialized successfully
```

**If you see this, you have a problem:**
```
❌ WARNING: Stripe library not installed
❌ ERROR: Stripe library not available
❌ STRIPE_SECRET_KEY not configured
```

### Check Vercel Deployment
After setting variables, redeploy and test:
1. Go to https://chessdata.app/pricing
2. Click "Upgrade Now"
3. Should redirect to Stripe Checkout

---

## 🚨 Security Notes

- ⚠️ **NEVER** commit secrets to git
- ⚠️ **NEVER** share `sk_live_`, `whsec_`, or `service_role` keys
- ✅ Use **Live mode** keys for production
- ✅ Use **Test mode** keys for development/testing
- ✅ Store keys in environment variables only

---

## 🧪 Test Mode vs Live Mode

### Test Mode (for development)
- Keys start with: `sk_test_`, `pk_test_`
- Use test credit cards: `4242 4242 4242 4242`
- No real money charged
- Toggle: **Viewing test data** in Stripe dashboard

### Live Mode (for production)
- Keys start with: `sk_live_`, `pk_live_`
- Real credit cards only
- Real money charged
- Toggle: **Viewing live data** in Stripe dashboard

**For chessdata.app production → Use LIVE MODE keys**

---

## 📋 Quick Checklist

### Railway Setup
- [ ] `STRIPE_SECRET_KEY` set (starts with `sk_live_`)
- [ ] `STRIPE_WEBHOOK_SECRET` set (starts with `whsec_`)
- [ ] `SUPABASE_URL` set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `SUPABASE_ANON_KEY` set
- [ ] `JWT_SECRET` set (64+ characters)
- [ ] Redeployed after setting variables
- [ ] Logs show "Stripe service initialized successfully"

### Vercel Setup
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` set (starts with `pk_live_`)
- [ ] `VITE_SUPABASE_URL` set
- [ ] `VITE_SUPABASE_ANON_KEY` set
- [ ] `VITE_ANALYSIS_API_URL` set to Railway backend URL
- [ ] Redeployed after setting variables
- [ ] Tested checkout button (redirects to Stripe)

### Stripe Setup
- [ ] Using **Live mode** (not test mode)
- [ ] Products created (Pro Monthly, Pro Yearly)
- [ ] Price IDs stored in Supabase `payment_tiers` table
- [ ] Webhook endpoint created
- [ ] Webhook points to Railway backend `/api/v1/payments/webhook`
- [ ] Webhook has correct events selected
- [ ] Webhook secret copied to Railway

---

**Ready to deploy?** Follow the steps in `PAYMENT_SYSTEM_FIX.md`!
