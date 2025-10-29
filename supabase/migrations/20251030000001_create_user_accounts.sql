-- Migration: Create User Accounts and Payment System Tables
-- Date: 2025-10-30
-- Description: Creates tables for authenticated users, usage tracking, payment tiers, and transactions

-- ============================================================================
-- 1. AUTHENTICATED_USERS TABLE
-- Links Supabase auth.users to our application system
-- ============================================================================

CREATE TABLE IF NOT EXISTS authenticated_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    account_tier TEXT NOT NULL DEFAULT 'free' CHECK (account_tier IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'trialing')),
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    subscription_end_date TIMESTAMPTZ,
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_authenticated_users_username ON authenticated_users(username);
CREATE INDEX IF NOT EXISTS idx_authenticated_users_stripe_customer ON authenticated_users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_authenticated_users_account_tier ON authenticated_users(account_tier);

-- Enable RLS
ALTER TABLE authenticated_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON authenticated_users
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON authenticated_users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile on signup" ON authenticated_users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Service role has full access
CREATE POLICY "Service role full access" ON authenticated_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON authenticated_users TO authenticated;
GRANT ALL ON authenticated_users TO service_role;

COMMENT ON TABLE authenticated_users IS 'Links Supabase auth users to application user profiles with subscription info';

-- ============================================================================
-- 2. PAYMENT_TIERS TABLE
-- Defines available subscription tiers and their limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_tiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10, 2),
    price_yearly DECIMAL(10, 2),
    import_limit INTEGER, -- NULL means unlimited
    analysis_limit INTEGER, -- NULL means unlimited
    features JSONB DEFAULT '[]'::jsonb,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_payment_tiers_active ON payment_tiers(is_active, display_order);

-- Enable RLS
ALTER TABLE payment_tiers ENABLE ROW LEVEL SECURITY;

-- Everyone can view active tiers
CREATE POLICY "Anyone can view active tiers" ON payment_tiers
    FOR SELECT
    USING (is_active = true);

-- Only service role can modify
CREATE POLICY "Service role can manage tiers" ON payment_tiers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON payment_tiers TO anon, authenticated;
GRANT ALL ON payment_tiers TO service_role;

COMMENT ON TABLE payment_tiers IS 'Defines subscription tiers with pricing and feature limits';

-- ============================================================================
-- 3. USAGE_TRACKING TABLE
-- Tracks user usage for rate limiting (24-hour rolling window)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES authenticated_users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    games_imported INTEGER DEFAULT 0,
    games_analyzed INTEGER DEFAULT 0,
    reset_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON usage_tracking(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_reset_at ON usage_tracking(reset_at);

-- Enable RLS
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view own usage
CREATE POLICY "Users can view own usage" ON usage_tracking
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access (for incrementing counters)
CREATE POLICY "Service role full access on usage" ON usage_tracking
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON usage_tracking TO authenticated;
GRANT ALL ON usage_tracking TO service_role;

COMMENT ON TABLE usage_tracking IS 'Tracks daily usage limits with 24-hour rolling window';

-- ============================================================================
-- 4. USER_CREDITS TABLE
-- Tracks one-time credit purchases
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES authenticated_users(id) ON DELETE CASCADE,
    credits_remaining INTEGER DEFAULT 0,
    credits_total INTEGER DEFAULT 0,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT credits_positive CHECK (credits_remaining >= 0 AND credits_total >= 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_expires_at ON user_credits(expires_at);

-- Enable RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Users can view own credits
CREATE POLICY "Users can view own credits" ON user_credits
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access on credits" ON user_credits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON user_credits TO authenticated;
GRANT ALL ON user_credits TO service_role;

COMMENT ON TABLE user_credits IS 'Tracks one-time credit purchases for users';

-- ============================================================================
-- 5. PAYMENT_TRANSACTIONS TABLE
-- Audit log for all payment transactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES authenticated_users(id) ON DELETE SET NULL,
    stripe_payment_id TEXT UNIQUE NOT NULL,
    stripe_invoice_id TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('subscription', 'credits', 'one_time')),
    tier_id TEXT REFERENCES payment_tiers(id),
    credits_purchased INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_payment ON payment_transactions(stripe_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view own transactions
CREATE POLICY "Users can view own transactions" ON payment_transactions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access on transactions" ON payment_transactions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON payment_transactions TO authenticated;
GRANT ALL ON payment_transactions TO service_role;

COMMENT ON TABLE payment_transactions IS 'Audit log for all payment transactions via Stripe';

-- ============================================================================
-- 6. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_authenticated_users_updated_at
    BEFORE UPDATE ON authenticated_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_tiers_updated_at
    BEFORE UPDATE ON payment_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at
    BEFORE UPDATE ON usage_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at
    BEFORE UPDATE ON user_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created tables:
-- 1. authenticated_users - User account info with subscription status
-- 2. payment_tiers - Available subscription plans
-- 3. usage_tracking - Daily usage limits (24h rolling window)
-- 4. user_credits - One-time credit purchases
-- 5. payment_transactions - Payment audit log
--
-- All tables have:
-- - RLS enabled
-- - Proper indexes for performance
-- - User policies (view own data)
-- - Service role policies (full access)
-- - Auto-updating updated_at timestamps
-- ============================================================================
