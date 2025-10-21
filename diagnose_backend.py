#!/usr/bin/env python3
"""
Quick Backend Health Check and Diagnostic Tool
Run this to verify your backend deployment is working correctly.
"""

import os
import sys
import requests
import json
from urllib.parse import urljoin

def print_header(text):
    """Print a formatted header"""
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")

def print_success(text):
    """Print success message"""
    print(f"✅ {text}")

def print_error(text):
    """Print error message"""
    print(f"❌ {text}")

def print_warning(text):
    """Print warning message"""
    print(f"⚠️  {text}")

def print_info(text):
    """Print info message"""
    print(f"ℹ️  {text}")

def check_environment_variables():
    """Check if required environment variables are set"""
    print_header("Checking Environment Variables")

    required_vars = {
        'SUPABASE_URL': 'Database URL',
        'SUPABASE_ANON_KEY': 'Supabase Anonymous Key',
        'SUPABASE_SERVICE_ROLE_KEY': 'Supabase Service Role Key (for backend)',
    }

    optional_vars = {
        'STOCKFISH_PATH': 'Path to Stockfish binary',
        'API_HOST': 'API host address',
        'API_PORT': 'API port number',
    }

    all_good = True

    for var, description in required_vars.items():
        value = os.getenv(var)
        if value:
            # Mask sensitive values
            if 'KEY' in var:
                display_value = value[:20] + '...' if len(value) > 20 else value
            else:
                display_value = value
            print_success(f"{var}: {display_value}")
        else:
            print_error(f"{var}: NOT SET ({description})")
            all_good = False

    print()
    for var, description in optional_vars.items():
        value = os.getenv(var)
        if value:
            print_info(f"{var}: {value}")
        else:
            print_warning(f"{var}: Not set (will use default) - {description}")

    return all_good

def test_backend_health(backend_url):
    """Test if backend health endpoint is accessible"""
    print_header("Testing Backend Health")

    health_url = urljoin(backend_url, '/health')
    print_info(f"Testing: {health_url}")

    try:
        response = requests.get(health_url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            print_success(f"Backend is healthy!")
            print(f"   Response: {json.dumps(data, indent=2)}")
            return True
        else:
            print_error(f"Backend returned status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print_error(f"Cannot connect to backend at {backend_url}")
        print_warning("Make sure your backend is deployed and running")
        return False
    except requests.exceptions.Timeout:
        print_error("Request timed out")
        return False
    except Exception as e:
        print_error(f"Error: {str(e)}")
        return False

def test_api_endpoint(backend_url, user_id="skudurrrrr", platform="chess.com"):
    """Test a sample API endpoint"""
    print_header(f"Testing API Endpoint for User: {user_id}")

    stats_url = urljoin(backend_url, f'/api/v1/analysis/stats/{user_id}/{platform}/stockfish')
    print_info(f"Testing: {stats_url}")

    try:
        response = requests.get(stats_url, timeout=30)

        if response.status_code == 200:
            data = response.json()
            print_success(f"Successfully retrieved data for {user_id}")
            print(f"\n   Stats:")
            print(f"   - Total games: {data.get('total_games', 0)}")
            print(f"   - Average accuracy: {data.get('average_accuracy', 0):.1f}%")
            print(f"   - Games analyzed: {data.get('games_analyzed', 0)}")
            return True
        else:
            print_error(f"API returned status {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_error(f"Error: {str(e)}")
        return False

def test_database_connection(backend_url):
    """Test database connectivity through backend"""
    print_header("Testing Database Connection")

    # Try to hit an endpoint that requires database access
    db_test_url = urljoin(backend_url, '/api/v1/player-stats/skudurrrrr/chess.com')
    print_info(f"Testing database access: {db_test_url}")

    try:
        response = requests.get(db_test_url, timeout=30)

        if response.status_code == 200:
            print_success("Database connection is working!")
            data = response.json()
            if data.get('highest_elo'):
                print(f"   - Highest ELO: {data.get('highest_elo')}")
                print(f"   - Time control: {data.get('time_control_with_highest_elo')}")
            return True
        elif response.status_code == 404:
            print_warning("User not found in database (this is OK if it's a test user)")
            return True
        else:
            print_error(f"Database test returned status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Database connection error: {str(e)}")
        return False

def generate_deployment_commands():
    """Generate deployment commands for popular platforms"""
    print_header("Deployment Commands")

    print("🚀 Railway Deployment:")
    print("""
    1. Install Railway CLI:
       npm install -g railway

    2. Login and link project:
       railway login
       railway link

    3. Set environment variables:
       railway variables set SUPABASE_URL=https://your-project.supabase.co
       railway variables set SUPABASE_ANON_KEY=your-anon-key
       railway variables set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
       railway variables set STOCKFISH_PATH=stockfish

    4. Deploy:
       railway up
    """)

    print("\n🚀 Render Deployment:")
    print("""
    1. Create render.yaml in project root (already exists)
    2. Go to render.com → New Web Service
    3. Connect repository
    4. Add environment variables in dashboard
    5. Deploy
    """)

    print("\n🐳 Docker Deployment:")
    print("""
    1. Build:
       docker build -f Dockerfile.api -t chess-analytics-api .

    2. Run:
       docker run -p 8002:8002 \\
         -e SUPABASE_URL=https://your-project.supabase.co \\
         -e SUPABASE_ANON_KEY=your-anon-key \\
         -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \\
         chess-analytics-api
    """)

def main():
    print("""
    ╔════════════════════════════════════════════════════════════╗
    ║                                                            ║
    ║   Chess Analytics Backend Diagnostic Tool                 ║
    ║                                                            ║
    ╚════════════════════════════════════════════════════════════╝
    """)

    # Get backend URL
    backend_url = os.getenv('VITE_ANALYSIS_API_URL') or os.getenv('BACKEND_URL')

    if not backend_url:
        print_warning("Backend URL not found in environment variables")
        backend_url = input("\nEnter your backend URL (or press Enter to check localhost:8002): ").strip()

        if not backend_url:
            backend_url = "http://localhost:8002"

    print_info(f"Testing backend at: {backend_url}\n")

    # Run diagnostics
    results = {
        'env_vars': check_environment_variables(),
        'health': test_backend_health(backend_url),
        'api': False,
        'database': False
    }

    if results['health']:
        results['api'] = test_api_endpoint(backend_url)
        results['database'] = test_database_connection(backend_url)

    # Print summary
    print_header("Diagnostic Summary")

    all_passed = all(results.values())

    if all_passed:
        print_success("All checks passed! Your backend is working correctly! 🎉")
        print()
        print_info(f"Backend URL: {backend_url}")
        print_info("Set this as VITE_ANALYSIS_API_URL in your frontend deployment")
        print()
        print("Next steps:")
        print("1. Deploy your frontend with VITE_ANALYSIS_API_URL set to the backend URL")
        print("2. Test your application at your production URL")
        print("3. Import games and run analyses")
    else:
        print_error("Some checks failed. Please review the errors above.")
        print()

        if not results['env_vars']:
            print_warning("Fix: Set missing environment variables")

        if not results['health']:
            print_warning("Fix: Make sure backend is deployed and accessible")
            generate_deployment_commands()

        if results['health'] and not results['database']:
            print_warning("Fix: Check Supabase credentials and RLS policies")

        print("\nFor detailed instructions, see: URGENT_PRODUCTION_FIX.md")

    print()
    return 0 if all_passed else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
