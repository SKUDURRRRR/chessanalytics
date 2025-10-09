#!/usr/bin/env python3
"""
Test script to verify move classification thresholds are correct
"""

import sys
sys.path.insert(0, 'python')

from python.core.analysis_engine import (
    BASIC_BEST_THRESHOLD,
    BASIC_INACCURACY_THRESHOLD,
    BASIC_MISTAKE_THRESHOLD,
    BASIC_BLUNDER_THRESHOLD
)

def test_thresholds():
    """Test that thresholds match Chess.com standards"""
    
    print("🔍 Testing Move Classification Thresholds\n")
    print("=" * 60)
    
    # Expected values (Chess.com standard)
    expected = {
        "BASIC_BEST_THRESHOLD": 5,
        "BASIC_INACCURACY_THRESHOLD": 100,
        "BASIC_MISTAKE_THRESHOLD": 200,
        "BASIC_BLUNDER_THRESHOLD": 200,
    }
    
    # Actual values
    actual = {
        "BASIC_BEST_THRESHOLD": BASIC_BEST_THRESHOLD,
        "BASIC_INACCURACY_THRESHOLD": BASIC_INACCURACY_THRESHOLD,
        "BASIC_MISTAKE_THRESHOLD": BASIC_MISTAKE_THRESHOLD,
        "BASIC_BLUNDER_THRESHOLD": BASIC_BLUNDER_THRESHOLD,
    }
    
    all_pass = True
    
    for name, expected_value in expected.items():
        actual_value = actual[name]
        status = "✅ PASS" if actual_value == expected_value else "❌ FAIL"
        
        if actual_value != expected_value:
            all_pass = False
            
        print(f"{name:30s}: {actual_value:3d} (expected: {expected_value:3d}) {status}")
    
    print("=" * 60)
    
    # Test classification logic
    print("\n🧪 Testing Classification Logic\n")
    print("=" * 60)
    
    test_cases = [
        (5, "Best", "0-5cp should be Best"),
        (10, "Great", "5-15cp should be Great"),
        (20, "Excellent", "15-25cp should be Excellent"),
        (40, "Good", "25-50cp should be Good"),
        (75, "Inaccuracy", "50-100cp should be Inaccuracy"),
        (150, "Mistake", "100-200cp should be Mistake"),
        (250, "Blunder", "200+cp should be Blunder"),
        (500, "Blunder", "400+cp should be Blunder (was incorrectly required before)"),
    ]
    
    for cp_loss, expected_class, description in test_cases:
        # Determine classification based on thresholds
        if cp_loss <= BASIC_BEST_THRESHOLD:
            actual_class = "Best"
        elif cp_loss <= 50:
            if cp_loss <= 15:
                actual_class = "Great"
            elif cp_loss <= 25:
                actual_class = "Excellent"
            else:
                actual_class = "Good"
        elif cp_loss <= BASIC_INACCURACY_THRESHOLD:
            actual_class = "Inaccuracy"
        elif cp_loss <= BASIC_MISTAKE_THRESHOLD:
            actual_class = "Mistake"
        else:
            actual_class = "Blunder"
        
        status = "✅ PASS" if actual_class == expected_class else "❌ FAIL"
        
        if actual_class != expected_class:
            all_pass = False
            
        print(f"{cp_loss:3d}cp -> {actual_class:12s} (expected: {expected_class:12s}) {status}")
        print(f"       {description}")
    
    print("=" * 60)
    
    if all_pass:
        print("\n✅ ALL TESTS PASSED - Thresholds correctly aligned with Chess.com!")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED - Thresholds need adjustment!")
        return 1

if __name__ == "__main__":
    sys.exit(test_thresholds())

