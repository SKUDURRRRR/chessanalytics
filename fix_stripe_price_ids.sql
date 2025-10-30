-- Run this in Supabase SQL Editor to fix the Stripe price IDs
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

-- Update Pro Monthly with Stripe price ID
UPDATE payment_tiers
SET stripe_price_id_monthly = 'price_1SNk0Q0CDBdO3EY30yDl3NMQ'
WHERE id = 'pro_monthly';

-- Update Pro Yearly with Stripe price ID
UPDATE payment_tiers
SET stripe_price_id_yearly = 'price_1SNk2o0CDBdO3EY3LDSUOkzK'
WHERE id = 'pro_yearly';

-- Verify the updates
SELECT
    id,
    name,
    price_monthly,
    price_yearly,
    stripe_price_id_monthly,
    stripe_price_id_yearly,
    is_active
FROM payment_tiers
ORDER BY display_order;
