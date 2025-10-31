"""
Fix subscription_status for cancelled subscriptions.

This script checks all users with active Pro subscriptions in Stripe
and updates the database if their subscription has cancel_at_period_end=True
but subscription_status is not 'cancelled' in the database.

Run this once to fix existing data.
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from core.stripe_service import StripeService
from core.parallel_analysis_engine import get_supabase_client
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def fix_cancelled_subscriptions():
    """Check and fix subscription_status for all users with cancelled subscriptions."""

    try:
        # Initialize services
        supabase = get_supabase_client()
        stripe_service = StripeService(supabase)

        if not stripe_service.enabled:
            logger.error("Stripe service is not enabled. Check your STRIPE_SECRET_KEY environment variable.")
            return

        # Get all users with Pro subscriptions that are not already marked as cancelled
        result = await asyncio.to_thread(
            lambda: supabase.table('authenticated_users')
            .select('id, email, account_tier, subscription_status, stripe_subscription_id, stripe_customer_id')
            .in_('account_tier', ['pro_monthly', 'pro_yearly', 'pro'])
            .neq('subscription_status', 'cancelled')
            .execute()
        )

        users = result.data
        logger.info(f"Found {len(users)} users with Pro subscriptions that are not marked as cancelled")

        fixed_count = 0
        for user in users:
            user_id = user['id']
            subscription_id = user.get('stripe_subscription_id')

            if not subscription_id:
                logger.warning(f"User {user_id} ({user.get('email')}) has no stripe_subscription_id")
                continue

            try:
                # Check Stripe subscription status
                import stripe
                subscription = await asyncio.to_thread(
                    stripe.Subscription.retrieve,
                    subscription_id
                )

                # Check if subscription is set to cancel at period end
                if subscription.cancel_at_period_end:
                    logger.info(f"Fixing user {user_id} ({user.get('email')}) - subscription is cancelled in Stripe")

                    # Update database
                    from datetime import datetime, timezone
                    end_date = datetime.fromtimestamp(subscription.current_period_end, tz=timezone.utc)

                    await asyncio.to_thread(
                        lambda: supabase.table('authenticated_users').update({
                            'subscription_status': 'cancelled',
                            'subscription_end_date': end_date.isoformat()
                        }).eq('id', user_id).execute()
                    )

                    fixed_count += 1
                    logger.info(f"✓ Fixed user {user_id} - set status to 'cancelled' and end_date to {end_date.date()}")
                else:
                    logger.debug(f"User {user_id} ({user.get('email')}) subscription is active (not cancelled)")

            except stripe.error.StripeError as e:
                logger.error(f"Stripe error for user {user_id}: {e}")
            except Exception as e:
                logger.error(f"Error processing user {user_id}: {e}")

        logger.info(f"\n{'='*60}")
        logger.info(f"✓ Fixed {fixed_count} users with cancelled subscriptions")
        logger.info(f"{'='*60}\n")

    except Exception as e:
        logger.error(f"Error in fix_cancelled_subscriptions: {e}")
        raise


if __name__ == '__main__':
    asyncio.run(fix_cancelled_subscriptions())
