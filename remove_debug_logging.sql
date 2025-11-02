-- Clean version: Remove debug logging from track_user_registration function
CREATE OR REPLACE FUNCTION public.track_user_registration()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
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
    EXCEPTION WHEN OTHERS THEN
        -- Silently fail - don't block user registration if analytics tracking fails
        NULL;
    END;

    RETURN NEW;
END;
$$;

SELECT 'Debug logging removed!' as status;
