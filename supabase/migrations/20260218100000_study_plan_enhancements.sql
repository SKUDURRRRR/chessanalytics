-- Study Plan Enhancements
-- Adds weakness snapshot, weekly summary, days completed tracking,
-- and the missing increment_goal_progress RPC function.

-- New columns on study_plans
ALTER TABLE study_plans ADD COLUMN IF NOT EXISTS weakness_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE study_plans ADD COLUMN IF NOT EXISTS weekly_summary JSONB DEFAULT '{}'::jsonb;
ALTER TABLE study_plans ADD COLUMN IF NOT EXISTS days_completed INTEGER DEFAULT 0;

-- RPC function to atomically increment goal progress
CREATE OR REPLACE FUNCTION increment_goal_progress(
    p_user_id UUID,
    p_plan_id UUID,
    p_goal_type TEXT
)
RETURNS void AS $$
BEGIN
    UPDATE user_goals
    SET current_value = current_value + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND study_plan_id = p_plan_id
      AND goal_type = p_goal_type
      AND status = 'in_progress';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
