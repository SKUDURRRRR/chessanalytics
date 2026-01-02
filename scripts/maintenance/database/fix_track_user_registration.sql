-- Fix the track_user_registration function with proper permissions and error handling
CREATE OR REPLACE FUNCTION public.track_user_registration()
RETURNS TRIGGER
SECURITY DEFINER  -- Critical: Run with elevated privileges
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Try to insert analytics event, but don't fail user registration if it fails
    BEGIN
        INSERT INTO public.analytics_events (
            event_type,
            user_id,
            is_anonymous,
            metadata
        ) VALUES (
            'user_registration',
            NEW.id,
            FALSE,
            jsonb_build_object('email', NEW.email)
        );
        RAISE LOG 'Analytics event tracked for user: %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the user registration
        RAISE LOG 'Failed to track analytics event: % %', SQLERRM, SQLSTATE;
    END;

    RETURN NEW;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.track_user_registration() TO service_role;

-- Verify it was updated
SELECT 'Function updated with proper permissions!' as status;
