-- Align local database with remote database structure
-- This migration adds all missing tables, functions, and features from the remote database

-- Create game_analyses table
CREATE TABLE IF NOT EXISTS "public"."game_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "total_moves" integer NOT NULL,
    "accuracy" double precision NOT NULL,
    "opponent_accuracy" double precision DEFAULT 0,
    "blunders" integer DEFAULT 0 NOT NULL,
    "mistakes" integer DEFAULT 0 NOT NULL,
    "inaccuracies" integer DEFAULT 0 NOT NULL,
    "brilliant_moves" integer DEFAULT 0 NOT NULL,
    "best_moves" integer DEFAULT 0,
    "good_moves" integer DEFAULT 0,
    "acceptable_moves" integer DEFAULT 0,
    "opening_accuracy" double precision NOT NULL,
    "middle_game_accuracy" double precision NOT NULL,
    "endgame_accuracy" double precision NOT NULL,
    "average_evaluation" double precision NOT NULL,
    "opponent_average_centipawn_loss" double precision DEFAULT 0,
    "time_management_score" double precision NOT NULL,
    "opponent_time_management_score" double precision DEFAULT 0,
    "tactical_patterns" "jsonb" DEFAULT '[]'::"jsonb",
    "positional_patterns" "jsonb" DEFAULT '[]'::"jsonb",
    "analysis_date" timestamp with time zone NOT NULL,
    "moves_analysis" "jsonb" DEFAULT '[]'::"jsonb",
    "analysis_type" text DEFAULT 'basic'::text NOT NULL,
    "processing_time_ms" integer,
    "stockfish_depth" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tactical_score" real DEFAULT 50,
    "positional_score" real DEFAULT 50,
    "aggressive_score" real DEFAULT 50,
    "patient_score" real DEFAULT 50,
    "endgame_score" real DEFAULT 50,
    "opening_score" real DEFAULT 50,
    CONSTRAINT "game_analyses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_aggressive_score" CHECK ((("aggressive_score" >= (0)::double precision) AND ("aggressive_score" <= (100)::double precision))),
    CONSTRAINT "check_endgame_score" CHECK ((("endgame_score" >= (0)::double precision) AND ("endgame_score" <= (100)::double precision))),
    CONSTRAINT "check_opening_score" CHECK ((("opening_score" >= (0)::double precision) AND ("opening_score" <= (100)::double precision))),
    CONSTRAINT "check_patient_score" CHECK ((("patient_score" >= (0)::double precision) AND ("patient_score" <= (100)::double precision))),
    CONSTRAINT "check_positional_score" CHECK ((("positional_score" >= (0)::double precision) AND ("positional_score" <= (100)::double precision))),
    CONSTRAINT "check_tactical_score" CHECK ((("tactical_score" >= (0)::double precision) AND ("tactical_score" <= (100)::double precision))),
    CONSTRAINT "game_analyses_accuracy_check" CHECK ((("accuracy" >= (0)::double precision) AND ("accuracy" <= (100)::double precision))),
    CONSTRAINT "game_analyses_endgame_accuracy_check" CHECK ((("endgame_accuracy" >= (0)::double precision) AND ("endgame_accuracy" <= (100)::double precision))),
    CONSTRAINT "game_analyses_middle_game_accuracy_check" CHECK ((("middle_game_accuracy" >= (0)::double precision) AND ("middle_game_accuracy" <= (100)::double precision))),
    CONSTRAINT "game_analyses_opening_accuracy_check" CHECK ((("opening_accuracy" >= (0)::double precision) AND ("opening_accuracy" <= (100)::double precision))),
    CONSTRAINT "game_analyses_platform_check" CHECK (("platform" = ANY (ARRAY['lichess'::"text", 'chess.com'::"text"]))),
    CONSTRAINT "game_analyses_time_management_score_check" CHECK ((("time_management_score" >= (0)::double precision) AND ("time_management_score" <= (100)::double precision)))
);
-- Create games_pgn table
CREATE TABLE IF NOT EXISTS "public"."games_pgn" (
    "user_id" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "provider_game_id" "text" NOT NULL,
    "pgn" "text",
    "moves" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
-- Create import_sessions table
CREATE TABLE IF NOT EXISTS "public"."import_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying(100) NOT NULL,
    "platform" character varying(50) NOT NULL,
    "import_type" character varying(50) NOT NULL,
    "total_games" integer,
    "imported_games" integer DEFAULT 0,
    "status" character varying(20) DEFAULT 'in_progress'::character varying,
    "error_message" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "completed_at" timestamp without time zone
);
-- Create parity_logs table
CREATE TABLE IF NOT EXISTS "public"."parity_logs" (
    "id" bigint NOT NULL,
    "user_id" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "provider_total" integer NOT NULL,
    "db_total" integer NOT NULL,
    "delta" integer NOT NULL,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
-- Create parity_logs sequence
CREATE SEQUENCE IF NOT EXISTS "public"."parity_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
-- Create app_admins table
CREATE TABLE IF NOT EXISTS "public"."app_admins" (
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);
-- Set sequence ownership
ALTER SEQUENCE "public"."parity_logs_id_seq" OWNED BY "public"."parity_logs"."id";
ALTER TABLE ONLY "public"."parity_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."parity_logs_id_seq"'::"regclass");
-- Add primary keys (only if they don't exist)
DO $$
BEGIN
    -- Add import_sessions primary key if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_sessions_pkey') THEN
        ALTER TABLE ONLY "public"."import_sessions" ADD CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id");
    END IF;
    
    -- Add parity_logs primary key if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parity_logs_pkey') THEN
        ALTER TABLE ONLY "public"."parity_logs" ADD CONSTRAINT "parity_logs_pkey" PRIMARY KEY ("id");
    END IF;
    
    -- Add app_admins primary key if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_admins_pkey') THEN
        ALTER TABLE ONLY "public"."app_admins" ADD CONSTRAINT "app_admins_pkey" PRIMARY KEY ("email");
    END IF;
END $$;
-- Create analysis_summary view
CREATE OR REPLACE VIEW "public"."analysis_summary" AS
 SELECT "user_id",
    "platform",
    "count"(*) AS "total_games_analyzed",
    "avg"("accuracy") AS "average_accuracy",
    "sum"("blunders") AS "total_blunders",
    "sum"("mistakes") AS "total_mistakes",
    "sum"("inaccuracies") AS "total_inaccuracies",
    "sum"("brilliant_moves") AS "total_brilliant_moves",
    "avg"("opening_accuracy") AS "average_opening_accuracy",
    "avg"("middle_game_accuracy") AS "average_middle_game_accuracy",
    "avg"("endgame_accuracy") AS "average_endgame_accuracy",
    "avg"("time_management_score") AS "average_time_management_score",
    "max"("analysis_date") AS "last_analysis_date"
   FROM "public"."game_analyses"
  GROUP BY "user_id", "platform";
-- Create functions
CREATE OR REPLACE FUNCTION "public"."cleanup_old_parity_logs"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  DELETE FROM public.parity_logs
  WHERE checked_at < now() - interval '30 days';
$$;
CREATE OR REPLACE FUNCTION "public"."update_game_analyses_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."update_user_profile_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."upsert_games_batch"("games_data" "jsonb"[]) RETURNS integer
    LANGUAGE "plpgsql"
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
-- Create indexes for game_analyses
CREATE INDEX IF NOT EXISTS "idx_game_analyses_accuracy" ON "public"."game_analyses" USING "btree" ("accuracy");
CREATE INDEX IF NOT EXISTS "idx_game_analyses_analysis_date" ON "public"."game_analyses" USING "btree" ("analysis_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_game_analyses_game_id" ON "public"."game_analyses" USING "btree" ("game_id");
CREATE INDEX IF NOT EXISTS "idx_game_analyses_personality_scores" ON "public"."game_analyses" USING "btree" ("tactical_score", "positional_score", "aggressive_score", "patient_score", "endgame_score", "opening_score");
CREATE INDEX IF NOT EXISTS "idx_game_analyses_platform" ON "public"."game_analyses" USING "btree" ("platform");
CREATE INDEX IF NOT EXISTS "idx_game_analyses_user_id" ON "public"."game_analyses" USING "btree" ("user_id");
-- Create indexes for games_pgn
CREATE INDEX IF NOT EXISTS "idx_games_pgn_created" ON "public"."games_pgn" USING "btree" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_games_pgn_platform" ON "public"."games_pgn" USING "btree" ("platform");
CREATE INDEX IF NOT EXISTS "idx_games_pgn_user" ON "public"."games_pgn" USING "btree" ("user_id");
-- Create indexes for parity_logs
CREATE INDEX IF NOT EXISTS "idx_parity_logs_checked_at" ON "public"."parity_logs" USING "btree" ("checked_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_parity_logs_delta" ON "public"."parity_logs" USING "btree" ("delta");
CREATE INDEX IF NOT EXISTS "idx_parity_logs_user_platform" ON "public"."parity_logs" USING "btree" ("user_id", "platform");
-- Create indexes for app_admins
CREATE INDEX IF NOT EXISTS "idx_app_admins_email" ON "public"."app_admins" USING "btree" ("email");
-- Create additional indexes for games table
CREATE INDEX IF NOT EXISTS "idx_games_analytics_composite" ON "public"."games" USING "btree" ("user_id", "platform", "result", "played_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_games_color" ON "public"."games" USING "btree" ("color");
CREATE INDEX IF NOT EXISTS "idx_games_duplicate_check" ON "public"."games" USING "btree" ("user_id", "platform", "provider_game_id");
CREATE INDEX IF NOT EXISTS "idx_games_my_rating" ON "public"."games" USING "btree" ("my_rating");
CREATE INDEX IF NOT EXISTS "idx_games_opening_family" ON "public"."games" USING "btree" ("opening_family");
CREATE INDEX IF NOT EXISTS "idx_games_opponent_rating" ON "public"."games" USING "btree" ("opponent_rating") WHERE ("opponent_rating" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_games_played_at_health" ON "public"."games" USING "btree" ("played_at");
CREATE INDEX IF NOT EXISTS "idx_games_user_color" ON "public"."games" USING "btree" ("user_id", "color");
CREATE INDEX IF NOT EXISTS "idx_games_user_opening" ON "public"."games" USING "btree" ("user_id", "opening_family");
CREATE INDEX IF NOT EXISTS "idx_games_user_played_at" ON "public"."games" USING "btree" ("user_id", "played_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_games_user_result" ON "public"."games" USING "btree" ("user_id", "result");
-- Create triggers
CREATE OR REPLACE TRIGGER "trigger_update_game_analyses_updated_at" BEFORE UPDATE ON "public"."game_analyses" FOR EACH ROW EXECUTE FUNCTION "public"."update_game_analyses_updated_at"();
CREATE OR REPLACE TRIGGER "trigger_update_user_profile_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_profile_updated_at"();
-- Add foreign key constraints (only if they don't exist)
DO $$
BEGIN
    -- Add games_pgn foreign key if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_games_pgn_games') THEN
        ALTER TABLE ONLY "public"."games_pgn"
            ADD CONSTRAINT "fk_games_pgn_games" FOREIGN KEY ("user_id", "platform", "provider_game_id") REFERENCES "public"."games"("user_id", "platform", "provider_game_id") ON DELETE CASCADE;
    END IF;
END $$;
-- Enable RLS
ALTER TABLE "public"."game_analyses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."games_pgn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."import_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."parity_logs" ENABLE ROW LEVEL SECURITY;
-- Create RLS policies (only if they don't exist)
DO $$
BEGIN
    -- Create game_analyses policies if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for anon and service_role on game_analyses' AND tablename = 'game_analyses') THEN
        CREATE POLICY "Allow all for anon and service_role on game_analyses" ON "public"."game_analyses" TO "anon", "service_role" USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own game analyses' AND tablename = 'game_analyses') THEN
        CREATE POLICY "Users can insert own game analyses" ON "public"."game_analyses" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = "user_id"));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own game analyses' AND tablename = 'game_analyses') THEN
        CREATE POLICY "Users can update own game analyses" ON "public"."game_analyses" FOR UPDATE USING ((("auth"."uid"())::"text" = "user_id"));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view all game analyses' AND tablename = 'game_analyses') THEN
        CREATE POLICY "Users can view all game analyses" ON "public"."game_analyses" FOR SELECT USING (true);
    END IF;
END $$;
-- Create remaining RLS policies (only if they don't exist)
DO $$
BEGIN
    -- Create games_pgn policies if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'games_pgn_anon_all' AND tablename = 'games_pgn') THEN
        CREATE POLICY "games_pgn_anon_all" ON "public"."games_pgn" TO "anon" USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'games_pgn_no_client_write_ins' AND tablename = 'games_pgn') THEN
        CREATE POLICY "games_pgn_no_client_write_ins" ON "public"."games_pgn" FOR INSERT TO "authenticated" WITH CHECK (false);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'games_pgn_no_client_write_upd' AND tablename = 'games_pgn') THEN
        CREATE POLICY "games_pgn_no_client_write_upd" ON "public"."games_pgn" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'games_pgn_owner_read' AND tablename = 'games_pgn') THEN
        CREATE POLICY "games_pgn_owner_read" ON "public"."games_pgn" FOR SELECT TO "authenticated" USING ((("auth"."uid"())::"text" = "user_id"));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'games_pgn_service_role_all' AND tablename = 'games_pgn') THEN
        CREATE POLICY "games_pgn_service_role_all" ON "public"."games_pgn" TO "service_role" USING (true) WITH CHECK (true);
    END IF;
    
    -- Create import_sessions policies if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon can insert import sessions' AND tablename = 'import_sessions') THEN
        CREATE POLICY "Anon can insert import sessions" ON "public"."import_sessions" FOR INSERT WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon can read import sessions' AND tablename = 'import_sessions') THEN
        CREATE POLICY "Anon can read import sessions" ON "public"."import_sessions" FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon can update import sessions' AND tablename = 'import_sessions') THEN
        CREATE POLICY "Anon can update import sessions" ON "public"."import_sessions" FOR UPDATE USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own import sessions' AND tablename = 'import_sessions') THEN
        CREATE POLICY "Users can read own import sessions" ON "public"."import_sessions" FOR SELECT USING ((("user_id")::"text" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'sub'::"text")));
    END IF;
    
    -- Create parity_logs policies if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'parity_logs_admin_read' AND tablename = 'parity_logs') THEN
        CREATE POLICY "parity_logs_admin_read" ON "public"."parity_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
           FROM "public"."app_admins" "a"
          WHERE ("a"."email" = ("auth"."jwt"() ->> 'email'::"text")))));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'parity_logs_no_client_delete' AND tablename = 'parity_logs') THEN
        CREATE POLICY "parity_logs_no_client_delete" ON "public"."parity_logs" FOR DELETE TO "authenticated" USING (false);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'parity_logs_no_client_update' AND tablename = 'parity_logs') THEN
        CREATE POLICY "parity_logs_no_client_update" ON "public"."parity_logs" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'parity_logs_no_client_write' AND tablename = 'parity_logs') THEN
        CREATE POLICY "parity_logs_no_client_write" ON "public"."parity_logs" FOR INSERT TO "authenticated" WITH CHECK (false);
    END IF;
END $$;
-- Grant permissions
GRANT ALL ON FUNCTION "public"."cleanup_old_parity_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_parity_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_parity_logs"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_game_analyses_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_game_analyses_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_game_analyses_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_user_profile_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profile_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profile_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."upsert_games_batch"("games_data" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_games_batch"("games_data" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_games_batch"("games_data" "jsonb"[]) TO "service_role";
GRANT ALL ON TABLE "public"."game_analyses" TO "anon";
GRANT ALL ON TABLE "public"."game_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."game_analyses" TO "service_role";
GRANT ALL ON TABLE "public"."analysis_summary" TO "anon";
GRANT ALL ON TABLE "public"."analysis_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."analysis_summary" TO "service_role";
GRANT ALL ON TABLE "public"."app_admins" TO "anon";
GRANT ALL ON TABLE "public"."app_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."app_admins" TO "service_role";
GRANT ALL ON TABLE "public"."games_pgn" TO "anon";
GRANT ALL ON TABLE "public"."games_pgn" TO "authenticated";
GRANT ALL ON TABLE "public"."games_pgn" TO "service_role";
GRANT ALL ON TABLE "public"."import_sessions" TO "anon";
GRANT ALL ON TABLE "public"."import_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."import_sessions" TO "service_role";
GRANT ALL ON TABLE "public"."parity_logs" TO "anon";
GRANT ALL ON TABLE "public"."parity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."parity_logs" TO "service_role";
GRANT ALL ON SEQUENCE "public"."parity_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."parity_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."parity_logs_id_seq" TO "service_role";
