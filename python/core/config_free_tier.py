#!/usr/bin/env python3
"""
Configuration management for different deployment tiers.
Optimizes performance based on available resources.

Security Features:
- Input validation
- Safe tier detection
- Validated environment variables
"""

import os
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class TierConfig:
    """Configuration for a specific deployment tier."""
    # Analysis settings
    analysis_depth: int
    skill_level: int
    time_limit: float
    threads: int
    hash_size: int  # MB
    max_concurrent_analyses: int
    enable_deep_mode: bool
    max_batch_size: int

    # API settings
    timeout_seconds: int
    rate_limit_per_hour: int

    # Feature flags
    enable_caching: bool
    enable_progress_updates: bool


# Free Tier Configuration (Render Free: 0.1 CPU, 512 MB RAM)
FREE_TIER_CONFIG = TierConfig(
    # Analysis settings - optimized for 0.1 CPU
    analysis_depth=8,           # Reduced from 12 (40% faster)
    skill_level=8,              # Reduced from 10 (20% faster)
    time_limit=0.3,             # Reduced from 0.5 (40% faster)
    threads=1,                  # Single thread (no benefit from multi-threading)
    hash_size=16,               # Reduced from 32 MB (save memory)
    max_concurrent_analyses=1,  # Prevent memory exhaustion
    enable_deep_mode=False,     # Disable deep analysis on free tier
    max_batch_size=3,           # Limit batch analyses

    # API settings
    timeout_seconds=180,        # 3 minutes max per analysis
    rate_limit_per_hour=20,     # Prevent abuse

    # Feature flags
    enable_caching=True,        # Cache results to reduce load
    enable_progress_updates=True,  # Show progress for long analyses
)


# Starter Tier Configuration (Render Starter: 0.5 CPU, 512 MB RAM)
STARTER_TIER_CONFIG = TierConfig(
    # Analysis settings - balanced performance
    analysis_depth=10,
    skill_level=10,
    time_limit=0.4,
    threads=1,
    hash_size=32,
    max_concurrent_analyses=2,
    enable_deep_mode=True,
    max_batch_size=5,

    # API settings
    timeout_seconds=240,        # 4 minutes
    rate_limit_per_hour=50,

    # Feature flags
    enable_caching=True,
    enable_progress_updates=True,
)


# Railway Hobby Tier Configuration (8 GB RAM, 8 vCPU)
# Phase 1: Speed + Accuracy optimizations
RAILWAY_HOBBY_CONFIG = TierConfig(
    # Analysis settings - optimized for Railway Hobby tier
    analysis_depth=14,          # Increased from 12 (better accuracy)
    skill_level=20,             # Maximum strength (not 10!)
    time_limit=0.8,             # Faster than 1.0s
    threads=1,                  # Deterministic (not 4!)
    hash_size=96,               # Better balance (not 128)
    max_concurrent_analyses=4,  # Conservative for vCPU (not 6)
    enable_deep_mode=True,      # Enable deep analysis
    max_batch_size=10,          # Larger batches

    # API settings
    timeout_seconds=300,        # 5 minutes
    rate_limit_per_hour=200,    # Higher rate limit

    # Feature flags
    enable_caching=True,
    enable_progress_updates=True,
)

# Railway Pro Tier Configuration (Railway Pro: Unlimited hours, scalable resources)
# Optimized configuration with memory-efficient engine pooling and caching
# After memory optimizations: baseline ~400 MB (down from 1.4 GB)
# Speed optimizations: Phase-based time limits, skip redundant analysis, opening book, caching
RAILWAY_PRO_CONFIG = TierConfig(
    # Analysis settings - optimized for Railway Pro with memory efficiency and speed
    analysis_depth=14,          # High accuracy
    skill_level=20,             # Maximum strength
    time_limit=0.3,             # Base time limit (phase-based system uses 0.1s-0.5s dynamically)
    threads=1,                  # Deterministic results
    hash_size=96,               # Balanced for pooled engines
    max_concurrent_analyses=4,  # Conservative start (can increase to 6-8 after monitoring)
    enable_deep_mode=True,      # Full deep analysis support
    max_batch_size=10,          # Can increase to 15-20 after monitoring

    # API settings
    timeout_seconds=300,        # 5 minutes
    rate_limit_per_hour=500,    # Higher rate limit for Pro tier

    # Feature flags
    enable_caching=True,
    enable_progress_updates=True,
)

# Production Tier Configuration (Render Standard: 1+ CPU, 1+ GB RAM)
PRODUCTION_TIER_CONFIG = TierConfig(
    # Analysis settings - full performance
    analysis_depth=12,
    skill_level=10,
    time_limit=0.5,
    threads=2,
    hash_size=64,
    max_concurrent_analyses=4,
    enable_deep_mode=True,
    max_batch_size=10,

    # API settings
    timeout_seconds=300,        # 5 minutes
    rate_limit_per_hour=100,

    # Feature flags
    enable_caching=True,
    enable_progress_updates=True,
)


def get_deployment_tier() -> str:
    """
    Determine the deployment tier from environment variables with validation.

    Returns:
        str: 'free', 'starter', 'production', 'railway_hobby', or 'railway_pro'

    Note:
        Falls back to 'production' if tier cannot be determined.
        This ensures safe operation in unknown environments.
    """
    # Check explicit tier setting
    tier = os.getenv("DEPLOYMENT_TIER", "").lower().strip()
    valid_tiers = ["free", "starter", "production", "railway_hobby", "railway_pro"]

    if tier in valid_tiers:
        logger.info(f"Explicit DEPLOYMENT_TIER set to: {tier}")
        return tier

    # Check for Railway Pro tier with validation
    railway_env = os.getenv("RAILWAY_ENVIRONMENT", "").strip()
    if railway_env:
        logger.debug(f"Railway environment detected: {railway_env}")
        railway_tier = os.getenv("RAILWAY_TIER", "").lower().strip()
        if railway_tier == "pro":
            logger.info("Detected Railway Pro tier")
            return "railway_pro"
        elif railway_tier == "hobby":
            logger.info("Detected Railway Hobby tier")
            return "railway_hobby"
        else:
            logger.warning(f"Unknown RAILWAY_TIER: {railway_tier}, defaulting to railway_hobby")
            return "railway_hobby"

    # Auto-detect based on Render environment
    render_free = os.getenv("RENDER_FREE_TIER", "false").lower().strip()
    if render_free == "true":
        logger.info("Detected Render Free tier")
        return "free"

    # Check if running on Render at all
    if os.getenv("RENDER"):
        logger.info("Detected Render (non-free), using starter tier")
        # Assume starter if not explicitly free
        return "starter"

    # Default to production for local/other deployments
    logger.info("No tier detected, defaulting to production")
    return "production"


def get_config() -> TierConfig:
    """
    Get the appropriate configuration for the current deployment tier with validation.

    Returns:
        TierConfig: Configuration object for the current tier

    Note:
        Always returns a valid configuration, falling back to production config
        if tier is unknown (defensive programming).
    """
    tier = get_deployment_tier()

    config_map = {
        "free": FREE_TIER_CONFIG,
        "starter": STARTER_TIER_CONFIG,
        "production": PRODUCTION_TIER_CONFIG,
        "railway_hobby": RAILWAY_HOBBY_CONFIG,
        "railway_pro": RAILWAY_PRO_CONFIG,
    }

    selected_config = config_map.get(tier, PRODUCTION_TIER_CONFIG)

    if tier not in config_map:
        logger.warning(f"Unknown tier '{tier}', using PRODUCTION_TIER_CONFIG as fallback")

    logger.info(f"Using {tier.upper()} tier configuration:")
    logger.info(f"  - Analysis depth: {selected_config.analysis_depth}")
    logger.info(f"  - Time limit: {selected_config.time_limit}s")
    logger.info(f"  - Max concurrent: {selected_config.max_concurrent_analyses}")
    logger.info(f"  - Deep mode: {selected_config.enable_deep_mode}")

    return selected_config


# Global config instance
current_config: Optional[TierConfig] = None


def initialize_config() -> TierConfig:
    """Initialize and return the global configuration."""
    global current_config
    if current_config is None:
        current_config = get_config()
    return current_config


def get_current_config() -> TierConfig:
    """Get the current configuration (initialize if needed)."""
    if current_config is None:
        return initialize_config()
    return current_config


def reset_config() -> None:
    """Reset the cached configuration. Useful for testing or when environment changes."""
    global current_config
    current_config = None


# Performance monitoring helpers
def get_estimated_analysis_time(num_moves: int) -> float:
    """
    Estimate analysis time for a game based on current tier with validation.

    Args:
        num_moves: Number of moves in the game (must be positive)

    Returns:
        float: Estimated time in seconds

    Raises:
        ValueError: If num_moves is invalid
    """
    if not isinstance(num_moves, int) or num_moves <= 0:
        raise ValueError("num_moves must be a positive integer")
    if num_moves > 1000:
        raise ValueError("num_moves cannot exceed 1000 (unreasonably long game)")

    config = get_current_config()
    tier = get_deployment_tier()

    # Base time per move
    time_per_move = config.time_limit

    # CPU multiplier based on tier
    cpu_multiplier = {
        "free": 10.0,      # 0.1 CPU = 10x slower
        "starter": 2.0,    # 0.5 CPU = 2x slower
        "production": 1.0, # 1+ CPU = baseline
        "railway_hobby": 0.8,  # Faster CPU
        "railway_pro": 0.8,    # Faster CPU
    }

    multiplier = cpu_multiplier.get(tier, 1.0)

    # Estimate total time (with some overhead)
    estimated_time = num_moves * time_per_move * multiplier * 1.2

    return estimated_time


def can_analyze_game(num_moves: int) -> tuple[bool, str]:
    """
    Check if a game can be analyzed within timeout limits with validation.

    Args:
        num_moves: Number of moves in the game (must be positive)

    Returns:
        tuple: (can_analyze, reason)

    Raises:
        ValueError: If num_moves is invalid
    """
    if not isinstance(num_moves, int) or num_moves <= 0:
        raise ValueError("num_moves must be a positive integer")

    config = get_current_config()

    try:
        estimated_time = get_estimated_analysis_time(num_moves)
    except ValueError as e:
        return False, str(e)

    if estimated_time > config.timeout_seconds:
        return False, f"Game too long ({num_moves} moves). Estimated time: {estimated_time:.0f}s exceeds timeout: {config.timeout_seconds}s"

    return True, "OK"


def can_analyze_batch(num_games: int) -> tuple[bool, str]:
    """
    Check if a batch can be analyzed with validation.

    Args:
        num_games: Number of games in batch (must be positive)

    Returns:
        tuple: (can_analyze, reason)

    Raises:
        ValueError: If num_games is invalid
    """
    if not isinstance(num_games, int) or num_games <= 0:
        raise ValueError("num_games must be a positive integer")
    if num_games > 100:
        raise ValueError("num_games cannot exceed 100 (safety limit)")

    config = get_current_config()

    if num_games > config.max_batch_size:
        return False, f"Batch size ({num_games}) exceeds maximum ({config.max_batch_size})"

    return True, "OK"


if __name__ == "__main__":
    # Test configuration
    print("\n=== Configuration Test ===\n")

    config = get_current_config()

    print(f"\nEstimated analysis times:")
    for moves in [20, 40, 60, 80]:
        time = get_estimated_analysis_time(moves)
        can_analyze, reason = can_analyze_game(moves)
        status = "✓" if can_analyze else "✗"
        print(f"  {status} {moves} moves: {time:.1f}s - {reason}")

    print(f"\nBatch analysis limits:")
    for batch_size in [1, 3, 5, 10]:
        can_analyze, reason = can_analyze_batch(batch_size)
        status = "✓" if can_analyze else "✗"
        print(f"  {status} {batch_size} games: {reason}")
