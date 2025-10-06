"""
Comprehensive error handling for the Chess Analytics API.
Provides structured error responses and logging.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
import traceback
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChessAnalyticsError(Exception):
    """Base exception for Chess Analytics API."""
    def __init__(self, message: str, error_code: str = "UNKNOWN_ERROR", status_code: int = 500):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(self.message)

class DatabaseError(ChessAnalyticsError):
    """Database-related errors."""
    def __init__(self, message: str, operation: str = "unknown"):
        super().__init__(
            message=f"Database error during {operation}: {message}",
            error_code="DATABASE_ERROR",
            status_code=500
        )

class AnalysisError(ChessAnalyticsError):
    """Analysis-related errors."""
    def __init__(self, message: str, analysis_type: str = "unknown"):
        super().__init__(
            message=f"Analysis error for {analysis_type}: {message}",
            error_code="ANALYSIS_ERROR",
            status_code=500
        )

class AuthenticationError(ChessAnalyticsError):
    """Authentication-related errors."""
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            message=message,
            error_code="AUTHENTICATION_ERROR",
            status_code=401
        )

class ValidationError(ChessAnalyticsError):
    """Input validation errors."""
    def __init__(self, message: str, field: str = "unknown"):
        super().__init__(
            message=f"Validation error for field '{field}': {message}",
            error_code="VALIDATION_ERROR",
            status_code=400
        )

class RateLimitError(ChessAnalyticsError):
    """Rate limiting errors."""
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(
            message=message,
            error_code="RATE_LIMIT_ERROR",
            status_code=429
        )

def create_error_response(
    error: Exception,
    request: Optional[Request] = None,
    include_traceback: bool = False
) -> JSONResponse:
    """
    Create a standardized error response.
    
    Args:
        error: The exception that occurred
        request: The FastAPI request object
        include_traceback: Whether to include traceback in response (dev only)
    
    Returns:
        JSONResponse with error details
    """
    # Determine error details
    if isinstance(error, ChessAnalyticsError):
        status_code = error.status_code
        error_code = error.error_code
        message = error.message
    elif isinstance(error, HTTPException):
        status_code = error.status_code
        error_code = "HTTP_ERROR"
        message = error.detail
    else:
        status_code = 500
        error_code = "INTERNAL_ERROR"
        message = "An unexpected error occurred"
    
    # Build error response
    error_response = {
        "error": {
            "code": error_code,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": getattr(getattr(request, "state", None), "request_id", "unknown") if request else "unknown"
        }
    }
    
    # Add traceback in development
    if include_traceback and status_code >= 500:
        error_response["error"]["traceback"] = traceback.format_exc()
    
    # Log the error
    logger.error(f"API Error: {error_code} - {message}", exc_info=True)
    
    return JSONResponse(
        status_code=status_code,
        content=error_response
    )

def handle_database_error(operation: str, error: Exception) -> DatabaseError:
    """Handle database errors with proper context."""
    error_message = str(error)
    
    # Check for common database error patterns
    if "connection" in error_message.lower():
        error_message = "Database connection failed"
    elif "permission" in error_message.lower():
        error_message = "Database permission denied"
    elif "constraint" in error_message.lower():
        error_message = "Database constraint violation"
    elif "timeout" in error_message.lower():
        error_message = "Database operation timed out"
    
    return DatabaseError(error_message, operation)

def handle_analysis_error(analysis_type: str, error: Exception) -> AnalysisError:
    """Handle analysis errors with proper context."""
    error_message = str(error)
    
    # Check for common analysis error patterns
    if "stockfish" in error_message.lower():
        error_message = "Stockfish engine error"
    elif "timeout" in error_message.lower():
        error_message = "Analysis timed out"
    elif "memory" in error_message.lower():
        error_message = "Insufficient memory for analysis"
    
    return AnalysisError(error_message, analysis_type)

def validate_game_data(game_data: Dict[str, Any]) -> None:
    """Validate game data structure."""
    required_fields = ["user_id", "platform", "game_id"]
    
    for field in required_fields:
        if field not in game_data:
            raise ValidationError(f"Missing required field: {field}", field)
    
    # Validate platform
    if game_data["platform"] not in ["lichess", "chess.com"]:
        raise ValidationError("Platform must be 'lichess' or 'chess.com'", "platform")
    
    # Validate user_id
    if not game_data["user_id"] or not isinstance(game_data["user_id"], str):
        raise ValidationError("User ID must be a non-empty string", "user_id")
    
    # Validate game_id
    if not game_data["game_id"] or not isinstance(game_data["game_id"], str):
        raise ValidationError("Game ID must be a non-empty string", "game_id")

def validate_analysis_request(request_data: Dict[str, Any]) -> None:
    """Validate analysis request data."""
    if "games" not in request_data:
        raise ValidationError("Missing 'games' field", "games")
    
    if not isinstance(request_data["games"], list):
        raise ValidationError("'games' must be a list", "games")
    
    if len(request_data["games"]) == 0:
        raise ValidationError("Games list cannot be empty", "games")
    
    if len(request_data["games"]) > 100:  # Reasonable limit
        raise ValidationError("Too many games in request (max 100)", "games")
    
    # Validate each game
    for i, game in enumerate(request_data["games"]):
        try:
            validate_game_data(game)
        except ValidationError as e:
            raise ValidationError(f"Game {i}: {e.message}", f"games[{i}]")

# Global exception handler for unhandled exceptions
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler for unhandled exceptions."""
    return create_error_response(exc, request, include_traceback=True)
