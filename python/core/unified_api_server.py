#!/usr/bin/env python3
"""
Unified Chess Analysis API Server
A single, comprehensive API that consolidates all analysis functionality.
Replaces multiple redundant endpoints with a clean, unified interface.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Annotated, Union, Tuple
from collections import Counter
from decimal import Decimal
import re
import uvicorn
import asyncio
import os
import uuid
from datetime import datetime, timezone
import time
from supabase import create_client, Client
from jose import jwt as jose_jwt

# Import our unified analysis engine
from .analysis_engine import ChessAnalysisEngine, AnalysisConfig, AnalysisType, GameAnalysis

# Import reliable persistence system
from .reliable_analysis_persistence import ReliableAnalysisPersistence, PersistenceResult

# Import performance configuration
from .performance_config import get_performance_config, print_performance_config

# Import error handlers
from .error_handlers import (
    ChessAnalyticsError, DatabaseError, AnalysisError, AuthenticationError,
    ValidationError, create_error_response, handle_database_error,
    handle_analysis_error, validate_game_data, validate_analysis_request,
    global_exception_handler,
    RateLimitError,
)

# Import opening normalization utilities
from .opening_utils import normalize_opening_name, get_opening_name_from_eco_code

# Load environment configuration
from .config import get_config
config = get_config()
from .cors_security import get_default_cors_config, get_production_cors_config, CORSSecurityConfig

# Load performance configuration
performance_config = get_performance_config()

# Print configuration summary
config.print_summary()
print_performance_config(performance_config)

# Initialize secure CORS configuration
cors_origins = config.api.cors_origins or ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"]
print(f"CORS Origins configured: {cors_origins}")

# Use production CORS config if we have custom origins, otherwise use default
if config.api.cors_origins:
    cors_config = CORSSecurityConfig(
        allowed_origins=cors_origins,
        allowed_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowed_headers=['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
        allow_credentials=True,
        max_age=3600
    )
    print(f"Using production CORS configuration")
else:
    cors_config = get_default_cors_config()
    print(f"Using default localhost CORS configuration")

# Debug mode configuration
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# Authentication setup - Fail fast if JWT configuration is missing
security = HTTPBearer()

# Critical security configuration - no defaults allowed
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. "
        "The application cannot start without proper JWT configuration. "
        "Set JWT_SECRET to a secure random string (minimum 32 characters)."
    )

# Optional JWT claim validation configuration
JWT_ISSUER = os.getenv("JWT_ISSUER")  # Expected 'iss' claim value
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE")  # Expected 'aud' claim value

if JWT_ISSUER:
    print(f"JWT validation configured with issuer: {JWT_ISSUER}")
if JWT_AUDIENCE:
    print(f"JWT validation configured with audience: {JWT_AUDIENCE}")

# Simple in-memory cache for analytics with TTL
_analytics_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes cache TTL

def _get_from_cache(cache_key: str) -> Optional[Dict[str, Any]]:
    """Get data from cache if it exists and is not expired."""
    if cache_key in _analytics_cache:
        cached_entry = _analytics_cache[cache_key]
        timestamp = cached_entry.get('timestamp', 0)
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            if DEBUG:
                print(f"[CACHE] Hit for key: {cache_key}")
            return cached_entry.get('data')
        else:
            # Cache expired, remove it
            if DEBUG:
                print(f"[CACHE] Expired for key: {cache_key}")
            del _analytics_cache[cache_key]
    return None

def _set_in_cache(cache_key: str, data: Dict[str, Any]) -> None:
    """Store data in cache with current timestamp."""
    _analytics_cache[cache_key] = {
        'data': data,
        'timestamp': time.time()
    }
    if DEBUG:
        print(f"[CACHE] Set for key: {cache_key}")

def _invalidate_cache(user_id: str, platform: str) -> None:
    """Invalidate all cache entries for a specific user/platform."""
    keys_to_delete = [k for k in _analytics_cache.keys() if f"{user_id}:{platform}" in k]
    for key in keys_to_delete:
        del _analytics_cache[key]
    if DEBUG and keys_to_delete:
        print(f"[CACHE] Invalidated {len(keys_to_delete)} entries for {user_id}:{platform}")

# Initialize Supabase clients with fallback for missing config
if config.database.url and config.database.anon_key:
    supabase: Client = create_client(str(config.database.url), config.database.anon_key)

    # Use service role key for move_analyses operations if available
    if config.database.service_role_key:
        supabase_service: Client = create_client(str(config.database.url), config.database.service_role_key)
        print("Using service role key for move_analyses operations")
    else:
        supabase_service: Client = supabase
        print("Service role key not found, using anon key for move_analyses operations")

    # Initialize reliable persistence system with cache invalidation callback
    persistence = ReliableAnalysisPersistence(supabase, supabase_service, on_save_callback=_invalidate_cache)
    print("Reliable analysis persistence system initialized with cache invalidation")
else:
    print("[warn]  Database configuration not found. Using mock clients for development.")
    # Create mock clients for development
    supabase = None
    supabase_service = None
    persistence = None

# Authentication utilities
async def verify_token(credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]) -> dict:
    """
    Verify JWT token with comprehensive validation.

    Validates:
    - Token signature using JWT_SECRET
    - Token expiration (exp claim)
    - Token issuer (iss claim) if JWT_ISSUER is configured
    - Token audience (aud claim) if JWT_AUDIENCE is configured

    Returns:
        dict: Decoded JWT payload if all validations pass

    Raises:
        HTTPException: 401 if token is invalid, expired, or claims don't match
    """
    from jose import JWTError, ExpiredSignatureError

    try:
        token = credentials.credentials

        # Build decode options - configure claim validation
        options = {
            "verify_signature": True,
            "verify_exp": True,  # Always verify expiration
            "verify_aud": bool(JWT_AUDIENCE),  # Verify audience if configured
            "verify_iss": bool(JWT_ISSUER),  # Verify issuer if configured
        }

        # Decode and validate token
        payload = jose_jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            options=options,
            audience=JWT_AUDIENCE if JWT_AUDIENCE else None,
            issuer=JWT_ISSUER if JWT_ISSUER else None
        )

        return payload

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Authentication token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        # Handle specific JWT validation errors
        error_msg = str(e).lower()

        if "signature" in error_msg:
            detail = "Invalid token signature. Token may be forged or corrupted."
        elif "issuer" in error_msg or "iss" in error_msg:
            detail = f"Token issuer validation failed. Expected issuer: {JWT_ISSUER}"
        elif "audience" in error_msg or "aud" in error_msg:
            detail = f"Token audience validation failed. Expected audience: {JWT_AUDIENCE}"
        elif "expired" in error_msg:
            detail = "Authentication token has expired. Please log in again."
        else:
            detail = f"Invalid authentication token: {str(e)}"

        raise HTTPException(
            status_code=401,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        # Catch-all for unexpected errors
        if DEBUG:
            print(f"[AUTH ERROR] Unexpected error during token verification: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Authentication failed. Invalid or malformed token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def verify_user_access(user_id: str, token_data: Annotated[dict, Depends(verify_token)]) -> bool:
    """Verify the authenticated user has access to the requested user_id."""
    auth_user_id = token_data.get("sub")
    if auth_user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this user's data"
        )
    return True

# Optional authentication dependency
def get_optional_auth():
    """Optional authentication dependency that can be disabled."""
    auth_enabled = os.getenv("AUTH_ENABLED", "true").lower() == "true"
    if auth_enabled:
        return Depends(verify_user_access)
    else:
        return None

# FastAPI app
app = FastAPI(
    title="Unified Chess Analysis API",
    version="3.0.0",
    description="Single, comprehensive chess analysis API with all functionality consolidated"
)

# @app.on_event("startup")
# async def startup_event():
#     """Initialize services on startup."""
#     print("Starting Chess Analytics API Server...")
#
#     # Initialize the analysis queue
#     from .analysis_queue import get_analysis_queue
#     queue = get_analysis_queue()
#
#     # Start the queue processor if it's not already running
#     if queue._queue_processor_task is None or queue._queue_processor_task.done():
#         queue._queue_processor_task = asyncio.create_task(queue._process_queue())
#         print("Analysis queue processor started")
#
#     print("Server startup complete!")

# Add global exception handler
app.add_exception_handler(Exception, global_exception_handler)

# CORS middleware with secure configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_config.allowed_origins,
    allow_credentials=cors_config.allow_credentials,
    allow_methods=cors_config.allowed_methods,
    allow_headers=cors_config.allowed_headers,
    max_age=cors_config.max_age,
)

# Global analysis engine instance
analysis_engine = None

SUPPORTED_ANALYSIS_TYPES = {"stockfish", "deep"}


def _normalize_analysis_type(requested: Optional[str], *, quiet: bool = False) -> str:
    """Map requested analysis types to the currently supported set."""
    normalized = (requested or "stockfish").lower()
    if normalized not in SUPPORTED_ANALYSIS_TYPES:
        raise ValidationError("Invalid analysis_type. Must be 'stockfish' or 'deep'", "analysis_type")
    return normalized


# In-memory storage for analysis progress
analysis_progress = {}
progress_tokens: Dict[str, str] = {}
ANALYSIS_TEST_LIMIT = int(os.getenv("ANALYSIS_TEST_LIMIT", "5"))

# Rate limiting configuration
ANALYSIS_RATE_LIMIT = int(os.getenv("ANALYSIS_RATE_LIMIT", "5"))  # requests per minute
IMPORT_RATE_LIMIT = int(os.getenv("IMPORT_RATE_LIMIT", "3"))      # requests per minute

# Track timestamps of requests by user for rate limiting
user_rate_limits: Dict[str, List[float]] = {}

# Helper for rate limiting
def _enforce_rate_limit(user_key: str, limit: int, window_seconds: int = 60) -> None:
    now = time.time()
    requests = user_rate_limits.setdefault(user_key, [])

    # Remove timestamps outside the window
    user_rate_limits[user_key] = [ts for ts in requests if now - ts < window_seconds]

    if len(user_rate_limits[user_key]) >= limit:
        raise RateLimitError("Rate limit exceeded. Please wait before retrying.")

    user_rate_limits[user_key].append(now)

# Track import progress for large imports
large_import_progress = {}
large_import_cancel_flags = {}

# Concurrency control for imports - limit concurrent imports to prevent resource exhaustion
# With optimizations, Railway Hobby tier can handle 2 concurrent imports safely
# Reduced from 3 to 2 to prevent memory exhaustion at ~800-900 games
# On higher tiers: can increase to 3-5
MAX_CONCURRENT_IMPORTS = int(os.getenv("MAX_CONCURRENT_IMPORTS", "2"))
import_semaphore = asyncio.Semaphore(MAX_CONCURRENT_IMPORTS)
import_queue = asyncio.Queue()  # Queue for waiting imports
print(f"Import concurrency limit: {MAX_CONCURRENT_IMPORTS} concurrent imports")

# Import optimization settings
IMPORT_BATCH_SIZE = int(os.getenv("IMPORT_BATCH_SIZE", "50"))  # Reduced from 100 to save memory
EXISTING_GAMES_PAGE_SIZE = int(os.getenv("EXISTING_GAMES_PAGE_SIZE", "2000"))  # Paginate existing games query

# Shared HTTP client for external API calls with connection pooling
# This prevents creating new connections for each request, reducing overhead
_shared_http_client = None

async def get_http_client():
    """Get or create shared HTTP client with connection pooling"""
    global _shared_http_client
    if _shared_http_client is None:
        import aiohttp
        timeout = aiohttp.ClientTimeout(total=120, connect=30)
        connector = aiohttp.TCPConnector(
            limit=15,  # Total concurrent connections across all hosts
            limit_per_host=6,  # Increased from 3 to 6 - allows 2 concurrent imports per platform without bottleneck
            ttl_dns_cache=300  # DNS cache TTL
        )
        _shared_http_client = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout
        )
    return _shared_http_client

# ============================================================================
# UNIFIED PYDANTIC MODELS
# ============================================================================

class UnifiedAnalysisRequest(BaseModel):
    """Unified request model for all analysis types."""
    user_id: str = Field(..., description="User ID to analyze games for")
    platform: str = Field(..., description="Platform (lichess, chess.com, etc.)")
    analysis_type: str = Field("stockfish", description="Type of analysis: stockfish or deep")
    limit: Optional[int] = Field(5, description="Maximum number of games to analyze")
    depth: Optional[int] = Field(14, description="Analysis depth for Stockfish")
    skill_level: Optional[int] = Field(20, description="Stockfish skill level (0-20)")

    # Optional parameters for different analysis types
    pgn: Optional[str] = Field(None, description="PGN string for single game analysis")
    fen: Optional[str] = Field(None, description="FEN string for position analysis")
    move: Optional[str] = Field(None, description="Move in UCI format for move analysis")
    game_id: Optional[str] = Field(None, description="Game ID for single game analysis")
    provider_game_id: Optional[str] = Field(None, description="Provider game ID for single game analysis")

class UnifiedAnalysisResponse(BaseModel):
    """Unified response model for all analysis types."""
    success: bool
    message: str
    analysis_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    progress: Optional[Dict[str, Any]] = None

class QuickPositionAnalysisRequest(BaseModel):
    """Request for quick position analysis during exploration."""
    fen: str = Field(..., description="FEN string of position to analyze")
    depth: int = Field(10, description="Analysis depth (lower for speed)")

class QuickPositionAnalysisResponse(BaseModel):
    """Response with quick position analysis."""
    fen: str
    evaluation: Dict[str, Any]
    best_move: Optional[Dict[str, str]] = None
    pv_line: List[str] = []
    analysis_time_ms: int

class GameAnalysisSummary(BaseModel):
    """Unified game analysis summary with extended metrics."""
    game_id: str
    accuracy: float
    best_move_percentage: float
    opponent_accuracy: float
    blunders: int
    mistakes: int
    inaccuracies: int
    brilliant_moves: int
    best_moves: int
    good_moves: int
    acceptable_moves: int
    opening_accuracy: float
    middle_game_accuracy: float
    endgame_accuracy: float
    average_centipawn_loss: float
    opponent_average_centipawn_loss: float
    worst_blunder_centipawn_loss: float
    opponent_worst_blunder_centipawn_loss: float
    time_management_score: float
    opponent_time_management_score: float
    material_sacrifices: int
    aggressiveness_index: float
    tactical_score: float
    positional_score: float
    aggressive_score: float
    patient_score: float
    novelty_score: float
    staleness_score: float
    average_evaluation: float
    analysis_type: str
    analysis_date: str
    processing_time_ms: int
    stockfish_depth: int = 0

class AnalysisStats(BaseModel):
    """Unified analysis statistics."""
    total_games_analyzed: int
    average_accuracy: float
    total_blunders: int
    total_mistakes: int
    total_inaccuracies: int
    total_brilliant_moves: int
    total_material_sacrifices: int
    average_opening_accuracy: float
    average_middle_game_accuracy: float
    average_endgame_accuracy: float
    average_aggressiveness_index: float
    blunders_per_game: float
    mistakes_per_game: float
    inaccuracies_per_game: float
    brilliant_moves_per_game: float
    material_sacrifices_per_game: float

class AnalysisProgress(BaseModel):
    """Analysis progress tracking."""
    analyzed_games: int
    total_games: int
    progress_percentage: int
    is_complete: bool
    current_phase: str
    estimated_time_remaining: Optional[int] = None

class PositionAnalysisResult(BaseModel):
    """Position analysis result."""
    evaluation: Dict[str, Any]
    best_move: Optional[str]
    fen: str
    analysis_type: str
    depth: Optional[int] = None

class MoveAnalysisResult(BaseModel):
    """Move analysis result."""
    move: str
    move_san: str
    evaluation: Dict[str, Any]
    best_move: Optional[str]
    is_best: bool
    is_blunder: bool
    is_mistake: bool
    is_inaccuracy: bool
    centipawn_loss: float
    depth_analyzed: int


class GameImportItem(BaseModel):
    provider_game_id: str
    pgn: str
    result: Optional[str] = None
    color: Optional[str] = None
    time_control: Optional[str] = None
    opening: Optional[str] = None
    opening_family: Optional[str] = None
    opponent_rating: Optional[int] = None
    my_rating: Optional[int] = None
    played_at: Optional[str] = None
    total_moves: Optional[int] = None
    opponent_name: Optional[str] = None


class BulkGameImportRequest(BaseModel):
    user_id: str
    platform: str
    display_name: Optional[str] = None
    games: List[GameImportItem]


class BulkGameImportResponse(BaseModel):
    success: bool
    imported_games: int
    errors: List[str] = []
    error_count: Optional[int] = None
    new_games_count: Optional[int] = None
    had_existing_games: Optional[bool] = None
    message: Optional[str] = None

class OpeningMistake(BaseModel):
    """Represents a specific opening mistake."""
    move: int
    move_notation: str
    mistake: str
    correct_move: str
    explanation: str
    severity: str  # 'critical', 'major', 'minor'
    centipawn_loss: float
    classification: str  # 'blunder', 'mistake', 'inaccuracy'
    fen: Optional[str] = None
    game_id: Optional[str] = None  # Add game_id for linking to specific games


class StyleRecommendation(BaseModel):
    """Opening recommendation based on player style."""
    opening_name: str
    compatibility_score: float
    reasoning: str
    suggested_lines: List[str] = []
    priority: str  # 'high', 'medium', 'low'


class TrendPoint(BaseModel):
    """Point in the trend line."""
    date: str
    opening_win_rate: float
    games: int
    accuracy: Optional[float] = None


class RepertoireAnalysis(BaseModel):
    """Analysis of the player's opening repertoire."""
    diversity_score: float
    white_openings: List[str]
    black_openings: List[str]
    most_successful: Dict[str, Any]
    needs_work: Dict[str, Any]
    style_match_score: float


class EnhancedOpeningAnalysis(BaseModel):
    """Enhanced opening analysis with personalized insights."""
    opening_win_rate: float
    specific_mistakes: List[OpeningMistake]
    style_recommendations: List[StyleRecommendation]
    actionable_insights: List[str]
    improvement_trend: List[TrendPoint]
    repertoire_analysis: RepertoireAnalysis


class DeepAnalysisData(BaseModel):
    """Deep analysis data for personality insights."""
    total_games: int
    average_accuracy: float
    current_rating: int
    personality_scores: Dict[str, float]
    player_level: str
    player_style: Dict[str, Any]
    primary_strengths: List[str]
    improvement_areas: List[str]
    playing_style: str
    phase_accuracies: Dict[str, float]
    recommendations: Dict[str, str]
    famous_players: Optional[Dict[str, Any]] = None
    ai_style_analysis: Optional[Dict[str, str]] = None
    personality_insights: Optional[Dict[str, str]] = None
    enhanced_opening_analysis: Optional[EnhancedOpeningAnalysis] = None

# ============================================================================
# UNIFIED API ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Unified Chess Analysis API v3.0",
        "version": "3.0.0",
        "features": [
            "unified_analysis",
            "position_analysis",
            "move_analysis",
            "game_analysis",
            "batch_analysis",
            "deep_analysis",
            "progress_tracking",
            "statistics"
        ],
        "endpoints": {
            "analysis": "/api/v1/analyze",
            "results": "/api/v1/results/{user_id}/{platform}",
            "stats": "/api/v1/stats/{user_id}/{platform}",
            "analyses": "/api/v1/analyses/{user_id}/{platform}",
            "progress": "/api/v1/progress/{user_id}/{platform}",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    engine = get_analysis_engine()
    stockfish_available = engine.stockfish_path is not None

    return {
        "status": "healthy",
        "service": "unified-chess-analysis-api",
        "version": "3.0.0",
        "stockfish_available": stockfish_available,
        "analysis_types": ["stockfish", "deep"],
        "database_connected": True,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/v1/analyze-position-quick", response_model=QuickPositionAnalysisResponse)
async def analyze_position_quick(request: QuickPositionAnalysisRequest):
    """
    Quick position analysis for exploration mode.
    Returns fast analysis without rate limits for interactive exploration.
    """
    import chess
    import chess.engine
    from concurrent.futures import ThreadPoolExecutor

    def _analyze_position(fen: str, depth: int):
        """Synchronous analysis function to run in thread pool."""
        try:
            # Validate FEN
            board = chess.Board(fen)

            # Get Stockfish path from engine
            from .analysis_engine import ChessAnalysisEngine, AnalysisConfig
            temp_engine = ChessAnalysisEngine(config=AnalysisConfig())
            stockfish_path = temp_engine.stockfish_path

            if not stockfish_path:
                raise ValueError("Stockfish not available")

            start_time = time.time()

            # Analyze with Stockfish
            with chess.engine.SimpleEngine.popen_uci(stockfish_path) as engine:
                # Configure for speed
                try:
                    engine.configure({
                        'Skill Level': 20,
                        'Threads': 1,
                        'Hash': 64,
                        'UCI_AnalyseMode': True
                    })
                except:
                    pass  # Some engines don't support all options

                # Quick analysis
                info = engine.analyse(board, chess.engine.Limit(depth=depth))

                # Extract evaluation
                score = info.get("score")
                eval_dict = {"type": "cp", "value": 0, "score_for_white": 0}

                if score:
                    if score.is_mate():
                        mate_value = score.relative.mate()
                        # Convert mate to large cp value for display
                        score_for_white = 10000 if mate_value > 0 else -10000
                        if not board.turn:  # Black to move
                            score_for_white = -score_for_white
                        eval_dict = {
                            "type": "mate",
                            "value": mate_value,
                            "score_for_white": score_for_white / 100
                        }
                    else:
                        cp_value = score.relative.score()
                        score_for_white = cp_value if board.turn else -cp_value
                        eval_dict = {
                            "type": "cp",
                            "value": cp_value,
                            "score_for_white": score_for_white / 100
                        }

                # Extract best move and PV
                pv = info.get("pv", [])
                best_move_dict = None
                pv_san = []

                if pv and len(pv) > 0:
                    best_move_uci = pv[0]
                    try:
                        best_move_dict = {
                            "san": board.san(best_move_uci),
                            "uci": best_move_uci.uci(),
                            "from": chess.square_name(best_move_uci.from_square),
                            "to": chess.square_name(best_move_uci.to_square)
                        }

                        # Convert PV to SAN (first 5 moves)
                        temp_board = board.copy()
                        for move in pv[:5]:
                            try:
                                pv_san.append(temp_board.san(move))
                                temp_board.push(move)
                            except:
                                break
                    except Exception as e:
                        print(f"Error extracting best move: {e}")

                analysis_time_ms = int((time.time() - start_time) * 1000)

                return {
                    "fen": fen,
                    "evaluation": eval_dict,
                    "best_move": best_move_dict,
                    "pv_line": pv_san,
                    "analysis_time_ms": analysis_time_ms
                }

        except Exception as e:
            print(f"Error in synchronous analysis: {e}")
            import traceback
            traceback.print_exc()
            raise

    try:
        # Run synchronous analysis in thread pool
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as executor:
            result = await loop.run_in_executor(executor, _analyze_position, request.fen, request.depth)

        return QuickPositionAnalysisResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except chess.InvalidMoveError as e:
        raise HTTPException(status_code=400, detail=f"Invalid FEN: {str(e)}")
    except Exception as e:
        print(f"Error in quick position analysis: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

@app.post("/api/v1/analyze", response_model=UnifiedAnalysisResponse)
async def unified_analyze(
    request: UnifiedAnalysisRequest,
    background_tasks: BackgroundTasks,
    # Optional parallel analysis flag
    use_parallel: bool = True,
    _auth: Optional[bool] = get_optional_auth()
):
    """
    Unified analysis endpoint that handles all analysis types.

    This single endpoint replaces:
    - /analyze-games (batch analysis)
    - /analyze-position (position analysis)
    - /analyze-move (move analysis)
    - /analyze-game (single game analysis)
    """
    try:
        # Enforce rate limit per user
        user_key = f"analysis:{request.user_id}:{request.platform}"
        _enforce_rate_limit(user_key, ANALYSIS_RATE_LIMIT)

        # Normalize and validate analysis type
        original_type = request.analysis_type
        normalized_type = _normalize_analysis_type(request.analysis_type)
        if normalized_type != original_type:
            print(f"[info] Requested analysis_type '{original_type}' mapped to '{normalized_type}' for MVP configuration.")
        request.analysis_type = normalized_type

        # Validate user_id and platform
        if not request.user_id or not isinstance(request.user_id, str):
            raise ValidationError("User ID must be a non-empty string", "user_id")

        if request.platform not in ["lichess", "chess.com"]:
            raise ValidationError("Platform must be 'lichess' or 'chess.com'", "platform")

        # Determine analysis type based on provided parameters
        if request.pgn:
            # Single game analysis with PGN
            return await _handle_single_game_analysis(request)
        elif request.game_id or request.provider_game_id:
            # Single game analysis by game_id - fetch PGN from database
            return await _handle_single_game_by_id(request)
        elif request.fen:
            if request.move:
                # Move analysis
                return await _handle_move_analysis(request)
            else:
                # Position analysis
                return await _handle_position_analysis(request)
        else:
            # Batch analysis - use the unified handler
            return await _handle_batch_analysis(request, background_tasks, use_parallel)

    except ValidationError as e:
        raise e
    except Exception as e:
        raise AnalysisError(f"Failed to process analysis request: {str(e)}", "unified")

@app.get("/api/v1/results/{user_id}/{platform}", response_model=List[GameAnalysisSummary])
async def get_analysis_results(
    user_id: str,
    platform: str,
    limit: int = Query(5, ge=1, le=100),
    analysis_type: str = Query("stockfish"),
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get analysis results for a user."""
    try:
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)
        # Debug logging (only when DEBUG=true)
        if os.getenv("DEBUG", "false").lower() == "true":
            print(f"[DEBUG] get_analysis_results called with user_id={user_id}, platform={platform}, analysis_type={analysis_type}")
            print(f"[DEBUG] canonical_user_id={canonical_user_id}")

        if not supabase and not supabase_service:
            print("[warn]  Database not available. Returning empty results.")
            return []

        # Query move_analyses table directly for Stockfish analysis
        if supabase_service:
            response = supabase_service.table('move_analyses').select('*').eq(
                'user_id', canonical_user_id
            ).eq('platform', platform).order(
                'analysis_date', desc=True
            ).limit(limit).execute()
        else:
            response = type('MockResponse', (), {'data': []})()

        if not response.data or len(response.data) == 0:
            # Return mock data for development when no real data is available
            print(f"[results] No data found for user {canonical_user_id} on {platform}, returning mock analysis results for development")
            print(f"[results] Query was: move_analyses where user_id={canonical_user_id} AND platform={platform}")
            return _get_mock_analysis_results()

        results = []
        for analysis in response.data:
            results.append(_map_move_analysis_to_response(analysis))

        return results
    except Exception as e:
        print(f"Error fetching analysis results: {e}")
        return []

@app.get("/api/v1/stats/{user_id}/{platform}", response_model=AnalysisStats)
async def get_analysis_stats(
    user_id: str,
    platform: str,
    analysis_type: str = Query("stockfish"),
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get analysis statistics for a user."""
    try:
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)

        # Check cache first
        cache_key = f"analysis_stats:{canonical_user_id}:{platform}:{analysis_type}"
        cached_data = _get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        if DEBUG:
            print(f"[DEBUG] get_analysis_stats called with user_id={user_id}, platform={platform}, analysis_type={analysis_type}")
            print(f"[DEBUG] canonical_user_id={canonical_user_id}")

        if not supabase and not supabase_service:
            print("[warn]  Database not available. Returning empty stats.")
            return _get_empty_stats()

        # PERFORMANCE FIX: Limit to recent 100 analyses instead of ALL
        # Stats are representative with 100 analyses and this is 5-10x faster!
        db_client = supabase_service or supabase
        if db_client:
            response = db_client.table('unified_analyses').select('*').eq(
                'user_id', canonical_user_id
            ).eq('platform', platform).order('analysis_date', desc=True).limit(100).execute()

            if os.getenv("DEBUG", "false").lower() == "true":
                print(f"[DEBUG] Stats query from unified_analyses: {len(response.data or [])} records (limited to 100 for performance)")
        else:
            response = type('MockResponse', (), {'data': []})()

        if not response.data or len(response.data) == 0:
            # Return mock data for development when no real data is available
            print(f"[stats] No data found for user {canonical_user_id} on {platform}, returning mock stats for development")
            print(f"[stats] Query was: unified_analyses where user_id={canonical_user_id} AND platform={platform}")
            return _get_mock_stats()

        if DEBUG:
            print(f"[DEBUG] Calculating stats for {len(response.data)} analyses")

        result = _calculate_unified_analysis_stats(response.data)
        _set_in_cache(cache_key, result)
        return result
    except Exception as e:
        print(f"Error fetching analysis stats: {e}")
        return _get_empty_stats()

@app.get("/api/v1/analyses/{user_id}/{platform}")
async def get_game_analyses(
    user_id: str,
    platform: str,
    analysis_type: str = Query("stockfish"),
    limit: int = Query(100, ge=1, le=1000, description="Number of analyses to return (1-1000)"),
    offset: int = Query(0, ge=0, description="Number of analyses to skip"),
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get individual game analyses for a user with pagination support."""
    try:
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)

        # Check cache first (only cache offset=0 to avoid too many cache entries)
        if offset == 0:
            cache_key = f"game_analyses:{canonical_user_id}:{platform}:{analysis_type}:{limit}"
            cached_data = _get_from_cache(cache_key)
            if cached_data is not None:
                return cached_data

        if DEBUG:
            print(f"[DEBUG] get_game_analyses called with user_id={user_id}, platform={platform}, analysis_type={analysis_type}, limit={limit}, offset={offset}")
        print(f"[DEBUG] canonical_user_id={canonical_user_id}")

        if not supabase and not supabase_service:
            print("[ERROR] No database connection available")
            return []

        # Query unified_analyses view which combines game_analyses and move_analyses
        # This view properly handles data priority and eliminates duplicates
        db_client = supabase_service or supabase
        response = db_client.table("unified_analyses").select("*").eq(
            "user_id", canonical_user_id
        ).eq("platform", platform).order("analysis_date", desc=True).range(
            offset, offset + limit - 1
        ).execute()

        if os.getenv("DEBUG", "false").lower() == "true":
            print(f"[DEBUG] Query response from unified_analyses: {len(response.data) if response.data else 0} records found")
            if response.data:
                print(f"[DEBUG] First record keys: {list(response.data[0].keys()) if response.data[0] else 'No keys'}")
                print(f"[DEBUG] Sample record: {str(response.data[0])[:200]}..." if response.data[0] else "No sample")

        if not response.data or len(response.data) == 0:
            print(f"[analyses] No data found for user {canonical_user_id} on {platform}")
            return []

        # Clean and serialize the data to avoid circular reference issues
        # Convert to JSON and back to ensure all objects are serializable
        import json
        cleaned_data = []
        for record in response.data:
            # Create a clean copy with only simple types
            clean_record = {}
            for key, value in record.items():
                try:
                    # Try to serialize the value
                    if value is None:
                        clean_record[key] = None
                    elif isinstance(value, (str, int, float, bool)):
                        clean_record[key] = value
                    elif isinstance(value, (dict, list)):
                        # For complex types, try to serialize and deserialize to ensure they're clean
                        try:
                            json_str = json.dumps(value)
                            clean_record[key] = json.loads(json_str)
                        except (TypeError, ValueError):
                            # If serialization fails, skip this field or use a placeholder
                            clean_record[key] = None
                    else:
                        # For any other type, convert to string
                        clean_record[key] = str(value)
                except Exception as e:
                    if DEBUG:
                        print(f"[DEBUG] Error serializing field {key}: {e}")
                    clean_record[key] = None
            cleaned_data.append(clean_record)

        if DEBUG:
            print(f"[DEBUG] Cleaned {len(cleaned_data)} records for serialization")

        # Cache the result if offset=0
        if offset == 0:
            _set_in_cache(cache_key, cleaned_data)

        return cleaned_data

    except Exception as e:
        print(f"Error fetching game analyses: {e}")
        return []

@app.get("/api/v1/analyses/{user_id}/{platform}/count")
async def get_game_analyses_count(
    user_id: str,
    platform: str,
    analysis_type: str = Query("stockfish"),
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get the total count of game analyses for a user."""
    try:
        print(f"[DEBUG] get_game_analyses_count called with user_id={user_id}, platform={platform}, analysis_type={analysis_type}")
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)
        print(f"[DEBUG] canonical_user_id={canonical_user_id}")

        if not supabase and not supabase_service:
            print("[ERROR] No database connection available")
            return {"count": 0}

        # Get count from unified_analyses view which handles deduplication
        db_client = supabase_service or supabase
        response = db_client.table("unified_analyses").select("*", count="exact").eq(
            "user_id", canonical_user_id
        ).eq("platform", platform).execute()

        total_count = response.count if hasattr(response, 'count') and response.count is not None else 0

        print(f"[DEBUG] Total analyses count from unified_analyses: {total_count}")

        return {"count": total_count}
    except Exception as e:
        print(f"Error fetching game analyses count: {e}")
        return {"count": 0}
@app.get("/api/v1/progress/{user_id}/{platform}", response_model=AnalysisProgress)
async def get_analysis_progress(
    user_id: str,
    platform: str,
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get analysis progress for a user using reliable persistence system."""
    try:
        if not persistence:
            return AnalysisProgress(
                analyzed_games=0,
                total_games=10,
                progress_percentage=0,
                is_complete=False,
                current_phase="error"
            )

        # Get progress using reliable persistence system
        progress = await persistence.get_analysis_progress(user_id, platform)

        return AnalysisProgress(
            analyzed_games=progress['completed_jobs'],
            total_games=progress['total_jobs'],
            progress_percentage=progress['progress_percentage'],
            is_complete=progress['is_complete'],
            current_phase=progress['current_phase']
        )

    except Exception as e:
        print(f"Error fetching analysis progress: {e}")
        return AnalysisProgress(
            analyzed_games=0,
            total_games=10,
            progress_percentage=0,
            is_complete=False,
            current_phase="error"
        )

@app.get("/api/v1/debug/progress")
async def debug_progress():
    """Debug endpoint to check current progress state. Only available when DEBUG=true."""
    # Only allow in debug mode
    if os.getenv("DEBUG", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Debug endpoints disabled in production")

    return {
        "analysis_progress": analysis_progress,
        "total_keys": len(analysis_progress),
        "keys": list(analysis_progress.keys())
    }

@app.get("/api/v1/progress-realtime/{user_id}/{platform}", response_model=AnalysisProgress)
async def get_realtime_analysis_progress(
    user_id: str,
    platform: str,
    analysis_type: str = Query("stockfish"),
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get real-time analysis progress by querying the database."""
    try:
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)
        normalized_type = _normalize_analysis_type(analysis_type, quiet=True)

        # Check in-memory progress first (for ongoing analysis)
        # Use canonical user ID for consistency
        platform_key = platform.strip().lower()
        progress_key = f"{canonical_user_id}_{platform_key}"
        print(f"[PROGRESS REQUEST] user_id={user_id}, platform={platform}")
        print(f"[PROGRESS REQUEST] canonical_user_id={canonical_user_id}, platform_key={platform_key}")
        print(f"[PROGRESS REQUEST] Looking for progress_key: {progress_key}")
        print(f"[PROGRESS REQUEST] Available progress keys: {list(analysis_progress.keys())}")
        if analysis_progress:
            for key, value in analysis_progress.items():
                print(f"[PROGRESS REQUEST]   Key '{key}': {value}")

        # Try multiple key formats to find progress
        progress_data = None
        stored_key = None
        possible_keys = [
            f"{canonical_user_id}_{platform_key}",
            f"{user_id.lower().strip()}_{platform_key}",
            f"{user_id}_{platform_key}",
        ]

        print(f"[PROGRESS REQUEST] Trying keys: {possible_keys}")
        for candidate_suffix in possible_keys:
            for key, value in analysis_progress.items():
                if key.endswith(candidate_suffix):
                    stored_key = key
                    progress_data = value
                    print(f"[PROGRESS REQUEST] Found progress with key: {key}")
                    print(f"[PROGRESS REQUEST] Progress data: {progress_data}")
                    break
            if progress_data:
                break

        if progress_data:
            print(f"Realtime progress for {user_id}: {progress_data}")
            return AnalysisProgress(
                analyzed_games=progress_data.get("analyzed_games", 0),
                total_games=progress_data.get("total_games", 0),
                progress_percentage=progress_data.get("progress_percentage", 0),
                is_complete=progress_data.get("is_complete", False),
                current_phase=progress_data.get("current_phase", "unknown"),
                estimated_time_remaining=progress_data.get("estimated_time_remaining")
            )
        else:
            print(f"No in-memory progress found for any of the possible keys: {possible_keys}")
            # If no in-memory progress is found, it means analysis hasn't started yet or has completed
            # Return is_complete=True to prevent frontend from getting stuck in loading loop
            # The frontend will check for actual data availability separately
            return AnalysisProgress(
                analyzed_games=0,
                total_games=0,
                progress_percentage=0,
                is_complete=True,
                current_phase="complete",
                estimated_time_remaining=None
            )

    except Exception as e:
        print(f"Error getting real-time progress: {e}")
        return AnalysisProgress(
            analyzed_games=0,
            total_games=0,
            progress_percentage=0,
            is_complete=True,
            current_phase="error",
            estimated_time_remaining=None
        )

@app.get("/api/v1/elo-stats/{user_id}/{platform}")
async def get_elo_stats(
    user_id: str,
    platform: str,
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get optimized ELO statistics for any player.

    This endpoint uses the key discovery that ELO data is available
    immediately after import - no analysis required!
    """
    try:
        canonical_user_id = _canonical_user_id(user_id, platform)

        # Check cache first
        cache_key = f"elo_stats:{canonical_user_id}:{platform}"
        cached_data = _get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        db_client = supabase_service or supabase
        if not db_client:
            raise HTTPException(status_code=503, detail="Database not configured for ELO stats")

        # Optimized query: get highest ELO in single query
        highest_response = db_client.table('games').select(
            'my_rating, time_control, provider_game_id, played_at'
        ).eq('user_id', canonical_user_id).eq('platform', platform).not_.is_(
            'my_rating', 'null'
        ).order('my_rating', desc=True).limit(1).execute()

        if not highest_response.data:
            return {
                "highest_elo": None,
                "time_control": None,
                "game_id": None,
                "played_at": None,
                "total_games": 0
            }

        highest_game = highest_response.data[0]

        # Get total games count
        count_response = db_client.table('games').select('id', count='exact', head=True).eq(
            'user_id', canonical_user_id
        ).eq('platform', platform).not_.is_('my_rating', 'null').execute()

        total_games = getattr(count_response, 'count', 0) or 0

        result = {
            "highest_elo": highest_game['my_rating'],
            "time_control": highest_game['time_control'],
            "game_id": highest_game['provider_game_id'],
            "played_at": highest_game['played_at'],
            "total_games": total_games
        }

        _set_in_cache(cache_key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching ELO stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _safe_divide(numerator: float, denominator: float) -> float:
    """Helper to avoid division by zero."""
    if not denominator:
        return 0.0
    return numerator / denominator


def _bucket_game_length(total_moves: Optional[int]) -> Optional[str]:
    """Convert a raw move count into a labeled bucket used for distribution analytics."""
    if total_moves is None or total_moves <= 0:
        return None

    if total_moves < 20:
        return "under_20"
    if total_moves < 40:
        return "20_39"
    if total_moves < 60:
        return "40_59"
    if total_moves < 80:
        return "60_79"
    if total_moves < 100:
        return "80_99"
    return "100_plus"


def _parse_termination_from_pgn(pgn: Optional[str]) -> Optional[str]:
    """Extract the Termination header from a PGN string if available."""
    if not pgn:
        return None

    match = re.search(r"Termination\s+\"([^\"]+)\"", pgn)
    if match:
        return match.group(1)
    return None


def _detect_quick_victory_type(game: Dict[str, Any], opponent_analysis: Optional[Dict[str, Any]]) -> str:
    """Classify a quick victory to highlight opponent blunders vs player attack."""
    accuracy = game.get('accuracy')
    opponent_accuracy = game.get('opponent_accuracy')
    brilliant_moves = game.get('brilliant_moves', 0)
    blunders = (opponent_analysis or {}).get('blunders') or game.get('opponent_blunders') or 0

    if opponent_accuracy is not None and opponent_accuracy < 60:
        return 'opponent_blunder'

    if accuracy is not None and accuracy >= 85:
        if brilliant_moves and brilliant_moves > 0:
            return 'tactical_blow'
        return 'clean_conversion'

    if blunders and blunders >= 2:
        return 'opponent_blunder'

    return 'other'


def _compute_comeback_metric(game: Dict[str, Any], move_analysis: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Extract comeback stats based on evaluation swings when available."""
    moves_analysis = move_analysis.get('moves_analysis') if move_analysis else game.get('moves_analysis')
    if not moves_analysis:
        return None

    comeback_found = False
    largest_swing = 0.0
    for move in moves_analysis:
        if not isinstance(move, dict):
            continue
        eval_before = move.get('evaluation_before')
        eval_after = move.get('evaluation_after')
        if eval_before is None or eval_after is None:
            continue
        swing = float(eval_after) - float(eval_before)
        # Identify sign changes that indicate comebacks
        if (eval_before < -100 and eval_after > -50) or (eval_before <= 0 < eval_after):
            comeback_found = True
        largest_swing = max(largest_swing, abs(swing))

    if not comeback_found:
        return None

    return {
        'largest_swing': round(largest_swing, 2)
    }


def _compute_patience_rating(game_analysis: Optional[Dict[str, Any]]) -> Optional[float]:
    if not game_analysis:
        return None
    patient_score = game_analysis.get('patient_score')
    if patient_score is None:
        return None
    if isinstance(patient_score, (int, float)):
        return float(patient_score)
    return None


def _compute_personal_records(existing_records: Dict[str, Any], game: Dict[str, Any], analysis: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Update running record metrics such as fastest win."""
    records = existing_records.copy()
    total_moves = game.get('total_moves') or 0
    result = game.get('result')
    accuracy = analysis.get('accuracy') if analysis else game.get('accuracy')

    if result == 'win':
        if records.get('fastest_win') is None or total_moves < records['fastest_win']['moves']:
            records['fastest_win'] = {
                'moves': total_moves,
                'game_id': game.get('provider_game_id'),
                'played_at': game.get('played_at')
            }

        if accuracy is not None:
            if records.get('highest_accuracy_win') is None or accuracy > records['highest_accuracy_win']['accuracy']:
                records['highest_accuracy_win'] = {
                    'accuracy': round(float(accuracy), 2),
                    'game_id': game.get('provider_game_id'),
                    'played_at': game.get('played_at')
                }

    if total_moves and (records.get('longest_game') is None or total_moves > records['longest_game']['moves']):
        records['longest_game'] = {
            'moves': total_moves,
            'result': result,
            'game_id': game.get('provider_game_id'),
            'played_at': game.get('played_at')
        }

    return records


def _get_time_control_category(time_control: str) -> str:
    """Helper function to categorize time controls.

    Properly parses time control strings and categorizes them based on total time.
    Aligned with Lichess boundaries and frontend logic (src/utils/timeControlUtils.ts).

    Args:
        time_control: Time control string (e.g., "180+0", "600+5", "blitz", "1800+20")

    Returns:
        Category string: 'Bullet', 'Blitz', 'Rapid', 'Classical', 'Correspondence', or 'Other'
    """
    if not time_control or time_control.lower() == 'unknown':
        return 'Unknown'

    tc = time_control.strip()
    tc_lower = tc.lower()

    # Handle correspondence games (Lichess uses "-" or formats like "1/1")
    if tc == '-' or '/' in tc or 'correspondence' in tc_lower or 'daily' in tc_lower:
        return 'Correspondence'

    # Check if it's a pre-labeled category (e.g., "bullet", "blitz", "rapid")
    if tc_lower in ['bullet', 'blitz', 'rapid', 'classical', 'correspondence']:
        return tc_lower.capitalize()

    # Parse time control to calculate total time
    total_time = 0

    try:
        if '+' in tc:
            # Format: "base+increment" (e.g., "180+0", "600+5")
            parts = tc.split('+')
            if len(parts) != 2:
                return 'Other'

            base = float(parts[0])
            increment = float(parts[1])

            # Determine if base is in minutes or seconds based on typical values
            # Lichess formats: 60, 180, 300, 600, 900, 1800 (seconds)
            # Or: 1, 3, 5, 10, 15, 30 (minutes)
            if base >= 60 and base % 60 == 0 and base <= 1800:
                # Seconds format (60, 180, 300, 600, 900, 1800)
                base_seconds = base
                increment_seconds = increment
                # Total time estimate: base + (increment * 40 moves average)
                total_time = base_seconds + increment_seconds * 40
            elif base <= 30:
                # Minutes format (1, 3, 5, 10, 15, 30)
                base_seconds = base * 60
                increment_seconds = increment
                total_time = base_seconds + increment_seconds * 40
            else:
                # Fallback: assume seconds
                total_time = base + increment * 40

        elif tc.replace('.', '', 1).isdigit():
            # Format: just a number (e.g., "180", "600")
            base = float(tc)

            if base >= 60 and base % 60 == 0 and base <= 1800:
                # Seconds format
                total_time = base
            elif base <= 30:
                # Minutes format
                total_time = base * 60
            else:
                # Fallback: assume seconds
                total_time = base
        else:
            # Unrecognized format
            return 'Other'

    except (ValueError, AttributeError):
        # Failed to parse - return Other
        return 'Other'

    # Categorize based on total time - aligned with Lichess boundaries
    # Lichess uses: Bullet (< 3 min), Blitz (3-8 min), Rapid (8-25 min), Classical (25+ min)
    if total_time < 180:
        # Less than 3 minutes (e.g., 60+0, 120+1)
        return 'Bullet'
    elif total_time < 480:
        # 3-8 minutes (e.g., 180+0, 180+2, 300+0)
        return 'Blitz'
    elif total_time < 1500:
        # 8-25 minutes (e.g., 600+0, 600+5, 900+10)
        return 'Rapid'
    else:
        # 25+ minutes (e.g., 1800+0, 1800+20)
        return 'Classical'
def _calculate_performance_trends(games: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate performance trends similar to TypeScript calculatePerformanceTrends function.

    Returns:
        - recentWinRate: Win rate from recent 50 games
        - recentAverageElo: Average ELO from recent 50 games
        - eloTrend: 'improving', 'declining', or 'stable'
        - timeControlUsed: Most played time control
        - sampleSize: Number of games in sample
        - perTimeControl: Dict with stats per time control
    """
    if not games:
        return {
            'recentWinRate': 0,
            'recentAverageElo': 0,
            'eloTrend': 'stable',
            'timeControlUsed': 'Unknown',
            'sampleSize': 0,
            'totalGamesConsidered': 0,
            'perTimeControl': {}
        }

    # Group games by time control
    by_time_control = {}
    for game in games:
        category = _get_time_control_category(game.get('time_control', ''))
        if category not in by_time_control:
            by_time_control[category] = []
        by_time_control[category].append(game)

    # Find most played time control
    most_played_time_control = max(by_time_control.keys(), key=lambda k: len(by_time_control[k]), default='Unknown')

    # Calculate stats per time control
    per_time_control = {}
    for category, category_games in by_time_control.items():
        # Sort by played_at descending
        sorted_games = sorted(category_games, key=lambda g: g.get('played_at', ''), reverse=True)

        # Use recent 50 games
        recent_games = sorted_games[:50]
        wins = len([g for g in recent_games if g.get('result') == 'win'])
        recent_win_rate = (wins / len(recent_games)) * 100 if recent_games else 0

        recent_elos = [g.get('my_rating') for g in recent_games if g.get('my_rating') is not None]
        recent_avg_elo = sum(recent_elos) / len(recent_elos) if recent_elos else 0

        # ELO trend calculation
        elo_trend = 'stable'
        if len(sorted_games) >= 40:
            first_half_elos = [g.get('my_rating') for g in sorted_games[-40:-20] if g.get('my_rating') is not None]
            second_half_elos = [g.get('my_rating') for g in sorted_games[-20:] if g.get('my_rating') is not None]

            if first_half_elos and second_half_elos:
                first_half_avg = sum(first_half_elos) / len(first_half_elos)
                second_half_avg = sum(second_half_elos) / len(second_half_elos)

                if second_half_avg > first_half_avg + 10:
                    elo_trend = 'improving'
                elif second_half_avg < first_half_avg - 10:
                    elo_trend = 'declining'

        per_time_control[category] = {
            'recentWinRate': round(recent_win_rate, 1),
            'recentAverageElo': round(recent_avg_elo, 0),
            'eloTrend': elo_trend,
            'sampleSize': len(recent_games)
        }

    # Calculate overall stats for most played time control
    filtered_games = by_time_control.get(most_played_time_control, [])
    filtered_games = sorted(filtered_games, key=lambda g: g.get('played_at', ''), reverse=True)

    recent_games = filtered_games[:50]
    recent_wins = len([g for g in recent_games if g.get('result') == 'win'])
    recent_win_rate = (recent_wins / len(recent_games)) * 100 if recent_games else 0

    recent_elos = [g.get('my_rating') for g in recent_games if g.get('my_rating') is not None]
    recent_avg_elo = sum(recent_elos) / len(recent_elos) if recent_elos else 0

    # Determine ELO trend
    elo_trend = 'stable'
    if len(filtered_games) >= 40:
        first_half_elos = [g.get('my_rating') for g in filtered_games[-40:-20] if g.get('my_rating') is not None]
        second_half_elos = [g.get('my_rating') for g in filtered_games[-20:] if g.get('my_rating') is not None]

        if first_half_elos and second_half_elos:
            first_half_avg = sum(first_half_elos) / len(first_half_elos)
            second_half_avg = sum(second_half_elos) / len(second_half_elos)

            if second_half_avg > first_half_avg + 10:
                elo_trend = 'improving'
            elif second_half_avg < first_half_avg - 10:
                elo_trend = 'declining'

    return {
        'recentWinRate': round(recent_win_rate, 1),
        'recentAverageElo': round(recent_avg_elo, 0),
        'eloTrend': elo_trend,
        'timeControlUsed': most_played_time_control,
        'sampleSize': len(recent_games),
        'totalGamesConsidered': len(filtered_games),
        'perTimeControl': per_time_control
    }


@app.get("/api/v1/comprehensive-analytics/{user_id}/{platform}")
async def get_comprehensive_analytics(
    user_id: str,
    platform: str,
    limit: int = Query(500, ge=1, le=10000, description="Number of games to analyze"),
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get comprehensive game analytics and derive distribution metrics."""
    try:
        if DEBUG:
            print(f"[DEBUG] get_comprehensive_analytics called: user_id={user_id}, platform={platform}, limit={limit}")
        canonical_user_id = _canonical_user_id(user_id, platform)
        if DEBUG:
            print(f"[DEBUG] canonical_user_id={canonical_user_id}")

        # Check cache first
        cache_key = f"comprehensive_analytics:{canonical_user_id}:{platform}:{limit}"
        cached_data = _get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        db_client = supabase_service or supabase
        if not db_client:
            print("[ERROR] Database not configured")
            raise HTTPException(status_code=503, detail="Database not configured")

        # Determine total available games (for UI pagination context)
        count_response = db_client.table('games').select('id', count='exact', head=True).eq('user_id', canonical_user_id).eq('platform', platform).execute()
        total_games_count = getattr(count_response, 'count', 0) or 0

        # Base games query constrained by requested limit
        # NOTE: For comprehensive color/opening stats, we need ALL games, not just a sample
        games_query = db_client.table('games').select('*').eq('user_id', canonical_user_id).eq('platform', platform).order('played_at', desc=True)

        # Supabase has a default limit of 1000 rows, so we need to explicitly set the limit
        # If user requests >= 10000, fetch all available games
        effective_limit = min(limit, total_games_count) if limit < 10000 else total_games_count

        # Ensure we fetch at least the requested amount or all available games
        if effective_limit > 0:
            games_response = games_query.limit(effective_limit).execute()
        else:
            # Fallback: use the requested limit if we couldn't determine total
            games_response = games_query.limit(limit).execute()

        games = games_response.data or []

        if DEBUG:
            print(f"[DEBUG] Fetched {len(games)} games out of {total_games_count} total games (requested limit={limit}, effective_limit={effective_limit})")

        if not games:
            return {
                "total_games": 0,
                "games": [],
                "sample_size": 0,
                "game_length_distribution": {},
                "win_rate_by_length": {},
                "quick_victory_breakdown": {},
                "marathon_performance": {},
                "recent_trend": {},
                "personal_records": {},
                "patience_rating": None,
                "comeback_potential": None,
                "resignation_timing": None
            }

        # Fetch analysis data for the games for richer insights
        provider_ids = [g['provider_game_id'] for g in games if g.get('provider_game_id')]
        analyses_map: Dict[str, Dict[str, Any]] = {}
        move_analyses_map: Dict[str, Dict[str, Any]] = {}

        if provider_ids:
            # game_analyses
            analyses_response = db_client.table('game_analyses').select('*').eq('user_id', canonical_user_id).eq('platform', platform).in_('game_id', provider_ids).execute()
            for row in analyses_response.data or []:
                analyses_map[row['game_id']] = row

            move_response = db_client.table('move_analyses').select('*').eq('user_id', canonical_user_id).eq('platform', platform).in_('game_id', provider_ids).execute()
            for row in move_response.data or []:
                move_analyses_map[row['game_id']] = row

        # Quick map of PGN terminations
        pgn_response = db_client.table('games_pgn').select('provider_game_id, pgn').eq('user_id', canonical_user_id).eq('platform', platform).in_('provider_game_id', provider_ids).execute()
        pgn_map = {row['provider_game_id']: row.get('pgn') for row in (pgn_response.data or [])}

        # Distribution counters
        distribution: Dict[str, Dict[str, Any]] = {}
        quick_victory_breakdown = Counter()

        total_moves = 0
        marathon_games = []
        resignation_moves = []
        opponent_resignation_moves = []
        patience_scores: List[float] = []

        records: Dict[str, Any] = {
            'fastest_win': None,
            'highest_accuracy_win': None,
            'longest_game': None
        }
        comeback_summaries: List[Dict[str, Any]] = []

        last_fifty = games[:50]
        last_fifty_moves = [g['total_moves'] for g in last_fifty if g.get('total_moves')]
        baseline_moves = [g['total_moves'] for g in games[50:200] if g.get('total_moves')]

        for game in games:
            bucket = _bucket_game_length(game.get('total_moves'))
            result = game.get('result')
            game_id = game.get('provider_game_id')
            total_moves += game.get('total_moves') or 0

            if bucket:
                bucket_entry = distribution.setdefault(bucket, {'games': 0, 'wins': 0, 'losses': 0, 'draws': 0})
                bucket_entry['games'] += 1
                if result == 'win':
                    bucket_entry['wins'] += 1
                elif result == 'loss':
                    bucket_entry['losses'] += 1
                elif result == 'draw':
                    bucket_entry['draws'] += 1

            analysis = analyses_map.get(game_id)
            move_analysis = move_analyses_map.get(game_id)

            # Quick victory classification (<20 moves win)
            if game.get('total_moves') and game['total_moves'] < 20 and result == 'win':
                victory_type = _detect_quick_victory_type(analysis or game, move_analysis)
                quick_victory_breakdown[victory_type] += 1

            # Marathon stats (>80 moves)
            if game.get('total_moves') and game['total_moves'] >= 80:
                marathon_games.append({
                    'game_id': game_id,
                    'moves': game['total_moves'],
                    'result': result,
                    'accuracy': (analysis or game).get('accuracy'),
                    'time_management_score': (analysis or game).get('time_management_score'),
                    'blunders': (analysis or game).get('blunders'),
                    'opponent_blunders': (analysis or game).get('opponent_blunders')
                })

            # Resignation timing derived from PGN header
            termination = _parse_termination_from_pgn(pgn_map.get(game_id)) if pgn_map else None
            if termination:
                # Check for resignations
                if 'resign' in termination.lower():
                    if ('opponent' in termination.lower() or 'resigned' in termination.lower()) and result == 'win':
                        opponent_resignation_moves.append(game.get('total_moves') or 0)
                    else:
                        resignation_moves.append(game.get('total_moves') or 0)

            # Patience rating
            patience_score = _compute_patience_rating(analysis)
            if patience_score is not None:
                patience_scores.append(patience_score)

            # Update records
            records = _compute_personal_records(records, game, analysis)

            # Comeback stats
            comeback_stats = _compute_comeback_metric(game, move_analysis)
            if comeback_stats:
                comeback_summaries.append(comeback_stats)

        # Compute aggregated metrics
        distribution_summary = {}
        for bucket, stats in distribution.items():
            win_rate = _safe_divide(stats['wins'], stats['games']) * 100
            distribution_summary[bucket] = {**stats, 'win_rate': round(win_rate, 2)}

        quick_victory_summary = {label: count for label, count in quick_victory_breakdown.items()}

        marathon_summary = {}
        if marathon_games:
            # FIXED: Only include games with actual analysis data (filter out None values)
            accuracy_values = [g['accuracy'] for g in marathon_games if g.get('accuracy') is not None]
            blunders_values = [g['blunders'] for g in marathon_games if g.get('blunders') is not None]
            time_management_values = [g['time_management_score'] for g in marathon_games if g.get('time_management_score') is not None]

            marathon_summary = {
                'count': len(marathon_games),
                'analyzed_count': len(accuracy_values),  # Add count of analyzed games
                'average_accuracy': round(sum(accuracy_values) / len(accuracy_values), 2) if accuracy_values else None,
                'average_blunders': round(sum(blunders_values) / len(blunders_values), 2) if blunders_values else None,
                'average_time_management': round(sum(time_management_values) / len(time_management_values), 2) if time_management_values else None
            }

        recent_trend = {}
        if last_fifty_moves:
            recent_avg = sum(last_fifty_moves) / len(last_fifty_moves)
            baseline_avg = sum(baseline_moves) / len(baseline_moves) if baseline_moves else recent_avg
            recent_trend = {
                'recent_average_moves': round(recent_avg, 2),
                'baseline_average_moves': round(baseline_avg, 2),
                'difference': round(recent_avg - baseline_avg, 2)
            }

        patience_rating = round(sum(patience_scores) / len(patience_scores), 2) if patience_scores else None

        comeback_summary = None
        if comeback_summaries:
            comeback_summary = {
                'games': len(comeback_summaries),
                'average_largest_swing': round(
                    sum(entry['largest_swing'] for entry in comeback_summaries) / len(comeback_summaries),
                    2
                )
            }

        resignation_summary = None
        if resignation_moves or opponent_resignation_moves:
            # Calculate recent resignation timing (last 50 games)
            recent_resignation_moves = []
            for i, game in enumerate(games[:50]):
                game_id = game.get('provider_game_id')
                termination = _parse_termination_from_pgn(pgn_map.get(game_id)) if pgn_map else None
                result = game.get('result')
                if termination and 'resign' in termination.lower():
                    # Determine if this is my resignation or opponent's
                    if ('opponent' in termination.lower() or 'resigned' in termination.lower()) and result == 'win':
                        # Opponent resigned
                        pass
                    else:
                        # I resigned
                        recent_resignation_moves.append(game.get('total_moves') or 0)

            recent_avg = round(sum(recent_resignation_moves) / len(recent_resignation_moves), 2) if recent_resignation_moves else None
            overall_avg = round(sum(resignation_moves) / len(resignation_moves), 2) if resignation_moves else None

            # Calculate change and insight
            change = round(recent_avg - overall_avg, 1) if (recent_avg and overall_avg) else None
            insight = None
            if change is not None:
                abs_change = abs(change)
                if change < 0:
                    insight = f"You're resigning {abs_change} moves earlier than usual"
                elif change > 0:
                    insight = f"You're fighting {abs_change} moves longer before resigning"
                else:
                    insight = "Your resignation timing is consistent"

            resignation_summary = {
                'my_average_resignation_move': overall_avg,
                'opponent_average_resignation_move': round(sum(opponent_resignation_moves) / len(opponent_resignation_moves), 2) if opponent_resignation_moves else None,
                'my_resignations': len(resignation_moves),
                'opponent_resignations': len(opponent_resignation_moves),
                'recent_average_resignation_move': recent_avg,
                'recent_resignations': len(recent_resignation_moves),
                'change': change,
                'insight': insight
            }

        # Calculate basic analytics from games
        wins = len([g for g in games if g.get('result') == 'win'])
        draws = len([g for g in games if g.get('result') == 'draw'])
        losses = len([g for g in games if g.get('result') == 'loss'])

        win_rate = _safe_divide(wins, len(games)) * 100
        draw_rate = _safe_divide(draws, len(games)) * 100
        loss_rate = _safe_divide(losses, len(games)) * 100

        # Color stats
        white_games = [g for g in games if g.get('color') == 'white']
        black_games = [g for g in games if g.get('color') == 'black']

        white_wins = len([g for g in white_games if g.get('result') == 'win'])
        black_wins = len([g for g in black_games if g.get('result') == 'win'])

        white_elos = [g.get('my_rating') for g in white_games if g.get('my_rating')]
        black_elos = [g.get('my_rating') for g in black_games if g.get('my_rating')]

        color_stats = {
            'white': {
                'games': len(white_games),
                'winRate': round(_safe_divide(white_wins, len(white_games)) * 100, 1) if white_games else 0,
                'averageElo': round(sum(white_elos) / len(white_elos), 0) if white_elos else 0
            },
            'black': {
                'games': len(black_games),
                'winRate': round(_safe_divide(black_wins, len(black_games)) * 100, 1) if black_games else 0,
                'averageElo': round(sum(black_elos) / len(black_elos), 0) if black_elos else 0
            }
        }

        # Opening stats
        opening_performance = {}
        for game in games:
            opening = game.get('opening_normalized') or game.get('opening') or 'Unknown'
            if opening not in opening_performance:
                opening_performance[opening] = {'games': 0, 'wins': 0, 'draws': 0, 'losses': 0, 'elos': []}

            opening_performance[opening]['games'] += 1
            result = game.get('result')
            if result == 'win':
                opening_performance[opening]['wins'] += 1
            elif result == 'draw':
                opening_performance[opening]['draws'] += 1
            elif result == 'loss':
                opening_performance[opening]['losses'] += 1

            # Track ELO for this opening
            if game.get('my_rating'):
                opening_performance[opening]['elos'].append(game.get('my_rating'))

        opening_stats = []
        for opening, stats in opening_performance.items():
            avg_elo = round(sum(stats['elos']) / len(stats['elos']), 0) if stats['elos'] else 0
            opening_stats.append({
                'opening': opening,
                'games': stats['games'],
                'wins': stats['wins'],
                'draws': stats['draws'],
                'losses': stats['losses'],
                'winRate': round(_safe_divide(stats['wins'], stats['games']) * 100, 1),
                'averageElo': avg_elo
            })

        # Sort by number of games played
        opening_stats.sort(key=lambda x: x['games'], reverse=True)

        # Opening stats by color
        opening_color_performance = {'white': {}, 'black': {}}
        for game in games:
            color = game.get('color')
            if color not in ['white', 'black']:
                continue

            opening = game.get('opening_normalized') or game.get('opening') or 'Unknown'
            if opening not in opening_color_performance[color]:
                opening_color_performance[color][opening] = {'games': 0, 'wins': 0, 'draws': 0, 'losses': 0, 'elos': []}

            opening_color_performance[color][opening]['games'] += 1
            result = game.get('result')
            if result == 'win':
                opening_color_performance[color][opening]['wins'] += 1
            elif result == 'draw':
                opening_color_performance[color][opening]['draws'] += 1
            elif result == 'loss':
                opening_color_performance[color][opening]['losses'] += 1

            if game.get('my_rating'):
                opening_color_performance[color][opening]['elos'].append(game.get('my_rating'))

        opening_color_stats = {'white': [], 'black': []}
        for color in ['white', 'black']:
            for opening, stats in opening_color_performance[color].items():
                avg_elo = round(sum(stats['elos']) / len(stats['elos']), 0) if stats['elos'] else 0
                opening_color_stats[color].append({
                    'opening': opening,
                    'games': stats['games'],
                    'wins': stats['wins'],
                    'draws': stats['draws'],
                    'losses': stats['losses'],
                    'winRate': round(_safe_divide(stats['wins'], stats['games']) * 100, 1),
                    'averageElo': avg_elo
                })
            # Sort by number of games
            opening_color_stats[color].sort(key=lambda x: x['games'], reverse=True)

        # Highest ELO
        highest_elo = None
        time_control_with_highest_elo = None
        elos_with_tc = [(g.get('my_rating'), g.get('time_control')) for g in games if g.get('my_rating')]
        if elos_with_tc:
            highest_elo_tuple = max(elos_with_tc, key=lambda x: x[0])
            highest_elo = highest_elo_tuple[0]
            time_control_with_highest_elo = highest_elo_tuple[1]

        # Calculate performance trends (for Recent Performance section)
        performance_trends = _calculate_performance_trends(games)

        # Calculate current ELO (most recent rating across all games)
        current_elo = None
        games_sorted_by_date = sorted(games, key=lambda g: g.get('played_at', ''), reverse=True)
        for game in games_sorted_by_date:
            if game.get('my_rating'):
                current_elo = game['my_rating']
                break

        # Calculate current ELO per time control (most recent rating for each time control)
        current_elo_per_time_control = {}
        games_by_tc = {}
        for game in games:
            tc = game.get('time_control', '')
            if tc:
                # Use the same time control categorization as performance trends
                tc_category = _get_time_control_category(tc)
                if tc_category not in games_by_tc:
                    games_by_tc[tc_category] = []
                games_by_tc[tc_category].append(game)

        for tc_category, tc_games in games_by_tc.items():
            tc_sorted = sorted(tc_games, key=lambda g: g.get('played_at', ''), reverse=True)
            for game in tc_sorted:
                if game.get('my_rating'):
                    current_elo_per_time_control[tc_category] = game['my_rating']
                    break

        result = {
            'total_games': total_games_count,
            'totalGames': len(games),  # Actual games analyzed
            'winRate': round(win_rate, 1),
            'drawRate': round(draw_rate, 1),
            'lossRate': round(loss_rate, 1),
            'colorStats': color_stats,
            'openingStats': opening_stats,
            'openingColorStats': opening_color_stats,
            'highestElo': highest_elo,
            'timeControlWithHighestElo': time_control_with_highest_elo,
            'currentElo': current_elo,
            'currentEloPerTimeControl': current_elo_per_time_control,
            'performanceTrends': performance_trends,
            'games': games,
            'sample_size': len(games),
            'game_length_distribution': distribution_summary,
            'quick_victory_breakdown': quick_victory_summary,
            'marathon_performance': marathon_summary,
            'recent_trend': recent_trend,
            'personal_records': records,
            'patience_rating': patience_rating,
            'comeback_potential': comeback_summary,
            'resignation_timing': resignation_summary
        }

        # Cache the result before returning
        _set_in_cache(cache_key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Error in get_comprehensive_analytics: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching comprehensive analytics: {str(e)}")

@app.get("/api/v1/elo-history/{user_id}/{platform}")
async def get_elo_history(
    user_id: str,
    platform: str,
    limit: int = Query(500, ge=1, le=2000, description="Number of recent games to return"),
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get ELO history for ELO trend graph.

    Returns recent games with ratings and time controls.
    Replaces EloTrendGraph.tsx direct Supabase queries.
    """
    try:
        canonical_user_id = _canonical_user_id(user_id, platform)
        db_client = supabase_service or supabase
        if not db_client:
            raise HTTPException(status_code=503, detail="Database not configured")

        # Fetch recent games with ELO data
        response = db_client.table('games').select(
            'time_control, my_rating, played_at, provider_game_id'
        ).eq('user_id', canonical_user_id).eq('platform', platform).not_.is_(
            'my_rating', 'null'
        ).not_.is_('time_control', 'null').order(
            'played_at', desc=True
        ).limit(limit).execute()

        if not response.data:
            return []

        # Rename provider_game_id to id for frontend compatibility
        result = []
        for game in response.data:
            result.append({
                'time_control': game['time_control'],
                'my_rating': game['my_rating'],
                'played_at': game['played_at'],
                'id': game['provider_game_id']
            })

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching ELO history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/player-stats/{user_id}/{platform}")
async def get_player_stats(
    user_id: str,
    platform: str,
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get player statistics including highest ELO with detailed validation.

    Replaces playerStats.ts direct Supabase queries.
    """
    try:
        canonical_user_id = _canonical_user_id(user_id, platform)

        # Check cache first
        cache_key = f"player_stats:{canonical_user_id}:{platform}"
        cached_data = _get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        db_client = supabase_service or supabase
        if not db_client:
            raise HTTPException(status_code=503, detail="Database not configured")

        # Get highest ELO game with additional details
        response = db_client.table('games').select(
            'my_rating, time_control, provider_game_id, played_at, opponent_rating, color'
        ).eq('user_id', canonical_user_id).eq('platform', platform).not_.is_(
            'my_rating', 'null'
        ).order('my_rating', desc=True).limit(1).execute()

        if not response.data or len(response.data) == 0:
            return {
                "highest_elo": None,
                "time_control_with_highest_elo": None,
                "validation_issues": []
            }

        game = response.data[0]
        validation_issues = []

        # Simple validation
        if game['my_rating'] < 100 or game['my_rating'] > 4000:
            validation_issues.append(f"Invalid player rating {game['my_rating']} in game {game['provider_game_id']}")

        result = {
            "highest_elo": game['my_rating'],
            "time_control_with_highest_elo": game['time_control'],
            "game_id": game['provider_game_id'],
            "played_at": game['played_at'],
            "opponent_rating": game.get('opponent_rating'),
            "color": game.get('color'),
            "validation_issues": validation_issues
        }

        _set_in_cache(cache_key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching player stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/match-history/{user_id}/{platform}")
async def get_match_history(
    user_id: str,
    platform: str,
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=100, description="Games per page"),
    opening_filter: Optional[str] = Query(None, description="Filter by opening_normalized"),
    opponent_filter: Optional[str] = Query(None, description="Filter by opponent_name"),
    color_filter: Optional[str] = Query(None, description="Filter by color (white/black)"),
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get match history (recent games) for a user.

    Returns paginated list of games with optional filters.
    Replaces MatchHistory.tsx direct Supabase queries.
    """
    try:
        canonical_user_id = _canonical_user_id(user_id, platform)
        db_client = supabase_service or supabase
        if not db_client:
            raise HTTPException(status_code=503, detail="Database not configured")

        # Build query
        query = db_client.table('games').select(
            'id, user_id, platform, result, color, opening, opening_family, opening_normalized, '
            'accuracy, opponent_rating, my_rating, time_control, played_at, created_at, '
            'provider_game_id, total_moves, opponent_name'
        ).eq('user_id', canonical_user_id).eq('platform', platform)

        # Apply filters
        if opening_filter:
            query = query.eq('opening_normalized', opening_filter)

        if opponent_filter:
            query = query.eq('opponent_name', opponent_filter)

        if color_filter and color_filter in ['white', 'black']:
            query = query.eq('color', color_filter)

        # Pagination
        page_start = (page - 1) * limit
        page_end = page * limit - 1

        response = query.order('played_at', desc=True).range(page_start, page_end).execute()

        if not response.data:
            return []

        return response.data

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching match history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/deep-analysis/{user_id}/{platform}", response_model=DeepAnalysisData)
async def get_deep_analysis(
    user_id: str,
    platform: str,
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get deep analysis with personality insights."""
    try:
        if DEBUG:
            print(f"[INFO] Deep analysis request for user_id={user_id}, platform={platform}")
        canonical_user_id = _canonical_user_id(user_id, platform)
        if DEBUG:
            print(f"[INFO] Canonical user_id={canonical_user_id}")

        # Check cache first
        cache_key = f"deep_analysis:{canonical_user_id}:{platform}"
        cached_data = _get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        db_client = supabase_service or supabase
        if not db_client:
            raise HTTPException(status_code=503, detail="Database not configured for deep analysis")

        # PERFORMANCE: Reduced from 500 to 100 games (5x faster)
        # Recent games are more relevant for personality analysis
        # IMPORTANT: Also fetch 'id' field for proper game-analysis matching
        games_response = db_client.table('games').select(
            'id, provider_game_id, result, opening, opening_family, opening_normalized, time_control, my_rating, played_at'
        ).eq('user_id', canonical_user_id).eq('platform', platform).not_.is_(
            'my_rating', 'null'
        ).order('played_at', desc=True).limit(100).execute()
        games = games_response.data or []

        profile_response = db_client.table('user_profiles').select('current_rating').eq(
            'user_id', canonical_user_id
        ).eq('platform', platform).maybe_single().execute()
        profile = getattr(profile_response, 'data', None) or {}

        # PERFORMANCE: Try unified_analyses first, fallback to move_analyses
        # unified_analyses combines both tables but may have structure differences
        analyses = []

        try:
            analyses_response = db_client.table('unified_analyses').select('*').eq(
                'user_id', canonical_user_id
            ).eq('platform', platform).order('analysis_date', desc=True).limit(100).execute()
            analyses = analyses_response.data or []
            if DEBUG:
                print(f"[DEBUG] unified_analyses query found {len(analyses)} records")

            # Check if analyses have moves_analysis field
            if analyses and not any(a.get('moves_analysis') for a in analyses):
                if DEBUG:
                    print(f"[DEBUG] unified_analyses records don't have moves_analysis field, trying move_analyses table")
                analyses = []
        except Exception as e:
            if DEBUG:
                print(f"[DEBUG] unified_analyses query failed: {e}")
            analyses = []

        # Fallback to move_analyses if unified doesn't work
        if not analyses:
            try:
                analyses_response = db_client.table('move_analyses').select('*').eq(
                    'user_id', canonical_user_id
                ).eq('platform', platform).order('analysis_date', desc=True).limit(100).execute()
                analyses = analyses_response.data or []
                if DEBUG:
                    print(f"[DEBUG] move_analyses query found {len(analyses)} records")
            except Exception as e:
                if DEBUG:
                    print(f"[DEBUG] move_analyses query failed: {e}")
                analyses = []

        # Final fallback to game_analyses (different structure, needs transformation)
        if not analyses:
            try:
                analyses_response = db_client.table('game_analyses').select('*').eq(
                    'user_id', canonical_user_id
                ).eq('platform', platform).order('created_at', desc=True).limit(100).execute()
                game_analyses = analyses_response.data or []
                if DEBUG:
                    print(f"[DEBUG] game_analyses query found {len(game_analyses)} records")

                # Transform game_analyses format to match expected structure
                analyses = []
                for ga in game_analyses:
                    analyses.append({
                        'game_id': ga.get('game_id'),
                        'user_id': ga.get('user_id'),
                        'platform': ga.get('platform'),
                        'moves_analysis': ga.get('moves_analysis', []),
                        'analysis_date': ga.get('created_at'),
                        'best_move_percentage': ga.get('accuracy'),
                        'accuracy': ga.get('accuracy')
                    })
            except Exception as e:
                if DEBUG:
                    print(f"[DEBUG] game_analyses query failed: {e}")
                analyses = []

        if DEBUG:
            print(f"[DEBUG] Final analyses count: {len(analyses)} for {canonical_user_id}")

        if not analyses:
            result = _build_fallback_deep_analysis(canonical_user_id, games, profile)
        else:
            result = _build_deep_analysis_response(canonical_user_id, games, analyses, profile)

        # Cache the result before returning
        _set_in_cache(cache_key, result)

        # TODO: Cache the result for 15 minutes (implement caching functions)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching deep analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/job-status/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of an analysis job."""
    try:
        from .analysis_queue import get_analysis_queue
        queue = get_analysis_queue()
        job = queue.get_job_status(job_id)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        return {
            "job_id": job.job_id,
            "user_id": job.user_id,
            "platform": job.platform,
            "analysis_type": job.analysis_type,
            "status": job.status.value,
            "progress_percentage": job.progress_percentage,
            "current_phase": job.current_phase,
            "total_games": job.total_games,
            "analyzed_games": job.analyzed_games,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error_message": job.error_message,
            "result": job.result
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching job status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/v1/queue-stats")
async def get_queue_stats():
    """Get analysis queue statistics."""
    try:
        from .analysis_queue import get_analysis_queue
        queue = get_analysis_queue()
        stats = queue.get_queue_stats()
        return stats
    except Exception as e:
        print(f"Error fetching queue stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/job/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a pending analysis job."""
    try:
        from .analysis_queue import get_analysis_queue
        queue = get_analysis_queue()
        success = queue.cancel_job(job_id)

        if not success:
            raise HTTPException(status_code=404, detail="Job not found or cannot be cancelled")

        return {"success": True, "message": f"Job {job_id} cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error cancelling job: {e}")
        raise HTTPException(status_code=500, detail=str(e))



PERSONALITY_LABELS = {
    'tactical': 'Tactical awareness',
    'positional': 'Positional understanding',
    'aggressive': 'Attacking initiative',
    'patient': 'Defensive technique',
    'novelty': 'Creativity',
    'staleness': 'Staleness',
}

CORE_PERSONALITY_KEYS = [
    'tactical',
    'positional',
    'aggressive',
    'patient',
    'novelty',
    'staleness',
]

STYLE_CATEGORY_MAP = {
    'tactical': ('tactical', 'Thrives in dynamic, calculation-heavy situations.'),
    'aggressive': ('aggressive', 'Looks to seize the initiative and pressure the opponent.'),
    'positional': ('positional', 'Prefers long-term advantages and structural edges.'),
    'patient': ('balanced', 'Keeps the position under control and minimises risk.'),
}

STYLE_SUMMARIES = {
    'tactical': 'Tactical fighter who thrives in dynamic positions.',
    'aggressive': 'Aggressive initiative hunter looking for sharp play.',
    'positional': 'Strategic planner who values positional advantages.',
    'balanced': 'Balanced and patient style that values solidity.',
}
def _coerce_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
def _safe_average(values: List[Optional[float]], default: float = 0.0) -> float:
    filtered = [v for v in values if v is not None]
    if not filtered:
        return default
    return sum(filtered) / len(filtered)


def _round2(value: Optional[float]) -> float:
    if value is None:
        return 0.0
    return round(float(value), 2)


def _infer_current_rating(games: List[Dict[str, Any]], profile: Dict[str, Any]) -> int:
    """Get the highest ELO rating efficiently from games data.

    This function prioritizes the highest game rating over profile rating
    because profile ratings can be outdated.
    """
    # First, get the highest rating from games (most accurate)
    if games:
        highest_rating = 0
        for game in games:
            game_rating = _coerce_float(game.get('my_rating'))
            if game_rating and game_rating > highest_rating:
                highest_rating = game_rating

        if highest_rating > 0:
            return int(round(highest_rating))

    # Fallback to profile rating if no game ratings available
    rating = _coerce_float((profile or {}).get('current_rating'))
    if rating:
        return int(round(rating))

    return 0


def _compute_opening_accuracy_from_moves(analyses: List[Dict[str, Any]]) -> float:
    """
    Calculate opening accuracy using centipawn loss (Chess.com style).
    This provides realistic accuracy scores based on move quality, not just binary best/not-best.
    """
    if not analyses:
        return 0.0

    total_accuracy = 0.0
    games_with_opening_moves = 0

    for analysis in analyses:
        moves = analysis.get('moves_analysis') or []
        # Filter for opening moves (first 20 ply) and user moves only
        opening_moves = [
            move for move in moves
            if move.get('opening_ply', 0) <= 20 and move.get('is_user_move', False)
        ]

        if opening_moves:
            # Use the proper centipawn loss based calculation
            game_opening_accuracy = _calculate_opening_accuracy_chesscom(opening_moves)
            total_accuracy += game_opening_accuracy
            games_with_opening_moves += 1

    return total_accuracy / games_with_opening_moves if games_with_opening_moves > 0 else 0.0


def _calculate_accuracy_from_cpl(centipawn_losses: List[float]) -> float:
    """
    Calculate accuracy using Chess.com-style formula for realistic scoring.

    Based on Chess.com's CAPS2 algorithm research, uses conservative thresholds:
    - 0-5 CPL: 100% accuracy (perfect moves)
    - 6-20 CPL: 85-100% accuracy (excellent moves)
    - 21-40 CPL: 70-85% accuracy (good moves)
    - 41-80 CPL: 50-70% accuracy (inaccuracies)
    - 81-150 CPL: 30-50% accuracy (mistakes)
    - 150+ CPL: 15-30% accuracy (blunders)
    """
    if not centipawn_losses:
        return 0.0

    total_accuracy = 0.0
    for cpl in centipawn_losses:
        # Cap centipawn loss at 1000 to avoid math errors
        cpl = min(cpl, 1000)

        # Chess.com-style accuracy calculation with conservative thresholds
        if cpl <= 5:
            move_accuracy = 100.0  # Only truly perfect moves
        elif cpl <= 20:
            # Linear interpolation from 100% to 85% for 5-20 CPL
            move_accuracy = 100.0 - (cpl - 5) * 1.0  # 100% to 85%
        elif cpl <= 40:
            # Linear interpolation from 85% to 70% for 20-40 CPL
            move_accuracy = 85.0 - (cpl - 20) * 0.75  # 85% to 70%
        elif cpl <= 80:
            # Linear interpolation from 70% to 50% for 40-80 CPL
            move_accuracy = 70.0 - (cpl - 40) * 0.5  # 70% to 50%
        elif cpl <= 150:
            # Linear interpolation from 50% to 30% for 80-150 CPL
            move_accuracy = 50.0 - (cpl - 80) * 0.286  # 50% to 30%
        else:
            # Linear interpolation from 30% to 15% for 150+ CPL
            move_accuracy = max(15.0, 30.0 - (cpl - 150) * 0.1)  # 30% to 15%

        total_accuracy += move_accuracy

    return total_accuracy / len(centipawn_losses)


def _calculate_opening_accuracy_chesscom(moves: List[dict]) -> float:
    """
    Calculate opening accuracy using Chess.com's CAPS2 algorithm (same as overall accuracy).
    Uses the standard accuracy formula consistently across all game phases.
    """
    if not moves:
        return 0.0

    # Extract centipawn losses from moves
    centipawn_losses = [move.get('centipawn_loss', 0) for move in moves]

    # Use the same formula as overall game accuracy (Chess.com CAPS2)
    return _calculate_accuracy_from_cpl(centipawn_losses)
def _estimate_novelty_from_games(games: List[Dict[str, Any]]) -> float:
    """Estimate novelty from game-level patterns - opening variety, time control diversity.

    Natural opposition with staleness through shared diversity/repetition metrics.
    Centered around 50 (neutral) with proper distribution.
    """
    if not games:
        return 50.0

    total = len(games)
    if total < 2:
        return 50.0  # Need at least 2 games to measure variety

    # Shared metrics with staleness (natural opposition)
    # Use opening_normalized for better grouping (e.g., "Italian Game" instead of "C50")
    # IMPORTANT: Prioritize actual opening name over ECO code to avoid "Uncommon Opening" for A00
    opening_counts = Counter(
        (game.get('opening_normalized') or game.get('opening') or game.get('opening_family') or 'Unknown')
        for game in games
    )
    time_counts = Counter(
        (game.get('time_control') or 'Unknown')
        for game in games
    )

    # Diversity metrics
    unique_openings = len(opening_counts)
    unique_time_controls = len(time_counts)

    # Repetition metrics (opposite of diversity)
    most_common_opening_count = max(opening_counts.values()) if opening_counts else 0
    opening_repetition_ratio = most_common_opening_count / total

    # Calculate diversity ratios
    opening_diversity_ratio = unique_openings / total
    time_diversity_ratio = unique_time_controls / total

    # FIXED FORMULA: Centered around 50 (neutral)
    # Expected ranges:
    # - Low diversity (repetitive): 0.10-0.20 ratio (4-8 unique openings in 40 games) → 30-40 score
    # - Normal diversity: 0.20-0.30 ratio (8-12 unique openings) → 45-55 score
    # - High diversity (creative): 0.35-0.60+ ratio (14-24+ unique openings) → 60-80 score

    base = 50.0  # Neutral starting point

    # Opening diversity component - centered around 0.25 (normal variety)
    # Deviation from normal (0.25) × 80 gives ±20 points for ±0.25 deviation
    opening_component = (opening_diversity_ratio - 0.25) * 80.0

    # Time diversity component - less impactful, centered around 0.05 (1-2 time controls)
    time_component = (time_diversity_ratio - 0.05) * 40.0

    # Repetition penalty - if playing same opening > 25% of games
    # Normal: most common ~20-30%, High repetition: >40%
    repetition_component = max(0, (opening_repetition_ratio - 0.25) * 60.0)

    score = base + opening_component + time_component - repetition_component
    return max(0.0, min(100.0, score))


def _estimate_staleness_from_games(games: List[Dict[str, Any]]) -> float:
    """Estimate staleness from game-level patterns - opening repetition, time control consistency.

    Natural opposition with novelty through shared diversity/repetition metrics.
    Centered around 50 (neutral) with proper distribution.
    """
    if not games:
        return 50.0

    total = len(games)
    if total < 2:
        return 50.0  # Need at least 2 games to measure staleness

    # Shared metrics with novelty (natural opposition)
    # Use opening_normalized for better grouping (e.g., "Italian Game" instead of "C50")
    # IMPORTANT: Prioritize actual opening name over ECO code to avoid "Uncommon Opening" for A00
    opening_counts = Counter(
        (game.get('opening_normalized') or game.get('opening') or game.get('opening_family') or 'Unknown')
        for game in games
    )
    time_counts = Counter(
        (game.get('time_control') or 'Unknown')
        for game in games
    )

    # Repetition metrics
    most_common_opening_count = max(opening_counts.values()) if opening_counts else 0
    most_common_time_count = max(time_counts.values()) if time_counts else 0
    opening_repetition_ratio = most_common_opening_count / total
    time_repetition_ratio = most_common_time_count / total

    # Diversity metrics (opposite of repetition)
    unique_openings = len(opening_counts)
    unique_time_controls = len(time_counts)

    # Calculate diversity ratios
    opening_diversity_ratio = unique_openings / total
    time_diversity_ratio = unique_time_controls / total

    # FIXED FORMULA: Centered around 50 (neutral) - natural opposition to novelty
    # Expected ranges:
    # - Low staleness (varied): 0.10-0.20 repetition ratio → 30-40 score
    # - Normal staleness: 0.20-0.30 repetition ratio → 45-55 score
    # - High staleness (repetitive): 0.40-0.60+ repetition ratio → 60-80 score

    base = 50.0  # Neutral starting point

    # Repetition component - centered around 0.25 (normal repetition)
    # Deviation from normal (0.25) × 80 gives ±20 points for ±0.25 deviation
    repetition_component = (opening_repetition_ratio - 0.25) * 80.0

    # Time repetition component - less impactful
    time_component = (time_repetition_ratio - 0.75) * 30.0  # Most players stick to 1-2 time controls

    # Diversity penalty - high variety decreases staleness
    diversity_component = max(0, (opening_diversity_ratio - 0.25) * 60.0)

    score = base + repetition_component + time_component - diversity_component
    return max(0.0, min(100.0, score))


def _compute_personality_scores(
    analyses: List[Dict[str, Any]],
    games: List[Dict[str, Any]],
    skill_level: str = 'intermediate'
) -> Dict[str, float]:
    """Compute personality scores using standardized scoring system with skill level awareness."""
    from .personality_scoring import PersonalityScorer, PersonalityScores

    if not analyses:
        return PersonalityScores.neutral().to_dict()

    scorer = PersonalityScorer()
    score_lists = []
    weights = []

    # Process each analysis
    for analysis in analyses:
        # Extract moves data
        moves_data = analysis.get('moves_analysis', [])
        if not moves_data:
            continue

        # Convert moves to the format expected by PersonalityScorer
        moves = []
        for move in moves_data:
            if isinstance(move, dict):
                moves.append({
                    'move_san': move.get('move_san', ''),
                    'ply_index': move.get('ply_index', 0),
                    'centipawn_loss': move.get('centipawn_loss', 0.0),
                    'is_best': move.get('is_best', False),
                    'is_blunder': move.get('is_blunder', False),
                    'is_mistake': move.get('is_mistake', False),
                    'is_inaccuracy': move.get('is_inaccuracy', False),
                    'evaluation_before': move.get('evaluation_before'),
                    'evaluation_after': move.get('evaluation_after'),
                    'heuristic_details': move.get('heuristic_details', {}),
                    'player_color': move.get('player_color', ''),
                })

        if not moves:
            continue

        # Calculate scores for this analysis with skill level awareness
        time_score = _coerce_float(analysis.get('time_management_score')) or 50.0

        # BUGFIX: Scale time_score to 0-100 if it's in 0-1 range (legacy data)
        # New data should be 0-100, but old data might be 0-1
        if 0 <= time_score <= 1.0:
            time_score = time_score * 100.0

        # If still too low (< 10), it's probably corrupt data - use neutral
        if time_score < 10.0:
            time_score = 50.0

        scores = scorer.calculate_scores(moves, time_score, skill_level)
        score_lists.append(scores)

        # Use total moves as weight
        weight = _coerce_float(analysis.get('total_moves'))
        if weight is None or weight <= 0:
            weight = float(len(moves))
        weights.append(weight)

    if not score_lists:
        return PersonalityScores.neutral().to_dict()

    # Aggregate scores
    aggregated_scores = scorer.aggregate_scores(score_lists, weights)

    # Apply game-level adjustments for novelty and staleness
    if games:
        novelty_signal = _estimate_novelty_from_games(games)
        staleness_signal = _estimate_staleness_from_games(games)

        # Calculate move-level scores
        move_novelty = aggregated_scores.novelty
        move_staleness = aggregated_scores.staleness

        # Combine move-level and game-level signals
        # Both use same 70/30 weighting for consistency
        # Natural opposition comes from inverse formulas (diversity vs repetition), not forced summing
        final_novelty = _round2(move_novelty * 0.3 + novelty_signal * 0.7)
        final_staleness = _round2(move_staleness * 0.3 + staleness_signal * 0.7)

        aggregated_scores.novelty = final_novelty
        aggregated_scores.staleness = final_staleness

    return aggregated_scores.to_dict()

def _compute_opening_win_rate(analyses: List[Dict[str, Any]]) -> float:
    """
    Calculate opening win rate based on position evaluation after move 10.
    An "opening advantage" is defined as eval > +0.5 after 20 ply (10 full moves).
    Falls back to move accuracy if position evals are unavailable.
    """
    if not analyses:
        return 0.0

    games_with_advantage = 0
    total_evaluable_games = 0

    for analysis in analyses:
        moves = analysis.get('moves_analysis') or []

        # Find move at ply 20 (or closest to it)
        move_at_20 = None
        for move in moves:
            ply = move.get('opening_ply', 0) or move.get('ply', 0)
            if ply >= 18 and ply <= 22 and move.get('is_user_move'):  # Allow range around move 10
                move_at_20 = move
                break

        if move_at_20:
            # Check if player had advantage
            eval_after = move_at_20.get('eval_after')
            if eval_after is not None:
                total_evaluable_games += 1
                # Positive eval means advantage (for white), negative for black
                # We need to know the color
                is_white = move_at_20.get('color') == 'white'
                advantage = eval_after if is_white else -eval_after

                if advantage > 0.5:  # More than half a pawn advantage
                    games_with_advantage += 1

    # If we have position evaluations, use them
    if total_evaluable_games > 0:
        return _round2((games_with_advantage / total_evaluable_games) * 100)

    # Fallback to move accuracy
    return _round2(_compute_opening_accuracy_from_moves(analyses))


def _compute_phase_accuracies(analyses: List[Dict[str, Any]]) -> Dict[str, float]:
    opening = _round2(_compute_opening_win_rate(analyses))
    middle = _round2(_safe_average([
        _coerce_float(analysis.get('middle_game_accuracy')) for analysis in analyses
    ], default=opening))
    endgame = _round2(_safe_average([
        _coerce_float(analysis.get('endgame_accuracy')) for analysis in analyses
    ], default=opening))
    return {
        'opening': opening,
        'middle': middle,
        'endgame': endgame,
    }
def _determine_player_level(current_rating: int, average_accuracy: float) -> str:
    rating = current_rating or 0
    accuracy = average_accuracy or 0.0

    # Primary classification by rating (more realistic ranges)
    if rating >= 2000:
        return 'master'
    if rating >= 1600:
        return 'expert'
    if rating >= 1200:
        return 'advanced'
    if rating >= 800:
        return 'intermediate'

    # Fallback to accuracy only if rating is very low or missing
    if accuracy >= 85.0:
        return 'intermediate'  # High accuracy but low rating = intermediate
    if accuracy >= 70.0:
        return 'intermediate'  # High accuracy but low rating = intermediate

    return 'beginner'


def _determine_player_style(personality_scores: Dict[str, float]):
    ranked = sorted(
        ((key, personality_scores.get(key, 0.0)) for key in ['aggressive', 'tactical', 'positional', 'patient']),
        key=lambda item: item[1],
        reverse=True
    )
    top_key, top_value = ranked[0]
    second_value = ranked[1][1] if len(ranked) > 1 else top_value
    diff = max(0.0, top_value - second_value)
    confidence = round(min(95.0, max(35.0, diff * 1.5)), 2)
    category, description = STYLE_CATEGORY_MAP.get(top_key, ('balanced', 'All-around style with flexible plans.'))
    summary = STYLE_SUMMARIES.get(category, STYLE_SUMMARIES['balanced'])
    return {
        'category': category,
        'description': description,
        'confidence': confidence,
    }, summary


def _summarize_strengths_and_gaps(personality_scores: Dict[str, float]) -> Tuple[List[str], List[str]]:
    strengths: List[str] = []
    improvements: List[str] = []
    for key in CORE_PERSONALITY_KEYS:
        score = personality_scores.get(key, 0.0)
        label = PERSONALITY_LABELS[key]
        if score >= 65.0:
            strengths.append(label)
        elif score <= 45.0:
            improvements.append(label)
    if personality_scores.get('staleness', 50.0) <= 40.0:
        improvements.append('Develop more structured opening repertoire')
    strengths = list(dict.fromkeys(strengths))
    improvements = list(dict.fromkeys(improvements))
    return strengths, improvements


def _build_recommendations(
    personality_scores: Dict[str, float],
    player_style: Dict[str, Any],
    strengths: List[str],
    improvements: List[str],
    phase_accuracies: Dict[str, float]
) -> Dict[str, str]:
    ranked = sorted(
        ((key, personality_scores.get(key, 0.0)) for key in CORE_PERSONALITY_KEYS),
        key=lambda item: item[1],
        reverse=True
    )
    top_key, top_value = ranked[0]
    lowest_key, lowest_value = ranked[-1]
    primary = f"Focus targeted training on {PERSONALITY_LABELS[lowest_key].lower()} (currently {lowest_value:.0f})."
    if phase_accuracies.get('endgame', 0.0) < 50.0:
        primary += ' Add dedicated endgame study sessions to stabilise long games.'
    secondary = f"Continue to cultivate {PERSONALITY_LABELS[top_key].lower()} (currently {top_value:.0f}) by reviewing your best examples."
    if personality_scores.get('staleness', 50.0) <= 40.0:
        secondary = 'Develop a more structured opening repertoire for consistent play.'
    leverage = (
        f"Lean into a {player_style['category']} approach - {player_style['description'].rstrip('.')} to steer games into favourable territory."
    )
    return {
        'primary': primary,
        'secondary': secondary,
        'leverage': leverage,
    }


def _generate_ai_style_analysis(
    personality_scores: Dict[str, float],
    player_style: Dict[str, Any],
    player_level: str,
    total_games: int,
    average_accuracy: float,
    phase_accuracies: Dict[str, float]
) -> Dict[str, str]:
    """Generate personalized, data-driven style analysis with specific insights."""

    # Get the dominant trait and its score
    ranked_traits = sorted(
        ((key, personality_scores.get(key, 0.0)) for key in ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']),
        key=lambda item: item[1],
        reverse=True
    )

    dominant_trait, dominant_score = ranked_traits[0]
    second_trait, second_score = ranked_traits[1] if len(ranked_traits) > 1 else (dominant_trait, dominant_score)
    third_trait, third_score = ranked_traits[2] if len(ranked_traits) > 2 else (second_trait, second_score)
    lowest_trait, lowest_score = ranked_traits[-1]
    second_lowest_trait, second_lowest_score = ranked_traits[-2] if len(ranked_traits) > 1 else (lowest_trait, lowest_score)

    # Generate style summary with specific score context
    style_summary = f"You are a {player_level} player with {total_games} games analyzed. "

    # Calculate score gap to second trait
    score_gap = dominant_score - second_score

    if dominant_score >= 70:
        if score_gap >= 15:
            style_summary += f"Your {dominant_trait} play ({dominant_score:.0f}) clearly dominates, standing {score_gap:.0f} points above your {second_trait} ({second_score:.0f})."
        else:
            style_summary += f"Your {dominant_trait} play ({dominant_score:.0f}) is your strongest trait, closely followed by {second_trait} ({second_score:.0f})."
    elif dominant_score >= 60:
        style_summary += f"Your {dominant_trait} play ({dominant_score:.0f}) is your leading strength, {score_gap:.0f} points ahead of {second_trait}."
    else:
        style_summary += f"You show a balanced approach with {dominant_trait} ({dominant_score:.0f}) and {second_trait} ({second_score:.0f}) as your relative strengths."

    # Generate data-driven characteristics
    characteristics_parts = []

    # Top 3 traits with relative positioning
    if dominant_score >= 55:
        characteristics_parts.append(f"{dominant_trait.capitalize()} leads your profile at {dominant_score:.0f}")

    if second_score >= 55 and abs(dominant_score - second_score) < 10:
        characteristics_parts.append(f"backed by equally strong {second_trait} ({second_score:.0f})")
    elif second_score >= 55:
        characteristics_parts.append(f"with {second_trait} as secondary strength ({second_score:.0f})")

    # Add comparison to average
    trait_mean = sum(personality_scores.values()) / len(personality_scores)
    if dominant_score - trait_mean >= 15:
        characteristics_parts.append(f"significantly above your average trait level ({trait_mean:.0f})")

    characteristics_text = ", ".join(characteristics_parts) if characteristics_parts else f"balanced across all traits (average: {trait_mean:.0f})"

    # Generate personalized strengths with phase accuracy context
    strengths_parts = []

    # Top traits as strengths with actual scores
    top_traits = [(trait, score) for trait, score in ranked_traits[:3] if score >= 55]
    trait_labels = {
        'tactical': 'calculation in complex positions',
        'positional': 'long-term strategic planning',
        'aggressive': 'creating initiative and pressure',
        'patient': 'consolidating advantages methodically',
        'novelty': 'exploring creative and unconventional ideas',
        'staleness': 'maintaining consistent, structured play'
    }

    for trait, score in top_traits:
        label = trait_labels.get(trait, f"{trait} play")
        if score >= 70:
            strengths_parts.append(f"Exceptional {label} ({score:.0f})")
        else:
            strengths_parts.append(f"{label.capitalize()} ({score:.0f})")

    # Phase-specific strengths with actual accuracy
    phase_labels = {
        'opening': 'opening preparation',
        'middle': 'middlegame execution',
        'endgame': 'endgame technique'
    }

    best_phase = max(phase_accuracies.items(), key=lambda x: x[1])
    if best_phase[1] >= 65:
        strengths_parts.append(f"{phase_labels[best_phase[0]]} ({best_phase[1]:.1f}% accuracy)")

    strengths_text = ", ".join(strengths_parts) if strengths_parts else f"developing across all areas (avg accuracy: {average_accuracy:.1f}%)"

    # Generate data-driven playing patterns
    patterns_parts = []

    # Pattern based on top 2 traits
    if dominant_score >= 60 and second_score >= 60:
        patterns_parts.append(f"Combines {dominant_trait} strength ({dominant_score:.0f}) with {second_trait} support ({second_score:.0f})")
    elif dominant_score >= 60:
        patterns_parts.append(f"Relies heavily on {dominant_trait} play ({dominant_score:.0f})")

    # Aggressive vs Patient dimension
    agg_score = personality_scores.get('aggressive', 50)
    pat_score = personality_scores.get('patient', 50)
    agg_pat_diff = abs(agg_score - pat_score)

    if agg_pat_diff >= 15:
        if agg_score > pat_score:
            patterns_parts.append(f"seeks initiative early (aggressive {agg_score:.0f} vs patient {pat_score:.0f})")
        else:
            patterns_parts.append(f"prefers solid, patient development (patient {pat_score:.0f} vs aggressive {agg_score:.0f})")

    # Accuracy context
    if average_accuracy >= 75:
        patterns_parts.append(f"maintains strong accuracy ({average_accuracy:.1f}%)")
    elif average_accuracy >= 65:
        patterns_parts.append(f"shows good accuracy with room to improve ({average_accuracy:.1f}%)")
    else:
        patterns_parts.append(f"accuracy needs focus ({average_accuracy:.1f}%)")

    patterns_text = ", ".join(patterns_parts) if patterns_parts else "developing playing identity"

    # Generate personalized improvement focus with specific gaps
    weakness_gap = dominant_score - lowest_score

    if weakness_gap >= 25:
        improvement_focus = f"Your {lowest_trait} ({lowest_score:.0f}) lags {weakness_gap:.0f} points behind your {dominant_trait} ({dominant_score:.0f}). "
    else:
        improvement_focus = f"Your lowest area is {lowest_trait} ({lowest_score:.0f}), which needs attention. "

    # Add specific, actionable guidance based on the weak trait
    improvement_tips = {
        'tactical': f"Focus on tactical puzzles and calculation drills to bridge the gap from {lowest_score:.0f} toward {second_score:.0f}",
        'positional': f"Study classic positional games and pawn structure patterns to improve from {lowest_score:.0f}",
        'aggressive': f"Practice initiative-seizing openings (King's Indian, Sicilian) to develop from {lowest_score:.0f} toward {dominant_score:.0f}",
        'patient': f"Work on endgame technique and avoiding premature complications to raise from {lowest_score:.0f}",
        'novelty': f"Expand your opening repertoire and study creative players to improve from {lowest_score:.0f}",
        'staleness': f"Explore new openings and vary your approach to reduce from {lowest_score:.0f}"
    }

    improvement_focus += improvement_tips.get(lowest_trait, f"Work on developing {lowest_trait} skills to balance your profile")

    # Add phase-specific guidance if relevant
    worst_phase = min(phase_accuracies.items(), key=lambda x: x[1])
    if worst_phase[1] < 65:
        improvement_focus += f". Also focus on your {worst_phase[0]} ({worst_phase[1]:.1f}% accuracy)"

    return {
        'style_summary': style_summary,
        'characteristics': characteristics_text,
        'strengths': strengths_text,
        'playing_patterns': patterns_text,
        'improvement_focus': improvement_focus
    }


def _generate_famous_player_comparisons(
    personality_scores: Dict[str, float],
    player_style: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate famous player comparisons based on personality scores."""

    # Famous players database with personality profiles
    # Database expanded from 26 to 39 players to improve matching accuracy
    # Includes more modern players (2010s-present) for better coverage of contemporary styles
    # NOTE: Profiles are currently estimated - Priority 1 improvement is to calculate from real games
    famous_players = [
        {
            'name': 'Mikhail Tal',
            'description': 'The "Magician from Riga" - known for his brilliant tactical combinations and sacrifices',
            'era': '1950s-1990s',
            'strengths': ['Tactical vision', 'Sacrificial attacks', 'Complex calculations'],
            'profile': {'tactical': 85, 'aggressive': 90, 'positional': 55, 'patient': 45, 'novelty': 88, 'staleness': 35},
            'confidence': 80.0
        },
        {
            'name': 'Garry Kasparov',
            'description': 'Aggressive tactical player who dominated with dynamic, attacking chess',
            'era': '1980s-2000s',
            'strengths': ['Initiative', 'Tactical precision', 'Pressure play'],
            'profile': {'tactical': 90, 'aggressive': 85, 'positional': 75, 'patient': 60, 'novelty': 75, 'staleness': 45},
            'confidence': 85.0
        },
        {
            'name': 'Anatoly Karpov',
            'description': 'Master of positional chess and endgame technique',
            'era': '1970s-1990s',
            'strengths': ['Positional understanding', 'Endgame mastery', 'Prophylaxis'],
            'profile': {'tactical': 70, 'aggressive': 50, 'positional': 95, 'patient': 90, 'novelty': 45, 'staleness': 75},
            'confidence': 85.0
        },
        {
            'name': 'Magnus Carlsen',
            'description': 'Universal player with exceptional endgame skills and practical play',
            'era': '2000s-present',
            'strengths': ['Universal style', 'Endgame mastery', 'Practical play'],
            'profile': {'tactical': 85, 'aggressive': 70, 'positional': 90, 'patient': 80, 'novelty': 72, 'staleness': 50},
            'confidence': 90.0
        },
        {
            'name': 'Bobby Fischer',
            'description': 'Legendary American champion known for his fighting spirit and deep preparation',
            'era': '1960s-1970s',
            'strengths': ['Competitive spirit', 'Sharp tactics', 'Deep preparation'],
            'profile': {'tactical': 88, 'aggressive': 80, 'positional': 85, 'patient': 65, 'novelty': 70, 'staleness': 55},
            'confidence': 85.0
        },
        {
            'name': 'Tigran Petrosian',
            'description': 'Master of prophylaxis and defensive play',
            'era': '1950s-1980s',
            'strengths': ['Defensive mastery', 'Prophylaxis', 'Safety'],
            'profile': {'tactical': 65, 'aggressive': 40, 'positional': 90, 'patient': 95, 'novelty': 55, 'staleness': 65},
            'confidence': 80.0
        },
        {
            'name': 'José Raúl Capablanca',
            'description': 'Natural talent with exceptional endgame technique',
            'era': '1910s-1940s',
            'strengths': ['Technical precision', 'Endgame mastery', 'Natural talent'],
            'profile': {'tactical': 75, 'aggressive': 60, 'positional': 88, 'patient': 85, 'novelty': 50, 'staleness': 60},
            'confidence': 75.0
        },
        {
            'name': 'Alexander Alekhine',
            'description': 'Attacking genius known for complex combinations',
            'era': '1920s-1940s',
            'strengths': ['Attacking play', 'Initiative', 'Dynamic positions'],
            'profile': {'tactical': 90, 'aggressive': 88, 'positional': 75, 'patient': 50, 'novelty': 85, 'staleness': 40},
            'confidence': 75.0
        },
        {
            'name': 'Vladimir Kramnik',
            'description': 'Solid positional player with creative understanding',
            'era': '1990s-2010s',
            'strengths': ['Positional understanding', 'Endgame technique', 'Creative play'],
            'profile': {'tactical': 78, 'aggressive': 60, 'positional': 92, 'patient': 85, 'novelty': 68, 'staleness': 52},
            'confidence': 85.0
        },
        {
            'name': 'Hikaru Nakamura',
            'description': 'Modern attacking player known for rapid chess and initiative',
            'era': '2000s-present',
            'strengths': ['Modern attacks', 'Initiative', 'Practical play'],
            'profile': {'tactical': 88, 'aggressive': 82, 'positional': 72, 'patient': 60, 'novelty': 80, 'staleness': 42},
            'confidence': 85.0
        },
        {
            'name': 'Fabiano Caruana',
            'description': 'Universal player with deep opening preparation',
            'era': '2010s-present',
            'strengths': ['Universal style', 'Opening preparation', 'Technical precision'],
            'profile': {'tactical': 85, 'aggressive': 70, 'positional': 88, 'patient': 78, 'novelty': 65, 'staleness': 58},
            'confidence': 85.0
        },
        {
            'name': 'Paul Morphy',
            'description': 'Tactical genius of the romantic era',
            'era': '1850s',
            'strengths': ['Tactical genius', 'Natural talent', 'Attacking play'],
            'profile': {'tactical': 95, 'aggressive': 92, 'positional': 65, 'patient': 40, 'novelty': 82, 'staleness': 38},
            'confidence': 70.0
        },
        {
            'name': 'Judit Polgar',
            'description': 'Strongest female player ever, known for aggressive tactical play',
            'era': '1990s-2010s',
            'strengths': ['Tactical prowess', 'Aggressive style', 'Competitive spirit'],
            'profile': {'tactical': 88, 'aggressive': 85, 'positional': 75, 'patient': 58, 'novelty': 72, 'staleness': 48},
            'confidence': 80.0
        },
        {
            'name': 'Viswanathan Anand',
            'description': 'Speed chess specialist with universal style and deep preparation',
            'era': '1990s-2010s',
            'strengths': ['Universal play', 'Speed', 'Opening preparation'],
            'profile': {'tactical': 85, 'aggressive': 75, 'positional': 88, 'patient': 75, 'novelty': 70, 'staleness': 52},
            'confidence': 85.0
        },
        {
            'name': 'Aron Nimzowitsch',
            'description': 'Hypermodern pioneer who revolutionized chess understanding',
            'era': '1920s-1930s',
            'strengths': ['Hypermodern concepts', 'Prophylaxis', 'Strategic innovation'],
            'profile': {'tactical': 72, 'aggressive': 65, 'positional': 92, 'patient': 80, 'novelty': 95, 'staleness': 30},
            'confidence': 70.0
        },
        {
            'name': 'Mikhail Botvinnik',
            'description': 'Scientific approach to chess, founder of Soviet School',
            'era': '1940s-1960s',
            'strengths': ['Deep preparation', 'Scientific method', 'Endgame technique'],
            'profile': {'tactical': 75, 'aggressive': 60, 'positional': 90, 'patient': 88, 'novelty': 55, 'staleness': 68},
            'confidence': 80.0
        },
        {
            'name': 'Vasily Smyslov',
            'description': 'Harmonious style with exceptional endgame mastery',
            'era': '1950s-1980s',
            'strengths': ['Endgame mastery', 'Harmonious play', 'Technical precision'],
            'profile': {'tactical': 78, 'aggressive': 55, 'positional': 90, 'patient': 88, 'novelty': 52, 'staleness': 62},
            'confidence': 80.0
        },
        {
            'name': 'Viktor Korchnoi',
            'description': 'Fearless fighter known for resourcefulness and never giving up',
            'era': '1960s-2000s',
            'strengths': ['Fighting spirit', 'Resourcefulness', 'Universal style'],
            'profile': {'tactical': 82, 'aggressive': 75, 'positional': 85, 'patient': 68, 'novelty': 68, 'staleness': 52},
            'confidence': 80.0
        },
        {
            'name': 'Ding Liren',
            'description': 'Solid positional player with deep calculation and modern style',
            'era': '2010s-present',
            'strengths': ['Solid play', 'Deep calculation', 'Modern openings'],
            'profile': {'tactical': 85, 'aggressive': 68, 'positional': 90, 'patient': 82, 'novelty': 70, 'staleness': 50},
            'confidence': 85.0
        },
        {
            'name': 'Alireza Firouzja',
            'description': 'Young aggressive talent with dynamic attacking style',
            'era': '2020s-present',
            'strengths': ['Dynamic play', 'Aggression', 'Modern tactics'],
            'profile': {'tactical': 88, 'aggressive': 90, 'positional': 70, 'patient': 52, 'novelty': 85, 'staleness': 35},
            'confidence': 75.0
        },
        {
            'name': 'Hou Yifan',
            'description': 'Multiple-time Women\'s World Champion with classical style',
            'era': '2010s-present',
            'strengths': ['Classical understanding', 'Solid technique', 'Endgame skill'],
            'profile': {'tactical': 78, 'aggressive': 65, 'positional': 88, 'patient': 80, 'novelty': 62, 'staleness': 55},
            'confidence': 75.0
        },
        {
            'name': 'Bent Larsen',
            'description': 'Creative player with unconventional openings and fighting spirit',
            'era': '1960s-1990s',
            'strengths': ['Creativity', 'Unconventional openings', 'Fighting chess'],
            'profile': {'tactical': 80, 'aggressive': 78, 'positional': 75, 'patient': 60, 'novelty': 88, 'staleness': 35},
            'confidence': 75.0
        },
        {
            'name': 'Akiba Rubinstein',
            'description': 'Endgame virtuoso and master of rook endgames',
            'era': '1900s-1930s',
            'strengths': ['Endgame mastery', 'Rook endgames', 'Technical precision'],
            'profile': {'tactical': 75, 'aggressive': 52, 'positional': 92, 'patient': 90, 'novelty': 48, 'staleness': 70},
            'confidence': 70.0
        },
        {
            'name': 'David Bronstein',
            'description': 'Creative genius who played beautiful, imaginative chess',
            'era': '1940s-1990s',
            'strengths': ['Creativity', 'Imagination', 'Sacrificial play'],
            'profile': {'tactical': 85, 'aggressive': 78, 'positional': 80, 'patient': 62, 'novelty': 92, 'staleness': 32},
            'confidence': 75.0
        },
        {
            'name': 'Levon Aronian',
            'description': 'Creative and imaginative with rich tactical vision',
            'era': '2000s-present',
            'strengths': ['Creativity', 'Tactical vision', 'Universal play'],
            'profile': {'tactical': 88, 'aggressive': 75, 'positional': 85, 'patient': 72, 'novelty': 82, 'staleness': 42},
            'confidence': 85.0
        },
        {
            'name': 'Emanuel Lasker',
            'description': 'Longest-reigning world champion, psychologist of chess',
            'era': '1890s-1920s',
            'strengths': ['Practical play', 'Psychology', 'Resourcefulness'],
            'profile': {'tactical': 80, 'aggressive': 70, 'positional': 85, 'patient': 80, 'novelty': 72, 'staleness': 48},
            'confidence': 70.0
        },
        {
            'name': 'Ian Nepomniachtchi',
            'description': 'Aggressive tactical player with dynamic attacking style',
            'era': '2010s-present',
            'strengths': ['Tactical aggression', 'Initiative', 'Complex positions'],
            'profile': {'tactical': 90, 'aggressive': 88, 'positional': 72, 'patient': 58, 'novelty': 75, 'staleness': 48},
            'confidence': 85.0
        },
        {
            'name': 'Maxime Vachier-Lagrave',
            'description': 'Universal player with strong tactics and solid technique',
            'era': '2010s-present',
            'strengths': ['Universal style', 'Tactical sharpness', 'Calculation'],
            'profile': {'tactical': 90, 'aggressive': 75, 'positional': 85, 'patient': 75, 'novelty': 68, 'staleness': 54},
            'confidence': 85.0
        },
        {
            'name': 'Richard Rapport',
            'description': 'Highly creative player known for unorthodox openings',
            'era': '2010s-present',
            'strengths': ['Creativity', 'Unconventional ideas', 'Surprising moves'],
            'profile': {'tactical': 82, 'aggressive': 80, 'positional': 70, 'patient': 60, 'novelty': 95, 'staleness': 25},
            'confidence': 80.0
        },
        {
            'name': 'Wesley So',
            'description': 'Solid positional player with exceptional technique',
            'era': '2010s-present',
            'strengths': ['Solid play', 'Technical precision', 'Endgame mastery'],
            'profile': {'tactical': 82, 'aggressive': 58, 'positional': 92, 'patient': 90, 'novelty': 52, 'staleness': 68},
            'confidence': 85.0
        },
        {
            'name': 'Anish Giri',
            'description': 'Solid positional player with deep opening preparation',
            'era': '2010s-present',
            'strengths': ['Positional understanding', 'Opening preparation', 'Defensive resources'],
            'profile': {'tactical': 85, 'aggressive': 55, 'positional': 92, 'patient': 88, 'novelty': 58, 'staleness': 65},
            'confidence': 85.0
        },
        {
            'name': 'Daniil Dubov',
            'description': 'Creative aggressive player with unconventional ideas',
            'era': '2015-present',
            'strengths': ['Creativity', 'Aggressive play', 'Surprising ideas'],
            'profile': {'tactical': 88, 'aggressive': 85, 'positional': 75, 'patient': 55, 'novelty': 92, 'staleness': 30},
            'confidence': 80.0
        },
        {
            'name': 'Shakhriyar Mamedyarov',
            'description': 'Dynamic player with aggressive style and tactical sharpness',
            'era': '2010s-present',
            'strengths': ['Dynamic play', 'Tactical aggression', 'Initiative'],
            'profile': {'tactical': 88, 'aggressive': 88, 'positional': 75, 'patient': 60, 'novelty': 78, 'staleness': 42},
            'confidence': 85.0
        },
        {
            'name': 'Teimour Radjabov',
            'description': 'Solid positional player with excellent defensive skills',
            'era': '2000s-present',
            'strengths': ['Defensive mastery', 'Positional play', 'Solid preparation'],
            'profile': {'tactical': 80, 'aggressive': 52, 'positional': 90, 'patient': 92, 'novelty': 55, 'staleness': 70},
            'confidence': 80.0
        },
        {
            'name': 'Alexander Grischuk',
            'description': 'Universal player with strong tactics and time pressure skills',
            'era': '2000s-present',
            'strengths': ['Universal play', 'Tactical vision', 'Time pressure'],
            'profile': {'tactical': 90, 'aggressive': 78, 'positional': 82, 'patient': 68, 'novelty': 72, 'staleness': 50},
            'confidence': 85.0
        },
        {
            'name': 'Boris Gelfand',
            'description': 'Solid positional player with deep opening knowledge',
            'era': '1990s-2010s',
            'strengths': ['Opening preparation', 'Solid play', 'Technical precision'],
            'profile': {'tactical': 82, 'aggressive': 58, 'positional': 90, 'patient': 88, 'novelty': 50, 'staleness': 72},
            'confidence': 85.0
        },
        {
            'name': 'Peter Leko',
            'description': 'Solid defensive player known for drawing ability',
            'era': '1990s-2010s',
            'strengths': ['Defensive resources', 'Solid play', 'Technical precision'],
            'profile': {'tactical': 78, 'aggressive': 48, 'positional': 92, 'patient': 95, 'novelty': 45, 'staleness': 75},
            'confidence': 80.0
        },
        {
            'name': 'Vassily Ivanchuk',
            'description': 'Creative genius with unpredictable style and brilliant ideas',
            'era': '1980s-2010s',
            'strengths': ['Creativity', 'Tactical brilliance', 'Unpredictability'],
            'profile': {'tactical': 92, 'aggressive': 80, 'positional': 82, 'patient': 60, 'novelty': 95, 'staleness': 28},
            'confidence': 85.0
        },
    ]

    # Calculate similarity scores using all 6 personality traits
    player_tactical = personality_scores.get('tactical', 50.0)
    player_aggressive = personality_scores.get('aggressive', 50.0)
    player_positional = personality_scores.get('positional', 50.0)
    player_patient = personality_scores.get('patient', 50.0)
    player_novelty = personality_scores.get('novelty', 50.0)
    player_staleness = personality_scores.get('staleness', 50.0)

    # Trait weights: distinctive traits (novelty/staleness) weighted more heavily
    # Common traits (tactical/positional) weighted less since most strong players score high
    trait_weights = {
        'tactical': 0.8,      # Common trait - most strong players score high
        'positional': 0.8,    # Common trait - most strong players score high
        'aggressive': 1.2,    # Moderately distinctive
        'patient': 1.2,       # Moderately distinctive
        'novelty': 1.5,       # Highly distinctive - rare trait
        'staleness': 1.5      # Highly distinctive - rare trait
    }

    scored_players = []
    for famous in famous_players:
        profile = famous['profile']

        # Calculate WEIGHTED Euclidean distance in 6D personality space
        # More distinctive traits have higher weights
        diff_tactical = trait_weights['tactical'] * (player_tactical - profile.get('tactical', 50.0)) ** 2
        diff_aggressive = trait_weights['aggressive'] * (player_aggressive - profile.get('aggressive', 50.0)) ** 2
        diff_positional = trait_weights['positional'] * (player_positional - profile.get('positional', 50.0)) ** 2
        diff_patient = trait_weights['patient'] * (player_patient - profile.get('patient', 50.0)) ** 2
        diff_novelty = trait_weights['novelty'] * (player_novelty - profile.get('novelty', 50.0)) ** 2
        diff_staleness = trait_weights['staleness'] * (player_staleness - profile.get('staleness', 50.0)) ** 2

        distance = (diff_tactical + diff_aggressive + diff_positional +
                   diff_patient + diff_novelty + diff_staleness) ** 0.5

        # Convert distance to similarity percentage (0-100)
        # Max weighted distance: sqrt(sum(weight * 100^2))
        # = sqrt(0.8*10000 + 0.8*10000 + 1.2*10000 + 1.2*10000 + 1.5*10000 + 1.5*10000)
        # = sqrt(70000) ≈ 264.6
        max_distance = 264.6
        overall_similarity = max(0, 100 - (distance / max_distance * 100))

        # Calculate per-trait similarity scores (inverse of percentage difference)
        trait_similarities = {
            'tactical': max(0, 100 - abs(player_tactical - profile.get('tactical', 50.0))),
            'positional': max(0, 100 - abs(player_positional - profile.get('positional', 50.0))),
            'aggressive': max(0, 100 - abs(player_aggressive - profile.get('aggressive', 50.0))),
            'patient': max(0, 100 - abs(player_patient - profile.get('patient', 50.0))),
            'novelty': max(0, 100 - abs(player_novelty - profile.get('novelty', 50.0))),
            'staleness': max(0, 100 - abs(player_staleness - profile.get('staleness', 50.0)))
        }

        # Calculate confidence based on profile completeness and match quality
        profile_confidence = famous.get('confidence', 75.0)  # Default 75% if not specified
        # Higher similarity = higher match confidence
        match_quality = overall_similarity / 100.0
        match_confidence = round(profile_confidence * match_quality, 1)

        scored_players.append({
            'name': famous['name'],
            'description': famous['description'],
            'era': famous['era'],
            'strengths': famous['strengths'],
            'similarity_score': round(overall_similarity, 1),
            'trait_similarities': {k: round(v, 1) for k, v in trait_similarities.items()},
            'match_confidence': match_confidence
        })

    # Sort by similarity
    scored_players.sort(key=lambda x: x['similarity_score'], reverse=True)

    # Get top 3 matches
    primary = scored_players[0] if len(scored_players) > 0 else None
    secondary = scored_players[1] if len(scored_players) > 1 else None
    tertiary = scored_players[2] if len(scored_players) > 2 else None

    # Famous player opening and tactical recommendations
    FAMOUS_PLAYER_RECOMMENDATIONS = {
        'Mikhail Tal': {
            'openings': ['King\'s Indian Attack', 'Sicilian Dragon', 'King\'s Indian Defense'],
            'tactics': ['Sacrificial combinations', 'Complex tactical sequences', 'Initiative-driven attacks'],
            'training': 'Study tactical puzzles with sacrificial themes, focus on calculating complex variations'
        },
        'Garry Kasparov': {
            'openings': ['Sicilian Najdorf', 'King\'s Indian Defense', 'Queen\'s Gambit Declined'],
            'tactics': ['Dynamic pawn breaks', 'Initiative and pressure', 'Prophylactic thinking'],
            'training': 'Combine deep opening preparation with tactical pattern recognition'
        },
        'Anatoly Karpov': {
            'openings': ['English Opening', 'Caro-Kann Defense', 'Nimzo-Indian Defense'],
            'tactics': ['Prophylaxis', 'Positional squeezes', 'Endgame technique'],
            'training': 'Master strategic planning and endgame theory, study pawn structures'
        },
        'Magnus Carlsen': {
            'openings': ['Catalan Opening', 'Berlin Defense', 'English Opening'],
            'tactics': ['Universal play', 'Endgame precision', 'Practical squeeze tactics'],
            'training': 'Develop universal skills - strong in all phases. Focus on converting small advantages'
        },
        'Bobby Fischer': {
            'openings': ['Ruy Lopez', 'King\'s Indian Defense', 'Najdorf Sicilian'],
            'tactics': ['Sharp tactical play', 'Fighting chess', 'Deep preparation'],
            'training': 'Combine aggressive play with solid preparation. Study classic combinations'
        },
        'Tigran Petrosian': {
            'openings': ['French Defense', 'Caro-Kann Defense', 'Queen\'s Indian Defense'],
            'tactics': ['Prophylactic moves', 'Defensive resources', 'Safety-first approach'],
            'training': 'Master the art of prevention - anticipate opponent threats before they materialize'
        },
        'José Raúl Capablanca': {
            'openings': ['Queen\'s Gambit', 'Ruy Lopez', 'Queen\'s Pawn Game'],
            'tactics': ['Simple, clear positions', 'Endgame mastery', 'Technical precision'],
            'training': 'Focus on endgames and technical positions. Study Capablanca\'s games for clarity'
        },
        'Alexander Alekhine': {
            'openings': ['Alekhine Defense', 'French Defense (aggressive lines)', 'King\'s Indian Attack'],
            'tactics': ['Complex combinations', 'Dynamic piece play', 'Initiative'],
            'training': 'Practice calculating long variations. Study attacking patterns against solid positions'
        },
        'Vladimir Kramnik': {
            'openings': ['Berlin Defense', 'Catalan Opening', 'Queen\'s Gambit'],
            'tactics': ['Solid positional play', 'Endgame technique', 'Creative middlegame ideas'],
            'training': 'Balance solid opening choices with creative middlegame play'
        },
        'Hikaru Nakamura': {
            'openings': ['Accelerated Dragon', 'Grünfeld Defense', 'Modern Benoni'],
            'tactics': ['Modern aggressive play', 'Quick tactical strikes', 'Initiative'],
            'training': 'Develop rapid calculation and practical play. Study blitz tactics'
        },
        'Fabiano Caruana': {
            'openings': ['Petroff Defense', 'Queen\'s Gambit', 'Ruy Lopez'],
            'tactics': ['Deep preparation', 'Universal style', 'Technical precision'],
            'training': 'Emphasize opening preparation and memorization. Study model games'
        },
        'Paul Morphy': {
            'openings': ['Italian Game', 'Evans Gambit', 'King\'s Gambit'],
            'tactics': ['Open game tactics', 'Piece activity', 'Natural development'],
            'training': 'Study romantic era tactics. Focus on rapid development and open positions'
        },
        'Judit Polgar': {
            'openings': ['King\'s Indian Defense', 'Sicilian Najdorf', 'Accelerated Dragon'],
            'tactics': ['Aggressive tactical play', 'Fighting spirit', 'Sharp positions'],
            'training': 'Don\'t fear sharp positions. Study tactics and fighting chess'
        },
        'Viswanathan Anand': {
            'openings': ['Najdorf Sicilian', 'Semi-Slav', 'Spanish Opening'],
            'tactics': ['Speed and accuracy', 'Universal style', 'Opening novelties'],
            'training': 'Build a broad repertoire. Practice fast, accurate calculation'
        },
        'Aron Nimzowitsch': {
            'openings': ['Nimzo-Indian Defense', 'French Defense', 'English Opening'],
            'tactics': ['Hypermodern ideas', 'Prophylaxis', 'Strategic innovation'],
            'training': 'Study positional concepts: overprotection, blockade, restraint'
        },
        'Mikhail Botvinnik': {
            'openings': ['English Opening', 'Semi-Slav', 'Caro-Kann Defense'],
            'tactics': ['Scientific preparation', 'Deep analysis', 'Endgame technique'],
            'training': 'Approach chess scientifically. Deep preparation and self-analysis'
        },
        'Vasily Smyslov': {
            'openings': ['Ruy Lopez', 'Queen\'s Gambit', 'English Opening'],
            'tactics': ['Harmonious play', 'Endgame mastery', 'Natural flow'],
            'training': 'Focus on harmony and coordination. Master rook endgames'
        },
        'Viktor Korchnoi': {
            'openings': ['French Defense', 'English Opening', 'Pirc Defense'],
            'tactics': ['Resourcefulness', 'Fighting spirit', 'Never give up'],
            'training': 'Develop resilience. Study complex defensive resources'
        },
        'Ding Liren': {
            'openings': ['Italian Game', 'Queen\'s Gambit', 'Grünfeld Defense'],
            'tactics': ['Solid play', 'Modern preparation', 'Deep calculation'],
            'training': 'Balance modern opening theory with solid fundamentals'
        },
        'Ian Nepomniachtchi': {
            'openings': ['Sicilian Najdorf', 'King\'s Indian Defense', 'Grünfeld Defense'],
            'tactics': ['Tactical aggression', 'Initiative and pressure', 'Dynamic attacks'],
            'training': 'Study sharp tactical positions. Focus on maintaining initiative'
        },
        'Maxime Vachier-Lagrave': {
            'openings': ['Najdorf Sicilian', 'Grünfeld Defense', 'King\'s Indian Defense'],
            'tactics': ['Universal play', 'Sharp calculations', 'Tactical precision'],
            'training': 'Build a broad repertoire with tactical sharpness. Practice calculation'
        },
        'Richard Rapport': {
            'openings': ['Rapport-Jobava System', 'London System', 'King\'s Indian Attack'],
            'tactics': ['Unconventional ideas', 'Creative sacrifices', 'Surprising moves'],
            'training': 'Don\'t be afraid to be different. Study creative games and unusual openings'
        },
        'Wesley So': {
            'openings': ['Petroff Defense', 'Berlin Defense', 'Queen\'s Gambit'],
            'tactics': ['Solid technique', 'Endgame precision', 'Defensive resources'],
            'training': 'Master solid openings and endgame technique. Focus on consistency'
        },
        'Anish Giri': {
            'openings': ['Najdorf Sicilian', 'Berlin Defense', 'Queen\'s Indian Defense'],
            'tactics': ['Deep preparation', 'Solid positional play', 'Defensive mastery'],
            'training': 'Study opening theory deeply. Focus on solid defensive technique'
        },
        'Daniil Dubov': {
            'openings': ['Catalan Opening', 'English Opening', 'Unconventional lines'],
            'tactics': ['Creative ideas', 'Aggressive play', 'Surprising tactics'],
            'training': 'Think outside the box. Study creative sacrifices and unusual ideas'
        },
        'Shakhriyar Mamedyarov': {
            'openings': ['King\'s Indian Defense', 'Sicilian Najdorf', 'Grünfeld Defense'],
            'tactics': ['Dynamic play', 'Tactical aggression', 'Initiative'],
            'training': 'Study dynamic positions. Practice aggressive tactical play'
        },
        'Teimour Radjabov': {
            'openings': ['Grünfeld Defense', 'Nimzo-Indian Defense', 'Caro-Kann Defense'],
            'tactics': ['Solid play', 'Defensive resources', 'Positional understanding'],
            'training': 'Master defensive technique and solid positional play'
        },
        'Alexander Grischuk': {
            'openings': ['Ruy Lopez', 'Grünfeld Defense', 'King\'s Indian Defense'],
            'tactics': ['Universal style', 'Quick calculations', 'Time pressure skills'],
            'training': 'Build strong universal skills. Practice calculating quickly'
        },
        'Boris Gelfand': {
            'openings': ['Najdorf Sicilian', 'Semi-Slav', 'Queen\'s Indian Defense'],
            'tactics': ['Deep preparation', 'Solid technique', 'Opening novelties'],
            'training': 'Study opening theory deeply. Focus on preparation and solid technique'
        },
        'Peter Leko': {
            'openings': ['Berlin Defense', 'Petroff Defense', 'Queen\'s Gambit'],
            'tactics': ['Defensive resources', 'Solid play', 'Technical precision'],
            'training': 'Master defensive technique. Study how to hold difficult positions'
        },
        'Vassily Ivanchuk': {
            'openings': ['King\'s Indian Defense', 'French Defense', 'Unconventional openings'],
            'tactics': ['Creative brilliance', 'Tactical fireworks', 'Unpredictable play'],
            'training': 'Study creative and brilliant tactical combinations. Think unconventionally'
        }
    }
    # Generate detailed similarity insights
    def generate_similarity_insights(player_name: str, player_profile: Dict[str, Any],
                                     trait_sims: Dict[str, float]) -> List[str]:
        """Generate specific, detailed insights about why this player matches and how to excel like them."""
        insights = []

        # Find strongest matching traits (>85% similarity)
        strong_matches = [(trait, sim) for trait, sim in trait_sims.items() if sim >= 85]
        strong_matches.sort(key=lambda x: x[1], reverse=True)

        # 1. PRIMARY SIMILARITY - Detailed trait match explanation
        if strong_matches:
            top_match_trait, top_match_sim = strong_matches[0]
            trait_label = PERSONALITY_LABELS.get(top_match_trait, top_match_trait)
            player_score = personality_scores.get(top_match_trait, 50.0)
            famous_score = player_profile.get(top_match_trait, 50.0)
            insights.append(
                f"Like {player_name}, you excel in {trait_label.lower()} ({top_match_sim:.0f}% match) - "
                f"Your score of {player_score:.0f} closely mirrors {player_name}'s {famous_score:.0f}"
            )

        # 2. OPENING RECOMMENDATIONS - Based on famous player's repertoire
        recommendations = FAMOUS_PLAYER_RECOMMENDATIONS.get(player_name, {})
        if recommendations and recommendations.get('openings'):
            openings = recommendations['openings']
            insights.append(
                f"To emulate {player_name}'s style, study: {', '.join(openings[:2])}. "
                f"These openings match your personality profile"
            )

        # 3. TACTICAL FOCUS - Specific tactics to practice
        if recommendations and recommendations.get('tactics'):
            tactics = recommendations['tactics']
            insights.append(
                f"Focus on {player_name}'s signature tactics: {', '.join(tactics[:2]).lower()}"
            )

        # 4. TRAINING RECOMMENDATION - How to improve like the famous player
        if recommendations and recommendations.get('training'):
            insights.append(f"Training tip: {recommendations['training']}")

        # 5. AREA FOR IMPROVEMENT - Notable differences
        differences = [(trait, sim) for trait, sim in trait_sims.items() if sim < 70]
        differences.sort(key=lambda x: x[1])

        if differences and len(insights) < 6:
            weakest_trait, weakest_sim = differences[0]
            trait_label = PERSONALITY_LABELS.get(weakest_trait, weakest_trait)
            player_score = personality_scores.get(weakest_trait, 50.0)
            famous_score = player_profile.get(weakest_trait, 50.0)

            if player_score < famous_score:
                gap = famous_score - player_score
                insights.append(
                    f"To fully match {player_name}, develop your {trait_label.lower()} "
                    f"(you: {player_score:.0f}, {player_name}: {famous_score:.0f}, gap: {gap:.0f} points)"
                )

        # 6. SECONDARY STRENGTHS - Additional matching traits
        if len(strong_matches) > 1:
            second_trait, second_sim = strong_matches[1]
            second_label = PERSONALITY_LABELS.get(second_trait, second_trait)
            insights.append(
                f"You also share {player_name}'s {second_label.lower()} ({second_sim:.0f}% match)"
            )

        return insights

    def format_player_match(player_data: Dict[str, Any]) -> Dict[str, Any]:
        """Format a player match with all details."""
        insights = generate_similarity_insights(
            player_data['name'],
            famous_players[[p['name'] for p in famous_players].index(player_data['name'])]['profile'],
            player_data['trait_similarities']
        )

        # Legacy similarity text for backward compatibility
        top_trait = max(personality_scores.items(), key=lambda x: x[1])[0]
        trait_label = PERSONALITY_LABELS.get(top_trait, 'balanced play')
        legacy_similarity = f"Like {player_data['name']}, you excel in {trait_label.lower()}"

        return {
            'name': player_data['name'],
            'description': player_data['description'],
            'era': player_data['era'],
            'strengths': player_data['strengths'],
            'similarity': legacy_similarity,
            'similarity_score': player_data['similarity_score'],
            'match_confidence': player_data['match_confidence'],
            'trait_similarities': player_data['trait_similarities'],
            'insights': insights
        }

    result = {}
    if primary:
        result['primary'] = format_player_match(primary)
    if secondary:
        result['secondary'] = format_player_match(secondary)
    if tertiary:
        result['tertiary'] = format_player_match(tertiary)

    return result


# Opening compatibility matrix
OPENING_STYLES = {
    # Aggressive openings
    "King's Indian": {"aggressive": 80, "tactical": 70, "positional": 40, "patient": 30},
    "Sicilian Defense": {"aggressive": 75, "tactical": 80, "positional": 50, "patient": 40},
    "Dutch Defense": {"aggressive": 85, "tactical": 65, "positional": 35, "patient": 30},
    "Benoni Defense": {"aggressive": 80, "tactical": 75, "positional": 40, "patient": 35},
    "Dragon Variation": {"aggressive": 90, "tactical": 85, "positional": 30, "patient": 25},

    # Tactical openings
    "Scotch Game": {"aggressive": 65, "tactical": 80, "positional": 50, "patient": 45},
    "Italian Game": {"aggressive": 60, "tactical": 75, "positional": 55, "patient": 50},
    "Spanish Opening": {"aggressive": 50, "tactical": 70, "positional": 70, "patient": 60},

    # Positional openings
    "Queen's Gambit": {"aggressive": 40, "tactical": 55, "positional": 85, "patient": 70},
    "English Opening": {"aggressive": 35, "tactical": 50, "positional": 85, "patient": 75},
    "Ruy Lopez": {"aggressive": 45, "tactical": 65, "positional": 80, "patient": 70},
    "Catalan Opening": {"aggressive": 35, "tactical": 55, "positional": 90, "patient": 75},

    # Patient openings
    "French Defense": {"aggressive": 35, "tactical": 50, "positional": 75, "patient": 85},
    "Caro-Kann Defense": {"aggressive": 30, "tactical": 45, "positional": 80, "patient": 90},
    "Queen's Pawn Game": {"aggressive": 40, "tactical": 50, "positional": 70, "patient": 75},
    "Nimzo-Indian Defense": {"aggressive": 40, "tactical": 60, "positional": 80, "patient": 80},
    "London System": {"aggressive": 30, "tactical": 40, "positional": 75, "patient": 85},
}


def _extract_opening_mistakes(analyses: List[Dict[str, Any]], games: List[Dict[str, Any]]) -> List[OpeningMistake]:
    """Extract specific mistakes from the opening phase with game context."""
    mistakes = []

    # Build a map of game_id to game for context
    # IMPORTANT: Store games under BOTH 'id' and 'provider_game_id' keys for reliable matching
    # This ensures analyses can match whether they store game_id as internal UUID or provider_game_id
    game_map = {}
    for game in games:
        # Add entry for internal UUID 'id'
        game_id = game.get('id')
        if game_id:
            game_map[game_id] = game

        # Add entry for 'provider_game_id' (e.g., chess.com URL game ID, lichess game ID)
        provider_id = game.get('provider_game_id')
        if provider_id:
            game_map[provider_id] = game

    if DEBUG:
        print(f"[Mistake Extraction] Processing {len(analyses)} analyses with {len(games)} games")
        print(f"[Mistake Extraction] Built game_map with {len(game_map)} total entries")

    for analysis in analyses:
        moves = analysis.get('moves_analysis') or []
        game_id = analysis.get('game_id', '')

        if not game_id:
            if DEBUG:
                print(f"[Mistake Extraction] Analysis has no game_id, skipping")
            continue

        # Get game context for opening name
        game = game_map.get(game_id, {})
        if not game:
            if DEBUG:
                print(f"[Mistake Extraction] No game found for game_id={game_id}, skipping")
            continue

        # Prefer normalized name, then original opening, then ECO code as fallback
        opening_name = game.get('opening_normalized') or game.get('opening') or game.get('opening_family')

        # For display, convert ECO codes to readable names
        display_name = game.get('opening_normalized') or game.get('opening')
        if not display_name:
            # If we only have an ECO code, convert it to a readable name
            eco_code = game.get('opening_family')
            if eco_code:
                display_name = get_opening_name_from_eco_code(eco_code)
            else:
                display_name = 'Unknown Opening'

        # Skip only if we have absolutely no opening information
        if not opening_name or opening_name in ['Unknown', 'Unknown Opening', '']:
            if DEBUG:
                print(f"[Mistake Extraction] No opening info for game_id={game_id}, skipping")
            continue

        # Filter opening moves (first 20 ply) - check both 'ply' and 'opening_ply'
        opening_moves = [m for m in moves if (m.get('ply', 0) <= 20 or m.get('opening_ply', 0) <= 20) and m.get('is_user_move', False)]

        if not opening_moves:
            if DEBUG:
                print(f"[Mistake Extraction] No user opening moves found for game_id={game_id}")
            continue

        if DEBUG:
            print(f"[Mistake Extraction] Game {game_id}: Found {len(opening_moves)} user opening moves in {display_name}")

        for move in opening_moves:
            cpl = move.get('centipawn_loss', 0)
            ply = move.get('ply', 0) or move.get('opening_ply', 0)
            move_num = (ply + 1) // 2  # Convert ply to move number

            # Use move_san (Standard Algebraic Notation) if available, otherwise fall back to UCI
            notation = move.get('move_san', '') or move.get('move_notation', '') or move.get('move', '')
            # Also prefer best_move_san over UCI notation
            best_move = move.get('best_move_san', '') or move.get('best_move', '') or move.get('engine_move', '')

            # Store FEN BEFORE the move for future use
            fen = move.get('fen_before', '') or move.get('fen_after', '')

            # Only include significant mistakes (CPL >= 50)
            if cpl >= 200:  # Blunder
                severity = 'critical'
                classification = 'blunder'
                explanation = f"Critical blunder in {display_name}. This move loses significant material or position. The engine suggests {best_move} instead."
            elif cpl >= 100:  # Mistake
                severity = 'major'
                classification = 'mistake'
                explanation = f"Major mistake in {display_name}. This move gives your opponent a clear advantage. Consider {best_move} to maintain balance."
            elif cpl >= 50:  # Inaccuracy
                severity = 'minor'
                classification = 'inaccuracy'
                explanation = f"Inaccuracy in {display_name}. While not terrible, {best_move} would be more accurate here."
            else:
                continue

            # Add opening context to the mistake description (use display_name for better readability)
            mistake_desc = f"{display_name} - Move {move_num}"

            mistakes.append(OpeningMistake(
                move=move_num,
                move_notation=notation,
                mistake=mistake_desc,
                correct_move=best_move,
                explanation=explanation,
                severity=severity,
                centipawn_loss=float(cpl),
                classification=classification,
                fen=fen,
                game_id=game_id  # Include game_id for linking to specific games
            ))
            if DEBUG:
                print(f"[Mistake Extraction] Added {classification}: {mistake_desc} ({notation}), CPL={cpl}, game_id={game_id}")

    # Return top 10 most severe mistakes
    mistakes.sort(key=lambda x: x.centipawn_loss, reverse=True)
    if DEBUG:
        print(f"[Mistake Extraction] Found {len(mistakes)} total mistakes, returning top 10")
    return mistakes[:10]


def _calculate_opening_compatibility(opening_name: str, personality_scores: Dict[str, float]) -> float:
    """Calculate how well an opening matches the player's style."""
    # Check if we have compatibility data for this opening
    opening_profile = None

    # Try exact match first
    if opening_name in OPENING_STYLES:
        opening_profile = OPENING_STYLES[opening_name]
    else:
        # Try partial match (e.g., "Sicilian Defense: Najdorf" -> "Sicilian Defense")
        for known_opening, profile in OPENING_STYLES.items():
            if known_opening.lower() in opening_name.lower():
                opening_profile = profile
                break

    # If no match, return neutral compatibility
    if not opening_profile:
        return 50.0

    # Calculate compatibility score based on personality match
    total_score = 0.0
    for trait in ['aggressive', 'tactical', 'positional', 'patient']:
        player_score = personality_scores.get(trait, 50.0)
        opening_score = opening_profile.get(trait, 50.0)

        # Calculate how well they match (inverse of difference)
        difference = abs(player_score - opening_score)
        match_score = 100 - difference
        total_score += match_score

    # Average across all traits
    return total_score / 4.0


def _generate_style_recommendations(
    personality_scores: Dict[str, float],
    games: List[Dict[str, Any]]
) -> List[StyleRecommendation]:
    """Generate opening recommendations based on player style."""
    recommendations = []

    # Find player's dominant trait
    dominant_trait = max(personality_scores.items(), key=lambda x: x[1])
    trait_name, trait_score = dominant_trait

    # Only make recommendations if trait is strong (>60)
    if trait_score < 60:
        return recommendations

    # Count player's current openings
    opening_counts = Counter()
    for game in games:
        # IMPORTANT: Prioritize actual opening name over ECO code to avoid "Uncommon Opening" for A00
        opening = game.get('opening_normalized') or game.get('opening') or game.get('opening_family')
        if opening and opening != 'Unknown':
            opening_counts[opening] += 1

    # Find compatible openings player hasn't explored much
    for opening_name, opening_profile in OPENING_STYLES.items():
        compatibility = _calculate_opening_compatibility(opening_name, personality_scores)
        current_games = opening_counts.get(opening_name, 0)

        # Recommend if highly compatible (>70) and underplayed (<10% of games)
        total_games = len(games)
        play_rate = (current_games / total_games * 100) if total_games > 0 else 0

        if compatibility > 70 and play_rate < 10:
            # Generate reasoning based on dominant trait
            if trait_name == 'aggressive':
                reasoning = f"This sharp opening suits your aggressive style ({trait_score:.0f}/100). It leads to dynamic positions with attacking chances."
            elif trait_name == 'tactical':
                reasoning = f"This opening creates tactical complications that match your tactical strength ({trait_score:.0f}/100). Rich in combinations."
            elif trait_name == 'positional':
                reasoning = f"This positional opening aligns with your strategic approach ({trait_score:.0f}/100). Emphasizes long-term planning."
            elif trait_name == 'patient':
                reasoning = f"This solid opening fits your patient style ({trait_score:.0f}/100). Focuses on gradual improvement and solid structure."
            else:
                reasoning = f"This opening matches your playing style well (compatibility: {compatibility:.0f}%)."

            priority = 'high' if compatibility > 80 else 'medium' if compatibility > 70 else 'low'

            recommendations.append(StyleRecommendation(
                opening_name=opening_name,
                compatibility_score=compatibility,
                reasoning=reasoning,
                suggested_lines=[],  # Could be expanded with specific variations
                priority=priority
            ))

    # Sort by compatibility and return top 5
    recommendations.sort(key=lambda x: x.compatibility_score, reverse=True)
    return recommendations[:5]


def _generate_actionable_insights(
    personality_scores: Dict[str, float],
    games: List[Dict[str, Any]],
    analyses: List[Dict[str, Any]]
) -> List[str]:
    """Generate specific, actionable insights based on style and performance."""
    insights = []

    # Analyze opening performance by style match
    # Build a map of game_id to analysis for proper matching
    analysis_map = {}
    for analysis in analyses:
        game_id = analysis.get('game_id')
        if game_id:
            analysis_map[game_id] = analysis

    opening_performance = {}
    for game in games:
        opening = game.get('opening_normalized') or game.get('opening')
        if not opening or opening == 'Unknown':
            continue

        result = game.get('result')
        if result not in ['win', 'loss', 'draw']:
            continue

        if opening not in opening_performance:
            opening_performance[opening] = {'wins': 0, 'total': 0, 'compatibility': 0}

        opening_performance[opening]['total'] += 1
        if result == 'win':
            opening_performance[opening]['wins'] += 1
        opening_performance[opening]['compatibility'] = _calculate_opening_compatibility(opening, personality_scores)

    # Find style mismatches
    for opening, stats in opening_performance.items():
        if stats['total'] < 3:  # Need minimum sample size
            continue

        win_rate = (stats['wins'] / stats['total'] * 100) if stats['total'] > 0 else 0
        compatibility = stats['compatibility']

        # Style mismatch with poor performance
        if compatibility < 40 and win_rate < 45:
            insights.append(
                f"Your {opening} (win rate: {win_rate:.0f}%) doesn't match your playing style. "
                f"Consider switching to openings that better suit your strengths."
            )

        # High compatibility but underperforming
        elif compatibility > 70 and win_rate < 40:
            insights.append(
                f"Your {opening} should suit your style, but you're underperforming ({win_rate:.0f}% win rate). "
                f"Consider studying this opening more deeply to unlock its potential."
            )

    # Trait-specific insights (more lenient thresholds)
    aggressive = personality_scores.get('aggressive', 50)
    tactical = personality_scores.get('tactical', 50)
    positional = personality_scores.get('positional', 50)
    patient = personality_scores.get('patient', 50)

    # Find dominant trait
    traits = {'aggressive': aggressive, 'tactical': tactical, 'positional': positional, 'patient': patient}
    dominant_trait = max(traits.items(), key=lambda x: x[1])
    trait_name, trait_score = dominant_trait

    # Aggressive player with quiet openings (lowered threshold to 65)
    if aggressive > 65 and positional < 45:
        quiet_openings = sum(1 for g in games if any(q in (g.get('opening_normalized') or '').lower()
                                                       for q in ['london', 'caro-kann', 'french']))
        if quiet_openings > len(games) * 0.25:  # Lowered from 30% to 25%
            insights.append(
                f"Your aggressive style ({aggressive:.0f}/100) conflicts with your quiet opening choices. "
                f"Study pawn structure and prophylaxis in closed positions, or try more dynamic openings like the Sicilian Defense."
            )

    # Positional player with sharp openings (lowered threshold to 65)
    if positional > 65 and tactical < 45:
        sharp_openings = sum(1 for g in games if any(s in (g.get('opening_normalized') or '').lower()
                                                      for s in ['sicilian', 'king\'s indian', 'dutch']))
        if sharp_openings > len(games) * 0.25:  # Lowered from 30% to 25%
            insights.append(
                f"Your positional style ({positional:.0f}/100) may struggle in sharp tactical lines. "
                f"Practice tactical puzzles focusing on opening traps and combinations."
            )

    # Patient player trying too many different openings (lowered threshold to 65)
    if patient > 65:
        unique_openings = len(set(g.get('opening_normalized') or g.get('opening')
                                  for g in games if g.get('opening_normalized') or g.get('opening')))
        if unique_openings > 12:  # Lowered from 15 to 12
            insights.append(
                f"Your patient style ({patient:.0f}/100) benefits from deep preparation. "
                f"Consider narrowing your repertoire to master fewer openings thoroughly."
            )

    # General insights based on dominant trait (always provide at least one)
    if len(insights) == 0 and trait_score > 55:
        if trait_name == 'aggressive':
            insights.append(f"As an aggressive player ({trait_score:.0f}/100), focus on sharp openings that create immediate tension and attacking chances.")
        elif trait_name == 'tactical':
            insights.append(f"Your tactical strength ({trait_score:.0f}/100) suits complex openings. Consider studying opening traps and tactical patterns.")
        elif trait_name == 'positional':
            insights.append(f"Your positional understanding ({trait_score:.0f}/100) is strong. Focus on strategic openings that emphasize long-term planning.")
        elif trait_name == 'patient':
            insights.append(f"Your patient approach ({trait_score:.0f}/100) suits solid openings. Build a consistent repertoire and master key positions.")

    # Add general insight about opening repertoire if we have enough data
    if len(games) > 50 and len(insights) < 3:
        unique_openings = len(set(g.get('opening_normalized') or g.get('opening')
                                  for g in games if g.get('opening_normalized') or g.get('opening')))
        if unique_openings < 5:
            insights.append("Your repertoire is quite narrow. Consider expanding to 5-8 core openings for more flexibility against different opponents.")
        elif unique_openings > 20:
            insights.append("You play many different openings. Focusing on fewer openings will help you develop deeper understanding and preparation.")

    # Limit to top 5 most relevant insights
    return insights[:5]


def _should_count_opening_for_color(opening: str, player_color: str) -> bool:
    """
    Check if an opening should be counted for a specific player color.
    This prevents counting opponent's openings (e.g., skip Caro-Kann when player is white).
    """
    opening_lower = opening.lower()

    # Black openings (defenses) - only count when player is black
    black_openings = [
        'sicilian', 'french', 'caro-kann', 'pirc', 'modern defense',
        'scandinavian', 'alekhine', 'nimzowitsch defense', 'petrov', 'philidor',
        "king's indian", 'grunfeld', 'grünfeld', 'nimzo-indian',
        "queen's gambit declined", "queen's gambit accepted", 'slav', 'semi-slav',
        "queen's indian", 'benoni', 'benko', 'dutch', 'budapest', 'tarrasch defense'
    ]

    # White openings (systems/attacks) - only count when player is white
    white_openings = [
        'italian', 'ruy lopez', 'spanish', 'scotch', 'four knights', 'vienna',
        "king's gambit", "bishop's opening", 'center game',
        "queen's gambit", 'london', 'colle', 'torre', 'trompowsky',
        'blackmar-diemer', 'english', 'reti', 'réti', "bird's", "larsen's"
    ]

    # Check if it's a black opening
    for black_op in black_openings:
        if black_op in opening_lower:
            return player_color == 'black'

    # Check if it's a white opening
    for white_op in white_openings:
        if white_op in opening_lower:
            return player_color == 'white'

    # Heuristics
    if 'defense' in opening_lower or 'defence' in opening_lower:
        return player_color == 'black'

    if 'attack' in opening_lower or 'system' in opening_lower or 'gambit' in opening_lower:
        return player_color == 'white'

    # Neutral or unknown - count for both
    return True


def _analyze_repertoire(games: List[Dict[str, Any]], personality_scores: Dict[str, float]) -> RepertoireAnalysis:
    """Analyze the player's opening repertoire."""
    white_openings = Counter()
    black_openings = Counter()
    opening_results = {}

    for game in games:
        opening = game.get('opening_normalized') or game.get('opening')
        if not opening or opening == 'Unknown':
            continue

        color = game.get('color')
        result = game.get('result')

        # IMPORTANT: Only count openings that the player actually plays
        if not _should_count_opening_for_color(opening, color):
            continue

        if color == 'white':
            white_openings[opening] += 1
        elif color == 'black':
            black_openings[opening] += 1

        if opening not in opening_results:
            opening_results[opening] = {'wins': 0, 'total': 0}
        opening_results[opening]['total'] += 1
        if result == 'win':
            opening_results[opening]['wins'] += 1

    # Calculate diversity score
    total_white = sum(white_openings.values())
    total_black = sum(black_openings.values())
    unique_white = len(white_openings)
    unique_black = len(black_openings)

    # Diversity score: balance between too few (narrow) and too many (unfocused)
    ideal_repertoire_size = 5  # Ideal is around 5 openings per color
    white_diversity = min(100, (unique_white / ideal_repertoire_size) * 100) if total_white > 0 else 0
    black_diversity = min(100, (unique_black / ideal_repertoire_size) * 100) if total_black > 0 else 0
    diversity_score = (white_diversity + black_diversity) / 2

    # Find most successful and weakest openings
    most_successful = {'opening': 'None', 'win_rate': 0, 'games': 0}
    needs_work = {'opening': 'None', 'win_rate': 100, 'games': 0}

    for opening, stats in opening_results.items():
        if stats['total'] < 3:  # Minimum sample size
            continue
        win_rate = (stats['wins'] / stats['total'] * 100)

        if win_rate > most_successful['win_rate']:
            most_successful = {'opening': opening, 'win_rate': win_rate, 'games': stats['total']}
        if win_rate < needs_work['win_rate']:
            needs_work = {'opening': opening, 'win_rate': win_rate, 'games': stats['total']}

    # Calculate style match score
    style_matches = []
    for opening in list(white_openings.keys()) + list(black_openings.keys()):
        compatibility = _calculate_opening_compatibility(opening, personality_scores)
        style_matches.append(compatibility)

    style_match_score = sum(style_matches) / len(style_matches) if style_matches else 50.0

    return RepertoireAnalysis(
        diversity_score=_round2(diversity_score),
        white_openings=list(white_openings.keys())[:5],
        black_openings=list(black_openings.keys())[:5],
        most_successful=most_successful,
        needs_work=needs_work,
        style_match_score=_round2(style_match_score)
    )
def _generate_improvement_trend(games: List[Dict[str, Any]], analyses: List[Dict[str, Any]]) -> List[TrendPoint]:
    """Generate opening performance trend over time."""
    from datetime import datetime, timedelta
    from collections import defaultdict

    # Build a map of game_id to analysis for proper matching
    analysis_map = {}
    for analysis in analyses:
        game_id = analysis.get('game_id')
        if game_id:
            analysis_map[game_id] = analysis

    # Group games by week
    weekly_data = defaultdict(lambda: {'wins': 0, 'total': 0, 'opening_accuracies': []})

    for game in games:
        played_at = game.get('played_at')
        if not played_at:
            continue

        try:
            date = datetime.fromisoformat(played_at.replace('Z', '+00:00'))
            # Get Monday of the week
            week_start = date - timedelta(days=date.weekday())
            week_key = week_start.strftime('%Y-%m-%d')

            result = game.get('result')
            if result == 'win':
                weekly_data[week_key]['wins'] += 1
            weekly_data[week_key]['total'] += 1

            # Get opening accuracy for this game if analysis exists
            # Try both id and provider_game_id for matching
            analysis = None
            if game.get('id') and game.get('id') in analysis_map:
                analysis = analysis_map[game.get('id')]
            elif game.get('provider_game_id') and game.get('provider_game_id') in analysis_map:
                analysis = analysis_map[game.get('provider_game_id')]

            if analysis:
                moves = analysis.get('moves_analysis') or []
                opening_moves = [m for m in moves if m.get('opening_ply', 0) <= 20 and m.get('is_user_move', False)]
                if opening_moves:
                    game_opening_acc = _calculate_opening_accuracy_chesscom(opening_moves)
                    weekly_data[week_key]['opening_accuracies'].append(game_opening_acc)
        except Exception as e:
            print(f"Error processing game for trend: {e}")
            continue

    # Convert to trend points
    trend_points = []
    for week, data in sorted(weekly_data.items()):
        win_rate = (data['wins'] / data['total'] * 100) if data['total'] > 0 else 0
        avg_accuracy = sum(data['opening_accuracies']) / len(data['opening_accuracies']) if data['opening_accuracies'] else 0

        trend_points.append(TrendPoint(
            date=week,
            opening_win_rate=_round2(win_rate),
            games=data['total'],
            accuracy=_round2(avg_accuracy)
        ))

    # Return last 12 weeks
    return trend_points[-12:]


def _detect_mistake_patterns(mistakes: List[OpeningMistake], games: List[Dict[str, Any]]) -> List[str]:
    """Detect patterns in opening mistakes."""
    patterns = []

    if not mistakes:
        return patterns

    # Count blunders, mistakes, inaccuracies
    blunders = [m for m in mistakes if m.classification == 'blunder']
    major_mistakes = [m for m in mistakes if m.classification == 'mistake']

    # Pattern 1: Frequent blunders in specific openings
    opening_blunders = {}
    for mistake in blunders:
        opening = mistake.mistake.split(' - ')[0] if ' - ' in mistake.mistake else 'Unknown'
        opening_blunders[opening] = opening_blunders.get(opening, 0) + 1

    if opening_blunders:
        most_common_opening = max(opening_blunders.items(), key=lambda x: x[1])
        if most_common_opening[1] >= 2:
            patterns.append(f"You have {most_common_opening[1]} critical blunders in {most_common_opening[0]}. Focus on studying this opening's tactics.")

    # Pattern 2: Early vs late opening mistakes
    early_mistakes = [m for m in mistakes if m.move <= 5]
    late_mistakes = [m for m in mistakes if m.move > 5]

    if len(early_mistakes) > len(mistakes) * 0.6:
        patterns.append("Most mistakes occur in the first 5 moves. Review opening theory and common traps.")
    elif len(late_mistakes) > len(mistakes) * 0.6:
        patterns.append("Mistakes increase after move 6. Focus on middlegame transition and piece coordination.")

    # Pattern 3: High average centipawn loss
    avg_cpl = sum(m.centipawn_loss for m in mistakes) / len(mistakes) if mistakes else 0
    if avg_cpl > 150:
        patterns.append("High average mistake severity. Consider slowing down and calculating key variations.")

    # Pattern 4: Specific tactical themes
    hanging_pieces = sum(1 for m in mistakes if any(word in m.explanation.lower() for word in ['material', 'piece', 'hung']))
    if hanging_pieces >= 2:
        patterns.append("You often leave pieces undefended. Practice tactical awareness and piece safety.")

    return patterns[:3]  # Return top 3 patterns


def _generate_quick_tip(mistakes: List[OpeningMistake], patterns: List[str]) -> str:
    """Generate a quick tip based on mistakes and patterns."""
    if not mistakes:
        return "Keep up the solid opening play!"

    # Find most common opening with mistakes
    opening_counts = {}
    for mistake in mistakes[:5]:  # Look at top 5 mistakes
        opening = mistake.mistake.split(' - ')[0] if ' - ' in mistake.mistake else 'Unknown'
        if opening != 'Unknown':
            opening_counts[opening] = opening_counts.get(opening, 0) + 1

    if opening_counts:
        most_common = max(opening_counts.items(), key=lambda x: x[1])
        if most_common[1] >= 2:
            return f"Practice tactics in {most_common[0]} - use Lichess puzzles or opening trainers."

    # Fallback to general tips
    blunders = [m for m in mistakes if m.classification == 'blunder']
    if len(blunders) >= 3:
        return "Focus on basic tactical patterns: pins, forks, and hanging pieces. Slow down before moving."

    return "Review your analyzed games and study the engine's suggestions for alternative moves."


def _generate_enhanced_opening_analysis(
    games: List[Dict[str, Any]],
    analyses: List[Dict[str, Any]],
    personality_scores: Dict[str, float]
) -> EnhancedOpeningAnalysis:
    """Generate comprehensive enhanced opening analysis."""
    opening_win_rate = _compute_opening_win_rate(analyses)
    specific_mistakes = _extract_opening_mistakes(analyses, games)

    # Add pattern detection and quick tip as actionable insights
    patterns = _detect_mistake_patterns(specific_mistakes, games)
    quick_tip = _generate_quick_tip(specific_mistakes, patterns)

    style_recommendations = _generate_style_recommendations(personality_scores, games)
    base_insights = _generate_actionable_insights(personality_scores, games, analyses)

    # Combine patterns, quick tip, and style insights
    actionable_insights = []
    if quick_tip:
        actionable_insights.append(f"💡 Quick Tip: {quick_tip}")
    actionable_insights.extend(patterns)
    actionable_insights.extend(base_insights)

    improvement_trend = _generate_improvement_trend(games, analyses)
    repertoire_analysis = _analyze_repertoire(games, personality_scores)

    return EnhancedOpeningAnalysis(
        opening_win_rate=opening_win_rate,
        specific_mistakes=specific_mistakes,
        style_recommendations=style_recommendations,
        actionable_insights=actionable_insights[:5],  # Top 5 total insights
        improvement_trend=improvement_trend,
        repertoire_analysis=repertoire_analysis
    )


def _build_deep_analysis_response(
    canonical_user_id: str,
    games: List[Dict[str, Any]],
    analyses: List[Dict[str, Any]],
    profile: Dict[str, Any]
) -> DeepAnalysisData:
    total_games = len({analysis.get('game_id') for analysis in analyses if analysis.get('game_id')}) or len(games)
    accuracy_values = [_coerce_float(analysis.get('best_move_percentage', analysis.get('accuracy'))) for analysis in analyses]
    average_accuracy = _round2(_safe_average([v for v in accuracy_values if v is not None]))
    current_rating = _infer_current_rating(games, profile)

    player_level = _determine_player_level(current_rating, average_accuracy)
    personality_scores = _compute_personality_scores(analyses, games, player_level)
    phase_accuracies = _compute_phase_accuracies(analyses)
    player_style, playing_style = _determine_player_style(personality_scores)
    strengths, improvements = _summarize_strengths_and_gaps(personality_scores)
    recommendations = _build_recommendations(personality_scores, player_style, strengths, improvements, phase_accuracies)
    famous_players = _generate_famous_player_comparisons(personality_scores, player_style)
    ai_style_analysis = _generate_ai_style_analysis(personality_scores, player_style, player_level, total_games, average_accuracy, phase_accuracies)

    # Generate enhanced opening analysis
    enhanced_opening_analysis = None
    if analyses and games:
        try:
            if DEBUG:
                print(f"Generating enhanced opening analysis for {len(games)} games, {len(analyses)} analyses")
            enhanced_opening_analysis = _generate_enhanced_opening_analysis(games, analyses, personality_scores)
            if DEBUG:
                print(f"Enhanced opening analysis generated successfully")
            if DEBUG and enhanced_opening_analysis:
                print(f"  - Win rate: {enhanced_opening_analysis.opening_win_rate}%")
                print(f"  - Mistakes: {len(enhanced_opening_analysis.specific_mistakes)}")
                print(f"  - Recommendations: {len(enhanced_opening_analysis.style_recommendations)}")
                print(f"  - Insights: {len(enhanced_opening_analysis.actionable_insights)}")
                print(f"  - Trend points: {len(enhanced_opening_analysis.improvement_trend)}")
        except Exception as e:
            import traceback
            if DEBUG:
                print(f"Error generating enhanced opening analysis: {e}")
                print(traceback.format_exc())
            # Continue without enhanced analysis if it fails

    return DeepAnalysisData(
        total_games=total_games,
        average_accuracy=average_accuracy,
        current_rating=current_rating,
        personality_scores=personality_scores,
        player_level=player_level,
        player_style=player_style,
        primary_strengths=strengths,
        improvement_areas=improvements,
        playing_style=playing_style,
        phase_accuracies=phase_accuracies,
        recommendations=recommendations,
        famous_players=famous_players,
        ai_style_analysis=ai_style_analysis,
        enhanced_opening_analysis=enhanced_opening_analysis
    )


def _build_fallback_deep_analysis(
    canonical_user_id: str,
    games: List[Dict[str, Any]],
    profile: Dict[str, Any]
) -> DeepAnalysisData:
    total_games = len(games)
    average_accuracy = _round2(_safe_average([
        _coerce_float(game.get('accuracy')) for game in games if _coerce_float(game.get('accuracy')) is not None
    ]))
    current_rating = _infer_current_rating(games, profile)
    default_scores = {key: 50.0 for key in PERSONALITY_LABELS.keys()}

    player_style = {
        'category': 'balanced',
        'description': 'Insufficient analysed games to derive a dominant style.',
        'confidence': 0.0
    }

    famous_players = _generate_famous_player_comparisons(default_scores, player_style)

    return DeepAnalysisData(
        total_games=total_games,
        average_accuracy=average_accuracy,
        current_rating=current_rating,
        personality_scores=default_scores,
        player_level=_determine_player_level(current_rating, average_accuracy),
        player_style=player_style,
        primary_strengths=[],
        improvement_areas=['Run Stockfish analysis to unlock deep insights'],
        playing_style='Data insufficient - run detailed analysis to populate deep insights.',
        phase_accuracies={
            'opening': 0.0,
            'middle': 0.0,
            'endgame': 0.0
        },
        recommendations={
            'primary': 'Run Stockfish analysis on recent games to unlock deep recommendations.',
            'secondary': 'Import more games to build a richer dataset.',
            'leverage': 'Once analysis is complete we will suggest strengths to lean into.'
        },
        famous_players=famous_players,
        ai_style_analysis=None,
        personality_insights=None
    )
async def _fetch_chesscom_games(
    user_id: str,
    limit: int,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    oldest_game_month: Optional[tuple] = None
) -> List[Dict[str, Any]]:
    """Fetch games from Chess.com API and parse them properly

    Args:
        user_id: Chess.com username
        limit: Maximum number of games to fetch
        from_date: Optional ISO date string for filtering games after this date
        to_date: Optional ISO date string for filtering games before this date
        oldest_game_month: Optional tuple of (year, month) to continue from previous batch
    """
    print(f"[chess.com] Fetching games for user: {user_id}, limit: {limit}")
    print(f"[chess.com] Date range: from_date={from_date}, to_date={to_date}, oldest_game_month={oldest_game_month}")

    try:
        from datetime import datetime, timedelta

        games = []
        # Use shared HTTP client with connection pooling
        session = await get_http_client()
        # Chess.com API requires User-Agent header per their API guidelines
        headers = {
            'User-Agent': 'ChessAnalytics/1.0 (Contact: your-email@example.com)'
        }
        try:
            # Parse date range if provided
            from_year, from_month = None, None
            to_year, to_month = None, None

            if from_date:
                try:
                    dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
                    from_year, from_month = dt.year, dt.month
                except Exception as e:
                    print(f"Error parsing from_date: {e}")

            if to_date:
                try:
                    dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
                    to_year, to_month = dt.year, dt.month
                except Exception as e:
                    print(f"Error parsing to_date: {e}")

            # Determine starting point for pagination
            if oldest_game_month:
                # Continue from PREVIOUS month (current month was already processed)
                current_year, current_month = oldest_game_month
                print(f"[chess.com] Pagination: Continuing from {current_year}/{current_month:02d}, moving to previous month")
                # Move to previous month
                if current_month == 1:
                    current_month = 12
                    current_year -= 1
                else:
                    current_month -= 1
                print(f"[chess.com] Will start fetching from {current_year}/{current_month:02d}")
            elif to_year and to_month:
                current_year, current_month = to_year, to_month
            else:
                # Start from current month by default
                end_date = datetime.now()
                current_year = end_date.year
                current_month = end_date.month

            # Determine end point
            if from_year and from_month:
                start_year, start_month = from_year, from_month
            else:
                # Default to 2 years ago - most players don't need more than that
                start_date = datetime.now() - timedelta(days=365 * 2)
                start_year = start_date.year
                start_month = start_date.month
                print(f"[chess.com] No date range specified, will fetch games back to {start_year}/{start_month:02d}")

            # Fetch in REVERSE chronological order (newest first)
            print(f"[chess.com] Starting fetch loop from {current_year}/{current_month:02d} to {start_year}/{start_month:02d}")
            month_count = 0
            consecutive_failures = 0
            max_consecutive_failures = 6  # Stop after 6 months with no games

            while (current_year > start_year or (current_year == start_year and current_month >= start_month)) and len(games) < limit:
                # Check if we should stop due to consecutive failures
                if consecutive_failures >= max_consecutive_failures:
                    print(f"[chess.com] Stopping: {consecutive_failures} consecutive months with no games")
                    break

                month_count += 1
                url = f"https://api.chess.com/pub/player/{user_id}/games/{current_year}/{current_month:02d}"
                print(f"[chess.com] Fetching month {month_count}: {current_year}/{current_month:02d} from {url}")

                try:
                    async with session.get(url, headers=headers) as response:
                        print(f"[chess.com] Response status: {response.status}")
                        if response.status == 200:
                            data = await response.json()
                            month_games = data.get('games', [])
                            print(f"[chess.com] Month {current_year}/{current_month:02d}: Found {len(month_games)} games")

                            if len(month_games) > 0:
                                consecutive_failures = 0  # Reset counter on success
                            else:
                                consecutive_failures += 1  # Empty month counts as failure

                            # Reverse to get newest games in month first
                            month_games.reverse()

                            # Parse each game to extract proper ratings
                            parsed_count = 0
                            for game in month_games:
                                parsed_game = _parse_chesscom_game(game, user_id)
                                if parsed_game:
                                    games.append(parsed_game)
                                    parsed_count += 1
                                    if len(games) >= limit:
                                        break

                            print(f"[chess.com] Parsed {parsed_count} games, total so far: {len(games)}")
                        elif response.status == 404:
                            print(f"[chess.com] Month {current_year}/{current_month:02d}: No games found (404)")
                            consecutive_failures += 1
                        elif response.status == 410:
                            # 410 Gone - old archives no longer available, should stop
                            print(f"[chess.com] Month {current_year}/{current_month:02d}: Archive no longer available (410)")
                            consecutive_failures += 1
                        else:
                            print(f"[chess.com] Month {current_year}/{current_month:02d}: Unexpected status {response.status}")
                            consecutive_failures += 1
                except Exception as month_error:
                    print(f"[chess.com] Error fetching month {current_year}/{current_month:02d}: {month_error}")
                    consecutive_failures += 1

                # Move to previous month
                if current_month == 1:
                    current_month = 12
                    current_year -= 1
                else:
                    current_month -= 1

            print(f"[chess.com] Fetch complete. Total games fetched: {len(games)}, months checked: {month_count}")
            return games[:limit]

        except Exception as inner_e:
            print(f"[chess.com] ERROR in fetch loop: {inner_e}")
            import traceback
            traceback.print_exc()
            return []

    except Exception as e:
        print(f"[chess.com] ERROR in _fetch_chesscom_games: {e}")
        import traceback
        traceback.print_exc()
        return []


async def _fetch_lichess_games(user_id: str, limit: int, until_timestamp: Optional[int] = None, since_timestamp: Optional[int] = None) -> List[Dict[str, Any]]:
    """Fetch games from Lichess API

    Args:
        user_id: Lichess username
        limit: Maximum number of games to fetch
        until_timestamp: Unix timestamp in milliseconds - fetch games until (before) this time
        since_timestamp: Unix timestamp in milliseconds - fetch games since (after) this time
    """
    print(f"[lichess] Fetching games for user: {user_id}, limit: {limit}, until: {until_timestamp}, since: {since_timestamp}")
    try:
        import aiohttp
        import json

        async with aiohttp.ClientSession() as session:
            url = f"https://lichess.org/api/games/user/{user_id}"
            params = {
                'max': limit,
                'pgnInJson': 'true',  # This makes Lichess return NDJSON format
                'clocks': 'true',
                'evals': 'false',
                'opening': 'true'
            }

            # Add until parameter if provided (fetch games BEFORE this time)
            if until_timestamp:
                params['until'] = until_timestamp

            # Add since parameter if provided (fetch games AFTER this time)
            if since_timestamp:
                params['since'] = since_timestamp

            print(f"[lichess] Request URL: {url}")
            print(f"[lichess] Request params: {params}")

            async with session.get(url, params=params, headers={'Accept': 'application/x-ndjson'}) as response:
                if response.status != 200:
                    print(f"[lichess] API error: {response.status}")
                    response_text = await response.text()
                    print(f"[lichess] Error response: {response_text[:500]}")
                    return []

                print(f"[lichess] Response status: {response.status}")
                print(f"[lichess] Response content-type: {response.headers.get('content-type')}")

                games = []
                # Lichess returns NDJSON (newline-delimited JSON)
                # Each line is a complete JSON object for one game
                text = await response.text()

                if not text.strip():
                    print(f"[lichess] WARNING: Empty response from Lichess API")
                    return []

                # Check if response starts with PGN or JSON
                first_line = text.split('\n')[0].strip() if text else ""
                print(f"[lichess] First line of response (first 100 chars): {first_line[:100]}")

                # Split by newlines and parse each line as JSON
                lines = text.strip().split('\n')
                print(f"[lichess] Total lines in response: {len(lines)}")

                for line_num, line in enumerate(lines, 1):
                    line = line.strip()
                    if not line:
                        continue

                    # Skip if this looks like PGN format (starts with '[')
                    if line.startswith('['):
                        if line_num <= 3:  # Only log first few
                            print(f"[lichess] WARNING: Line {line_num} looks like PGN, not JSON: {line[:50]}")
                        continue

                    try:
                        game_data = json.loads(line)
                        games.append(game_data)

                        # Log first game for debugging
                        if line_num == 1:
                            game_id = game_data.get('id', 'unknown')
                            has_pgn = 'pgn' in game_data
                            print(f"[lichess] First game parsed successfully: id={game_id}, has_pgn={has_pgn}")

                    except json.JSONDecodeError as e:
                        if line_num <= 5:  # Only log first few errors
                            print(f"[lichess] JSON parse error on line {line_num}: {e}")
                            print(f"[lichess] Problematic line (first 100 chars): {line[:100]}")
                        continue
                    except Exception as e:
                        if line_num <= 5:
                            print(f"[lichess] Unexpected error on line {line_num}: {e}")
                        continue

                print(f"[lichess] Successfully fetched and parsed {len(games)} games")

                if len(games) == 0 and len(lines) > 0:
                    print(f"[lichess] ERROR: Fetched {len(lines)} lines but parsed 0 games!")
                    print(f"[lichess] This suggests the response format is not NDJSON as expected")

                return games

    except Exception as e:
        print(f"[lichess] ERROR in _fetch_lichess_games: {e}")
        import traceback
        traceback.print_exc()
        return []


async def _fetch_chesscom_stats(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch user stats from Chess.com API"""
    try:
        import aiohttp
        headers = {
            'User-Agent': 'ChessAnalytics/1.0 (Contact: your-email@example.com)'
        }
        async with aiohttp.ClientSession(headers=headers) as session:
            url = f"https://api.chess.com/pub/player/{user_id}/stats"
            async with session.get(url) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    print(f"Chess.com stats API error: {response.status}")
                    return None
    except Exception as e:
        print(f"Error fetching Chess.com stats: {e}")
        return None


async def _fetch_games_from_platform(
    user_id: str,
    platform: str,
    limit: int,
    until_timestamp: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    oldest_game_month: Optional[tuple] = None,
    since_timestamp: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Fetch games from the specified platform (lichess or chess.com)
    Returns a list of game dictionaries with standardized fields

    Args:
        user_id: Username on the platform
        platform: 'chess.com' or 'lichess'
        limit: Maximum number of games to fetch
        until_timestamp: For lichess - fetch games until (before) this timestamp
        from_date: ISO date string for filtering games after this date
        to_date: ISO date string for filtering games before this date
        oldest_game_month: For chess.com pagination - tuple of (year, month)
        since_timestamp: For lichess - fetch games since (after) this timestamp
    """
    print(f"[_fetch_games_from_platform] Called for {user_id} on {platform}, limit: {limit}")
    if platform == 'chess.com':
        # Fetch chess.com games (already parsed by _fetch_chesscom_games)
        print(f"[_fetch_games_from_platform] Calling _fetch_chesscom_games...")
        games = await _fetch_chesscom_games(user_id, limit, from_date, to_date, oldest_game_month)
        print(f"[_fetch_games_from_platform] _fetch_chesscom_games returned {len(games) if games else 0} games")
        return games

    elif platform == 'lichess':
        # Fetch lichess games
        # Convert timestamps to int if they're strings
        until_ts = None
        since_ts = None

        if until_timestamp:
            try:
                until_ts = int(until_timestamp) if isinstance(until_timestamp, str) else until_timestamp
            except (ValueError, TypeError):
                print(f"[lichess] Invalid until_timestamp: {until_timestamp}")

        if since_timestamp:
            try:
                since_ts = int(since_timestamp) if isinstance(since_timestamp, str) else since_timestamp
            except (ValueError, TypeError):
                print(f"[lichess] Invalid since_timestamp: {since_timestamp}")

        raw_games = await _fetch_lichess_games(user_id, limit, until_ts, since_ts)
        # Parse into standardized format
        parsed_games = []
        for game in raw_games:
            try:
                # Lichess API returns JSON with PGN embedded
                pgn = game.get('pgn', '')
                game_id = game.get('id', '')

                # Determine player color
                players = game.get('players', {})
                white_user = players.get('white', {}).get('user', {}).get('name', '').lower()
                black_user = players.get('black', {}).get('user', {}).get('name', '').lower()
                user_lower = user_id.lower()

                if white_user == user_lower:
                    color = 'white'
                    my_rating = players.get('white', {}).get('rating')
                    opponent_rating = players.get('black', {}).get('rating')
                    opponent_name = players.get('black', {}).get('user', {}).get('name', 'Unknown')
                elif black_user == user_lower:
                    color = 'black'
                    my_rating = players.get('black', {}).get('rating')
                    opponent_rating = players.get('white', {}).get('rating')
                    opponent_name = players.get('white', {}).get('user', {}).get('name', 'Unknown')
                else:
                    print(f"[lichess] Could not determine player color for game {game_id}")
                    continue

                # Parse result
                status = game.get('status', '')
                winner = game.get('winner')
                if winner == color:
                    result = 'win'
                elif winner and winner != color:
                    result = 'loss'
                else:
                    result = 'draw'

                # Parse time control
                clock = game.get('clock', {})
                if clock:
                    initial = clock.get('initial', 0) // 60  # Convert seconds to minutes
                    increment = clock.get('increment', 0)
                    time_control = f"{initial}+{increment}"
                else:
                    time_control = game.get('speed', 'unknown')

                # Parse opening
                opening = game.get('opening', {})
                opening_name = opening.get('name', 'Unknown Opening')

                # Parse played_at
                played_at = game.get('createdAt')
                if played_at:
                    from datetime import datetime
                    played_at = datetime.fromtimestamp(played_at / 1000).isoformat()

                parsed_game = {
                    'id': game_id,
                    'pgn': pgn,
                    'result': result,
                    'color': color,
                    'time_control': time_control,
                    'opening': opening_name,
                    'opening_family': opening_name,  # Lichess doesn't separate these
                    'opponent_rating': opponent_rating,
                    'my_rating': my_rating,
                    'played_at': played_at,
                    'opponent_name': opponent_name
                }
                parsed_games.append(parsed_game)

            except Exception as e:
                print(f"[lichess] Error parsing game: {e}")
                continue

        return parsed_games

    else:
        print(f"Unknown platform: {platform}")
        return []


async def _fetch_single_lichess_game(game_id: str) -> Optional[str]:
    """Fetch a single game PGN from Lichess by game ID"""
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            url = f"https://lichess.org/game/export/{game_id}"
            params = {'pgnInJson': 'false'}

            async with session.get(url, params=params) as response:
                if response.status == 200:
                    pgn_text = await response.text()
                    return pgn_text
                else:
                    print(f"Lichess API error fetching game {game_id}: {response.status}")
                    return None
    except Exception as e:
        print(f"Error fetching Lichess game {game_id}: {e}")
        return None
async def _fetch_single_chesscom_game(user_id: str, game_id: str) -> Optional[str]:
    """Fetch a single game PGN from Chess.com by searching recent games"""
    try:
        import aiohttp
        from datetime import datetime, timedelta

        # Chess.com doesn't have a single-game endpoint, so we need to search recent archives
        # The game_id is typically a URL like "https://www.chess.com/game/live/123456"
        # We'll extract just the number and search through recent months

        # Chess.com API requires User-Agent header
        headers = {
            'User-Agent': 'ChessAnalytics/1.0 (Contact: your-email@example.com)'
        }
        async with aiohttp.ClientSession(headers=headers) as session:
            # Search last 3 months of games
            end_date = datetime.now()

            for months_ago in range(3):
                search_date = end_date - timedelta(days=30 * months_ago)
                year = search_date.year
                month = search_date.month

                url = f"https://api.chess.com/pub/player/{user_id}/games/{year}/{month:02d}"

                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        games = data.get('games', [])

                        # Search for the game by ID
                        for game in games:
                            game_url = game.get('url', '')
                            # Check if this is the game we're looking for
                            if game_id in game_url or game_url.endswith(f"/{game_id}"):
                                pgn = game.get('pgn', '')
                                if pgn:
                                    return pgn

            # If not found in recent months, return None
            print(f"Chess.com game {game_id} not found in recent archives for user {user_id}")
            return None

    except Exception as e:
        print(f"Error fetching Chess.com game {game_id}: {e}")
        return None


def _count_moves_in_pgn(pgn: str) -> int:
    """Count the number of moves in a PGN string"""
    try:
        if not pgn:
            return 0

        # Find the moves section (after all headers)
        lines = pgn.split('\n')
        moves_text = ''
        in_moves = False

        for line in lines:
            if line.strip() and not line.startswith('['):
                in_moves = True
            if in_moves:
                moves_text += ' ' + line

        # Remove comments and variations
        import re
        moves_text = re.sub(r'\{[^}]*\}', '', moves_text)  # Remove comments
        moves_text = re.sub(r'\([^)]*\)', '', moves_text)  # Remove variations

        # Count move numbers (e.g., "1.", "2.", etc.)
        move_numbers = re.findall(r'\d+\.', moves_text)

        # The number of moves is approximately the last move number
        # We need to check if there's a move after the last move number
        if move_numbers:
            last_move_num = int(move_numbers[-1].replace('.', ''))
            # Check if there are any moves after the last move number
            after_last = moves_text.split(move_numbers[-1], 1)[-1]
            tokens = after_last.split()
            # Filter out result markers
            actual_moves = [t for t in tokens if t not in ['1-0', '0-1', '1/2-1/2', '*']]

            # If there are 2 moves after last number, it's complete
            # If there's 1 move, black didn't move
            if len(actual_moves) >= 2:
                return last_move_num * 2
            elif len(actual_moves) == 1:
                return last_move_num * 2 - 1
            else:
                return (last_move_num - 1) * 2

        return 0
    except Exception as e:
        print(f"Error counting moves in PGN: {e}")
        return 0


def _extract_opponent_name_from_pgn(pgn: str, user_color: str) -> str:
    """Extract opponent's name from PGN headers"""
    try:
        if not pgn:
            return 'Unknown'

        lines = pgn.split('\n')
        white_name = None
        black_name = None

        for line in lines:
            if line.startswith('[White '):
                try:
                    white_name = line.split('"')[1]
                except:
                    pass
            elif line.startswith('[Black '):
                try:
                    black_name = line.split('"')[1]
                except:
                    pass

        # Return opponent's name based on user's color
        if user_color == 'white' and black_name:
            return black_name
        elif user_color == 'black' and white_name:
            return white_name

        return 'Unknown'
    except Exception as e:
        print(f"Error extracting opponent name from PGN: {e}")
        return 'Unknown'


def _parse_chesscom_game(game_data: Dict[str, Any], user_id: str) -> Optional[Dict[str, Any]]:
    """Parse a single chess.com game to extract ratings and metadata"""
    try:
        # Extract basic game info
        game_id = game_data.get('url', '').split('/')[-1] if game_data.get('url') else None
        if not game_id:
            return None

        # Try to get date from end_time field first (Unix timestamp)
        end_time = game_data.get('end_time')
        played_at_from_api = None
        if end_time:
            try:
                played_at_from_api = datetime.fromtimestamp(end_time, tz=timezone.utc).isoformat()
            except:
                pass

        pgn = game_data.get('pgn', '')
        time_control = game_data.get('time_control', '')
        time_class = game_data.get('time_class', '')

        # FIRST: Try to extract TimeControl from PGN header (most accurate)
        pgn_time_control = None
        if pgn:
            lines = pgn.split('\n')
            for line in lines:
                if line.startswith('[TimeControl '):
                    try:
                        pgn_time_control = line.split('"')[1]
                        if pgn_time_control and pgn_time_control != '-':
                            time_control = pgn_time_control
                            break
                    except:
                        pass

        # FALLBACK: If no PGN time control, use time_control or time_class from API
        if not pgn_time_control:
            if time_class:
                time_control = time_class
            elif time_control:
                # Convert time control to readable format
                try:
                    base_time, increment = time_control.split('+')
                    total_time = int(base_time) + int(increment) * 40  # Estimate
                    if total_time <= 180:  # 3 minutes
                        time_control = 'bullet'
                    elif total_time <= 600:  # 10 minutes
                        time_control = 'blitz'
                    elif total_time <= 1800:  # 30 minutes
                        time_control = 'rapid'
                    else:
                        time_control = 'classical'
                except:
                    time_control = 'unknown'

        # Extract player info
        white_player = game_data.get('white', {})
        black_player = game_data.get('black', {})

        white_username = white_player.get('username', '').lower()
        black_username = black_player.get('username', '').lower()
        user_id_lower = user_id.lower()

        # Determine which side the user played
        if white_username == user_id_lower:
            color = 'white'
            my_rating = white_player.get('rating')
            opponent_rating = black_player.get('rating')
            opponent_name = black_player.get('username', '')
            result = white_player.get('result')
        elif black_username == user_id_lower:
            color = 'black'
            my_rating = black_player.get('rating')
            opponent_rating = white_player.get('rating')
            opponent_name = white_player.get('username', '')
            result = black_player.get('result')
        else:
            # User not found in this game
            return None

        # Convert result to standard format (win/loss/draw)
        if os.getenv("DEBUG", "false").lower() == "true":
            print(f"[DEBUG] Chess.com result for {user_id}: '{result}' (type: {type(result)})")
        if result == 'win':
            result = 'win'
        elif result == 'lose':
            result = 'loss'
        elif result == 'agreed':
            result = 'draw'
        elif result == 'timeout':
            result = 'loss'  # Timeout is typically a loss
        elif result == 'resign' or result == 'resigned':
            result = 'loss'  # Resignation is a loss
        elif result == 'checkmated':
            result = 'loss'  # Checkmate is a loss
        elif result == 'stalemate':
            result = 'draw'  # Stalemate is a draw
        elif result == 'insufficient' or result == 'timevsinsufficient':
            result = 'draw'  # Insufficient material is a draw
        elif result == 'repetition':
            result = 'draw'  # Threefold repetition is a draw
        elif result == 'abandoned':
            result = 'draw'  # Abandoned games are typically draws
        else:
            print(f"[WARNING] Unknown chess.com result: '{result}', defaulting to draw")
            result = 'draw'

        # Extract opening info from PGN headers
        opening = 'Unknown'
        opening_family = 'Unknown'
        if pgn:
            lines = pgn.split('\n')
            for line in lines:
                if line.startswith('[Opening '):
                    opening = line.split('"')[1] if '"' in line else 'Unknown'
                elif line.startswith('[ECO '):
                    opening_family = line.split('"')[1] if '"' in line else 'Unknown'

        # If ECO code is A00 but no opening name, identify from moves
        # A00 is a catch-all for many different irregular openings
        if opening_family == 'A00' and (opening == 'Unknown' or opening == 'Uncommon Opening'):
            from opening_utils import identify_a00_opening_from_moves
            identified_opening = identify_a00_opening_from_moves(pgn)
            if identified_opening != 'Uncommon Opening':
                opening = identified_opening

        # Extract played_at from PGN headers (fallback if API didn't provide end_time)
        played_at = played_at_from_api  # Start with API timestamp if available

        if not played_at and pgn:
            lines = pgn.split('\n')
            date_str = None
            time_str = None

            # Find UTCDate and UTCTime in PGN headers
            for line in lines:
                if line.startswith('[UTCDate '):
                    try:
                        date_str = line.split('"')[1]
                    except:
                        pass
                elif line.startswith('[UTCTime '):
                    try:
                        time_str = line.split('"')[1]
                    except:
                        pass

            # Combine date and time if both found
            if date_str and time_str:
                try:
                    played_at = f"{date_str}T{time_str}Z"
                except:
                    pass

        return {
            'id': game_id,
            'pgn': pgn,
            'result': result,
            'color': color,
            'time_control': time_control,
            'opening': opening,
            'opening_family': opening_family,
            'opponent_rating': opponent_rating,
            'my_rating': my_rating,
            'played_at': played_at,
            'opponent_name': opponent_name
        }

    except Exception as e:
        print(f"Error parsing chess.com game: {e}")
        return None

# ============================================================================
# PROXY ENDPOINTS (for external APIs)
# ============================================================================
@app.post("/api/v1/import-games-smart", response_model=BulkGameImportResponse)
async def import_games_smart(request: Dict[str, Any], _auth: Optional[bool] = get_optional_auth()):
    """Smart import endpoint - imports only the most recent 100 games"""
    try:
        user_id = request.get('user_id')
        platform = request.get('platform')

        if not user_id or not platform:
            raise HTTPException(status_code=400, detail="user_id and platform are required")

        user_key = f"import:{user_id}:{platform}:smart"
        _enforce_rate_limit(user_key, IMPORT_RATE_LIMIT)

        canonical_user_id = _canonical_user_id(user_id, platform)
        db_client = supabase_service or supabase
        if not db_client:
            raise HTTPException(status_code=503, detail="Database not configured for smart import")

        print(f"Smart import for {user_id}: starting...")

        # Get all existing game IDs to avoid duplicates
        # Supabase has a 1000 row default limit, we need to paginate to get ALL games
        existing_game_ids = set()
        offset = 0
        page_size = 1000

        while True:
            existing_games_response = db_client.table('games').select('provider_game_id').eq(
                'user_id', canonical_user_id
            ).eq('platform', platform).range(offset, offset + page_size - 1).execute()

            if not existing_games_response.data or len(existing_games_response.data) == 0:
                break

            for game in existing_games_response.data:
                if game.get('provider_game_id'):
                    existing_game_ids.add(game.get('provider_game_id'))

            # If we got fewer results than page_size, we've reached the end
            if len(existing_games_response.data) < page_size:
                break

            offset += page_size

        print(f"[Smart import] Paginated through {offset + len(existing_games_response.data) if existing_games_response.data else offset} total game records")

        # DEBUG: Write to file for diagnosis (only when DEBUG=true)
        if os.getenv("DEBUG", "false").lower() == "true":
            with open('smart_import_debug.txt', 'w') as f:
                f.write(f"[Smart import] Existing game IDs count: {len(existing_game_ids)}\n")
                f.write(f"[Smart import] Queried for user_id='{canonical_user_id}', platform='{platform}'\n")
                if existing_game_ids:
                    f.write(f"[Smart import] Sample existing game IDs (first 3): {list(existing_game_ids)[:3]}\n")
                else:
                    f.write(f"[Smart import] WARNING: No existing games found in database!\n")

        print(f"[Smart import] Existing game IDs count: {len(existing_game_ids)}")
        print(f"[Smart import] Queried for user_id='{canonical_user_id}', platform='{platform}'")
        if existing_game_ids:
            print(f"[Smart import] Sample existing game IDs (first 3): {list(existing_game_ids)[:3]}")
        else:
            print(f"[Smart import] WARNING: No existing games found in database!")

        # Fetch the most recent 100 games from the platform
        print(f"[Smart import] ===== FETCHING GAMES FROM {platform.upper()} =====")
        games_data = await _fetch_games_from_platform(user_id, platform, 100)
        print(f"[Smart import] Fetched {len(games_data) if games_data else 0} games from platform API")
        if games_data:
            sample_ids = [g.get('id') or g.get('provider_game_id') for g in games_data[:3]]
            sample_dates = []
            for g in games_data[:3]:
                date = g.get('played_at', 'No date')
                sample_dates.append(date)
            print(f"[Smart import] Sample fetched game IDs (first 3): {sample_ids}")
            print(f"[Smart import] Sample fetched game DATES (first 3): {sample_dates}")
            print(f"[Smart import] Most recent game date: {games_data[0].get('played_at', 'No date') if games_data else 'N/A'}")
            print(f"[Smart import] Oldest game date in batch: {games_data[-1].get('played_at', 'No date') if games_data else 'N/A'}")

        if not games_data:
            if existing_game_ids:
                message = "No new games found. You already have all recent games imported."
                return BulkGameImportResponse(
                    success=True,
                    imported_games=0,
                    errors=[],
                    error_count=0,
                    new_games_count=0,
                    had_existing_games=True,
                    message=message
                )

            message = (
                "No games were returned from the platform. Please verify the username "
                "has recent games or try again later."
            )
            return BulkGameImportResponse(
                success=False,
                imported_games=0,
                errors=[message],
                error_count=1,
                new_games_count=0,
                had_existing_games=False,
                message=message
            )

        # Filter to get only new games (games not in our database)
        new_games = []
        print(f"[Smart import] ===== DUPLICATE CHECK =====")
        print(f"[Smart import] Database has {len(existing_game_ids)} game IDs")
        if existing_game_ids:
            sample_existing = list(existing_game_ids)[:5]
            print(f"[Smart import] Sample database IDs (first 5): {sample_existing}")

        for idx, game in enumerate(games_data):
            game_id = game.get('id') or game.get('provider_game_id')
            game_date = game.get('played_at', 'No date')

            if idx < 5:  # Log first 5 games with MORE detail
                in_db = game_id in existing_game_ids if game_id else False
                print(f"[Smart import] Game {idx+1}: ID={game_id}, Date={game_date}, In DB={in_db}")

            if game_id and game_id not in existing_game_ids:
                new_games.append(game)
                if idx < 10:  # Log first 10 new games
                    print(f"[Smart import] ✓ NEW GAME FOUND: {game_id} ({game_date})")
            elif game_id and idx < 10:  # Log first 10 skipped games
                print(f"[Smart import] ✗ SKIPPING existing game: {game_id} ({game_date})")

        print(f"[Smart import] Duplicate check complete: fetched {len(games_data)} games, found {len(new_games)} new games, {len(games_data) - len(new_games)} already exist")

        # If no new games found, return early
        if len(new_games) == 0:
            message = "No new games found. You already have all recent games imported."
            print(f"[Smart import] ===== RETURNING EARLY - 0 NEW GAMES =====")
            print(f"[Smart import] {message}")
            print(f"[Smart import] Returning: imported_games=0, new_games_count=0")
            return BulkGameImportResponse(
                success=True,
                imported_games=0,
                errors=[],
                error_count=0,
                new_games_count=0,
                had_existing_games=True,
                message=message
            )

        # For chess.com, also fetch stats to get highest ratings
        highest_rating = None
        if platform == 'chess.com':
            stats_data = await _fetch_chesscom_stats(user_id)
            if stats_data:
                # Extract highest rating from stats
                for time_control in ['chess_rapid', 'chess_blitz', 'chess_bullet', 'chess_daily']:
                    if time_control in stats_data:
                        best_rating = stats_data[time_control].get('best', {}).get('rating')
                        if best_rating and (highest_rating is None or best_rating > highest_rating):
                            highest_rating = best_rating

        # Parse PGN data and count moves
        parsed_games = []
        for game_data in new_games:
            # Count moves from PGN
            total_moves = _count_moves_in_pgn(game_data.get('pgn', ''))

            # Extract opponent name from PGN
            opponent_name = _extract_opponent_name_from_pgn(
                game_data.get('pgn', ''),
                game_data.get('color', 'white')
            )

            parsed_game = {
                'provider_game_id': game_data.get('id', ''),
                'pgn': game_data.get('pgn', ''),
                'result': game_data.get('result'),
                'color': game_data.get('color'),
                'time_control': game_data.get('time_control'),
                'opening': game_data.get('opening'),
                'opening_family': game_data.get('opening_family'),
                'opponent_rating': game_data.get('opponent_rating'),
                'my_rating': game_data.get('my_rating'),
                'played_at': game_data.get('played_at'),
                'total_moves': total_moves,
                'opponent_name': opponent_name
            }
            parsed_games.append(parsed_game)

        # Create bulk import request
        bulk_request = BulkGameImportRequest(
            user_id=user_id,
            platform=platform,
            display_name=user_id,
            games=parsed_games
        )

        # Store highest rating in user profile if available
        if highest_rating and platform == 'chess.com':
            try:
                # Upsert user profile with highest rating
                profile_data = {
                    'user_id': canonical_user_id,
                    'platform': platform,
                    'display_name': user_id,
                    'current_rating': highest_rating,
                    'updated_at': datetime.utcnow().isoformat()
                }
                db_client.table('user_profiles').upsert(profile_data, on_conflict='user_id,platform').execute()
                print(f"Updated profile for {user_id} with highest rating: {highest_rating}")
            except Exception as e:
                print(f"Error updating profile with highest rating: {e}")

        # Process the import
        result = await import_games(bulk_request)

        # Add smart import info to response
        result.new_games_count = len(new_games)
        result.had_existing_games = len(existing_game_ids) > 0

        # Set appropriate message
        if hasattr(result, 'imported_games'):
            if result.imported_games > 0:
                result.message = f"Imported {result.imported_games} new games"
                print(f"[Smart import] Success: imported_games={result.imported_games}, new_games_count={result.new_games_count}")
            else:
                result.message = "No new games found. You already have all recent games imported."
                print(f"[Smart import] No new games: imported_games={result.imported_games}, new_games_count={result.new_games_count}")

        return result

    except Exception as e:
        print(f"Error in smart import: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/import-games", response_model=BulkGameImportResponse)
async def import_games_simple(request: Dict[str, Any], _auth: Optional[bool] = get_optional_auth()):
    """Import games endpoint for frontend - handles PGN parsing and move counting"""
    try:
        user_id = request.get('user_id')
        platform = request.get('platform')
        limit = request.get('limit', 100)

        if not user_id or not platform:
            raise HTTPException(status_code=400, detail="user_id and platform are required")

        rate_key = f"import:{user_id}:{platform}:simple"
        _enforce_rate_limit(rate_key, IMPORT_RATE_LIMIT)

        # Fetch games from platform
        games_data = await _fetch_games_from_platform(user_id, platform, limit)

        # For chess.com, also fetch stats to get highest ratings
        highest_rating = None
        if platform == 'chess.com':
            stats_data = await _fetch_chesscom_stats(user_id)
            if stats_data:
                # Extract highest rating from stats
                for time_control in ['chess_rapid', 'chess_blitz', 'chess_bullet', 'chess_daily']:
                    if time_control in stats_data:
                        best_rating = stats_data[time_control].get('best', {}).get('rating')
                        if best_rating and (highest_rating is None or best_rating > highest_rating):
                            highest_rating = best_rating

        # Parse PGN data and count moves
        parsed_games = []
        for game_data in games_data:
            # Count moves from PGN
            total_moves = _count_moves_in_pgn(game_data.get('pgn', ''))

            # Extract opponent name from PGN
            opponent_name = _extract_opponent_name_from_pgn(
                game_data.get('pgn', ''),
                game_data.get('color', 'white')
            )

            parsed_game = {
                'provider_game_id': game_data.get('id', ''),
                'pgn': game_data.get('pgn', ''),
                'result': game_data.get('result'),
                'color': game_data.get('color'),
                'time_control': game_data.get('time_control'),
                'opening': game_data.get('opening'),
                'opening_family': game_data.get('opening_family'),
                'opponent_rating': game_data.get('opponent_rating'),
                'my_rating': game_data.get('my_rating'),
                'played_at': game_data.get('played_at'),
                'total_moves': total_moves,
                'opponent_name': opponent_name
            }
            parsed_games.append(parsed_game)

        # Create bulk import request
        bulk_request = BulkGameImportRequest(
            user_id=user_id,
            platform=platform,
            display_name=user_id,
            games=parsed_games
        )

        # Store highest rating in user profile if available
        if highest_rating and platform == 'chess.com':
            try:
                canonical_user_id = _canonical_user_id(user_id, platform)
                db_client = supabase_service or supabase
                if db_client:
                    # Upsert user profile with highest rating
                    profile_data = {
                        'user_id': canonical_user_id,
                        'platform': platform,
                        'display_name': user_id,
                        'current_rating': highest_rating,
                        'updated_at': datetime.utcnow().isoformat()
                    }
                    db_client.table('user_profiles').upsert(profile_data, on_conflict='user_id,platform').execute()
                    print(f"Updated profile for {user_id} with highest rating: {highest_rating}")
            except Exception as e:
                print(f"Error updating profile with highest rating: {e}")

        # Process the import
        result = await import_games(bulk_request)
        return result

    except Exception as e:
        print(f"Error in import-games endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/api/v1/import/games", response_model=BulkGameImportResponse)
async def import_games(payload: BulkGameImportRequest, _auth: Optional[bool] = get_optional_auth()):
    """Import games and PGN data using service role credentials."""
    if not supabase_service:
        raise HTTPException(status_code=503, detail="Database not configured for imports")

    if not payload.user_id or not payload.platform:
        raise HTTPException(status_code=400, detail="user_id and platform are required")

    # REMOVED rate limiting - this is an internal endpoint called by large imports in batches
    # Rate limiting is enforced at the parent level (/api/v1/import-more-games, etc.)
    # rate_key = f"import:{payload.user_id}:{payload.platform}:bulk"
    # _enforce_rate_limit(rate_key, IMPORT_RATE_LIMIT)

    canonical_user_id = _canonical_user_id(payload.user_id, payload.platform)
    errors: List[str] = []
    now_iso = datetime.utcnow().isoformat()

    games_rows: List[Dict[str, Any]] = []
    pgn_rows: List[Dict[str, Any]] = []

    skipped_no_id = 0
    skipped_no_time_control = 0

    for game in payload.games:
        # Validate critical fields before import
        if not game.provider_game_id:
            skipped_no_id += 1
            print(f'[import_games] Skipping game with missing provider_game_id for user={payload.user_id}, platform={payload.platform}')
            continue
        if not game.time_control:
            skipped_no_time_control += 1
            print(f'[import_games] Skipping game {game.provider_game_id} due to missing time_control')
            continue

        played_at = _normalize_played_at(game.played_at)
        # Normalize opening name to family for efficient filtering and grouping
        # This consolidates variations (e.g., "Sicilian Defense, Najdorf") into families ("Sicilian Defense")
        # matching frontend expectations and enabling proper match history filtering
        # IMPORTANT: Prioritize actual opening name over ECO code to avoid "Uncommon Opening" for A00
        raw_opening = game.opening or game.opening_family or 'Unknown'
        opening_normalized = normalize_opening_name(raw_opening)

        games_rows.append({
            "user_id": canonical_user_id,
            "platform": payload.platform,
            "provider_game_id": game.provider_game_id,
            "result": game.result,
            "color": game.color,
            "time_control": game.time_control,
            "opening": game.opening,
            "opening_family": game.opening_family,
            "opening_normalized": opening_normalized,
            "opponent_rating": game.opponent_rating,
            "my_rating": game.my_rating,
            "total_moves": game.total_moves,  # Include total_moves from frontend parsing
            "played_at": played_at,
            "opponent_name": game.opponent_name,  # Include opponent_name from PGN extraction
            "created_at": now_iso,
        })
        pgn_rows.append({
            "user_id": canonical_user_id,
            "platform": payload.platform,
            "provider_game_id": game.provider_game_id,
            "pgn": game.pgn,
            "created_at": now_iso,
        })

    if skipped_no_id or skipped_no_time_control:
        print(
            f'[import_games] Validation summary: skipped_no_id={skipped_no_id}, '
            f'skipped_no_time_control={skipped_no_time_control}, '
            f'processed_games={len(games_rows)}'
        )

    if not games_rows:
        errors.append('No valid games to import after validation checks')
        print('[import_games] No games_rows generated after validation; aborting import')
        return BulkGameImportResponse(
            success=False,
            imported_games=0,
            errors=errors,
            error_count=len(errors),
            message='No valid games to import'
        )

    # CRITICAL: Games table MUST be inserted first before PGN due to FK constraint
    # If games insert fails, we MUST NOT attempt PGN insert
    games_insert_succeeded = False

    try:
        if games_rows:
            print(f'[import_games] Upserting {len(games_rows)} game rows')
            print(f'[import_games] Sample game row: user_id={games_rows[0]["user_id"]}, platform={games_rows[0]["platform"]}, provider_game_id={games_rows[0]["provider_game_id"]}, result={games_rows[0]["result"]}')

            games_response = supabase_service.table('games').upsert(
                games_rows,
                on_conflict='user_id,platform,provider_game_id'
            ).execute()

            print('[import_games] games upsert response: count=', getattr(games_response, 'count', None))
            print(f'[import_games] games upsert response data length: {len(games_response.data) if games_response.data else 0}')

            # Verify the insert actually worked
            if games_response.data is None or len(games_response.data) == 0:
                error_msg = "games upsert returned no data - insert may have been blocked by RLS or constraints"
                print(f'[import_games] ERROR: {error_msg}')
                errors.append(error_msg)
                return BulkGameImportResponse(
                    success=False,
                    imported_games=0,
                    errors=errors,
                    error_count=len(errors),
                    message="Failed to import games - upsert returned no data"
                )

            # Double-check: Query the database to verify games were actually inserted
            # This is necessary because upsert can return success even if RLS blocks the insert
            print(f'[import_games] Verifying games were actually inserted...')
            verification_query = supabase_service.table('games').select('provider_game_id').eq(
                'user_id', canonical_user_id
            ).eq('platform', payload.platform).in_('provider_game_id', [g['provider_game_id'] for g in games_rows[:3]]).execute()

            if not verification_query.data or len(verification_query.data) == 0:
                error_msg = "games upsert reported success but games not found in database - likely RLS blocking insert"
                print(f'[import_games] ERROR: {error_msg}')
                print(f'[import_games] Checked for games: {[g["provider_game_id"] for g in games_rows[:3]]}')
                print(f'[import_games] With user_id={canonical_user_id}, platform={payload.platform}')
                errors.append(error_msg)
                return BulkGameImportResponse(
                    success=False,
                    imported_games=0,
                    errors=errors,
                    error_count=len(errors),
                    message="Failed to import games - RLS or constraint blocking insert"
                )

            games_insert_succeeded = True
            print(f'[import_games] games upsert succeeded and verified: {len(games_response.data)} rows affected, {len(verification_query.data)} verified in DB')
    except Exception as exc:
        error_msg = f"games upsert failed: {exc}"
        print(f'[import_games] ERROR: {error_msg}')
        import traceback
        print(f'[import_games] Traceback: {traceback.format_exc()}')
        errors.append(error_msg)
        # CRITICAL: Return immediately - don't attempt PGN insert if games failed
        return BulkGameImportResponse(
            success=False,
            imported_games=0,
            errors=errors,
            error_count=len(errors),
            message="Failed to import games into database"
        )

    # Only attempt PGN insert if games insert succeeded
    if games_insert_succeeded:
        try:
            if pgn_rows:
                print(f'[import_games] Upserting {len(pgn_rows)} PGN rows')
                print(f'[import_games] Sample PGN row (without pgn text): user_id={pgn_rows[0]["user_id"]}, platform={pgn_rows[0]["platform"]}, provider_game_id={pgn_rows[0]["provider_game_id"]}')
                pgn_response = supabase_service.table('games_pgn').upsert(
                    pgn_rows,
                    on_conflict='user_id,platform,provider_game_id'
                ).execute()
                print('[import_games] pgn upsert response: count=', getattr(pgn_response, 'count', None))
                if pgn_response.data:
                    print(f'[import_games] pgn upsert successful, {len(pgn_response.data)} rows affected')
        except Exception as exc:
            error_msg = f"games_pgn upsert failed: {exc}"
            print(f'[import_games] ERROR: {error_msg}')
            errors.append(error_msg)
            # Note: We don't return here because games were imported successfully
            # The PGN failure is logged but not critical

    total_games = 0
    try:
        total_response = supabase_service.table('games').select('id', count='exact', head=True)
        total_response = total_response.eq('user_id', canonical_user_id).eq('platform', payload.platform).execute()
        total_games = getattr(total_response, 'count', None) or 0
        profile_payload = {
            "user_id": canonical_user_id,
            "platform": payload.platform,
            "display_name": payload.display_name or payload.user_id,
            "total_games": total_games,
            "last_accessed": now_iso,
        }
        profile_response = supabase_service.table('user_profiles').upsert(
            profile_payload,
            on_conflict='user_id,platform'
        ).execute()
        print('[import_games] profile upsert response:', getattr(profile_response, 'data', None))
    except Exception as exc:
        errors.append(f"profile update failed: {exc}")

    # Note: imported_games represents the number of game rows sent to the database
    # The calling function (import_games_smart) will set new_games_count to track
    # how many were actually new vs already existing
    return BulkGameImportResponse(
        success=len(errors) == 0,
        imported_games=len(games_rows),
        errors=errors,
        error_count=len(errors),
        message=None  # Will be set by the calling function
    )


# ============================================================================
# LARGE IMPORT ENDPOINTS (5000 games)
# ============================================================================

@app.post("/api/v1/discover-games")
async def discover_games(request: Dict[str, Any]):
    """Discover total games available for a user with optional date range"""
    user_id = request.get('user_id')
    platform = request.get('platform')
    from_date = request.get('from_date')  # Optional ISO date string
    to_date = request.get('to_date')      # Optional ISO date string

    if not user_id or not platform:
        raise HTTPException(status_code=400, detail="user_id and platform are required")

    _enforce_rate_limit(f"import:{user_id}:{platform}:discover", IMPORT_RATE_LIMIT)

    canonical_user_id = _canonical_user_id(user_id, platform)
    db_client = supabase_service or supabase

    if not db_client:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # Get count from database
        query = db_client.table('games').select('id', count='exact', head=True)
        query = query.eq('user_id', canonical_user_id).eq('platform', platform)

        if from_date:
            query = query.gte('played_at', from_date)
        if to_date:
            query = query.lte('played_at', to_date)

        result = query.execute()
        existing_count = getattr(result, 'count', 0) or 0

        # For simplicity, estimate total available as existing + potential 5000 more
        # In production, this could query platform APIs for exact counts
        total_available = existing_count + 5000

        import_limit = min(total_available - existing_count, 5000)

        return {
            "success": True,
            "total_available": total_available,
            "already_imported": existing_count,
            "can_import": max(0, import_limit),
            "capped_at_5000": import_limit >= 5000
        }
    except Exception as e:
        print(f"Error in discover_games: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/import-more-games")
async def import_more_games(request: Dict[str, Any], _auth: Optional[bool] = get_optional_auth()):
    """Import up to 5000 games with progress tracking"""
    user_id = request.get('user_id')
    platform = request.get('platform')
    limit = min(request.get('limit', 5000), 5000)
    from_date = request.get('from_date')
    to_date = request.get('to_date')

    if not user_id or not platform:
        raise HTTPException(status_code=400, detail="user_id and platform are required")

    _enforce_rate_limit(f"import:{user_id}:{platform}:more", IMPORT_RATE_LIMIT)

    # Validate platform
    if platform not in ('lichess', 'chess.com'):
        return {"success": False, "message": "Platform must be 'lichess' or 'chess.com'"}

    canonical_user_id = _canonical_user_id(user_id, platform)
    key = f"{canonical_user_id}_{platform.lower()}"

    # Check if import already running
    if key in large_import_progress and large_import_progress[key].get('status') == 'importing':
        raise HTTPException(status_code=409, detail="Import already in progress")

    # Initialize progress tracking
    large_import_progress[key] = {
        "status": "importing",
        "imported_games": 0,
        "total_to_import": limit,
        "progress_percentage": 0,
        "current_phase": "starting",
        "message": f"Starting import of up to {limit} games..."
    }
    large_import_cancel_flags[key] = False

    # Start background task with error callback
    task = asyncio.create_task(_perform_large_import(user_id, platform, limit, from_date, to_date))
    task.add_done_callback(lambda t: _log_task_error(t, key))

    return {"success": True, "message": "Import started", "import_key": key}


def _log_task_error(task: asyncio.Task, key: str) -> None:
    """Log any exceptions that occurred in background task"""
    try:
        task.result()
    except Exception as e:
        print(f"[large_import] Background task error for {key}: {e}")
        if key in large_import_progress:
            large_import_progress[key].update({
                "status": "error",
                "message": f"Import failed: {str(e)}"
            })
async def _perform_large_import(user_id: str, platform: str, limit: int, from_date: Optional[str] = None, to_date: Optional[str] = None):
    """Background task to import games in batches (memory-optimized with adaptive sizing)"""
    canonical_user_id = _canonical_user_id(user_id, platform)
    key = f"{canonical_user_id}_{platform.lower()}"
    batch_size = IMPORT_BATCH_SIZE  # Start with optimized batch size (50)
    total_imported = 0
    until_timestamp = None  # For Lichess pagination
    oldest_game_month = None  # For Chess.com pagination

    print(f"[large_import] ===== STARTING LARGE IMPORT =====")
    print(f"[large_import] User: {user_id}, Platform: {platform}, Limit: {limit}")
    print(f"[large_import] Canonical User ID: {canonical_user_id}, Key: {key}")

    # Check if we can acquire semaphore (respects concurrent import limit)
    semaphore_acquired = False
    if import_semaphore.locked():
        # Semaphore is at capacity - inform user they're queued
        print(f"[large_import] Import semaphore at capacity, waiting for slot...")
        large_import_progress[key].update({
            "status": "queued",
            "message": f"Import queued - {import_semaphore._value} of {MAX_CONCURRENT_IMPORTS} import slots available"
        })

    # Acquire semaphore to limit concurrent imports
    async with import_semaphore:
        semaphore_acquired = True
        print(f"[large_import] Semaphore acquired - starting import (available slots: {import_semaphore._value}/{MAX_CONCURRENT_IMPORTS})")
        large_import_progress[key].update({
            "status": "importing",
            "message": "Import slot acquired - starting..."
        })

        try:
            # Check if database is configured
            if not (supabase_service or supabase):
                error_msg = "Database not configured"
                large_import_progress[key] = {
                    "status": "error",
                    "imported_games": 0,
                    "total_to_import": 0,
                    "progress_percentage": 0,
                    "current_phase": "error",
                    "message": error_msg
                }
                print(f"[large_import] ERROR: {error_msg}")
                return

            print(f"[large_import] Database client available: supabase_service={supabase_service is not None}, supabase={supabase is not None}")

            # Get existing game IDs with error handling (paginated for memory efficiency)
            try:
                print(f"[large_import] Fetching existing games from database (paginated)...")
                existing_ids = set()  # Use set for O(1) lookup and memory efficiency
                offset = 0

                # Fetch in pages to reduce memory footprint
                while True:
                    page = supabase_service.table('games').select('provider_game_id').eq(
                        'user_id', canonical_user_id
                    ).eq('platform', platform).range(
                        offset, offset + EXISTING_GAMES_PAGE_SIZE - 1
                    ).execute()

                    if not page.data or len(page.data) == 0:
                        break

                    # Add to set (memory efficient - no duplicates)
                    existing_ids.update(g.get('provider_game_id') for g in page.data if g.get('provider_game_id'))

                    # Check if we got a full page (if not, we're done)
                    if len(page.data) < EXISTING_GAMES_PAGE_SIZE:
                        break

                    offset += EXISTING_GAMES_PAGE_SIZE

                    # Allow other tasks to run
                    await asyncio.sleep(0.01)

                print(f"[large_import] Found {len(existing_ids)} existing games in database")
            except Exception as e:
                error_msg = f"Failed to query existing games: {str(e)}"
                print(f"[large_import] ERROR: {error_msg}")
                large_import_progress[key].update({
                    "status": "error",
                    "message": error_msg
                })
                return

            print(f"[large_import] Starting import for {user_id}, existing games: {len(existing_ids)}")

            # Smart pagination with TWO-PHASE approach:
            # PHASE 1: Check for NEW games (after newest imported game)
            # PHASE 2: If no new games, backfill OLD games (before oldest imported game)
            # This ensures we don't miss recently played games
            import_phase = "new_games"  # Start by checking for new games
            since_timestamp = None  # For Lichess: fetch games AFTER this time
            newest_game_month = None  # For Chess.com: fetch games from this month onwards

            try:
                # Get both oldest AND newest game from database
                oldest_game_query = supabase_service.table('games').select('played_at').eq(
                    'user_id', canonical_user_id
                ).eq('platform', platform).order('played_at', desc=False).limit(1).execute()

                newest_game_query = supabase_service.table('games').select('played_at').eq(
                    'user_id', canonical_user_id
                ).eq('platform', platform).order('played_at', desc=True).limit(1).execute()

                has_existing_games = (oldest_game_query.data and len(oldest_game_query.data) > 0 and
                                     newest_game_query.data and len(newest_game_query.data) > 0)

                if has_existing_games:
                    from datetime import datetime, timedelta
                    oldest_played_at = oldest_game_query.data[0]['played_at']
                    newest_played_at = newest_game_query.data[0]['played_at']
                    print(f"[large_import] Found existing games:")
                    print(f"[large_import]   Oldest: {oldest_played_at}")
                    print(f"[large_import]   Newest: {newest_played_at}")

                    # PHASE 1: Check for new games first (after newest game)
                    newest_dt = datetime.fromisoformat(newest_played_at.replace('Z', '+00:00'))
                    check_new_from = newest_dt + timedelta(seconds=1)  # Start from 1 second after newest

                    if platform == 'lichess':
                        since_timestamp = int(check_new_from.timestamp() * 1000)  # milliseconds
                        print(f"[large_import] PHASE 1: Checking for NEW games after {check_new_from.isoformat()}")
                        print(f"[large_import]   Using since_timestamp: {since_timestamp}")
                    elif platform == 'chess.com':
                        newest_game_month = (newest_dt.year, newest_dt.month)
                        print(f"[large_import] PHASE 1: Checking for NEW games from {newest_game_month[0]}/{newest_game_month[1]:02d} onwards")

                    import_phase = "new_games"

                    # Store backfill info for PHASE 2 if needed
                    oldest_dt = datetime.fromisoformat(oldest_played_at.replace('Z', '+00:00'))
                    backfill_dt = oldest_dt - timedelta(days=1)

                    if platform == 'lichess':
                        backfill_until_timestamp = int(backfill_dt.timestamp() * 1000)
                    elif platform == 'chess.com':
                        backfill_oldest_month = (backfill_dt.year, backfill_dt.month)
                else:
                    print(f"[large_import] No existing games found - starting from most recent")
                    import_phase = "first_import"
            except Exception as resume_error:
                print(f"[large_import] WARNING: Could not determine resume point: {resume_error}")
                import_phase = "first_import"
                # Continue with default (most recent)

            # Import in batches
            consecutive_no_new_games = 0
            # Increase threshold: Stop after 100 consecutive empty batches (5000 games buffer)
            # This prevents premature stopping when hitting duplicate ranges
            max_consecutive_no_new = 100
            total_games_checked = 0  # Track total games fetched from platform
            skip_count = 0  # Track how many times we've skipped ahead
            phase_switched = False  # Track if we've switched from phase 1 to phase 2
            print(f"[large_import] Will stop after {max_consecutive_no_new} consecutive batches with no new games")

            # For Chess.com, use larger batches to get all games from multiple months at once
            batch_size_adjusted = limit if platform == 'chess.com' else batch_size

            for batch_start in range(0, limit, batch_size):
                # Check cancel flag
                if large_import_cancel_flags.get(key, False):
                    large_import_progress[key].update({
                        "status": "cancelled",
                        "message": f"Import cancelled. {total_imported} games imported."
                    })
                    print("[large_import] Import cancelled by user")
                    return

                # Phase switching logic: If PHASE 1 (new games) found nothing, switch to PHASE 2 (backfill old games)
                if import_phase == "new_games" and consecutive_no_new_games >= 3 and not phase_switched:
                    print(f"[large_import] PHASE 1 complete - No new games found after 3 batches")
                    print(f"[large_import] Switching to PHASE 2: Backfilling OLD games...")

                    if platform == 'lichess' and 'backfill_until_timestamp' in locals():
                        until_timestamp = backfill_until_timestamp
                        since_timestamp = None  # Clear since for backfill
                        print(f"[large_import] PHASE 2: Backfilling from timestamp {until_timestamp}")
                    elif platform == 'chess.com' and 'backfill_oldest_month' in locals():
                        oldest_game_month = backfill_oldest_month
                        print(f"[large_import] PHASE 2: Backfilling from {oldest_game_month[0]}/{oldest_game_month[1]:02d}")

                    import_phase = "backfill_old"
                    consecutive_no_new_games = 0  # Reset counter for phase 2
                    phase_switched = True

                # Adaptive batch sizing: reduce batch size for large imports to prevent timeouts
                if total_imported >= 800:
                    # Very large import: use smallest batches (25 games)
                    current_batch_size = 25
                elif total_imported >= 500:
                    # Large import: use medium batches (35 games)
                    current_batch_size = 35
                else:
                    # Normal: use standard batch size (50 games)
                    current_batch_size = batch_size

                # Fetch batch with pagination support
                batch_limit = batch_size_adjusted if platform == 'chess.com' else min(current_batch_size, limit - batch_start)
                batch_num = batch_start // batch_size + 1
                print(f"[large_import] ===== BATCH {batch_num} =====")
                if current_batch_size != batch_size:
                    print(f"[large_import] Using adaptive batch size: {current_batch_size} (reduced from {batch_size}) due to large import ({total_imported} games already imported)")
                print(f"[large_import] Fetching games (batch limit: {batch_limit}, offset: {batch_start}/{limit})")
                print(f"[large_import] Pagination state - until_timestamp: {until_timestamp}, since_timestamp: {since_timestamp if 'since_timestamp' in locals() else None}, oldest_game_month: {oldest_game_month}")

                # Stagger requests when multiple imports are running to prevent resource contention
                active_imports = MAX_CONCURRENT_IMPORTS - import_semaphore._value
                if active_imports >= 2:
                    await asyncio.sleep(0.5)  # 500ms delay reduces CPU/memory spikes and prevents connection pool exhaustion
                    print(f"[large_import] {active_imports} concurrent imports active - added 0.5s delay for stability")

                # ALWAYS add a small delay between batches to avoid Lichess rate limiting (429 errors)
                # Lichess allows roughly 50-60 requests per minute for authenticated users
                if platform == 'lichess':
                    await asyncio.sleep(1.2)  # 1.2 seconds = ~50 requests/minute (safe rate)
                    print(f"[large_import] Added 1.2s delay to respect Lichess API rate limits")

                try:
                    games_data = await _fetch_games_from_platform(
                        user_id, platform, batch_limit, until_timestamp, from_date, to_date, oldest_game_month, since_timestamp
                    )
                    print(f"[large_import] Fetch completed. Received {len(games_data) if games_data else 0} games")
                except Exception as e:
                    error_msg = f"Failed to fetch games (batch {batch_num}): {str(e)}"
                    print(f"[large_import] ERROR: {error_msg}")
                    large_import_progress[key].update({
                        "status": "error",
                        "message": error_msg,
                        "imported_games": total_imported
                    })
                    return

                if not games_data:
                    print(f"[large_import] No games fetched in this batch")

                    # Don't break immediately - allow phase switching if in Phase 1
                    if import_phase == "new_games" and not phase_switched:
                        consecutive_no_new_games += 1
                        print(f"[large_import] PHASE 1: Empty batch #{consecutive_no_new_games} - will check for phase switch")

                        # If we've had 1 empty batch in Phase 1, switch to Phase 2
                        if consecutive_no_new_games >= 1:
                            print(f"[large_import] PHASE 1 complete - No new games found")
                            print(f"[large_import] Switching to PHASE 2: Backfilling OLD games...")

                            if platform == 'lichess' and 'backfill_until_timestamp' in locals():
                                until_timestamp = backfill_until_timestamp
                                since_timestamp = None  # Clear since for backfill
                                print(f"[large_import] PHASE 2: Backfilling from timestamp {until_timestamp}")
                            elif platform == 'chess.com' and 'backfill_oldest_month' in locals():
                                oldest_game_month = backfill_oldest_month
                                print(f"[large_import] PHASE 2: Backfilling from {oldest_game_month[0]}/{oldest_game_month[1]:02d}")

                            import_phase = "backfill_old"
                            consecutive_no_new_games = 0  # Reset counter for phase 2
                            phase_switched = True
                            continue  # Continue to next batch with Phase 2 settings

                    # If in Phase 2 or first_import and no games, stop
                    print(f"[large_import] No more games to fetch, stopping")
                    break

                # Track total games checked
                total_games_checked += len(games_data)

                # Filter new games
                new_games = [g for g in games_data if g.get('id') not in existing_ids]
                print(f"[large_import] Batch {batch_num}: fetched {len(games_data)}, new: {len(new_games)}, total checked: {total_games_checked}")

                # Track consecutive batches with no new games
                if len(new_games) == 0:
                    consecutive_no_new_games += 1

                    # Skip-ahead logic: Jump past duplicate ranges to find older games
                    if consecutive_no_new_games == 5 and skip_count < 3:
                        skip_count += 1
                        print(f"[large_import] Hit 5 empty batches, jumping ahead to skip duplicate range (skip #{skip_count})...")

                        # Lichess: Jump back 30 days in time
                        if until_timestamp and platform == 'lichess':
                            until_timestamp -= (86400000 * 30)  # 30 days in milliseconds
                            print(f"[large_import] Skipped back 30 days, new timestamp: {until_timestamp}")

                        # Chess.com: Skip back 2 months
                        elif platform == 'chess.com' and oldest_game_month:
                            year, month = oldest_game_month
                            month -= 2
                            if month < 1:
                                month += 12
                                year -= 1
                            oldest_game_month = (year, month)
                            print(f"[large_import] Skipped back 2 months, new date: {oldest_game_month[0]}/{oldest_game_month[1]:02d}")

                    # Stop after 100 consecutive empty batches (5000 games checked with no new ones)
                    if consecutive_no_new_games >= max_consecutive_no_new:
                        print(f"[large_import] No new games in {max_consecutive_no_new} consecutive batches (~{max_consecutive_no_new * 50} games checked), stopping")
                        break
                else:
                    consecutive_no_new_games = 0  # Reset counter

                # Update pagination for next batch
                if platform == 'lichess' and games_data:
                    # Update until_timestamp for Lichess (get oldest game's timestamp)
                    for game in reversed(games_data):
                        played_at = game.get('played_at')
                        if played_at:
                            try:
                                from datetime import datetime
                                if isinstance(played_at, str):
                                    dt = datetime.fromisoformat(played_at.replace('Z', '+00:00'))
                                    until_timestamp = int(dt.timestamp() * 1000)  # Convert to milliseconds
                                break
                            except Exception as e:
                                print(f"[large_import] Error parsing timestamp: {e}")
                elif platform == 'chess.com' and games_data:
                    # Update oldest_game_month for Chess.com pagination
                    for game in reversed(games_data):
                        played_at = game.get('played_at')
                        if played_at:
                            try:
                                from datetime import datetime
                                if isinstance(played_at, str):
                                    dt = datetime.fromisoformat(played_at.replace('Z', '+00:00'))
                                    oldest_game_month = (dt.year, dt.month)
                                break
                            except Exception as e:
                                print(f"[large_import] Error parsing Chess.com timestamp: {e}")

                if new_games:
                    # Import batch
                    print(f"[large_import] Processing {len(new_games)} new games for import...")
                    parsed_games = []
                    for game in new_games:
                        parsed_games.append({
                            'provider_game_id': game.get('id'),
                            'pgn': game.get('pgn'),
                            'result': game.get('result'),
                            'color': game.get('color'),
                            'time_control': game.get('time_control'),
                            'opening': game.get('opening'),
                            'opening_family': game.get('opening_family'),
                            'opponent_rating': game.get('opponent_rating'),
                            'my_rating': game.get('my_rating'),
                            'total_moves': _count_moves_in_pgn(game.get('pgn', '')),
                            'opponent_name': _extract_opponent_name_from_pgn(game.get('pgn', ''), game.get('color')),
                            'played_at': game.get('played_at')
                        })

                    try:
                        bulk_request = BulkGameImportRequest(
                            user_id=user_id,
                            platform=platform,
                            games=parsed_games
                        )
                        print(f"[large_import] Calling import_games with {len(parsed_games)} games...")
                        await import_games(bulk_request)
                        print(f"[large_import] Import successful!")

                        total_imported += len(new_games)
                        existing_ids.update({g.get('id') for g in new_games})
                        print(f"[large_import] Imported {len(new_games)} games, total: {total_imported}")

                        # Hard limit: Stop at 5000 games per import session
                        if total_imported >= 5000:
                            print(f"[large_import] Reached maximum import limit of 5000 games. Stopping.")
                            large_import_progress[key].update({
                                "status": "completed",
                                "imported_games": total_imported,
                                "progress_percentage": 100,
                                "message": f"Import complete! Imported {total_imported} games. Click 'Import More Games' to continue."
                            })
                            return
                    except Exception as e:
                        error_msg = f"Failed to import batch: {str(e)}"
                        print(f"[large_import] ERROR: {error_msg}")
                        large_import_progress[key].update({
                            "status": "error",
                            "message": error_msg,
                            "imported_games": total_imported
                        })
                        return

                # Update progress
                progress_pct = min(100, int((total_imported / limit) * 100)) if limit > 0 else 100
                trigger_refresh = total_imported % 500 == 0 and total_imported > 0
                duplicates_skipped = total_games_checked - total_imported

                large_import_progress[key].update({
                    "imported_games": total_imported,
                    "progress_percentage": progress_pct,
                    "current_phase": "importing",
                    "message": f"Imported {total_imported} games (checked {total_games_checked}, skipped {duplicates_skipped} duplicates)",
                    "trigger_refresh": trigger_refresh
                })

                # For Chess.com, we fetched all games in one go, so break after first batch
                if platform == 'chess.com':
                    print(f"[large_import] Chess.com: All available games fetched in batch 1, exiting loop")
                    break

                # Memory optimization: More aggressive cleanup for large imports
                if total_imported > 0:
                    # Cleanup every 100 games (was 200) for better memory management
                    if total_imported % 100 == 0:
                        import gc
                        games_data = None
                        new_games = None
                        parsed_games = None
                        gc.collect()
                        print(f"[large_import] Memory cleanup performed at {total_imported} games")

                    # For very large imports (500+), add extra progress updates
                    if total_imported >= 500 and total_imported % 50 == 0:
                        print(f"[large_import] Progress update: {total_imported} games imported, still processing...")

                # Adaptive delay: longer delay for large imports to reduce system pressure
                if total_imported < 500:
                    await asyncio.sleep(0.1)
                else:
                    # Longer delay for large imports to prevent resource exhaustion
                    await asyncio.sleep(0.2)

            # Complete
            if total_imported == 0:
                message = f"Import complete! Checked {total_games_checked} games, all were already imported. No new games found."
            else:
                message = f"Import complete! {total_imported} new games imported (checked {total_games_checked} total)."

            large_import_progress[key].update({
                "status": "completed",
                "progress_percentage": 100,
                "message": message,
                "trigger_refresh": True
            })
            print(f"[large_import] Import completed successfully: {total_imported} new games, {total_games_checked} total checked")

        except Exception as e:
            print(f"[large_import] Error during import: {e}")
            large_import_progress[key].update({
                "status": "error",
                "message": f"Import failed: {str(e)}"
            })


@app.get("/api/v1/import-progress/{user_id}/{platform}")
async def get_import_progress(user_id: str, platform: str):
    """Get progress of ongoing import"""
    canonical_user_id = _canonical_user_id(user_id, platform)
    key = f"{canonical_user_id}_{platform.lower()}"

    return large_import_progress.get(key, {
        "status": "idle",
        "imported_games": 0,
        "total_to_import": 0,
        "progress_percentage": 0,
        "message": "No import in progress"
    })


@app.get("/api/v1/import-status/{user_id}/{platform}")
async def get_import_status(user_id: str, platform: str):
    """Get import status showing oldest game and total games imported"""
    try:
        canonical_user_id = _canonical_user_id(user_id, platform)

        # Get oldest game
        oldest_game_query = supabase_service.table('games').select('played_at').eq(
            'user_id', canonical_user_id
        ).eq('platform', platform).order('played_at', desc=False).limit(1).execute()

        # Get total game count
        total_games_query = supabase_service.table('games').select('id', count='exact', head=True).eq(
            'user_id', canonical_user_id
        ).eq('platform', platform).execute()

        oldest_game = oldest_game_query.data[0]['played_at'] if oldest_game_query.data else None
        total_games = getattr(total_games_query, 'count', 0)

        return {
            "total_games": total_games,
            "oldest_game": oldest_game,
            "can_import_more": True,
            "platform": platform,
            "user_id": user_id
        }
    except Exception as e:
        print(f"[import_status] Error: {e}")
        return {
            "total_games": 0,
            "oldest_game": None,
            "can_import_more": True,
            "platform": platform,
            "user_id": user_id,
            "error": str(e)
        }


@app.post("/api/v1/cancel-import")
async def cancel_import(request: Dict[str, Any], _auth: Optional[bool] = get_optional_auth()):
    """Cancel ongoing import"""
    user_id = request.get('user_id')
    platform = request.get('platform')

    if not user_id or not platform:
        raise HTTPException(status_code=400, detail="user_id and platform are required")

    canonical_user_id = _canonical_user_id(user_id, platform)
    key = f"{canonical_user_id}_{platform.lower()}"

    large_import_cancel_flags[key] = True

    return {"success": True, "message": "Cancel requested"}


@app.get("/debug/db-state/{user_id}/{platform}")
async def debug_db_state(user_id: str, platform: str):
    """Debug endpoint to check database state. Only available when DEBUG=true."""
    # Only allow in debug mode
    if os.getenv("DEBUG", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Debug endpoints disabled in production")

    try:
        canonical_user_id = user_id.strip().lower()

        # Get the most recent game we have in the database
        existing_games_response = supabase.table('games').select('provider_game_id, played_at').eq(
            'user_id', canonical_user_id
        ).eq('platform', platform).order('played_at', desc=True).limit(1).execute()

        existing_games = existing_games_response.data or []
        most_recent_game_id = existing_games[0].get('provider_game_id') if existing_games else None
        most_recent_played_at = existing_games[0].get('played_at') if existing_games else None

        # Get total count
        count_response = supabase.table('games').select('id', count='exact').eq(
            'user_id', canonical_user_id
        ).eq('platform', platform).execute()

        return {
            "user_id": canonical_user_id,
            "platform": platform,
            "total_games": count_response.count,
            "most_recent_game_id": most_recent_game_id,
            "most_recent_played_at": most_recent_played_at,
            "played_at_type": str(type(most_recent_played_at)),
            "existing_games": existing_games
        }

    except Exception as e:
        return {"error": str(e)}
@app.get("/proxy/chess-com/{username}")
async def proxy_chess_com_user(username: str):
    """Proxy endpoint for Chess.com user info to avoid CORS issues."""
    import httpx

    try:
        canonical_username = username.strip().lower()
        url = f"https://api.chess.com/pub/player/{canonical_username}"
        print(f"Proxying user request to: {url}")

        # Chess.com API requires User-Agent header
        headers = {
            'User-Agent': 'ChessAnalytics/1.0 (Contact: your-email@example.com)'
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=30.0)

            if response.status_code == 200:
                return response.json()
            else:
                print(f"Chess.com API returned status {response.status_code}")
                return {"error": f"User not found or API returned status {response.status_code}"}

    except Exception as e:
        print(f"Error proxying Chess.com user request: {e}")
        return {"error": str(e)}

@app.post("/api/v1/validate-user")
async def validate_user(request: dict):
    """Validate that a user exists on the specified platform."""
    try:
        user_id = request.get("user_id")
        platform = request.get("platform")

        if not user_id or not platform:
            return {
                "exists": False,
                "message": "Missing user_id or platform parameter"
            }

        if platform not in ["lichess", "chess.com"]:
            return {
                "exists": False,
                "message": "Platform must be 'lichess' or 'chess.com'"
            }

        # Validate user exists on the platform
        if platform == "lichess":
            # Check Lichess user exists
            import aiohttp
            async with aiohttp.ClientSession() as session:
                url = f"https://lichess.org/api/user/{user_id}"
                async with session.get(url) as response:
                    if response.status == 200:
                        return {"exists": True, "message": "User found on Lichess"}
                    else:
                        return {
                            "exists": False,
                            "message": f"User '{user_id}' not found on Lichess"
                        }
        else:  # chess.com
            # Check Chess.com user exists
            import httpx
            # Chess.com API requires User-Agent header
            headers = {
                'User-Agent': 'ChessAnalytics/1.0 (Contact: your-email@example.com)'
            }
            async with httpx.AsyncClient() as client:
                canonical_username = user_id.strip().lower()
                url = f"https://api.chess.com/pub/player/{canonical_username}"
                response = await client.get(url, headers=headers, timeout=10.0)

                if response.status_code == 200:
                    return {"exists": True, "message": "User found on Chess.com"}
                else:
                    return {
                        "exists": False,
                        "message": f"User '{user_id}' not found on Chess.com"
                    }

    except Exception as e:
        print(f"Error validating user: {e}")
        return {
            "exists": False,
            "message": f"Error validating user: {str(e)}"
        }

@app.post("/api/v1/check-user-exists")
async def check_user_exists(request: dict):
    """Check if a user already exists in our database."""
    try:
        user_id = request.get("user_id")
        platform = request.get("platform")

        if not user_id or not platform:
            return {"exists": False}

        if platform not in ["lichess", "chess.com"]:
            return {"exists": False}

        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)

        # Check if user exists in user_profiles table
        from supabase import create_client, Client
        import os

        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            return {"exists": False}

        supabase: Client = create_client(supabase_url, supabase_key)

        result = supabase.table("user_profiles").select("user_id").eq("user_id", canonical_user_id).eq("platform", platform).execute()

        return {"exists": len(result.data) > 0}

    except Exception as e:
        print(f"Error checking user existence: {e}")
        return {"exists": False}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================



def _normalize_played_at(value: Optional[str]) -> str:
    """Ensure played_at values are ISO timestamps."""
    if not value:
        return datetime.utcnow().isoformat()
    try:
        cleaned = value.replace('Z', '+00:00') if value.endswith('Z') else value
        return datetime.fromisoformat(cleaned).isoformat()
    except Exception:
        return value

def _canonical_user_id(user_id: str, platform: str) -> str:
    """Canonicalize user ID for database operations.

    Chess.com usernames are case-insensitive and should be stored/queried in lowercase.
    Lichess usernames are case-sensitive and should be left unchanged.
    """
    if not user_id or not platform:
        raise ValueError("user_id and platform cannot be empty")

    if platform == "chess.com":
        return user_id.strip().lower()
    else:  # lichess
        return user_id.strip()

def _validate_single_game_analysis_request(request: UnifiedAnalysisRequest) -> Tuple[bool, str]:
    """Validate single game analysis request parameters."""
    if not request.user_id:
        return False, "user_id is required"

    if not request.platform:
        return False, "platform is required"

    if not request.game_id and not request.provider_game_id:
        return False, "Either game_id or provider_game_id is required"

    if request.platform not in ["chess.com", "lichess"]:
        return False, f"Unsupported platform: {request.platform}"

    return True, "Valid"
def get_analysis_engine() -> ChessAnalysisEngine:
    """Get or create the analysis engine instance."""
    global analysis_engine
    # Pass stockfish path from config to ensure production paths are checked
    stockfish_path = config.stockfish.path
    if stockfish_path:
        print(f"[ENGINE] Using Stockfish from config: {stockfish_path}")
    else:
        print(f"[ENGINE] Warning: No Stockfish path found in config")
    analysis_engine = ChessAnalysisEngine(stockfish_path=stockfish_path)
    return analysis_engine

async def _handle_single_game_analysis(request: UnifiedAnalysisRequest) -> UnifiedAnalysisResponse:
    """Handle single game analysis with PGN data."""
    try:
        # Canonicalize user ID for database consistency
        canonical_user_id = _canonical_user_id(request.user_id, request.platform)

        engine = get_analysis_engine()

        # Configure analysis type with optimized settings
        resolved_type = _normalize_analysis_type(request.analysis_type, quiet=True)
        if request.analysis_type != resolved_type:
            request.analysis_type = resolved_type
        analysis_type_enum = AnalysisType(resolved_type)

        # Use optimized configuration based on analysis type
        if resolved_type == "deep":
            engine.config = AnalysisConfig.for_deep_analysis()
        else:
            engine.config = AnalysisConfig(
                analysis_type=analysis_type_enum,
                depth=request.depth,
                skill_level=request.skill_level
            )

        # Analyze game - pass game_id if provided in request
        # Ensure we use the provider_game_id for analysis to match foreign key constraint
        analysis_game_id = request.game_id or request.provider_game_id
        game_analysis = await engine.analyze_game(
            request.pgn,
            canonical_user_id,  # Use canonical user ID
            request.platform,
            analysis_type_enum,
            analysis_game_id
        )

        if game_analysis:
            # Save to database
            success = await _save_stockfish_analysis(game_analysis)
            if success:
                return UnifiedAnalysisResponse(
                    success=True,
                    message="Game analysis completed and saved",
                    analysis_id=game_analysis.game_id,
                    data={"game_id": game_analysis.game_id}
                )
            else:
                return UnifiedAnalysisResponse(
                    success=False,
                    message="Game analysis completed but failed to save to database"
                )
        else:
            return UnifiedAnalysisResponse(
                success=False,
                message="Failed to analyze game"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
async def _handle_single_game_by_id(request: UnifiedAnalysisRequest) -> UnifiedAnalysisResponse:
    """Handle single game analysis by game_id - fetch PGN from database."""
    try:
        # Validate request parameters
        is_valid, error_message = _validate_single_game_analysis_request(request)
        if not is_valid:
            print(f"[SINGLE GAME ANALYSIS] ERROR Validation failed: {error_message}")
            return UnifiedAnalysisResponse(
                success=False,
                message=f"Request validation failed: {error_message}"
            )

        # Canonicalize user ID for database operations
        try:
            canonical_user_id = _canonical_user_id(request.user_id, request.platform)
        except ValueError as e:
            print(f"[SINGLE GAME ANALYSIS] ERROR User ID canonicalization failed: {e}")
            return UnifiedAnalysisResponse(
                success=False,
                message=f"User ID validation failed: {str(e)}"
            )

        # Get the game_id to search for
        game_id = request.game_id or request.provider_game_id
        print(f"[SINGLE GAME ANALYSIS] Starting analysis for game_id: {game_id}, user: {canonical_user_id} (original: {request.user_id})")

        # Fetch PGN data from database
        if not supabase:
            return UnifiedAnalysisResponse(
                success=False,
                message="Database not available"
            )

        db_client = supabase_service or supabase  # Use service role to bypass RLS

        # Try to find the game by provider_game_id first
        print(f"[SINGLE GAME ANALYSIS] Querying games_pgn by provider_game_id: {game_id}")
        print(f"[SINGLE GAME ANALYSIS] Query params: user_id={canonical_user_id}, platform={request.platform}")

        # First, let's see what's actually in the database for this user
        try:
            all_games = db_client.table('games_pgn').select('provider_game_id').eq(
                'user_id', canonical_user_id
            ).eq('platform', request.platform).limit(5).execute()
            print(f"[SINGLE GAME ANALYSIS] Sample games for this user: {all_games.data if all_games else 'None'}")
        except Exception as debug_error:
            if os.getenv("DEBUG", "false").lower() == "true":
                print(f"[SINGLE GAME ANALYSIS] Debug query failed: {debug_error}")

        try:
            game_response = db_client.table('games_pgn').select('pgn, provider_game_id').eq(
                'provider_game_id', game_id
            ).eq('user_id', canonical_user_id).eq('platform', request.platform).maybe_single().execute()
            print(f"[SINGLE GAME ANALYSIS] Query result: {game_response}")
            print(f"[SINGLE GAME ANALYSIS] Has data: {game_response is not None and hasattr(game_response, 'data')}")
            if game_response and hasattr(game_response, 'data'):
                print(f"[SINGLE GAME ANALYSIS] Data value: {game_response.data}")
        except Exception as query_error:
            print(f"[SINGLE GAME ANALYSIS] ERROR Database query error: {query_error}")
            return UnifiedAnalysisResponse(
                success=False,
                message=f"Database query failed: {str(query_error)}"
            )

        # If not found in games_pgn, we'll try to fetch from the platform

        # If still not found in database, try fetching from chess platform
        if not game_response or not hasattr(game_response, 'data') or not game_response.data:
            print(f"[SINGLE GAME ANALYSIS] Game not found in database, attempting to fetch from {request.platform}")

            pgn_from_platform = None
            if request.platform == 'lichess':
                pgn_from_platform = await _fetch_single_lichess_game(game_id)
            elif request.platform == 'chess.com':
                pgn_from_platform = await _fetch_single_chesscom_game(request.user_id, game_id)

            if not pgn_from_platform:
                print(f"[SINGLE GAME ANALYSIS] ERROR Game not found in database or on {request.platform}: {game_id}")
                return UnifiedAnalysisResponse(
                    success=False,
                    message=f"Game not found: {game_id}. Unable to fetch from {request.platform}. Please ensure the game ID is correct and the game exists."
                )

            print(f"[SINGLE GAME ANALYSIS] OK Successfully fetched PGN from {request.platform}, saving to database")

            # Save the PGN to database for future use
            try:
                from datetime import datetime
                db_client.table('games_pgn').upsert({
                    'user_id': canonical_user_id,
                    'platform': request.platform,
                    'provider_game_id': game_id,
                    'pgn': pgn_from_platform,
                    'created_at': datetime.utcnow().isoformat()
                }, on_conflict='user_id,platform,provider_game_id').execute()
                print(f"[SINGLE GAME ANALYSIS] OK Saved PGN to database")
            except Exception as save_error:
                print(f"[SINGLE GAME ANALYSIS] WARNING Warning: Failed to save PGN to database: {save_error}")
                # Continue anyway - we have the PGN in memory

            # Use the fetched PGN
            pgn_data = pgn_from_platform
        else:
            print(f"[SINGLE GAME ANALYSIS] Extracting PGN data from response")
            pgn_data = game_response.data.get('pgn') if isinstance(game_response.data, dict) else None
            if not pgn_data:
                return UnifiedAnalysisResponse(
                    success=False,
                    message=f"No PGN data found for game: {game_id}"
                )

        # Ensure the game exists in the games table for foreign key constraint
        # Check if game exists in games table
        print(f"[SINGLE GAME ANALYSIS] Checking if game exists in games table: user_id={canonical_user_id}, platform={request.platform}, game_id={game_id}")
        games_check = None
        try:
            games_check = db_client.table('games').select('id').eq(
                'provider_game_id', game_id
            ).eq('user_id', canonical_user_id).eq('platform', request.platform).maybe_single().execute()
            print(f"[SINGLE GAME ANALYSIS] Games table check result: {games_check.data if (games_check and hasattr(games_check, 'data')) else 'None'}")
        except Exception as check_error:
            print(f"[SINGLE GAME ANALYSIS] ERROR Error checking games table: {check_error}")
            games_check = None

        if not games_check or not hasattr(games_check, 'data') or not games_check.data:
            print(f"[SINGLE GAME ANALYSIS] Game {game_id} not found in games table, creating basic record...")
            # Parse PGN to extract basic game info
            import chess.pgn
            import io
            pgn_io = io.StringIO(pgn_data)
            game = chess.pgn.read_game(pgn_io)

            if game and game.headers:
                headers = game.headers
                # Create a basic game record
                from datetime import datetime
                now_iso = datetime.utcnow().isoformat()

                # Extract basic info from PGN headers
                result = headers.get('Result', '0-1')
                white_player = headers.get('White', '')
                black_player = headers.get('Black', '')
                user_is_white = white_player.lower() == request.user_id.lower()

                # Determine color and result from user's perspective
                if user_is_white:
                    color = 'white'
                    if result == '1-0':
                        user_result = 'win'
                    elif result == '0-1':
                        user_result = 'loss'
                    else:
                        user_result = 'draw'
                else:
                    color = 'black'
                    if result == '0-1':
                        user_result = 'win'
                    elif result == '1-0':
                        user_result = 'loss'
                    else:
                        user_result = 'draw'

                # Count moves
                move_count = sum(1 for _ in game.mainline_moves())

                # Parse played_at date
                played_at_raw = headers.get('UTCDate') or headers.get('Date', now_iso)
                # Try to parse and normalize the date
                try:
                    from dateutil import parser as date_parser
                    played_at = date_parser.parse(played_at_raw).isoformat()
                except Exception:
                    played_at = now_iso

                game_record = {
                    "user_id": canonical_user_id,
                    "platform": request.platform,
                    "provider_game_id": game_id,
                    "result": user_result,
                    "color": color,
                    "time_control": headers.get('TimeControl', 'unknown'),
                    "opening": headers.get('Opening', 'Unknown'),
                    "opening_family": headers.get('Opening', 'Unknown').split(',')[0].split(':')[0].strip() if headers.get('Opening') else 'Unknown',
                    "opponent_rating": None,  # Not available in basic PGN
                    "my_rating": None,  # Not available in basic PGN
                    "total_moves": move_count,
                    "played_at": played_at,
                    "opponent_name": black_player if user_is_white else white_player,
                    "created_at": now_iso,
                }

                try:
                    print(f"[SINGLE GAME ANALYSIS] Creating game record with canonical user_id: {canonical_user_id}")
                    games_response = db_client.table('games').upsert(
                        game_record,
                        on_conflict='user_id,platform,provider_game_id'
                    ).execute()
                    print(f"[SINGLE GAME ANALYSIS] ✅ Created game record: {game_id}")
                    print(f"[SINGLE GAME ANALYSIS] Game record: user_id={canonical_user_id}, platform={request.platform}, game_id={game_id}")
                except Exception as e:
                    print(f"[SINGLE GAME ANALYSIS] Failed to create game record: {e}")
                    return UnifiedAnalysisResponse(
                        success=False,
                        message=f"Failed to create game record: {e}"
                    )

        # Now analyze the game with the fetched PGN
        engine = get_analysis_engine()

        # Configure analysis type with optimized settings
        resolved_type = _normalize_analysis_type(request.analysis_type, quiet=True)
        if request.analysis_type != resolved_type:
            request.analysis_type = resolved_type
        analysis_type_enum = AnalysisType(resolved_type)

        # Use optimized configuration based on analysis type
        if resolved_type == "deep":
            engine.config = AnalysisConfig.for_deep_analysis()
        else:
            engine.config = AnalysisConfig(
                analysis_type=analysis_type_enum,
                depth=request.depth,
                skill_level=request.skill_level
            )

        # Ensure we use the provider_game_id for analysis to match foreign key constraint
        # The game_id in game_analyses must match provider_game_id in games table
        analysis_game_id = game_id  # This should be the provider_game_id

        # Analyze game
        print(f"[SINGLE GAME ANALYSIS] Starting engine analysis for game_id: {analysis_game_id}")
        game_analysis = await engine.analyze_game(
            pgn_data,
            canonical_user_id,  # Use canonicalized user ID
            request.platform,
            analysis_type_enum,
            analysis_game_id
        )

        if game_analysis:
            # Validate foreign key constraint before saving
            print(f"[SINGLE GAME ANALYSIS] Validating foreign key constraint before saving...")
            try:
                fk_validation = db_client.table('games').select('id').eq(
                    'provider_game_id', analysis_game_id
                ).eq('user_id', canonical_user_id).eq('platform', request.platform).maybe_single().execute()
            except Exception as fk_error:
                print(f"[SINGLE GAME ANALYSIS] ERROR Error during FK validation: {fk_error}")
                fk_validation = None

            if not fk_validation or not hasattr(fk_validation, 'data') or not fk_validation.data:
                print(f"[SINGLE GAME ANALYSIS] ERROR CRITICAL: Foreign key validation failed - game not found in games table!")
                print(f"[SINGLE GAME ANALYSIS] Attempting to create missing game record...")

                # Try to create the game record again with more robust error handling
                try:
                    # Parse PGN to extract basic game info
                    import chess.pgn
                    import io
                    pgn_io = io.StringIO(pgn_data)
                    game = chess.pgn.read_game(pgn_io)

                    if game and game.headers:
                        headers = game.headers
                        from datetime import datetime
                        now_iso = datetime.utcnow().isoformat()

                        # Extract basic info from PGN headers
                        result = headers.get('Result', '0-1')
                        white_player = headers.get('White', '')
                        black_player = headers.get('Black', '')
                        user_is_white = white_player.lower() == request.user_id.lower()

                        # Determine color and result from user's perspective
                        if user_is_white:
                            color = 'white'
                            if result == '1-0':
                                user_result = 'win'
                            elif result == '0-1':
                                user_result = 'loss'
                            else:
                                user_result = 'draw'
                        else:
                            color = 'black'
                            if result == '0-1':
                                user_result = 'win'
                            elif result == '1-0':
                                user_result = 'loss'
                            else:
                                user_result = 'draw'

                        # Count moves
                        move_count = sum(1 for _ in game.mainline_moves())

                        opening_value = headers.get('Opening', 'Unknown')
                        # Normalize opening name to family for consistent filtering
                        opening_normalized = normalize_opening_name(opening_value)

                        game_record = {
                            "user_id": canonical_user_id,
                            "platform": request.platform,
                            "provider_game_id": analysis_game_id,
                            "result": user_result,
                            "color": color,
                            "time_control": headers.get('TimeControl', 'unknown'),
                            "opening": opening_value,
                            "opening_family": opening_value,
                            "opening_normalized": opening_normalized,
                            "opponent_rating": None,
                            "my_rating": None,
                            "total_moves": move_count,
                            "played_at": headers.get('Date', now_iso),
                            "opponent_name": black_player if user_is_white else white_player,
                            "created_at": now_iso,
                        }

                        # Force insert the game record
                        games_response = db_client.table('games').upsert(
                            game_record,
                            on_conflict='user_id,platform,provider_game_id'
                        ).execute()

                        if games_response.data:
                            print(f"[SINGLE GAME ANALYSIS] SUCCESS Successfully created/updated game record: {analysis_game_id}")

                            # Re-validate foreign key constraint
                            fk_validation = db_client.table('games').select('id').eq(
                                'provider_game_id', analysis_game_id
                            ).eq('user_id', canonical_user_id).eq('platform', request.platform).maybe_single().execute()

                            if fk_validation and hasattr(fk_validation, 'data') and fk_validation.data:
                                print(f"[SINGLE GAME ANALYSIS] SUCCESS Foreign key validation passed after creating game record")
                            else:
                                print(f"[SINGLE GAME ANALYSIS] ERROR Foreign key validation still failed after creating game record")
                                return UnifiedAnalysisResponse(
                                    success=False,
                                    message=f"Failed to create valid game record for analysis save"
                                )
                        else:
                            print(f"[SINGLE GAME ANALYSIS] ERROR Failed to create game record - no data returned")
                            return UnifiedAnalysisResponse(
                                success=False,
                                message=f"Failed to create game record for analysis save"
                            )
                    else:
                        print(f"[SINGLE GAME ANALYSIS] ERROR Failed to parse PGN for game record creation")
                        return UnifiedAnalysisResponse(
                            success=False,
                            message=f"Failed to parse PGN for game record creation"
                        )

                except Exception as create_error:
                    print(f"[SINGLE GAME ANALYSIS] ERROR Failed to create game record: {create_error}")
                    return UnifiedAnalysisResponse(
                        success=False,
                        message=f"Failed to create game record: {str(create_error)}"
                    )
            else:
                print(f"[SINGLE GAME ANALYSIS] SUCCESS Foreign key validation passed - game exists in games table")

            # Save to database with comprehensive error handling
            try:
                success = await _save_stockfish_analysis(game_analysis)
                if success:
                    print(f"[SINGLE GAME ANALYSIS] SUCCESS Analysis completed and saved for game_id: {analysis_game_id}")
                    print(f"[SINGLE GAME ANALYSIS] This was a SINGLE game analysis - NOT starting batch analysis")
                    return UnifiedAnalysisResponse(
                        success=True,
                        message="Game analysis completed and saved",
                        analysis_id=game_analysis.game_id,
                        data={"game_id": game_analysis.game_id}
                    )
                else:
                    print(f"[SINGLE GAME ANALYSIS] ERROR Analysis completed but failed to save to database")
                    return UnifiedAnalysisResponse(
                        success=False,
                        message="Game analysis completed but failed to save to database"
                    )
            except Exception as save_error:
                print(f"[SINGLE GAME ANALYSIS] ERROR CRITICAL ERROR during save: {save_error}")
                return UnifiedAnalysisResponse(
                    success=False,
                    message=f"Critical error during analysis save: {str(save_error)}"
                )
        else:
            return UnifiedAnalysisResponse(
                success=False,
                message="Failed to analyze game"
            )
    except Exception as e:
        print(f"[SINGLE GAME ANALYSIS] ERROR CRITICAL ERROR in _handle_single_game_by_id: {e}")
        print(f"[SINGLE GAME ANALYSIS] Error type: {type(e).__name__}")
        print(f"[SINGLE GAME ANALYSIS] Error details: {str(e)}")

        # Return a structured error response instead of raising HTTPException
        return UnifiedAnalysisResponse(
            success=False,
            message=f"Critical error in single game analysis: {str(e)}",
            error_type=type(e).__name__
        )

async def _handle_position_analysis(request: UnifiedAnalysisRequest) -> UnifiedAnalysisResponse:
    """Handle position analysis."""
    try:
        engine = get_analysis_engine()

        # Configure analysis type
        resolved_type = _normalize_analysis_type(request.analysis_type, quiet=True)
        analysis_type_enum = AnalysisType(resolved_type)
        if resolved_type == "deep":
            engine.config = AnalysisConfig.for_deep_analysis()
        else:
            engine.config = AnalysisConfig(
                analysis_type=analysis_type_enum,
                depth=request.depth
            )

        result = await engine.analyze_position(request.fen, analysis_type_enum)

        return UnifiedAnalysisResponse(
            success=True,
            message="Position analysis completed",
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _handle_move_analysis(request: UnifiedAnalysisRequest) -> UnifiedAnalysisResponse:
    """Handle move analysis."""
    try:
        import chess

        engine = get_analysis_engine()

        # Configure analysis type with optimized settings
        resolved_type = _normalize_analysis_type(request.analysis_type, quiet=True)
        analysis_type_enum = AnalysisType(resolved_type)

        # Use optimized configuration based on analysis type
        if resolved_type == "deep":
            engine.config = AnalysisConfig.for_deep_analysis()
        else:
            engine.config = AnalysisConfig(
                analysis_type=analysis_type_enum,
                depth=request.depth,
                skill_level=request.skill_level
            )

        # Parse position and move
        board = chess.Board(request.fen)
        move = chess.Move.from_uci(request.move)

        result = await engine.analyze_move(board, move, analysis_type_enum)

        return UnifiedAnalysisResponse(
            success=True,
            message="Move analysis completed",
            data=result.__dict__
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _handle_batch_analysis(request: UnifiedAnalysisRequest, background_tasks: BackgroundTasks, use_parallel: bool = True) -> UnifiedAnalysisResponse:
    """Handle batch analysis using the queue system."""
    try:
        # Validate request parameters
        if not request.user_id or not request.platform:
            raise ValidationError("User ID and platform are required for batch analysis", "user_id")

        # Canonicalize user ID
        canonical_user_id = _canonical_user_id(request.user_id, request.platform)

        # Import the queue system
        from .analysis_queue import get_analysis_queue

        # Submit job to queue
        queue = get_analysis_queue()
        job_id = await queue.submit_job(
            user_id=canonical_user_id,
            platform=request.platform,
            analysis_type=request.analysis_type,
            limit=request.limit or 5,
            depth=request.depth or 14,
            skill_level=request.skill_level or 20
        )

        return UnifiedAnalysisResponse(
            success=True,
            message="Analysis job submitted to queue",
            analysis_id=job_id,
            data={
                "job_id": job_id,
                "user_id": canonical_user_id,
                "platform": request.platform,
                "analysis_type": request.analysis_type,
                "limit": request.limit or 5,
                "status": "queued"
            }
        )
    except Exception as e:
        raise AnalysisError(f"Failed to start batch analysis: {str(e)}", "batch")
def _validate_game_chronological_order(games: list, context: str) -> None:
    """
    CRITICAL VALIDATION: Ensure games are in correct chronological order (most recent first).

    This function prevents regression of the game selection bug where random games
    were selected instead of the most recent ones.

    Args:
        games: List of games with 'played_at' field
        context: Context string for error messages (e.g., "parallel analysis")

    Raises:
        ValueError: If games are not in chronological order
        TypeError: If games is not a list
    """
    # Input validation
    if not isinstance(games, list):
        raise TypeError(f"Games must be a list, got {type(games)}")

    if not games or len(games) < 2:
        print(f"[VALIDATION] Skipping validation for {context}: insufficient games ({len(games) if games else 0})")
        return

    played_dates = []
    for i, game in enumerate(games):
        if not isinstance(game, dict):
            print(f"[WARNING] Skipping non-dict game at index {i} in {context}")
            continue

        played_at = game.get('played_at')
        if played_at:
            try:
                # Handle both string and datetime objects
                if isinstance(played_at, str):
                    from datetime import datetime
                    # Try to parse the string to validate it's a proper datetime
                    datetime.fromisoformat(played_at.replace('Z', '+00:00'))
                played_dates.append((i, played_at, game.get('provider_game_id', 'unknown')))
            except (ValueError, TypeError) as e:
                print(f"[WARNING] Skipping game at index {i} in {context}: invalid played_at '{played_at}' ({e})")
                continue

    if len(played_dates) < 2:
        print(f"[VALIDATION] Skipping validation for {context}: insufficient valid games with played_at ({len(played_dates)})")
        return

    # Check if games are in descending order (most recent first)
    for i in range(len(played_dates) - 1):
        try:
            current_date = played_dates[i][1]
            next_date = played_dates[i + 1][1]

            # Convert to comparable format if needed
            if isinstance(current_date, str) and isinstance(next_date, str):
                current_parsed = current_date.replace('Z', '+00:00')
                next_parsed = next_date.replace('Z', '+00:00')
            else:
                current_parsed = current_date
                next_parsed = next_date

            if current_parsed < next_parsed:
                error_msg = (
                    f"CRITICAL BUG DETECTED in {context}: Games are NOT in chronological order!\n"
                    f"Game {played_dates[i][2]} (index {played_dates[i][0]}) played at {current_date}\n"
                    f"Game {played_dates[i+1][2]} (index {played_dates[i+1][0]}) played at {next_date}\n"
                    f"This indicates the game selection logic has been broken. "
                    f"Games must be ordered by played_at DESC (most recent first).\n"
                    f"Total games checked: {len(played_dates)}"
                )
                print(f"[ERROR] {error_msg}")
                raise ValueError(error_msg)
        except Exception as e:
            print(f"[ERROR] Failed to compare dates in {context}: {e}")
            print(f"[ERROR] Current date: {played_dates[i][1]} (type: {type(played_dates[i][1])})")
            print(f"[ERROR] Next date: {played_dates[i+1][1]} (type: {type(played_dates[i+1][1])})")
            raise

    print(f"[VALIDATION] SUCCESS Games in {context} are correctly ordered chronologically (most recent first) - {len(played_dates)} games validated")
async def _filter_unanalyzed_games(all_games: list, user_id: str, platform: str, analysis_type: str, limit: int) -> list:
    """
    Filter out games that are already analyzed, returning only unanalyzed games up to the limit.

    Args:
        all_games: List of all games from games_pgn table
        user_id: Canonical user ID
        platform: Platform (lichess or chess.com)
        analysis_type: Type of analysis (stockfish, deep)
        limit: Maximum number of unanalyzed games to return

    Returns:
        List of unanalyzed games to analyze
    """
    if not all_games or not supabase:
        return all_games[:limit] if all_games else []

    # Get game IDs that are already analyzed
    # Note: games list has 'provider_game_id', but analysis tables use 'game_id' (same value, different field name)
    game_ids = [game.get('provider_game_id') for game in all_games if game.get('provider_game_id')]

    if not game_ids:
        return all_games[:limit]

    # Check both move_analyses and game_analyses tables for already analyzed games
    analyzed_game_ids = set()

    try:
        # Check move_analyses table - filter by analysis_method (stockfish/deep)
        move_analyses_response = supabase.table('move_analyses').select('game_id').eq('user_id', user_id).eq('platform', platform).eq('analysis_method', analysis_type).in_('game_id', game_ids).execute()
        if move_analyses_response.data:
            analyzed_game_ids.update(row['game_id'] for row in move_analyses_response.data)

        # Check game_analyses table - filter by analysis_type (stockfish/deep)
        game_analyses_response = supabase.table('game_analyses').select('game_id').eq('user_id', user_id).eq('platform', platform).eq('analysis_type', analysis_type).in_('game_id', game_ids).execute()
        if game_analyses_response.data:
            analyzed_game_ids.update(row['game_id'] for row in game_analyses_response.data)

    except Exception as e:
        print(f"[warn] Could not check analyzed games: {e}")
        # If we can't check, assume no games are analyzed to be safe
        analyzed_game_ids = set()

    # Filter out already analyzed games
    unanalyzed_games = []
    analyzed_count = 0
    for game in all_games:
        game_id = game.get('provider_game_id')
        if game_id:
            if game_id in analyzed_game_ids:
                analyzed_count += 1
            else:
                unanalyzed_games.append(game)
                if len(unanalyzed_games) >= limit:
                    break

    print(f"[info] Found {len(unanalyzed_games)} unanalyzed games out of {len(all_games)} total games")
    print(f"[info] Skipped {analyzed_count} already-analyzed games")
    return unanalyzed_games
async def _save_stockfish_analysis(analysis: GameAnalysis) -> bool:
    """Persist Stockfish/deep analysis using reliable persistence fallback."""
    try:
        canonical_user_id = _canonical_user_id(analysis.user_id, analysis.platform)

        if persistence:
            result = await persistence.save_analysis_with_retry(analysis)
            if result.success:
                # Invalidate cache for this user/platform to ensure fresh stats
                _invalidate_cache(canonical_user_id, analysis.platform)
                if DEBUG:
                    print(f"[CACHE] Invalidated cache for {canonical_user_id}:{analysis.platform} after successful analysis save")
            return result.success

        moves_analysis_dict = []
        for move in analysis.moves_analysis:
            moves_analysis_dict.append({
                'move': move.move,
                'move_san': move.move_san,
                'move_notation': move.move,  # Legacy field
                'best_move': move.best_move,  # UCI notation
                'best_move_san': getattr(move, 'best_move_san', ''),  # SAN notation
                'engine_move': move.best_move,  # Legacy field
                'fen_before': getattr(move, 'fen_before', ''),  # FEN before move
                'fen_after': getattr(move, 'fen_after', ''),  # FEN after move
                'evaluation': move.evaluation,
                'evaluation_before': getattr(move, 'evaluation_before', None),
                'evaluation_after': getattr(move, 'evaluation_after', None),
                'is_best': move.is_best,
                'is_brilliant': move.is_brilliant,
                'is_great': move.is_great,
                'is_excellent': move.is_excellent,
                'is_blunder': move.is_blunder,
                'is_mistake': move.is_mistake,
                'is_inaccuracy': move.is_inaccuracy,
                'is_good': move.is_good,
                'is_acceptable': move.is_acceptable,
                'centipawn_loss': move.centipawn_loss,
                'depth_analyzed': move.depth_analyzed,
                'is_user_move': move.is_user_move,
                'player_color': move.player_color,
                'ply_index': move.ply_index,
                'ply': move.ply_index,  # Legacy field
                'opening_ply': move.ply_index,  # Legacy field
                'explanation': move.explanation,
                'heuristic_details': move.heuristic_details,
                'coaching_comment': move.coaching_comment,
                'what_went_right': move.what_went_right,
                'what_went_wrong': move.what_went_wrong,
                'how_to_improve': move.how_to_improve,
                'tactical_insights': move.tactical_insights,
                'positional_insights': move.positional_insights,
                'risks': move.risks,
                'benefits': move.benefits,
                'learning_points': move.learning_points,
                'encouragement_level': move.encouragement_level,
                'move_quality': move.move_quality,
                'game_phase': move.game_phase
            })

        data = {
            'game_id': analysis.game_id,
            'user_id': canonical_user_id,
            'platform': analysis.platform,
            'accuracy': analysis.accuracy,
            'opponent_accuracy': analysis.opponent_accuracy,
            'good_moves': analysis.good_moves,
            'acceptable_moves': analysis.acceptable_moves,
            'average_centipawn_loss': analysis.average_centipawn_loss,
            'opponent_average_centipawn_loss': analysis.opponent_average_centipawn_loss,
            'worst_blunder_centipawn_loss': analysis.worst_blunder_centipawn_loss,
            'opponent_worst_blunder_centipawn_loss': analysis.opponent_worst_blunder_centipawn_loss,
            'middle_game_accuracy': analysis.middle_game_accuracy,
            'endgame_accuracy': analysis.endgame_accuracy,
            'time_management_score': analysis.time_management_score,
            'opponent_time_management_score': analysis.opponent_time_management_score,
            'material_sacrifices': getattr(analysis, 'material_sacrifices', analysis.brilliant_moves),
            'aggressiveness_index': getattr(analysis, 'aggressiveness_index', analysis.aggressive_score),
            'average_evaluation': getattr(analysis, 'average_evaluation', 0.0),
            'tactical_score': analysis.tactical_score,
            'positional_score': analysis.positional_score,
            'aggressive_score': analysis.aggressive_score,
            'patient_score': analysis.patient_score,
            'novelty_score': analysis.novelty_score,
            'staleness_score': analysis.staleness_score,
            'tactical_patterns': analysis.tactical_patterns,
            'positional_patterns': analysis.positional_patterns,
            'strategic_themes': analysis.strategic_themes,
            'moves_analysis': moves_analysis_dict,
            'analysis_method': str(analysis.analysis_type),
            'analysis_date': analysis.analysis_date.isoformat(),
            'processing_time_ms': analysis.processing_time_ms,
            'stockfish_depth': analysis.stockfish_depth
        }

        response = supabase_service.table('move_analyses').upsert(
            data,
            on_conflict='user_id,platform,game_id,analysis_method'
        ).execute()

        success = bool(getattr(response, 'data', None))
        if success:
            # Invalidate cache for this user/platform to ensure fresh stats
            _invalidate_cache(canonical_user_id, analysis.platform)
            if DEBUG:
                print(f"[CACHE] Invalidated cache for {canonical_user_id}:{analysis.platform} after successful analysis save (fallback path)")
        return success

    except Exception as e:
        print(f"Error saving Stockfish analysis: {e}")
        return False


def _map_unified_analysis_to_response(analysis: dict) -> GameAnalysisSummary:
    """Map unified analysis data to response format."""
    return GameAnalysisSummary(
        game_id=analysis.get('game_id', ''),
        accuracy=analysis.get('accuracy', 0),
        blunders=analysis.get('blunders', 0),
        mistakes=analysis.get('mistakes', 0),
        inaccuracies=analysis.get('inaccuracies', 0),
        brilliant_moves=analysis.get('brilliant_moves', 0),
        best_moves=analysis.get('best_moves', 0),
        opening_accuracy=analysis.get('opening_accuracy', 0),
        middle_game_accuracy=analysis.get('middle_game_accuracy', 0),
        endgame_accuracy=analysis.get('endgame_accuracy', 0),
        tactical_score=analysis.get('tactical_score', 0),
        positional_score=analysis.get('positional_score', 0),
        aggressive_score=analysis.get('aggressive_score', 0),
        patient_score=analysis.get('patient_score', 0),
        novelty_score=analysis.get('novelty_score', 0),
        staleness_score=analysis.get('staleness_score', 0),
        analysis_type=analysis.get('analysis_type', 'unknown'),
        analysis_date=analysis.get('analysis_date', ''),
        processing_time_ms=analysis.get('processing_time_ms', 0)
    )
def _map_move_analysis_to_response(analysis: dict) -> GameAnalysisSummary:
    """Map move_analyses table data to response format."""
    moves_analysis = analysis.get('moves_analysis') or []
    blunders = analysis.get('blunders') or 0
    mistakes = analysis.get('mistakes') or 0
    inaccuracies = analysis.get('inaccuracies') or 0
    brilliant_moves = analysis.get('brilliant_moves') or 0
    best_moves = analysis.get('best_moves') or 0
    good_moves = analysis.get('good_moves') or 0
    acceptable_moves = analysis.get('acceptable_moves') or 0

    if isinstance(moves_analysis, list) and moves_analysis:
        count_blunders = sum(1 for move in moves_analysis if move.get('is_blunder'))
        count_mistakes = sum(1 for move in moves_analysis if move.get('is_mistake'))
        count_inaccuracies = sum(1 for move in moves_analysis if move.get('is_inaccuracy'))
        count_best_moves = sum(1 for move in moves_analysis if move.get('is_best'))
        count_brilliants = sum(1 for move in moves_analysis if move.get('is_brilliant'))
        count_good = sum(1 for move in moves_analysis if move.get('is_good'))
        count_acceptable = sum(1 for move in moves_analysis if move.get('is_acceptable'))

        blunders = blunders or count_blunders
        mistakes = mistakes or count_mistakes
        inaccuracies = inaccuracies or count_inaccuracies
        best_moves = best_moves or count_best_moves
        brilliant_moves = brilliant_moves or count_brilliants
        good_moves = good_moves or count_good
        acceptable_moves = acceptable_moves or count_acceptable

        # Use opening_ply <= 20 (10 full moves) to match Chess.com's typical opening phase
        opening_moves = [move for move in moves_analysis if move.get('opening_ply', 0) <= 20 and move.get('is_user_move', False)]
        if opening_moves:
            opening_accuracy = _calculate_opening_accuracy_chesscom(opening_moves)
        else:
            opening_accuracy = analysis.get('opening_accuracy', 0)
    else:
        opening_accuracy = analysis.get('opening_accuracy', 0)

    accuracy_value = analysis.get('accuracy')
    if accuracy_value is None:
        accuracy_value = analysis.get('best_move_percentage', 0)

    best_move_pct = analysis.get('best_move_percentage')
    if best_move_pct is None:
        if best_moves and isinstance(moves_analysis, list) and len(moves_analysis) > 0:
            best_move_pct = (best_moves / len(moves_analysis)) * 100
        else:
            best_move_pct = accuracy_value or 0

    return GameAnalysisSummary(
        game_id=analysis.get('game_id', ''),
        accuracy=accuracy_value or 0,
        best_move_percentage=best_move_pct,
        opponent_accuracy=analysis.get('opponent_accuracy', 0),
        blunders=blunders,
        mistakes=mistakes,
        inaccuracies=inaccuracies,
        brilliant_moves=brilliant_moves,
        best_moves=best_moves,
        good_moves=good_moves,
        acceptable_moves=acceptable_moves,
        opening_accuracy=opening_accuracy,
        middle_game_accuracy=analysis.get('middle_game_accuracy', 0),
        endgame_accuracy=analysis.get('endgame_accuracy', 0),
        average_centipawn_loss=analysis.get('average_centipawn_loss', 0),
        opponent_average_centipawn_loss=analysis.get('opponent_average_centipawn_loss', 0),
        worst_blunder_centipawn_loss=analysis.get('worst_blunder_centipawn_loss', 0),
        opponent_worst_blunder_centipawn_loss=analysis.get('opponent_worst_blunder_centipawn_loss', 0),
        time_management_score=analysis.get('time_management_score', 0),
        opponent_time_management_score=analysis.get('opponent_time_management_score', 0),
        material_sacrifices=analysis.get('material_sacrifices', analysis.get('brilliant_moves', 0)),
        aggressiveness_index=analysis.get('aggressiveness_index', analysis.get('aggressive_score', 0)),
        tactical_score=analysis.get('tactical_score', 0),
        positional_score=analysis.get('positional_score', 0),
        aggressive_score=analysis.get('aggressive_score', 0),
        patient_score=analysis.get('patient_score', 0),
        novelty_score=analysis.get('novelty_score', 0),
        staleness_score=analysis.get('staleness_score', 0),
        average_evaluation=analysis.get('average_evaluation', 0),
        analysis_type=str(analysis.get('analysis_method') or analysis.get('analysis_type') or 'stockfish'),
        analysis_date=str(analysis.get('analysis_date', '')),
        processing_time_ms=analysis.get('processing_time_ms', 0),
        stockfish_depth=analysis.get('stockfish_depth', 0)
    )

def _calculate_unified_stats(analyses: list, analysis_type: str) -> AnalysisStats:
    """Calculate unified statistics from analysis data."""
    if not analyses:
        return _get_empty_stats()

    total_games = len(analyses)

    if analysis_type in ["stockfish", "deep"]:
        # Calculate from move_analyses table data
        total_blunders = 0
        total_mistakes = 0
        total_inaccuracies = 0
        total_brilliant_moves = 0
        total_opening_accuracy = 0

        for analysis in analyses:
            moves_analysis = analysis.get('moves_analysis', [])
            if isinstance(moves_analysis, list):
                for move in moves_analysis:
                    # Only count user moves, not opponent moves
                    if move.get('is_user_move', False):
                        if move.get('is_blunder', False):
                            total_blunders += 1
                        if move.get('is_mistake', False):
                            total_mistakes += 1
                        if move.get('is_inaccuracy', False):
                            total_inaccuracies += 1
                        if move.get('is_brilliant', False):
                            total_brilliant_moves += 1

                # Calculate opening accuracy for this game (user moves only)
                opening_moves = [move for move in moves_analysis if move.get('opening_ply', 0) <= 20 and move.get('is_user_move', False)]
                if opening_moves:
                    # Use Chess.com win probability method for opening accuracy
                    opening_accuracy = _calculate_opening_accuracy_chesscom(opening_moves)
                    total_opening_accuracy += opening_accuracy

        return AnalysisStats(
            total_games_analyzed=total_games,
            average_accuracy=round(sum(a.get('best_move_percentage', a.get('accuracy', 0)) for a in analyses) / total_games, 1),
            total_blunders=total_blunders,
            total_mistakes=total_mistakes,
            total_inaccuracies=total_inaccuracies,
            total_brilliant_moves=total_brilliant_moves,
            total_material_sacrifices=sum(a.get('material_sacrifices', 0) for a in analyses),
            average_opening_accuracy=round(total_opening_accuracy / total_games, 1) if total_games > 0 else 0,
            average_middle_game_accuracy=round(sum(a.get('middle_game_accuracy', 0) for a in analyses) / total_games, 1),
            average_endgame_accuracy=round(sum(a.get('endgame_accuracy', 0) for a in analyses) / total_games, 1),
            average_aggressiveness_index=round(sum(a.get('aggressive_score', 0) for a in analyses) / total_games, 1),
            blunders_per_game=round(total_blunders / total_games, 2) if total_games > 0 else 0,
            mistakes_per_game=round(total_mistakes / total_games, 2) if total_games > 0 else 0,
            inaccuracies_per_game=round(total_inaccuracies / total_games, 2) if total_games > 0 else 0,
            brilliant_moves_per_game=round(total_brilliant_moves / total_games, 2) if total_games > 0 else 0,
            material_sacrifices_per_game=round(sum(a.get('material_sacrifices', 0) for a in analyses) / total_games, 2) if total_games > 0 else 0
        )
def _calculate_unified_analysis_stats(analyses: list) -> AnalysisStats:
    """Calculate statistics from unified_analyses view data."""
    if not analyses:
        return _get_empty_stats()

    total_games = len(analyses)

    # Helper function to safely get numeric values, handling None
    def safe_get_numeric(data, key, default=0):
        value = data.get(key)
        return value if value is not None else default

    # Sum up all the metrics from the unified_analyses view, handling None values
    total_blunders = sum(safe_get_numeric(a, 'blunders') for a in analyses)
    total_mistakes = sum(safe_get_numeric(a, 'mistakes') for a in analyses)
    total_inaccuracies = sum(safe_get_numeric(a, 'inaccuracies') for a in analyses)
    total_brilliant_moves = sum(safe_get_numeric(a, 'brilliant_moves') for a in analyses)
    total_material_sacrifices = sum(safe_get_numeric(a, 'material_sacrifices') for a in analyses)

    # Calculate averages, handling None values
    average_accuracy = round(sum(safe_get_numeric(a, 'accuracy') for a in analyses) / total_games, 1) if total_games > 0 else 0
    average_opening_accuracy = round(sum(safe_get_numeric(a, 'opening_accuracy') for a in analyses) / total_games, 1) if total_games > 0 else 0
    average_middle_game_accuracy = round(sum(safe_get_numeric(a, 'middle_game_accuracy') for a in analyses) / total_games, 1) if total_games > 0 else 0
    average_endgame_accuracy = round(sum(safe_get_numeric(a, 'endgame_accuracy') for a in analyses) / total_games, 1) if total_games > 0 else 0
    average_aggressiveness_index = round(sum(safe_get_numeric(a, 'aggressiveness_index') for a in analyses) / total_games, 1) if total_games > 0 else 0

    return AnalysisStats(
        total_games_analyzed=total_games,
        average_accuracy=average_accuracy,
        total_blunders=total_blunders,
        total_mistakes=total_mistakes,
        total_inaccuracies=total_inaccuracies,
        total_brilliant_moves=total_brilliant_moves,
        total_material_sacrifices=total_material_sacrifices,
        average_opening_accuracy=average_opening_accuracy,
        average_middle_game_accuracy=average_middle_game_accuracy,
        average_endgame_accuracy=average_endgame_accuracy,
        average_aggressiveness_index=average_aggressiveness_index,
        blunders_per_game=round(total_blunders / total_games, 2) if total_games > 0 else 0,
        mistakes_per_game=round(total_mistakes / total_games, 2) if total_games > 0 else 0,
        inaccuracies_per_game=round(total_inaccuracies / total_games, 2) if total_games > 0 else 0,
        brilliant_moves_per_game=round(total_brilliant_moves / total_games, 2) if total_games > 0 else 0,
        material_sacrifices_per_game=round(total_material_sacrifices / total_games, 2) if total_games > 0 else 0
    )

def _calculate_move_analysis_stats(analyses: list) -> AnalysisStats:
    """Calculate statistics from move_analyses table data."""
    if not analyses:
        return _get_empty_stats()

    total_games = len(analyses)
    total_blunders = 0
    total_mistakes = 0
    total_inaccuracies = 0
    total_brilliant_moves = 0
    total_opening_accuracy = 0

    for analysis in analyses:
        moves_analysis = analysis.get('moves_analysis', [])
        if isinstance(moves_analysis, list):
            for move in moves_analysis:
                # Only count user moves, not opponent moves
                if move.get('is_user_move', False):
                    if move.get('is_blunder', False):
                        total_blunders += 1
                    if move.get('is_mistake', False):
                        total_mistakes += 1
                    if move.get('is_inaccuracy', False):
                        total_inaccuracies += 1
                    if move.get('is_brilliant', False):
                        total_brilliant_moves += 1

            # Calculate opening accuracy for this game (user moves only)
            opening_moves = [move for move in moves_analysis if move.get('opening_ply', 0) <= 20 and move.get('is_user_move', False)]
            if opening_moves:
                # Use Chess.com win probability method for opening accuracy
                opening_accuracy = _calculate_opening_accuracy_chesscom(opening_moves)
                total_opening_accuracy += opening_accuracy

    return AnalysisStats(
        total_games_analyzed=total_games,
        average_accuracy=round(sum(a.get('best_move_percentage', a.get('accuracy', 0)) for a in analyses) / total_games, 1),
        total_blunders=total_blunders,
        total_mistakes=total_mistakes,
        total_inaccuracies=total_inaccuracies,
        total_brilliant_moves=total_brilliant_moves,
        total_material_sacrifices=sum(a.get('material_sacrifices', 0) for a in analyses),
        average_opening_accuracy=round(total_opening_accuracy / total_games, 1) if total_games > 0 else 0,
        average_middle_game_accuracy=round(sum(a.get('middle_game_accuracy', 0) for a in analyses) / total_games, 1),
        average_endgame_accuracy=round(sum(a.get('endgame_accuracy', 0) for a in analyses) / total_games, 1),
        average_aggressiveness_index=round(sum(a.get('aggressive_score', 0) for a in analyses) / total_games, 1),
        blunders_per_game=round(total_blunders / total_games, 2) if total_games > 0 else 0,
        mistakes_per_game=round(total_mistakes / total_games, 2) if total_games > 0 else 0,
        inaccuracies_per_game=round(total_inaccuracies / total_games, 2) if total_games > 0 else 0,
        brilliant_moves_per_game=round(total_brilliant_moves / total_games, 2) if total_games > 0 else 0,
        material_sacrifices_per_game=round(sum(a.get('material_sacrifices', 0) for a in analyses) / total_games, 2) if total_games > 0 else 0
    )

def _get_empty_stats() -> AnalysisStats:
    """Return empty stats for when no data is available."""
    return AnalysisStats(
        total_games_analyzed=0,
        average_accuracy=0,
        total_blunders=0,
        total_mistakes=0,
        total_inaccuracies=0,
        total_brilliant_moves=0,
        total_material_sacrifices=0,
        average_opening_accuracy=0,
        average_middle_game_accuracy=0,
        average_endgame_accuracy=0,
        average_aggressiveness_index=0,
        blunders_per_game=0,
        mistakes_per_game=0,
        inaccuracies_per_game=0,
        brilliant_moves_per_game=0,
        material_sacrifices_per_game=0
    )

def _get_mock_stats() -> AnalysisStats:
    """Return mock stats for development when database is not available."""
    return AnalysisStats(
        total_games_analyzed=15,
        average_accuracy=78.5,
        total_blunders=3,
        total_mistakes=8,
        total_inaccuracies=12,
        total_brilliant_moves=2,
        total_material_sacrifices=1,
        average_opening_accuracy=82.3,
        average_middle_game_accuracy=76.8,
        average_endgame_accuracy=79.2,
        average_aggressiveness_index=65.4,
        blunders_per_game=0.2,
        mistakes_per_game=0.53,
        inaccuracies_per_game=0.8,
        brilliant_moves_per_game=0.13,
        material_sacrifices_per_game=0.07
    )

def _get_mock_analysis_results() -> List[GameAnalysisSummary]:
    """Return mock analysis results for development when database is not available."""
    from datetime import datetime, timedelta

    mock_results = []
    base_date = datetime.now()

    for i in range(5):  # Return 5 mock games
        game_date = base_date - timedelta(days=i)
        mock_results.append(GameAnalysisSummary(
            game_id=f"mock_game_{i+1}",
            accuracy=75.0 + (i * 2.5),
            best_move_percentage=70.0 + (i * 2.5),
            opponent_accuracy=55.0 - (i * 1.5),
            blunders=max(0, 2 - i),
            mistakes=3 + i,
            inaccuracies=5 + i,
            brilliant_moves=1 if i % 2 == 0 else 0,
            best_moves=20 + (i * 3),
            good_moves=15 + (i * 2),
            acceptable_moves=12 + i,
            opening_accuracy=80.0 + (i * 1.5),
            middle_game_accuracy=70.0 + (i * 2.0),
            endgame_accuracy=75.0 + (i * 1.0),
            average_centipawn_loss=35.0 - (i * 1.5),
            opponent_average_centipawn_loss=45.0 + (i * 2.0),
            worst_blunder_centipawn_loss=120.0 - (i * 10.0),
            opponent_worst_blunder_centipawn_loss=150.0 + (i * 5.0),
            time_management_score=82.0 - (i * 1.2),
            opponent_time_management_score=65.0 + (i * 1.4),
            material_sacrifices=i % 3,
            aggressiveness_index=60.0 + (i * 3.5),
            tactical_score=65.0 + (i * 3.0),
            positional_score=70.0 + (i * 2.5),
            aggressive_score=60.0 + (i * 4.0),
            patient_score=75.0 + (i * 1.5),
            novelty_score=68.0 + (i * 2.2),
            staleness_score=45.0 + (i * 1.5),
            average_evaluation=0.35 + (i * 0.05),
            analysis_type="stockfish",
            analysis_date=game_date.isoformat(),
            processing_time_ms=1500 + (i * 200),
            stockfish_depth=14
        ))

    return mock_results

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Unified Chess Analysis API Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8002, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")

    args = parser.parse_args()

    print(f"Starting Unified Chess Analysis API Server v3.0 on {args.host}:{args.port}")
    print("This server provides a single, comprehensive API for all chess analysis operations!")
    print("Available analysis types: stockfish, deep")
    print("Unified endpoints:")
    print("  - POST /api/v1/analyze (handles all analysis types)")
    print("  - GET /api/v1/results/{user_id}/{platform}")
    print("  - GET /api/v1/stats/{user_id}/{platform}")
    print("  - GET /api/v1/analyses/{user_id}/{platform}")
    print("  - GET /api/v1/progress/{user_id}/{platform}")
    print("  - GET /api/v1/deep-analysis/{user_id}/{platform}")

    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)
