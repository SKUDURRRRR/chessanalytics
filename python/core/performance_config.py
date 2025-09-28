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
    """Performance profiles for different use cases."""
    DEVELOPMENT = "development"      # Fast, minimal resources
    PRODUCTION = "production"        # Balanced performance/cost
    HIGH_PERFORMANCE = "high_performance"  # Maximum performance
    COST_OPTIMIZED = "cost_optimized"      # Minimum cost

@dataclass
class AnalysisPerformanceConfig:
    """Configuration for analysis performance optimization."""
    
    # Stockfish Engine Settings
    stockfish_depth: int = 8
    stockfish_skill_level: int = 8
    stockfish_time_limit: float = 1.0
    stockfish_threads: int = 1
    stockfish_hash_size: int = 64  # MB
    
    # Parallel Processing
    max_concurrent_analyses: int = 4
    batch_size: int = 10
    parallel_analysis: bool = True
    
    # Memory Management
    max_memory_usage_mb: int = 512
    cleanup_interval_minutes: int = 30
    
    # Database Optimization
    batch_insert_size: int = 100
    connection_pool_size: int = 10
    query_timeout_seconds: int = 30
    
    # Caching
    enable_analysis_cache: bool = True
    cache_ttl_hours: int = 24
    max_cache_size_mb: int = 256
    
    # Resource Limits
    max_games_per_request: int = 50
    max_analysis_time_per_game: int = 300  # seconds
    max_total_analysis_time: int = 3600  # seconds
    
    @classmethod
    def for_profile(cls, profile: PerformanceProfile) -> 'AnalysisPerformanceConfig':
        """Get configuration for a specific performance profile."""
        if profile == PerformanceProfile.DEVELOPMENT:
            return cls(
                stockfish_depth=6,
                stockfish_skill_level=6,
                stockfish_time_limit=0.5,
                stockfish_threads=1,
                stockfish_hash_size=32,
                max_concurrent_analyses=2,
                batch_size=5,
                parallel_analysis=True,
                max_memory_usage_mb=256,
                cleanup_interval_minutes=15,
                batch_insert_size=50,
                connection_pool_size=5,
                query_timeout_seconds=15,
                enable_analysis_cache=False,
                max_games_per_request=10,
                max_analysis_time_per_game=60,
                max_total_analysis_time=600
            )
        
        elif profile == PerformanceProfile.PRODUCTION:
            return cls(
                stockfish_depth=8,
                stockfish_skill_level=8,
                stockfish_time_limit=1.0,
                stockfish_threads=2,
                stockfish_hash_size=64,
                max_concurrent_analyses=4,
                batch_size=10,
                parallel_analysis=True,
                max_memory_usage_mb=512,
                cleanup_interval_minutes=30,
                batch_insert_size=100,
                connection_pool_size=10,
                query_timeout_seconds=30,
                enable_analysis_cache=True,
                cache_ttl_hours=24,
                max_cache_size_mb=256,
                max_games_per_request=50,
                max_analysis_time_per_game=300,
                max_total_analysis_time=3600
            )
        
        elif profile == PerformanceProfile.HIGH_PERFORMANCE:
            return cls(
                stockfish_depth=12,
                stockfish_skill_level=15,
                stockfish_time_limit=2.0,
                stockfish_threads=4,
                stockfish_hash_size=128,
                max_concurrent_analyses=8,
                batch_size=20,
                parallel_analysis=True,
                max_memory_usage_mb=1024,
                cleanup_interval_minutes=60,
                batch_insert_size=200,
                connection_pool_size=20,
                query_timeout_seconds=60,
                enable_analysis_cache=True,
                cache_ttl_hours=48,
                max_cache_size_mb=512,
                max_games_per_request=100,
                max_analysis_time_per_game=600,
                max_total_analysis_time=7200
            )
        
        elif profile == PerformanceProfile.COST_OPTIMIZED:
            return cls(
                stockfish_depth=6,
                stockfish_skill_level=6,
                stockfish_time_limit=0.5,
                stockfish_threads=1,
                stockfish_hash_size=32,
                max_concurrent_analyses=2,
                batch_size=5,
                parallel_analysis=False,
                max_memory_usage_mb=256,
                cleanup_interval_minutes=10,
                batch_insert_size=50,
                connection_pool_size=5,
                query_timeout_seconds=15,
                enable_analysis_cache=True,
                cache_ttl_hours=72,
                max_cache_size_mb=128,
                max_games_per_request=20,
                max_analysis_time_per_game=120,
                max_total_analysis_time=1800
            )
        
        else:
            return cls()  # Default configuration
    
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
    """Get performance configuration from environment or default."""
    profile_name = os.getenv("ANALYSIS_PERFORMANCE_PROFILE", "production")
    
    try:
        profile = PerformanceProfile(profile_name)
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
            print("Warning: Invalid performance configuration, using defaults")
            return AnalysisPerformanceConfig.for_profile(PerformanceProfile.PRODUCTION)
        
        return config
        
    except ValueError:
        print(f"Warning: Unknown performance profile '{profile_name}', using production")
        return AnalysisPerformanceConfig.for_profile(PerformanceProfile.PRODUCTION)

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
