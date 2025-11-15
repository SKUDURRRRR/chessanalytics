-- Migration: Update Free Tier Limits (100 imports/day, 5 analyses/day)
-- Date: 2025-01-15
-- Description: Free tier uses daily limits (24-hour rolling window) for both imports and analyses

-- ============================================================================
-- UPDATE check_usage_limits FUNCTION
-- Free tier uses daily limits (24-hour rolling window) for both imports and analyses
-- ============================================================================

DROP FUNCTION IF EXISTS check_usage_limits(UUID, TEXT);

CREATE OR REPLACE FUNCTION check_usage_limits(
    p_user_id UUID,
    p_action_type TEXT -- 'import' or 'analyze'
)
RETURNS JSON AS $$
DECLARE
    v_account_tier TEXT;
    v_tier_import_limit INTEGER;
    v_tier_analysis_limit INTEGER;
    v_current_imports INTEGER := 0;
    v_current_analyses INTEGER := 0;
    v_total_games INTEGER := 0;
    v_reset_at TIMESTAMPTZ;
    v_can_proceed BOOLEAN := false;
    v_reason TEXT := NULL;
BEGIN
    -- Get user's account tier
    SELECT account_tier INTO v_account_tier
    FROM authenticated_users
    WHERE id = p_user_id;

    -- If user not found, they're anonymous (legacy behavior - no limits yet)
    IF NOT FOUND THEN
        RETURN json_build_object(
            'can_proceed', true,
            'is_anonymous', true,
            'reason', 'Anonymous users have temporary unlimited access'
        );
    END IF;

    -- Get tier limits from payment_tiers table
    SELECT import_limit, analysis_limit
    INTO v_tier_import_limit, v_tier_analysis_limit
    FROM payment_tiers
    WHERE id = v_account_tier;

    -- If tier not found, default to free tier limits
    IF NOT FOUND THEN
        SELECT import_limit, analysis_limit
        INTO v_tier_import_limit, v_tier_analysis_limit
        FROM payment_tiers
        WHERE id = 'free';
    END IF;

    -- NULL limit means unlimited
    IF (p_action_type = 'import' AND v_tier_import_limit IS NULL) OR
       (p_action_type = 'analyze' AND v_tier_analysis_limit IS NULL) THEN
        RETURN json_build_object(
            'can_proceed', true,
            'is_unlimited', true,
            'account_tier', v_account_tier
        );
    END IF;

    -- For all tiers (including free): use daily limits (24-hour rolling window) for both imports and analyses
    SELECT
        COALESCE(games_imported, 0),
        COALESCE(games_analyzed, 0),
        reset_at
    INTO v_current_imports, v_current_analyses, v_reset_at
    FROM usage_tracking
    WHERE user_id = p_user_id
      AND reset_at > NOW() - INTERVAL '24 hours'
    ORDER BY reset_at DESC
    LIMIT 1;

    -- If no recent usage record, user can proceed
    IF NOT FOUND THEN
        v_can_proceed := true;
    ELSE
        -- Check limits
        IF p_action_type = 'import' THEN
            -- Handle NULL limit (unlimited)
            IF v_tier_import_limit IS NULL THEN
                v_can_proceed := true;
            ELSE
                v_can_proceed := v_current_imports < v_tier_import_limit;
                IF NOT v_can_proceed THEN
                    v_reason := format('Import limit reached: %s/%s', v_current_imports, v_tier_import_limit);
                END IF;
            END IF;
        ELSIF p_action_type = 'analyze' THEN
            -- Handle NULL limit (unlimited)
            IF v_tier_analysis_limit IS NULL THEN
                v_can_proceed := true;
            ELSE
                v_can_proceed := v_current_analyses < v_tier_analysis_limit;
                IF NOT v_can_proceed THEN
                    v_reason := format('Analysis limit reached: %s/%s', v_current_analyses, v_tier_analysis_limit);
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN json_build_object(
        'can_proceed', v_can_proceed,
        'account_tier', v_account_tier,
        'current_imports', v_current_imports,
        'current_analyses', v_current_analyses,
        'import_limit', v_tier_import_limit,
        'analysis_limit', v_tier_analysis_limit,
        'reset_at', v_reset_at,
        'reason', v_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_usage_limits(UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION check_usage_limits IS 'Checks if user has exceeded their usage limits. For free tier: 100 imports/day, 5 analyses/day. For pro tier: unlimited.';
