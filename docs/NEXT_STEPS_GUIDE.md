# Next Steps - Configuration & Deployment Guide

## ✅ Implementation Status

All code implementation is complete! Here's what we've built:

- ✅ Navigation component with auth UI
- ✅ Usage limit enforcement (frontend & backend)
- ✅ Import limit checking and tracking
- ✅ Analysis limit checking and tracking
- ✅ OAuth support (Google, Lichess, Chess.com)
- ✅ Usage stats display in navigation
- ✅ Friendly limit modals

## 🔧 Configuration Steps

### Step 1: Run Database Migrations

The database schema needs to be set up with the authentication and payment tables.

**Option A: Using Supabase CLI (Recommended)**

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

**Option B: Manual SQL Execution**

Go to Supabase Dashboard → SQL Editor and run these migrations in order:

1. `supabase/migrations/20251030000001_create_user_accounts.sql`
2. `supabase/migrations/20251030000002_link_existing_data.sql`
3. `supabase/migrations/20251030000003_seed_payment_tiers.sql`

**Verify migrations:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('authenticated_users', 'payment_tiers', 'usage_tracking');

-- Check payment tiers are seeded
SELECT * FROM payment_tiers;
```

### Step 2: Configure Supabase Authentication

Go to **Supabase Dashboard → Authentication → Providers**

#### A. Email Provider
- ✅ Enable email authentication
- ✅ Enable "Confirm email" checkbox
- ✅ Customize email templates (optional but recommended)
  - Welcome email
  - Password reset email
  - Email confirmation

#### B. Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Configure OAuth consent screen:
   - Select External user type (or Internal if using Google Workspace)
   - Fill in required fields (app name, user support email, developer contact)
   - Add scopes if needed (email, profile, openid are included by default)
   - Add test users if in testing mode
4. Enable Google Identity Services API (if required by your project)
5. Create OAuth 2.0 credentials:
   - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
6. Copy Client ID and Client Secret
7. In Supabase Dashboard:
   - Paste Client ID
   - Paste Client Secret
   - Enable Google provider
   - Save

#### C. Lichess OAuth (Optional)
1. Go to [Lichess OAuth App](https://lichess.org/account/oauth/app)
2. Create new OAuth app:
   - Name: Your App Name
   - Redirect URI: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
3. Copy Client ID and Client Secret
4. In Supabase Dashboard:
   - Add as custom OAuth provider (if not listed)
   - Paste credentials
   - Enable
   - Save

#### D. Chess.com OAuth (Optional)
See `docs/CHESS_COM_OAUTH_SETUP.md` for detailed instructions.

**Note:** Chess.com OAuth may require additional setup or may not be publicly available.

### Important: Update Redirect URLs in Supabase

After configuring OAuth providers, you need to add the redirect URLs:

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Under **Redirect URLs**, add these URLs:
   - For local development: `http://localhost:3000/`
   - For production: `https://your-domain.com/`
3. Click **Save**

**Note:** The OAuth flow redirects users to the home page (`/`) after successful authentication.

### Step 3: Set Up Stripe

#### A. Create Stripe Account
1. Sign up at [stripe.com](https://stripe.com)
2. Complete account verification
3. Start in **Test Mode** for development

#### B. Create Products
In Stripe Dashboard → Products:

1. **Pro Monthly**
   - Name: "Pro Monthly"
   - Price: $5.45/month
   - Recurring: Monthly
   - Copy the Price ID (starts with `price_`)

2. **Pro Yearly**
   - Name: "Pro Yearly"
   - Price: $49.05/year
   - Recurring: Yearly
   - Copy the Price ID (starts with `price_`)

#### C. Update Database with Stripe Price IDs
In Supabase SQL Editor:

```sql
-- Update Pro Monthly price ID
UPDATE payment_tiers
SET stripe_price_id_monthly = 'price_YOUR_MONTHLY_PRICE_ID'
WHERE id = 'pro_monthly';

-- Update Pro Yearly price ID
UPDATE payment_tiers
SET stripe_price_id_yearly = 'price_YOUR_YEARLY_PRICE_ID'
WHERE id = 'pro_yearly';

-- Verify
SELECT id, name, stripe_price_id_monthly, stripe_price_id_yearly
FROM payment_tiers;
```

#### D. Configure Stripe Webhook
See `docs/STRIPE_SETUP.md` for detailed webhook configuration.

**Quick Steps:**
1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-api-domain.com/api/v1/payments/webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy webhook signing secret
5. Add to backend environment variables

### Step 4: Update Environment Variables

#### Backend Environment Variables

Update your production backend environment (Render, Railway, etc.):

```bash
# Database (should already be set)
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT Authentication
JWT_SECRET=your_jwt_secret
JWT_ALGORITHM=HS256
JWT_ISSUER=https://YOUR_PROJECT_ID.supabase.co/auth/v1

# Stripe (Test Mode First)
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Usage Limits
FREE_TIER_IMPORTS_PER_DAY=100
FREE_TIER_ANALYSES_PER_DAY=5

# API Configuration
DEBUG=false
```

#### Frontend Environment Variables

Update your frontend environment (Vercel, Netlify, etc.):

```bash
# API URL
VITE_API_URL=https://your-backend-api-domain.com

# Supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Stripe (Test Mode First)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
```

### Step 5: Install/Update Dependencies

#### Backend
```bash
# Ensure Stripe is installed
pip install -r requirements.txt

# Or specifically:
pip install stripe>=7.0.0
```

#### Frontend
```bash
# Should already be installed, but verify:
npm install
```

### Step 6: Test in Development

#### A. Test Authentication
1. Start backend: `python -m python.core.unified_api_server`
2. Start frontend: `npm run dev`
3. Test signup with email
4. Check email for confirmation
5. Test login with email
6. Test Google OAuth
7. Test Lichess OAuth (if configured)
8. Test Chess.com OAuth (if configured)

#### B. Test Usage Limits
1. Sign up as a new user
2. Check navigation shows usage stats (100/100 imports, 5/5 analyses)
3. Try importing a player:
   - Should work
   - Usage should update (99 imports remaining)
4. Import 99 more times to reach limit
5. Try importing again:
   - Should show limit modal
   - Should suggest upgrade
6. Test analysis limits similarly

#### C. Test Stripe (Test Mode)
1. Go to pricing page
2. Click "Upgrade to Pro"
3. Use Stripe test card: `4242 4242 4242 4242`
4. Complete checkout
5. Verify subscription created in Stripe Dashboard
6. Verify user tier updated in database:
   ```sql
   SELECT id, email, account_tier, subscription_status
   FROM authenticated_users
   WHERE email = 'your-test-email@example.com';
   ```
7. Verify limits now show "Unlimited"

### Step 7: Deploy to Production

#### Backend Deployment
```bash
# If using Render/Railway, push to git:
git add .
git commit -m "Add user authentication and payment system"
git push origin optimization

# Or redeploy from dashboard
```

**Post-deployment checks:**
- ✅ Backend is running
- ✅ Health check endpoint responds
- ✅ Environment variables are set
- ✅ Database migrations ran successfully

#### Frontend Deployment
```bash
# If using Vercel:
vercel --prod

# Or push to git if auto-deploy is configured:
git push origin optimization
```

**Post-deployment checks:**
- ✅ Frontend loads
- ✅ Can navigate to all pages
- ✅ Authentication works
- ✅ API calls succeed

### Step 8: Switch to Stripe Live Mode

**Only after thorough testing in test mode!**

1. Stripe Dashboard → Switch to Live Mode
2. Create products again in live mode
3. Update database with live price IDs
4. Update backend environment with live Stripe keys:
   ```bash
   STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_WEBHOOK_SECRET
   ```
5. Update frontend environment:
   ```bash
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
   ```
6. Test with a real small payment (e.g., $0.50 test)
7. Verify webhook processing works
8. Monitor logs carefully

### Step 9: Monitor and Test Production

#### Key Metrics to Monitor
- User signups
- Authentication success rate
- Usage limit hits
- Stripe payment success rate
- Webhook processing success
- API error rates

#### Monitoring Tools
- Supabase Dashboard → Logs
- Stripe Dashboard → Events
- Your backend logs
- Frontend error tracking (if configured)

#### Test Scenarios
1. New user signup flow
2. User reaches free tier limit
3. User upgrades to Pro
4. Pro user has unlimited access
5. Subscription renewal works
6. Subscription cancellation works
7. Failed payment handling

## 🚀 Quick Start Checklist

Use this checklist to track your progress:

### Database Setup
- [ ] Run migration 1: create_user_accounts.sql
- [ ] Run migration 2: link_existing_data.sql
- [ ] Run migration 3: seed_payment_tiers.sql
- [ ] Verify tables created
- [ ] Verify payment tiers seeded

### Supabase Auth Configuration
- [ ] Enable email provider
- [ ] Configure Google OAuth
- [ ] Configure Lichess OAuth (optional)
- [ ] Configure Chess.com OAuth (optional)
- [ ] Test each auth method

### Stripe Setup
- [ ] Create Stripe account
- [ ] Create Pro Monthly product
- [ ] Create Pro Yearly product
- [ ] Update database with price IDs
- [ ] Configure webhook endpoint
- [ ] Test checkout flow (test mode)

### Environment Configuration
- [ ] Backend: Set all environment variables
- [ ] Frontend: Set all environment variables
- [ ] Verify environment variables loaded correctly

### Testing
- [ ] Test email signup/login
- [ ] Test Google OAuth
- [ ] Test usage limit enforcement (import)
- [ ] Test usage limit enforcement (analysis)
- [ ] Test Stripe checkout (test mode)
- [ ] Test webhook processing
- [ ] Test subscription management

### Production Deployment
- [ ] Deploy backend with new code
- [ ] Deploy frontend with new code
- [ ] Verify production works
- [ ] Switch Stripe to live mode
- [ ] Test with real payment
- [ ] Monitor for 24-48 hours

## 🆘 Troubleshooting

### Common Issues

**Database migrations fail:**
- Check Supabase service is running
- Verify connection credentials
- Run migrations one at a time
- Check for existing table conflicts

**OAuth not working:**
- Verify redirect URIs match exactly
- Check client credentials are correct
- Ensure OAuth provider is enabled in Supabase
- Check browser console for errors

**Usage limits not enforcing:**
- Verify JWT token is being sent
- Check backend logs for auth errors
- Verify usage_tracker is initialized
- Check database has usage_tracking table

**Stripe webhook not processing:**
- Verify webhook URL is correct
- Check webhook secret matches
- Test webhook with Stripe CLI
- Check backend logs for errors

## 📚 Additional Resources

- `docs/IMPLEMENTATION_COMPLETE.md` - What was implemented
- `docs/AUTH_PAYMENT_IMPLEMENTATION_SUMMARY.md` - Technical details
- `docs/STRIPE_SETUP.md` - Detailed Stripe configuration
- `docs/CHESS_COM_OAUTH_SETUP.md` - Chess.com OAuth setup
- Supabase Docs: https://supabase.com/docs
- Stripe Docs: https://stripe.com/docs

## 🎉 Success!

Once all steps are complete, you'll have:
- ✅ Full user authentication system
- ✅ Usage limit enforcement (fair 24h rolling window)
- ✅ Stripe payment integration
- ✅ Multiple OAuth options
- ✅ Seamless anonymous → authenticated flow
- ✅ Production-ready payment system

## Need Help?

If you encounter issues:
1. Check the relevant documentation file
2. Review backend logs for error messages
3. Check Supabase Dashboard logs
4. Review Stripe Dashboard events
5. Test each component independently
