# Stripe Price IDs Environment Variables Fix

## Issue Summary
CodeRabbit identified hardcoded Stripe price IDs in multiple files. These were hardcoded in scripts, documentation, and SQL files, creating:
- **Maintenance burden**: Changes require updates in multiple places
- **Security risk**: Production IDs committed to version control
- **Flexibility issues**: Can't easily switch between dev/staging/prod environments

## Security & Maintenance Impact
- **Severity**: Major ⚠️
- **Risk Type**: Maintenance burden, configuration management
- **Note**: Stripe price IDs are less sensitive than API keys (they're visible in network requests), but still should be configurable

## Changes Applied

### 1. Environment Variables Added to `env.example`

Added new environment variables for Stripe price IDs:

```bash
# Stripe Price IDs (get from https://dashboard.stripe.com/products)
# Create your products/prices in Stripe and use those IDs here
STRIPE_PRICE_ID_PRO_MONTHLY=price_1SNk0Q0CDBdO3EY30yDl3NMQ
STRIPE_PRICE_ID_PRO_YEARLY=price_1SNyJt0CDBdO3EY3KWhzm6er
```

### 2. Python Scripts Updated

#### `fix_now.py`
**Before:**
```python
supabase.table('payment_tiers').update({
    'stripe_price_id_monthly': 'price_1SNk0Q0CDBdO3EY30yDl3NMQ'
}).eq('id', 'pro_monthly').execute()
```

**After:**
```python
# Get Stripe price IDs from environment variables
STRIPE_PRICE_ID_PRO_MONTHLY = os.getenv('STRIPE_PRICE_ID_PRO_MONTHLY')
STRIPE_PRICE_ID_PRO_YEARLY = os.getenv('STRIPE_PRICE_ID_PRO_YEARLY')

# Validate that both env vars are present
if not STRIPE_PRICE_ID_PRO_MONTHLY or not STRIPE_PRICE_ID_PRO_YEARLY:
    print("[ERROR] STRIPE_PRICE_ID_PRO_MONTHLY and STRIPE_PRICE_ID_PRO_YEARLY must be set in python/.env")
    exit(1)

# Use environment variables
supabase.table('payment_tiers').update({
    'stripe_price_id_monthly': STRIPE_PRICE_ID_PRO_MONTHLY
}).eq('id', 'pro_monthly').execute()
```

#### Files Updated:
- ✅ `fix_now.py` - Now reads from environment variables
- ✅ `fix_stripe_price_ids.py` - Now reads from environment variables
- ✅ `update_price_ids_now.py` - Now reads from environment variables

### 3. SQL Files Updated

Updated SQL files to use placeholders instead of hardcoded IDs:

#### `fix_stripe_price_ids.sql` & `update_stripe_price_ids.sql`
**Before:**
```sql
UPDATE payment_tiers
SET stripe_price_id_monthly = 'price_1SNk0Q0CDBdO3EY30yDl3NMQ'
WHERE id = 'pro_monthly';
```

**After:**
```sql
-- IMPORTANT: Replace the price IDs below with your actual Stripe price IDs from:
-- https://dashboard.stripe.com/products
--
-- These should match the values in your environment variables:
-- - STRIPE_PRICE_ID_PRO_MONTHLY
-- - STRIPE_PRICE_ID_PRO_YEARLY

UPDATE payment_tiers
SET stripe_price_id_monthly = 'price_YOUR_MONTHLY_PRICE_ID'
WHERE id = 'pro_monthly';
```

### 4. Documentation Updated

- ✅ `STRIPE_SETUP_CHECKLIST.md` - Removed hardcoded IDs from example
- ✅ SQL files now include instructions to use environment variable values

## How to Use

### For Local Development

1. Copy `env.example` to `python/.env`:
```bash
cp env.example python/.env
```

2. Update the Stripe price IDs in `python/.env`:
```bash
STRIPE_PRICE_ID_PRO_MONTHLY=price_YOUR_ACTUAL_MONTHLY_ID
STRIPE_PRICE_ID_PRO_YEARLY=price_YOUR_ACTUAL_YEARLY_ID
```

3. Run the update scripts:
```bash
python fix_now.py
# or
python fix_stripe_price_ids.py
# or
python update_price_ids_now.py
```

### For Production/Deployment

1. Set environment variables in your deployment platform:
   - Railway: Settings → Variables
   - Vercel: Settings → Environment Variables
   - Render: Environment → Environment Variables

2. Add both variables:
   ```bash
   STRIPE_PRICE_ID_PRO_MONTHLY=price_xxxxx
   STRIPE_PRICE_ID_PRO_YEARLY=price_xxxxx
   ```

### For Manual SQL Updates

If you prefer to update via SQL:

1. Get your price IDs from [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Replace the placeholders in the SQL files with your actual IDs
3. Run the SQL in Supabase SQL Editor

## Benefits of This Fix

✅ **Single Source of Truth**: Price IDs defined in one place (environment)
✅ **Environment-Specific**: Different IDs for dev/staging/prod
✅ **No Hardcoded Values**: Keeps production values out of version control
✅ **Better Validation**: Scripts now validate that price IDs are set
✅ **Easier Maintenance**: Change once in environment, not in multiple files

## Validation

All Python scripts now:
1. Read price IDs from environment variables
2. Validate that the variables are set
3. Provide clear error messages if missing
4. Use the environment values in database updates

## Best Practices Applied

1. ✅ Read configuration from environment variables
2. ✅ Validate required variables are present
3. ✅ Provide clear error messages
4. ✅ Keep sensitive/configurable data out of source control
5. ✅ Document where to find the values (Stripe Dashboard)

## Status

✅ **FIXED** - All hardcoded Stripe price IDs replaced with environment variables

## Related Files

**Modified:**
- `env.example`
- `fix_now.py`
- `fix_stripe_price_ids.py`
- `update_price_ids_now.py`
- `fix_stripe_price_ids.sql`
- `update_stripe_price_ids.sql`
- `STRIPE_SETUP_CHECKLIST.md`

**Documentation:**
- This file (`STRIPE_PRICE_IDS_FIX.md`)
