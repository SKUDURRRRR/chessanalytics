# CodeRabbit Double-Credit Issue Investigation

## Issue Summary
CodeRabbit flagged a **CRITICAL** potential issue in `python/core/stripe_service.py` regarding webhook idempotency that could lead to double-crediting users.

**Status:** ⚠️ **THIS IS A REAL ISSUE - NOT A FALSE POSITIVE**

---

## The Problem

### What CodeRabbit Found
CodeRabbit correctly identified that the `_handle_checkout_completed()` webhook handler (lines 385-429) does **NOT** check for duplicate processing before:
1. Granting credits to users (`_add_user_credits`)
2. Updating subscriptions (`_update_user_subscription`)
3. Recording the transaction in the database

### Why This Is Critical
Stripe webhooks guarantee **at-least-once delivery**, which means:
- If the webhook handler returns an error or times out, Stripe will retry
- If the network fails after credits are granted but before responding to Stripe, Stripe will retry
- A single legitimate payment could be processed 2, 3, or more times
- This would **double-credit** users and corrupt the transaction ledger

---

## Current Code Analysis

### Problem Code: `_handle_checkout_completed()` (Lines 385-429)

```python
async def _handle_checkout_completed(self, session):
    """Handle successful checkout session completion."""
    customer_id = session.get('customer')
    metadata = session.get('metadata', {})
    user_id = metadata.get('user_id')

    if not user_id:
        logger.error("No user_id in checkout session metadata")
        return

    # Record transaction
    amount = session.get('amount_total', 0) / 100  # Convert cents to dollars

    transaction_data = {
        'user_id': user_id,
        'stripe_payment_id': session.get('payment_intent'),
        'amount': str(amount),
        'currency': session.get('currency', 'usd'),
        'status': 'succeeded',
        'metadata': metadata
    }

    if 'tier_id' in metadata:
        # ❌ NO IDEMPOTENCY CHECK BEFORE THIS!
        # Subscription purchase
        transaction_data['transaction_type'] = 'subscription'
        transaction_data['tier_id'] = metadata['tier_id']

        # Update user's subscription (MUTATES STATE!)
        subscription_id = session.get('subscription')
        await self._update_user_subscription(user_id, metadata['tier_id'], subscription_id)

    elif 'credits_purchased' in metadata:
        # ❌ NO IDEMPOTENCY CHECK BEFORE THIS!
        # Credit purchase
        transaction_data['transaction_type'] = 'credits'
        transaction_data['credits_purchased'] = int(metadata['credits_purchased'])

        # Add credits to user account (MUTATES STATE!)
        await self._add_user_credits(user_id, int(metadata['credits_purchased']))

    # Save transaction (happens AFTER mutations!)
    await asyncio.to_thread(
        lambda: self.supabase.table('payment_transactions').insert(transaction_data).execute()
    )

    logger.info(f"Checkout completed for user {user_id}")
```

**Issues:**
1. ❌ Credits/subscription updated **before** checking for duplicates
2. ❌ Transaction recorded **after** mutations (race condition window)
3. ❌ No `stripe_payment_id` uniqueness check

---

## Correct Implementation Already Exists!

### Good Code: `verify_and_sync_session()` (Lines 770-794)

Interestingly, the codebase **already has** a correct idempotent implementation in `verify_and_sync_session()`:

```python
# Check if transaction already processed (idempotency check)
# This MUST be done BEFORE granting credits/subscription to prevent double-crediting
existing = await asyncio.to_thread(
    lambda: self.supabase.table('payment_transactions').select('id').eq(
        'stripe_payment_id', session.get('payment_intent')
    ).execute()
)

if existing.data:
    logger.info(
        f"Skipping credit grant for user {user_id}; payment_intent %s already processed",
        session.get('payment_intent')
    )
    if tier_id:
        return {
            'success': True,
            'message': 'Subscription already processed',
            'tier_id': tier_id
        }
    else:
        return {
            'success': True,
            'message': 'Payment already processed',
            'credits_added': int(credits_purchased)
        }

# Only proceed with mutations if not already processed
if tier_id:
    # NOW it's safe to update subscription
    await self._update_user_subscription(user_id, tier_id, subscription_id)

    # Record transaction
    await asyncio.to_thread(...)
```

**This is the correct pattern:**
1. ✅ Check `payment_transactions` table for existing `stripe_payment_id`
2. ✅ If found, return early with success (idempotent)
3. ✅ Only mutate state if NOT already processed
4. ✅ Record transaction atomically

---

## Other Webhook Handlers

### `_handle_invoice_paid()` (Lines 431-464)
**Status:** ⚠️ **ALSO VULNERABLE**

```python
async def _handle_invoice_paid(self, invoice):
    """Handle successful invoice payment (recurring subscriptions)."""
    # ... get user ...

    # ❌ NO IDEMPOTENCY CHECK!
    # Directly inserts transaction without checking for duplicates
    await asyncio.to_thread(
        lambda: self.supabase.table('payment_transactions').insert({
            'user_id': user_id,
            'stripe_payment_id': invoice.get('payment_intent'),
            # ...
        }).execute()
    )
```

This handler doesn't grant credits/subscriptions (those are handled elsewhere), but it could still create duplicate transaction records.

---

## Impact Assessment

### Severity: **CRITICAL** 🔴

### Attack Vectors
1. **Natural Webhook Retries**: Stripe legitimately retries failed webhooks
2. **Network Issues**: Timeout after mutation but before response
3. **Server Crashes**: Process killed after granting credits but before recording
4. **Database Delays**: Slow transaction insert could trigger Stripe timeout

### Potential Damage
- **Financial Loss**: Users get double credits for single payment
- **Data Corruption**: Duplicate transaction records
- **Trust Issues**: Users discover they can trigger double-credits
- **Audit Failures**: Transaction ledger doesn't match actual credits granted

### Exploitability
- **Difficulty**: Easy (just needs network hiccup or server restart)
- **Detectability**: Moderate (would show up in transaction vs. credit balance audits)
- **Current Protection**: None in webhook handler

---

## Recommended Fix

### Step 1: Apply Idempotency Check to `_handle_checkout_completed()`

```python
async def _handle_checkout_completed(self, session):
    """Handle successful checkout session completion."""
    customer_id = session.get('customer')
    metadata = session.get('metadata', {})
    user_id = metadata.get('user_id')

    if not user_id:
        logger.error("No user_id in checkout session metadata")
        return

    payment_intent = session.get('payment_intent')

    # ✅ CHECK FOR DUPLICATE FIRST (BEFORE ANY MUTATIONS)
    existing = await asyncio.to_thread(
        lambda: self.supabase.table('payment_transactions').select('id').eq(
            'stripe_payment_id', payment_intent
        ).execute()
    )

    if existing.data:
        logger.info(
            f"Skipping duplicate checkout.session.completed for payment_intent {payment_intent}, "
            f"user {user_id} - already processed"
        )
        return  # Idempotent - safe to return success

    # NOW safe to mutate state
    amount = session.get('amount_total', 0) / 100

    transaction_data = {
        'user_id': user_id,
        'stripe_payment_id': payment_intent,
        'amount': str(amount),
        'currency': session.get('currency', 'usd'),
        'status': 'succeeded',
        'metadata': metadata
    }

    if 'tier_id' in metadata:
        transaction_data['transaction_type'] = 'subscription'
        transaction_data['tier_id'] = metadata['tier_id']
        subscription_id = session.get('subscription')
        await self._update_user_subscription(user_id, metadata['tier_id'], subscription_id)

    elif 'credits_purchased' in metadata:
        transaction_data['transaction_type'] = 'credits'
        transaction_data['credits_purchased'] = int(metadata['credits_purchased'])
        await self._add_user_credits(user_id, int(metadata['credits_purchased']))

    # Record transaction
    await asyncio.to_thread(
        lambda: self.supabase.table('payment_transactions').insert(transaction_data).execute()
    )

    logger.info(f"Checkout completed for user {user_id}")
```

### Step 2: Apply Idempotency Check to `_handle_invoice_paid()`

```python
async def _handle_invoice_paid(self, invoice):
    """Handle successful invoice payment (recurring subscriptions)."""
    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')
    payment_intent = invoice.get('payment_intent')

    # ✅ CHECK FOR DUPLICATE FIRST
    existing = await asyncio.to_thread(
        lambda: self.supabase.table('payment_transactions').select('id').eq(
            'stripe_payment_id', payment_intent
        ).execute()
    )

    if existing.data:
        logger.info(
            f"Skipping duplicate invoice.paid for payment_intent {payment_intent} - already processed"
        )
        return

    # Get user from customer ID
    user_result = await asyncio.to_thread(
        lambda: self.supabase.table('authenticated_users').select('id').eq(
            'stripe_customer_id', customer_id
        ).execute()
    )

    if not user_result.data:
        logger.error(f"User not found for Stripe customer {customer_id}")
        return

    user_id = user_result.data[0]['id']

    # Record transaction
    amount = invoice.get('amount_paid', 0) / 100

    await asyncio.to_thread(
        lambda: self.supabase.table('payment_transactions').insert({
            'user_id': user_id,
            'stripe_payment_id': payment_intent,
            'stripe_invoice_id': invoice.get('id'),
            'amount': str(amount),
            'currency': invoice.get('currency', 'usd'),
            'status': 'succeeded',
            'transaction_type': 'subscription'
        }).execute()
    )

    logger.info(f"Invoice paid for user {user_id}")
```

### Step 3: Add Database Constraint (Defense in Depth)

Add a unique constraint on `payment_transactions.stripe_payment_id` to prevent duplicates at the database level:

```sql
-- Add unique constraint to prevent duplicate transactions
ALTER TABLE payment_transactions
ADD CONSTRAINT unique_stripe_payment_id
UNIQUE (stripe_payment_id);

-- Handle NULL values (some old records might not have stripe_payment_id)
-- Option 1: Make it a partial unique constraint (only enforce when not NULL)
ALTER TABLE payment_transactions
DROP CONSTRAINT IF EXISTS unique_stripe_payment_id;

CREATE UNIQUE INDEX unique_stripe_payment_id_not_null
ON payment_transactions (stripe_payment_id)
WHERE stripe_payment_id IS NOT NULL;
```

---

## Testing Strategy

### Manual Testing
1. Create a test payment
2. Manually trigger webhook retry by:
   - Commenting out the response in webhook handler
   - Letting it timeout
   - Checking if credits are doubled

### Automated Testing
```python
async def test_webhook_idempotency():
    """Test that duplicate webhook events don't double-credit."""
    # Create mock checkout session
    session = {
        'payment_intent': 'pi_test_123',
        'customer': 'cus_test',
        'amount_total': 1000,  # $10
        'metadata': {'user_id': 'test_user', 'credits_purchased': '100'}
    }

    # Process webhook first time
    await stripe_service._handle_checkout_completed(session)

    # Get user credits
    credits_after_first = await get_user_credits('test_user')

    # Process same webhook again (simulate retry)
    await stripe_service._handle_checkout_completed(session)

    # Credits should NOT change
    credits_after_second = await get_user_credits('test_user')

    assert credits_after_first == credits_after_second, "Double crediting detected!"
```

---

## Conclusion

### CodeRabbit Assessment: **CORRECT** ✅

This is a **real and critical security/financial issue**, not a false positive due to lack of context.

### Priority: **IMMEDIATE FIX REQUIRED**

### Action Items:
1. ✅ Apply idempotency checks to both webhook handlers
2. ✅ Add database constraint for defense in depth
3. ✅ Add automated tests for webhook idempotency
4. ✅ Audit existing transactions for duplicates
5. ✅ Monitor for any double-credit incidents after fix

### Credit to CodeRabbit:
This is exactly the kind of critical issue that automated code review should catch. Well done! 👏

---

## Additional Notes

The fact that `verify_and_sync_session()` already has the correct implementation suggests this might have been an oversight or the webhook handler was written before the idempotency pattern was established. The fix is straightforward - just apply the same pattern that already exists elsewhere in the codebase.
