-- Update Pricing and Remove Enterprise Tier
-- This script updates the pricing to $5.45/month and $49.50/year
-- and ensures the Enterprise tier is deactivated

-- Update Pro Monthly price to $5.45
UPDATE payment_tiers
SET price_monthly = 5.45,
    updated_at = NOW()
WHERE id = 'pro_monthly';

-- Update Pro Yearly price to $49.50
UPDATE payment_tiers
SET price_yearly = 49.50,
    description = 'Save 20% with annual billing',
    updated_at = NOW()
WHERE id = 'pro_yearly';

-- Deactivate Enterprise tier
UPDATE payment_tiers
SET is_active = false,
    updated_at = NOW()
WHERE id = 'enterprise';

-- Verify changes
SELECT id, name, price_monthly, price_yearly, is_active
FROM payment_tiers
ORDER BY display_order;
