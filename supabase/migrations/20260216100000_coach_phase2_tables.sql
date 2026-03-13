-- Migration: Coach Phase 2 Tables
-- Date: 2026-02-16
-- Description: Creates tables for Coach Phase 2 features:
--   study_plans, user_goals, game_tags, saved_positions, opening_repertoire
--   Also adds missing unique constraint on lessons table.

-- ============================================================================
-- 0. ADD MISSING UNIQUE CONSTRAINT ON LESSONS TABLE
-- lesson_generator.py upserts on (user_id, platform, lesson_type, lesson_title)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_unique_user_type_title
    ON lessons(user_id, platform, lesson_type, lesson_title);

-- ============================================================================
-- 1. STUDY_PLANS TABLE
-- Weekly structured training plans
-- ============================================================================

CREATE TABLE IF NOT EXISTS study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    week_start DATE NOT NULL,
    week_number INTEGER NOT NULL DEFAULT 1,
    goals JSONB NOT NULL DEFAULT '[]'::jsonb,
    daily_activities JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'skipped')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform, week_start)
);

CREATE INDEX IF NOT EXISTS idx_study_plans_user_platform ON study_plans(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_study_plans_status ON study_plans(status);
CREATE INDEX IF NOT EXISTS idx_study_plans_week_start ON study_plans(week_start DESC);

ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own study plans" ON study_plans;
DROP POLICY IF EXISTS "Service role full access on study plans" ON study_plans;

CREATE POLICY "Users can manage own study plans" ON study_plans
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on study plans" ON study_plans
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON study_plans TO authenticated;
GRANT ALL ON study_plans TO service_role;

COMMENT ON TABLE study_plans IS 'Weekly structured training plans for coach feature';

-- ============================================================================
-- 2. USER_GOALS TABLE
-- Goal tracking for study plans
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    study_plan_id UUID REFERENCES study_plans(id) ON DELETE SET NULL,
    goal_type TEXT NOT NULL,
    goal_description TEXT NOT NULL,
    target_value REAL NOT NULL,
    current_value REAL NOT NULL DEFAULT 0,
    deadline DATE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'abandoned')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_goals_user_platform ON user_goals(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_user_goals_status ON user_goals(status);
CREATE INDEX IF NOT EXISTS idx_user_goals_plan ON user_goals(study_plan_id);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own goals" ON user_goals;
DROP POLICY IF EXISTS "Service role full access on user goals" ON user_goals;

CREATE POLICY "Users can manage own goals" ON user_goals
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on user goals" ON user_goals
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON user_goals TO authenticated;
GRANT ALL ON user_goals TO service_role;

COMMENT ON TABLE user_goals IS 'User improvement goals linked to study plans';

-- ============================================================================
-- 3. GAME_TAGS TABLE
-- User-defined and system-generated tags on games
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    tag TEXT NOT NULL,
    tag_type TEXT NOT NULL CHECK (tag_type IN ('user', 'system')) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, game_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_game_tags_user_platform ON game_tags(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_game_tags_game ON game_tags(game_id);
CREATE INDEX IF NOT EXISTS idx_game_tags_tag ON game_tags(tag);

ALTER TABLE game_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own game tags" ON game_tags;
DROP POLICY IF EXISTS "Service role full access on game tags" ON game_tags;

CREATE POLICY "Users can manage own game tags" ON game_tags
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on game tags" ON game_tags
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON game_tags TO authenticated;
GRANT ALL ON game_tags TO service_role;

COMMENT ON TABLE game_tags IS 'Tags on games for organization and filtering';

-- ============================================================================
-- 4. SAVED_POSITIONS TABLE
-- Bookmarked chess positions with notes
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    fen TEXT NOT NULL,
    title TEXT,
    notes TEXT,
    source_game_id TEXT,
    source_move_number INTEGER,
    tags TEXT[] DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_positions_user_platform ON saved_positions(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_saved_positions_created_at ON saved_positions(created_at DESC);

ALTER TABLE saved_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own saved positions" ON saved_positions;
DROP POLICY IF EXISTS "Service role full access on saved positions" ON saved_positions;

CREATE POLICY "Users can manage own saved positions" ON saved_positions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on saved positions" ON saved_positions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON saved_positions TO authenticated;
GRANT ALL ON saved_positions TO service_role;

COMMENT ON TABLE saved_positions IS 'Bookmarked chess positions with user notes';

-- ============================================================================
-- 5. OPENING_REPERTOIRE TABLE
-- Opening statistics and spaced repetition tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS opening_repertoire (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    opening_family TEXT NOT NULL,
    color TEXT NOT NULL CHECK (color IN ('white', 'black')),
    games_played INTEGER NOT NULL DEFAULT 0,
    win_rate REAL,
    avg_accuracy REAL,
    deviation_moves JSONB DEFAULT '[]'::jsonb,
    last_practiced TIMESTAMPTZ,
    spaced_repetition_due TIMESTAMPTZ,
    confidence_level REAL NOT NULL DEFAULT 0 CHECK (confidence_level >= 0 AND confidence_level <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform, opening_family, color)
);

CREATE INDEX IF NOT EXISTS idx_opening_repertoire_user_platform ON opening_repertoire(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_opening_repertoire_due ON opening_repertoire(spaced_repetition_due);

ALTER TABLE opening_repertoire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own opening repertoire" ON opening_repertoire;
DROP POLICY IF EXISTS "Service role full access on opening repertoire" ON opening_repertoire;

CREATE POLICY "Users can manage own opening repertoire" ON opening_repertoire
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on opening repertoire" ON opening_repertoire
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON opening_repertoire TO authenticated;
GRANT ALL ON opening_repertoire TO service_role;

COMMENT ON TABLE opening_repertoire IS 'Opening repertoire stats with spaced repetition scheduling';

-- ============================================================================
-- 6. TRIGGERS FOR UPDATED_AT
-- ============================================================================

DROP TRIGGER IF EXISTS update_study_plans_updated_at ON study_plans;
DROP TRIGGER IF EXISTS update_user_goals_updated_at ON user_goals;
DROP TRIGGER IF EXISTS update_saved_positions_updated_at ON saved_positions;
DROP TRIGGER IF EXISTS update_opening_repertoire_updated_at ON opening_repertoire;

CREATE TRIGGER update_study_plans_updated_at
    BEFORE UPDATE ON study_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_goals_updated_at
    BEFORE UPDATE ON user_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_positions_updated_at
    BEFORE UPDATE ON saved_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opening_repertoire_updated_at
    BEFORE UPDATE ON opening_repertoire
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created tables:
-- 1. study_plans - Weekly structured training plans
-- 2. user_goals - User improvement goals
-- 3. game_tags - Tags on games (user + system auto-tags)
-- 4. saved_positions - Bookmarked chess positions
-- 5. opening_repertoire - Opening stats with spaced repetition
--
-- Added constraints:
-- 1. Unique index on lessons(user_id, platform, lesson_type, lesson_title)
--
-- All tables have:
-- - RLS enabled with user-scoped policies
-- - Service role policies for backend access
-- - Proper indexes for performance
-- - Auto-updating updated_at timestamps
-- - Foreign key constraints with CASCADE delete
-- ============================================================================
