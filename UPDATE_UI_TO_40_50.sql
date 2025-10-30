-- Update the database to match the actual Stripe price of $40.50
-- This will make your UI show $40.50/year

UPDATE payment_tiers
SET
    price_yearly = 40.50,
    description = 'Save 25% with annual billing',
    updated_at = NOW()
WHERE id = 'pro_yearly';

-- Verify the update
SELECT
    id,
    name,
    price_monthly,
    price_yearly,
    stripe_price_id_monthly,
    stripe_price_id_yearly,
    description
FROM payment_tiers
WHERE id = 'pro_yearly';

-- Expected result:
-- price_yearly should be 40.50
-- stripe_price_id_yearly should be price_1SNyJt0CDBdO3EY3KWhzm6er
