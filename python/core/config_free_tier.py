#!/usr/bin/env python3
"""
Configuration management for different deployment tiers.
Optimizes performance based on available resources.
"""

import os
from dataclasses import dataclass
from typing import Optional


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
    Determine the deployment tier from environment variables.
    
    Returns:
        str: 'free', 'starter', or 'production'
    """
    # Check explicit tier setting
    tier = os.getenv("DEPLOYMENT_TIER", "").lower()
    if tier in ["free", "starter", "production"]:
        return tier
    
    # Auto-detect based on Render environment
    if os.getenv("RENDER_FREE_TIER", "false").lower() == "true":
        return "free"
    
    # Check if running on Render at all
    if os.getenv("RENDER"):
        # Assume starter if not explicitly free
        return "starter"
    
    # Default to production for local/other deployments
    return "production"


def get_config() -> TierConfig:
    """
    Get the appropriate configuration for the current deployment tier.
    
    Returns:
        TierConfig: Configuration object for the current tier
    """
    tier = get_deployment_tier()
    
    config_map = {
        "free": FREE_TIER_CONFIG,
        "starter": STARTER_TIER_CONFIG,
        "production": PRODUCTION_TIER_CONFIG,
    }
    
    selected_config = config_map.get(tier, PRODUCTION_TIER_CONFIG)
    
    print(f"[Config] Using {tier.upper()} tier configuration:")
    print(f"  - Analysis depth: {selected_config.analysis_depth}")
    print(f"  - Time limit: {selected_config.time_limit}s")
    print(f"  - Max concurrent: {selected_config.max_concurrent_analyses}")
    print(f"  - Deep mode: {selected_config.enable_deep_mode}")
    
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


# Performance monitoring helpers
def get_estimated_analysis_time(num_moves: int) -> float:
    """
    Estimate analysis time for a game based on current tier.
    
    Args:
        num_moves: Number of moves in the game
        
    Returns:
        float: Estimated time in seconds
    """
    config = get_current_config()
    tier = get_deployment_tier()
    
    # Base time per move
    time_per_move = config.time_limit
    
    # CPU multiplier based on tier
    cpu_multiplier = {
        "free": 10.0,      # 0.1 CPU = 10x slower
        "starter": 2.0,    # 0.5 CPU = 2x slower
        "production": 1.0, # 1+ CPU = baseline
    }
    
    multiplier = cpu_multiplier.get(tier, 1.0)
    
    # Estimate total time (with some overhead)
    estimated_time = num_moves * time_per_move * multiplier * 1.2
    
    return estimated_time


def can_analyze_game(num_moves: int) -> tuple[bool, str]:
    """
    Check if a game can be analyzed within timeout limits.
    
    Args:
        num_moves: Number of moves in the game
        
    Returns:
        tuple: (can_analyze, reason)
    """
    config = get_current_config()
    estimated_time = get_estimated_analysis_time(num_moves)
    
    if estimated_time > config.timeout_seconds:
        return False, f"Game too long ({num_moves} moves). Estimated time: {estimated_time:.0f}s exceeds timeout: {config.timeout_seconds}s"
    
    return True, "OK"


def can_analyze_batch(num_games: int) -> tuple[bool, str]:
    """
    Check if a batch can be analyzed.
    
    Args:
        num_games: Number of games in batch
        
    Returns:
        tuple: (can_analyze, reason)
    """
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

