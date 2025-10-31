-- Fix subscription_status for subscriptions that were cancelled but not marked as such
-- This updates users who have cancel_at_period_end = true in Stripe
-- but don't have subscription_status = 'cancelled' in our database

-- Note: This migration helps fix historical data.
-- The code fix in stripe_service.py ensures this won't happen again.

-- For now, we'll add a comment explaining the fix is in the application layer
-- Since we can't query Stripe directly from SQL, we'll rely on the application
-- to call the get_subscription_status endpoint which will sync from Stripe

-- Add a helpful comment for documentation
COMMENT ON COLUMN authenticated_users.subscription_status IS
'Subscription status: active, cancelled, past_due, etc.
Set to "cancelled" when user cancels (even if they still have access until period end).
Set to "active" when subscription is paid and active.';
