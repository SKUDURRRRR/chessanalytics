drop policy "game_analyses_service_role_all" on "public"."game_analyses";

drop policy "game_features_service_role_all" on "public"."game_features";

drop policy "move_analyses_service_role_all" on "public"."move_analyses";

drop policy "game_analyses_select_own" on "public"."game_analyses";

drop policy "move_analyses_delete_own" on "public"."move_analyses";

drop policy "move_analyses_insert_own" on "public"."move_analyses";

drop policy "move_analyses_select_own" on "public"."move_analyses";

drop policy "move_analyses_update_own" on "public"."move_analyses";

revoke delete on table "public"."analysis_jobs" from "anon";

revoke insert on table "public"."analysis_jobs" from "anon";

revoke references on table "public"."analysis_jobs" from "anon";

revoke select on table "public"."analysis_jobs" from "anon";

revoke trigger on table "public"."analysis_jobs" from "anon";

revoke truncate on table "public"."analysis_jobs" from "anon";

revoke update on table "public"."analysis_jobs" from "anon";

revoke delete on table "public"."analysis_jobs" from "authenticated";

revoke insert on table "public"."analysis_jobs" from "authenticated";

revoke references on table "public"."analysis_jobs" from "authenticated";

revoke select on table "public"."analysis_jobs" from "authenticated";

revoke trigger on table "public"."analysis_jobs" from "authenticated";

revoke truncate on table "public"."analysis_jobs" from "authenticated";

revoke update on table "public"."analysis_jobs" from "authenticated";

revoke delete on table "public"."analysis_jobs" from "service_role";

revoke insert on table "public"."analysis_jobs" from "service_role";

revoke references on table "public"."analysis_jobs" from "service_role";

revoke select on table "public"."analysis_jobs" from "service_role";

revoke trigger on table "public"."analysis_jobs" from "service_role";

revoke truncate on table "public"."analysis_jobs" from "service_role";

revoke update on table "public"."analysis_jobs" from "service_role";

revoke delete on table "public"."app_admins" from "service_role";

revoke insert on table "public"."app_admins" from "service_role";

revoke references on table "public"."app_admins" from "service_role";

revoke select on table "public"."app_admins" from "service_role";

revoke trigger on table "public"."app_admins" from "service_role";

revoke truncate on table "public"."app_admins" from "service_role";

revoke update on table "public"."app_admins" from "service_role";

revoke delete on table "public"."game_analyses" from "anon";

revoke insert on table "public"."game_analyses" from "anon";

revoke references on table "public"."game_analyses" from "anon";

revoke select on table "public"."game_analyses" from "anon";

revoke trigger on table "public"."game_analyses" from "anon";

revoke truncate on table "public"."game_analyses" from "anon";

revoke update on table "public"."game_analyses" from "anon";

revoke delete on table "public"."game_analyses" from "authenticated";

revoke insert on table "public"."game_analyses" from "authenticated";

revoke references on table "public"."game_analyses" from "authenticated";

revoke select on table "public"."game_analyses" from "authenticated";

revoke trigger on table "public"."game_analyses" from "authenticated";

revoke truncate on table "public"."game_analyses" from "authenticated";

revoke update on table "public"."game_analyses" from "authenticated";

revoke delete on table "public"."game_analyses" from "service_role";

revoke insert on table "public"."game_analyses" from "service_role";

revoke references on table "public"."game_analyses" from "service_role";

revoke select on table "public"."game_analyses" from "service_role";

revoke trigger on table "public"."game_analyses" from "service_role";

revoke truncate on table "public"."game_analyses" from "service_role";

revoke update on table "public"."game_analyses" from "service_role";

revoke delete on table "public"."game_features" from "anon";

revoke insert on table "public"."game_features" from "anon";

revoke references on table "public"."game_features" from "anon";

revoke select on table "public"."game_features" from "anon";

revoke trigger on table "public"."game_features" from "anon";

revoke truncate on table "public"."game_features" from "anon";

revoke update on table "public"."game_features" from "anon";

revoke delete on table "public"."game_features" from "authenticated";

revoke insert on table "public"."game_features" from "authenticated";

revoke references on table "public"."game_features" from "authenticated";

revoke select on table "public"."game_features" from "authenticated";

revoke trigger on table "public"."game_features" from "authenticated";

revoke truncate on table "public"."game_features" from "authenticated";

revoke update on table "public"."game_features" from "authenticated";

revoke delete on table "public"."game_features" from "service_role";

revoke insert on table "public"."game_features" from "service_role";

revoke references on table "public"."game_features" from "service_role";

revoke select on table "public"."game_features" from "service_role";

revoke trigger on table "public"."game_features" from "service_role";

revoke truncate on table "public"."game_features" from "service_role";

revoke update on table "public"."game_features" from "service_role";

revoke delete on table "public"."games" from "authenticated";

revoke insert on table "public"."games" from "authenticated";

revoke references on table "public"."games" from "authenticated";

revoke select on table "public"."games" from "authenticated";

revoke trigger on table "public"."games" from "authenticated";

revoke truncate on table "public"."games" from "authenticated";

revoke update on table "public"."games" from "authenticated";

revoke delete on table "public"."games" from "service_role";

revoke insert on table "public"."games" from "service_role";

revoke references on table "public"."games" from "service_role";

revoke select on table "public"."games" from "service_role";

revoke trigger on table "public"."games" from "service_role";

revoke truncate on table "public"."games" from "service_role";

revoke update on table "public"."games" from "service_role";

revoke select on table "public"."games_pgn" from "anon";

revoke delete on table "public"."games_pgn" from "authenticated";

revoke insert on table "public"."games_pgn" from "authenticated";

revoke references on table "public"."games_pgn" from "authenticated";

revoke select on table "public"."games_pgn" from "authenticated";

revoke trigger on table "public"."games_pgn" from "authenticated";

revoke truncate on table "public"."games_pgn" from "authenticated";

revoke update on table "public"."games_pgn" from "authenticated";

revoke delete on table "public"."games_pgn" from "service_role";

revoke insert on table "public"."games_pgn" from "service_role";

revoke references on table "public"."games_pgn" from "service_role";

revoke select on table "public"."games_pgn" from "service_role";

revoke trigger on table "public"."games_pgn" from "service_role";

revoke truncate on table "public"."games_pgn" from "service_role";

revoke update on table "public"."games_pgn" from "service_role";

revoke delete on table "public"."import_sessions" from "anon";

revoke insert on table "public"."import_sessions" from "anon";

revoke references on table "public"."import_sessions" from "anon";

revoke select on table "public"."import_sessions" from "anon";

revoke trigger on table "public"."import_sessions" from "anon";

revoke truncate on table "public"."import_sessions" from "anon";

revoke update on table "public"."import_sessions" from "anon";

revoke delete on table "public"."import_sessions" from "authenticated";

revoke insert on table "public"."import_sessions" from "authenticated";

revoke references on table "public"."import_sessions" from "authenticated";

revoke select on table "public"."import_sessions" from "authenticated";

revoke trigger on table "public"."import_sessions" from "authenticated";

revoke truncate on table "public"."import_sessions" from "authenticated";

revoke update on table "public"."import_sessions" from "authenticated";

revoke delete on table "public"."import_sessions" from "service_role";

revoke insert on table "public"."import_sessions" from "service_role";

revoke references on table "public"."import_sessions" from "service_role";

revoke select on table "public"."import_sessions" from "service_role";

revoke trigger on table "public"."import_sessions" from "service_role";

revoke truncate on table "public"."import_sessions" from "service_role";

revoke update on table "public"."import_sessions" from "service_role";

revoke delete on table "public"."move_analyses" from "anon";

revoke insert on table "public"."move_analyses" from "anon";

revoke references on table "public"."move_analyses" from "anon";

revoke select on table "public"."move_analyses" from "anon";

revoke trigger on table "public"."move_analyses" from "anon";

revoke truncate on table "public"."move_analyses" from "anon";

revoke update on table "public"."move_analyses" from "anon";

revoke delete on table "public"."move_analyses" from "authenticated";

revoke insert on table "public"."move_analyses" from "authenticated";

revoke references on table "public"."move_analyses" from "authenticated";

revoke select on table "public"."move_analyses" from "authenticated";

revoke trigger on table "public"."move_analyses" from "authenticated";

revoke truncate on table "public"."move_analyses" from "authenticated";

revoke update on table "public"."move_analyses" from "authenticated";

revoke delete on table "public"."move_analyses" from "service_role";

revoke insert on table "public"."move_analyses" from "service_role";

revoke references on table "public"."move_analyses" from "service_role";

revoke select on table "public"."move_analyses" from "service_role";

revoke trigger on table "public"."move_analyses" from "service_role";

revoke truncate on table "public"."move_analyses" from "service_role";

revoke update on table "public"."move_analyses" from "service_role";

revoke delete on table "public"."parity_logs" from "anon";

revoke insert on table "public"."parity_logs" from "anon";

revoke references on table "public"."parity_logs" from "anon";

revoke select on table "public"."parity_logs" from "anon";

revoke trigger on table "public"."parity_logs" from "anon";

revoke truncate on table "public"."parity_logs" from "anon";

revoke update on table "public"."parity_logs" from "anon";

revoke delete on table "public"."parity_logs" from "authenticated";

revoke insert on table "public"."parity_logs" from "authenticated";

revoke references on table "public"."parity_logs" from "authenticated";

revoke select on table "public"."parity_logs" from "authenticated";

revoke trigger on table "public"."parity_logs" from "authenticated";

revoke truncate on table "public"."parity_logs" from "authenticated";

revoke update on table "public"."parity_logs" from "authenticated";

revoke delete on table "public"."parity_logs" from "service_role";

revoke insert on table "public"."parity_logs" from "service_role";

revoke references on table "public"."parity_logs" from "service_role";

revoke select on table "public"."parity_logs" from "service_role";

revoke trigger on table "public"."parity_logs" from "service_role";

revoke truncate on table "public"."parity_logs" from "service_role";

revoke update on table "public"."parity_logs" from "service_role";

revoke delete on table "public"."user_profiles" from "anon";

revoke insert on table "public"."user_profiles" from "anon";

revoke references on table "public"."user_profiles" from "anon";

revoke select on table "public"."user_profiles" from "anon";

revoke trigger on table "public"."user_profiles" from "anon";

revoke truncate on table "public"."user_profiles" from "anon";

revoke update on table "public"."user_profiles" from "anon";

revoke delete on table "public"."user_profiles" from "authenticated";

revoke insert on table "public"."user_profiles" from "authenticated";

revoke references on table "public"."user_profiles" from "authenticated";

revoke select on table "public"."user_profiles" from "authenticated";

revoke trigger on table "public"."user_profiles" from "authenticated";

revoke truncate on table "public"."user_profiles" from "authenticated";

revoke update on table "public"."user_profiles" from "authenticated";

revoke delete on table "public"."user_profiles" from "service_role";

revoke insert on table "public"."user_profiles" from "service_role";

revoke references on table "public"."user_profiles" from "service_role";

revoke select on table "public"."user_profiles" from "service_role";

revoke trigger on table "public"."user_profiles" from "service_role";

revoke truncate on table "public"."user_profiles" from "service_role";

revoke update on table "public"."user_profiles" from "service_role";

alter table "public"."move_analyses" drop constraint "fk_move_analyses_game_analysis";

alter table "public"."move_analyses" drop constraint "move_analyses_game_analysis_id_fkey";

drop view if exists "public"."game_features_modern";

drop index if exists "public"."idx_move_analyses_left_join";

drop index if exists "public"."idx_move_analyses_user_platform_game";

drop index if exists "public"."idx_unified_analyses_game_id";

drop index if exists "public"."idx_unified_analyses_user_platform";

drop index if exists "public"."idx_game_features_scores";

alter table "public"."game_features" add column "novelty_score" real default 50;

alter table "public"."game_features" add column "staleness_score" real default 50;

alter table "public"."games_pgn" add column "is_public" boolean default false;

alter table "public"."user_profiles" add column "current_rating" integer default 1200;

alter table "public"."user_profiles" add column "display_name" text;

alter table "public"."user_profiles" add column "last_accessed" timestamp with time zone default now();

alter table "public"."user_profiles" add column "most_played_opening" text;

alter table "public"."user_profiles" add column "most_played_time_control" text;

alter table "public"."user_profiles" add column "win_rate" double precision default 0.0;

CREATE UNIQUE INDEX games_pgn_user_platform_provider_unique ON public.games_pgn USING btree (user_id, platform, provider_game_id);

CREATE INDEX idx_games_pgn_is_public ON public.games_pgn USING btree (is_public) WHERE (is_public = true);

CREATE INDEX idx_user_profiles_last_accessed ON public.user_profiles USING btree (last_accessed DESC);

CREATE INDEX idx_game_features_scores ON public.game_features USING btree (tactical_score, positional_score, aggressive_score, patient_score, novelty_score, staleness_score, endgame_score, opening_score);

alter table "public"."game_features" add constraint "game_features_novelty_score_check" CHECK (((novelty_score >= (0)::double precision) AND (novelty_score <= (100)::double precision))) not valid;

alter table "public"."game_features" validate constraint "game_features_novelty_score_check";

alter table "public"."game_features" add constraint "game_features_staleness_score_check" CHECK (((staleness_score >= (0)::double precision) AND (staleness_score <= (100)::double precision))) not valid;

alter table "public"."game_features" validate constraint "game_features_staleness_score_check";

alter table "public"."games_pgn" add constraint "games_pgn_user_platform_provider_unique" UNIQUE using index "games_pgn_user_platform_provider_unique";

alter table "public"."user_profiles" add constraint "user_profiles_current_rating_check" CHECK (((current_rating > 0) AND (current_rating < 4000))) not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_current_rating_check";

alter table "public"."user_profiles" add constraint "user_profiles_win_rate_check" CHECK (((win_rate >= (0.0)::double precision) AND (win_rate <= (1.0)::double precision))) not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_win_rate_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cleanup_old_parity_logs()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM public.parity_logs
  WHERE checked_at < now() - interval '30 days';
$function$
;

CREATE OR REPLACE FUNCTION public.eco_to_opening_name(eco_code text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

create or replace view "public"."game_features_modern" as  SELECT id,
    user_id,
    platform,
    game_id,
    forcing_rate,
    quiet_rate,
    early_queen,
    castle_move,
    opposite_castle,
    long_game,
    piece_trades_early,
    sac_events,
    king_attack_moves,
    double_checks,
    first_to_give_check,
    non_pawn_developments,
    minor_developments,
    castled_by_move_10,
    opening_ply,
    total_moves,
    queenless,
    quiet_move_streaks,
    queenless_conv,
    rook_endgames,
    endgame_reach,
    tactical_score,
    positional_score,
    aggressive_score,
    patient_score,
    novelty_score,
    staleness_score,
    created_at,
    updated_at
   FROM game_features;


CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_game_analyses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_game_features_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_move_analyses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_games_batch(games_data jsonb[])
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.validate_data_consistency()
 RETURNS TABLE(table_name text, issue_type text, issue_description text, affected_rows bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.validate_rls_security()
 RETURNS TABLE(table_name text, policy_name text, policy_type text, is_secure boolean, issue_description text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

create policy "game_features_select_own"
on "public"."game_features"
as permissive
for select
to public
using ((((auth.uid())::text = user_id) OR (EXISTS ( SELECT 1
   FROM games
  WHERE ((games.provider_game_id = game_features.game_id) AND (games.is_public = true))))));


create policy "games_delete_service"
on "public"."games"
as permissive
for delete
to service_role
using (true);


create policy "games_insert_service"
on "public"."games"
as permissive
for insert
to service_role
with check (true);


create policy "games_select_public"
on "public"."games"
as permissive
for select
to public
using (true);


create policy "games_update_service"
on "public"."games"
as permissive
for update
to service_role
using (true)
with check (true);


create policy "games_pgn_delete_service"
on "public"."games_pgn"
as permissive
for delete
to service_role
using (true);


create policy "games_pgn_insert_service"
on "public"."games_pgn"
as permissive
for insert
to service_role
with check (true);


create policy "games_pgn_update_service"
on "public"."games_pgn"
as permissive
for update
to service_role
using (true)
with check (true);


create policy "move_analyses_select_all"
on "public"."move_analyses"
as permissive
for select
to public
using (true);


create policy "user_profiles_delete_service"
on "public"."user_profiles"
as permissive
for delete
to service_role
using (true);


create policy "user_profiles_insert_service"
on "public"."user_profiles"
as permissive
for insert
to service_role
with check (true);


create policy "user_profiles_select"
on "public"."user_profiles"
as permissive
for select
to public
using (true);


create policy "user_profiles_update_service"
on "public"."user_profiles"
as permissive
for update
to service_role
using (true)
with check (true);


create policy "game_analyses_select_own"
on "public"."game_analyses"
as permissive
for select
to public
using ((((auth.uid())::text = user_id) OR (EXISTS ( SELECT 1
   FROM games
  WHERE ((games.provider_game_id = game_analyses.game_id) AND (games.is_public = true))))));


create policy "move_analyses_delete_own"
on "public"."move_analyses"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM game_analyses
  WHERE ((game_analyses.id = move_analyses.game_analysis_id) AND (game_analyses.user_id = (( SELECT auth.uid() AS uid))::text)))));


create policy "move_analyses_insert_own"
on "public"."move_analyses"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM game_analyses
  WHERE ((game_analyses.id = move_analyses.game_analysis_id) AND (game_analyses.user_id = (( SELECT auth.uid() AS uid))::text)))));


create policy "move_analyses_select_own"
on "public"."move_analyses"
as permissive
for select
to public
using ((((auth.uid())::text = user_id) OR (EXISTS ( SELECT 1
   FROM games
  WHERE ((games.provider_game_id = move_analyses.game_id) AND (games.is_public = true))))));


create policy "move_analyses_update_own"
on "public"."move_analyses"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM game_analyses
  WHERE ((game_analyses.id = move_analyses.game_analysis_id) AND (game_analyses.user_id = (( SELECT auth.uid() AS uid))::text)))))
with check ((EXISTS ( SELECT 1
   FROM game_analyses
  WHERE ((game_analyses.id = move_analyses.game_analysis_id) AND (game_analyses.user_id = (( SELECT auth.uid() AS uid))::text)))));
