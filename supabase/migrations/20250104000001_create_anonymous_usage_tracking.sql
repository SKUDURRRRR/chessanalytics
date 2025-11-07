-- Migration: Create Anonymous Usage Tracking Table
-- Date: 2025-01-04
-- Description: Tracks anonymous user usage by IP address with 24-hour rolling window
-- Limits: See latest migration for current limits (initially 100/5, updated to 50/2)

-- ============================================================================
-- ANONYMOUS_USAGE_TRACKING TABLE
-- Tracks anonymous user usage by IP address (24-hour rolling window)
-- ============================================================================

CREATE TABLE IF NOT EXISTS anonymous_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    games_imported INTEGER DEFAULT 0,
    games_analyzed INTEGER DEFAULT 0,
    reset_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ip_address, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_ip_date ON anonymous_usage_tracking(ip_address, date DESC);
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_reset_at ON anonymous_usage_tracking(reset_at);
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_ip_reset ON anonymous_usage_tracking(ip_address, reset_at DESC);

-- Enable RLS
ALTER TABLE anonymous_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role full access on anonymous usage" ON anonymous_usage_tracking;

-- Service role has full access (for incrementing counters)
CREATE POLICY "Service role full access on anonymous usage" ON anonymous_usage_tracking
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions (no SELECT for anon/auth - service role only)
GRANT ALL ON anonymous_usage_tracking TO service_role;

COMMENT ON TABLE anonymous_usage_tracking IS 'Tracks anonymous user usage limits by IP address (24-hour rolling window)';

-- ============================================================================
-- FUNCTION: check_anonymous_usage_limits
-- Checks if anonymous user (by IP) can proceed with action
-- ============================================================================

CREATE OR REPLACE FUNCTION check_anonymous_usage_limits(
    p_ip_address TEXT,
    p_action_type TEXT
)
RETURNS JSON AS $$
DECLARE
    v_import_limit INTEGER := 100;
    v_analysis_limit INTEGER := 5;
    v_current_imports INTEGER := 0;
    v_current_analyses INTEGER := 0;
    v_reset_at TIMESTAMPTZ;
    v_can_proceed BOOLEAN := false;
    v_reason TEXT := NULL;
BEGIN
    -- Get current usage (within 24-hour window)
    -- Convert TEXT to INET for comparison
    SELECT
        COALESCE(games_imported, 0),
        COALESCE(games_analyzed, 0),
        reset_at
    INTO v_current_imports, v_current_analyses, v_reset_at
    FROM anonymous_usage_tracking
    WHERE ip_address::TEXT = p_ip_address
      AND reset_at > NOW() - INTERVAL '24 hours'
    ORDER BY reset_at DESC
    LIMIT 1;

    -- If no recent usage record, user can proceed
    IF NOT FOUND THEN
        v_can_proceed := true;
    ELSE
        -- Check limits
        IF p_action_type = 'import' THEN
            v_can_proceed := v_current_imports < v_import_limit;
            IF NOT v_can_proceed THEN
                v_reason := format('Import limit reached: %s/%s', v_current_imports, v_import_limit);
            END IF;
        ELSIF p_action_type = 'analyze' THEN
            v_can_proceed := v_current_analyses < v_analysis_limit;
            IF NOT v_can_proceed THEN
                v_reason := format('Analysis limit reached: %s/%s', v_current_analyses, v_analysis_limit);
            END IF;
        END IF;
    END IF;

    RETURN json_build_object(
        'can_proceed', v_can_proceed,
        'current_imports', v_current_imports,
        'current_analyses', v_current_analyses,
        'import_limit', v_import_limit,
        'analysis_limit', v_analysis_limit,
        'reset_at', v_reset_at,
        'reason', v_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_anonymous_usage_limits(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION check_anonymous_usage_limits IS 'Checks if anonymous user (by IP) has exceeded usage limits (24h rolling window)';

-- ============================================================================
-- FUNCTION: increment_anonymous_usage
-- Increments usage counter for anonymous user (by IP)
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_anonymous_usage(
    p_ip_address TEXT,
    p_action_type TEXT,
    p_count INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
    v_record_id UUID;
    v_current_value INTEGER;
    v_reset_at TIMESTAMPTZ;
    v_new_value INTEGER;
BEGIN
    -- Get or create usage record
    -- Convert TEXT to INET for comparison
    SELECT id,
           CASE WHEN p_action_type = 'import' THEN games_imported ELSE games_analyzed END,
           reset_at
    INTO v_record_id, v_current_value, v_reset_at
    FROM anonymous_usage_tracking
    WHERE ip_address::TEXT = p_ip_address
      AND date = CURRENT_DATE
    LIMIT 1;

    -- Check if we need to reset (24 hours passed)
    IF v_record_id IS NOT NULL AND v_reset_at IS NOT NULL THEN
        IF NOW() - v_reset_at > INTERVAL '24 hours' THEN
            -- Reset the counter
            v_new_value := p_count;
        ELSE
            -- Increment the counter
            v_new_value := COALESCE(v_current_value, 0) + p_count;
        END IF;
    ELSE
        -- New record
        v_new_value := p_count;
    END IF;

    -- Insert or update
    -- Convert TEXT to INET for storage
    INSERT INTO anonymous_usage_tracking (ip_address, date, games_imported, games_analyzed, reset_at)
    VALUES (
        p_ip_address::INET,
        CURRENT_DATE,
        CASE WHEN p_action_type = 'import' THEN v_new_value ELSE 0 END,
        CASE WHEN p_action_type = 'analyze' THEN v_new_value ELSE 0 END,
        NOW()
    )
    ON CONFLICT (ip_address, date) DO UPDATE SET
        games_imported = CASE
            WHEN p_action_type = 'import' THEN v_new_value
            ELSE anonymous_usage_tracking.games_imported
        END,
        games_analyzed = CASE
            WHEN p_action_type = 'analyze' THEN v_new_value
            ELSE anonymous_usage_tracking.games_analyzed
        END,
        reset_at = CASE
            WHEN NOW() - anonymous_usage_tracking.reset_at > INTERVAL '24 hours' THEN NOW()
            ELSE anonymous_usage_tracking.reset_at
        END,
        updated_at = NOW();

    RETURN json_build_object(
        'success', true,
        'new_value', v_new_value,
        'action_type', p_action_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_anonymous_usage(TEXT, TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION increment_anonymous_usage IS 'Increments usage counter for anonymous user (by IP) with 24-hour reset logic';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 1. Created anonymous_usage_tracking table to track usage by IP address
-- 2. Created check_anonymous_usage_limits() function to check limits
-- 3. Created increment_anonymous_usage() function to increment counters
-- 4. All functions use 24-hour rolling window
-- 5. Limits: See 20251107000001_update_anonymous_limits.sql for current limits
-- ============================================================================
