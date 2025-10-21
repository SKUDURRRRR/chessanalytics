#!/usr/bin/env python3
"""
MAINTEST Security Utilities
Credential validation, secret scanning, and RLS policy testing.
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from dotenv import load_dotenv

# Import test configuration
from tests.MAINTEST_config import (
    REQUIRED_ENV_VARS,
    OPTIONAL_ENV_VARS,
    PLACEHOLDER_PATTERNS,
    SCAN_DIRECTORIES,
    SCAN_EXTENSIONS,
    SECRET_PATTERNS,
    SCAN_EXCLUDE_PATTERNS,
)

# Load environment variables
load_dotenv()

class SecurityTestResult:
    """Result of a security test."""
    def __init__(self, test_name: str, passed: bool, message: str, details: Optional[str] = None):
        self.test_name = test_name
        self.passed = passed
        self.message = message
        self.details = details
        self.severity = 'CRITICAL' if not passed else 'OK'

    def __repr__(self):
        status = "✅ PASS" if self.passed else "❌ FAIL"
        return f"{status}: {self.test_name} - {self.message}"


def check_env_vars_exist() -> SecurityTestResult:
    """Check that all required environment variables exist."""
    missing_vars = []

    for var_name, description in REQUIRED_ENV_VARS.items():
        value = os.getenv(var_name)
        if not value:
            missing_vars.append(f"{var_name} ({description})")

    if missing_vars:
        return SecurityTestResult(
            "Environment Variables Exist",
            False,
            f"Missing {len(missing_vars)} required environment variables",
            "\n".join([f"  - {var}" for var in missing_vars])
        )

    return SecurityTestResult(
        "Environment Variables Exist",
        True,
        f"All {len(REQUIRED_ENV_VARS)} required environment variables are set"
    )


def check_env_vars_not_placeholders() -> SecurityTestResult:
    """Check that environment variables are not placeholder values."""
    placeholder_vars = []

    for var_name in REQUIRED_ENV_VARS.keys():
        value = os.getenv(var_name, '')

        # Check if value contains any placeholder patterns
        for pattern in PLACEHOLDER_PATTERNS:
            if pattern.lower() in value.lower():
                placeholder_vars.append(f"{var_name} contains '{pattern}'")
                break

    if placeholder_vars:
        return SecurityTestResult(
            "Environment Variables Not Placeholders",
            False,
            f"{len(placeholder_vars)} environment variables contain placeholder values",
            "\n".join([f"  - {var}" for var in placeholder_vars])
        )

    return SecurityTestResult(
        "Environment Variables Not Placeholders",
        True,
        "All environment variables have actual values (not placeholders)"
    )


def check_stockfish_exists() -> SecurityTestResult:
    """Check that Stockfish executable exists and is accessible."""
    stockfish_path = os.getenv('STOCKFISH_PATH')

    if not stockfish_path:
        # Try common locations
        common_paths = [
            './stockfish/stockfish.exe',
            './stockfish/stockfish',
            './stockfish/stockfish-windows-x86-64-avx2.exe',
            '/usr/games/stockfish',
            '/usr/bin/stockfish',
            '/usr/local/bin/stockfish',
        ]

        for path in common_paths:
            if os.path.exists(path):
                return SecurityTestResult(
                    "Stockfish Executable Exists",
                    True,
                    f"Stockfish found at {path}",
                    "Note: STOCKFISH_PATH environment variable not set, but found in common location"
                )

        return SecurityTestResult(
            "Stockfish Executable Exists",
            False,
            "Stockfish executable not found",
            f"Checked: {', '.join(common_paths)}\nSet STOCKFISH_PATH environment variable"
        )

    if os.path.exists(stockfish_path):
        return SecurityTestResult(
            "Stockfish Executable Exists",
            True,
            f"Stockfish found at {stockfish_path}"
        )

    return SecurityTestResult(
        "Stockfish Executable Exists",
        False,
        f"Stockfish not found at configured path: {stockfish_path}"
    )


def scan_for_exposed_secrets(quick_mode: bool = False) -> SecurityTestResult:
    """Scan source code for potentially exposed secrets."""
    project_root = Path.cwd()
    exposed_secrets = []
    files_scanned = 0

    for directory in SCAN_DIRECTORIES:
        dir_path = project_root / directory

        if not dir_path.exists():
            continue

        for file_path in dir_path.rglob('*'):
            # Skip excluded patterns
            if any(excl in str(file_path) for excl in SCAN_EXCLUDE_PATTERNS):
                continue

            # Only scan files with relevant extensions
            if file_path.suffix not in SCAN_EXTENSIONS:
                continue

            # Skip very large files (> 1MB)
            if file_path.stat().st_size > 1_000_000:
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    files_scanned += 1

                    # Check for secret patterns
                    for pattern in SECRET_PATTERNS:
                        matches = re.finditer(pattern, content, re.IGNORECASE)
                        for match in matches:
                            # Extract line number
                            line_num = content[:match.start()].count('\n') + 1
                            exposed_secrets.append({
                                'file': str(file_path.relative_to(project_root)),
                                'line': line_num,
                                'pattern': pattern[:50],
                                'match': match.group(1)[:20] + '...' if len(match.group(1)) > 20 else match.group(1)
                            })

                            # In quick mode, stop after finding first issue
                            if quick_mode and exposed_secrets:
                                break

                    if quick_mode and exposed_secrets:
                        break

            except Exception as e:
                # Ignore files that can't be read
                continue

        if quick_mode and exposed_secrets:
            break

    if exposed_secrets:
        details = "\n".join([
            f"  - {secret['file']}:{secret['line']} - {secret['match']}"
            for secret in exposed_secrets[:10]  # Limit to first 10
        ])
        if len(exposed_secrets) > 10:
            details += f"\n  ... and {len(exposed_secrets) - 10} more"

        return SecurityTestResult(
            "No Exposed Secrets in Code",
            False,
            f"Found {len(exposed_secrets)} potential exposed secrets in {files_scanned} files",
            details
        )

    return SecurityTestResult(
        "No Exposed Secrets in Code",
        True,
        f"No exposed secrets found (scanned {files_scanned} files)"
    )


def test_rls_public_analytics_model() -> SecurityTestResult:
    """Test RLS policies for PUBLIC ANALYTICS APP (not private app).

    In a public analytics tool:
    - Anonymous users MUST be able to READ games/PGN (public data)
    - Anonymous users MUST NOT be able to WRITE (security)
    - Service role has full access (backend operations)
    """
    try:
        from supabase import create_client, Client

        supabase_url = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
        supabase_anon_key = os.getenv('VITE_SUPABASE_ANON_KEY') or os.getenv('SUPABASE_ANON_KEY')

        if not supabase_url or not supabase_anon_key:
            return SecurityTestResult(
                "RLS Public Analytics Model",
                False,
                "Cannot test RLS: Missing Supabase credentials"
            )

        anon_client: Client = create_client(supabase_url, supabase_anon_key)

        # TEST 1: Anonymous users CAN read games (required for public analytics)
        games_result = anon_client.table("games").select("*").limit(5).execute()

        if not games_result.data or len(games_result.data) == 0:
            return SecurityTestResult(
                "RLS Public Analytics Model",
                False,
                "CRITICAL: Anonymous users cannot read games - entire app is broken!",
                "Frontend needs to read games. Check RLS policies allow anonymous SELECT."
            )

        # TEST 2: Anonymous users CAN read games_pgn (required for re-analyze)
        pgn_result = anon_client.table("games_pgn").select("*").limit(5).execute()

        if not pgn_result.data or len(pgn_result.data) == 0:
            return SecurityTestResult(
                "RLS Public Analytics Model",
                False,
                "CRITICAL: Anonymous users cannot read games_pgn - re-analyze button broken!",
                "Frontend needs PGN data for re-analysis. Check RLS policies."
            )

        # TEST 3: Anonymous users CANNOT write (security check)
        write_blocked = False
        try:
            anon_client.table("games").insert({
                'user_id': 'test_security_check',
                'platform': 'test',
                'provider_game_id': 'test_123',
                'result': 'win',
                'color': 'white',
                'time_control': 'test',
                'opening': 'test',
                'total_moves': 1,
                'played_at': '2025-01-01T00:00:00Z'
            }).execute()
        except Exception as write_error:
            # Expected to fail - anonymous shouldn't be able to write
            write_blocked = True

        if not write_blocked:
            return SecurityTestResult(
                "RLS Public Analytics Model",
                False,
                "SECURITY BREACH: Anonymous users can WRITE to games!",
                "Anonymous should only have READ access, not WRITE. Fix RLS policies immediately!"
            )

        return SecurityTestResult(
            "RLS Public Analytics Model",
            True,
            f"RLS policies correct: Anonymous can READ ({len(games_result.data)} games, {len(pgn_result.data)} PGNs), but cannot WRITE"
        )

    except Exception as e:
        # Unexpected error
        return SecurityTestResult(
            "RLS Public Analytics Model",
            False,
            f"Error testing RLS: {str(e)}",
            "This may indicate RLS configuration issues"
        )


def test_rls_service_role_access() -> SecurityTestResult:
    """Test that service role can access all data."""
    try:
        from supabase import create_client, Client

        supabase_url = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
        supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

        if not supabase_url or not supabase_service_key:
            return SecurityTestResult(
                "RLS Service Role Access",
                False,
                "Cannot test service role: Missing credentials",
                "Note: This is required for the backend to function"
            )

        service_client: Client = create_client(supabase_url, supabase_service_key)

        # Try to read games table
        games_result = service_client.table("games").select("id, user_id, platform").limit(5).execute()

        if not games_result.data:
            return SecurityTestResult(
                "RLS Service Role Access",
                False,
                "Service role cannot read games (but no data exists)",
                "This might be OK if database is empty, but check if backend can write data"
            )

        # Try to read games_pgn table
        pgn_result = service_client.table("games_pgn").select("user_id, platform, provider_game_id").limit(5).execute()

        return SecurityTestResult(
            "RLS Service Role Access",
            True,
            f"Service role can access data (found {len(games_result.data)} games, {len(pgn_result.data)} PGNs)"
        )

    except Exception as e:
        return SecurityTestResult(
            "RLS Service Role Access",
            False,
            f"Service role access failed: {str(e)}",
            "Backend will not be able to write data!"
        )


def run_all_security_tests(quick_mode: bool = False) -> List[SecurityTestResult]:
    """Run all security tests and return results."""
    results = []

    print("\n" + "="*80)
    print("RUNNING SECURITY TESTS")
    print("="*80)

    # Credential validation
    print("\n📋 Checking environment variables...")
    results.append(check_env_vars_exist())
    results.append(check_env_vars_not_placeholders())

    print("\n📋 Checking Stockfish...")
    results.append(check_stockfish_exists())

    # Secret scanning (can be slow, so respect quick mode)
    print(f"\n📋 Scanning for exposed secrets ({'quick' if quick_mode else 'full'} mode)...")
    results.append(scan_for_exposed_secrets(quick_mode))

    # RLS policy tests (CRITICAL - run in both quick and full mode)
    print("\n📋 Testing RLS policies for PUBLIC ANALYTICS model...")
    results.append(test_rls_public_analytics_model())

    if not quick_mode:
        results.append(test_rls_service_role_access())

    return results


def print_security_results(results: List[SecurityTestResult]) -> bool:
    """Print security test results and return True if all passed."""
    print("\n" + "="*80)
    print("SECURITY TEST RESULTS")
    print("="*80)

    passed = 0
    failed = 0

    for result in results:
        print(f"\n{result}")
        if result.details:
            print(result.details)

        if result.passed:
            passed += 1
        else:
            failed += 1

    print("\n" + "="*80)
    print(f"SUMMARY: {passed} passed, {failed} failed out of {len(results)} tests")
    print("="*80)

    return failed == 0


if __name__ == '__main__':
    # Allow running this file standalone for testing
    import argparse

    parser = argparse.ArgumentParser(description='Run MAINTEST security checks')
    parser.add_argument('--quick', action='store_true', help='Quick mode (faster, less thorough)')
    args = parser.parse_args()

    results = run_all_security_tests(quick_mode=args.quick)
    all_passed = print_security_results(results)

    sys.exit(0 if all_passed else 1)
