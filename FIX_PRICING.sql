-- Fix Pricing: Update to $5.45/month and $49.50/year, Remove Enterprise
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/nhpsnvhvfscrmyniihdn/sql/new

-- Update Pro Monthly to $5.45
UPDATE payment_tiers
SET price_monthly = 5.45
WHERE id = 'pro_monthly';

-- Update Pro Yearly to $49.50
UPDATE payment_tiers
SET price_yearly = 49.50
WHERE id = 'pro_yearly';

-- Deactivate Enterprise tier
UPDATE payment_tiers
SET is_active = false
WHERE id = 'enterprise';

-- Verify the changes
SELECT
    id,
    name,
    price_monthly,
    price_yearly,
    is_active,
    display_order
FROM payment_tiers
ORDER BY display_order;
