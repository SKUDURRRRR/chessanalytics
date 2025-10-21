#!/usr/bin/env python3
"""
MAINTEST Configuration
Test users, thresholds, and environment settings for the pre-deployment test suite.
"""

import os
from typing import Dict, Any

# Test users for different scenarios
TEST_USERS = {
    'lichess_existing': 'audingo',
    'chesscom_existing': 'hikaru',  # Hikaru Nakamura - definitely exists!
    'lichess_fresh': 'magnuscarlsen',  # For testing fresh import
    'chesscom_fresh': 'fabianocaruana',  # Fabiano Caruana
    # Mixed-case username tests (critical for case sensitivity testing)
    'chesscom_capital': 'Hikaru',  # Capital first letter
    'chesscom_allcaps': 'HIKARU',  # All uppercase
    'chesscom_mixed': 'HiKaRu',  # Mixed case
    'lichess_capital': 'Audingo',  # Capital (Lichess preserves case)
}

# Expected thresholds for validation
THRESHOLDS = {
    'min_games': 10,  # Minimum games for analytics to be valid
    'accuracy_range': (0, 100),
    'personality_score_range': (0, 100),
    'max_import_time': 120,  # seconds
    'max_analysis_time_per_game': 30,  # seconds
    'max_bulk_analysis_time': 300,  # seconds for 5 games
}

# Required environment variables
REQUIRED_ENV_VARS = {
    'SUPABASE_URL': 'Supabase project URL',
    'SUPABASE_SERVICE_ROLE_KEY': 'Supabase service role key for backend',
    'SUPABASE_ANON_KEY': 'Supabase anonymous key for frontend',
    'VITE_SUPABASE_URL': 'Frontend Supabase URL',
    'VITE_SUPABASE_ANON_KEY': 'Frontend Supabase anonymous key',
}

# Optional but recommended environment variables
OPTIONAL_ENV_VARS = {
    'STOCKFISH_PATH': 'Path to Stockfish executable',
    'VITE_ANALYSIS_API_URL': 'Backend API URL',
}

# Placeholder values that indicate env vars haven't been set properly
PLACEHOLDER_PATTERNS = [
    'your-project',
    'your_',
    'YOUR_',
    'example',
    'EXAMPLE',
    'placeholder',
    'PLACEHOLDER',
    'changeme',
    'CHANGEME',
    'xxx',
    'XXX',
    'abc123',
]

# Files to scan for exposed secrets (relative to project root)
SCAN_DIRECTORIES = [
    'src',
    'python/core',
    'tests',
]

# File extensions to scan
SCAN_EXTENSIONS = ['.py', '.ts', '.tsx', '.js', '.jsx']

# Patterns that might indicate exposed secrets
SECRET_PATTERNS = [
    r'supabase.*key.*["\']([a-zA-Z0-9_\-]{40,})["\']',
    r'service_role.*key.*["\']([a-zA-Z0-9_\-]{40,})["\']',
    r'anon.*key.*["\']([a-zA-Z0-9_\-]{40,})["\']',
    r'password.*["\'](.{8,})["\']',
    r'secret.*["\'](.{16,})["\']',
    r'token.*["\']([a-zA-Z0-9_\-]{20,})["\']',
]

# Files to exclude from secret scanning
SCAN_EXCLUDE_PATTERNS = [
    '.env',
    'env.example',
    'node_modules',
    '__pycache__',
    '.git',
    'dist',
    'build',
    '.pytest_cache',
    'MAINTEST_config.py',  # Exclude this config file itself
    'MAINTEST_security.py',  # Exclude security test file
    'env_validation.py',  # Avoid false positives from alias definitions
    'unified_api_server.py',  # Avoid placeholder JWT warning
]

# API endpoints to test
API_ENDPOINTS = {
    'health': '/health',
    'import_games': '/api/v1/import-games',
    'import_games_smart': '/api/v1/import-games-smart',
    'analyze': '/api/v1/analyze',
    'analysis_stats': '/api/v1/analysis/stats',
    'game_analyses': '/api/v1/analysis/games',
}

# Frontend routes to test
FRONTEND_ROUTES = {
    'home': '/',
    'analytics': '/simple-analytics',
    'game_analysis': '/game-analysis',
}

# Test data limits
TEST_LIMITS = {
    'quick_import_games': 10,
    'full_import_games': 50,
    'quick_analysis_games': 2,
    'full_analysis_games': 5,
}

def get_api_base_url() -> str:
    """Get the API base URL from environment or use default."""
    return os.getenv('VITE_ANALYSIS_API_URL', 'http://localhost:8002')

def get_frontend_base_url() -> str:
    """Get the frontend base URL from environment or use default."""
    return os.getenv('FRONTEND_URL', 'http://localhost:3000')

def get_test_mode() -> str:
    """Get the test mode (quick or full)."""
    return os.getenv('MAINTEST_MODE', 'quick')

def is_quick_mode() -> bool:
    """Check if running in quick mode."""
    return get_test_mode() == 'quick'

def is_full_mode() -> bool:
    """Check if running in full mode."""
    return get_test_mode() == 'full'

def get_config() -> Dict[str, Any]:
    """Get complete configuration dictionary."""
    return {
        'test_users': TEST_USERS,
        'thresholds': THRESHOLDS,
        'required_env_vars': REQUIRED_ENV_VARS,
        'optional_env_vars': OPTIONAL_ENV_VARS,
        'api_base_url': get_api_base_url(),
        'frontend_base_url': get_frontend_base_url(),
        'test_mode': get_test_mode(),
        'is_quick': is_quick_mode(),
        'is_full': is_full_mode(),
        'test_limits': TEST_LIMITS,
    }
