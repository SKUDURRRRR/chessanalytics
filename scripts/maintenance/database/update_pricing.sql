-- Update Pricing and Remove Enterprise Tier
-- This script updates the pricing to $5.45/month and $49.05/year
-- and ensures the Enterprise tier is deactivated

-- Update Free tier with same features as Pro Monthly, but with limits at top
UPDATE payment_tiers
SET
    features = '["5 game analyses per day", "100 game imports per day", "New Games Auto Import", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Personality insights", "Position exploration", "Tal inspired comments", "Playstyle analysis", "Learning suggestions"]'::jsonb,
    updated_at = NOW()
WHERE id = 'free';

-- Update Pro Monthly price to $5.45 with updated features
UPDATE payment_tiers
SET price_monthly = 5.45,
    features = '["Unlimited game imports", "Unlimited game analyses", "New Games Auto Import", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Personality insights", "Position exploration", "Tal inspired comments", "Playstyle analysis", "Learning suggestions"]'::jsonb,
    updated_at = NOW()
WHERE id = 'pro_monthly';

-- Update Pro Yearly price to $49.05 with updated features
UPDATE payment_tiers
SET price_yearly = 49.05,
    description = 'Save 25% with annual billing',
    features = '["Unlimited game imports", "Unlimited game analyses", "New Games Auto Import", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Personality insights", "Position exploration", "Tal inspired comments", "Playstyle analysis", "Learning suggestions", "25% savings vs monthly"]'::jsonb,
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
