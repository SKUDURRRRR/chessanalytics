#!/usr/bin/env python3
"""
Performance Configuration Module
Provides optimized settings for different analysis types and resource constraints.
"""

import os
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any

class PerformanceProfile(Enum):
    """Performance profiles - Railway Hobby Tier only."""
    RAILWAY_HOBBY = "railway_hobby"        # Railway Hobby tier optimization (default)

@dataclass
class AnalysisPerformanceConfig:
    """Configuration for analysis performance optimization - Railway Hobby Tier (8 GB RAM, 8 vCPU)."""
    
    # Stockfish Engine Settings - Railway Hobby
    stockfish_depth: int = 14              # Better depth for accuracy
    stockfish_skill_level: int = 20        # Maximum strength
    stockfish_time_limit: float = 0.8      # Fast analysis
    stockfish_threads: int = 1             # Deterministic
    stockfish_hash_size: int = 96          # MB - Better balance
    
    # Parallel Processing - Railway Hobby
    max_concurrent_analyses: int = 4       # Parallel move processing
    batch_size: int = 10                   # Larger batches
    parallel_analysis: bool = True         # Enable parallel
    
    # Memory Management - Railway Hobby
    max_memory_usage_mb: int = 3072        # 3GB max (conservative)
    cleanup_interval_minutes: int = 30     # Regular cleanup
    
    # Database Optimization - Railway Hobby
    batch_insert_size: int = 100           # Efficient operations
    connection_pool_size: int = 15         # More connections
    query_timeout_seconds: int = 45        # Longer timeouts
    
    # Caching - Railway Hobby
    enable_analysis_cache: bool = True     # Enable caching
    cache_ttl_hours: int = 24              # 24 hour cache
    max_cache_size_mb: int = 256           # 256 MB cache
    
    # Resource Limits - Railway Hobby
    max_games_per_request: int = 50        # More games per request
    max_analysis_time_per_game: int = 300  # 5 minutes per game
    max_total_analysis_time: int = 3600    # 1 hour total
    
    @classmethod
    def for_profile(cls, profile: PerformanceProfile) -> 'AnalysisPerformanceConfig':
        """Get configuration for Railway Hobby tier (only option)."""
        # Only Railway Hobby tier is supported - always return same config
        return cls(
            stockfish_depth=14,              # Better depth for accuracy
            stockfish_skill_level=20,        # Maximum strength
            stockfish_time_limit=0.8,        # Fast analysis
            stockfish_threads=1,             # Deterministic
            stockfish_hash_size=96,          # Better balance
            max_concurrent_analyses=4,       # Parallel move processing
            batch_size=10,                   # Larger batches
            parallel_analysis=True,          # Enable parallel processing
            max_memory_usage_mb=3072,        # 3GB max (conservative)
            cleanup_interval_minutes=30,     # Regular cleanup
            batch_insert_size=100,           # Efficient database operations
            connection_pool_size=15,         # More connections
            query_timeout_seconds=45,        # Longer timeouts
            enable_analysis_cache=True,      # Enable caching
            cache_ttl_hours=24,              # 24 hour cache
            max_cache_size_mb=256,           # 256 MB cache
            max_games_per_request=50,        # More games per request
            max_analysis_time_per_game=300,  # 5 minutes per game
            max_total_analysis_time=3600     # 1 hour total
        )
    
    def to_stockfish_config(self) -> Dict[str, Any]:
        """Convert to Stockfish engine configuration."""
        return {
            "depth": self.stockfish_depth,
            "skill_level": self.stockfish_skill_level,
            "time_limit": self.stockfish_time_limit,
            "threads": self.stockfish_threads,
            "hash_size": self.stockfish_hash_size
        }
    
    def to_parallel_config(self) -> Dict[str, Any]:
        """Convert to parallel processing configuration."""
        return {
            "max_concurrent": self.max_concurrent_analyses,
            "batch_size": self.batch_size,
            "enabled": self.parallel_analysis
        }
    
    def to_database_config(self) -> Dict[str, Any]:
        """Convert to database configuration."""
        return {
            "batch_insert_size": self.batch_insert_size,
            "connection_pool_size": self.connection_pool_size,
            "query_timeout": self.query_timeout_seconds
        }
    
    def to_cache_config(self) -> Dict[str, Any]:
        """Convert to caching configuration."""
        return {
            "enabled": self.enable_analysis_cache,
            "ttl_hours": self.cache_ttl_hours,
            "max_size_mb": self.max_cache_size_mb
        }
    
    def validate(self) -> bool:
        """Validate configuration settings."""
        if self.stockfish_depth < 1 or self.stockfish_depth > 20:
            return False
        if self.stockfish_skill_level < 0 or self.stockfish_skill_level > 20:
            return False
        if self.stockfish_time_limit < 0.1 or self.stockfish_time_limit > 10.0:
            return False
        if self.stockfish_threads < 1 or self.stockfish_threads > 16:
            return False
        if self.max_concurrent_analyses < 1 or self.max_concurrent_analyses > 20:
            return False
        if self.batch_size < 1 or self.batch_size > 100:
            return False
        if self.max_games_per_request < 1 or self.max_games_per_request > 1000:
            return False
        return True

def get_performance_config() -> AnalysisPerformanceConfig:
    """Get performance configuration - Railway Hobby only."""
    # Always use Railway Hobby tier
    profile = PerformanceProfile.RAILWAY_HOBBY
    config = AnalysisPerformanceConfig.for_profile(profile)
    
    # Override with environment variables if present
    if os.getenv("STOCKFISH_DEPTH"):
        config.stockfish_depth = int(os.getenv("STOCKFISH_DEPTH"))
    if os.getenv("STOCKFISH_SKILL_LEVEL"):
        config.stockfish_skill_level = int(os.getenv("STOCKFISH_SKILL_LEVEL"))
    if os.getenv("STOCKFISH_TIME_LIMIT"):
        config.stockfish_time_limit = float(os.getenv("STOCKFISH_TIME_LIMIT"))
    if os.getenv("STOCKFISH_THREADS"):
        config.stockfish_threads = int(os.getenv("STOCKFISH_THREADS"))
    if os.getenv("MAX_CONCURRENT_ANALYSES"):
        config.max_concurrent_analyses = int(os.getenv("MAX_CONCURRENT_ANALYSES"))
    if os.getenv("BATCH_SIZE"):
        config.batch_size = int(os.getenv("BATCH_SIZE"))
    if os.getenv("MAX_GAMES_PER_REQUEST"):
        config.max_games_per_request = int(os.getenv("MAX_GAMES_PER_REQUEST"))
    
    # Validate configuration
    if not config.validate():
        print("Warning: Invalid performance configuration, using Railway Hobby defaults")
    
    return config

def print_performance_config(config: AnalysisPerformanceConfig):
    """Print performance configuration for debugging."""
    print("=== Analysis Performance Configuration ===")
    print(f"Stockfish Depth: {config.stockfish_depth}")
    print(f"Stockfish Skill Level: {config.stockfish_skill_level}")
    print(f"Stockfish Time Limit: {config.stockfish_time_limit}s")
    print(f"Stockfish Threads: {config.stockfish_threads}")
    print(f"Stockfish Hash Size: {config.stockfish_hash_size}MB")
    print(f"Max Concurrent Analyses: {config.max_concurrent_analyses}")
    print(f"Batch Size: {config.batch_size}")
    print(f"Parallel Analysis: {config.parallel_analysis}")
    print(f"Max Memory Usage: {config.max_memory_usage_mb}MB")
    print(f"Max Games Per Request: {config.max_games_per_request}")
    print(f"Analysis Cache Enabled: {config.enable_analysis_cache}")
    print("==========================================")

# Global configuration instance
performance_config = get_performance_config()

if __name__ == "__main__":
    print_performance_config(performance_config)
