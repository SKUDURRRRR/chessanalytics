#!/usr/bin/env python3
"""
Security and Logging Configuration Module
Provides secure logging, audit trails, and security monitoring.
"""

import os
import logging
import json
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from enum import Enum
import traceback

class LogLevel(Enum):
    """Log levels for structured logging."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class SecurityEvent(Enum):
    """Types of security events to log."""
    AUTHENTICATION_SUCCESS = "auth_success"
    AUTHENTICATION_FAILURE = "auth_failure"
    AUTHORIZATION_DENIED = "authz_denied"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    SYSTEM_ERROR = "system_error"
    CONFIGURATION_CHANGE = "config_change"

@dataclass
class SecurityLogEntry:
    """Structured security log entry."""
    timestamp: str
    level: LogLevel
    event_type: SecurityEvent
    user_id: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    request_id: Optional[str]
    message: str
    details: Dict[str, Any]
    severity: int  # 1-10 scale
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

class SecurityLogger:
    """Secure logging system with audit trails."""
    
    def __init__(self, log_file: Optional[str] = None, log_level: LogLevel = LogLevel.INFO):
        self.log_file = log_file or os.getenv("SECURITY_LOG_FILE", "security.log")
        self.log_level = log_level
        self.logger = self._setup_logger()
        
        # Security settings
        self.audit_enabled = os.getenv("AUDIT_ENABLED", "true").lower() == "true"
        self.encrypt_logs = os.getenv("ENCRYPT_LOGS", "false").lower() == "true"
        self.log_retention_days = int(os.getenv("LOG_RETENTION_DAYS", "30"))
        
        # Rate limiting for security events
        self.rate_limit_window = 300  # 5 minutes
        self.rate_limit_max_events = 100
        self.event_counts = {}
    
    def _setup_logger(self) -> logging.Logger:
        """Setup structured logger."""
        logger = logging.getLogger("security")
        logger.setLevel(self.log_level.value)
        
        # Clear existing handlers
        logger.handlers.clear()
        
        # File handler for security logs
        file_handler = logging.FileHandler(self.log_file)
        file_handler.setLevel(self.log_level.value)
        
        # Console handler for critical events
        console_handler = logging.StreamHandler()
        console_handler.setLevel(LogLevel.WARNING.value)
        
        # JSON formatter for structured logging
        json_formatter = JSONFormatter()
        file_handler.setFormatter(json_formatter)
        console_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        return logger
    
    def log_security_event(
        self,
        event_type: SecurityEvent,
        message: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: int = 5
    ):
        """Log a security event with structured data."""
        if not self.audit_enabled:
            return
        
        # Check rate limiting
        if self._is_rate_limited(event_type, user_id, ip_address):
            return
        
        # Create log entry
        log_entry = SecurityLogEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            level=self._get_log_level(severity),
            event_type=event_type,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            message=message,
            details=details or {},
            severity=severity
        )
        
        # Log the event
        self.logger.log(
            getattr(logging, log_entry.level.value),
            json.dumps(log_entry.to_dict(), default=str)
        )
        
        # Alert on high severity events
        if severity >= 8:
            self._send_security_alert(log_entry)
    
    def _is_rate_limited(self, event_type: SecurityEvent, user_id: Optional[str], ip_address: Optional[str]) -> bool:
        """Check if event should be rate limited."""
        key = f"{event_type.value}:{user_id}:{ip_address}"
        now = datetime.now(timezone.utc).timestamp()
        
        if key not in self.event_counts:
            self.event_counts[key] = []
        
        # Clean old events
        self.event_counts[key] = [
            timestamp for timestamp in self.event_counts[key]
            if now - timestamp < self.rate_limit_window
        ]
        
        # Check if rate limit exceeded
        if len(self.event_counts[key]) >= self.rate_limit_max_events:
            return True
        
        # Add current event
        self.event_counts[key].append(now)
        return False
    
    def _get_log_level(self, severity: int) -> LogLevel:
        """Convert severity to log level."""
        if severity >= 9:
            return LogLevel.CRITICAL
        elif severity >= 7:
            return LogLevel.ERROR
        elif severity >= 5:
            return LogLevel.WARNING
        elif severity >= 3:
            return LogLevel.INFO
        else:
            return LogLevel.DEBUG
    
    def _send_security_alert(self, log_entry: SecurityLogEntry):
        """Send security alert for high severity events."""
        # In production, this would integrate with alerting systems
        print(f"🚨 SECURITY ALERT: {log_entry.event_type.value} - {log_entry.message}")
        print(f"   User: {log_entry.user_id}, IP: {log_entry.ip_address}")
        print(f"   Severity: {log_entry.severity}/10")
    
    def log_authentication_success(self, user_id: str, ip_address: str, user_agent: str, request_id: str):
        """Log successful authentication."""
        self.log_security_event(
            event_type=SecurityEvent.AUTHENTICATION_SUCCESS,
            message=f"User {user_id} authenticated successfully",
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            severity=3
        )
    
    def log_authentication_failure(self, user_id: str, ip_address: str, user_agent: str, request_id: str, reason: str):
        """Log failed authentication attempt."""
        self.log_security_event(
            event_type=SecurityEvent.AUTHENTICATION_FAILURE,
            message=f"Authentication failed for user {user_id}: {reason}",
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            details={"reason": reason},
            severity=6
        )
    
    def log_authorization_denied(self, user_id: str, resource: str, action: str, ip_address: str, request_id: str):
        """Log authorization denial."""
        self.log_security_event(
            event_type=SecurityEvent.AUTHORIZATION_DENIED,
            message=f"Access denied to {resource} for user {user_id}",
            user_id=user_id,
            ip_address=ip_address,
            request_id=request_id,
            details={"resource": resource, "action": action},
            severity=7
        )
    
    def log_data_access(self, user_id: str, table: str, operation: str, record_count: int, ip_address: str, request_id: str):
        """Log data access operations."""
        self.log_security_event(
            event_type=SecurityEvent.DATA_ACCESS,
            message=f"Data access: {operation} on {table} by {user_id}",
            user_id=user_id,
            ip_address=ip_address,
            request_id=request_id,
            details={"table": table, "operation": operation, "record_count": record_count},
            severity=4
        )
    
    def log_data_modification(self, user_id: str, table: str, operation: str, record_count: int, ip_address: str, request_id: str):
        """Log data modification operations."""
        self.log_security_event(
            event_type=SecurityEvent.DATA_MODIFICATION,
            message=f"Data modification: {operation} on {table} by {user_id}",
            user_id=user_id,
            ip_address=ip_address,
            request_id=request_id,
            details={"table": table, "operation": operation, "record_count": record_count},
            severity=5
        )
    
    def log_system_error(self, error: Exception, context: str, user_id: Optional[str] = None, request_id: Optional[str] = None):
        """Log system errors with context."""
        self.log_security_event(
            event_type=SecurityEvent.SYSTEM_ERROR,
            message=f"System error in {context}: {str(error)}",
            user_id=user_id,
            request_id=request_id,
            details={
                "error_type": type(error).__name__,
                "context": context,
                "traceback": traceback.format_exc()
            },
            severity=8
        )
    
    def log_suspicious_activity(self, activity: str, user_id: Optional[str] = None, ip_address: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        """Log suspicious activity."""
        self.log_security_event(
            event_type=SecurityEvent.SUSPICIOUS_ACTIVITY,
            message=f"Suspicious activity detected: {activity}",
            user_id=user_id,
            ip_address=ip_address,
            details=details or {},
            severity=9
        )

class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""
    
    def format(self, record):
        """Format log record as JSON."""
        log_data = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add extra fields if present
        if hasattr(record, 'extra_data'):
            log_data.update(record.extra_data)
        
        return json.dumps(log_data, default=str)

class SecurityValidator:
    """Security validation utilities."""
    
    @staticmethod
    def validate_user_id(user_id: str) -> bool:
        """Validate user ID format."""
        if not user_id or len(user_id) < 3 or len(user_id) > 50:
            return False
        # Allow alphanumeric, underscore, hyphen
        return user_id.replace('_', '').replace('-', '').isalnum()
    
    @staticmethod
    def validate_platform(platform: str) -> bool:
        """Validate platform value."""
        return platform in ['lichess', 'chess.com']
    
    @staticmethod
    def validate_ip_address(ip_address: str) -> bool:
        """Basic IP address validation."""
        if not ip_address:
            return False
        parts = ip_address.split('.')
        if len(parts) != 4:
            return False
        try:
            return all(0 <= int(part) <= 255 for part in parts)
        except ValueError:
            return False
    
    @staticmethod
    def sanitize_input(input_str: str) -> str:
        """Sanitize user input."""
        if not input_str:
            return ""
        # Remove potentially dangerous characters
        dangerous_chars = ['<', '>', '"', "'", '&', ';', '(', ')', '|', '`', '$']
        sanitized = input_str
        for char in dangerous_chars:
            sanitized = sanitized.replace(char, '')
        return sanitized.strip()

# Global security logger instance
security_logger = SecurityLogger()

def get_security_logger() -> SecurityLogger:
    """Get the global security logger instance."""
    return security_logger

def log_api_request(user_id: str, endpoint: str, method: str, ip_address: str, request_id: str, status_code: int):
    """Log API request for audit trail."""
    if status_code >= 400:
        security_logger.log_security_event(
            event_type=SecurityEvent.SYSTEM_ERROR,
            message=f"API request failed: {method} {endpoint}",
            user_id=user_id,
            ip_address=ip_address,
            request_id=request_id,
            details={"endpoint": endpoint, "method": method, "status_code": status_code},
            severity=6
        )
    else:
        security_logger.log_data_access(
            user_id=user_id,
            table="api_requests",
            operation="request",
            record_count=1,
            ip_address=ip_address,
            request_id=request_id
        )

if __name__ == "__main__":
    # Test security logging
    logger = get_security_logger()
    
    logger.log_authentication_success("testuser", "192.168.1.1", "Mozilla/5.0", "req123")
    logger.log_authentication_failure("testuser", "192.168.1.1", "Mozilla/5.0", "req124", "Invalid token")
    logger.log_data_access("testuser", "games", "SELECT", 10, "192.168.1.1", "req125")
    logger.log_suspicious_activity("Multiple failed login attempts", "testuser", "192.168.1.1")
