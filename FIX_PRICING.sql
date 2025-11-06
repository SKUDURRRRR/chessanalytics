-- Fix Pricing: Update to $5.45/month and $49.05/year with 25% savings
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
-- Replace YOUR_PROJECT_ID with your actual Supabase project ID

-- Update Free tier with same features as Pro Monthly, but with limits at top
UPDATE payment_tiers
SET
    features = '["5 game analyses per day", "100 game imports per day", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Personality insights", "Position exploration", "Tal inspired comments", "Playstyle analysis", "Learning suggestions"]'::jsonb
WHERE id = 'free';

-- Update Pro Monthly to $5.45 with updated features
UPDATE payment_tiers
SET
    price_monthly = 5.45,
    features = '["Unlimited game imports", "Unlimited game analyses", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Personality insights", "Position exploration", "Tal inspired comments", "Playstyle analysis", "Learning suggestions"]'::jsonb
WHERE id = 'pro_monthly';

-- Update Pro Yearly to $49.05 with correct description and features
UPDATE payment_tiers
SET
    price_yearly = 49.05,
    description = 'Save 25% with annual billing',
    features = '["Unlimited game imports", "Unlimited game analyses", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Personality insights", "Position exploration", "Tal inspired comments", "Playstyle analysis", "Learning suggestions", "25% savings vs monthly"]'::jsonb
WHERE id = 'pro_yearly';

-- Deactivate Enterprise tier
UPDATE payment_tiers
SET is_active = false
WHERE id = 'enterprise';

-- Verify the changes
SELECT
    id,
    name,
    description,
    price_monthly,
    price_yearly,
    features,
    is_active,
    display_order
FROM payment_tiers
ORDER BY display_order;
