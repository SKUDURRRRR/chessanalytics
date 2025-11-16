# Apply Anonymous User Limits Update

## URGENT: Run this SQL in Supabase SQL Editor

**Date**: 2025-11-07
**Purpose**: Update anonymous user limits from 100/5 to 50/2

## Instructions

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Paste the SQL below
6. Click **Run** (or press Ctrl+Enter)

## SQL to Execute

```sql
-- Migration: Update Anonymous User Limits
-- Date: 2025-11-07
-- Description: Update anonymous user limits to 50 imports per 24 hours and 2 analyses per 24 hours
-- Previous: 100 imports, 5 analyses
-- New: 50 imports, 2 analyses

-- ============================================================================
-- UPDATE: check_anonymous_usage_limits function with new limits
-- ============================================================================

CREATE OR REPLACE FUNCTION check_anonymous_usage_limits(
    p_ip_address TEXT,
    p_action_type TEXT
)
RETURNS JSON AS $$
DECLARE
    v_import_limit INTEGER := 50;  -- Changed from 100 to 50
    v_analysis_limit INTEGER := 2;  -- Changed from 5 to 2
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

COMMENT ON FUNCTION check_anonymous_usage_limits IS 'Checks if anonymous user (by IP) has exceeded usage limits (50 imports, 2 analyses per 24h)';
```

## Verification

After running the SQL, verify it worked by running this test query:

```sql
-- Test the function
SELECT check_anonymous_usage_limits('192.168.1.1', 'import');
SELECT check_anonymous_usage_limits('192.168.1.1', 'analyze');
```

Expected output should show:
- `import_limit`: 50
- `analysis_limit`: 2

## Summary of Changes

✅ **Anonymous User Limits Updated:**
- **Import limit**: 100 → **50** per 24 hours
- **Analysis limit**: 5 → **2** per 24 hours

✅ **Frontend already configured** with correct limits (50/2)
✅ **Backend tracking** uses database function (now updated)
✅ **IP-based enforcement** prevents bypass by clearing localStorage

## What This Affects

- Anonymous (not logged in) users will now be limited to:
  - 50 game imports per 24 hours (was 100)
  - 2 game analyses per 24 hours (was 5)
- Limits reset on a 24-hour rolling window
- When limits are reached, users see the "Limit Reached" modal encouraging signup

## Notes

- Free tier users (logged in): Still 100 imports / 5 analyses
- Pro tier users: Still unlimited
- This only affects anonymous users who haven't created an account
