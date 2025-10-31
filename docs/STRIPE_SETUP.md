# Stripe Setup Guide

## Overview
This guide walks through setting up Stripe for the Chess Analytics platform, including creating products, configuring webhooks, and integrating with the application.

## Prerequisites
- Stripe account (sign up at https://stripe.com)
- Access to your Stripe Dashboard
- Your application deployed (for webhook configuration)

## Step 1: Create Stripe Account

1. Go to https://stripe.com and sign up
2. Complete business verification (can start in test mode)
3. Note your API keys from the Dashboard

## Step 2: Get API Keys

1. Navigate to Developers → API keys in Stripe Dashboard
2. Copy the following keys:
   - **Publishable key** (starts with `pk_test_` for test mode)
   - **Secret key** (starts with `sk_test_` for test mode)
3. Add to your environment variables:
   ```bash
   STRIPE_SECRET_KEY=sk_test_your_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
   ```

## Step 3: Create Products and Prices

### Pro Monthly Subscription

1. Go to Products → Add product
2. Fill in details:
   - **Name:** Pro Monthly
   - **Description:** Unlimited chess game imports and analyses
   - **Pricing:** Recurring, $5.45 USD, Monthly
3. Click "Save product"
4. Copy the Price ID (starts with `price_`)
5. Update database:
   ```sql
   UPDATE payment_tiers
   SET stripe_price_id_monthly = 'price_xxxxx'
   WHERE id = 'pro_monthly';
   ```

### Pro Yearly Subscription

1. Go to Products → Add product
2. Fill in details:
   - **Name:** Pro Yearly
   - **Description:** Unlimited chess game imports and analyses (save 25%)
   - **Pricing:** Recurring, $49.05 USD, Yearly
3. Click "Save product"
4. Copy the Price ID
5. Update database:
   ```sql
   UPDATE payment_tiers
   SET stripe_price_id_yearly = 'price_xxxxx'
   WHERE id = 'pro_yearly';
   ```

### Credit Packages (Optional)

Note: Credit purchases use dynamic prices created at checkout time, so no products need to be pre-created.

## Step 4: Configure Webhooks

Webhooks are critical for keeping subscription status up-to-date.

### Development (Local Testing)

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:8002/api/v1/payments/webhook
   ```
4. Copy the webhook signing secret (starts with `whsec_`)
5. Add to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

### Production

1. Go to Developers → Webhooks in Stripe Dashboard
2. Click "Add endpoint"
3. Enter your endpoint URL:
   ```
   https://your-api-domain.com/api/v1/payments/webhook
   ```
4. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the webhook signing secret
6. Add to production environment variables:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

## Step 5: Test the Integration

### Test Cards

Use these test cards in test mode:

- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **Requires authentication:** 4000 0025 0000 3155

**Expiry:** Any future date
**CVC:** Any 3 digits
**ZIP:** Any 5 digits

### Testing Workflow

1. **Test Subscription Purchase:**
   - Navigate to `/pricing` in your app
   - Click "Upgrade to Pro"
   - Complete checkout with test card
   - Verify subscription status in `/profile`
   - Check Stripe Dashboard for payment

2. **Test Webhook Processing:**
   - Monitor your backend logs during checkout
   - Verify webhook events are received
   - Check database for updated subscription status

3. **Test Subscription Cancellation:**
   - Go to `/profile`
   - Click "Cancel Subscription"
   - Verify cancellation in Stripe Dashboard
   - Check that subscription remains active until period end

## Step 6: Go Live

### Before Going Live

- [ ] Complete Stripe account verification
- [ ] Review and update product descriptions
- [ ] Set up production webhook endpoint
- [ ] Test complete purchase flow in test mode
- [ ] Switch to live API keys
- [ ] Test with real payment (small amount)
- [ ] Set up email notifications for failed payments

### Switch to Live Mode

1. In Stripe Dashboard, toggle from Test to Live mode
2. Get live API keys (start with `pk_live_` and `sk_live_`)
3. Update production environment variables:
   ```bash
   STRIPE_SECRET_KEY=sk_live_your_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
   ```
4. Create webhook endpoint for live mode
5. Update `STRIPE_WEBHOOK_SECRET` with live webhook secret

### Update Price IDs for Live Mode

After creating live products:

```sql
UPDATE payment_tiers
SET
  stripe_price_id_monthly = 'price_live_monthly',
  stripe_price_id_yearly = 'price_live_yearly'
WHERE id IN ('pro_monthly', 'pro_yearly');
```

## Stripe Dashboard Overview

### Key Sections

- **Home:** Overview of recent activity
- **Payments:** View all transactions
- **Customers:** Manage customer records
- **Subscriptions:** View and manage subscriptions
- **Products:** Manage products and pricing
- **Developers:** API keys, webhooks, logs

### Monitoring

- Check webhook delivery logs regularly
- Monitor failed payments
- Review subscription churn rates
- Set up alerts for important events

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook endpoint is publicly accessible
2. Verify webhook secret matches environment variable
3. Check Stripe Dashboard → Webhooks → Event log
4. Review backend logs for errors

### Payment Fails After Checkout

1. Check webhook is processing `checkout.session.completed`
2. Verify database updates in `payment_transactions` table
3. Check logs for errors in `handle_webhook()` function

### Subscription Status Not Updating

1. Ensure webhooks for subscription events are enabled
2. Check `customer.subscription.updated` event is received
3. Verify `authenticated_users` table is being updated

## Security Best Practices

1. **Never expose secret key:** Only use in backend, never in frontend
2. **Verify webhook signatures:** Always validate webhook events
3. **Use HTTPS:** Required for production webhooks
4. **Rotate keys periodically:** Update API keys every 6-12 months
5. **Monitor for suspicious activity:** Review dashboard regularly

## Pricing Recommendations

### Suggested Pricing Structure

- **Free:** $0 - 100 imports/day, 5 analyses/day
- **Pro Monthly:** $5.45 - Unlimited
- **Pro Yearly:** $49.05 - Unlimited (save 25%)
- **Credits:** $10 per 100 analysis credits (one-time purchase)

### A/B Testing

Consider testing different price points:
- Monthly: $4.99, $5.45, or $6.99
- Yearly: $44.99, $49.05, or $54.99

## Support

- Stripe Documentation: https://stripe.com/docs
- API Reference: https://stripe.com/docs/api
- Stripe Support: https://support.stripe.com

## Next Steps

After completing Stripe setup:

1. Configure Supabase email templates
2. Set up customer email notifications
3. Create pricing page in frontend
4. Test complete user flow
5. Monitor initial transactions closely
