# Stripe Price ID Setup

## Why This File?

The `fix_stripe_price_ids.sql` script updates your Supabase database with your Stripe price IDs, linking your database payment tiers to your Stripe products.

## Setup Instructions

### 1. Get Your Stripe Price IDs

1. Go to [Stripe Products Dashboard](https://dashboard.stripe.com/test/products)
2. Find your **Pro Monthly** product
3. Copy the price ID (starts with `price_`)
4. Find your **Pro Yearly** product
5. Copy the price ID (starts with `price_`)

### 2. Create Your Script

```bash
# Copy the template to create your personal script
cp fix_stripe_price_ids.sql.template fix_stripe_price_ids.sql
```

### 3. Edit the Script

Open `fix_stripe_price_ids.sql` and replace:
- `YOUR_MONTHLY_PRICE_ID_HERE` with your actual monthly price ID
- `YOUR_YEARLY_PRICE_ID_HERE` with your actual yearly price ID

### 4. Run in Supabase

1. Go to your [Supabase SQL Editor](https://supabase.com/dashboard/project/nhpsnvhvfscrmyniihdn/sql/new)
2. Paste the contents of `fix_stripe_price_ids.sql`
3. Click **Run**
4. Verify the results show your price IDs correctly

## Security Notes

⚠️ **Important:**
- The `fix_stripe_price_ids.sql` file is **gitignored** and should NEVER be committed
- It contains environment-specific Stripe price IDs
- Each developer/environment needs their own version with their own price IDs
- Always use the template to create your local version

## Troubleshooting

**Issue:** Price IDs don't match in Stripe checkout

**Solution:** Verify that:
1. The price IDs in your database match those in Stripe dashboard
2. You're using test mode price IDs (`price_test_...`) in development
3. The products are active in your Stripe account

**Issue:** Can't find the price IDs

**Solution:**
1. Go to Stripe Dashboard → Products
2. Click on your product
3. The price ID is shown under "Pricing" section
4. Click to copy it directly

## Alternative: Using Environment Variables

Instead of this SQL script, you could also store price IDs as environment variables and reference them in your application code. However, storing them in the database allows for easier management through the Supabase dashboard.
