# Stripe Email and Subscription Management Fix

## Issues Fixed

### 1. Email Mismatch Between User Account and Stripe
**Problem**: Stripe customers were being created without the user's email address, causing a mismatch between the user's account email and what Stripe shows.

**Solution**: Updated `stripe_service.py` to retrieve the user's email from `auth.users` using Supabase Admin API when creating a new Stripe customer.

**Changes Made**:
- File: `python/core/stripe_service.py`
- Modified `_get_or_create_customer()` method to:
  - Use `self.supabase.auth.admin.get_user_by_id(user_id)` to get email from auth.users
  - Include email in Stripe customer creation: `customer_data['email'] = email`
  - Fallback gracefully if email is not available
  - Log email used when creating customers

### 2. Subscription Management for Pro Users
**Problem**: Pro users (both monthly and yearly) were still seeing "Upgrade to Pro" button instead of appropriate options to switch plans or cancel subscriptions.

**Solution**: Implemented smart button logic based on current subscription tier.

**Changes Made**:

#### ProfilePage (`src/pages/ProfilePage.tsx`)
- Added three new handler functions:
  - `handleCancelSubscription()` - Cancels subscription at period end
  - `handleUpgradeToYearly()` - Switches pro_monthly to pro_yearly
  - `handleSwitchToMonthly()` - Switches pro_yearly to pro_monthly

- Updated UI to show conditional buttons based on `usageStats.account_tier`:
  - **Free users**: "Upgrade to Pro for Unlimited Access"
  - **Pro Monthly users**:
    - "Upgrade to Yearly Pro (Save 20%)"
    - "Cancel Subscription"
  - **Pro Yearly users**:
    - "Switch to Monthly Pro"
    - "Cancel Subscription"

#### PricingPage (`src/pages/PricingPage.tsx`)
- Added `currentTier` variable from `usageStats.account_tier`
- Added `getButtonText(tierId)` helper function to determine button text:
  - Shows "Current Plan" for the active tier
  - Shows "Upgrade to Yearly" when monthly → yearly
  - Shows "Switch to Monthly" when yearly → monthly
  - Shows "Upgrade Now" for all other cases

- Added `shouldShowButton(tierId)` helper function:
  - Hides button for current plan
  - Shows button for all other tiers (upgrades, downgrades, switches)

- Updated UI to use dynamic button text and visibility based on current tier

#### AuthContext (`src/contexts/AuthContext.tsx`)
- Added `subscription_status` field to `UsageStats` interface to track subscription state

### 3. Cancel Subscription Functionality
**Problem**: Users had no way to cancel their subscriptions through the UI.

**Solution**: Connected frontend cancel button to existing backend endpoint.

**Backend Endpoint**: `/api/v1/payments/cancel` (already existed)
- Cancels subscription at period end (user keeps access until billing cycle ends)
- Updates `subscription_status` to 'cancelled' in database

**Frontend Integration**:
- Cancel button in ProfilePage calls the endpoint
- Shows confirmation dialog before canceling
- Displays success/error messages
- Refreshes usage stats after cancellation

## Files Modified

1. **python/core/stripe_service.py**
   - Updated `_get_or_create_customer()` to include user email from auth.users

2. **src/pages/ProfilePage.tsx**
   - Added subscription management handlers
   - Added conditional button UI based on subscription tier

3. **src/pages/PricingPage.tsx**
   - Added smart button logic for plan switching
   - Updated UI to show current plan status

4. **src/contexts/AuthContext.tsx**
   - Added `subscription_status` to UsageStats interface

5. **supabase/migrations/20251030000006_get_user_with_email_function.sql** (created but not needed)
   - Created database function as alternative approach
   - Not required since we used Supabase Admin API instead

## How It Works Now

### Email Synchronization
1. When a user makes their first payment, Stripe customer is created
2. Backend retrieves email from `auth.users` using Supabase Admin API
3. Email is included in Stripe customer creation
4. Stripe customer now shows correct email matching user account

### Subscription Management Flow

#### For Free Users
- Profile Page: Shows "Upgrade to Pro for Unlimited Access" button
- Pricing Page: Shows "Upgrade Now" on Pro tiers

#### For Pro Monthly Users
- Profile Page: Shows two buttons:
  - "Upgrade to Yearly Pro (Save 20%)"
  - "Cancel Subscription"
- Pricing Page:
  - Pro Monthly shows "✓ Current Plan"
  - Pro Yearly shows "Upgrade to Yearly"

#### For Pro Yearly Users
- Profile Page: Shows two buttons:
  - "Switch to Monthly Pro"
  - "Cancel Subscription"
- Pricing Page:
  - Pro Yearly shows "✓ Current Plan"
  - Pro Monthly shows "Switch to Monthly"

### Plan Switching
1. User clicks upgrade/switch button
2. Frontend creates new Stripe checkout session with target tier
3. User completes payment in Stripe
4. Webhook updates user's `account_tier` in database
5. Old subscription is automatically handled by Stripe (prorated)

### Subscription Cancellation
1. User clicks "Cancel Subscription" button
2. Confirmation dialog appears
3. If confirmed, frontend calls `/api/v1/payments/cancel`
4. Backend marks subscription as `cancel_at_period_end` in Stripe
5. Database `subscription_status` updated to 'cancelled'
6. User retains access until end of billing period
7. After period ends, Stripe webhook downgrades user to free tier

## Testing Instructions

### Test Email Synchronization
1. Create a new user account with email: test@example.com
2. Upgrade to Pro (either monthly or yearly)
3. Check Stripe Dashboard > Customers
4. Verify the customer shows email: test@example.com

### Test Subscription Management
1. Sign in as Pro Monthly user
2. Go to Profile page
3. Verify you see:
   - "Upgrade to Yearly Pro (Save 20%)" button
   - "Cancel Subscription" button
4. Click "Upgrade to Yearly Pro"
5. Complete test payment (card: 4242 4242 4242 4242)
6. Verify subscription updated to Pro Yearly

### Test Cancellation
1. Sign in as Pro user (any tier)
2. Go to Profile page
3. Click "Cancel Subscription"
4. Confirm cancellation
5. Verify success message
6. Check Stripe Dashboard to confirm subscription set to cancel at period end
7. Verify you still have Pro access until period ends

## Important Notes

1. **Email for Existing Customers**: Existing Stripe customers created before this fix will not have emails. They will get emails assigned when they create a new subscription or we run a backfill script.

2. **Proration**: When switching between monthly and yearly plans, Stripe handles proration automatically. Users are charged/credited the difference based on time remaining in billing cycle.

3. **Webhooks Required**: Subscription updates rely on Stripe webhooks. Ensure webhook endpoint is configured:
   - Endpoint: `https://your-domain.com/api/v1/payments/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`

4. **Cancel at Period End**: Cancellations don't take effect immediately. Users keep access until the end of their current billing period. The webhook `customer.subscription.deleted` will trigger the downgrade to free tier.

## Next Steps (Optional Improvements)

1. **Email Backfill**: Create a script to update email for existing Stripe customers
2. **Subscription Details**: Show current subscription end date on Profile page
3. **Plan Comparison**: Add visual comparison of what changes when switching plans
4. **Cancel Feedback**: Add optional feedback form when users cancel
5. **Reactivation**: Add ability to reactivate a cancelled subscription before period ends
