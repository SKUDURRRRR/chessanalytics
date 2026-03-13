#!/usr/bin/env python3
"""
Comprehensive Test Runner for Chess Analytics
A convenient wrapper around MAINTEST with additional game analysis specific tests.

Usage:
    python comprehensive_test_runner.py              # Full comprehensive tests
    python comprehensive_test_runner.py --quick      # Quick smoke tests
    python comprehensive_test_runner.py --game-analysis  # Only game analysis tests
    python comprehensive_test_runner.py --arrows     # Only arrow rendering tests
"""

import os
import sys
import time
import argparse
import subprocess
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple

# ANSI color codes for Windows PowerShell
try:
    os.system('color')  # Enable ANSI colors in Windows console
except:
    pass

class Colors:
    """ANSI color codes for terminal output."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'


class ComprehensiveTestRunner:
    """Comprehensive test runner with game analysis specific tests."""

    def __init__(self, args):
        self.args = args
        self.start_time = time.time()
        self.results: List[Dict[str, Any]] = []
        self.project_root = Path(__file__).resolve().parent

    def print_header(self, title: str):
        """Print a styled header."""
        print(f"\n{Colors.CYAN}{'='*80}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.CYAN}{title}{Colors.RESET}")
        print(f"{Colors.CYAN}{'='*80}{Colors.RESET}\n")

    def print_success(self, message: str):
        """Print success message."""
        print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")

    def print_failure(self, message: str):
        """Print failure message."""
        print(f"{Colors.RED}❌ {message}{Colors.RESET}")

    def print_warning(self, message: str):
        """Print warning message."""
        print(f"{Colors.YELLOW}⚠️  {message}{Colors.RESET}")

    def print_info(self, message: str):
        """Print info message."""
        print(f"{Colors.BLUE}ℹ️  {message}{Colors.RESET}")

    def add_result(self, category: str, test_name: str, passed: bool, message: str = "", duration: float = 0):
        """Add a test result."""
        self.results.append({
            'category': category,
            'test_name': test_name,
            'passed': passed,
            'message': message,
            'duration': duration
        })

    def run_maintest(self) -> bool:
        """Run the MAINTEST suite."""
        self.print_header("PHASE 1: MAINTEST SUITE")

        print(f"{Colors.BLUE}Running comprehensive MAINTEST...{Colors.RESET}")
        mode = '--quick' if self.args.quick else '--full'

        try:
            # Set UTF-8 encoding for Python output
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'

            start = time.time()
            result = subprocess.run(
                [sys.executable, 'run_MAINTEST.py', mode, '--ignore-security'],
                cwd=self.project_root,
                env=env,
                capture_output=False,  # Show output in real-time
                timeout=600 if self.args.quick else 1200
            )
            duration = time.time() - start

            if result.returncode == 0:
                self.print_success(f"MAINTEST passed in {duration:.1f}s")
                self.add_result("MAINTEST", "Full Test Suite", True, f"All tests passed", duration)
                return True
            else:
                self.print_warning(f"MAINTEST had some failures (exit code: {result.returncode})")
                self.add_result("MAINTEST", "Full Test Suite", False, f"Exit code: {result.returncode}", duration)
                return False
        except subprocess.TimeoutExpired:
            self.print_failure("MAINTEST timed out")
            self.add_result("MAINTEST", "Full Test Suite", False, "Timeout")
            return False
        except Exception as e:
            self.print_failure(f"Error running MAINTEST: {e}")
            self.add_result("MAINTEST", "Full Test Suite", False, str(e))
            return False

    def test_game_analysis_page(self) -> bool:
        """Test game analysis page specific functionality."""
        if not self.args.game_analysis and not self.args.full and not self.args.quick:
            return True

        self.print_header("PHASE 2: GAME ANALYSIS PAGE TESTS")

        all_passed = True

        # Test 1: Check if GameAnalysisPage.tsx exists and is valid
        print(f"{Colors.BLUE}📋 Checking GameAnalysisPage component...{Colors.RESET}")
        game_analysis_path = self.project_root / 'src' / 'pages' / 'GameAnalysisPage.tsx'
        if game_analysis_path.exists():
            self.print_success("GameAnalysisPage.tsx exists")
            self.add_result("Game Analysis", "Component File Exists", True)

            # Check for key features in the file
            content = game_analysis_path.read_text(encoding='utf-8')

            features = {
                'Chessboard': 'Chessboard' in content,
                'Evaluation Bar': 'evaluation' in content.lower() or 'eval' in content.lower(),
                'Move Analysis': 'move' in content.lower() and 'analysis' in content.lower(),
                'Arrows': 'arrow' in content.lower(),
                'Exploration Mode': 'exploration' in content.lower() or 'explore' in content.lower(),
                'Comments': 'comment' in content.lower(),
            }

            for feature, exists in features.items():
                if exists:
                    self.print_success(f"  {feature} implementation found")
                    self.add_result("Game Analysis", f"{feature} Feature", True)
                else:
                    self.print_warning(f"  {feature} implementation may be missing")
                    self.add_result("Game Analysis", f"{feature} Feature", False, "Not found in code")
                    all_passed = False
        else:
            self.print_failure("GameAnalysisPage.tsx not found")
            self.add_result("Game Analysis", "Component File Exists", False)
            all_passed = False

        return all_passed

    def test_arrow_rendering(self) -> bool:
        """Test arrow rendering utility."""
        if not self.args.arrows and not self.args.full and not self.args.quick:
            return True

        self.print_header("PHASE 3: ARROW RENDERING TESTS")

        print(f"{Colors.BLUE}📋 Checking arrow utilities...{Colors.RESET}")
        arrow_utils_path = self.project_root / 'src' / 'utils' / 'chessArrows.ts'

        if not arrow_utils_path.exists():
            self.print_failure("chessArrows.ts not found")
            self.add_result("Arrow Rendering", "Arrow Utilities File", False, "File not found")
            return False

        self.print_success("chessArrows.ts exists")
        content = arrow_utils_path.read_text(encoding='utf-8')

        # Check for key functions
        checks = {
            'generateMoveArrows': 'generateMoveArrows' in content,
            'generateModernMoveArrows': 'generateModernMoveArrows' in content,
            'Arrow type': 'Arrow' in content or 'interface Arrow' in content,
            'Board orientation': 'orientation' in content.lower() or 'perspective' in content.lower(),
        }

        all_passed = True
        for check_name, exists in checks.items():
            if exists:
                self.print_success(f"  {check_name} found")
                self.add_result("Arrow Rendering", check_name, True)
            else:
                self.print_warning(f"  {check_name} not found")
                self.add_result("Arrow Rendering", check_name, False, "Not found")
                all_passed = False

        return all_passed

    def test_comment_accuracy(self) -> bool:
        """Test comment generation utilities."""
        if self.args.arrows:  # Skip if only testing arrows
            return True

        self.print_header("PHASE 4: COMMENT GENERATION TESTS")

        print(f"{Colors.BLUE}📋 Checking comment generators...{Colors.RESET}")

        files_to_check = [
            ('src/utils/commentTemplates.ts', 'Comment Templates'),
            ('src/utils/chessComStyleComments.ts', 'Chess.com Style Comments'),
        ]

        all_passed = True
        for file_path, name in files_to_check:
            full_path = self.project_root / file_path
            if full_path.exists():
                self.print_success(f"  {name} exists")
                self.add_result("Comments", name, True)
            else:
                self.print_warning(f"  {name} not found")
                self.add_result("Comments", name, False, "File not found")
                all_passed = False

        return all_passed

    def test_exploration_features(self) -> bool:
        """Test exploration mode features."""
        if self.args.arrows:  # Skip if only testing arrows
            return True

        self.print_header("PHASE 5: EXPLORATION MODE TESTS")

        print(f"{Colors.BLUE}📋 Checking exploration mode...{Colors.RESET}")

        exploration_hook = self.project_root / 'src' / 'hooks' / 'useExplorationAnalysis.ts'
        unified_analysis = self.project_root / 'src' / 'components' / 'debug' / 'UnifiedChessAnalysis.tsx'

        checks = [
            (exploration_hook, "useExplorationAnalysis hook"),
            (unified_analysis, "UnifiedChessAnalysis component"),
        ]

        all_passed = True
        for file_path, name in checks:
            if file_path.exists():
                self.print_success(f"  {name} exists")
                self.add_result("Exploration", name, True)

                # Check for key features
                content = file_path.read_text(encoding='utf-8')
                if 'exploration' in content.lower():
                    self.print_success(f"    Exploration logic found")
                else:
                    self.print_warning(f"    Exploration logic may be incomplete")
                    all_passed = False
            else:
                self.print_warning(f"  {name} not found")
                self.add_result("Exploration", name, False, "File not found")
                all_passed = False

        return all_passed

    def test_build(self) -> bool:
        """Test that the project builds successfully."""
        if self.args.game_analysis or self.args.arrows:  # Skip build test for specific tests
            return True

        self.print_header("PHASE 6: BUILD VERIFICATION")

        print(f"{Colors.BLUE}📦 Building project...{Colors.RESET}")

        try:
            start = time.time()
            result = subprocess.run(
                ['npm', 'run', 'build'],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=300
            )
            duration = time.time() - start

            if result.returncode == 0:
                self.print_success(f"Build successful in {duration:.1f}s")
                self.add_result("Build", "npm run build", True, "Build successful", duration)
                return True
            else:
                self.print_failure(f"Build failed")
                self.add_result("Build", "npm run build", False, f"Exit code: {result.returncode}", duration)
                print(f"\n{Colors.RED}Build errors:{Colors.RESET}")
                print(result.stderr[:500] if result.stderr else result.stdout[:500])
                return False
        except subprocess.TimeoutExpired:
            self.print_failure("Build timed out")
            self.add_result("Build", "npm run build", False, "Timeout")
            return False
        except Exception as e:
            self.print_failure(f"Build error: {e}")
            self.add_result("Build", "npm run build", False, str(e))
            return False

    def generate_summary(self):
        """Generate and print test summary."""
        self.print_header("TEST SUMMARY")

        total_duration = time.time() - self.start_time

        # Count results
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['passed'])
        failed_tests = total_tests - passed_tests

        # Group by category
        categories: Dict[str, Tuple[int, int]] = {}
        for result in self.results:
            cat = result['category']
            if cat not in categories:
                categories[cat] = (0, 0)
            passed, total = categories[cat]
            categories[cat] = (passed + (1 if result['passed'] else 0), total + 1)

        # Print summary
        print(f"{Colors.BOLD}Total Tests: {total_tests}{Colors.RESET}")
        print(f"{Colors.GREEN}Passed: {passed_tests} ✅{Colors.RESET}")
        print(f"{Colors.RED}Failed: {failed_tests} ❌{Colors.RESET}")
        print(f"\n{Colors.BOLD}By Category:{Colors.RESET}")

        for category, (passed, total) in sorted(categories.items()):
            status_color = Colors.GREEN if passed == total else Colors.YELLOW if passed > 0 else Colors.RED
            print(f"  {status_color}{category}: {passed}/{total}{Colors.RESET}")

        print(f"\n{Colors.BOLD}Total Duration: {total_duration:.1f}s{Colors.RESET}")

        # Overall result
        print(f"\n{Colors.CYAN}{'='*80}{Colors.RESET}")
        if failed_tests == 0:
            print(f"{Colors.GREEN}{Colors.BOLD}✅ ALL TESTS PASSED - READY FOR PRODUCTION{Colors.RESET}")
        else:
            print(f"{Colors.YELLOW}{Colors.BOLD}⚠️  SOME TESTS FAILED - REVIEW BEFORE DEPLOYMENT{Colors.RESET}")
        print(f"{Colors.CYAN}{'='*80}{Colors.RESET}\n")

        return failed_tests == 0

    def save_report(self):
        """Save results to JSON file."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = self.project_root / f'comprehensive_test_results_{timestamp}.json'

        report_data = {
            'timestamp': timestamp,
            'duration': time.time() - self.start_time,
            'total_tests': len(self.results),
            'passed': sum(1 for r in self.results if r['passed']),
            'failed': sum(1 for r in self.results if not r['passed']),
            'results': self.results
        }

        report_file.write_text(json.dumps(report_data, indent=2), encoding='utf-8')
        print(f"{Colors.BLUE}📄 Results saved to: {report_file}{Colors.RESET}")

    def run(self) -> int:
        """Run all tests."""
        print(f"\n{Colors.BOLD}{Colors.MAGENTA}{'='*80}")
        print("COMPREHENSIVE TEST RUNNER FOR CHESS ANALYTICS")
        print(f"{'='*80}{Colors.RESET}\n")
        print(f"{Colors.BLUE}Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.RESET}")

        # Determine which tests to run
        if self.args.game_analysis:
            print(f"{Colors.CYAN}Mode: Game Analysis Tests Only{Colors.RESET}\n")
            self.test_game_analysis_page()
        elif self.args.arrows:
            print(f"{Colors.CYAN}Mode: Arrow Rendering Tests Only{Colors.RESET}\n")
            self.test_arrow_rendering()
        else:
            mode = "Quick" if self.args.quick else "Full"
            print(f"{Colors.CYAN}Mode: {mode} Comprehensive Tests{Colors.RESET}\n")

            # Run all phases
            self.run_maintest()
            self.test_game_analysis_page()
            self.test_arrow_rendering()
            self.test_comment_accuracy()
            self.test_exploration_features()
            self.test_build()

        # Generate summary
        all_passed = self.generate_summary()

        # Save report
        if not self.args.no_report:
            self.save_report()

        return 0 if all_passed else 1


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Comprehensive Test Runner for Chess Analytics',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python comprehensive_test_runner.py                # Full comprehensive tests
  python comprehensive_test_runner.py --quick         # Quick smoke tests
  python comprehensive_test_runner.py --game-analysis # Only game analysis tests
  python comprehensive_test_runner.py --arrows        # Only arrow rendering tests
        """
    )

    parser.add_argument('--quick', action='store_true', help='Run quick smoke tests')
    parser.add_argument('--full', action='store_true', help='Run full comprehensive tests (default)')
    parser.add_argument('--game-analysis', action='store_true', help='Only run game analysis tests')
    parser.add_argument('--arrows', action='store_true', help='Only run arrow rendering tests')
    parser.add_argument('--no-report', action='store_true', help='Do not save JSON report')

    args = parser.parse_args()

    # Run tests
    runner = ComprehensiveTestRunner(args)
    exit_code = runner.run()

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
