-- Atomic usage increment: check limit + increment in a single transaction
-- with row-level locking to prevent TOCTOU race conditions.

CREATE OR REPLACE FUNCTION increment_usage_atomic(
    p_user_id UUID,
    p_action_type TEXT,
    p_count INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_field TEXT;
    v_record RECORD;
    v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '24 hours';
    v_now TIMESTAMPTZ := NOW();
    v_today DATE := CURRENT_DATE;
    v_new_value INT;
BEGIN
    -- Validate inputs
    IF p_action_type NOT IN ('import', 'analyze') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action_type');
    END IF;
    IF p_count < 1 OR p_count > 1000 THEN
        RETURN jsonb_build_object('success', false, 'error', 'count must be 1-1000');
    END IF;

    v_field := CASE WHEN p_action_type = 'import' THEN 'games_imported' ELSE 'games_analyzed' END;

    -- Try to find and lock existing record within 24-hour window
    SELECT * INTO v_record
    FROM usage_tracking
    WHERE user_id = p_user_id
      AND reset_at > v_cutoff
    ORDER BY reset_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        -- Atomically increment the appropriate counter
        IF v_field = 'games_imported' THEN
            UPDATE usage_tracking
            SET games_imported = games_imported + p_count,
                date = v_today
            WHERE id = v_record.id
            RETURNING games_imported INTO v_new_value;
        ELSE
            UPDATE usage_tracking
            SET games_analyzed = games_analyzed + p_count,
                date = v_today
            WHERE id = v_record.id
            RETURNING games_analyzed INTO v_new_value;
        END IF;
    ELSE
        -- No valid record exists; insert a new one
        IF v_field = 'games_imported' THEN
            INSERT INTO usage_tracking (user_id, date, games_imported, games_analyzed, reset_at)
            VALUES (p_user_id, v_today, p_count, 0, v_now)
            RETURNING games_imported INTO v_new_value;
        ELSE
            INSERT INTO usage_tracking (user_id, date, games_imported, games_analyzed, reset_at)
            VALUES (p_user_id, v_today, 0, p_count, v_now)
            RETURNING games_analyzed INTO v_new_value;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_value', v_new_value,
        'action_type', p_action_type
    );
END;
$$;
