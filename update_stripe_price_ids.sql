-- Run this in Supabase SQL Editor to update the Stripe price IDs
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
--
-- Updated Price IDs for $49.05/year Pro Yearly plan
-- Monthly: price_1SNk0Q0CDBdO3EY30yDl3NMQ ($5.45/month)
-- Yearly:  price_1SNyJt0CDBdO3EY3KWhzm6er ($49.05/year)

-- Update Pro Monthly with Stripe price ID
UPDATE payment_tiers
SET stripe_price_id_monthly = 'price_1SNk0Q0CDBdO3EY30yDl3NMQ'
WHERE id = 'pro_monthly';

-- Update Pro Yearly with Stripe price ID
UPDATE payment_tiers
SET stripe_price_id_yearly = 'price_1SNyJt0CDBdO3EY3KWhzm6er'
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
