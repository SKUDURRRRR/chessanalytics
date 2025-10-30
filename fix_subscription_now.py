#!/usr/bin/env python3
"""
Manual script to fix a user's subscription by syncing from Stripe.
This is useful when webhooks aren't working (e.g., on localhost).
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path to import our modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import stripe
    from supabase import create_client
except ImportError as e:
    print(f"Error: Missing required library: {e}")
    print("Please install: pip install stripe supabase python-dotenv")
    sys.exit(1)


async def fix_user_subscription(user_email: str):
    """
    Find and sync a user's subscription from Stripe.

    Args:
        user_email: User's email address
    """
    # Initialize Stripe
    stripe_key = os.getenv('STRIPE_SECRET_KEY')
    if not stripe_key:
        print("Error: STRIPE_SECRET_KEY not found in environment")
        return False

    stripe.api_key = stripe_key

    # Initialize Supabase
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_service_key:
        print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment")
        return False

    supabase = create_client(supabase_url, supabase_service_key)

    print(f"\n[*] Searching for user with email: {user_email}")

    # Get user from Supabase auth
    try:
        # First, get the user ID from authenticated_users by joining with auth.users
        # We'll use a function to get user by email
        result = supabase.rpc('get_user_by_email_admin', {'user_email': user_email}).execute()

        if not result.data:
            print(f"[X] User not found with email: {user_email}")
            return False

        user_id = result.data[0]['id']
        print(f"[OK] Found user ID: {user_id}")

    except Exception as e:
        print(f"Error getting user: {e}")
        print("\nTrying alternative method...")

        # Alternative: Get from authenticated_users table
        result = supabase.table('authenticated_users').select('id, stripe_customer_id, account_tier').execute()

        # We'll need to match by email from auth.users
        # For now, let's just show all users and let the user pick
        if result.data:
            print("\n[LIST] Available users:")
            for i, user in enumerate(result.data):
                print(f"{i+1}. ID: {user['id'][:8]}... | Tier: {user.get('account_tier', 'N/A')} | Customer: {user.get('stripe_customer_id', 'N/A')}")

            choice = input("\nEnter the number of the user to fix (or 0 to cancel): ")
            try:
                choice_idx = int(choice) - 1
                if choice_idx < 0 or choice_idx >= len(result.data):
                    print("Invalid choice")
                    return False
                user_id = result.data[choice_idx]['id']
            except ValueError:
                print("Invalid input")
                return False
        else:
            print("No users found")
            return False

    # Get user details
    user_result = supabase.table('authenticated_users').select(
        'id, stripe_customer_id, account_tier, subscription_status'
    ).eq('id', user_id).execute()

    if not user_result.data:
        print(f"[X] User not found in authenticated_users table")
        return False

    user = user_result.data[0]
    print(f"\n[INFO] Current user status:")
    print(f"   Account Tier: {user.get('account_tier', 'N/A')}")
    print(f"   Subscription Status: {user.get('subscription_status', 'N/A')}")
    print(f"   Stripe Customer ID: {user.get('stripe_customer_id', 'N/A')}")

    customer_id = user.get('stripe_customer_id')

    if not customer_id:
        print("\n[!] No Stripe customer ID found. User may not have made any purchases yet.")
        return False

    # Search for active subscriptions in Stripe
    print(f"\n[*] Searching Stripe for active subscriptions...")

    try:
        subscriptions = stripe.Subscription.list(
            customer=customer_id,
            status='active',
            limit=10
        )

        if not subscriptions.data:
            # Check for trialing subscriptions
            subscriptions = stripe.Subscription.list(
                customer=customer_id,
                status='trialing',
                limit=10
            )

        if not subscriptions.data:
            print("[X] No active subscriptions found in Stripe")

            # Check recent checkout sessions
            print("\n[*] Checking recent checkout sessions...")
            sessions = stripe.checkout.Session.list(
                customer=customer_id,
                limit=10
            )

            if sessions.data:
                print(f"\n[LIST] Found {len(sessions.data)} recent checkout session(s):")
                for i, session in enumerate(sessions.data):
                    print(f"\n{i+1}. Session ID: {session.id}")
                    print(f"   Payment Status: {session.payment_status}")
                    print(f"   Status: {session.status}")
                    # Handle None values for incomplete/open sessions
                    if session.amount_total is not None and session.currency:
                        amount_display = f"${session.amount_total/100:.2f} {session.currency.upper()}"
                    else:
                        amount_display = "N/A"
                    print(f"   Amount: {amount_display}")
                    print(f"   Created: {session.created}")

                    if session.subscription:
                        print(f"   Subscription ID: {session.subscription}")

                choice = input("\n[?] Enter the session number to sync (or 0 to skip): ")
                try:
                    choice_idx = int(choice) - 1
                    if 0 <= choice_idx < len(sessions.data):
                        session = sessions.data[choice_idx]

                        if session.payment_status == 'paid' and session.subscription:
                            # Sync this subscription
                            subscription_id = session.subscription

                            # Fetch the subscription to get its actual status
                            subscription = stripe.Subscription.retrieve(subscription_id)

                            metadata_obj = session.get('metadata', {})
                            if hasattr(metadata_obj, 'to_dict'):
                                metadata = metadata_obj.to_dict()
                            elif isinstance(metadata_obj, dict):
                                metadata = metadata_obj
                            else:
                                metadata = {}

                            # NOTE: This is a manual recovery script, not production code.
                            # The default 'pro_monthly' is a safe fallback for older sessions that may
                            # lack metadata. Production webhook handlers in stripe_service.py don't use
                            # defaults - they only process subscriptions when tier_id is explicitly present.
                            tier_id = metadata.get('tier_id', 'pro_monthly')

                            print(f"\n[OK] Syncing subscription: {subscription_id}")
                            print(f"   Tier: {tier_id}")
                            print(f"   Status: {subscription.status}")

                            supabase.table('authenticated_users').update({
                                'account_tier': tier_id,
                                'subscription_status': subscription.status,
                                'stripe_subscription_id': subscription_id
                            }).eq('id', user_id).execute()

                            # Record transaction - safe handling with defaults like production code
                            amount = (session.amount_total or 0) / 100
                            supabase.table('payment_transactions').insert({
                                'user_id': user_id,
                                'stripe_payment_id': session.payment_intent,
                                'amount': str(amount),
                                'currency': session.currency or 'usd',
                                'status': 'succeeded',
                                'transaction_type': 'subscription',
                                'tier_id': tier_id,
                                'metadata': metadata
                            }).execute()

                            print(f"\n[SUCCESS] Successfully updated user subscription to {tier_id}!")
                            return True
                        else:
                            print("[X] Session payment not completed or no subscription")
                            return False
                except ValueError:
                    pass
            else:
                print("No checkout sessions found")

            return False

        # Found active subscription(s)
        subscription = subscriptions.data[0]
        print(f"\n[OK] Found active subscription:")
        print(f"   Subscription ID: {subscription.id}")
        print(f"   Status: {subscription.status}")
        print(f"   Current Period End: {subscription.current_period_end}")

        # Determine tier from price
        price_id = subscription['items'].data[0].price.id
        print(f"   Price ID: {price_id}")

        # Get tier from database based on price ID
        tier_result = supabase.table('payment_tiers').select('id, name').or_(
            f'stripe_price_id_monthly.eq.{price_id},stripe_price_id_yearly.eq.{price_id}'
        ).execute()

        if tier_result.data:
            tier_id = tier_result.data[0]['id']
            tier_name = tier_result.data[0]['name']
            print(f"   Tier: {tier_name} ({tier_id})")
        else:
            # Default to pro_monthly
            tier_id = 'pro_monthly'
            print(f"   Tier: pro_monthly (default, couldn't match price ID)")

        # Update user in database
        print(f"\n[*] Updating database...")
        print(f"   Setting subscription status to: {subscription.status}")
        supabase.table('authenticated_users').update({
            'account_tier': tier_id,
            'subscription_status': subscription.status,
            'stripe_subscription_id': subscription.id
        }).eq('id', user_id).execute()

        print(f"\n[SUCCESS] Successfully updated user subscription to {tier_id}!")
        return True

    except stripe.error.StripeError as e:
        print(f"\n[X] Stripe error: {e}")
        return False
    except Exception as e:
        print(f"\n[X] Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        user_email = sys.argv[1]
    else:
        user_email = input("Enter user email address: ")

    if not user_email:
        print("Error: Email address required")
        sys.exit(1)

    print("\n" + "="*60)
    print("Stripe Subscription Fix Tool")
    print("="*60)

    success = asyncio.run(fix_user_subscription(user_email))

    if success:
        print("\n" + "="*60)
        print("DONE! The user's subscription has been updated.")
        print("   They should now see their Pro plan in the profile page.")
        print("="*60)
    else:
        print("\n" + "="*60)
        print("Could not fix subscription automatically.")
        print("   Please check the Stripe dashboard and database manually.")
        print("="*60)


if __name__ == "__main__":
    main()
