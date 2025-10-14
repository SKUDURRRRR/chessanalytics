#!/usr/bin/env python3
"""
MAINTEST Pre-deployment Test Suite
Master orchestrator for running comprehensive pre-deployment tests.

Usage:
    python run_MAINTEST.py --quick       # Quick smoke tests (~2-3 min)
    python run_MAINTEST.py --full        # Full comprehensive tests (~10-15 min)
    python run_MAINTEST.py --backend-only  # Only backend tests
    python run_MAINTEST.py --frontend-only # Only frontend tests
"""

import os
import sys
import subprocess
import argparse
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Add tests directory to path
sys.path.insert(0, str(Path(__file__).parent))

from tests.MAINTEST_config import get_api_base_url, get_frontend_base_url
from tests.MAINTEST_security import run_all_security_tests, print_security_results
from tests.MAINTEST_backend import run_backend_tests
from tests.MAINTEST_report import MAINTESTReport

# Load environment variables
load_dotenv()


class MAINTESTRunner:
    """Master test runner orchestrator."""
    
    def __init__(self, args):
        self.args = args
        self.quick_mode = args.quick
        self.full_mode = args.full or (not args.quick and not args.backend_only and not args.frontend_only)
        self.backend_only = args.backend_only
        self.frontend_only = args.frontend_only
        
        # Set environment variable for test mode
        os.environ['MAINTEST_MODE'] = 'quick' if self.quick_mode else 'full'
        
        # Initialize report
        test_mode = 'quick' if self.quick_mode else 'full'
        if self.backend_only:
            test_mode += '-backend'
        elif self.frontend_only:
            test_mode += '-frontend'
        
        self.report = MAINTESTReport(test_mode)
        self.start_time = time.time()
        
    def print_header(self):
        """Print test suite header."""
        print("\n" + "="*80)
        print("🧪 MAINTEST PRE-DEPLOYMENT TEST SUITE")
        print("="*80)
        print(f"Mode: {'Quick' if self.quick_mode else 'Full'}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"API URL: {get_api_base_url()}")
        print(f"Frontend URL: {get_frontend_base_url()}")
        print("="*80)
    
    def check_environment(self) -> bool:
        """Check that the environment is ready."""
        print("\n" + "="*80)
        print("ENVIRONMENT CHECK")
        print("="*80)
        
        # Check if .env file exists
        if not Path('.env').exists():
            print("❌ .env file not found!")
            print("   Please create .env file with required credentials.")
            print("   See env.example for template.")
            return False
        
        print("✅ .env file found")
        
        # Check required environment variables
        required_vars = [
            'SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY',
            'SUPABASE_ANON_KEY',
        ]
        
        missing = []
        for var in required_vars:
            if not os.getenv(var) and not os.getenv(f'VITE_{var}'):
                missing.append(var)
        
        if missing:
            print(f"❌ Missing required environment variables: {', '.join(missing)}")
            return False
        
        print(f"✅ All required environment variables set")
        
        # Add environment info to report
        self.report.set_metadata('API URL', get_api_base_url())
        self.report.set_metadata('Frontend URL', get_frontend_base_url())
        self.report.set_metadata('Python Version', sys.version.split()[0])
        self.report.set_metadata('Test Mode', 'Quick' if self.quick_mode else 'Full')
        
        return True
    
    def run_security_tests(self) -> bool:
        """Run security and credential tests."""
        if self.frontend_only:
            print("\n⏭️  Skipping security tests (frontend-only mode)")
            return True
        
        print("\n" + "="*80)
        print("SECURITY & CREDENTIALS")
        print("="*80)
        
        # Run security tests
        results = run_all_security_tests(quick_mode=self.quick_mode)
        
        # Add results to report
        for result in results:
            self.report.add_result(
                "Security & Credentials",
                result.test_name,
                result.passed,
                result.message,
                details=result.details
            )
        
        # Print results
        all_passed = print_security_results(results)
        
        if not all_passed:
            print("\n⚠️  Some security checks failed!")
            if not self.args.ignore_security:
                print("   Use --ignore-security to continue anyway (not recommended)")
                return False
        
        return True
    
    def run_backend_tests(self) -> bool:
        """Run backend/API tests."""
        if self.frontend_only:
            print("\n⏭️  Skipping backend tests (frontend-only mode)")
            return True
        
        print("\n" + "="*80)
        print("BACKEND TESTS")
        print("="*80)
        
        try:
            success = run_backend_tests(self.report, quick_mode=self.quick_mode)
            return success
        except Exception as e:
            print(f"\n❌ Backend tests failed with error: {e}")
            self.report.add_result(
                "Backend Tests",
                "Test Suite Execution",
                False,
                f"Failed to run backend tests: {str(e)}"
            )
            return False
    
    def run_frontend_tests(self) -> bool:
        """Run Playwright frontend tests."""
        if self.backend_only:
            print("\n⏭️  Skipping frontend tests (backend-only mode)")
            return True
        
        print("\n" + "="*80)
        print("FRONTEND TESTS (PLAYWRIGHT)")
        print("="*80)
        
        try:
            # Check if Playwright is installed
            result = subprocess.run(
                ['npx', 'playwright', '--version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                print("⚠️  Playwright not installed. Installing...")
                subprocess.run(['npm', 'install', '@playwright/test'], check=True)
                subprocess.run(['npx', 'playwright', 'install'], check=True)
            
            # Set environment variables for Playwright
            env = os.environ.copy()
            env['FRONTEND_URL'] = get_frontend_base_url()
            env['MAINTEST_MODE'] = 'quick' if self.quick_mode else 'full'
            
            # Determine which tests to run
            test_pattern = 'MAINTEST_frontend.spec.ts'
            
            # Run Playwright tests
            print("\n🎭 Running Playwright tests...")
            print(f"   Test file: tests/{test_pattern}")
            
            cmd = [
                'npx',
                'playwright',
                'test',
                f'tests/{test_pattern}',
                '--reporter=list'
            ]
            
            if self.quick_mode:
                # Run headless and only on chromium in quick mode
                cmd.extend(['--project=chromium'])
            
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=False,  # Show output in real-time
                timeout=600 if self.quick_mode else 1200  # 10-20 min timeout
            )
            
            if result.returncode == 0:
                self.report.add_result(
                    "Frontend Tests",
                    "Playwright Test Suite",
                    True,
                    "All Playwright tests passed"
                )
                print("\n✅ Frontend tests passed!")
                return True
            else:
                self.report.add_result(
                    "Frontend Tests",
                    "Playwright Test Suite",
                    False,
                    f"Playwright tests failed with exit code {result.returncode}"
                )
                print(f"\n❌ Frontend tests failed (exit code: {result.returncode})")
                return False
                
        except subprocess.TimeoutExpired:
            print("\n❌ Frontend tests timed out")
            self.report.add_result(
                "Frontend Tests",
                "Playwright Test Suite",
                False,
                "Tests timed out"
            )
            return False
        except Exception as e:
            print(f"\n❌ Error running frontend tests: {e}")
            self.report.add_result(
                "Frontend Tests",
                "Playwright Test Suite",
                False,
                f"Error: {str(e)}"
            )
            return False
    
    def generate_report(self):
        """Generate and save final report."""
        duration = time.time() - self.start_time
        
        print("\n" + "="*80)
        print("GENERATING REPORT")
        print("="*80)
        
        # Print summary to console
        self.report.print_summary()
        
        # Save HTML report
        report_file = self.report.save_report()
        
        print(f"\n📄 HTML Report saved to: {report_file}")
        print(f"⏱️  Total duration: {duration:.1f} seconds")
        
        # Get summary
        summary = self.report.get_summary()
        
        return summary['failed'] == 0
    
    def run(self) -> int:
        """Run the complete test suite."""
        self.print_header()
        
        # Check environment
        if not self.check_environment():
            print("\n❌ Environment check failed. Cannot continue.")
            return 1
        
        # Run test suites
        security_passed = self.run_security_tests()
        backend_passed = self.run_backend_tests()
        frontend_passed = self.run_frontend_tests()
        
        # Generate report
        all_passed = self.generate_report()
        
        # Print final result
        print("\n" + "="*80)
        if all_passed:
            print("✅ ALL TESTS PASSED - READY FOR PRODUCTION")
        else:
            print("❌ SOME TESTS FAILED - DO NOT DEPLOY TO PRODUCTION")
        print("="*80)
        
        return 0 if all_passed else 1


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='MAINTEST Pre-deployment Test Suite',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_MAINTEST.py --quick           # Quick smoke tests (~2-3 min)
  python run_MAINTEST.py --full            # Full comprehensive tests (~10-15 min)
  python run_MAINTEST.py --backend-only    # Only backend tests
  python run_MAINTEST.py --frontend-only   # Only frontend tests (requires backend running)
  python run_MAINTEST.py --quick --ignore-security  # Skip security failures
        """
    )
    
    # Test mode options
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        '--quick',
        action='store_true',
        help='Run quick smoke tests (2-3 minutes)'
    )
    mode_group.add_argument(
        '--full',
        action='store_true',
        help='Run full comprehensive tests (10-15 minutes)'
    )
    
    # Scope options
    parser.add_argument(
        '--backend-only',
        action='store_true',
        help='Only run backend tests'
    )
    parser.add_argument(
        '--frontend-only',
        action='store_true',
        help='Only run frontend tests'
    )
    
    # Other options
    parser.add_argument(
        '--ignore-security',
        action='store_true',
        help='Continue even if security checks fail (not recommended)'
    )
    
    args = parser.parse_args()
    
    # Default to full mode if nothing specified
    if not args.quick and not args.full:
        args.full = True
    
    # Run tests
    runner = MAINTESTRunner(args)
    exit_code = runner.run()
    
    sys.exit(exit_code)


if __name__ == '__main__':
    main()

