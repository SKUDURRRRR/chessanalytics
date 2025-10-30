-- Migration: Add idempotency constraint to payment_transactions
-- Purpose: Prevent duplicate payment transactions at database level (defense in depth)
-- Author: AI Assistant
-- Date: 2025-01-30
-- Related: CODERABBIT_DOUBLE_CREDIT_INVESTIGATION.md

-- Add unique constraint on stripe_payment_id to prevent duplicate transactions
-- Use a partial unique index to handle NULL values (some old records might not have stripe_payment_id)
-- This constraint works together with application-level idempotency checks

-- Drop any existing constraint/index if it exists
DROP INDEX IF EXISTS unique_stripe_payment_id_not_null;

-- Create partial unique index (only enforces uniqueness when stripe_payment_id IS NOT NULL)
CREATE UNIQUE INDEX unique_stripe_payment_id_not_null
ON payment_transactions (stripe_payment_id)
WHERE stripe_payment_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX unique_stripe_payment_id_not_null IS
'Ensures each Stripe payment_intent can only be recorded once, preventing double-crediting from webhook retries';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added idempotency constraint to payment_transactions';
    RAISE NOTICE 'Constraint: unique_stripe_payment_id_not_null (partial index on stripe_payment_id WHERE NOT NULL)';
END $$;
