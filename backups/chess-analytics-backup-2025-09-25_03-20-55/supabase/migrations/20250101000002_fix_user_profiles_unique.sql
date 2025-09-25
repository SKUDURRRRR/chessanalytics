-- Restore composite uniqueness for user_profiles (user_id, platform)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_type = 'UNIQUE'
      AND table_schema = 'public'
      AND table_name = 'user_profiles'
      AND constraint_name = 'user_profiles_user_id_key'
  ) THEN
    ALTER TABLE public.user_profiles
      DROP CONSTRAINT user_profiles_user_id_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_type = 'UNIQUE'
      AND table_schema = 'public'
      AND table_name = 'user_profiles'
      AND constraint_name = 'user_profiles_user_platform_key'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_user_platform_key UNIQUE (user_id, platform);
  END IF;
END;
$$;
