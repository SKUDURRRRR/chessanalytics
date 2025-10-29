"""
Stripe Payment Service
Handles Stripe integration for subscriptions and credit purchases
"""

import os
import logging
from typing import Dict, Optional
from decimal import Decimal

try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False
    logging.warning("Stripe library not installed. Payment features will be disabled.")

logger = logging.getLogger(__name__)


class StripeService:
    """
    Handles Stripe payment integration for subscriptions and credits.
    """

    def __init__(self, supabase_client):
        """
        Initialize Stripe service.

        Args:
            supabase_client: Supabase client instance (service role)
        """
        self.supabase = supabase_client

        if not STRIPE_AVAILABLE:
            logger.error("Stripe library not available")
            self.enabled = False
            return

        # Get Stripe API key from environment
        stripe_secret_key = os.getenv('STRIPE_SECRET_KEY')

        if not stripe_secret_key:
            logger.warning("STRIPE_SECRET_KEY not configured. Payment features disabled.")
            self.enabled = False
            return

        stripe.api_key = stripe_secret_key
        self.webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
        self.enabled = True

        logger.info("Stripe service initialized successfully")

    async def create_checkout_session(
        self,
        user_id: str,
        tier_id: Optional[str] = None,
        credit_amount: Optional[int] = None,
        success_url: str = None,
        cancel_url: str = None
    ) -> Dict:
        """
        Create a Stripe checkout session.

        Args:
            user_id: User's UUID
            tier_id: Payment tier ID (for subscriptions)
            credit_amount: Number of credits to purchase (for one-time payments)
            success_url: URL to redirect after successful payment
            cancel_url: URL to redirect if payment cancelled

        Returns:
            Dictionary with checkout session info
        """
        if not self.enabled:
            return {'error': 'Stripe not configured'}

        try:
            # Get or create Stripe customer
            customer_id = await self._get_or_create_customer(user_id)

            if not customer_id:
                return {'error': 'Failed to create Stripe customer'}

            # Determine what to purchase
            line_items = []
            mode = 'payment'
            metadata = {'user_id': user_id}

            if tier_id:
                # Subscription purchase
                tier_result = self.supabase.table('payment_tiers').select(
                    'stripe_price_id_monthly, stripe_price_id_yearly, name'
                ).eq('id', tier_id).execute()

                if not tier_result.data:
                    return {'error': 'Invalid tier ID'}

                tier = tier_result.data[0]

                # Determine which price ID to use (monthly vs yearly)
                # For now, default to monthly
                price_id = tier.get('stripe_price_id_monthly')

                if not price_id:
                    return {'error': f'Stripe price not configured for tier {tier_id}'}

                line_items.append({
                    'price': price_id,
                    'quantity': 1
                })
                mode = 'subscription'
                metadata['tier_id'] = tier_id
                metadata['subscription_type'] = 'monthly'

            elif credit_amount:
                # Credit purchase (one-time payment)
                # Calculate price: $10 per 100 credits
                price_per_100 = 1000  # $10.00 in cents
                total_price = int((credit_amount / 100) * price_per_100)

                line_items.append({
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': f'{credit_amount} Analysis Credits',
                            'description': f'One-time purchase of {credit_amount} analysis credits'
                        },
                        'unit_amount': total_price
                    },
                    'quantity': 1
                })
                metadata['credits_purchased'] = str(credit_amount)
            else:
                return {'error': 'Must specify either tier_id or credit_amount'}

            # Create checkout session
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=['card'],
                line_items=line_items,
                mode=mode,
                success_url=success_url or f"{os.getenv('VITE_API_URL', 'http://localhost:3000')}/profile?payment=success",
                cancel_url=cancel_url or f"{os.getenv('VITE_API_URL', 'http://localhost:3000')}/pricing?payment=cancelled",
                metadata=metadata,
                allow_promotion_codes=True
            )

            return {
                'success': True,
                'session_id': session.id,
                'url': session.url
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating checkout session: {e}")
            return {'error': str(e)}
        except Exception as e:
            logger.error(f"Error creating checkout session: {e}")
            return {'error': str(e)}

    async def _get_or_create_customer(self, user_id: str) -> Optional[str]:
        """
        Get existing Stripe customer ID or create new one.

        Args:
            user_id: User's UUID

        Returns:
            Stripe customer ID or None
        """
        try:
            # Check if user already has Stripe customer ID
            user_result = self.supabase.table('authenticated_users').select(
                'stripe_customer_id, username'
            ).eq('id', user_id).execute()

            if not user_result.data:
                logger.error(f"User {user_id} not found")
                return None

            user = user_result.data[0]

            if user.get('stripe_customer_id'):
                return user['stripe_customer_id']

            # Create new Stripe customer
            customer = stripe.Customer.create(
                metadata={'user_id': user_id},
                name=user.get('username', f'User {user_id[:8]}')
            )

            # Save customer ID to database
            self.supabase.table('authenticated_users').update({
                'stripe_customer_id': customer.id
            }).eq('id', user_id).execute()

            logger.info(f"Created Stripe customer {customer.id} for user {user_id}")
            return customer.id

        except Exception as e:
            logger.error(f"Error getting/creating Stripe customer: {e}")
            return None

    async def handle_webhook(self, payload: bytes, sig_header: str) -> Dict:
        """
        Handle Stripe webhook events.

        Args:
            payload: Raw webhook payload
            sig_header: Stripe signature header

        Returns:
            Dictionary with processing result
        """
        if not self.enabled:
            return {'error': 'Stripe not configured'}

        if not self.webhook_secret:
            logger.error("Stripe webhook secret not configured")
            return {'error': 'Webhook secret not configured'}

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
        except ValueError as e:
            logger.error(f"Invalid webhook payload: {e}")
            return {'error': 'Invalid payload'}
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {e}")
            return {'error': 'Invalid signature'}

        # Handle the event
        event_type = event['type']
        data = event['data']['object']

        logger.info(f"Received Stripe webhook: {event_type}")

        try:
            if event_type == 'checkout.session.completed':
                await self._handle_checkout_completed(data)

            elif event_type == 'invoice.paid':
                await self._handle_invoice_paid(data)

            elif event_type == 'invoice.payment_failed':
                await self._handle_payment_failed(data)

            elif event_type == 'customer.subscription.updated':
                await self._handle_subscription_updated(data)

            elif event_type == 'customer.subscription.deleted':
                await self._handle_subscription_deleted(data)

            else:
                logger.info(f"Unhandled webhook event type: {event_type}")

            return {'success': True}

        except Exception as e:
            logger.error(f"Error processing webhook {event_type}: {e}")
            return {'error': str(e)}

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
            # Subscription purchase
            transaction_data['transaction_type'] = 'subscription'
            transaction_data['tier_id'] = metadata['tier_id']

            # Update user's subscription
            subscription_id = session.get('subscription')
            await self._update_user_subscription(user_id, metadata['tier_id'], subscription_id)

        elif 'credits_purchased' in metadata:
            # Credit purchase
            transaction_data['transaction_type'] = 'credits'
            transaction_data['credits_purchased'] = int(metadata['credits_purchased'])

            # Add credits to user account
            await self._add_user_credits(user_id, int(metadata['credits_purchased']))

        # Save transaction
        self.supabase.table('payment_transactions').insert(transaction_data).execute()

        logger.info(f"Checkout completed for user {user_id}")

    async def _handle_invoice_paid(self, invoice):
        """Handle successful invoice payment (recurring subscriptions)."""
        customer_id = invoice.get('customer')
        subscription_id = invoice.get('subscription')

        # Get user from customer ID
        user_result = self.supabase.table('authenticated_users').select('id').eq(
            'stripe_customer_id', customer_id
        ).execute()

        if not user_result.data:
            logger.error(f"User not found for Stripe customer {customer_id}")
            return

        user_id = user_result.data[0]['id']

        # Record transaction
        amount = invoice.get('amount_paid', 0) / 100

        self.supabase.table('payment_transactions').insert({
            'user_id': user_id,
            'stripe_payment_id': invoice.get('payment_intent'),
            'stripe_invoice_id': invoice.get('id'),
            'amount': str(amount),
            'currency': invoice.get('currency', 'usd'),
            'status': 'succeeded',
            'transaction_type': 'subscription'
        }).execute()

        logger.info(f"Invoice paid for user {user_id}")

    async def _handle_payment_failed(self, invoice):
        """Handle failed payment."""
        customer_id = invoice.get('customer')

        user_result = self.supabase.table('authenticated_users').select('id').eq(
            'stripe_customer_id', customer_id
        ).execute()

        if user_result.data:
            user_id = user_result.data[0]['id']
            logger.warning(f"Payment failed for user {user_id}")

            # Could send notification email here

    async def _handle_subscription_updated(self, subscription):
        """Handle subscription update (e.g., plan change)."""
        customer_id = subscription.get('customer')
        status = subscription.get('status')

        user_result = self.supabase.table('authenticated_users').select('id').eq(
            'stripe_customer_id', customer_id
        ).execute()

        if user_result.data:
            user_id = user_result.data[0]['id']

            # Update subscription status
            self.supabase.table('authenticated_users').update({
                'subscription_status': status,
                'stripe_subscription_id': subscription.get('id')
            }).eq('id', user_id).execute()

            logger.info(f"Subscription updated for user {user_id}: {status}")

    async def _handle_subscription_deleted(self, subscription):
        """Handle subscription cancellation."""
        customer_id = subscription.get('customer')

        user_result = self.supabase.table('authenticated_users').select('id').eq(
            'stripe_customer_id', customer_id
        ).execute()

        if user_result.data:
            user_id = user_result.data[0]['id']

            # Downgrade to free tier
            self.supabase.table('authenticated_users').update({
                'account_tier': 'free',
                'subscription_status': 'cancelled',
                'stripe_subscription_id': None
            }).eq('id', user_id).execute()

            logger.info(f"Subscription cancelled for user {user_id}, downgraded to free")

    async def _update_user_subscription(self, user_id: str, tier_id: str, subscription_id: str):
        """Update user's subscription tier."""
        self.supabase.table('authenticated_users').update({
            'account_tier': tier_id.replace('_monthly', '').replace('_yearly', ''),
            'subscription_status': 'active',
            'stripe_subscription_id': subscription_id
        }).eq('id', user_id).execute()

        logger.info(f"Updated subscription for user {user_id} to tier {tier_id}")

    async def _add_user_credits(self, user_id: str, credits: int):
        """Add credits to user account."""
        # Check if user has existing credits
        existing = self.supabase.table('user_credits').select('*').eq(
            'user_id', user_id
        ).execute()

        if existing.data:
            # Update existing
            credit_record = existing.data[0]
            new_remaining = credit_record['credits_remaining'] + credits
            new_total = credit_record['credits_total'] + credits

            self.supabase.table('user_credits').update({
                'credits_remaining': new_remaining,
                'credits_total': new_total
            }).eq('id', credit_record['id']).execute()
        else:
            # Create new
            self.supabase.table('user_credits').insert({
                'user_id': user_id,
                'credits_remaining': credits,
                'credits_total': credits
            }).execute()

        logger.info(f"Added {credits} credits to user {user_id}")

    async def cancel_subscription(self, user_id: str) -> Dict:
        """
        Cancel user's subscription.

        Args:
            user_id: User's UUID

        Returns:
            Dictionary with cancellation result
        """
        if not self.enabled:
            return {'error': 'Stripe not configured'}

        try:
            # Get user's subscription ID
            user_result = self.supabase.table('authenticated_users').select(
                'stripe_subscription_id'
            ).eq('id', user_id).execute()

            if not user_result.data:
                return {'error': 'User not found'}

            subscription_id = user_result.data[0].get('stripe_subscription_id')

            if not subscription_id:
                return {'error': 'No active subscription'}

            # Cancel at period end (let them use until billing cycle ends)
            subscription = stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True
            )

            # Update database
            self.supabase.table('authenticated_users').update({
                'subscription_status': 'cancelled'
            }).eq('id', user_id).execute()

            return {
                'success': True,
                'message': 'Subscription will be cancelled at the end of the billing period',
                'cancel_at': subscription.cancel_at
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error cancelling subscription: {e}")
            return {'error': str(e)}
        except Exception as e:
            logger.error(f"Error cancelling subscription: {e}")
            return {'error': str(e)}

    async def get_subscription_status(self, user_id: str) -> Dict:
        """
        Get user's current subscription status.

        Args:
            user_id: User's UUID

        Returns:
            Dictionary with subscription details
        """
        try:
            user_result = self.supabase.table('authenticated_users').select(
                'account_tier, subscription_status, stripe_subscription_id, subscription_end_date'
            ).eq('id', user_id).execute()

            if not user_result.data:
                return {'error': 'User not found'}

            user = user_result.data[0]

            return {
                'account_tier': user['account_tier'],
                'subscription_status': user['subscription_status'],
                'subscription_id': user.get('stripe_subscription_id'),
                'subscription_end_date': user.get('subscription_end_date')
            }

        except Exception as e:
            logger.error(f"Error getting subscription status: {e}")
            return {'error': str(e)}
