#!/usr/bin/env python3
"""
Test script to verify tier detection and configuration loading.
Run this to test the configuration system without starting the full API server.
"""

import os
import sys
from pathlib import Path

# Add python directory to path
python_dir = Path(__file__).resolve().parent / "python"
sys.path.insert(0, str(python_dir))

def test_tier_detection():
    """Test tier detection logic."""
    print("=" * 60)
    print("TIER DETECTION TEST")
    print("=" * 60)

    from core.config_free_tier import get_deployment_tier, get_current_config

    # Show current environment variables
    print("\nRelevant Environment Variables:")
    env_vars = [
        "DEPLOYMENT_TIER",
        "RAILWAY_TIER",
        "RAILWAY_ENVIRONMENT",
        "RENDER",
        "RENDER_FREE_TIER"
    ]

    for var in env_vars:
        value = os.getenv(var)
        if value:
            print(f"  {var} = {value}")
        else:
            print(f"  {var} = (not set)")

    # Test tier detection
    print("\nDetected Tier:")
    tier = get_deployment_tier()
    print(f"  {tier}")

    # Show tier configuration
    print("\nTier Configuration:")
    config = get_current_config()
    print(f"  Analysis Depth: {config.analysis_depth}")
    print(f"  Skill Level: {config.skill_level}")
    print(f"  Time Limit: {config.time_limit}s")
    print(f"  Threads: {config.threads}")
    print(f"  Hash Size: {config.hash_size} MB")
    print(f"  Max Concurrent: {config.max_concurrent_analyses}")
    print(f"  Deep Mode: {config.enable_deep_mode}")
    print(f"  Batch Size: {config.max_batch_size}")
    print(f"  Timeout: {config.timeout_seconds}s")
    print(f"  Rate Limit: {config.rate_limit_per_hour}/hour")

    return tier, config

def test_config_loading():
    """Test full configuration loading."""
    print("\n" + "=" * 60)
    print("CONFIGURATION LOADING TEST")
    print("=" * 60)

    from core.config import get_config

    config = get_config()

    # This will print the full configuration summary
    config.print_summary()

    return config

def test_with_environment_override():
    """Test configuration with environment variable overrides."""
    print("\n" + "=" * 60)
    print("ENVIRONMENT OVERRIDE TEST")
    print("=" * 60)

    # Set test environment variables
    print("\nSetting test environment variables:")
    test_vars = {
        "DEPLOYMENT_TIER": "railway_pro",
        "STOCKFISH_DEPTH": "16",
        "STOCKFISH_SKILL_LEVEL": "18"
    }

    for key, value in test_vars.items():
        print(f"  {key} = {value}")
        os.environ[key] = value

    # Reload configuration
    from core.config import reload_config
    config = reload_config()

    print("\nConfiguration after override:")
    print(f"  Tier: {config.stockfish.tier}")
    print(f"  Depth: {config.stockfish.depth}")
    print(f"  Skill Level: {config.stockfish.skill_level}")
    print(f"  Rate Limit: {config.analysis.rate_limit_per_hour}/hour")

    # Verify overrides worked
    assert config.stockfish.depth == 16, "Depth override failed"
    assert config.stockfish.skill_level == 18, "Skill level override failed"
    assert config.analysis.rate_limit_per_hour == 500, "Rate limit should be 500 for railway_pro"

    print("\n[OK] All overrides applied correctly!")

    return config

def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("CHESS ANALYTICS CONFIGURATION TEST SUITE")
    print("=" * 60)

    try:
        # Test 1: Tier detection
        tier, tier_config = test_tier_detection()

        # Test 2: Full configuration loading
        full_config = test_config_loading()

        # Test 3: Environment overrides
        override_config = test_with_environment_override()

        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"[OK] Tier Detection: {tier}")
        print(f"[OK] Configuration Loading: Success")
        print(f"[OK] Environment Overrides: Success")
        print(f"[OK] Rate Limit (Pro): {override_config.analysis.rate_limit_per_hour}/hour")

        print("\n" + "=" * 60)
        print("ALL TESTS PASSED!")
        print("=" * 60)

        # Provide recommendations
        print("\n[!] RECOMMENDATIONS:")
        if tier != "railway_pro":
            print("[!] Current tier is not 'railway_pro'")
            print("   To enable Railway Pro configuration:")
            print("   1. Set RAILWAY_TIER=pro in Railway dashboard")
            print("   2. Or set DEPLOYMENT_TIER=railway_pro")
            print("   3. Redeploy your service")
        else:
            print("[OK] Railway Pro tier detected correctly!")
            print("   Rate limit: 500/hour")
            print("   All Pro features enabled!")

        return 0

    except Exception as e:
        print(f"\n[ERROR] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
