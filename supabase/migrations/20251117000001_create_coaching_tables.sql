-- Migration: Create Coaching Tables
-- Date: 2025-11-17
-- Description: Creates tables for Coach tab features (lessons, puzzles, progress tracking)

-- ============================================================================
-- 1. LESSONS TABLE
-- Stores generated lessons for each user based on their game analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    lesson_type TEXT NOT NULL CHECK (lesson_type IN ('opening', 'tactical', 'positional', 'time_management', 'style')),
    lesson_title TEXT NOT NULL,
    lesson_description TEXT,
    lesson_content JSONB NOT NULL DEFAULT '{}'::jsonb,
    priority TEXT NOT NULL CHECK (priority IN ('critical', 'important', 'enhancement')) DEFAULT 'important',
    estimated_time_minutes INTEGER DEFAULT 15,
    generated_from_games TEXT[], -- Array of game IDs used to generate this lesson
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lessons_user_platform ON lessons(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_lessons_type ON lessons(lesson_type);
CREATE INDEX IF NOT EXISTS idx_lessons_priority ON lessons(priority);
CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON lessons(created_at DESC);

-- Enable RLS
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users can view own lessons" ON lessons;
DROP POLICY IF EXISTS "Service role full access on lessons" ON lessons;

-- RLS Policies
CREATE POLICY "Users can view own lessons" ON lessons
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access (for generating lessons)
CREATE POLICY "Service role full access on lessons" ON lessons
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON lessons TO authenticated;
GRANT ALL ON lessons TO service_role;

COMMENT ON TABLE lessons IS 'Stores personalized lessons generated from user game analysis';

-- ============================================================================
-- 2. LESSON_PROGRESS TABLE
-- Tracks user progress through lessons
-- ============================================================================

CREATE TABLE IF NOT EXISTS lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
    completion_percentage FLOAT DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    time_spent_seconds INTEGER DEFAULT 0,
    quiz_score FLOAT CHECK (quiz_score IS NULL OR (quiz_score >= 0 AND quiz_score <= 100)),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id, status);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_status ON lesson_progress(status);

-- Enable RLS
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage own lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Service role full access on lesson progress" ON lesson_progress;

-- RLS Policies
CREATE POLICY "Users can manage own lesson progress" ON lesson_progress
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access on lesson progress" ON lesson_progress
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON lesson_progress TO authenticated;
GRANT ALL ON lesson_progress TO service_role;

COMMENT ON TABLE lesson_progress IS 'Tracks user progress and completion status for lessons';

-- ============================================================================
-- 3. PUZZLES TABLE
-- Stores generated puzzles from user games (blunders, mistakes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS puzzles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    fen_position TEXT NOT NULL,
    correct_move TEXT NOT NULL,
    solution_line TEXT[] NOT NULL DEFAULT '{}'::text[],
    puzzle_category TEXT NOT NULL CHECK (puzzle_category IN ('tactical', 'positional', 'opening', 'endgame', 'time_management')),
    tactical_theme TEXT, -- pin, fork, skewer, etc.
    difficulty_rating INTEGER CHECK (difficulty_rating IS NULL OR (difficulty_rating >= 0 AND difficulty_rating <= 3000)),
    explanation TEXT,
    source_game_id UUID REFERENCES games(id) ON DELETE SET NULL,
    source_move_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_puzzles_user_platform ON puzzles(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_puzzles_category ON puzzles(puzzle_category);
CREATE INDEX IF NOT EXISTS idx_puzzles_difficulty ON puzzles(difficulty_rating);
CREATE INDEX IF NOT EXISTS idx_puzzles_source_game ON puzzles(source_game_id);
CREATE INDEX IF NOT EXISTS idx_puzzles_created_at ON puzzles(created_at DESC);

-- Enable RLS
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own puzzles" ON puzzles;
DROP POLICY IF EXISTS "Service role full access on puzzles" ON puzzles;

-- RLS Policies
CREATE POLICY "Users can view own puzzles" ON puzzles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access (for generating puzzles)
CREATE POLICY "Service role full access on puzzles" ON puzzles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON puzzles TO authenticated;
GRANT ALL ON puzzles TO service_role;

COMMENT ON TABLE puzzles IS 'Stores personalized puzzles generated from user game mistakes';

-- ============================================================================
-- 4. PUZZLE_ATTEMPTS TABLE
-- Tracks puzzle solving attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS puzzle_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    puzzle_id UUID NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    was_correct BOOLEAN NOT NULL,
    time_to_solve_seconds INTEGER CHECK (time_to_solve_seconds IS NULL OR time_to_solve_seconds >= 0),
    moves_made TEXT[] DEFAULT '{}'::text[],
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user ON puzzle_attempts(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_puzzle ON puzzle_attempts(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_correct ON puzzle_attempts(was_correct);

-- Enable RLS
ALTER TABLE puzzle_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage own puzzle attempts" ON puzzle_attempts;
DROP POLICY IF EXISTS "Service role full access on puzzle attempts" ON puzzle_attempts;

-- RLS Policies
CREATE POLICY "Users can manage own puzzle attempts" ON puzzle_attempts
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access on puzzle attempts" ON puzzle_attempts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON puzzle_attempts TO authenticated;
GRANT ALL ON puzzle_attempts TO service_role;

COMMENT ON TABLE puzzle_attempts IS 'Tracks user attempts at solving puzzles';

-- ============================================================================
-- 5. TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
DROP TRIGGER IF EXISTS update_lesson_progress_updated_at ON lesson_progress;

-- Add triggers for updated_at (using existing function)
CREATE TRIGGER update_lessons_updated_at
    BEFORE UPDATE ON lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_progress_updated_at
    BEFORE UPDATE ON lesson_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created tables:
-- 1. lessons - Personalized lessons generated from game analysis
-- 2. lesson_progress - User progress tracking for lessons
-- 3. puzzles - Personalized puzzles from user mistakes
-- 4. puzzle_attempts - Puzzle solving attempt records
--
-- All tables have:
-- - RLS enabled with user-scoped policies
-- - Service role policies for backend access
-- - Proper indexes for performance
-- - Auto-updating updated_at timestamps (where applicable)
-- - Foreign key constraints with CASCADE delete
-- ============================================================================
