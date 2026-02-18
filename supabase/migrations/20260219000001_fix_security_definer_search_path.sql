-- Fix SECURITY DEFINER function missing SET search_path
-- Without search_path, a malicious user could create objects in their
-- search_path to hijack elevated-privilege execution context.

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
