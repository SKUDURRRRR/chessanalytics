-- ============================================================================
-- PUZZLE TRAINER V2 - Real multi-move puzzles with rating & gamification
-- ============================================================================
-- Adds puzzle_bank (Lichess standard puzzles), user_puzzle_rating (Elo tracking),
-- daily_challenge (daily 5-puzzle challenges), and extends puzzle_attempts.

-- ============================================================================
-- 1. PUZZLE BANK TABLE
-- Stores standard puzzles from Lichess database (CC0 licensed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS puzzle_bank (
    id TEXT PRIMARY KEY,                              -- Lichess puzzle ID
    fen TEXT NOT NULL,                                -- Starting FEN position
    moves TEXT[] NOT NULL,                            -- Full move sequence (UCI). moves[0] = setup move
    rating INTEGER NOT NULL,                          -- Puzzle Elo rating
    rating_deviation INTEGER NOT NULL DEFAULT 75,
    popularity INTEGER NOT NULL DEFAULT 0,
    nb_plays INTEGER NOT NULL DEFAULT 0,
    themes TEXT[] NOT NULL DEFAULT '{}'::text[],       -- Tactical themes (fork, pin, mate, etc.)
    game_url TEXT,                                     -- Source Lichess game URL
    opening_tags TEXT[] DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_puzzle_bank_rating ON puzzle_bank(rating);
CREATE INDEX IF NOT EXISTS idx_puzzle_bank_themes ON puzzle_bank USING GIN(themes);
CREATE INDEX IF NOT EXISTS idx_puzzle_bank_popularity ON puzzle_bank(popularity DESC);

ALTER TABLE puzzle_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read puzzle bank" ON puzzle_bank;
DROP POLICY IF EXISTS "Service role full access on puzzle bank" ON puzzle_bank;

CREATE POLICY "Anyone can read puzzle bank" ON puzzle_bank
    FOR SELECT USING (true);

CREATE POLICY "Service role full access on puzzle bank" ON puzzle_bank
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON puzzle_bank TO anon, authenticated;
GRANT ALL ON puzzle_bank TO service_role;

COMMENT ON TABLE puzzle_bank IS 'Standard tactical puzzles from Lichess database (CC0 licensed)';

-- ============================================================================
-- 2. USER PUZZLE RATING TABLE
-- Per-user Elo rating, XP, and level tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_puzzle_rating (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL DEFAULT 1200,
    rating_deviation INTEGER NOT NULL DEFAULT 350,
    puzzles_attempted INTEGER NOT NULL DEFAULT 0,
    puzzles_correct INTEGER NOT NULL DEFAULT 0,
    highest_rating INTEGER NOT NULL DEFAULT 1200,
    current_xp INTEGER NOT NULL DEFAULT 0,
    current_level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_puzzle_rating_user ON user_puzzle_rating(user_id);

ALTER TABLE user_puzzle_rating ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own puzzle rating" ON user_puzzle_rating;
DROP POLICY IF EXISTS "Service role full access on user puzzle rating" ON user_puzzle_rating;

CREATE POLICY "Users can view own puzzle rating" ON user_puzzle_rating
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on user puzzle rating" ON user_puzzle_rating
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON user_puzzle_rating TO authenticated;
GRANT ALL ON user_puzzle_rating TO service_role;

COMMENT ON TABLE user_puzzle_rating IS 'User puzzle Elo rating with Glicko-style deviation, XP, and level';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_puzzle_rating_updated_at ON user_puzzle_rating;
CREATE TRIGGER update_user_puzzle_rating_updated_at
    BEFORE UPDATE ON user_puzzle_rating
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. DAILY CHALLENGE TABLE
-- Tracks daily 5-puzzle challenge completion
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_challenge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_date DATE NOT NULL DEFAULT CURRENT_DATE,
    puzzle_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
    completed_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
    total_xp_earned INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, challenge_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_challenge_user_date ON daily_challenge(user_id, challenge_date DESC);

ALTER TABLE daily_challenge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own daily challenges" ON daily_challenge;
DROP POLICY IF EXISTS "Service role full access on daily challenges" ON daily_challenge;

CREATE POLICY "Users can manage own daily challenges" ON daily_challenge
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on daily challenges" ON daily_challenge
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON daily_challenge TO authenticated;
GRANT ALL ON daily_challenge TO service_role;

COMMENT ON TABLE daily_challenge IS 'Daily 5-puzzle challenge tracking per user';

-- ============================================================================
-- 4. EXTEND PUZZLE ATTEMPTS TABLE
-- Add support for puzzle_bank puzzles and rating tracking
-- ============================================================================

ALTER TABLE puzzle_attempts
    ADD COLUMN IF NOT EXISTS puzzle_bank_id TEXT REFERENCES puzzle_bank(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rating_before INTEGER,
    ADD COLUMN IF NOT EXISTS rating_after INTEGER,
    ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0;

-- Make puzzle_id nullable to allow puzzle_bank puzzles
ALTER TABLE puzzle_attempts ALTER COLUMN puzzle_id DROP NOT NULL;

-- Ensure at least one puzzle source is set
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'puzzle_attempts_source_check'
    ) THEN
        ALTER TABLE puzzle_attempts
            ADD CONSTRAINT puzzle_attempts_source_check
            CHECK (puzzle_id IS NOT NULL OR puzzle_bank_id IS NOT NULL);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_bank ON puzzle_attempts(puzzle_bank_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user_date ON puzzle_attempts(user_id, attempted_at DESC);
