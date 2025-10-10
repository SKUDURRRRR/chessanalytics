#!/usr/bin/env python3
"""
Configuration Management for Chess Analysis System
Centralized configuration for all analysis components.
"""

import os
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
# Load backend-specific environment first, then optional overrides
load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR / '.env.local', override=True)
# Allow project root .env to fill in defaults without clobbering backend values
load_dotenv(BASE_DIR.parent / '.env', override=False)


SUMMARY_PRINTED = False
@dataclass
class DatabaseConfig:
    """Database configuration."""
    url: str
    anon_key: str
    service_role_key: Optional[str] = None
    timeout: int = 30
    retry_attempts: int = 3

@dataclass
class StockfishConfig:
    """Stockfish engine configuration - Railway Hobby Tier."""
    path: Optional[str] = None
    depth: int = 14
    skill_level: int = 20
    time_limit: float = 0.8
    use_opening_book: bool = True
    use_endgame_tablebase: bool = True
    max_concurrent: int = 4
    
    def __post_init__(self):
        """Railway Hobby tier settings are always used."""
        # Railway Hobby tier is the only configuration
        print(f"[CONFIG] Railway Hobby mode: depth={self.depth}, skill={self.skill_level}")

@dataclass
class AnalysisConfig:
    """Analysis configuration - Railway Hobby Tier only."""
    default_type: str = "stockfish"  # Railway Hobby: stockfish only
    batch_size: int = 10
    max_games_per_request: int = 100
    parallel_processing: bool = True
    cache_results: bool = True
    cache_ttl_hours: int = 24

@dataclass
class APIConfig:
    """API server configuration."""
    host: str = "127.0.0.1"
    port: int = 8002
    workers: int = 1
    timeout: int = 300
    max_request_size: int = 10 * 1024 * 1024  # 10MB
    cors_origins: list = None

    def __post_init__(self):
        if self.cors_origins is None:
            self.cors_origins = [
                "http://localhost:3000",
                "http://localhost:3001", 
                "http://localhost:3002",
                "http://localhost:3003"
            ]

@dataclass
class LoggingConfig:
    """Logging configuration."""
    level: str = "INFO"
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    file_path: Optional[str] = None
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    backup_count: int = 5

class ChessAnalysisConfig:
    """Main configuration class for the chess analysis system."""
    
    def __init__(self, config_file: Optional[str] = None):
        """Initialize configuration from file or environment variables."""
        self.config_file = config_file or "config.json"
        self.database = self._load_database_config()
        self.stockfish = self._load_stockfish_config()
        self.analysis = self._load_analysis_config()
        self.api = self._load_api_config()
        self.logging = self._load_logging_config()
    
    def _load_database_config(self) -> DatabaseConfig:
        """Load database configuration from environment or file."""
        return DatabaseConfig(
            url=os.getenv("SUPABASE_URL", ""),
            anon_key=os.getenv("SUPABASE_ANON_KEY", ""),
            service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
            timeout=int(os.getenv("DB_TIMEOUT", "30")),
            retry_attempts=int(os.getenv("DB_RETRY_ATTEMPTS", "3"))
        )
    
    def _load_stockfish_config(self) -> StockfishConfig:
        """Load Stockfish configuration."""
        # Try to find Stockfish executable
        stockfish_path = self._find_stockfish_executable()
        
        # Railway Hobby Tier - High Performance Settings
        depth = int(os.getenv("STOCKFISH_DEPTH", "14"))
        skill_level = int(os.getenv("STOCKFISH_SKILL_LEVEL", "20"))
        time_limit = float(os.getenv("STOCKFISH_TIME_LIMIT", "0.8"))
        
        print(f"[DEBUG] _load_stockfish_config: depth={depth}, skill={skill_level}, time={time_limit}")
        
        return StockfishConfig(
            path=stockfish_path,
            depth=depth,  # Railway Hobby: Better depth
            skill_level=skill_level,  # Railway Hobby: Maximum strength
            time_limit=time_limit,  # Railway Hobby: Fast analysis
            use_opening_book=os.getenv("STOCKFISH_USE_OPENING_BOOK", "true").lower() == "true",
            use_endgame_tablebase=os.getenv("STOCKFISH_USE_ENDGAME_TB", "true").lower() == "true",
            max_concurrent=int(os.getenv("STOCKFISH_MAX_CONCURRENT", "4"))  # Railway Hobby: Parallel
        )
    
    def _load_analysis_config(self) -> AnalysisConfig:
        """Load analysis configuration."""
        return AnalysisConfig(
            default_type=os.getenv("ANALYSIS_DEFAULT_TYPE", "stockfish"),
            batch_size=int(os.getenv("ANALYSIS_BATCH_SIZE", "10")),
            max_games_per_request=int(os.getenv("ANALYSIS_MAX_GAMES", "100")),
            parallel_processing=os.getenv("ANALYSIS_PARALLEL", "true").lower() == "true",
            cache_results=os.getenv("ANALYSIS_CACHE", "true").lower() == "true",
            cache_ttl_hours=int(os.getenv("ANALYSIS_CACHE_TTL", "24"))
        )
    
    def _load_api_config(self) -> APIConfig:
        """Load API configuration."""
        cors_origins = os.getenv("CORS_ORIGINS", "").split(",")
        if cors_origins == [""]:
            cors_origins = None
        
        return APIConfig(
            host=os.getenv("API_HOST", "127.0.0.1"),
            port=int(os.getenv("API_PORT", "8002")),
            workers=int(os.getenv("API_WORKERS", "1")),
            timeout=int(os.getenv("API_TIMEOUT", "300")),
            max_request_size=int(os.getenv("API_MAX_REQUEST_SIZE", str(10 * 1024 * 1024))),
            cors_origins=cors_origins
        )
    
    def _load_logging_config(self) -> LoggingConfig:
        """Load logging configuration."""
        return LoggingConfig(
            level=os.getenv("LOG_LEVEL", "INFO"),
            format=os.getenv("LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"),
            file_path=os.getenv("LOG_FILE"),
            max_file_size=int(os.getenv("LOG_MAX_FILE_SIZE", str(10 * 1024 * 1024))),
            backup_count=int(os.getenv("LOG_BACKUP_COUNT", "5"))
        )
    
    def _find_stockfish_executable(self) -> Optional[str]:
        """Find the best available Stockfish executable."""
        # Check environment variable first
        env_path = os.getenv("STOCKFISH_PATH")
        print(f"[STOCKFISH] Environment STOCKFISH_PATH: {env_path}")
        
        if env_path:
            # If it's just "stockfish", check if it exists in PATH
            if env_path == "stockfish" and self._check_command_exists(env_path):
                print(f"[STOCKFISH] Found stockfish in PATH via env var")
                return env_path
            # If it's a full path, check if file exists
            elif os.path.exists(env_path):
                print(f"[STOCKFISH] Found stockfish at env path: {env_path}")
                return env_path
        
        # Try common paths - prioritize based on environment
        import platform
        is_windows = platform.system() == "Windows"
        
        if is_windows:
            # Windows paths first for local development
            possible_paths = [
                # Local stockfish directory (most likely for development)
                os.path.join(os.path.dirname(os.path.dirname(__file__)), "stockfish", "stockfish-windows-x86-64-avx2.exe"),
                # Windows winget installation
                os.path.expanduser("~\\AppData\\Local\\Microsoft\\WinGet\\Packages\\"
                                 "Stockfish.Stockfish_Microsoft.Winget.Source_8wekyb3d8bbwe\\"
                                 "stockfish\\stockfish-windows-x86-64-avx2.exe"),
                "stockfish.exe",
                "stockfish"
            ]
        else:
            # Linux/Unix paths first for production
            possible_paths = [
                "/usr/games/stockfish",  # Common Debian/Ubuntu location (Railway)
                "/usr/bin/stockfish",
                "/usr/local/bin/stockfish", 
                "stockfish"
            ]
            
            # Force check the Railway path first
            if os.path.exists("/usr/games/stockfish"):
                print(f"[STOCKFISH] Found Stockfish at /usr/games/stockfish (Railway path)")
                return "/usr/games/stockfish"
        
        print(f"[STOCKFISH] Checking possible paths: {possible_paths}")
        
        for path in possible_paths:
            exists = os.path.exists(path)
            in_path = path in ["stockfish", "stockfish.exe"] and self._check_command_exists(path)
            print(f"[STOCKFISH] Path {path}: exists={exists}, in_path={in_path}")
            
            if exists or in_path:
                print(f"[STOCKFISH] Found stockfish at: {path}")
                return path
        
        print(f"[STOCKFISH] No stockfish executable found")
        return None
    
    def _check_command_exists(self, command: str) -> bool:
        """Check if a command exists in the system PATH."""
        try:
            import subprocess
            print(f"[STOCKFISH] Checking if command '{command}' exists in PATH")
            result = subprocess.run([command, "--version"], 
                                 capture_output=True, timeout=5, check=False)
            print(f"[STOCKFISH] Command '{command}' result: returncode={result.returncode}, stdout={result.stdout.decode()[:100] if result.stdout else 'None'}")
            return result.returncode == 0
        except Exception as e:
            print(f"[STOCKFISH] Exception checking command '{command}': {e}")
            return False
    
    def save_to_file(self, file_path: Optional[str] = None) -> bool:
        """Save configuration to a JSON file."""
        try:
            config_dict = {
                "database": asdict(self.database),
                "stockfish": asdict(self.stockfish),
                "analysis": asdict(self.analysis),
                "api": asdict(self.api),
                "logging": asdict(self.logging)
            }
            
            file_path = file_path or self.config_file
            with open(file_path, 'w') as f:
                json.dump(config_dict, f, indent=2)
            
            print(f"Configuration saved to {file_path}")
            return True
        except Exception as e:
            print(f"Error saving configuration: {e}")
            return False
    
    def load_from_file(self, file_path: Optional[str] = None) -> bool:
        """Load configuration from a JSON file."""
        try:
            file_path = file_path or self.config_file
            if not os.path.exists(file_path):
                print(f"Configuration file {file_path} not found")
                return False
            
            with open(file_path, 'r') as f:
                config_dict = json.load(f)
            
            # Update configurations
            if "database" in config_dict:
                self.database = DatabaseConfig(**config_dict["database"])
            if "stockfish" in config_dict:
                self.stockfish = StockfishConfig(**config_dict["stockfish"])
            if "analysis" in config_dict:
                self.analysis = AnalysisConfig(**config_dict["analysis"])
            if "api" in config_dict:
                self.api = APIConfig(**config_dict["api"])
            if "logging" in config_dict:
                self.logging = LoggingConfig(**config_dict["logging"])
            
            print(f"Configuration loaded from {file_path}")
            return True
        except Exception as e:
            print(f"Error loading configuration: {e}")
            return False
    
    def validate(self) -> bool:
        """Validate the configuration."""
        errors = []
        
        # Validate database config
        if not self.database.url:
            errors.append("Database URL is required")
        if not self.database.anon_key:
            errors.append("Database anon key is required")
        
        # Validate stockfish config
        if self.stockfish.path and not os.path.exists(self.stockfish.path):
            errors.append(f"Stockfish executable not found at {self.stockfish.path}")
        
        # Validate analysis config
        if self.analysis.default_type not in ["stockfish", "deep"]:
            errors.append("Invalid default analysis type")
        
        if self.analysis.batch_size <= 0:
            errors.append("Batch size must be positive")
        
        # Validate API config
        if self.api.port <= 0 or self.api.port > 65535:
            errors.append("Invalid API port")
        
        if errors:
            print("Configuration validation errors:")
            for error in errors:
                print(f"  - {error}")
            return False
        
        return True
    
    def get_analysis_engine_config(self) -> Dict[str, Any]:
        """Get configuration for the analysis engine."""
        return {
            "stockfish_path": self.stockfish.path,
            "depth": self.stockfish.depth,
            "skill_level": self.stockfish.skill_level,
            "time_limit": self.stockfish.time_limit,
            "use_opening_book": self.stockfish.use_opening_book,
            "use_endgame_tablebase": self.stockfish.use_endgame_tablebase,
            "parallel_analysis": self.analysis.parallel_processing,
            "max_concurrent": self.stockfish.max_concurrent
        }
    
    def get_database_config(self) -> Dict[str, Any]:
        """Get database configuration."""
        return {
            "url": self.database.url,
            "key": self.database.anon_key,
            "service_role_key": self.database.service_role_key,
            "timeout": self.database.timeout,
            "retry_attempts": self.database.retry_attempts
        }
    
    def get_api_config(self) -> Dict[str, Any]:
        """Get API configuration."""
        return {
            "host": self.api.host,
            "port": self.api.port,
            "workers": self.api.workers,
            "timeout": self.api.timeout,
            "max_request_size": self.api.max_request_size,
            "cors_origins": self.api.cors_origins
        }
    
    def print_summary(self):
        """Print a summary of the current configuration."""
        global SUMMARY_PRINTED
        if SUMMARY_PRINTED:
            return
        SUMMARY_PRINTED = True
        
        print("\n" + "="*50)
        print("CHESS ANALYSIS CONFIGURATION")
        print("="*50)
        
        print(f"\nDatabase:")
        # Mask hosted URLs when pointing to Supabase cloud
        if "supabase.co" in self.database.url:
            print(f"  URL: [HOSTED SUPABASE URL]")
        else:
            print(f"  URL: {self.database.url[:50]}..." if len(self.database.url) > 50 else f"  URL: {self.database.url}")
        print(f"  Anon Key: {'*' * 20}...{self.database.anon_key[-4:]}" if self.database.anon_key else "  Anon Key: Not set")
        print(f"  Timeout: {self.database.timeout}s")
        
        print(f"\nStockfish:")
        print(f"  Path: {self.stockfish.path or 'Not found'}")
        print(f"  Depth: {self.stockfish.depth}")
        print(f"  Skill Level: {self.stockfish.skill_level}")
        print(f"  Time Limit: {self.stockfish.time_limit}s")
        print(f"  Max Concurrent: {self.stockfish.max_concurrent}")
        
        print(f"\nAnalysis:")
        print(f"  Default Type: {self.analysis.default_type}")
        print(f"  Batch Size: {self.analysis.batch_size}")
        print(f"  Max Games: {self.analysis.max_games_per_request}")
        print(f"  Parallel: {self.analysis.parallel_processing}")
        print(f"  Cache: {self.analysis.cache_results}")
        
        print(f"\nAPI:")
        print(f"  Host: {self.api.host}")
        print(f"  Port: {self.api.port}")
        print(f"  Workers: {self.api.workers}")
        print(f"  Timeout: {self.api.timeout}s")
        
        print(f"\nLogging:")
        print(f"  Level: {self.logging.level}")
        print(f"  File: {self.logging.file_path or 'Console only'}")
        
        print("="*50)

# Global configuration instance
_config = None

def get_config() -> ChessAnalysisConfig:
    """Get the global configuration instance."""
    global _config
    if _config is None:
        _config = ChessAnalysisConfig()
    return _config

def reload_config(config_file: Optional[str] = None) -> ChessAnalysisConfig:
    """Reload configuration from file."""
    global _config
    _config = ChessAnalysisConfig(config_file)
    return _config

# Example usage and testing
if __name__ == "__main__":
    print("Testing Chess Analysis Configuration...")
    
    # Create configuration
    config = ChessAnalysisConfig()
    
    # Print summary
    config.print_summary()
    
    # Validate configuration
    if config.validate():
        print("\n✅ Configuration is valid!")
    else:
        print("\n❌ Configuration has errors!")
    
    # Save configuration
    config.save_to_file("example_config.json")
    
    print("\n🎉 Configuration testing complete!")
