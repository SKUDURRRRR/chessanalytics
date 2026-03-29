-- Migration: Cleanup Duplicate and Unused Indexes
-- Date: 2026-02-20
-- Fixes:
--   1. Duplicate indexes flagged by Performance Advisor
--   2. Conservative removal of indexes subsumed by better composite indexes
-- All operations use IF EXISTS for idempotency.

-- ============================================================================
-- 1. DUPLICATE INDEXES
-- ============================================================================

-- puzzle_attempts: idx_puzzle_attempts_user_date (user_id, attempted_at DESC)
-- is identical to idx_puzzle_attempts_user (user_id, attempted_at DESC)
DROP INDEX IF EXISTS public.idx_puzzle_attempts_user_date;

-- analytics_events duplicates (production only - table may not exist locally)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'analytics_events' AND n.nspname = 'public'
    ) THEN
        -- Single-column event_type index is subsumed by composite indexes
        EXECUTE 'DROP INDEX IF EXISTS public.idx_analytics_events_event_type';
        -- Single-column created_at index is subsumed by composite indexes
        EXECUTE 'DROP INDEX IF EXISTS public.idx_analytics_events_created_at';
    END IF;
END $$;

-- ============================================================================
-- 2. SUBSUMED SINGLE-COLUMN INDEXES ON games TABLE
-- These are all prefixed by better composite indexes.
-- Example: idx_games_user_id is prefix of idx_games_user_platform(user_id, platform)
-- ============================================================================

-- idx_games_user_id subsumed by idx_games_user_platform
DROP INDEX IF EXISTS public.idx_games_user_id;

-- idx_games_platform subsumed by idx_games_user_platform and idx_games_platform_provider_game_id
DROP INDEX IF EXISTS public.idx_games_platform;

-- idx_games_result subsumed by idx_games_user_result(user_id, result)
DROP INDEX IF EXISTS public.idx_games_result;

-- idx_games_played_at subsumed by idx_games_user_played_at(user_id, played_at DESC)
DROP INDEX IF EXISTS public.idx_games_played_at;

-- idx_games_accuracy: queries always filter by user_id first
DROP INDEX IF EXISTS public.idx_games_accuracy;

-- idx_games_blunders: queries always filter by user_id first
DROP INDEX IF EXISTS public.idx_games_blunders;

-- idx_games_analyzed: low-cardinality boolean, not useful as standalone index
DROP INDEX IF EXISTS public.idx_games_analyzed;

-- ============================================================================
-- 3. SUBSUMED SINGLE-COLUMN INDEXES ON game_analyses TABLE
-- ============================================================================

-- idx_game_analyses_user_id subsumed by idx_game_analyses_user_platform
DROP INDEX IF EXISTS public.idx_game_analyses_user_id;

-- idx_game_analyses_platform subsumed by idx_game_analyses_user_platform
DROP INDEX IF EXISTS public.idx_game_analyses_platform;

-- idx_game_analyses_accuracy: standalone accuracy index has no query pattern
DROP INDEX IF EXISTS public.idx_game_analyses_accuracy;

-- ============================================================================
-- 4. LOW-VALUE INDEXES ON OTHER TABLES
-- ============================================================================

-- payment_transactions: status is low-cardinality (pending/succeeded/failed/refunded)
-- Queries always filter by user_id first via idx_payment_transactions_user_id
DROP INDEX IF EXISTS public.idx_payment_transactions_status;

-- parity_logs: delta value is never used in WHERE clauses, only in SELECT output
DROP INDEX IF EXISTS public.idx_parity_logs_delta;

-- ============================================================================
-- 5. REFRESH TABLE STATISTICS
-- ============================================================================

ANALYZE games;
ANALYZE game_analyses;
ANALYZE puzzle_attempts;
