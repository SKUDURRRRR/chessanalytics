-- Migration: Fix search_path security warnings
-- Date: 2025-11-02
-- Description: Adds SET search_path = public to functions missing it
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- Fix 1: update_updated_at_column
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = public  -- Added for security
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at_column() IS 'Auto-updates updated_at timestamp. Search path set to public for security.';

-- ============================================================================
-- Fix 2: validate_subscription_data
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_subscription_data()
RETURNS TRIGGER
SET search_path = public  -- Added for security
LANGUAGE plpgsql
AS $$
BEGIN
    -- If account_tier is paid but no stripe_customer_id, log warning
    IF NEW.account_tier IN ('pro_monthly', 'pro_yearly', 'pro', 'enterprise') THEN
        IF NEW.stripe_customer_id IS NULL THEN
            RAISE WARNING 'User % has paid tier % but no stripe_customer_id', NEW.id, NEW.account_tier;
        END IF;

        -- If subscription is active, should have subscription_id (unless enterprise custom)
        IF NEW.subscription_status = 'active' AND NEW.stripe_subscription_id IS NULL AND NEW.account_tier != 'enterprise' THEN
            RAISE WARNING 'User % has active subscription but no stripe_subscription_id', NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_subscription_data() IS 'Validates subscription data consistency. Search path set to public for security.';

-- ============================================================================
-- Note: The following functions appear in linter warnings but are not found
-- in the codebase. They may have been created directly in Supabase Dashboard.
-- If they exist, they should also be updated with SET search_path = public:
--
-- - track_player_search
-- - track_game_analysis
-- - track_pricing_page_view
-- - get_dashboard_metrics
-- - get_analyzed_players_stats
-- - get_registration_details
-- - get_user_analysis_stats
-- - refresh_analytics_views
-- - get_registration_stats
-- - get_player_search_stats
--
-- Run the diagnostic query in SUPABASE_SECURITY_AUDIT.md to check if these exist.
-- ============================================================================
