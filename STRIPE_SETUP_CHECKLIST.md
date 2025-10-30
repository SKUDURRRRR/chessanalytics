# 🎯 Stripe Payment Setup - Complete Checklist

## ✅ What I've Done

### 1. Created Environment Files
- ✅ Created `.env.local` (main directory) - **NEEDS YOUR KEYS**
- ✅ Created `python/.env.local` (backend directory) - **NEEDS YOUR KEYS**
- ✅ Created `STRIPE_ENV_SETUP_GUIDE.md` (detailed instructions)
- ✅ See below for instructions to generate your unique JWT Secret

### 2. Identified the Problem
- ❌ Environment files didn't exist
- ❌ `STRIPE_SECRET_KEY` was not set
- ❌ Backend couldn't initialize `StripeService`
- ❌ `stripe_service.enabled = False`
- ❌ Result: "Payment system not configured" error

---

## 📋 What YOU Need to Do

### Step 1: Get Your Stripe API Keys ⏱️ 2 minutes

1. Open: https://dashboard.stripe.com/test/apikeys
2. Copy **Secret key** (starts with `sk_test_`) - Click "Reveal test key"
3. Copy **Publishable key** (starts with `pk_test_`)

### Step 2: Get Your Supabase Credentials ⏱️ 2 minutes

1. Open: https://app.supabase.com/
2. Go to your project
3. Click **Settings** → **API**
4. Copy:
   - **Project URL** (https://xxxxx.supabase.co)
   - **anon public** key
   - **service_role** key (click "Reveal")

### Step 3: Generate Your Unique JWT Secret ⏱️ 1 minute

**⚠️ CRITICAL: Never use a shared JWT secret!**

Run this command to generate a unique JWT secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

**Copy the output** - you'll need it for the next steps.

### Step 4: Edit `.env.local` (Main Directory) ⏱️ 3 minutes

**File should be open in Notepad. Replace these:**

```env
# Frontend
VITE_API_URL=http://localhost:8002
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY

# Backend
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_SERVICE_ROLE_KEY
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_FROM_STEP_3
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Save the file!**

### Step 5: Edit `python/.env.local` (Python Directory) ⏱️ 3 minutes

**File should be open in Notepad. Replace these:**

```env
# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_SERVICE_ROLE_KEY

# Stripe - THIS IS CRITICAL!
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# JWT (use the SAME secret you generated in Step 3)
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_FROM_STEP_3

# API Config
API_HOST=127.0.0.1
API_PORT=8002
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Stockfish
STOCKFISH_PATH=./stockfish/stockfish-windows-x86-64-avx2.exe
STOCKFISH_DEPTH=14
STOCKFISH_SKILL_LEVEL=20
STOCKFISH_TIME_LIMIT=0.8
MAX_CONCURRENT_ANALYSES=4
```

**Save the file!**

### Step 6: Verify Setup ⏱️ 1 minute

Run this in PowerShell:
```powershell
cd python
python -c "import os; from dotenv import load_dotenv; load_dotenv('.env.local'); key = os.getenv('STRIPE_SECRET_KEY'); print('✅ STRIPE_SECRET_KEY is SET') if key and key.startswith('sk_test_') else print('❌ STRIPE_SECRET_KEY is NOT SET or INVALID')"
```

**Expected output:** `✅ STRIPE_SECRET_KEY is SET`

### Step 7: Restart Backend Server ⏱️ 1 minute

1. Stop your current backend (Ctrl+C in terminal)
2. Start it again:
   ```powershell
   cd python
   python -m python.core.unified_api_server
   ```

3. Look for these lines in the output:
   ```
   ✓ STRIPE_SECRET_KEY loaded (starts with: sk_test_...)
   ✓ Stripe library imported successfully
   Stripe service initialized successfully
   ```

### Step 8: Configure Stripe Price IDs ⏱️ 5 minutes

**⚠️ Important: You need to link your Stripe product prices to the database**

1. **Get your Stripe Price IDs:**
   - Go to: https://dashboard.stripe.com/test/products
   - Find your "Pro Monthly" product and copy its price ID (starts with `price_`)
   - Find your "Pro Yearly" product and copy its price ID (starts with `price_`)

2. **Create the SQL script:**
   - Copy `fix_stripe_price_ids.sql.template` to `fix_stripe_price_ids.sql`
   - Replace `YOUR_MONTHLY_PRICE_ID_HERE` with your monthly price ID
   - Replace `YOUR_YEARLY_PRICE_ID_HERE` with your yearly price ID

3. **Run in Supabase:**
   - Go to: https://supabase.com/dashboard/project/nhpsnvhvfscrmyniihdn/sql/new
   - Paste the contents of `fix_stripe_price_ids.sql`
   - Click **Run**
   - Verify the results show your price IDs

**Note:** The `fix_stripe_price_ids.sql` file is gitignored because it contains your environment-specific IDs.

### Step 9: Test Stripe Checkout ⏱️ 2 minutes

1. Open: http://localhost:3000/pricing
2. Click **"Upgrade Now"** on Pro Monthly or Pro Yearly
3. Should redirect to **Stripe Checkout** (not show an error!)
4. Use test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/28`
   - CVC: `123`
   - ZIP: `12345`

---

## ✅ Success Checklist

Check these off as you complete them:

- [ ] Got Stripe API keys from dashboard
- [ ] Got Supabase credentials from dashboard
- [ ] Edited `.env.local` (main directory)
- [ ] Edited `python/.env.local` (backend directory)
- [ ] Saved both files
- [ ] Got Stripe price IDs from dashboard
- [ ] Created and edited `fix_stripe_price_ids.sql` from template
- [ ] Ran price ID script in Supabase SQL Editor
- [ ] Verified `STRIPE_SECRET_KEY` is loaded
- [ ] Restarted backend server
- [ ] Saw "Stripe service initialized successfully" in logs
- [ ] Clicked "Upgrade Now" - redirected to Stripe (no error)
- [ ] Completed test payment successfully

---

## 🚨 Common Mistakes to Avoid

1. ❌ Forgetting to save the `.env.local` files
2. ❌ Using publishable key (`pk_test_`) instead of secret key (`sk_test_`) in backend
3. ❌ Adding extra spaces or quotes around keys
4. ❌ Not restarting the backend after editing `.env.local`
5. ❌ Using keys from live mode instead of test mode

---

## 🐛 Troubleshooting

### Still Getting "Payment system not configured"?

1. **Check backend logs** - Do you see:
   - `✓ STRIPE_SECRET_KEY loaded` ✅
   - `Stripe service initialized successfully` ✅

2. **If NO**, the key isn't loading:
   - Verify file is named `.env.local` (not `.env.local.txt`)
   - Check key starts with `sk_test_` (not `pk_test_`)
   - Make sure you saved the file
   - Restart backend

3. **If YES**, but still not working:
   - Check browser console for errors (F12)
   - Verify you're logged in (auth required)
   - Check `VITE_STRIPE_PUBLISHABLE_KEY` in main `.env.local`

### Backend Won't Start?

- Check for syntax errors in `.env.local` files
- Make sure there are no duplicate keys
- Verify Supabase credentials are correct

---

## 📊 What's Already Configured

✅ Database migrations applied
✅ Payment tiers seeded in database
✅ Stripe integration code ready
✅ Frontend checkout code working
✅ Backend API endpoints configured
✅ Authentication system ready

**You ONLY need to add your API keys and price IDs to environment variables!**

---

## 🎉 After Success

Once payments are working:

1. **Test thoroughly** with different scenarios
2. **Set up webhooks** in Stripe Dashboard (optional for now)
3. **Add real products** in Stripe (when ready for production)
4. **Switch to live keys** (when going to production)

---

## 📚 Reference

- **Setup Guide**: `STRIPE_ENV_SETUP_GUIDE.md` (detailed instructions)
- **Testing Guide**: `docs/STRIPE_TESTING_GUIDE.md`
- **Stripe Dashboard**: https://dashboard.stripe.com/test
- **Supabase Dashboard**: https://app.supabase.com/

---

## 🔐 How to Generate Your JWT Secret

Run this command in PowerShell to generate a secure JWT secret:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

Or use this Python command:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy the generated secret and use it for `JWT_SECRET` in both `.env.local` files above.

---

**Total Time Needed:** ~17 minutes

**You're almost there! Just need to fill in the API keys and restart!** 🚀
