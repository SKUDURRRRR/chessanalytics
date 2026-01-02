-- ============================================================================
-- EMERGENCY SINGLE-COMMAND FIX FOR USER REGISTRATION
-- Run this ONE SQL command in Supabase SQL Editor to fix registration
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- That's it! Registration should work now.
-- Test by trying to sign up with a new email address.
