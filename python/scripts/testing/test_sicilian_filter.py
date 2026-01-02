#!/usr/bin/env python3
"""Test if Sicilian Defense filter is working"""

def _should_count_opening_for_color(opening: str, player_color: str) -> bool:
    opening_lower = opening.lower()

    # Black openings (defenses) - only count when player is black
    black_openings = [
        'sicilian', 'french', 'caro-kann', 'pirc', 'modern defense',
        'scandinavian', 'alekhine', 'nimzowitsch defense', 'petrov', 'philidor',
    ]

    # Check if it's a black opening
    for black_op in black_openings:
        if black_op in opening_lower:
            return player_color == 'black'

    # Heuristics
    if 'defense' in opening_lower or 'defence' in opening_lower:
        return player_color == 'black'

    # Neutral or unknown - count for both
    return True

# Test cases
test_cases = [
    ("Sicilian Defense", "white", False, "Should be filtered out for white"),
    ("Sicilian Defense", "black", True, "Should be included for black"),
    ("Italian Game", "white", True, "Should be included for white"),
]

print("Testing _should_count_opening_for_color for Sicilian Defense:")
print("=" * 70)
all_passed = True
for opening, color, expected, description in test_cases:
    result = _should_count_opening_for_color(opening, color)
    passed = result == expected
    status = "PASS" if passed else "FAIL"
    if not passed:
        all_passed = False
    print(f"{status} | {opening:20s} | Color: {color:5s} | Result: {result:5s} | Expected: {expected:5s} | {description}")

print("=" * 70)
if all_passed:
    print("All tests passed! Filter should work correctly.")
else:
    print("Some tests failed! Filter may have issues.")
