-- Migration: Seed Default Payment Tiers
-- Date: 2025-10-30
-- Description: Inserts default payment tiers (Free, Pro Monthly, Pro Yearly)

-- ============================================================================
-- INSERT DEFAULT PAYMENT TIERS
-- ============================================================================

-- Free Tier
INSERT INTO payment_tiers (
    id,
    name,
    description,
    price_monthly,
    price_yearly,
    import_limit,
    analysis_limit,
    features,
    display_order,
    is_active
) VALUES (
    'free',
    'Free',
    'Perfect for trying out chess analytics',
    0.00,
    0.00,
    100, -- 100 imports per 24 hours
    5,   -- 5 analyses per 24 hours
    '["100 game imports per day", "5 game analyses per day", "Basic chess analytics", "Opening analysis", "Personality scores", "Performance tracking"]'::jsonb,
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    import_limit = EXCLUDED.import_limit,
    analysis_limit = EXCLUDED.analysis_limit,
    features = EXCLUDED.features,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

-- Pro Monthly Tier
INSERT INTO payment_tiers (
    id,
    name,
    description,
    price_monthly,
    price_yearly,
    import_limit,
    analysis_limit,
    features,
    stripe_price_id_monthly,
    display_order,
    is_active
) VALUES (
    'pro_monthly',
    'Pro Monthly',
    'Unlimited access to all chess analytics features',
    5.45,
    NULL,
    NULL, -- Unlimited imports
    NULL, -- Unlimited analyses
    '["Unlimited game imports", "Unlimited game analyses", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Opponent preparation", "Personality insights"]'::jsonb,
    NULL, -- To be filled in after Stripe setup
    2,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    features = EXCLUDED.features,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

-- Pro Yearly Tier (with discount)
INSERT INTO payment_tiers (
    id,
    name,
    description,
    price_monthly,
    price_yearly,
    import_limit,
    analysis_limit,
    features,
    stripe_price_id_yearly,
    display_order,
    is_active
) VALUES (
    'pro_yearly',
    'Pro Yearly',
    'Save 25% with annual billing',
    NULL,
    49.05, -- ~$4.09/month (25% discount from $5.45)
    NULL, -- Unlimited imports
    NULL, -- Unlimited analyses
    '["Unlimited game imports", "Unlimited game analyses", "Advanced chess analytics", "Deep analysis with Stockfish", "Opening repertoire analysis", "Opponent preparation", "Personality insights", "25% savings vs monthly"]'::jsonb,
    NULL, -- To be filled in after Stripe setup
    3,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_yearly = EXCLUDED.price_yearly,
    features = EXCLUDED.features,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- DEACTIVATE ENTERPRISE TIER
-- ============================================================================

-- Deactivate the Enterprise tier since we're not offering it
UPDATE payment_tiers
SET is_active = false
WHERE id = 'enterprise';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show created tiers
DO $$
DECLARE
    tier_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tier_count FROM payment_tiers WHERE is_active = true;
    RAISE NOTICE 'Created/Updated % active payment tiers', tier_count;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created 3 payment tiers:
-- 1. Free: 100 imports/day, 5 analyses/day, $0
-- 2. Pro Monthly: Unlimited, $5.45/month
-- 3. Pro Yearly: Unlimited, $49.05/year (~$4.09/month, 25% savings)
--
-- Stripe price IDs need to be updated after creating products in Stripe Dashboard
-- Update with: UPDATE payment_tiers SET stripe_price_id_monthly = 'price_xxx' WHERE id = 'pro_monthly';
-- ============================================================================
