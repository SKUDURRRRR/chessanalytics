"""
CORS Security Configuration
Provides secure CORS settings with validation and restrictions.
"""

from typing import List, Optional
from pydantic import BaseModel, validator
import re
from urllib.parse import urlparse

class CORSSecurityConfig(BaseModel):
    """CORS security configuration with validation."""
    
    allowed_origins: List[str] = []
    allowed_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allowed_headers: List[str] = ["Authorization", "Content-Type", "Accept"]
    allow_credentials: bool = True
    max_age: int = 3600  # 1 hour
    
    @validator('allowed_origins')
    def validate_origins(cls, v):
        """Validate and sanitize allowed origins."""
        if not v:
            raise ValueError('CORS origins cannot be empty')
        
        validated_origins = []
        for origin in v:
            # Security checks
            if origin == '*':
                raise ValueError('Wildcard CORS origins are not allowed for security reasons')
            
            if not origin.startswith(('http://', 'https://')):
                raise ValueError(f'Invalid origin protocol: {origin}')
            
            # Validate URL format
            try:
                parsed = urlparse(origin)
                if not parsed.netloc:
                    raise ValueError(f'Invalid origin format: {origin}')
            except Exception as e:
                raise ValueError(f'Invalid origin URL: {origin} - {e}')
            
            # Additional security checks
            if 'localhost' in origin and not origin.startswith('http://localhost'):
                raise ValueError(f'Localhost origins must use http://: {origin}')
            
            validated_origins.append(origin)
        
        return validated_origins
    
    @validator('allowed_methods')
    def validate_methods(cls, v):
        """Validate allowed HTTP methods."""
        valid_methods = {'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'}
        invalid_methods = set(v) - valid_methods
        
        if invalid_methods:
            raise ValueError(f'Invalid HTTP methods: {invalid_methods}')
        
        return v
    
    @validator('allowed_headers')
    def validate_headers(cls, v):
        """Validate allowed headers."""
        # Dangerous headers that should not be allowed
        dangerous_headers = {
            'x-forwarded-for', 'x-real-ip', 'x-originating-ip',
            'x-remote-ip', 'x-remote-addr', 'x-client-ip'
        }
        
        for header in v:
            if header.lower() in dangerous_headers:
                raise ValueError(f'Dangerous header not allowed: {header}')
        
        return v
    
    @validator('max_age')
    def validate_max_age(cls, v):
        """Validate max age for preflight requests."""
        if v < 0 or v > 86400:  # 0 to 24 hours
            raise ValueError('Max age must be between 0 and 86400 seconds')
        return v
    
    def is_origin_allowed(self, origin: str) -> bool:
        """Check if an origin is allowed."""
        if not origin:
            return False
        
        # Exact match
        if origin in self.allowed_origins:
            return True
        
        # Pattern matching for subdomains (if configured)
        for allowed_origin in self.allowed_origins:
            if self._matches_pattern(origin, allowed_origin):
                return True
        
        return False
    
    def _matches_pattern(self, origin: str, pattern: str) -> bool:
        """Check if origin matches a pattern (for subdomain support)."""
        if '*' not in pattern:
            return origin == pattern
        
        # Convert pattern to regex
        regex_pattern = pattern.replace('.', r'\.').replace('*', r'[^.]*')
        return bool(re.match(f'^{regex_pattern}$', origin))
    
    def get_cors_headers(self, origin: Optional[str] = None) -> dict:
        """Get CORS headers for a response."""
        headers = {
            'Access-Control-Allow-Methods': ', '.join(self.allowed_methods),
            'Access-Control-Allow-Headers': ', '.join(self.allowed_headers),
            'Access-Control-Max-Age': str(self.max_age),
        }
        
        if self.allow_credentials:
            headers['Access-Control-Allow-Credentials'] = 'true'
        
        if origin and self.is_origin_allowed(origin):
            headers['Access-Control-Allow-Origin'] = origin
        elif self.allowed_origins:
            headers['Access-Control-Allow-Origin'] = self.allowed_origins[0]
        
        return headers
    
    def log_security_status(self):
        """Log CORS security configuration status."""
        print("🔒 CORS Security Configuration:")
        print(f"  Allowed Origins: {self.allowed_origins}")
        print(f"  Allowed Methods: {self.allowed_methods}")
        print(f"  Allowed Headers: {self.allowed_headers}")
        print(f"  Allow Credentials: {self.allow_credentials}")
        print(f"  Max Age: {self.max_age}s")
        
        # Security warnings
        warnings = []
        
        if len(self.allowed_origins) > 10:
            warnings.append("Many CORS origins configured - consider consolidating")
        
        if 'OPTIONS' not in self.allowed_methods:
            warnings.append("OPTIONS method not allowed - preflight requests will fail")
        
        if not self.allowed_headers:
            warnings.append("No allowed headers configured - requests may fail")
        
        if warnings:
            print("⚠️  Security Warnings:")
            for warning in warnings:
                print(f"    - {warning}")
        else:
            print("✅ CORS configuration looks secure")

# Default secure CORS configuration
def get_default_cors_config() -> CORSSecurityConfig:
    """Get default secure CORS configuration."""
    return CORSSecurityConfig(
        allowed_origins=[
            'http://localhost:3000',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
        ],
        allowed_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowed_headers=['Authorization', 'Content-Type', 'Accept'],
        allow_credentials=True,
        max_age=3600
    )

# Production CORS configuration
def get_production_cors_config(allowed_domains: List[str]) -> CORSSecurityConfig:
    """Get production CORS configuration with strict security."""
    if not allowed_domains:
        raise ValueError("Production CORS requires at least one allowed domain")
    
    # Ensure all domains use HTTPS in production
    validated_domains = []
    for domain in allowed_domains:
        if not domain.startswith('https://'):
            validated_domains.append(f'https://{domain}')
        else:
            validated_domains.append(domain)
    
    return CORSSecurityConfig(
        allowed_origins=validated_domains,
        allowed_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowed_headers=['Authorization', 'Content-Type', 'Accept'],
        allow_credentials=True,
        max_age=1800  # 30 minutes for production
    )
