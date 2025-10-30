# Database Migrations Complete ✅

**Date:** 2025-10-30
**Status:** All migrations successfully applied

## What Was Applied

### 1. Speed Optimization Indexes (20251029000001)
- Added composite indexes for faster queries
- Optimized analytics page load times (expected 3-5x improvement)
- Optimized match history queries (expected 2-5x improvement)

### 2. User Accounts System (20251030000001)
Created tables:
- `authenticated_users` - User profiles with subscription info
- `payment_tiers` - Subscription plans (Free, Pro, Enterprise)
- `usage_tracking` - 24-hour rolling window usage limits
- `user_credits` - One-time credit purchases
- `payment_transactions` - Payment audit log

All tables have:
- Row Level Security (RLS) enabled
- Proper indexes for performance
- Auto-updating timestamps
- Service role full access

### 3. Link Existing Data to Auth (20251030000002)
- Added `auth_user_id` column to: `user_profiles`, `games`, `games_pgn`, `game_analyses`, `game_features`
- Created hybrid RLS policies (support both anonymous and authenticated users)
- Created helper functions:
  - `claim_anonymous_data()` - Links anonymous data after user registers
  - `check_usage_limits()` - Validates usage against tier limits

### 4. Seed Payment Tiers (20251030000003)
Created 4 tiers:
- **Free:** 100 imports/day, 5 analyses/day, $0
- **Pro Monthly:** Unlimited, $5.45/month
- **Pro Yearly:** Unlimited, $49.05/year (25% savings)
- **Enterprise:** Unlimited, Custom pricing

## Database Schema Summary

### New Tables
```
authenticated_users
├── id (UUID, references auth.users)
├── username (TEXT, unique)
├── account_tier (TEXT: 'free', 'pro', 'enterprise')
├── subscription_status (TEXT)
├── stripe_customer_id (TEXT)
├── stripe_subscription_id (TEXT)
└── subscription_end_date (TIMESTAMPTZ)

payment_tiers
├── id (TEXT)
├── name (TEXT)
├── price_monthly (DECIMAL)
├── price_yearly (DECIMAL)
├── import_limit (INTEGER, NULL = unlimited)
├── analysis_limit (INTEGER, NULL = unlimited)
├── stripe_price_id_monthly (TEXT)
└── stripe_price_id_yearly (TEXT)

usage_tracking
├── id (UUID)
├── user_id (UUID)
├── date (DATE)
├── games_imported (INTEGER)
├── games_analyzed (INTEGER)
└── reset_at (TIMESTAMPTZ)

user_credits
├── id (UUID)
├── user_id (UUID)
├── credits_remaining (INTEGER)
├── credits_total (INTEGER)
└── expires_at (TIMESTAMPTZ)

payment_transactions
├── id (UUID)
├── user_id (UUID)
├── stripe_payment_id (TEXT)
├── amount (DECIMAL)
├── status (TEXT)
└── transaction_type (TEXT)
```

### Modified Tables
All existing tables now have `auth_user_id UUID` column:
- `user_profiles`
- `games`
- `games_pgn`
- `game_analyses`
- `game_features`

## Migration Files Fixed

### Issues Resolved:
1. **Duplicate migration versions** - Renamed `20251027` migrations to `20251027000001` and `20251027000002`
2. **move_analyses index error** - Fixed incorrect `move_number` column reference
3. **Policy conflicts** - Added `DROP POLICY IF EXISTS` before creating policies

## Verification

Run this SQL in Supabase to verify:

```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('authenticated_users', 'payment_tiers', 'usage_tracking', 'user_credits', 'payment_transactions');

-- Check payment tiers are seeded
SELECT id, name, price_monthly, price_yearly, import_limit, analysis_limit
FROM payment_tiers
ORDER BY display_order;

-- Check auth_user_id columns added
SELECT
  'user_profiles' as table_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'auth_user_id') as has_auth_user_id
UNION ALL SELECT 'games', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'auth_user_id')
UNION ALL SELECT 'games_pgn', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'games_pgn' AND column_name = 'auth_user_id')
UNION ALL SELECT 'game_analyses', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'game_analyses' AND column_name = 'auth_user_id')
UNION ALL SELECT 'game_features', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'game_features' AND column_name = 'auth_user_id');
```

## Next Steps

See `docs/NEXT_STEPS_GUIDE.md` for:

1. ⏳ Configure Supabase Authentication (Email, Google, Lichess OAuth)
2. ⏳ Create Stripe products and get price IDs
3. ⏳ Update payment_tiers with Stripe price IDs
4. ⏳ Configure Stripe webhook
5. ⏳ Update Railway environment variables
6. ⏳ Update Vercel environment variables
7. ⏳ Test authentication flow
8. ⏳ Test usage limits
9. ⏳ Test Stripe checkout (test mode)
10. ⏳ Deploy to production

## Files Modified

- `supabase/migrations/20251027_fix_uncommon_opening.sql` → `20251027000001_fix_uncommon_opening.sql`
- `supabase/migrations/20251027_identify_a00_openings.sql` → `20251027000002_identify_a00_openings.sql`
- `supabase/migrations/20251029000001_speed_optimization_indexes.sql` (fixed)
- `supabase/migrations/20251030000001_create_user_accounts.sql` ✅
- `supabase/migrations/20251030000002_link_existing_data.sql` (fixed) ✅
- `supabase/migrations/20251030000003_seed_payment_tiers.sql` ✅

## Troubleshooting

### Supabase CLI Network Issues
If you encounter DNS resolution errors with `supabase db push`:
- Use Supabase Dashboard SQL Editor instead
- URL: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
- Copy and paste migration SQL directly

### Policy Already Exists Errors
Fixed by adding `DROP POLICY IF EXISTS` before all `CREATE POLICY` statements.

### Column Does Not Exist Errors
Fixed by checking actual table schema and updating index definitions.

## Success Criteria

- [x] All migrations in sync (Local = Remote)
- [x] authenticated_users table created
- [x] payment_tiers table created and seeded
- [x] usage_tracking table created
- [x] user_credits table created
- [x] payment_transactions table created
- [x] auth_user_id added to all existing tables
- [x] Hybrid RLS policies created
- [x] Helper functions created
- [ ] Supabase Auth configured
- [ ] Stripe products created
- [ ] Environment variables updated
- [ ] System tested end-to-end

---

**Status:** Database ready for authentication and payment integration! 🚀
