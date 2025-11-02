-- Migration: Anonymous Usage Tracking
-- Date: 2025-11-02
-- Description: Creates table and functions to track anonymous user game analyses with IP-based rate limiting (3 per day)

-- ============================================================================
-- 1. ANONYMOUS_USAGE_TRACKING TABLE
-- Tracks game analysis usage for anonymous users by IP address
-- ============================================================================

CREATE TABLE IF NOT EXISTS anonymous_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    games_analyzed INTEGER DEFAULT 0,
    reset_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ip_address, date)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_ip_date ON anonymous_usage_tracking(ip_address, date DESC);
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_reset_at ON anonymous_usage_tracking(reset_at);

-- Enable RLS
ALTER TABLE anonymous_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for tracking counters)
CREATE POLICY "Service role full access on anonymous usage" ON anonymous_usage_tracking
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON anonymous_usage_tracking TO service_role;

COMMENT ON TABLE anonymous_usage_tracking IS 'Tracks daily game analysis usage for anonymous users (3 per day limit) using IP addresses';

-- ============================================================================
-- 2. CHECK_ANONYMOUS_ANALYSIS_LIMIT FUNCTION
-- Checks if anonymous user can analyze more games (3 per day limit)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_anonymous_analysis_limit(
    p_ip_address TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_analyses INTEGER := 0;
    v_reset_at TIMESTAMPTZ;
    v_limit INTEGER := 3;  -- Anonymous users can analyze 3 games per day
    v_can_proceed BOOLEAN := false;
BEGIN
    -- Validate IP address
    IF p_ip_address IS NULL OR p_ip_address = '' THEN
        RETURN json_build_object(
            'can_proceed', false,
            'reason', 'Invalid IP address',
            'current_usage', 0,
            'limit', v_limit,
            'reset_at', NULL
        );
    END IF;

    -- Get current usage (within 24-hour window)
    SELECT
        COALESCE(games_analyzed, 0),
        reset_at
    INTO v_current_analyses, v_reset_at
    FROM anonymous_usage_tracking
    WHERE ip_address = p_ip_address
      AND reset_at > NOW() - INTERVAL '24 hours'
    ORDER BY reset_at DESC
    LIMIT 1;

    -- If no recent usage record, user can proceed
    IF NOT FOUND THEN
        RETURN json_build_object(
            'can_proceed', true,
            'is_anonymous', true,
            'current_usage', 0,
            'limit', v_limit,
            'remaining', v_limit,
            'reset_at', NULL,
            'message', 'Anonymous users can analyze up to 3 games per day'
        );
    END IF;

    -- Check if 24 hours have passed (rolling window)
    IF v_reset_at IS NULL OR NOW() - v_reset_at > INTERVAL '24 hours' THEN
        -- Usage has reset
        RETURN json_build_object(
            'can_proceed', true,
            'is_anonymous', true,
            'current_usage', 0,
            'limit', v_limit,
            'remaining', v_limit,
            'reset_at', NULL,
            'message', 'Usage window has reset'
        );
    END IF;

    -- Check if user has reached limit
    v_can_proceed := v_current_analyses < v_limit;

    RETURN json_build_object(
        'can_proceed', v_can_proceed,
        'is_anonymous', true,
        'current_usage', v_current_analyses,
        'limit', v_limit,
        'remaining', GREATEST(0, v_limit - v_current_analyses),
        'reset_at', v_reset_at,
        'resets_in_hours', ROUND(EXTRACT(EPOCH FROM (v_reset_at + INTERVAL '24 hours' - NOW())) / 3600, 1),
        'message', CASE
            WHEN v_can_proceed THEN 'Anonymous users can analyze up to 3 games per day. Sign up for unlimited access!'
            ELSE 'Daily limit reached. Sign up for unlimited access or wait for reset.'
        END
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_anonymous_analysis_limit(TEXT) TO service_role;

COMMENT ON FUNCTION public.check_anonymous_analysis_limit IS 'Checks if anonymous user can analyze games (3 per day limit). Uses 24-hour rolling window.';

-- ============================================================================
-- 3. INCREMENT_ANONYMOUS_USAGE FUNCTION
-- Increments the analysis counter for anonymous users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_anonymous_usage(
    p_ip_address TEXT,
    p_count INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_analyses INTEGER := 0;
    v_reset_at TIMESTAMPTZ;
    v_record_id UUID;
BEGIN
    -- Validate inputs
    IF p_ip_address IS NULL OR p_ip_address = '' THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Invalid IP address'
        );
    END IF;

    IF p_count <= 0 OR p_count > 100 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Invalid count value'
        );
    END IF;

    -- Try to get existing record
    SELECT id, games_analyzed, reset_at
    INTO v_record_id, v_current_analyses, v_reset_at
    FROM anonymous_usage_tracking
    WHERE ip_address = p_ip_address
      AND date = CURRENT_DATE
    ORDER BY reset_at DESC
    LIMIT 1;

    IF FOUND THEN
        -- Check if 24 hours have passed (rolling window)
        IF v_reset_at IS NULL OR NOW() - v_reset_at > INTERVAL '24 hours' THEN
            -- Reset counter
            UPDATE anonymous_usage_tracking
            SET games_analyzed = p_count,
                reset_at = NOW(),
                updated_at = NOW()
            WHERE id = v_record_id;
        ELSE
            -- Increment counter
            UPDATE anonymous_usage_tracking
            SET games_analyzed = games_analyzed + p_count,
                updated_at = NOW()
            WHERE id = v_record_id;
        END IF;
    ELSE
        -- Create new record
        INSERT INTO anonymous_usage_tracking (
            ip_address,
            date,
            games_analyzed,
            reset_at
        ) VALUES (
            p_ip_address,
            CURRENT_DATE,
            p_count,
            NOW()
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Usage incremented successfully'
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.increment_anonymous_usage(TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.increment_anonymous_usage IS 'Increments the analysis counter for anonymous users. Uses 24-hour rolling window.';

-- ============================================================================
-- 4. CLEANUP OLD ANONYMOUS USAGE RECORDS (Optional)
-- Function to clean up old records (can be called by a cron job)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_anonymous_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete records older than 30 days
    DELETE FROM anonymous_usage_tracking
    WHERE date < CURRENT_DATE - INTERVAL '30 days';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.cleanup_old_anonymous_usage() TO service_role;

COMMENT ON FUNCTION public.cleanup_old_anonymous_usage IS 'Cleans up anonymous usage records older than 30 days. Can be called by a cron job.';

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

-- Created:
-- 1. anonymous_usage_tracking table with IP-based tracking
-- 2. check_anonymous_analysis_limit() function (3 per day limit)
-- 3. increment_anonymous_usage() function
-- 4. cleanup_old_anonymous_usage() function for maintenance

-- Anonymous users can now:
-- ✅ Analyze up to 3 games per day
-- ✅ Tracked by IP address with 24-hour rolling window
-- ✅ Clear messaging about limits and upgrade path
