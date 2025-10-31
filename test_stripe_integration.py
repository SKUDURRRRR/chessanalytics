#!/usr/bin/env python3
"""
Stripe Integration Test Script
Tests the Stripe checkout flow and webhook processing
"""

import os
import sys
import requests
import json
from datetime import datetime

# Configuration
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8002')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")

def print_success(text):
    print(f"✅ {text}")

def print_error(text):
    print(f"❌ {text}")

def print_info(text):
    print(f"ℹ️  {text}")

def test_backend_health():
    """Test if backend is running"""
    print_header("Testing Backend Health")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            print_success("Backend is running")
            return True
        else:
            print_error(f"Backend returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_error(f"Backend is not reachable: {e}")
        print_info(f"Make sure backend is running at {BACKEND_URL}")
        return False

def test_payment_tiers():
    """Test fetching payment tiers"""
    print_header("Testing Payment Tiers Endpoint")
    try:
        response = requests.get(f"{BACKEND_URL}/api/v1/payment-tiers", timeout=5)
        if response.status_code == 200:
            data = response.json()
            tiers = data.get('tiers', [])
            print_success(f"Found {len(tiers)} payment tiers")

            for tier in tiers:
                print(f"\n📦 {tier['name']}")
                print(f"   ID: {tier['id']}")
                print(f"   Monthly: ${tier.get('price_monthly', 0)}")
                print(f"   Yearly: ${tier.get('price_yearly', 0)}")
                print(f"   Import Limit: {tier.get('import_limit') or 'Unlimited'}")
                print(f"   Analysis Limit: {tier.get('analysis_limit') or 'Unlimited'}")
                print(f"   Stripe Monthly ID: {tier.get('stripe_price_id_monthly') or 'NOT SET'}")
                print(f"   Stripe Yearly ID: {tier.get('stripe_price_id_yearly') or 'NOT SET'}")

            # Check if Stripe price IDs are set
            pro_monthly = next((t for t in tiers if t['id'] == 'pro_monthly'), None)
            pro_yearly = next((t for t in tiers if t['id'] == 'pro_yearly'), None)

            if pro_monthly and pro_monthly.get('stripe_price_id_monthly'):
                print_success("Pro Monthly Stripe price ID is set")
            else:
                print_error("Pro Monthly Stripe price ID is NOT set")
                print_info("Run: UPDATE payment_tiers SET stripe_price_id_monthly = 'price_xxx' WHERE id = 'pro_monthly';")

            if pro_yearly and pro_yearly.get('stripe_price_id_yearly'):
                print_success("Pro Yearly Stripe price ID is set")
            else:
                print_error("Pro Yearly Stripe price ID is NOT set")
                print_info("Run: UPDATE payment_tiers SET stripe_price_id_yearly = 'price_xxx' WHERE id = 'pro_yearly';")

            return True
        else:
            print_error(f"Failed to fetch tiers: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {e}")
        return False

def test_create_checkout_session(user_token=None):
    """Test creating a Stripe checkout session"""
    print_header("Testing Stripe Checkout Session Creation")

    if not user_token:
        print_info("No user token provided, testing will require authentication")
        print_info("Sign up at: http://localhost:5173/signup")
        return False

    try:
        headers = {'Authorization': f'Bearer {user_token}'}
        payload = {
            'tier_id': 'pro_monthly',  # or pass credit_amount for one-time purchases
            'success_url': f'{FRONTEND_URL}/success',
            'cancel_url': f'{FRONTEND_URL}/pricing'
        }

        response = requests.post(
            f"{BACKEND_URL}/api/v1/payments/create-checkout",
            json=payload,
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            print_success("Checkout session created successfully")
            print(f"\n🔗 Checkout URL: {data.get('url')}")
            print_info("Open this URL in your browser to test the checkout flow")
            print_info("Use test card: 4242 4242 4242 4242")
            return True
        else:
            print_error(f"Failed to create checkout session: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {e}")
        return False

def test_webhook_endpoint():
    """Test if webhook endpoint is accessible"""
    print_header("Testing Webhook Endpoint")
    try:
        # Note: This will fail authentication, but we just want to check if endpoint exists
        response = requests.post(
            f"{BACKEND_URL}/api/v1/payments/webhook",
            json={'type': 'test'},
            headers={'stripe-signature': 'test'},
            timeout=5
        )

        # We expect 400 or 401, not 404
        if response.status_code in [400, 401, 403]:
            print_success("Webhook endpoint exists and is responding")
            print_info(f"Webhook URL: {BACKEND_URL}/api/v1/payments/webhook")
            return True
        elif response.status_code == 404:
            print_error("Webhook endpoint not found (404)")
            return False
        else:
            print_info(f"Webhook endpoint returned status {response.status_code}")
            return True
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {e}")
        return False

def print_manual_test_instructions():
    """Print manual testing instructions"""
    print_header("Manual Testing Instructions")

    print("📝 Step-by-Step Test Process:\n")

    print("1️⃣  Start your backend and frontend:")
    print("   Backend: python -m python.core.unified_api_server")
    print("   Frontend: npm run dev\n")

    print("2️⃣  Sign up for a new account:")
    print(f"   Open: {FRONTEND_URL}/signup")
    print("   Create account with email or Google OAuth\n")

    print("3️⃣  Navigate to pricing page:")
    print(f"   Open: {FRONTEND_URL}/pricing\n")

    print("4️⃣  Click 'Upgrade to Pro' button")
    print("   You should be redirected to Stripe Checkout\n")

    print("5️⃣  Use Stripe test card:")
    print("   Card: 4242 4242 4242 4242")
    print("   Expiry: Any future date (e.g., 12/25)")
    print("   CVC: Any 3 digits (e.g., 123)")
    print("   Postal: Any 5 digits (e.g., 12345)\n")

    print("6️⃣  Complete the checkout")
    print("   You should be redirected back to your app\n")

    print("7️⃣  Verify subscription activated:")
    print("   Check navigation shows 'Unlimited' usage")
    print("   Try importing more than 100 games")
    print("   Try analyzing more than 5 games\n")

    print("8️⃣  Check Stripe Dashboard:")
    print("   Open: https://dashboard.stripe.com/test/payments")
    print("   Verify payment was processed")
    print("   Check Events tab for webhook deliveries\n")

    print("9️⃣  Check Database:")
    print("   Run: SELECT * FROM authenticated_users WHERE email = 'your-email';")
    print("   Verify: account_tier = 'pro'")
    print("   Verify: subscription_status = 'active'")
    print("   Verify: stripe_customer_id and stripe_subscription_id are set\n")

    print("🔟 Test webhook manually (optional):")
    print("   Install Stripe CLI: https://stripe.com/docs/stripe-cli")
    print("   Run: stripe listen --forward-to localhost:8002/api/v1/payments/webhook")
    print("   Trigger test event: stripe trigger payment_intent.succeeded\n")

def main():
    print("\n" + "="*60)
    print("  🎯 STRIPE INTEGRATION TEST")
    print("="*60)
    print(f"\nBackend URL: {BACKEND_URL}")
    print(f"Frontend URL: {FRONTEND_URL}")

    # Run tests
    results = []

    results.append(("Backend Health", test_backend_health()))

    if results[0][1]:  # If backend is healthy
        results.append(("Payment Tiers", test_payment_tiers()))
        results.append(("Webhook Endpoint", test_webhook_endpoint()))

    # Print summary
    print_header("Test Summary")
    for test_name, passed in results:
        if passed:
            print_success(f"{test_name}: PASSED")
        else:
            print_error(f"{test_name}: FAILED")

    # Print manual test instructions
    print_manual_test_instructions()

    print_header("Environment Variables to Check")
    print("\n📋 Backend (Railway):")
    print("   ✓ STRIPE_SECRET_KEY=sk_test_xxx")
    print("   ✓ STRIPE_WEBHOOK_SECRET=whsec_xxx")
    print("   ✓ SUPABASE_URL=https://xxx.supabase.co")
    print("   ✓ SUPABASE_SERVICE_ROLE_KEY=xxx")
    print("   ✓ JWT_SECRET=xxx\n")

    print("📋 Frontend (Vercel):")
    print("   ✓ VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx")
    print("   ✓ VITE_SUPABASE_URL=https://xxx.supabase.co")
    print("   ✓ VITE_SUPABASE_ANON_KEY=xxx")
    print("   ✓ VITE_API_URL=https://your-backend.com\n")

if __name__ == '__main__':
    main()
