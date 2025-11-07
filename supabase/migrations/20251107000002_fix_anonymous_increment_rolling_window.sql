-- Migration: Fix Anonymous Usage Increment to Use Rolling Window
-- Date: 2025-11-07
-- Description: Fix increment_anonymous_usage to use rolling 24-hour window instead of date-based lookup
-- This ensures the limit is truly cumulative across all imports within 24 hours

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
    v_found_record BOOLEAN := false;
BEGIN
    -- Get the most recent usage record within the 24-hour rolling window
    -- This matches the logic in check_anonymous_usage_limits
    SELECT id,
           CASE WHEN p_action_type = 'import' THEN games_imported ELSE games_analyzed END,
           reset_at
    INTO v_record_id, v_current_value, v_reset_at
    FROM anonymous_usage_tracking
    WHERE ip_address::TEXT = p_ip_address
      AND reset_at > NOW() - INTERVAL '24 hours'
    ORDER BY reset_at DESC
    LIMIT 1;

    -- Check if we found a record within the rolling window
    IF v_record_id IS NOT NULL THEN
        v_found_record := true;
        -- Increment the counter (we're within the 24-hour window)
        v_new_value := COALESCE(v_current_value, 0) + p_count;
    ELSE
        -- No record found within 24 hours - check if there's an older record to reset
        SELECT id,
               CASE WHEN p_action_type = 'import' THEN games_imported ELSE games_analyzed END,
               reset_at
        INTO v_record_id, v_current_value, v_reset_at
        FROM anonymous_usage_tracking
        WHERE ip_address::TEXT = p_ip_address
        ORDER BY reset_at DESC
        LIMIT 1;

        IF v_record_id IS NOT NULL THEN
            -- Found an old record - check if it's been more than 24 hours
            IF v_reset_at IS NULL OR NOW() - v_reset_at > INTERVAL '24 hours' THEN
                -- Reset the counter (24 hours have passed)
                v_new_value := p_count;
            ELSE
                -- This shouldn't happen, but if it does, increment
                v_new_value := COALESCE(v_current_value, 0) + p_count;
            END IF;
        ELSE
            -- No record exists at all - start fresh
            v_new_value := p_count;
        END IF;
    END IF;

    -- Update or insert the record
    -- If we found a record within the rolling window, update it
    -- Otherwise, insert a new record for today
    IF v_found_record AND v_record_id IS NOT NULL THEN
        -- Update the existing record within the rolling window
        UPDATE anonymous_usage_tracking
        SET games_imported = CASE
                WHEN p_action_type = 'import' THEN v_new_value
                ELSE games_imported
            END,
            games_analyzed = CASE
                WHEN p_action_type = 'analyze' THEN v_new_value
                ELSE games_analyzed
            END,
            reset_at = NOW(),  -- Update reset_at to extend the rolling window
            updated_at = NOW()
        WHERE id = v_record_id;
    ELSE
        -- No record within rolling window - insert new record for today
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
            reset_at = NOW(),
            updated_at = NOW();
    END IF;

    RETURN json_build_object(
        'success', true,
        'new_value', v_new_value,
        'action_type', p_action_type,
        'found_existing', v_found_record
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_anonymous_usage(TEXT, TEXT, INTEGER) IS 'Increments usage counter for anonymous user (by IP) using rolling 24-hour window (matches check_anonymous_usage_limits logic)';
