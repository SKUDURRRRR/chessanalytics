-- Update Pricing Features: Add new features and remove Opponent preparation
-- Run this in Supabase SQL Editor to update the database immediately
-- https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new

-- Update Free tier with same features as Pro Monthly, but with limits at top
UPDATE payment_tiers
SET
    features = '["5 game analyses per day", "100 game imports per day", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Personality insights", "Position exploration", "Tal inspired comments", "Playstyle analysis", "Learning suggestions"]'::jsonb,
    updated_at = NOW()
WHERE id = 'free';

-- Update Pro Monthly with new features (remove Opponent preparation, add new features)
UPDATE payment_tiers
SET
    features = '["Unlimited game imports", "Unlimited game analyses", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Personality insights", "Position exploration", "Tal inspired comments", "Playstyle analysis", "Learning suggestions"]'::jsonb,
    updated_at = NOW()
WHERE id = 'pro_monthly';

-- Update Pro Yearly with new features (remove Opponent preparation, add new features)
UPDATE payment_tiers
SET
    features = '["Unlimited game imports", "Unlimited game analyses", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Personality insights", "Position exploration", "Tal inspired comments", "Playstyle analysis", "Learning suggestions", "25% savings vs monthly"]'::jsonb,
    updated_at = NOW()
WHERE id = 'pro_yearly';

-- Verify the changes
SELECT
    id,
    name,
    features,
    updated_at
FROM payment_tiers
WHERE is_active = true
ORDER BY display_order;
