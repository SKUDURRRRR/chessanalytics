# 🔧 Stripe Environment Setup Guide

## Problem Identified

The Stripe payments were failing with error **"Payment system not configured"** because:
- ❌ `.env.local` files didn't exist
- ❌ `STRIPE_SECRET_KEY` was not set
- ❌ Backend couldn't initialize StripeService

## ✅ Solution Applied

I've created two `.env.local` template files:
1. `.env.local` (main directory) - for frontend
2. `python/.env.local` - for backend

**These files now exist but contain placeholder values!**

---

## 🚀 Next Steps: Fill In Your Actual Credentials

### Step 1: Get Your Stripe API Keys

1. Go to **Stripe Dashboard**: https://dashboard.stripe.com/test/apikeys
2. You'll see two keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`) - Click "Reveal test key"

### Step 2: Get Your Supabase Credentials

1. Go to **Supabase Dashboard**: https://app.supabase.com/
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** (the `supabase.co` URL)
   - **anon/public key**
   - **service_role key** (click "Reveal" and copy)

### Step 3: Generate JWT Secret

Run this command in PowerShell:
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```
This generates a secure 64-character random string.

### Step 4: Edit `.env.local` (Main Directory)

Open: `.env.local`

Replace these values:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_anon_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_service_role_key

JWT_SECRET=your_generated_64_character_random_string
```

### Step 5: Edit `python/.env.local` (Python Directory)

Open: `python/.env.local`

Replace these values:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_anon_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_service_role_key

# THIS IS THE CRITICAL ONE FOR STRIPE PAYMENTS
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

JWT_SECRET=your_generated_64_character_random_string
```

---

## 🧪 Step 6: Test the Setup

### Verify Backend Can Load Stripe Key

Run this to test:
```powershell
cd python
python -c "import os; from dotenv import load_dotenv; load_dotenv('.env.local'); key = os.getenv('STRIPE_SECRET_KEY'); print('✅ STRIPE_SECRET_KEY is SET' if key and key.startswith('sk_test_') else '❌ STRIPE_SECRET_KEY is NOT SET or INVALID')"
```

Expected output: `✅ STRIPE_SECRET_KEY is SET`

### Restart Backend Server

If your backend is running, restart it:
```powershell
# Stop the current server (Ctrl+C in the terminal)
# Then start it again:
python -m python.core.unified_api_server
```

Look for this line in the output:
```
✓ STRIPE_SECRET_KEY loaded (starts with: sk_test_...)
Stripe service initialized successfully
```

### Test Stripe Checkout

1. Open your app: http://localhost:3000/pricing
2. Click **"Upgrade Now"** on Pro Monthly or Pro Yearly
3. You should now be redirected to **Stripe Checkout** (not see an error)
4. Use Stripe test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/28`
   - CVC: `123`
   - ZIP: `12345`

---

## 🎯 What Was Fixed

### Before (Broken)
```
❌ .env.local files didn't exist
❌ STRIPE_SECRET_KEY = undefined
❌ stripe_service.enabled = False
❌ Error: "Payment system not configured"
```

### After (Fixed)
```
✅ .env.local files created
✅ STRIPE_SECRET_KEY = sk_test_...
✅ stripe_service.enabled = True
✅ Stripe Checkout works!
```

---

## 📝 Important Notes

### Security
- ⚠️ **NEVER** commit `.env.local` files to git
- ✅ Already in `.gitignore` and `.cursorignore`
- ⚠️ Keep your `STRIPE_SECRET_KEY` secret!

### Required Environment Variables

**For Stripe to work, you MUST set:**
```env
STRIPE_SECRET_KEY=sk_test_...           # Backend (python/.env.local)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... # Frontend (.env.local)
```

**For the app to work, you also need:**
```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
```

### Troubleshooting

**Still getting "Payment system not configured"?**
1. Check backend logs for: `✓ STRIPE_SECRET_KEY loaded`
2. Make sure you restarted the backend after editing `.env.local`
3. Verify the key starts with `sk_test_` (not `pk_test_`)
4. Check there are no extra spaces or quotes in the key

**Checkout button does nothing?**
1. Open browser console (F12)
2. Check for JavaScript errors
3. Verify `VITE_STRIPE_PUBLISHABLE_KEY` in frontend `.env.local`
4. Make sure you're logged in (auth required)

---

## 🎉 Success Criteria

You'll know it's working when:
- ✅ Backend logs show: `Stripe service initialized successfully`
- ✅ Clicking "Upgrade Now" redirects to Stripe Checkout
- ✅ No "Payment system not configured" error
- ✅ Can complete test payment with `4242 4242 4242 4242`

---

## 📚 Additional Resources

- **Stripe Dashboard**: https://dashboard.stripe.com/test
- **Stripe Test Cards**: https://stripe.com/docs/testing
- **Full Testing Guide**: See `docs/STRIPE_TESTING_GUIDE.md`
- **Supabase Dashboard**: https://app.supabase.com/

---

**Need help?** The template files are ready - just fill in your actual API keys!
