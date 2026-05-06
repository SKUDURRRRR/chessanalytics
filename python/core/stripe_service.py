"""
Stripe Payment Service
Handles Stripe integration for subscriptions and credit purchases

Security Features:
- Webhook signature verification
- Input validation
- Secure error handling
"""

import os
import logging
import asyncio
from typing import Dict, Optional, Any
from decimal import Decimal
from datetime import datetime

try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False
    logging.warning("Stripe library not installed. Payment features will be disabled.")

logger = logging.getLogger(__name__)

# Constants for validation
MAX_CREDITS_PURCHASE = 10000  # Maximum credits in a single purchase
MIN_CREDITS_PURCHASE = 100    # Minimum credits purchase
PRICE_PER_100_CREDITS = 1000  # $10.00 in cents


class StripeService:
    """
    Handles Stripe payment integration for subscriptions and credits.
    """

    def __init__(self, supabase_client):
        """
        Initialize Stripe service with security checks.

        Args:
            supabase_client: Supabase client instance (service role)

        Raises:
            ValueError: If supabase_client is None
        """
        if supabase_client is None:
            raise ValueError("Supabase client is required")

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

        # Validate Stripe key format
        if not self._validate_stripe_key(stripe_secret_key):
            logger.error("Invalid STRIPE_SECRET_KEY format")
            self.enabled = False
            return

        stripe.api_key = stripe_secret_key
        self.webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')

        # Warn if webhook secret is missing (critical for production)
        if not self.webhook_secret:
            logger.warning("STRIPE_WEBHOOK_SECRET not configured. Webhook verification disabled.")

        self.enabled = True

        logger.info("Stripe service initialized successfully")

    @staticmethod
    def _validate_stripe_key(key: str) -> bool:
        """
        Validate Stripe API key format.

        Args:
            key: Stripe secret key

        Returns:
            True if valid format, False otherwise
        """
        if not key or not isinstance(key, str):
            return False
        # Stripe keys should start with sk_test_ or sk_live_
        return key.startswith('sk_test_') or key.startswith('sk_live_')

    async def create_checkout_session(
        self,
        user_id: str,
        tier_id: Optional[str] = None,
        credit_amount: Optional[int] = None,
        success_url: str = None,
        cancel_url: str = None
    ) -> Dict:
        """
        Create a Stripe checkout session with input validation.

        Args:
            user_id: User's UUID (required, non-empty)
            tier_id: Payment tier ID (for subscriptions)
            credit_amount: Number of credits to purchase (for one-time payments)
            success_url: URL to redirect after successful payment
            cancel_url: URL to redirect if payment cancelled

        Returns:
            Dictionary with checkout session info

        Raises:
            ValueError: If input validation fails
        """
        if not self.enabled:
            return {'success': False, 'message': 'Stripe not configured'}

        # Input validation
        if not user_id or not isinstance(user_id, str) or not user_id.strip():
            return {'success': False, 'message': 'Valid user_id is required'}

        if not tier_id and not credit_amount:
            return {'success': False, 'message': 'Must specify either tier_id or credit_amount'}

        if tier_id and credit_amount:
            return {'success': False, 'message': 'Cannot specify both tier_id and credit_amount'}

        # Validate credit amount if provided
        if credit_amount is not None:
            if not isinstance(credit_amount, int):
                return {'success': False, 'message': 'credit_amount must be an integer'}
            if credit_amount < MIN_CREDITS_PURCHASE:
                return {'success': False, 'message': f'Minimum credit purchase is {MIN_CREDITS_PURCHASE}'}
            if credit_amount > MAX_CREDITS_PURCHASE:
                return {'success': False, 'message': f'Maximum credit purchase is {MAX_CREDITS_PURCHASE}'}
            if credit_amount % 100 != 0:
                return {'success': False, 'message': 'Credit amount must be a multiple of 100'}

        try:
            # Get or create Stripe customer
            customer_id = await self._get_or_create_customer(user_id)

            if not customer_id:
                return {'success': False, 'message': 'Failed to create Stripe customer'}

            # Determine what to purchase
            line_items = []
            mode = 'payment'
            metadata = {'user_id': user_id}

            if tier_id:
                # Subscription purchase
                tier_result = await asyncio.to_thread(
                    lambda: self.supabase.table('payment_tiers').select(
                        'stripe_price_id_monthly, stripe_price_id_yearly, name'
                    ).eq('id', tier_id).execute()
                )

                if not tier_result.data:
                    return {'success': False, 'message': 'Invalid tier ID'}

                tier = tier_result.data[0]

                # Determine which price ID to use based on tier_id
                if 'yearly' in tier_id.lower():
                    price_id = tier.get('stripe_price_id_yearly')
                    subscription_type = 'yearly'
                else:
                    price_id = tier.get('stripe_price_id_monthly')
                    subscription_type = 'monthly'

                if not price_id:
                    return {'success': False, 'message': f'Stripe price not configured for tier {tier_id}'}

                line_items.append({
                    'price': price_id,
                    'quantity': 1
                })
                mode = 'subscription'
                metadata['tier_id'] = tier_id
                metadata['subscription_type'] = subscription_type

            elif credit_amount:
                # Credit purchase (one-time payment)
                # Calculate price using constant
                total_price = int((credit_amount / 100) * PRICE_PER_100_CREDITS)

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
                return {'success': False, 'message': 'Must specify either tier_id or credit_amount'}

            # Create checkout session
            session = await asyncio.to_thread(
                stripe.checkout.Session.create,
                customer=customer_id,
                payment_method_types=['card'],
                line_items=line_items,
                mode=mode,
                success_url=success_url or f"{os.getenv('VITE_API_URL', 'http://localhost:3000')}/profile?session_id={{CHECKOUT_SESSION_ID}}",
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
            return {'success': False, 'message': str(e)}
        except Exception as e:
            logger.error(f"Error creating checkout session: {e}")
            return {'success': False, 'message': str(e)}

    async def _get_or_create_customer(self, user_id: str) -> Optional[str]:
        """
        Get existing Stripe customer ID or create new one.

        Args:
            user_id: User's UUID

        Returns:
            Stripe customer ID or None
        """
        try:
            # Use the database function to get user info including email
            # This function joins authenticated_users with auth.users
            try:
                user_result = await asyncio.to_thread(
                    lambda: self.supabase.rpc(
                        'get_user_with_email',
                        {'p_user_id': user_id}
                    ).execute()
                )

                if not user_result.data or len(user_result.data) == 0:
                    logger.error(f"User {user_id} not found in database (via get_user_with_email function)")
                    return None

                user = user_result.data[0]
            except Exception as rpc_error:
                # Fallback: try direct query if RPC fails
                logger.warning(f"RPC call failed, trying fallback method: {rpc_error}")
                # Only select columns that definitely exist (not username)
                user_result = await asyncio.to_thread(
                    lambda: self.supabase.table('authenticated_users').select(
                        'stripe_customer_id'
                    ).eq('id', user_id).execute()
                )

                if not user_result.data:
                    logger.error(f"User {user_id} not found in database (fallback method)")
                    return None

                user = user_result.data[0]
                # Try to get email using admin API as fallback
                try:
                    auth_result = self.supabase.auth.admin.get_user_by_id(user_id)
                    email = auth_result.user.email if auth_result and auth_result.user else None
                    if email:
                        user['email'] = email
                except Exception as email_error:
                    logger.warning(f"Could not get email via admin API: {email_error}")
                    user['email'] = None
                # Username doesn't exist in schema, set to None
                user['username'] = None

            # Check if user already has a Stripe customer ID
            if user.get('stripe_customer_id'):
                logger.info(f"Found existing Stripe customer {user['stripe_customer_id']} for user {user_id}")
                return user['stripe_customer_id']

            # Get email from the function result
            email = user.get('email')

            # Create new Stripe customer with email
            customer_data = {
                'metadata': {'user_id': user_id}
            }

            # Add email if available
            if email:
                customer_data['email'] = email
            else:
                logger.warning(f"No email found for user {user_id}, creating Stripe customer without email")

            # Add name if available (username may not exist in schema)
            username = user.get('username')
            if username:
                customer_data['name'] = username
            elif email:
                customer_data['name'] = email
            else:
                customer_data['name'] = f'User {user_id[:8]}'

            # Create Stripe customer
            try:
                customer = await asyncio.to_thread(
                    stripe.Customer.create,
                    **customer_data
                )
                logger.info(f"Created Stripe customer {customer.id} for user {user_id}")
            except stripe.error.StripeError as e:
                logger.error(f"Stripe API error creating customer: {e}")
                return None
            except Exception as e:
                logger.error(f"Unexpected error creating Stripe customer: {e}")
                return None

            # Save customer ID to database
            try:
                await asyncio.to_thread(
                    lambda: self.supabase.table('authenticated_users').update({
                        'stripe_customer_id': customer.id
                    }).eq('id', user_id).execute()
                )
                logger.info(f"Saved Stripe customer ID {customer.id} to database for user {user_id}")
            except Exception as e:
                logger.error(f"Error saving Stripe customer ID to database: {e}")
                # Customer was created in Stripe, so we can still return it
                # The ID will be saved on next attempt

            return customer.id

        except Exception as e:
            logger.error(f"Error getting/creating Stripe customer: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
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
            return {'success': False, 'message': 'Stripe not configured'}

        if not self.webhook_secret:
            logger.error("Stripe webhook secret not configured")
            return {'success': False, 'message': 'Webhook secret not configured'}

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
        except ValueError as e:
            logger.error(f"Invalid webhook payload: {e}")
            return {'success': False, 'message': 'Invalid payload'}
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {e}")
            return {'success': False, 'message': 'Invalid signature'}

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
            return {'success': False, 'message': str(e)}

    async def _handle_checkout_completed(self, session):
        """Handle successful checkout session completion."""
        customer_id = session.get('customer')
        metadata = session.get('metadata', {})
        user_id = metadata.get('user_id')

        if not user_id:
            logger.error("No user_id in checkout session metadata")
            return

        payment_intent = session.get('payment_intent')

        # IDEMPOTENCY CHECK: Prevent double-crediting on webhook retries
        # This MUST be done BEFORE granting credits/subscription to prevent duplicate processing
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

        # Record transaction
        amount = session.get('amount_total', 0) / 100  # Convert cents to dollars

        transaction_data = {
            'user_id': user_id,
            'stripe_payment_id': payment_intent,
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
        await asyncio.to_thread(
            lambda: self.supabase.table('payment_transactions').insert(transaction_data).execute()
        )

        logger.info(f"Checkout completed for user {user_id}")

    async def _handle_invoice_paid(self, invoice):
        """Handle successful invoice payment (recurring subscriptions)."""
        customer_id = invoice.get('customer')
        subscription_id = invoice.get('subscription')
        payment_intent = invoice.get('payment_intent')

        # IDEMPOTENCY CHECK: Prevent duplicate transaction records on webhook retries
        existing = await asyncio.to_thread(
            lambda: self.supabase.table('payment_transactions').select('id').eq(
                'stripe_payment_id', payment_intent
            ).execute()
        )

        if existing.data:
            logger.info(
                f"Skipping duplicate invoice.paid for payment_intent {payment_intent} - already processed"
            )
            return  # Idempotent - safe to return success

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

    async def _handle_payment_failed(self, invoice):
        """Handle failed payment."""
        customer_id = invoice.get('customer')

        user_result = await asyncio.to_thread(
            lambda: self.supabase.table('authenticated_users').select('id').eq(
                'stripe_customer_id', customer_id
            ).execute()
        )

        if user_result.data:
            user_id = user_result.data[0]['id']
            logger.warning(f"Payment failed for user {user_id}")

            # Could send notification email here

    async def _handle_subscription_updated(self, subscription):
        """Handle subscription update (e.g., plan change, cancellation)."""
        customer_id = subscription.get('customer')
        status = subscription.get('status')
        cancel_at_period_end = subscription.get('cancel_at_period_end', False)

        user_result = await asyncio.to_thread(
            lambda: self.supabase.table('authenticated_users').select('id').eq(
                'stripe_customer_id', customer_id
            ).execute()
        )

        if user_result.data:
            user_id = user_result.data[0]['id']

            # Prepare update data
            # IMPORTANT: Don't flip to 'cancelled' while subscription is still active
            # Stripe keeps status as 'active' until billing period ends even when cancel_at_period_end=True
            # Only mark as cancelled when Stripe actually cancels it (status='canceled')
            update_data = {
                'subscription_status': status,  # Use actual Stripe status
                'stripe_subscription_id': subscription.get('id')
            }

            # If subscription is cancelled or will be cancelled, set end date
            if cancel_at_period_end or status == 'canceled':
                current_period_end = subscription.get('current_period_end')
                if current_period_end:
                    from datetime import datetime, timezone
                    end_date = datetime.fromtimestamp(current_period_end, tz=timezone.utc)
                    update_data['subscription_end_date'] = end_date.isoformat()

            # Update subscription status and end date
            await asyncio.to_thread(
                lambda: self.supabase.table('authenticated_users').update(update_data).eq('id', user_id).execute()
            )

            logger.info(f"Subscription updated for user {user_id}: {status}, cancel_at_period_end={cancel_at_period_end}")

    async def _handle_subscription_deleted(self, subscription):
        """Handle subscription cancellation."""
        customer_id = subscription.get('customer')

        user_result = await asyncio.to_thread(
            lambda: self.supabase.table('authenticated_users').select('id').eq(
                'stripe_customer_id', customer_id
            ).execute()
        )

        if user_result.data:
            user_id = user_result.data[0]['id']

            # Downgrade to free tier
            await asyncio.to_thread(
                lambda: self.supabase.table('authenticated_users').update({
                    'account_tier': 'free',
                    'subscription_status': 'cancelled',
                    'stripe_subscription_id': None
                }).eq('id', user_id).execute()
            )

            logger.info(f"Subscription cancelled for user {user_id}, downgraded to free")

    async def _update_user_subscription(self, user_id: str, tier_id: str, subscription_id: str):
        """Update user's subscription tier."""
        await asyncio.to_thread(
            lambda: self.supabase.table('authenticated_users').update({
                'account_tier': tier_id,  # Keep tier_id as-is (e.g., 'pro_monthly', 'pro_yearly')
                'subscription_status': 'active',
                'stripe_subscription_id': subscription_id
            }).eq('id', user_id).execute()
        )

        logger.info(f"Updated subscription for user {user_id} to tier {tier_id}")

    async def _add_user_credits(self, user_id: str, credits: int):
        """Add credits to user account."""
        # Check if user has existing credits
        existing = await asyncio.to_thread(
            lambda: self.supabase.table('user_credits').select('*').eq(
                'user_id', user_id
            ).execute()
        )

        if existing.data:
            # Update existing
            credit_record = existing.data[0]
            new_remaining = credit_record['credits_remaining'] + credits
            new_total = credit_record['credits_total'] + credits

            await asyncio.to_thread(
                lambda: self.supabase.table('user_credits').update({
                    'credits_remaining': new_remaining,
                    'credits_total': new_total
                }).eq('id', credit_record['id']).execute()
            )
        else:
            # Create new
            await asyncio.to_thread(
                lambda: self.supabase.table('user_credits').insert({
                    'user_id': user_id,
                    'credits_remaining': credits,
                    'credits_total': credits
                }).execute()
            )

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
            return {'success': False, 'message': 'Stripe not configured'}

        try:
            # Get user's subscription info
            user_result = await asyncio.to_thread(
                lambda: self.supabase.table('authenticated_users').select(
                    'stripe_subscription_id, stripe_customer_id, account_tier'
                ).eq('id', user_id).execute()
            )

            if not user_result.data:
                return {'success': False, 'message': 'User not found'}

            user = user_result.data[0]
            subscription_id = user.get('stripe_subscription_id')
            customer_id = user.get('stripe_customer_id')
            account_tier = user.get('account_tier')

            # Check if user has a paid tier but no subscription_id (manually upgraded)
            if not subscription_id and account_tier in ['pro_monthly', 'pro_yearly', 'pro']:
                # Try to find subscription from Stripe using customer_id
                if customer_id:
                    try:
                        subscriptions = await asyncio.to_thread(
                            stripe.Subscription.list,
                            customer=customer_id,
                            status='active',
                            limit=1
                        )

                        if subscriptions.data:
                            subscription_id = subscriptions.data[0].id
                            # Update the database with the found subscription_id
                            await asyncio.to_thread(
                                lambda: self.supabase.table('authenticated_users').update({
                                    'stripe_subscription_id': subscription_id
                                }).eq('id', user_id).execute()
                            )
                            logger.info(f"Found and stored subscription_id {subscription_id} for user {user_id}")
                    except Exception as e:
                        logger.warning(f"Could not find subscription from Stripe: {e}")

            if not subscription_id:
                # If still no subscription_id, user might have been manually upgraded
                # Just downgrade them to free tier
                await asyncio.to_thread(
                    lambda: self.supabase.table('authenticated_users').update({
                        'account_tier': 'free',
                        'subscription_status': 'cancelled',
                        'subscription_end_date': None
                    }).eq('id', user_id).execute()
                )

                return {
                    'success': True,
                    'message': 'Subscription cancelled and downgraded to free tier'
                }

            # Cancel at period end (let them use until billing cycle ends)
            subscription = await asyncio.to_thread(
                stripe.Subscription.modify,
                subscription_id,
                cancel_at_period_end=True
            )

            # Set subscription_end_date from Stripe's current_period_end
            # Set status to 'cancelled' immediately so the UI can reflect the cancellation
            # User keeps access until the end date, then webhook downgrades to free
            update_data = {
                'subscription_status': 'cancelled'
            }
            if hasattr(subscription, 'current_period_end') and subscription.current_period_end:
                from datetime import datetime, timezone
                end_date = datetime.fromtimestamp(subscription.current_period_end, tz=timezone.utc)
                update_data['subscription_end_date'] = end_date.isoformat()

            await asyncio.to_thread(
                lambda: self.supabase.table('authenticated_users').update(update_data).eq('id', user_id).execute()
            )

            return {
                'success': True,
                'message': 'Subscription will be cancelled at the end of the billing period',
                'cancel_at': subscription.cancel_at
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error cancelling subscription: {e}")
            return {'success': False, 'message': str(e)}
        except Exception as e:
            logger.error(f"Error cancelling subscription: {e}")
            return {'success': False, 'message': str(e)}

    async def get_subscription_status(self, user_id: str) -> Dict:
        """
        Get user's current subscription status.

        Args:
            user_id: User's UUID

        Returns:
            Dictionary with subscription details
        """
        try:
            user_result = await asyncio.to_thread(
                lambda: self.supabase.table('authenticated_users').select(
                    'account_tier, subscription_status, stripe_subscription_id, subscription_end_date'
                ).eq('id', user_id).execute()
            )

            if not user_result.data:
                return {'success': False, 'message': 'User not found'}

            user = user_result.data[0]

            return {
                'success': True,
                'account_tier': user['account_tier'],
                'subscription_status': user['subscription_status'],
                'subscription_id': user.get('stripe_subscription_id'),
                'subscription_end_date': user.get('subscription_end_date')
            }

        except Exception as e:
            logger.error(f"Error getting subscription status: {e}")
            return {'success': False, 'message': str(e)}

    async def verify_and_sync_session(self, user_id: str, session_id: str) -> Dict:
        """
        Verify a Stripe checkout session and sync the user's subscription.
        This is used when returning from Stripe checkout to ensure the subscription is updated
        even if webhooks haven't been processed yet (e.g., on localhost).

        Args:
            user_id: User's UUID
            session_id: Stripe checkout session ID

        Returns:
            Dictionary with verification result
        """
        if not self.enabled:
            return {'success': False, 'message': 'Stripe not configured'}

        try:
            # Retrieve the session from Stripe
            session = await asyncio.to_thread(
                stripe.checkout.Session.retrieve,
                session_id,
                expand=['subscription']
            )

            # Verify the session belongs to this user
            metadata = session.get('metadata', {})
            session_user_id = metadata.get('user_id')

            if session_user_id != user_id:
                logger.error(f"Session user mismatch: expected {user_id}, got {session_user_id}")
                return {'success': False, 'message': 'Session does not belong to this user'}

            # Check payment status
            payment_status = session.get('payment_status')
            if payment_status != 'paid':
                return {
                    'success': False,
                    'message': f'Payment not completed. Status: {payment_status}'
                }

            # Process based on what was purchased
            tier_id = metadata.get('tier_id')
            credits_purchased = metadata.get('credits_purchased')

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

            if tier_id:
                # Subscription purchase - update the user's tier
                subscription_id = session.get('subscription')
                if isinstance(subscription_id, dict):
                    subscription_id = subscription_id.get('id')

                await self._update_user_subscription(user_id, tier_id, subscription_id)

                # Record transaction
                amount = session.get('amount_total', 0) / 100
                await asyncio.to_thread(
                    lambda: self.supabase.table('payment_transactions').insert({
                        'user_id': user_id,
                        'stripe_payment_id': session.get('payment_intent'),
                        'amount': str(amount),
                        'currency': session.get('currency', 'usd'),
                        'status': 'succeeded',
                        'transaction_type': 'subscription',
                        'tier_id': tier_id,
                        'metadata': metadata
                    }).execute()
                )

                logger.info(f"Verified and synced subscription for user {user_id}, tier {tier_id}")
                return {
                    'success': True,
                    'message': 'Subscription activated successfully',
                    'tier_id': tier_id
                }

            elif credits_purchased:
                # Credit purchase - add credits (only after confirming transaction doesn't exist)
                await self._add_user_credits(user_id, int(credits_purchased))

                # Record transaction
                amount = session.get('amount_total', 0) / 100
                await asyncio.to_thread(
                    lambda: self.supabase.table('payment_transactions').insert({
                        'user_id': user_id,
                        'stripe_payment_id': session.get('payment_intent'),
                        'amount': str(amount),
                        'currency': session.get('currency', 'usd'),
                        'status': 'succeeded',
                        'transaction_type': 'credits',
                        'credits_purchased': int(credits_purchased),
                        'metadata': metadata
                    }).execute()
                )

                logger.info(f"Verified and synced credits for user {user_id}, amount {credits_purchased}")
                return {
                    'success': True,
                    'message': f'{credits_purchased} credits added successfully',
                    'credits_added': int(credits_purchased)
                }

            else:
                return {'success': False, 'message': 'Unknown purchase type'}

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error verifying session: {e}")
            return {'success': False, 'message': str(e)}
        except Exception as e:
            logger.error(f"Error verifying session: {e}")
            return {'success': False, 'message': str(e)}
