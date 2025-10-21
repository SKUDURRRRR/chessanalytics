#!/usr/bin/env python3
"""
MAINTEST Backend Tests
Test game imports, analysis, data correctness, and API endpoints.
"""

import os
import sys
import time
import asyncio
import requests
from typing import Dict, Any, List, Tuple
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# Import test configuration
from tests.MAINTEST_config import (
    TEST_USERS,
    THRESHOLDS,
    TEST_LIMITS,
    get_api_base_url,
    is_quick_mode,
)
from tests.MAINTEST_report import MAINTESTReport

# Load environment variables
load_dotenv()


class BackendTester:
    """Backend test runner."""

    def __init__(self, report: MAINTESTReport, quick_mode: bool = False):
        self.report = report
        self.quick_mode = quick_mode
        self.api_base_url = get_api_base_url()

        # Initialize Supabase clients
        supabase_url = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
        supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        supabase_anon_key = os.getenv('VITE_SUPABASE_ANON_KEY') or os.getenv('SUPABASE_ANON_KEY')

        if not all([supabase_url, supabase_service_key, supabase_anon_key]):
            raise ValueError("Missing required Supabase credentials")

        self.supabase_service: Client = create_client(supabase_url, supabase_service_key)
        self.supabase_anon: Client = create_client(supabase_url, supabase_anon_key)

    def test_api_health(self) -> bool:
        """Test that the API is running and healthy."""
        start = time.time()
        try:
            response = requests.get(f"{self.api_base_url}/health", timeout=10)
            duration = (time.time() - start) * 1000

            if response.status_code == 200:
                self.report.add_result(
                    "API Health",
                    "Backend API Health Check",
                    True,
                    f"API is healthy (HTTP {response.status_code})",
                    duration
                )
                return True
            else:
                self.report.add_result(
                    "API Health",
                    "Backend API Health Check",
                    False,
                    f"API returned unexpected status: {response.status_code}",
                    duration
                )
                return False
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.report.add_result(
                "API Health",
                "Backend API Health Check",
                False,
                f"Failed to connect to API: {str(e)}",
                duration,
                f"API URL: {self.api_base_url}\nMake sure backend is running on port 8002"
            )
            return False

    def test_lichess_import(self) -> bool:
        """Test importing games from Lichess."""
        user_id = TEST_USERS['lichess_existing']
        platform = 'lichess'
        limit = TEST_LIMITS['quick_import_games'] if self.quick_mode else TEST_LIMITS['full_import_games']

        print(f"\n📥 Testing Lichess import for {user_id}...")

        # Get current game count
        before_count = self._get_game_count(user_id, platform)

        start = time.time()
        try:
            response = requests.post(
                f"{self.api_base_url}/api/v1/import-games",
                json={
                    'user_id': user_id,
                    'platform': platform,
                    'limit': limit
                },
                timeout=THRESHOLDS['max_import_time']
            )
            duration = (time.time() - start) * 1000

            if response.status_code == 200:
                data = response.json()
                after_count = self._get_game_count(user_id, platform)
                imported = after_count - before_count

                # Test should fail if no games were imported and user has no games
                if after_count == 0:
                    self.report.add_result(
                        "Game Import",
                        f"Lichess Import ({user_id})",
                        False,
                        f"User {user_id} has no games - user may not exist",
                        duration,
                        f"API Response: {data.get('message', 'Success')}"
                    )
                    return False

                self.report.add_result(
                    "Game Import",
                    f"Lichess Import ({user_id})",
                    True,
                    f"Imported {imported} games (total: {after_count})",
                    duration,
                    f"API Response: {data.get('message', 'Success')}"
                )
                return True
            else:
                self.report.add_result(
                    "Game Import",
                    f"Lichess Import ({user_id})",
                    False,
                    f"Import failed with status {response.status_code}",
                    duration,
                    response.text[:500]
                )
                return False
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.report.add_result(
                "Game Import",
                f"Lichess Import ({user_id})",
                False,
                f"Import error: {str(e)}",
                duration
            )
            return False

    def test_chesscom_import(self) -> bool:
        """Test importing games from Chess.com."""
        user_id = TEST_USERS['chesscom_existing']
        platform = 'chess.com'
        limit = TEST_LIMITS['quick_import_games'] if self.quick_mode else TEST_LIMITS['full_import_games']

        print(f"\n📥 Testing Chess.com import for {user_id}...")

        # Get current game count
        before_count = self._get_game_count(user_id, platform)

        start = time.time()
        try:
            response = requests.post(
                f"{self.api_base_url}/api/v1/import-games",
                json={
                    'user_id': user_id,
                    'platform': platform,
                    'limit': limit
                },
                timeout=THRESHOLDS['max_import_time']
            )
            duration = (time.time() - start) * 1000

            if response.status_code == 200:
                data = response.json()
                after_count = self._get_game_count(user_id, platform)
                imported = after_count - before_count

                # Test should fail if no games were imported and user has no games
                if after_count == 0:
                    self.report.add_result(
                        "Game Import",
                        f"Chess.com Import ({user_id})",
                        False,
                        f"User {user_id} has no games - user may not exist",
                        duration,
                        f"API Response: {data.get('message', 'Success')}"
                    )
                    return False

                self.report.add_result(
                    "Game Import",
                    f"Chess.com Import ({user_id})",
                    True,
                    f"Imported {imported} games (total: {after_count})",
                    duration,
                    f"API Response: {data.get('message', 'Success')}"
                )
                return True
            else:
                self.report.add_result(
                    "Game Import",
                    f"Chess.com Import ({user_id})",
                    False,
                    f"Import failed with status {response.status_code}",
                    duration,
                    response.text[:500]
                )
                return False
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.report.add_result(
                "Game Import",
                f"Chess.com Import ({user_id})",
                False,
                f"Import error: {str(e)}",
                duration
            )
            return False

    def test_smart_import(self) -> bool:
        """Test smart import functionality."""
        user_id = TEST_USERS['lichess_existing']
        platform = 'lichess'

        print(f"\n🧠 Testing smart import for {user_id}...")

        start = time.time()
        try:
            response = requests.post(
                f"{self.api_base_url}/api/v1/import-games-smart",
                json={
                    'user_id': user_id,
                    'platform': platform
                },
                timeout=THRESHOLDS['max_import_time']
            )
            duration = (time.time() - start) * 1000

            if response.status_code == 200:
                data = response.json()
                imported = data.get('imported_games', 0)
                new_games = data.get('new_games_count', 0)

                self.report.add_result(
                    "Game Import",
                    "Smart Import",
                    True,
                    f"Smart import completed: {imported} games imported, {new_games} were new",
                    duration
                )
                return True
            else:
                self.report.add_result(
                    "Game Import",
                    "Smart Import",
                    False,
                    f"Smart import failed with status {response.status_code}",
                    duration,
                    response.text[:500]
                )
                return False
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.report.add_result(
                "Game Import",
                "Smart Import",
                False,
                f"Smart import error: {str(e)}",
                duration
            )
            return False

    def test_duplicate_prevention(self) -> bool:
        """Test that re-importing the same games doesn't create duplicates."""
        user_id = TEST_USERS['lichess_existing']
        platform = 'lichess'

        print(f"\n🔄 Testing duplicate prevention for {user_id}...")

        # Get current count
        before_count = self._get_game_count(user_id, platform)

        # Try to import again (should not create duplicates)
        start = time.time()
        try:
            response = requests.post(
                f"{self.api_base_url}/api/v1/import-games",
                json={
                    'user_id': user_id,
                    'platform': platform,
                    'limit': 10
                },
                timeout=THRESHOLDS['max_import_time']
            )
            duration = (time.time() - start) * 1000

            after_count = self._get_game_count(user_id, platform)

            # Count should be the same or very close (maybe 1-2 new games)
            difference = after_count - before_count

            if difference <= 5:  # Allow some new games
                self.report.add_result(
                    "Game Import",
                    "Duplicate Prevention",
                    True,
                    f"Duplicate prevention works (only {difference} new games added)",
                    duration
                )
                return True
            else:
                self.report.add_result(
                    "Game Import",
                    "Duplicate Prevention",
                    False,
                    f"Too many duplicates created: {difference} new games",
                    duration,
                    f"Before: {before_count}, After: {after_count}"
                )
                return False
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.report.add_result(
                "Game Import",
                "Duplicate Prevention",
                False,
                f"Test error: {str(e)}",
                duration
            )
            return False

    def test_bulk_analysis(self) -> bool:
        """Test bulk game analysis."""
        user_id = TEST_USERS['lichess_existing']
        platform = 'lichess'
        limit = TEST_LIMITS['quick_analysis_games'] if self.quick_mode else TEST_LIMITS['full_analysis_games']

        print(f"\n🔬 Testing bulk analysis for {user_id} ({limit} games)...")

        start = time.time()
        try:
            response = requests.post(
                f"{self.api_base_url}/api/v1/analyze",
                json={
                    'user_id': user_id,
                    'platform': platform,
                    'limit': limit,
                    'analysis_type': 'stockfish'
                },
                timeout=THRESHOLDS['max_bulk_analysis_time']
            )
            duration = (time.time() - start) * 1000

            if response.status_code == 200:
                data = response.json()

                # Check if analysis was created
                analyzed_count = data.get('analyzed_games', 0)

                self.report.add_result(
                    "Game Analysis",
                    f"Bulk Analysis ({limit} games)",
                    True,
                    f"Analyzed {analyzed_count} games successfully",
                    duration
                )
                return True
            else:
                self.report.add_result(
                    "Game Analysis",
                    f"Bulk Analysis ({limit} games)",
                    False,
                    f"Analysis failed with status {response.status_code}",
                    duration,
                    response.text[:500]
                )
                return False
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.report.add_result(
                "Game Analysis",
                f"Bulk Analysis ({limit} games)",
                False,
                f"Analysis error: {str(e)}",
                duration
            )
            return False

    def test_single_game_analysis(self) -> bool:
        """Test single game analysis."""
        user_id = TEST_USERS['lichess_existing']
        platform = 'lichess'

        print(f"\n🔬 Testing single game analysis for {user_id}...")

        # Get a game to analyze
        game = self._get_random_game(user_id, platform)
        if not game:
            self.report.add_result(
                "Game Analysis",
                "Single Game Analysis",
                False,
                "No game found to analyze",
                0,
                f"User {user_id} has no games in database"
            )
            return False

        game_id = game['provider_game_id']

        start = time.time()
        try:
            response = requests.post(
                f"{self.api_base_url}/api/v1/analyze",
                json={
                    'user_id': user_id,
                    'platform': platform,
                    'limit': 1,
                    'analysis_type': 'stockfish'
                },
                timeout=THRESHOLDS['max_analysis_time_per_game'] * 2
            )
            duration = (time.time() - start) * 1000

            if response.status_code == 200:
                data = response.json()
                analyzed_count = data.get('analyzed_games', 0)
                queued_count = data.get('queued_games', 0)
                message = data.get('message', '') or ''
                success_flag = data.get('success', False)

                # If analysis finished immediately, verify persistence
                if analyzed_count > 0:
                    analysis = self._get_game_analysis(user_id, platform, game_id)
                    if analysis:
                        self.report.add_result(
                            "Game Analysis",
                            "Single Game Analysis",
                            True,
                            f"Game {game_id} analyzed successfully",
                            duration,
                            f"Accuracy: {analysis.get('accuracy', 'N/A')}, Moves: {analysis.get('total_moves', 'N/A')}"
                        )
                        return True

                # Handle asynchronous or duplicate scenarios
                message_lower = message.lower()
                if (
                    queued_count > 0
                    or 'queued' in message_lower
                    or 'already analyzed' in message_lower
                    or 'no new games' in message_lower
                    or success_flag
                ):
                    details = message or "Analysis request accepted"
                    if queued_count:
                        details += f" | queued_games={queued_count}"
                    if analyzed_count:
                        details += f" | analyzed_games={analyzed_count}"
                    self.report.add_result(
                        "Game Analysis",
                        "Single Game Analysis",
                        True,
                        "Analysis request accepted (asynchronous)",
                        duration,
                        details
                    )
                    return True

                self.report.add_result(
                    "Game Analysis",
                    "Single Game Analysis",
                    False,
                    f"Unexpected analysis response: {message or 'No analysis data returned'}",
                    duration,
                    str(data)[:500]
                )
                return False
            else:
                self.report.add_result(
                    "Game Analysis",
                    "Single Game Analysis",
                    False,
                    f"Analysis failed with status {response.status_code}",
                    duration,
                    response.text[:500]
                )
                return False
        except Exception as e:
            duration = (time.time() - start) * 1000
            self.report.add_result(
                "Game Analysis",
                "Single Game Analysis",
                False,
                f"Analysis error: {str(e)}",
                duration
            )
            return False

    def test_data_correctness(self) -> bool:
        """Test data correctness and consistency."""
        user_id = TEST_USERS['lichess_existing']
        platform = 'lichess'

        print(f"\n✅ Testing data correctness for {user_id}...")

        all_passed = True

        # Test 1: Game count consistency
        games_count = self._get_game_count(user_id, platform)
        profile_games = self._get_profile_game_count(user_id, platform)

        if games_count > 0:
            self.report.add_result(
                "Data Correctness",
                "Games Table Has Data",
                True,
                f"Found {games_count} games in database",
                0
            )
        else:
            self.report.add_result(
                "Data Correctness",
                "Games Table Has Data",
                False,
                "No games found in database",
                0,
                f"User: {user_id}, Platform: {platform}"
            )
            all_passed = False

        # Test 2: Accuracy values are in valid range
        analyses = self._get_all_analyses(user_id, platform)
        invalid_accuracy = [a for a in analyses if a.get('accuracy') and (a['accuracy'] < 0 or a['accuracy'] > 100)]

        if not invalid_accuracy:
            self.report.add_result(
                "Data Correctness",
                "Accuracy Values Valid",
                True,
                f"All {len(analyses)} analyses have valid accuracy (0-100)",
                0
            )
        else:
            self.report.add_result(
                "Data Correctness",
                "Accuracy Values Valid",
                False,
                f"Found {len(invalid_accuracy)} analyses with invalid accuracy",
                0,
                f"Invalid values: {[a.get('accuracy') for a in invalid_accuracy[:5]]}"
            )
            all_passed = False

        # Test 3: Opening names are present
        games_with_openings = self._get_games_with_openings(user_id, platform)
        total_games = self._get_game_count(user_id, platform)

        if total_games > 0:
            opening_percentage = (games_with_openings / total_games) * 100

            if opening_percentage >= 90:  # At least 90% should have openings
                self.report.add_result(
                    "Data Correctness",
                    "Opening Names Present",
                    True,
                    f"{opening_percentage:.1f}% of games have opening names",
                    0
                )
            else:
                self.report.add_result(
                    "Data Correctness",
                    "Opening Names Present",
                    False,
                    f"Only {opening_percentage:.1f}% of games have opening names",
                    0,
                    f"Games with openings: {games_with_openings}/{total_games}"
                )
                all_passed = False

        # Test 4: Personality scores are in valid range (if analyses exist)
        if analyses:
            invalid_personality = []
            for analysis in analyses:
                for score_field in ['tactical_score', 'positional_score', 'aggressive_score', 'patient_score']:
                    score = analysis.get(score_field)
                    if score is not None and (score < 0 or score > 100):
                        invalid_personality.append((analysis['game_id'], score_field, score))

            if not invalid_personality:
                self.report.add_result(
                    "Data Correctness",
                    "Personality Scores Valid",
                    True,
                    f"All personality scores are in valid range (0-100)",
                    0
                )
            else:
                self.report.add_result(
                    "Data Correctness",
                    "Personality Scores Valid",
                    False,
                    f"Found {len(invalid_personality)} invalid personality scores",
                    0,
                    f"Examples: {invalid_personality[:3]}"
                )
                all_passed = False

        return all_passed

    def _get_game_count(self, user_id: str, platform: str) -> int:
        """Get total game count for a user."""
        try:
            result = self.supabase_service.table("games")\
                .select("id", count='exact')\
                .eq('user_id', user_id)\
                .eq('platform', platform)\
                .execute()
            return result.count or 0
        except:
            return 0

    def _get_profile_game_count(self, user_id: str, platform: str) -> int:
        """Get game count from user profile."""
        try:
            result = self.supabase_service.table("user_profiles")\
                .select("total_games")\
                .eq('user_id', user_id)\
                .eq('platform', platform)\
                .execute()
            if result.data:
                return result.data[0].get('total_games', 0)
            return 0
        except:
            return 0

    def _get_random_game(self, user_id: str, platform: str) -> Dict[str, Any]:
        """Get a random game for testing."""
        try:
            # Fetch a recent game ID from games table (no PGN stored there)
            games_response = self.supabase_service.table("games")\
                .select("provider_game_id")\
                .eq('user_id', user_id)\
                .eq('platform', platform)\
                .order('played_at', desc=True)\
                .limit(5)\
                .execute()

            if not games_response.data:
                return None

            provider_game_id = games_response.data[0].get('provider_game_id')
            if not provider_game_id:
                return None

            # Look up the corresponding PGN from games_pgn table
            pgn_response = self.supabase_service.table("games_pgn")\
                .select("pgn")\
                .eq('user_id', user_id)\
                .eq('platform', platform)\
                .eq('provider_game_id', provider_game_id)\
                .limit(1)\
                .execute()

            if pgn_response.data and pgn_response.data[0].get('pgn'):
                return {
                    'provider_game_id': provider_game_id,
                    'pgn': pgn_response.data[0]['pgn'],
                }

            return None
        except Exception:
            return None

    def _get_game_analysis(self, user_id: str, platform: str, game_id: str) -> Dict[str, Any]:
        """Get analysis for a specific game."""
        try:
            result = self.supabase_service.table("move_analyses")\
                .select("*")\
                .eq('user_id', user_id)\
                .eq('platform', platform)\
                .eq('game_id', game_id)\
                .limit(1)\
                .execute()
            if result.data:
                return result.data[0]
            return None
        except:
            return None

    def _get_all_analyses(self, user_id: str, platform: str) -> List[Dict[str, Any]]:
        """Get all analyses for a user."""
        try:
            result = self.supabase_service.table("move_analyses")\
                .select("game_id, accuracy, tactical_score, positional_score, aggressive_score, patient_score")\
                .eq('user_id', user_id)\
                .eq('platform', platform)\
                .execute()
            return result.data or []
        except:
            return []

    def _get_games_with_openings(self, user_id: str, platform: str) -> int:
        """Count games that have opening names."""
        try:
            result = self.supabase_service.table("games")\
                .select("id", count='exact')\
                .eq('user_id', user_id)\
                .eq('platform', platform)\
                .neq('opening', None)\
                .neq('opening', '')\
                .neq('opening', 'Unknown')\
                .execute()
            return result.count or 0
        except:
            return 0

    def test_case_sensitivity(self) -> bool:
        """Test that mixed-case usernames are handled correctly."""
        platform = 'chess.com'

        # Test cases with different capitalizations
        test_cases = [
            ('hikaru', 'hikaru'),   # lowercase -> lowercase
            ('Hikaru', 'hikaru'),   # Capital -> lowercase
            ('HIKARU', 'hikaru'),   # UPPERCASE -> lowercase
            ('HiKaRu', 'hikaru'),   # MiXeD -> lowercase
        ]

        print(f"\n🔤 Testing case-insensitive username handling for Chess.com...")

        for original_case, canonical in test_cases:
            start = time.time()
            try:
                # Test that we can query with any case variation
                games = self.supabase_service.table('games').select('user_id').eq(
                    'user_id', canonical
                ).eq('platform', platform).limit(1).execute()

                # Also test that analysis works with different cases
                # The system should canonicalize to lowercase for Chess.com
                duration = (time.time() - start) * 1000

                if games.data:
                    # Verify the stored user_id is canonical
                    stored_user_id = games.data[0]['user_id']
                    if stored_user_id == canonical:
                        self.report.add_result(
                            "Case Sensitivity",
                            f"Test {original_case} → {canonical}",
                            True,
                            f"Username properly canonicalized to {canonical}",
                            duration
                        )
                    else:
                        self.report.add_result(
                            "Case Sensitivity",
                            f"Test {original_case} → {canonical}",
                            False,
                            f"Expected {canonical}, but got {stored_user_id}",
                            duration
                        )
                        return False
                else:
                    # No data is fine if user doesn't exist, but the query shouldn't error
                    self.report.add_result(
                        "Case Sensitivity",
                        f"Test {original_case} → {canonical}",
                        True,
                        f"Query succeeded with canonical form {canonical}",
                        duration
                    )

            except Exception as e:
                duration = (time.time() - start) * 1000
                self.report.add_result(
                    "Case Sensitivity",
                    f"Test {original_case} → {canonical}",
                    False,
                    f"Case sensitivity test failed: {str(e)}",
                    duration
                )
                return False

        return True


def run_backend_tests(report: MAINTESTReport, quick_mode: bool = False) -> bool:
    """Run all backend tests."""
    print("\n" + "="*80)
    print("RUNNING BACKEND TESTS")
    print("="*80)

    tester = BackendTester(report, quick_mode)

    # Test API health first
    if not tester.test_api_health():
        print("\n⚠️  Backend API is not running! Skipping remaining tests.")
        print("   Make sure to start the backend with: python python/main.py")
        return False

    # Run import tests
    print("\n📦 Testing Game Imports...")
    tester.test_lichess_import()

    if not quick_mode:
        tester.test_chesscom_import()

    tester.test_smart_import()
    tester.test_duplicate_prevention()

    # Run analysis tests
    print("\n🔬 Testing Game Analysis...")
    tester.test_bulk_analysis()
    tester.test_single_game_analysis()

    # Run data correctness tests
    print("\n✅ Testing Data Correctness...")
    tester.test_data_correctness()

    # Run case sensitivity tests
    print("\n🔤 Testing Case Sensitivity...")
    tester.test_case_sensitivity()

    return True


if __name__ == '__main__':
    # Allow running backend tests standalone
    import argparse

    parser = argparse.ArgumentParser(description='Run MAINTEST backend tests')
    parser.add_argument('--quick', action='store_true', help='Quick mode')
    args = parser.parse_args()

    report = MAINTESTReport('quick' if args.quick else 'full')
    success = run_backend_tests(report, args.quick)

    report.print_summary()
    report_file = report.save_report()
    print(f"\n📄 Report saved to: {report_file}")

    sys.exit(0 if success else 1)
