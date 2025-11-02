-- ============================================================================
-- Migration: Fix Critical Database Issues
-- Date: 2025-11-02
-- Source: Supabase Linter Report
--
-- Critical Fixes:
-- 1. Add index for unindexed foreign key (payment_transactions.tier_id)
-- 2. Add primary key to games_pgn table
-- ============================================================================

-- ============================================================================
-- FIX 1: Add Index for Foreign Key on payment_transactions.tier_id
-- ============================================================================
--
-- Issue: Foreign key constraint payment_transactions_tier_id_fkey does not
-- have a covering index, which can impact query performance.
--
-- Impact: JOINs and DELETE operations on payment_tiers table will be slow
-- when checking for dependent payment_transactions records.
--
-- Solution: Add an index on tier_id column
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tier_id
ON payment_transactions(tier_id);

COMMENT ON INDEX idx_payment_transactions_tier_id IS
'Index to support foreign key lookups for tier_id. Required for optimal JOIN and DELETE performance.';

-- ============================================================================
-- FIX 2: Add Primary Key to games_pgn Table
-- ============================================================================
--
-- Issue: Table games_pgn does not have a primary key.
-- Tables without a primary key can be inefficient to interact with at scale.
--
-- Impact:
-- - Slow row identification
-- - Replication issues
-- - Poor query performance
-- - Data integrity concerns
--
-- Solution: Add UUID primary key column (id) if it doesn't exist
-- ============================================================================

-- Check if the table already has a primary key constraint
DO $$
DECLARE
    has_pk BOOLEAN;
BEGIN
    -- Check if primary key exists
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'games_pgn'::regclass
        AND contype = 'p'
    ) INTO has_pk;

    -- Only add primary key if it doesn't exist
    IF NOT has_pk THEN
        -- Check if 'id' column exists
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'games_pgn'
            AND column_name = 'id'
        ) THEN
            -- Add id column
            ALTER TABLE games_pgn ADD COLUMN id UUID DEFAULT gen_random_uuid();
        END IF;

        -- Add primary key constraint
        ALTER TABLE games_pgn ADD PRIMARY KEY (id);

        RAISE NOTICE 'Primary key added to games_pgn table';
    ELSE
        RAISE NOTICE 'Primary key already exists on games_pgn table';
    END IF;
END $$;

COMMENT ON COLUMN games_pgn.id IS
'Primary key for games_pgn table. Required for efficient row identification and data integrity.';

-- ============================================================================
-- Verification Queries
-- ============================================================================
--
-- Run these queries to verify the fixes:
--
-- 1. Check if the index exists:
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE tablename = 'payment_transactions'
--    AND indexname = 'idx_payment_transactions_tier_id';
--
-- 2. Check if games_pgn has a primary key:
--    SELECT constraint_name, constraint_type
--    FROM information_schema.table_constraints
--    WHERE table_name = 'games_pgn'
--    AND constraint_type = 'PRIMARY KEY';
--
-- ============================================================================
