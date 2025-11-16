#!/usr/bin/env python3
"""
Automated Game Analysis Testing Script
Runs comprehensive Playwright tests for the game analysis page.
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path
from datetime import datetime

# ANSI colors
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'


def print_header(title: str):
    """Print styled header."""
    print(f"\n{Colors.CYAN}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{title}{Colors.RESET}")
    print(f"{Colors.CYAN}{'='*80}{Colors.RESET}\n")


def run_playwright_tests(test_file: str = None, headed: bool = False, ui: bool = False) -> bool:
    """Run Playwright tests for game analysis."""
    print_header("AUTOMATED GAME ANALYSIS TESTS")

    # Determine which test file to run
    if test_file:
        test_path = f"tests/{test_file}"
    else:
        test_path = "tests/game_analysis_comprehensive.spec.ts"

    # Check if test file exists
    if not Path(test_path).exists():
        print(f"{Colors.RED}[X] Test file not found: {test_path}{Colors.RESET}")
        return False

    print(f"{Colors.BLUE}Running tests from: {test_path}{Colors.RESET}\n")

    # Build command
    # Use npx.cmd on Windows for proper execution
    npx_cmd = "npx.cmd" if os.name == 'nt' else "npx"
    cmd = [npx_cmd, "playwright", "test", test_path]

    if ui:
        cmd.append("--ui")
        print(f"{Colors.YELLOW}[*] Opening Playwright UI...{Colors.RESET}")
    elif headed:
        cmd.append("--headed")
        print(f"{Colors.YELLOW}[*] Running tests in headed mode (you'll see the browser)...{Colors.RESET}")
    else:
        cmd.extend(["--reporter=list"])
        print(f"{Colors.YELLOW}[*] Running tests in headless mode...{Colors.RESET}")

    # Run tests
    try:
        result = subprocess.run(cmd, cwd=Path(__file__).parent)

        if result.returncode == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}[OK] ALL TESTS PASSED!{Colors.RESET}")
            return True
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}[FAIL] SOME TESTS FAILED{Colors.RESET}")
            return False

    except FileNotFoundError:
        print(f"{Colors.RED}[X] npx not found. Make sure Node.js is installed.{Colors.RESET}")
        return False
    except Exception as e:
        print(f"{Colors.RED}[X] Error running tests: {e}{Colors.RESET}")
        return False


def run_specific_test_group(group: str) -> bool:
    """Run a specific test group by grep pattern."""
    print_header(f"RUNNING TEST GROUP: {group}")

    npx_cmd = "npx.cmd" if os.name == 'nt' else "npx"
    cmd = [
        npx_cmd, "playwright", "test",
        "tests/game_analysis_comprehensive.spec.ts",
        "--grep", group,
        "--reporter=list"
    ]

    try:
        result = subprocess.run(cmd, cwd=Path(__file__).parent)
        return result.returncode == 0
    except Exception as e:
        print(f"{Colors.RED}[X] Error: {e}{Colors.RESET}")
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Automated Game Analysis Testing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_game_analysis_tests.py                    # Run all tests (headless)
  python run_game_analysis_tests.py --headed           # Run with visible browser
  python run_game_analysis_tests.py --ui               # Open Playwright UI
  python run_game_analysis_tests.py --quick            # Run quick smoke test only
  python run_game_analysis_tests.py --group "Arrows"   # Run specific test group
        """
    )

    parser.add_argument('--headed', action='store_true',
                       help='Run tests in headed mode (visible browser)')
    parser.add_argument('--ui', action='store_true',
                       help='Open Playwright UI for interactive testing')
    parser.add_argument('--quick', action='store_true',
                       help='Run only quick smoke test')
    parser.add_argument('--group', type=str,
                       help='Run specific test group (e.g., "Arrows", "Evaluation", "Exploration")')
    parser.add_argument('--file', type=str,
                       help='Specific test file to run')

    args = parser.parse_args()

    # Print intro
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*80}")
    print("GAME ANALYSIS PAGE - AUTOMATED TESTING")
    print(f"{'='*80}{Colors.RESET}\n")
    print(f"{Colors.BLUE}Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.RESET}\n")

    # Check if servers are running
    print(f"{Colors.YELLOW}[!] Make sure your servers are running:{Colors.RESET}")
    print(f"   - Frontend: http://localhost:3000")
    print(f"   - Backend: http://localhost:8002\n")

    # Run appropriate tests
    success = False

    if args.quick:
        print(f"{Colors.CYAN}Running quick smoke test...{Colors.RESET}\n")
        success = run_specific_test_group("Quick Smoke Test")
    elif args.group:
        success = run_specific_test_group(args.group)
    else:
        success = run_playwright_tests(test_file=args.file, headed=args.headed, ui=args.ui)

    # Print summary
    print(f"\n{Colors.CYAN}{'='*80}{Colors.RESET}")
    if success:
        print(f"{Colors.GREEN}{Colors.BOLD}[OK] TESTING COMPLETE - ALL PASSED{Colors.RESET}")
    else:
        print(f"{Colors.RED}{Colors.BOLD}[FAIL] TESTING COMPLETE - SOME FAILURES{Colors.RESET}")
    print(f"{Colors.CYAN}{'='*80}{Colors.RESET}\n")

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
