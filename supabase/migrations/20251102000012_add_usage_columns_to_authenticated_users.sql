-- Migration: Add Usage Tracking Columns to authenticated_users
-- Date: 2025-11-02
-- Description: Adds columns to track usage counts directly on authenticated_users table
--              This is required by the check_usage_limits function

-- ============================================================================
-- Add missing columns to authenticated_users table
-- ============================================================================

-- Add games_imported_count (tracks number of games imported in current period)
ALTER TABLE authenticated_users
ADD COLUMN IF NOT EXISTS games_imported_count INTEGER DEFAULT 0 NOT NULL;

-- Add games_analyzed_count (tracks number of games analyzed in current period)
ALTER TABLE authenticated_users
ADD COLUMN IF NOT EXISTS games_analyzed_count INTEGER DEFAULT 0 NOT NULL;

-- Add usage_reset_at (tracks when usage counters will reset)
-- Default to next month for new users
ALTER TABLE authenticated_users
ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', NOW()) + interval '1 month');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_authenticated_users_usage_reset ON authenticated_users(usage_reset_at);

-- Add comment
COMMENT ON COLUMN authenticated_users.games_imported_count IS 'Number of games imported in current usage period';
COMMENT ON COLUMN authenticated_users.games_analyzed_count IS 'Number of games analyzed in current usage period';
COMMENT ON COLUMN authenticated_users.usage_reset_at IS 'Timestamp when usage counters will reset (monthly)';

-- ============================================================================
-- Update function to increment usage (optional helper function)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_user_usage(
    p_user_id UUID,
    p_action_type TEXT, -- 'import' or 'analyze'
    p_count INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reset_at TIMESTAMPTZ;
    v_new_imports INTEGER;
    v_new_analyses INTEGER;
BEGIN
    -- Validate action type
    IF p_action_type NOT IN ('import', 'analyze') THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Invalid action type'
        );
    END IF;

    -- Validate count
    IF p_count <= 0 OR p_count > 1000 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Count must be between 1 and 1000'
        );
    END IF;

    -- Get current reset_at
    SELECT usage_reset_at INTO v_reset_at
    FROM authenticated_users
    WHERE id = p_user_id;

    -- Check if usage period has expired and needs reset
    IF v_reset_at IS NULL OR v_reset_at < NOW() THEN
        -- Reset counters
        IF p_action_type = 'import' THEN
            UPDATE authenticated_users
            SET
                games_imported_count = p_count,
                games_analyzed_count = 0,
                usage_reset_at = date_trunc('month', NOW()) + interval '1 month'
            WHERE id = p_user_id
            RETURNING games_imported_count, games_analyzed_count INTO v_new_imports, v_new_analyses;
        ELSE
            UPDATE authenticated_users
            SET
                games_imported_count = 0,
                games_analyzed_count = p_count,
                usage_reset_at = date_trunc('month', NOW()) + interval '1 month'
            WHERE id = p_user_id
            RETURNING games_imported_count, games_analyzed_count INTO v_new_imports, v_new_analyses;
        END IF;
    ELSE
        -- Increment counter
        IF p_action_type = 'import' THEN
            UPDATE authenticated_users
            SET games_imported_count = games_imported_count + p_count
            WHERE id = p_user_id
            RETURNING games_imported_count, games_analyzed_count INTO v_new_imports, v_new_analyses;
        ELSE
            UPDATE authenticated_users
            SET games_analyzed_count = games_analyzed_count + p_count
            WHERE id = p_user_id
            RETURNING games_imported_count, games_analyzed_count INTO v_new_imports, v_new_analyses;
        END IF;
    END IF;

    RETURN json_build_object(
        'success', true,
        'games_imported', v_new_imports,
        'games_analyzed', v_new_analyses
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.increment_user_usage(UUID, TEXT, INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.increment_user_usage IS 'Increments usage counters for authenticated users with automatic reset';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration:
-- 1. Adds games_imported_count column to authenticated_users
-- 2. Adds games_analyzed_count column to authenticated_users
-- 3. Adds usage_reset_at column to authenticated_users
-- 4. Creates performance index on usage_reset_at
-- 5. Creates increment_user_usage helper function for updating usage
--
-- This fixes the "column games_import_limit does not exist" error by ensuring
-- all required columns exist for the check_usage_limits function.
-- ============================================================================
