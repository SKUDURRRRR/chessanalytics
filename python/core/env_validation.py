"""
Environment variable validation for the Chess Analytics API.
Uses Pydantic for robust validation and type safety.
"""

import os
from typing import Optional, Literal
from pydantic import BaseModel, Field, validator, HttpUrl
from pydantic_settings import BaseSettings
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseConfig(BaseModel):
    """Database configuration validation."""
    url: HttpUrl = Field(..., description="Supabase database URL")
    anon_key: str = Field(..., min_length=1, description="Supabase anonymous key")
    service_role_key: Optional[str] = Field(None, description="Supabase service role key")
    
    @validator('anon_key')
    def validate_anon_key(cls, v):
        if v == 'your-anon-key-here':
            raise ValueError('Please configure your Supabase anonymous key')
        return v
    
    @validator('service_role_key')
    def validate_service_role_key(cls, v):
        if v == 'your-service-role-key-here':
            raise ValueError('Please configure your Supabase service role key')
        return v

class APIConfig(BaseModel):
    """API configuration validation."""
    host: str = Field(default='127.0.0.1', description="API host")
    port: int = Field(default=8002, ge=1, le=65535, description="API port")
    cors_origins: list[str] = Field(default=['http://localhost:3000'], description="CORS allowed origins")
    debug: bool = Field(default=False, description="Debug mode")
    
    @validator('cors_origins')
    def validate_cors_origins(cls, v):
        if not v:
            raise ValueError('CORS origins cannot be empty')
        
        # Security check: warn about wildcard origins in production
        if '*' in v:
            logger.warning('⚠️ Wildcard CORS origins detected. This may be a security risk.')
        
        return v

class StockfishConfig(BaseModel):
    """Stockfish engine configuration validation."""
    path: str = Field(default='stockfish', description="Path to Stockfish executable")
    depth: int = Field(default=15, ge=1, le=25, description="Analysis depth")
    skill_level: int = Field(default=20, ge=0, le=20, description="Skill level")
    threads: int = Field(default=1, ge=1, le=16, description="Number of threads")
    
    @validator('path')
    def validate_stockfish_path(cls, v):
        if not v or v.strip() == '':
            raise ValueError('Stockfish path cannot be empty')
        return v

class SecurityConfig(BaseModel):
    """Security configuration validation."""
    jwt_secret: Optional[str] = Field(None, description="JWT secret for token validation")
    rate_limit_requests: int = Field(default=100, ge=1, description="Rate limit requests per minute")
    rate_limit_window: int = Field(default=60, ge=1, description="Rate limit window in seconds")
    max_request_size: int = Field(default=10 * 1024 * 1024, ge=1024, description="Max request size in bytes")
    
    @validator('jwt_secret')
    def validate_jwt_secret(cls, v):
        if v and len(v) < 32:
            raise ValueError('JWT secret must be at least 32 characters long')
        return v

class EnvironmentConfig(BaseSettings):
    """Complete environment configuration with validation."""
    
    # Environment
    environment: Literal['development', 'production', 'test'] = Field(
        default='development', 
        description="Environment mode"
    )
    
    # Database
    database: DatabaseConfig = Field(..., description="Database configuration")
    
    # API
    api: APIConfig = Field(default_factory=APIConfig, description="API configuration")
    
    # Stockfish
    stockfish: StockfishConfig = Field(default_factory=StockfishConfig, description="Stockfish configuration")
    
    # Security
    security: SecurityConfig = Field(default_factory=SecurityConfig, description="Security configuration")
    
    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'
        case_sensitive = False
        
        # Custom field mapping for nested configs
        fields = {
            'database.url': {'env': 'SUPABASE_URL'},
            'database.anon_key': {'env': 'SUPABASE_ANON_KEY'},
            'database.service_role_key': {'env': 'SUPABASE_SERVICE_ROLE_KEY'},
            'api.host': {'env': 'API_HOST'},
            'api.port': {'env': 'API_PORT'},
            'api.cors_origins': {'env': 'CORS_ORIGINS'},
            'api.debug': {'env': 'API_DEBUG'},
            'stockfish.path': {'env': 'STOCKFISH_PATH'},
            'stockfish.depth': {'env': 'STOCKFISH_DEPTH'},
            'stockfish.skill_level': {'env': 'STOCKFISH_SKILL_LEVEL'},
            'stockfish.threads': {'env': 'STOCKFISH_THREADS'},
            'security.jwt_secret': {'env': 'SUPABASE_JWT_SECRET'},
            'security.rate_limit_requests': {'env': 'RATE_LIMIT_REQUESTS'},
            'security.rate_limit_window': {'env': 'RATE_LIMIT_WINDOW'},
            'security.max_request_size': {'env': 'MAX_REQUEST_SIZE'},
        }
    
    @validator('database')
    def validate_database_config(cls, v):
        # Check for placeholder values
        if str(v.url) == 'https://your-project.supabase.co':
            raise ValueError('Please configure your Supabase URL')
        
        if v.anon_key == 'your-anon-key-here':
            raise ValueError('Please configure your Supabase anonymous key')
        
        return v
    
    def is_secure(self) -> bool:
        """Check if the current configuration is secure."""
        issues = []
        
        # Check for placeholder credentials
        if str(self.database.url) == 'https://your-project.supabase.co':
            issues.append('Using placeholder Supabase URL')
        
        if self.database.anon_key == 'your-anon-key-here':
            issues.append('Using placeholder Supabase anonymous key')
        
        # Check for insecure CORS configuration
        if '*' in self.api.cors_origins:
            issues.append('Wildcard CORS origins detected')
        
        # Check for missing JWT secret in production
        if self.environment == 'production' and not self.security.jwt_secret:
            issues.append('Missing JWT secret in production')
        
        # Check for insecure HTTP in production
        if self.environment == 'production' and not str(self.database.url).startswith('https://'):
            issues.append('Using HTTP in production')
        
        if issues:
            logger.warning(f'⚠️ Security issues detected: {", ".join(issues)}')
            return False
        
        return True
    
    def log_configuration(self):
        """Log the current configuration (without sensitive data)."""
        logger.info('🔧 Environment configuration loaded:')
        logger.info(f'  Environment: {self.environment}')
        logger.info(f'  API Host: {self.api.host}:{self.api.port}')
        logger.info(f'  CORS Origins: {self.api.cors_origins}')
        logger.info(f'  Stockfish Path: {self.stockfish.path}')
        logger.info(f'  Debug Mode: {self.api.debug}')
        logger.info(f'  Secure: {self.is_secure()}')

def load_and_validate_config() -> EnvironmentConfig:
    """Load and validate environment configuration."""
    try:
        config = EnvironmentConfig()
        config.log_configuration()
        
        if not config.is_secure():
            logger.warning('⚠️ Configuration loaded but security issues detected')
        
        return config
        
    except Exception as e:
        logger.error(f'❌ Failed to load environment configuration: {e}')
        raise

# Global configuration instance
config = load_and_validate_config()
