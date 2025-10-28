#!/usr/bin/env python3
"""
Test suite to verify the time control categorization fix.
Tests the corrected implementation against common chess time control formats.
"""

import sys
import os

# Add parent directory to path to import from python/core
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python'))

from core.unified_api_server import _get_time_control_category


def test_time_control_categories():
    """Test time control categorization with comprehensive test cases."""

    test_cases = [
        # Format: (input, expected_category, description)

        # Pre-labeled categories
        ('bullet', 'Bullet', 'Pre-labeled bullet'),
        ('blitz', 'Blitz', 'Pre-labeled blitz'),
        ('rapid', 'Rapid', 'Pre-labeled rapid'),
        ('classical', 'Classical', 'Pre-labeled classical'),
        ('correspondence', 'Correspondence', 'Pre-labeled correspondence'),

        # Bullet games (< 3 minutes)
        ('60+0', 'Bullet', '1+0 bullet'),
        ('60+1', 'Bullet', '1+1 bullet'),
        ('120+0', 'Bullet', '2+0 bullet'),
        ('120+1', 'Bullet', '2+1 bullet'),
        ('180+0', 'Blitz', '3+0 blitz (NOT bullet - boundary case)'),

        # Blitz games (3-8 minutes)
        ('180+0', 'Blitz', '3+0 blitz'),
        ('180+2', 'Blitz', '3+2 blitz'),
        ('300+0', 'Blitz', '5+0 blitz'),
        ('300+3', 'Blitz', '5+3 blitz'),

        # Rapid games (8-25 minutes)
        ('600+0', 'Rapid', '10+0 rapid'),
        ('600+5', 'Rapid', '10+5 rapid'),
        ('900+0', 'Rapid', '15+0 rapid'),
        ('900+10', 'Rapid', '15+10 rapid'),
        ('1200+0', 'Rapid', '20+0 rapid'),

        # Classical games (25+ minutes)
        ('1800+0', 'Classical', '30+0 classical - CRITICAL BUG FIX'),
        ('1800+20', 'Classical', '30+20 classical'),
        ('3600+0', 'Classical', '60+0 classical'),

        # Edge cases
        ('', 'Unknown', 'Empty string'),
        ('unknown', 'Unknown', 'Unknown string'),
        ('-', 'Correspondence', 'Lichess correspondence format'),
        ('1/1', 'Correspondence', 'Correspondence with day format'),
        ('180/60/300', 'Correspondence', 'Fischer increment format'),

        # Minutes format (less common)
        ('3+0', 'Blitz', '3 minutes blitz'),
        ('5+0', 'Blitz', '5 minutes blitz'),
        ('10+0', 'Rapid', '10 minutes rapid'),
        ('15+10', 'Rapid', '15+10 rapid'),
        ('30+0', 'Classical', '30 minutes classical'),

        # Number-only formats
        ('60', 'Bullet', '60 seconds bullet'),
        ('180', 'Blitz', '180 seconds blitz'),
        ('600', 'Rapid', '600 seconds rapid'),
        ('1800', 'Classical', '1800 seconds classical'),
    ]

    print('=' * 80)
    print('TIME CONTROL CATEGORIZATION TEST SUITE')
    print('=' * 80)
    print()

    passed = 0
    failed = 0
    failures = []

    for time_control, expected, description in test_cases:
        result = _get_time_control_category(time_control)

        if result == expected:
            passed += 1
            status = 'PASS'
            symbol = 'OK'
        else:
            failed += 1
            status = 'FAIL'
            symbol = 'XX'
            failures.append((time_control, expected, result, description))

        # Format output nicely
        tc_display = f'"{time_control}"' if time_control else '(empty)'
        print(f'{symbol} {status:6} | {tc_display:20} -> {result:15} | {description}')

    print()
    print('=' * 80)
    print(f'RESULTS: {passed} passed, {failed} failed out of {len(test_cases)} tests')
    print(f'Success rate: {passed/len(test_cases)*100:.1f}%')
    print('=' * 80)

    if failures:
        print()
        print('FAILURES:')
        print('-' * 80)
        for tc, expected, actual, desc in failures:
            print(f'  Input:    "{tc}"')
            print(f'  Expected: {expected}')
            print(f'  Got:      {actual}')
            print(f'  Test:     {desc}')
            print()

    return failed == 0


def test_critical_bug_cases():
    """Test the specific bugs that CodeRabbit identified."""
    print()
    print('=' * 80)
    print('CRITICAL BUG CASES (from CodeRabbit report)')
    print('=' * 80)
    print()

    critical_cases = [
        ('1800+0', 'Classical', 'Bug: "60" in "1800" triggered Bullet'),
        ('600+5', 'Rapid', 'Bug: "60" in "600" triggered Bullet'),
        ('180/60/300', 'Correspondence', 'Bug: Multiple substring matches'),
    ]

    all_passed = True

    for time_control, expected, bug_desc in critical_cases:
        result = _get_time_control_category(time_control)
        passed = result == expected

        symbol = 'OK' if passed else 'XX'
        status = 'FIXED' if passed else 'STILL BROKEN'

        print(f'{symbol} {status:15} | "{time_control}" -> {result} (expected: {expected})')
        print(f'  {bug_desc}')
        print()

        if not passed:
            all_passed = False

    return all_passed


if __name__ == '__main__':
    print()

    # Run main test suite
    main_passed = test_time_control_categories()

    # Run critical bug tests
    critical_passed = test_critical_bug_cases()

    # Final summary
    print('=' * 80)
    print('FINAL SUMMARY')
    print('=' * 80)
    print(f'Main test suite:     {"PASS" if main_passed else "FAIL"}')
    print(f'Critical bug fixes:  {"PASS" if critical_passed else "FAIL"}')
    print(f'Overall:             {"ALL TESTS PASSED" if (main_passed and critical_passed) else "SOME TESTS FAILED"}')
    print('=' * 80)
    print()

    # Exit with appropriate code
    sys.exit(0 if (main_passed and critical_passed) else 1)
