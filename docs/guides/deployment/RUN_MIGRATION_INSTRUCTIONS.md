# How to Run the Idempotency Migration

## Migration File
`supabase/migrations/20250130000002_add_payment_idempotency_constraint.sql`

## Option 1: Supabase Dashboard (RECOMMENDED)

Since the CLI is having connection issues, use the Supabase Dashboard:

### Steps:
1. Go to https://supabase.com/dashboard
2. Select your project: **chessanalytics prod** (Central EU - Frankfurt)
3. Navigate to: **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the SQL below
6. Click **Run** (or press Ctrl+Enter)

### SQL to Execute:

```sql
-- Migration: Add idempotency constraint to payment_transactions
-- Purpose: Prevent duplicate payment transactions at database level (defense in depth)
-- Date: 2025-01-30

-- Drop any existing constraint/index if it exists
DROP INDEX IF EXISTS unique_stripe_payment_id_not_null;

-- Create partial unique index (only enforces uniqueness when stripe_payment_id IS NOT NULL)
CREATE UNIQUE INDEX unique_stripe_payment_id_not_null
ON payment_transactions (stripe_payment_id)
WHERE stripe_payment_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX unique_stripe_payment_id_not_null IS
'Ensures each Stripe payment_intent can only be recorded once, preventing double-crediting from webhook retries';

-- Verify the index was created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'payment_transactions'
  AND indexname = 'unique_stripe_payment_id_not_null';
```

### Expected Result:
You should see a table showing:
- **schemaname:** public
- **tablename:** payment_transactions
- **indexname:** unique_stripe_payment_id_not_null
- **indexdef:** (the index definition)

If you see this row, the migration was successful! ✅

---

## Option 2: Using psql (if you have PostgreSQL client)

```bash
# Get your database connection string from Supabase Dashboard
# Settings → Database → Connection string (Transaction mode)

psql "your-connection-string-here" < supabase/migrations/20250130000002_add_payment_idempotency_constraint.sql
```

---

## Option 3: Fix CLI Connection (for future)

The CLI connection issue might be due to:
1. Network/firewall blocking the connection
2. Supabase CLI needs to be re-linked
3. Authentication token expired

To fix:
```bash
# Re-link the project
supabase link --project-ref nhpsnvhvfscrmyniihdn

# Then try again
supabase db push --linked
```

---

## Verification After Migration

Run this query to verify the constraint is working:

```sql
-- Try to insert duplicate stripe_payment_id (should fail)
INSERT INTO payment_transactions (stripe_payment_id, user_id, amount, currency, status)
VALUES ('test_duplicate_123', 'test_user', '10.00', 'usd', 'succeeded');

-- Run the same insert again (should fail with unique constraint violation)
INSERT INTO payment_transactions (stripe_payment_id, user_id, amount, currency, status)
VALUES ('test_duplicate_123', 'test_user', '10.00', 'usd', 'succeeded');

-- Clean up test data
DELETE FROM payment_transactions WHERE stripe_payment_id = 'test_duplicate_123';
```

Expected: Second insert should fail with error:
```
ERROR: duplicate key value violates unique constraint "unique_stripe_payment_id_not_null"
```

---

## What This Migration Does

1. **Creates a unique index** on `stripe_payment_id` column in `payment_transactions` table
2. **Partial index** - only enforces uniqueness when `stripe_payment_id IS NOT NULL`
3. **Prevents duplicates** at database level (defense in depth with application-level checks)
4. **Handles NULL values** - old records without `stripe_payment_id` won't cause conflicts

---

## Impact

- **Performance:** Negligible (index adds ~8 bytes per row)
- **Existing Data:** No changes to existing data
- **Future Inserts:** Will reject duplicates with same `stripe_payment_id`
- **Downtime:** None (index is created online)

---

## Rollback (if needed)

If you need to rollback this migration:

```sql
DROP INDEX IF EXISTS unique_stripe_payment_id_not_null;
```

---

## Status Checklist

- [ ] Migration SQL executed in Supabase Dashboard
- [ ] Verification query confirms index exists
- [ ] Test insert/duplicate confirmed constraint works
- [ ] Test data cleaned up
- [ ] Application code deployed (already done ✅)
- [ ] Monitor production logs for idempotency messages

---

**Ready to deploy!** The application code is already fixed, this database constraint adds the final layer of protection.
