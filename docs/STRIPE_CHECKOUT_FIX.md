# Stripe Checkout Button Fix

## Problem
The "Upgrade Now" button was just a simple HTML link to `/profile`, causing an infinite redirect loop between the profile and pricing pages. It wasn't actually calling the Stripe API to create a checkout session.

## Solution
Replaced the simple link with a proper button that:
1. Calls the backend API to create a Stripe checkout session
2. Gets the user's authentication token from Supabase
3. Sends the tier ID to the backend
4. Redirects to the Stripe Checkout URL
5. Shows loading state while processing

## Changes Made

### File: `src/pages/PricingPage.tsx`

**Added:**
- State for tracking which tier is being upgraded (`upgrading`)
- `handleUpgrade` function that:
  - Validates user is logged in
  - Gets Supabase session token
  - Calls `/api/v1/payments/create-checkout` endpoint
  - Passes tier ID, success URL, and cancel URL
  - Redirects to Stripe Checkout on success
  - Shows error alerts on failure

**Updated:**
- Changed "Upgrade Now" from `<a>` link to `<button>`
- Added onClick handler to call `handleUpgrade(tier.id)`
- Added loading state ("Loading..." text when upgrading)
- Added disabled state while processing

## How It Works Now

1. User clicks "Upgrade Now" on Pro Monthly or Pro Yearly
2. Frontend calls backend: `POST /api/v1/payments/create-checkout`
3. Backend creates Stripe checkout session with the tier's price ID
4. Backend returns checkout URL
5. Frontend redirects user to Stripe Checkout
6. User enters payment details
7. Stripe processes payment
8. User redirected back to success URL (`/profile?success=true`)
9. Webhook updates user's subscription in database (when configured)

## Testing

After this fix, the checkout flow should work:

1. **Refresh the pricing page** (the code has changed)
2. Click "Upgrade Now"
3. Should now redirect to Stripe Checkout (not back to profile)
4. Complete payment with test card: `4242 4242 4242 4242`
5. Should redirect back to your app

## What to Check in Console

If it still doesn't work, open browser console (F12) and check for errors:
- Authentication errors (check if user is logged in)
- API errors (check backend response)
- CORS errors (check API_URL is correct)

## Backend API Requirements

The backend endpoint `/api/v1/payments/create-checkout` expects:
```json
{
  "tier_id": "pro_monthly" or "pro_yearly",
  "success_url": "https://your-app.com/profile?success=true",
  "cancel_url": "https://your-app.com/pricing?canceled=true"
}
```

And requires:
- `Authorization: Bearer <supabase_jwt_token>` header
- `STRIPE_SECRET_KEY` environment variable set
- `stripe_price_id_monthly` or `stripe_price_id_yearly` in database
