-- Fix function search paths for security
-- This addresses Supabase linter warnings about mutable search_path
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- 1. update_game_features_updated_at
CREATE OR REPLACE FUNCTION public.update_game_features_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. cleanup_old_parity_logs
CREATE OR REPLACE FUNCTION public.cleanup_old_parity_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.parity_logs
  WHERE checked_at < now() - interval '30 days';
$$;

-- 3. update_game_analyses_updated_at
CREATE OR REPLACE FUNCTION public.update_game_analyses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4. update_user_profile_updated_at
CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5. upsert_games_batch
CREATE OR REPLACE FUNCTION public.upsert_games_batch(games_data jsonb[])
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  game JSONB;
  inserted_count INTEGER := 0;
BEGIN
  -- Process each game in the batch
  FOREACH game IN ARRAY games_data
  LOOP
    INSERT INTO public.games (
      user_id,
      platform,
      provider_game_id,
      played_at,
      result,
      color,
      time_control,
      opening_family,
      opponent_rating
    ) VALUES (
      (game->>'user_id')::TEXT,
      (game->>'platform')::TEXT,
      (game->>'provider_game_id')::TEXT,
      (game->>'played_at')::TIMESTAMP WITH TIME ZONE,
      (game->>'result')::TEXT,
      (game->>'color')::TEXT,
      (game->>'time_control')::TEXT,
      (game->>'opening_family')::TEXT,
      (game->>'opponent_rating')::INTEGER
    )
    ON CONFLICT (user_id, platform, provider_game_id)
    DO UPDATE SET
      played_at = EXCLUDED.played_at,
      result = EXCLUDED.result,
      color = EXCLUDED.color,
      time_control = EXCLUDED.time_control,
      opening_family = EXCLUDED.opening_family,
      opponent_rating = EXCLUDED.opponent_rating;

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END;
$$;

-- 6. update_move_analyses_updated_at
CREATE OR REPLACE FUNCTION public.update_move_analyses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 7. set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 8. validate_data_consistency
CREATE OR REPLACE FUNCTION public.validate_data_consistency()
RETURNS TABLE (
    table_name TEXT,
    issue_type TEXT,
    issue_description TEXT,
    affected_rows BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 'game_analyses'::TEXT, 'accuracy_range'::TEXT, 'Game accuracy outside 0-100'::TEXT, COUNT(*)
    FROM public.game_analyses
    WHERE accuracy < 0 OR accuracy > 100;

    RETURN QUERY
    SELECT 'game_analyses'::TEXT, 'phase_accuracy_range'::TEXT, 'Phase accuracy outside 0-100'::TEXT, COUNT(*)
    FROM public.game_analyses
    WHERE opening_accuracy NOT BETWEEN 0 AND 100
       OR middle_game_accuracy NOT BETWEEN 0 AND 100
       OR endgame_accuracy NOT BETWEEN 0 AND 100;

    RETURN QUERY
    SELECT 'move_analyses'::TEXT, 'accuracy_range'::TEXT, 'Move accuracy outside 0-100'::TEXT, COUNT(*)
    FROM public.move_analyses
    WHERE accuracy < 0 OR accuracy > 100;

    RETURN QUERY
    SELECT 'move_analyses'::TEXT, 'phase_accuracy_range'::TEXT, 'Move phase accuracy outside 0-100'::TEXT, COUNT(*)
    FROM public.move_analyses
    WHERE middle_game_accuracy NOT BETWEEN 0 AND 100
       OR endgame_accuracy NOT BETWEEN 0 AND 100;

    RETURN QUERY
    SELECT 'game_analyses'::TEXT, 'missing_required'::TEXT, 'Game analyses missing critical metrics'::TEXT, COUNT(*)
    FROM public.game_analyses
    WHERE moves_analysis IS NULL
       OR analysis_type IS NULL;

    RETURN QUERY
    SELECT 'move_analyses'::TEXT, 'missing_required'::TEXT, 'Move analyses missing critical metrics'::TEXT, COUNT(*)
    FROM public.move_analyses
    WHERE analysis_method IS NULL;
END;
$$;

-- 9. validate_rls_security
CREATE OR REPLACE FUNCTION public.validate_rls_security()
RETURNS TABLE (
    table_name TEXT,
    policy_name TEXT,
    policy_type TEXT,
    is_secure BOOLEAN,
    issue_description TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Ensure anon cannot write critical tables
    RETURN QUERY
    SELECT 'games'::TEXT, 'anon_write'::TEXT, 'privilege'::TEXT, NOT EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE grantee = 'anon'
          AND table_schema = 'public'
          AND role_table_grants.table_name = 'games'
          AND privilege_type IN ('INSERT','UPDATE','DELETE')
    ), 'anon should not have write access to games'::TEXT;

    RETURN QUERY
    SELECT 'games_pgn'::TEXT, 'anon_write'::TEXT, 'privilege'::TEXT, NOT EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE grantee = 'anon'
          AND table_schema = 'public'
          AND role_table_grants.table_name = 'games_pgn'
          AND privilege_type IN ('INSERT','UPDATE','DELETE')
    ), 'anon should not have write access to games_pgn'::TEXT;

    -- Service role should have ALL privileges
    RETURN QUERY
    SELECT t.table_name,
           'service_role_all'::TEXT,
           'privilege'::TEXT,
           EXISTS (
               SELECT 1
               FROM information_schema.role_table_grants
               WHERE grantee = 'service_role'
                 AND table_schema = 'public'
                 AND role_table_grants.table_name = t.table_name
                 AND privilege_type = 'ALL'
           ),
           'service_role requires full access'::TEXT
    FROM (VALUES ('games'),('game_analyses'),('move_analyses'),('game_features'),('games_pgn'),('analysis_jobs')) AS t(table_name);

    -- Row Level Security enabled
    RETURN QUERY
    SELECT c.relname::text,
           'rls_enabled'::TEXT,
           'security'::TEXT,
           c.relrowsecurity,
           CASE WHEN c.relrowsecurity THEN 'RLS enabled'::TEXT ELSE 'RLS disabled'::TEXT END
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN ('games','game_analyses','move_analyses','game_features','games_pgn','analysis_jobs');
END;
$$;

-- 10. eco_to_opening_name (if it exists in the database)
-- Note: This function might not exist in the database yet, as it was in a standalone SQL file
-- We'll create it with proper search_path if it doesn't exist
CREATE OR REPLACE FUNCTION public.eco_to_opening_name(eco_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN CASE
        -- Scandinavian Defense
        WHEN eco_code = 'B01' THEN 'Scandinavian Defense'
        -- Caro-Kann Defense
        WHEN eco_code IN ('B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19') THEN 'Caro-Kann Defense'
        -- Sicilian Defense
        WHEN eco_code ~ '^B[2-9][0-9]$' THEN 'Sicilian Defense'
        -- French Defense
        WHEN eco_code ~ '^(C0[0-9]|C1[0-9])' THEN 'French Defense'
        -- King's Indian Defense
        WHEN eco_code ~ '^E[6-9][0-9]$' THEN 'King''s Indian Defense'
        -- Queen's Gambit
        WHEN eco_code ~ '^D[3-6][0-9]$' THEN 'Queen''s Gambit'
        -- Italian Game
        WHEN eco_code IN ('C50', 'C51', 'C52', 'C53', 'C54', 'C55') THEN 'Italian Game'
        -- Ruy Lopez
        WHEN eco_code ~ '^C[6-9][0-9]$' THEN 'Ruy Lopez'
        -- English Opening
        WHEN eco_code ~ '^A[1-3][0-9]$' THEN 'English Opening'
        -- King's Gambit
        WHEN eco_code ~ '^C3[0-9]$' THEN 'King''s Gambit'
        -- Petrov Defense
        WHEN eco_code IN ('C42', 'C43') THEN 'Petrov Defense'
        -- Two Knights Defense
        WHEN eco_code IN ('C56', 'C57', 'C58', 'C59') THEN 'Two Knights Defense'
        -- Scotch Game
        WHEN eco_code IN ('C44', 'C45') THEN 'Scotch Game'
        -- King's Pawn Game
        WHEN eco_code IN ('C40', 'C41', 'C46', 'B00') THEN 'King''s Pawn Game'
        -- Vienna Game
        WHEN eco_code IN ('C23', 'C24', 'C25', 'C26', 'C27', 'C28', 'C29') THEN 'Vienna Game'
        -- Default: return the ECO code itself
        ELSE eco_code
    END;
END;
$$;

COMMENT ON FUNCTION public.eco_to_opening_name(TEXT) IS 'Converts ECO codes to opening names. Search path set to public for security.';

-- Ensure permissions are maintained
GRANT EXECUTE ON FUNCTION public.update_game_features_updated_at() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_parity_logs() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.update_game_analyses_updated_at() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.update_user_profile_updated_at() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.upsert_games_batch(jsonb[]) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.update_move_analyses_updated_at() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.validate_data_consistency() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_rls_security() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.eco_to_opening_name(TEXT) TO authenticated, service_role, anon;
