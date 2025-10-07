#!/usr/bin/env python3
"""
Unified Chess Analysis API Server
A single, comprehensive API that consolidates all analysis functionality.
Replaces multiple redundant endpoints with a clean, unified interface.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Annotated, Union, Tuple
from collections import Counter
from decimal import Decimal
import uvicorn
import asyncio
import os
from datetime import datetime, timezone
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
    global_exception_handler
)

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
print(f"🔒 CORS Origins configured: {cors_origins}")

# Use production CORS config if we have custom origins, otherwise use default
if config.api.cors_origins:
    cors_config = CORSSecurityConfig(
        allowed_origins=cors_origins,
        allowed_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowed_headers=['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
        allow_credentials=True,
        max_age=3600
    )
    print(f"✅ Using production CORS configuration")
else:
    cors_config = get_default_cors_config()
    print(f"⚠️  Using default localhost CORS configuration")

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
    
    # Initialize reliable persistence system
    persistence = ReliableAnalysisPersistence(supabase, supabase_service)
    print("Reliable analysis persistence system initialized")
else:
    print("[warn]  Database configuration not found. Using mock clients for development.")
    # Create mock clients for development
    supabase = None
    supabase_service = None
    persistence = None

# Authentication setup
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")

# Authentication utilities
async def verify_token(credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]) -> dict:
    """Verify JWT token and return payload."""
    try:
        token = credentials.credentials
        payload = jose_jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
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
    auth_enabled = os.getenv("AUTH_ENABLED", "false").lower() == "true"
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
ANALYSIS_TEST_LIMIT = int(os.getenv("ANALYSIS_TEST_LIMIT", "10"))

# ============================================================================
# UNIFIED PYDANTIC MODELS
# ============================================================================

class UnifiedAnalysisRequest(BaseModel):
    """Unified request model for all analysis types."""
    user_id: str = Field(..., description="User ID to analyze games for")
    platform: str = Field(..., description="Platform (lichess, chess.com, etc.)")
    analysis_type: str = Field("stockfish", description="Type of analysis: stockfish or deep")
    limit: Optional[int] = Field(10, description="Maximum number of games to analyze")
    depth: Optional[int] = Field(8, description="Analysis depth for Stockfish")
    skill_level: Optional[int] = Field(8, description="Stockfish skill level (0-20)")
    
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

@app.post("/api/v1/analyze", response_model=UnifiedAnalysisResponse)
async def unified_analyze(
    request: UnifiedAnalysisRequest,
    background_tasks: BackgroundTasks,
    # Optional parallel analysis flag
    use_parallel: bool = True
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
            # Batch analysis - temporarily bypass queue system for debugging
            if use_parallel:
                # Canonicalize user ID for database operations
                canonical_user_id = _canonical_user_id(request.user_id, request.platform)
                
                # Use the old parallel batch analysis directly
                background_tasks.add_task(
                    _perform_batch_analysis,
                    canonical_user_id,
                    request.platform,
                    request.analysis_type,
                    request.limit or 10,
                    request.depth or 8,
                    request.skill_level or 8
                )
                
                return UnifiedAnalysisResponse(
                    success=True,
                    message="Analysis started in background",
                    analysis_id="direct_analysis",
                    data={
                        "job_id": "direct_analysis",
                        "user_id": canonical_user_id,
                        "platform": request.platform,
                        "analysis_type": request.analysis_type,
                        "limit": request.limit or 10,
                        "status": "running"
                    }
                )
            else:
                return await _handle_batch_analysis(request, background_tasks, use_parallel)
            
    except ValidationError as e:
        raise e
    except Exception as e:
        raise AnalysisError(f"Failed to process analysis request: {str(e)}", "unified")

@app.get("/api/v1/results/{user_id}/{platform}", response_model=List[GameAnalysisSummary])
async def get_analysis_results(
    user_id: str,
    platform: str,
    limit: int = Query(10, ge=1, le=100),
    analysis_type: str = Query("stockfish"),
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get analysis results for a user."""
    try:
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)
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
        print(f"[DEBUG] get_analysis_stats called with user_id={user_id}, platform={platform}, analysis_type={analysis_type}")
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)
        print(f"[DEBUG] canonical_user_id={canonical_user_id}")
        
        if not supabase and not supabase_service:
            print("[warn]  Database not available. Returning empty stats.")
            return _get_empty_stats()
            
        # Query unified_analyses table for analysis statistics
        if supabase:
            response = supabase.table('unified_analyses').select('*').eq(
                'user_id', canonical_user_id
            ).eq('platform', platform).execute()
            print(f"[DEBUG] Stats query response: {len(response.data) if response.data else 0} records found")
        else:
            response = type('MockResponse', (), {'data': []})()
        
        if not response.data or len(response.data) == 0:
            # Return mock data for development when no real data is available
            print(f"[stats] No data found for user {canonical_user_id} on {platform}, returning mock stats for development")
            print(f"[stats] Query was: unified_analyses where user_id={canonical_user_id} AND platform={platform}")
            return _get_mock_stats()
        
        print(f"[DEBUG] Calculating stats for {len(response.data)} analyses")
        return _calculate_unified_analysis_stats(response.data)
    except Exception as e:
        print(f"Error fetching analysis stats: {e}")
        return _get_empty_stats()

@app.get("/api/v1/analyses/{user_id}/{platform}")
async def get_game_analyses(
    user_id: str,
    platform: str,
    analysis_type: str = Query("stockfish"),
    # Optional authentication
    _: Optional[bool] = get_optional_auth()
):
    """Get individual game analyses for a user."""
    try:
        print(f"[DEBUG] get_game_analyses called with user_id={user_id}, platform={platform}, analysis_type={analysis_type}")
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)
        print(f"[DEBUG] canonical_user_id={canonical_user_id}")
        
        if not supabase and not supabase_service:
            print("[ERROR] No database connection available")
            return []
        
        # Query the unified_analyses view for individual game data
        response = supabase.table("unified_analyses").select("*").eq("user_id", canonical_user_id).eq("platform", platform).execute()
        
        print(f"[DEBUG] Query response: {len(response.data) if response.data else 0} records found")
        
        if not response.data or len(response.data) == 0:
            print(f"[analyses] No data found for user {canonical_user_id} on {platform}")
            return []
        
        # Return the raw game data with moves_analysis
        return response.data
        
    except Exception as e:
        print(f"Error fetching game analyses: {e}")
        return []

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
    """Debug endpoint to check current progress state."""
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
        possible_keys = [
            progress_key,  # canonical_user_id_platform
            f"{user_id.lower().strip()}_{platform_key}",  # original_user_id_platform
            f"{user_id}_{platform_key}",  # original_user_id_platform (no lower)
        ]
        
        print(f"[PROGRESS REQUEST] Trying keys: {possible_keys}")
        for key in possible_keys:
            if key in analysis_progress:
                progress_data = analysis_progress[key]
                print(f"[PROGRESS REQUEST] Found progress with key: {key}")
                print(f"[PROGRESS REQUEST] Progress data: {progress_data}")
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
        
        return {
            "highest_elo": highest_game['my_rating'],
            "time_control": highest_game['time_control'],
            "game_id": highest_game['provider_game_id'],
            "played_at": highest_game['played_at'],
            "total_games": total_games
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching ELO stats: {e}")
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
        canonical_user_id = _canonical_user_id(user_id, platform)
        db_client = supabase_service or supabase
        if not db_client:
            raise HTTPException(status_code=503, detail="Database not configured for deep analysis")

        # Optimized query: get games with ELO data efficiently
        # ELO data is available immediately after import - no analysis required!
        games_response = db_client.table('games').select(
            'provider_game_id, result, opening, opening_family, time_control, my_rating, played_at'
        ).eq('user_id', canonical_user_id).eq('platform', platform).not_.is_(
            'my_rating', 'null'
        ).order('my_rating', desc=True).execute()
        games = games_response.data or []

        profile_response = db_client.table('user_profiles').select('current_rating').eq(
            'user_id', canonical_user_id
        ).eq('platform', platform).maybe_single().execute()
        profile = getattr(profile_response, 'data', None) or {}

        analyses_response = db_client.table('move_analyses').select('*').eq(
            'user_id', canonical_user_id
        ).eq('platform', platform).order('analysis_date', desc=True).execute()
        analyses = analyses_response.data or []

        if not analyses:
            return _build_fallback_deep_analysis(canonical_user_id, games, profile)

        return _build_deep_analysis_response(canonical_user_id, games, analyses, profile)
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
    best = 0
    total = 0
    for analysis in analyses:
        moves = analysis.get('moves_analysis') or []
        for idx, move in enumerate(moves):
            if idx >= 30:
                break
            total += 1
            if move.get('is_best'):
                best += 1
    return (best / total * 100.0) if total else 0.0


def _estimate_novelty_from_games(games: List[Dict[str, Any]]) -> float:
    if not games:
        return 50.0
    unique_openings = len({
        (game.get('opening_family') or game.get('opening') or 'Unknown')
        for game in games
    })
    time_controls = len({game.get('time_control') or 'Unknown' for game in games})
    variety_score = unique_openings * 12.0 + time_controls * 5.0
    return max(0.0, min(100.0, variety_score))


def _estimate_staleness_from_games(games: List[Dict[str, Any]]) -> float:
    """Estimate staleness from game-level patterns - opening repetition, time control consistency."""
    if not games:
        return 30.0
    
    total = len(games)
    if total < 2:
        return 30.0  # Need at least 2 games to measure staleness
    
    # Count opening families and time controls
    opening_counts = Counter(
        (game.get('opening_family') or game.get('opening') or 'Unknown')
        for game in games
    )
    time_counts = Counter(
        (game.get('time_control') or 'Unknown')
        for game in games
    )
    
    # Calculate repetition ratios
    most_common_opening_count = max(opening_counts.values()) if opening_counts else 0
    most_common_time_count = max(time_counts.values()) if time_counts else 0
    
    opening_repetition = most_common_opening_count / total
    time_repetition = most_common_time_count / total
    
    # Calculate diversity metrics
    opening_diversity = len(opening_counts) / total  # More openings = less staleness
    time_diversity = len(time_counts) / total  # More time controls = less staleness
    
    # Staleness score based on repetition patterns
    # Higher repetition = higher staleness
    opening_staleness = opening_repetition * 60.0  # 0-60 points for opening repetition
    time_staleness = time_repetition * 20.0  # 0-20 points for time control repetition
    
    # Bonus for very low diversity (playing same opening/time repeatedly)
    diversity_penalty = (opening_diversity + time_diversity) * 10.0  # 0-20 point penalty for diversity
    
    score = opening_staleness + time_staleness - diversity_penalty + 30.0  # Base of 30
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
                })
        
        if not moves:
            continue
            
        # Calculate scores for this analysis with skill level awareness
        time_score = _coerce_float(analysis.get('time_management_score')) or 0.0
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
        final_novelty = _round2(move_novelty * 0.6 + novelty_signal * 0.4)
        final_staleness = _round2(move_staleness * 0.6 + staleness_signal * 0.4)
        
        # Ensure staleness and novelty are properly opposed
        # Staleness should be roughly inverse of novelty, but not too extreme
        target_staleness = 100.0 - final_novelty
        # Use a gentler opposition - only 30% opposition, 70% calculated
        final_staleness = _round2(final_staleness * 0.7 + target_staleness * 0.3)
        
        aggregated_scores.novelty = final_novelty
        aggregated_scores.staleness = final_staleness
    
    return aggregated_scores.to_dict()

def _compute_phase_accuracies(analyses: List[Dict[str, Any]]) -> Dict[str, float]:
    opening = _round2(_compute_opening_accuracy_from_moves(analyses))
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
        return 'intermediate'
    
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


def _summarize_strengths_and_gaps(personality_scores: Dict[str, float]):
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
    """Generate detailed AI-powered style analysis with rich insights."""
    
    # Get the dominant trait and its score
    ranked_traits = sorted(
        ((key, personality_scores.get(key, 0.0)) for key in ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']),
        key=lambda item: item[1],
        reverse=True
    )
    
    dominant_trait, dominant_score = ranked_traits[0]
    second_trait, second_score = ranked_traits[1] if len(ranked_traits) > 1 else (dominant_trait, dominant_score)
    lowest_trait, lowest_score = ranked_traits[-1]
    
    # Generate style summary
    style_summary = f"You are a {player_level} player with {total_games} games analyzed. "
    style_summary += f"Your dominant strength is {dominant_trait} play (score: {dominant_score:.0f}), "
    
    if dominant_score >= 70:
        style_summary += f"making you a {dominant_trait} specialist."
    elif dominant_score >= 60:
        style_summary += f"showing strong {dominant_trait} tendencies."
    else:
        style_summary += f"with a {player_style.get('category', 'balanced')} approach."
    
    # Generate characteristics based on personality scores
    characteristics = []
    if personality_scores.get('tactical', 0) >= 65:
        characteristics.append("brilliant tactical vision")
    if personality_scores.get('positional', 0) >= 65:
        characteristics.append("strategic depth and planning")
    if personality_scores.get('aggressive', 0) >= 65:
        characteristics.append("bold and initiative-seeking")
    if personality_scores.get('patient', 0) >= 65:
        characteristics.append("exceptional patience and discipline")
    if personality_scores.get('novelty', 0) >= 65:
        characteristics.append("creative and innovative thinking")
    if personality_scores.get('staleness', 0) >= 65:
        characteristics.append("consistent and methodical approach")
    
    # Add secondary characteristics
    if second_score >= 60 and second_trait != dominant_trait:
        trait_descriptions = {
            'tactical': 'sharp calculation abilities',
            'positional': 'strategic understanding',
            'aggressive': 'dynamic attacking style',
            'patient': 'solid defensive foundation',
            'novelty': 'unconventional ideas',
            'staleness': 'reliable consistency'
        }
        characteristics.append(trait_descriptions.get(second_trait, f"strong {second_trait} skills"))
    
    characteristics_text = ", ".join(characteristics) if characteristics else "well-rounded chess understanding"
    
    # Generate strengths based on highest scoring areas
    strengths = []
    if personality_scores.get('tactical', 0) >= 60:
        strengths.append("complex calculation abilities")
    if personality_scores.get('positional', 0) >= 60:
        strengths.append("long-term strategic planning")
    if personality_scores.get('aggressive', 0) >= 60:
        strengths.append("initiative and pressure creation")
    if personality_scores.get('patient', 0) >= 60:
        strengths.append("advantage consolidation")
    if personality_scores.get('novelty', 0) >= 60:
        strengths.append("unconventional ideas and surprise moves")
    if personality_scores.get('staleness', 0) >= 60:
        strengths.append("consistent, reliable play")
    
    # Add phase-specific strengths
    if phase_accuracies.get('opening', 0) >= 70:
        strengths.append("strong opening preparation")
    if phase_accuracies.get('middle', 0) >= 70:
        strengths.append("excellent middlegame play")
    if phase_accuracies.get('endgame', 0) >= 70:
        strengths.append("precise endgame technique")
    
    strengths_text = ", ".join(strengths) if strengths else "solid fundamental skills"
    
    # Generate playing patterns
    patterns = []
    if personality_scores.get('tactical', 0) >= 65:
        patterns.append("thrives in sharp, tactical positions")
    if personality_scores.get('positional', 0) >= 65:
        patterns.append("seeks long-term structural advantages")
    if personality_scores.get('aggressive', 0) >= 65:
        patterns.append("looks for attacking opportunities")
    if personality_scores.get('patient', 0) >= 65:
        patterns.append("methodical, unhurried approach")
    if personality_scores.get('novelty', 0) >= 65:
        patterns.append("avoids routine, seeks original solutions")
    if personality_scores.get('staleness', 0) >= 65:
        patterns.append("prefers familiar patterns and structures")
    
    # Add accuracy-based patterns
    if average_accuracy >= 75:
        patterns.append("maintains high accuracy under pressure")
    elif average_accuracy >= 65:
        patterns.append("generally accurate with occasional lapses")
    else:
        patterns.append("inconsistent accuracy requiring improvement")
    
    patterns_text = ", ".join(patterns) if patterns else "adaptable playing approach"
    
    # Generate improvement focus
    improvement_focus = f"Your lowest scoring area is {lowest_trait} ({lowest_score:.0f}), "
    
    if lowest_trait == 'tactical':
        improvement_focus += "which should be your primary focus for improvement. Work on calculation exercises and tactical puzzles."
    elif lowest_trait == 'positional':
        improvement_focus += "which should be your primary focus for improvement. Study strategic concepts and positional play."
    elif lowest_trait == 'aggressive':
        improvement_focus += "which should be your primary focus for improvement. Practice creating and maintaining initiative."
    elif lowest_trait == 'patient':
        improvement_focus += "which should be your primary focus for improvement. Work on discipline and avoiding premature moves."
    elif lowest_trait == 'novelty':
        improvement_focus += "which should be your primary focus for improvement. Explore new ideas and creative solutions."
    elif lowest_trait == 'staleness':
        improvement_focus += "which should be your primary focus for improvement. Vary your play and avoid repetitive patterns."
    else:
        improvement_focus += "which should be your primary focus for improvement."
    
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
    famous_players = [
        {
            'name': 'Mikhail Tal',
            'description': 'The "Magician from Riga" - known for his brilliant tactical combinations and sacrifices',
            'era': '1950s-1990s',
            'strengths': ['Tactical vision', 'Sacrificial attacks', 'Complex calculations'],
            'profile': {'tactical': 85, 'aggressive': 90, 'positional': 55, 'patient': 45}
        },
        {
            'name': 'Garry Kasparov',
            'description': 'Aggressive tactical player who dominated with dynamic, attacking chess',
            'era': '1980s-2000s',
            'strengths': ['Initiative', 'Tactical precision', 'Pressure play'],
            'profile': {'tactical': 90, 'aggressive': 85, 'positional': 75, 'patient': 60}
        },
        {
            'name': 'Anatoly Karpov',
            'description': 'Master of positional chess and endgame technique',
            'era': '1970s-1990s',
            'strengths': ['Positional understanding', 'Endgame mastery', 'Prophylaxis'],
            'profile': {'tactical': 70, 'aggressive': 50, 'positional': 95, 'patient': 90}
        },
        {
            'name': 'Magnus Carlsen',
            'description': 'Universal player with exceptional endgame skills and practical play',
            'era': '2000s-present',
            'strengths': ['Universal style', 'Endgame mastery', 'Practical play'],
            'profile': {'tactical': 85, 'aggressive': 70, 'positional': 90, 'patient': 80}
        },
        {
            'name': 'Bobby Fischer',
            'description': 'Legendary American champion known for his fighting spirit and deep preparation',
            'era': '1960s-1970s',
            'strengths': ['Competitive spirit', 'Sharp tactics', 'Deep preparation'],
            'profile': {'tactical': 88, 'aggressive': 80, 'positional': 85, 'patient': 65}
        },
        {
            'name': 'Tigran Petrosian',
            'description': 'Master of prophylaxis and defensive play',
            'era': '1950s-1980s',
            'strengths': ['Defensive mastery', 'Prophylaxis', 'Safety'],
            'profile': {'tactical': 65, 'aggressive': 40, 'positional': 90, 'patient': 95}
        },
        {
            'name': 'José Raúl Capablanca',
            'description': 'Natural talent with exceptional endgame technique',
            'era': '1910s-1940s',
            'strengths': ['Technical precision', 'Endgame mastery', 'Natural talent'],
            'profile': {'tactical': 75, 'aggressive': 60, 'positional': 88, 'patient': 85}
        },
        {
            'name': 'Alexander Alekhine',
            'description': 'Attacking genius known for complex combinations',
            'era': '1920s-1940s',
            'strengths': ['Attacking play', 'Initiative', 'Dynamic positions'],
            'profile': {'tactical': 90, 'aggressive': 88, 'positional': 75, 'patient': 50}
        },
        {
            'name': 'Vladimir Kramnik',
            'description': 'Solid positional player with creative understanding',
            'era': '1990s-2010s',
            'strengths': ['Positional understanding', 'Endgame technique', 'Creative play'],
            'profile': {'tactical': 78, 'aggressive': 60, 'positional': 92, 'patient': 85}
        },
        {
            'name': 'Hikaru Nakamura',
            'description': 'Modern attacking player known for rapid chess and initiative',
            'era': '2000s-present',
            'strengths': ['Modern attacks', 'Initiative', 'Practical play'],
            'profile': {'tactical': 88, 'aggressive': 82, 'positional': 72, 'patient': 60}
        },
        {
            'name': 'Fabiano Caruana',
            'description': 'Universal player with deep opening preparation',
            'era': '2010s-present',
            'strengths': ['Universal style', 'Opening preparation', 'Technical precision'],
            'profile': {'tactical': 85, 'aggressive': 70, 'positional': 88, 'patient': 78}
        },
        {
            'name': 'Paul Morphy',
            'description': 'Tactical genius of the romantic era',
            'era': '1850s',
            'strengths': ['Tactical genius', 'Natural talent', 'Attacking play'],
            'profile': {'tactical': 95, 'aggressive': 92, 'positional': 65, 'patient': 40}
        },
    ]
    
    # Calculate similarity scores
    player_tactical = personality_scores.get('tactical', 50.0)
    player_aggressive = personality_scores.get('aggressive', 50.0)
    player_positional = personality_scores.get('positional', 50.0)
    player_patient = personality_scores.get('patient', 50.0)
    
    scored_players = []
    for famous in famous_players:
        profile = famous['profile']
        # Calculate Euclidean distance in personality space
        diff_tactical = (player_tactical - profile['tactical']) ** 2
        diff_aggressive = (player_aggressive - profile['aggressive']) ** 2
        diff_positional = (player_positional - profile['positional']) ** 2
        diff_patient = (player_patient - profile['patient']) ** 2
        
        distance = (diff_tactical + diff_aggressive + diff_positional + diff_patient) ** 0.5
        
        # Convert distance to similarity percentage (0-100)
        # Max distance would be ~141 (sqrt(100^2 * 4)), so normalize
        max_distance = 200  # theoretical max
        similarity = max(0, 100 - (distance / max_distance * 100))
        
        scored_players.append({
            'name': famous['name'],
            'description': famous['description'],
            'era': famous['era'],
            'strengths': famous['strengths'],
            'similarity_score': similarity
        })
    
    # Sort by similarity
    scored_players.sort(key=lambda x: x['similarity_score'], reverse=True)
    
    # Get top 2 matches
    primary = scored_players[0]
    secondary = scored_players[1] if len(scored_players) > 1 else scored_players[0]
    
    # Generate similarity text
    def get_similarity_text(player_name: str, player_scores: Dict[str, float]) -> str:
        top_trait = max(player_scores.items(), key=lambda x: x[1])[0]
        trait_label = PERSONALITY_LABELS.get(top_trait, 'balanced play')
        return f"Like {player_name}, you excel in {trait_label.lower()}"
    
    return {
        'primary': {
            'name': primary['name'],
            'description': primary['description'],
            'era': primary['era'],
            'strengths': primary['strengths'],
            'similarity': get_similarity_text(primary['name'], personality_scores)
        },
        'secondary': {
            'name': secondary['name'],
            'description': secondary['description'],
            'era': secondary['era'],
            'strengths': secondary['strengths'],
            'similarity': get_similarity_text(secondary['name'], personality_scores)
        }
    }


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
        ai_style_analysis=ai_style_analysis
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
# ============================================================================
# HELPER FUNCTIONS FOR GAME IMPORT
# ============================================================================

def _count_moves_in_pgn(pgn: str) -> int:
    """Count the number of moves in a PGN string"""
    if not pgn or not isinstance(pgn, str):
        return 0
    
    try:
        # Remove PGN headers (lines starting with [)
        lines = pgn.split('\n')
        game_lines = [line for line in lines if not line.strip().startswith('[')]
        
        # Join the remaining lines and extract the moves
        game_text = ' '.join(game_lines)
        
        # Remove result markers (1-0, 0-1, 1/2-1/2)
        import re
        clean_game_text = re.sub(r'\s+(1-0|0-1|1/2-1/2)\s*$', '', game_text)
        
        # Count move numbers and moves
        # Pattern matches: 1. e4 e5 2. Nf3 Nc6 etc.
        move_pattern = r'\d+\.\s+[^\s]+\s+[^\s]+'
        moves = re.findall(move_pattern, clean_game_text)
        
        if not moves:
            return 0
        
        # Each match represents one full move (white + black)
        # So total moves = number of matches * 2
        return len(moves) * 2
        
    except Exception as e:
        print(f"Error counting moves in PGN: {e}")
        return 0

def _extract_opponent_name_from_pgn(pgn: str, player_color: str) -> str:
    """Extract opponent name from PGN data based on player color"""
    if not pgn or not isinstance(pgn, str):
        return None
    
    try:
        lines = pgn.split('\n')
        white_player = ''
        black_player = ''
        
        for line in lines:
            if line.startswith('[White '):
                # Extract name from [White "PlayerName"]
                white_player = line.split('"')[1] if '"' in line else ''
            elif line.startswith('[Black '):
                # Extract name from [Black "PlayerName"]
                black_player = line.split('"')[1] if '"' in line else ''
        
        # Return the opponent's name based on player color
        if player_color.lower() == 'white':
            return black_player.strip() if black_player else None
        else:
            return white_player.strip() if white_player else None
            
    except Exception as e:
        print(f"Error extracting opponent name from PGN: {e}")
        return None

def _parse_lichess_pgn(pgn_text: str, user_id: str) -> List[Dict[str, Any]]:
    """Parse Lichess PGN text and extract game data"""
    try:
        import chess.pgn
        import io
        from datetime import datetime
        
        games = []
        pgn_io = io.StringIO(pgn_text)
        
        while True:
            game = chess.pgn.read_game(pgn_io)
            if not game:
                break
                
            headers = game.headers
            
            # Extract game ID from Site header (e.g., "https://lichess.org/abc123" -> "abc123")
            site = headers.get('Site', '')
            game_id = site.split('/')[-1] if site else None
            
            if not game_id:
                continue
                
            # Determine if user is white or black
            white_player = headers.get('White', '')
            black_player = headers.get('Black', '')
            user_is_white = white_player.lower() == user_id.lower()
            
            # Extract result
            result = headers.get('Result', '')
            if result == '1-0':
                game_result = 'win' if user_is_white else 'loss'
            elif result == '0-1':
                game_result = 'loss' if user_is_white else 'win'
            elif result == '1/2-1/2':
                game_result = 'draw'
            else:
                game_result = 'draw'  # Default fallback
            
            # Extract color
            color = 'white' if user_is_white else 'black'
            
            # Extract ratings
            white_rating = None
            black_rating = None
            try:
                white_rating = int(headers.get('WhiteElo', 0)) if headers.get('WhiteElo') and headers.get('WhiteElo') != '?' else None
            except (ValueError, TypeError):
                white_rating = None
            try:
                black_rating = int(headers.get('BlackElo', 0)) if headers.get('BlackElo') and headers.get('BlackElo') != '?' else None
            except (ValueError, TypeError):
                black_rating = None
            my_rating = white_rating if user_is_white else black_rating
            opponent_rating = black_rating if user_is_white else white_rating
            
            # Extract time control
            time_control = headers.get('TimeControl', '')
            
            # Extract opening
            opening = headers.get('Opening', '')
            opening_family = headers.get('ECO', '')
            
            # Extract played date
            date_str = headers.get('Date', '')
            time_str = headers.get('UTCTime', '')
            played_at = None
            if date_str and time_str:
                try:
                    # Parse date and time (format: "2023.12.25" and "14:30:00")
                    dt_str = f"{date_str} {time_str}"
                    played_at = datetime.strptime(dt_str, "%Y.%m.%d %H:%M:%S").isoformat() + "Z"
                except:
                    played_at = datetime.now().isoformat() + "Z"
            else:
                played_at = datetime.now().isoformat() + "Z"
            
            # Count moves
            total_moves = _count_moves_in_pgn(str(game))
            
            # Extract opponent name
            opponent_name = black_player if user_is_white else white_player
            
            # Create game data
            game_data = {
                'id': game_id,
                'provider_game_id': game_id,
                'result': game_result,
                'color': color,
                'time_control': time_control,
                'opening': opening,
                'opening_family': opening_family,
                'opponent_rating': opponent_rating,
                'my_rating': my_rating,
                'played_at': played_at,
                'pgn': str(game),
                'total_moves': total_moves,
                'opponent_name': opponent_name
            }
            
            games.append(game_data)
            
        return games
        
    except Exception as e:
        print(f"Error parsing Lichess PGN: {e}")
        return []

async def _fetch_games_from_platform(user_id: str, platform: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch games from external platform (Lichess or Chess.com)"""
    try:
        if platform == 'lichess':
            return await _fetch_lichess_games(user_id, limit)
        elif platform == 'chess.com':
            return await _fetch_chesscom_games(user_id, limit)
        else:
            raise ValueError(f"Unsupported platform: {platform}")
    except Exception as e:
        print(f"Error fetching games from {platform}: {e}")
        return []

async def _fetch_lichess_games(user_id: str, limit: int) -> List[Dict[str, Any]]:
    """Fetch games from Lichess API"""
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            url = f"https://lichess.org/api/games/user/{user_id}"
            params = {
                'max': limit
            }
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    # Lichess returns PGN format by default
                    pgn_text = await response.text()
                    # Parse PGN to extract game data
                    games = _parse_lichess_pgn(pgn_text, user_id)
                    return games[:limit]
                else:
                    print(f"Lichess API error: {response.status}")
                    return []
    except Exception as e:
        print(f"Error fetching Lichess games: {e}")
        return []

async def _fetch_chesscom_stats(user_id: str) -> Dict[str, Any]:
    """Fetch chess.com player stats to get highest ratings"""
    try:
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            url = f"https://api.chess.com/pub/player/{user_id}/stats"
            
            async with session.get(url) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    print(f"Chess.com stats API returned status {response.status}")
                    return {}
                    
    except Exception as e:
        print(f"Error fetching Chess.com stats: {e}")
        return {}


async def _fetch_chesscom_games(user_id: str, limit: int) -> List[Dict[str, Any]]:
    """Fetch games from Chess.com API and parse them properly"""
    try:
        import aiohttp
        from datetime import datetime, timedelta

        games = []
        async with aiohttp.ClientSession() as session:
            # Fetch games from last 12 months, starting from MOST RECENT
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365)

            current_year = end_date.year
            current_month = end_date.month
            start_year = start_date.year
            start_month = start_date.month

            # Fetch in REVERSE chronological order (newest first)
            while (current_year > start_year or (current_year == start_year and current_month >= start_month)) and len(games) < limit:
                url = f"https://api.chess.com/pub/player/{user_id}/games/{current_year}/{current_month:02d}"

                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        month_games = data.get('games', [])
                        
                        # Reverse to get newest games in month first
                        month_games.reverse()

                        # Parse each game to extract proper ratings
                        for game in month_games:
                            parsed_game = _parse_chesscom_game(game, user_id)
                            if parsed_game:
                                games.append(parsed_game)
                                if len(games) >= limit:
                                    break

                # Move to previous month
                if current_month == 1:
                    current_month = 12
                    current_year -= 1
                else:
                    current_month -= 1

        return games[:limit]

    except Exception as e:
        print(f"Error fetching Chess.com games: {e}")
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
        
        async with aiohttp.ClientSession() as session:
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
        
        # Parse time control from chess.com format (e.g., "600+5" -> "rapid")
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
        
        # Convert result to standard format
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
async def import_games_smart(request: Dict[str, Any]):
    """Smart import endpoint - imports only the most recent 100 games"""
    try:
        user_id = request.get('user_id')
        platform = request.get('platform')
        
        if not user_id or not platform:
            raise HTTPException(status_code=400, detail="user_id and platform are required")
        
        canonical_user_id = _canonical_user_id(user_id, platform)
        db_client = supabase_service or supabase
        if not db_client:
            raise HTTPException(status_code=503, detail="Database not configured for smart import")
        
        print(f"Smart import for {user_id}: starting...")
        
        # Get all existing game IDs to avoid duplicates
        existing_games_response = db_client.table('games').select('provider_game_id').eq(
            'user_id', canonical_user_id
        ).eq('platform', platform).execute()
        
        existing_game_ids = set()
        if existing_games_response.data:
            existing_game_ids = {game.get('provider_game_id') for game in existing_games_response.data}
        
        print(f"Existing game IDs count: {len(existing_game_ids)}")
        
        # Fetch the most recent 100 games from the platform
        games_data = await _fetch_games_from_platform(user_id, platform, 100)

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
        for game in games_data:
            game_id = game.get('id') or game.get('provider_game_id')
            if game_id and game_id not in existing_game_ids:
                new_games.append(game)
        
        print(f"Smart import: found {len(new_games)} new games to import")
        
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
            else:
                result.message = "No new games found. You already have all recent games imported."
        
        return result
        
    except Exception as e:
        print(f"Error in smart import: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/import-games", response_model=BulkGameImportResponse)
async def import_games_simple(request: Dict[str, Any]):
    """Import games endpoint for frontend - handles PGN parsing and move counting"""
    try:
        user_id = request.get('user_id')
        platform = request.get('platform')
        limit = request.get('limit', 100)
        
        if not user_id or not platform:
            raise HTTPException(status_code=400, detail="user_id and platform are required")
        
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
async def import_games(payload: BulkGameImportRequest):
    """Import games and PGN data using service role credentials."""
    if not supabase_service:
        raise HTTPException(status_code=503, detail="Database not configured for imports")

    canonical_user_id = _canonical_user_id(payload.user_id, payload.platform)
    errors: List[str] = []
    now_iso = datetime.utcnow().isoformat()

    games_rows: List[Dict[str, Any]] = []
    pgn_rows: List[Dict[str, Any]] = []

    for game in payload.games:
        played_at = _normalize_played_at(game.played_at)
        games_rows.append({
            "user_id": canonical_user_id,
            "platform": payload.platform,
            "provider_game_id": game.provider_game_id,
            "result": game.result,
            "color": game.color,
            "time_control": game.time_control,
            "opening": game.opening,
            "opening_family": game.opening_family,
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

    try:
        if games_rows:
            games_response = supabase_service.table('games').upsert(
                games_rows,
                on_conflict='user_id,platform,provider_game_id'
            ).execute()
            print('[import_games] games upsert response: count=', getattr(games_response, 'count', None))
    except Exception as exc:
        errors.append(f"games upsert failed: {exc}")

    try:
        if pgn_rows:
            print(f'[import_games] Upserting {len(pgn_rows)} PGN rows')
            print(f'[import_games] Sample PGN row: {pgn_rows[0] if pgn_rows else "None"}')
            pgn_response = supabase_service.table('games_pgn').upsert(
                pgn_rows,
                on_conflict='user_id,platform,provider_game_id'
            ).execute()
            print('[import_games] pgn upsert response: count=', getattr(pgn_response, 'count', None))
            print(f'[import_games] pgn upsert response data: {pgn_response.data[:2] if pgn_response.data else "None"}')
    except Exception as exc:
        print(f'[import_games] ❌ PGN upsert error: {exc}')
        errors.append(f"games_pgn upsert failed: {exc}")

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

    return BulkGameImportResponse(
        success=len(errors) == 0,
        imported_games=len(games_rows),
        errors=errors,
        error_count=len(errors),
        message=None  # Will be set by the calling function
    )



@app.get("/debug/db-state/{user_id}/{platform}")
async def debug_db_state(user_id: str, platform: str):
    """Debug endpoint to check database state"""
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

@app.get("/proxy/chess-com/{username}/games/{year}/{month}")
async def proxy_chess_com_games(username: str, year: int, month: int):
    """Proxy endpoint for Chess.com API to avoid CORS issues."""
    import httpx
    
    try:
        canonical_username = username.strip().lower()
        month_str = f"{int(month):02d}"
        url = f"https://api.chess.com/pub/player/{canonical_username}/games/{year}/{month_str}"
        print(f"Proxying request to: {url}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30.0)
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Chess.com API returned status {response.status_code}")
                return {"games": [], "error": f"API returned status {response.status_code}"}
                
    except Exception as e:
        print(f"Error proxying Chess.com request: {e}")
        return {"games": [], "error": str(e)}

@app.get("/proxy/chess-com/{username}")
async def proxy_chess_com_user(username: str):
    """Proxy endpoint for Chess.com user info to avoid CORS issues."""
    import httpx
    
    try:
        canonical_username = username.strip().lower()
        url = f"https://api.chess.com/pub/player/{canonical_username}"
        print(f"Proxying user request to: {url}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30.0)
            
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
            async with httpx.AsyncClient() as client:
                canonical_username = user_id.strip().lower()
                url = f"https://api.chess.com/pub/player/{canonical_username}"
                response = await client.get(url, timeout=10.0)
                
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

    Store and query usernames in lowercase for both platforms so we hit the same rows
    regardless of how the caller cased the name.
    """
    if not user_id or not platform:
        raise ValueError("user_id and platform cannot be empty")
    return user_id.strip().lower()

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
    # Always create a new engine to ensure we get the latest Stockfish detection
    analysis_engine = ChessAnalysisEngine()
    return analysis_engine

async def _handle_single_game_analysis(request: UnifiedAnalysisRequest) -> UnifiedAnalysisResponse:
    """Handle single game analysis with PGN data."""
    try:
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
        
        # Analyze game
        game_analysis = await engine.analyze_game(
            request.pgn, 
            request.user_id, 
            request.platform, 
            analysis_type_enum
        )
        
        if game_analysis:
            # Save to database
            success = await _save_game_analysis(game_analysis)
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
            print(f"[SINGLE GAME ANALYSIS] ❌ Validation failed: {error_message}")
            return UnifiedAnalysisResponse(
                success=False,
                message=f"Request validation failed: {error_message}"
            )
        
        # Canonicalize user ID for database operations
        try:
            canonical_user_id = _canonical_user_id(request.user_id, request.platform)
        except ValueError as e:
            print(f"[SINGLE GAME ANALYSIS] ❌ User ID canonicalization failed: {e}")
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
        
        db_client = supabase
        
        # Try to find the game by provider_game_id first
        print(f"[SINGLE GAME ANALYSIS] Querying games_pgn by provider_game_id: {game_id}")
        print(f"[SINGLE GAME ANALYSIS] Query params: user_id={canonical_user_id}, platform={request.platform}")
        
        # First, let's see what's actually in the database for this user
        try:
            all_games = db_client.table('games_pgn').select('provider_game_id, game_id').eq(
                'user_id', canonical_user_id
            ).eq('platform', request.platform).limit(5).execute()
            print(f"[SINGLE GAME ANALYSIS] Sample games for this user: {all_games.data if all_games else 'None'}")
        except Exception as debug_error:
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
            print(f"[SINGLE GAME ANALYSIS] ❌ Database query error: {query_error}")
            return UnifiedAnalysisResponse(
                success=False,
                message=f"Database query failed: {str(query_error)}"
            )
        
        # If not found, try by game_id
        if not game_response or not hasattr(game_response, 'data') or not game_response.data:
            print(f"[SINGLE GAME ANALYSIS] Not found by provider_game_id, trying by game_id column")
            try:
                game_response = db_client.table('games_pgn').select('pgn, provider_game_id').eq(
                    'game_id', game_id
                ).eq('user_id', canonical_user_id).eq('platform', request.platform).maybe_single().execute()
                print(f"[SINGLE GAME ANALYSIS] Second query result: {game_response}")
            except Exception as query_error:
                print(f"[SINGLE GAME ANALYSIS] ❌ Second database query error: {query_error}")
                return UnifiedAnalysisResponse(
                    success=False,
                    message=f"Database query failed: {str(query_error)}"
                )
        
        # If still not found in database, try fetching from chess platform
        if not game_response or not hasattr(game_response, 'data') or not game_response.data:
            print(f"[SINGLE GAME ANALYSIS] Game not found in database, attempting to fetch from {request.platform}")
            
            pgn_from_platform = None
            if request.platform == 'lichess':
                pgn_from_platform = await _fetch_single_lichess_game(game_id)
            elif request.platform == 'chess.com':
                pgn_from_platform = await _fetch_single_chesscom_game(request.user_id, game_id)
            
            if not pgn_from_platform:
                print(f"[SINGLE GAME ANALYSIS] ❌ Game not found in database or on {request.platform}: {game_id}")
                return UnifiedAnalysisResponse(
                    success=False,
                    message=f"Game not found: {game_id}. Unable to fetch from {request.platform}. Please ensure the game ID is correct and the game exists."
                )
            
            print(f"[SINGLE GAME ANALYSIS] ✓ Successfully fetched PGN from {request.platform}, saving to database")
            
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
                print(f"[SINGLE GAME ANALYSIS] ✓ Saved PGN to database")
            except Exception as save_error:
                print(f"[SINGLE GAME ANALYSIS] ⚠ Warning: Failed to save PGN to database: {save_error}")
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
            print(f"[SINGLE GAME ANALYSIS] ❌ Error checking games table: {check_error}")
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
                
                game_record = {
                    "user_id": canonical_user_id,
                    "platform": request.platform,
                    "provider_game_id": game_id,
                    "result": user_result,
                    "color": color,
                    "time_control": headers.get('TimeControl', 'unknown'),
                    "opening": headers.get('Opening', 'Unknown'),
                    "opening_family": headers.get('Opening', 'Unknown'),
                    "opponent_rating": None,  # Not available in basic PGN
                    "my_rating": None,  # Not available in basic PGN
                    "total_moves": move_count,
                    "played_at": headers.get('Date', now_iso),
                    "opponent_name": black_player if user_is_white else white_player,
                    "created_at": now_iso,
                }
                
                try:
                    games_response = db_client.table('games').upsert(
                        game_record,
                        on_conflict='user_id,platform,provider_game_id'
                    ).execute()
                    print(f"[SINGLE GAME ANALYSIS] Created game record: {game_id}")
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
        
        # Analyze game
        print(f"[SINGLE GAME ANALYSIS] Starting engine analysis for game_id: {game_id}")
        game_analysis = await engine.analyze_game(
            pgn_data, 
            canonical_user_id,  # Use canonicalized user ID
            request.platform, 
            analysis_type_enum,
            game_id
        )
        
        if game_analysis:
            # Validate foreign key constraint before saving
            print(f"[SINGLE GAME ANALYSIS] Validating foreign key constraint before saving...")
            try:
                fk_validation = db_client.table('games').select('id').eq(
                    'provider_game_id', game_id
                ).eq('user_id', canonical_user_id).eq('platform', request.platform).maybe_single().execute()
            except Exception as fk_error:
                print(f"[SINGLE GAME ANALYSIS] ❌ Error during FK validation: {fk_error}")
                fk_validation = None
            
            if not fk_validation or not hasattr(fk_validation, 'data') or not fk_validation.data:
                print(f"[SINGLE GAME ANALYSIS] ❌ CRITICAL: Foreign key validation failed - game not found in games table!")
                return UnifiedAnalysisResponse(
                    success=False,
                    message=f"Foreign key constraint validation failed: Game {game_id} not found in games table for user {canonical_user_id}"
                )
            
            print(f"[SINGLE GAME ANALYSIS] ✅ Foreign key validation passed - game exists in games table")
            
            # Save to database with comprehensive error handling
            try:
                success = await _save_game_analysis(game_analysis)
                if success:
                    print(f"[SINGLE GAME ANALYSIS] ✅ Analysis completed and saved for game_id: {game_id}")
                    print(f"[SINGLE GAME ANALYSIS] This was a SINGLE game analysis - NOT starting batch analysis")
                    return UnifiedAnalysisResponse(
                        success=True,
                        message="Game analysis completed and saved",
                        analysis_id=game_analysis.game_id,
                        data={"game_id": game_analysis.game_id}
                    )
                else:
                    print(f"[SINGLE GAME ANALYSIS] ❌ Analysis completed but failed to save to database")
                    return UnifiedAnalysisResponse(
                        success=False,
                        message="Game analysis completed but failed to save to database"
                    )
            except Exception as save_error:
                print(f"[SINGLE GAME ANALYSIS] ❌ CRITICAL ERROR during save: {save_error}")
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
        print(f"[SINGLE GAME ANALYSIS] ❌ CRITICAL ERROR in _handle_single_game_by_id: {e}")
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
            limit=request.limit or 10,
            depth=request.depth or 8,
            skill_level=request.skill_level or 8
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
                "limit": request.limit or 10,
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
    
    print(f"[VALIDATION] ✅ Games in {context} are correctly ordered chronologically (most recent first) - {len(played_dates)} games validated")

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
    game_ids = [game.get('provider_game_id') for game in all_games if game.get('provider_game_id')]
    
    if not game_ids:
        return all_games[:limit]
    
    # Check both move_analyses and game_analyses tables for already analyzed games
    analyzed_game_ids = set()
    
    try:
        # Check move_analyses table
        move_analyses_response = supabase.table('move_analyses').select('game_id').eq('user_id', user_id).eq('platform', platform).in_('game_id', game_ids).execute()
        if move_analyses_response.data:
            analyzed_game_ids.update(row['game_id'] for row in move_analyses_response.data)
        
        # Check game_analyses table
        game_analyses_response = supabase.table('game_analyses').select('game_id').eq('user_id', user_id).eq('platform', platform).in_('game_id', game_ids).execute()
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
    
    print(f"[info] Found {len(unanalyzed_games)} unanalyzed games out of {len(all_games)} total games fetched")
    print(f"[info] Skipped {analyzed_count} already-analyzed games from the fetched set")
    print(f"[info] Total analyzed games in database for this user: {len(analyzed_game_ids)}")
    if unanalyzed_games:
        print(f"[info] First unanalyzed game ID: {unanalyzed_games[0].get('provider_game_id')}")
        print(f"[info] Last unanalyzed game ID: {unanalyzed_games[-1].get('provider_game_id')}")
    return unanalyzed_games

async def _perform_batch_analysis(user_id: str, platform: str, analysis_type: str, 
                                limit: int, depth: int, skill_level: int):
    """Perform batch analysis for a user's games using parallel processing."""
    # Canonicalize user ID for database operations
    canonical_user_id = _canonical_user_id(user_id, platform)

    print(f"[parallel] BACKGROUND TASK STARTED for {user_id} (canonical: {canonical_user_id}) on {platform}")
    platform_key = platform.strip().lower()
    # Use the same canonicalization as the progress endpoint
    key = f"{canonical_user_id}_{platform_key}"
    print(f"[parallel] Using progress key: {key}")
    
    # Clear any existing progress for this user to ensure fresh start
    if key in analysis_progress:
        print(f"[parallel] Clearing existing progress for key: {key}")
        del analysis_progress[key]
    
    limit = limit or ANALYSIS_TEST_LIMIT
    if ANALYSIS_TEST_LIMIT:
        limit = min(limit, ANALYSIS_TEST_LIMIT)
    limit = max(1, limit)
    analysis_progress[key] = {
        "analyzed_games": 0,
        "total_games": limit,
        "progress_percentage": 0,
        "is_complete": False,
        "current_phase": "fetching",
        "estimated_time_remaining": None,
        "parallel_mode": True
    }
    
    print(f"[parallel] Initial progress key set: {key}")
    print(f"[parallel] Initial progress data: {analysis_progress[key]}")
    
    try:
        resolved_type = _normalize_analysis_type(analysis_type, quiet=True)
        if resolved_type != analysis_type:
            print(f"[info] Batch analysis requested as '{analysis_type}' mapped to '{resolved_type}'.")
        analysis_type = resolved_type
        print(f"[parallel] Starting batch analysis for {user_id} on {platform}")
        
        # Phase 1: Fetch games
        analysis_progress[key]["current_phase"] = "fetching"
        analysis_progress[key]["progress_percentage"] = 10
        print(f"Phase 1 - Fetching games: {analysis_progress[key]}")
        
        # Get games from database (games_pgn table for PGN data)
        all_games: list = []

        if supabase:
            # ====================================================================================
            # CRITICAL: GAME SELECTION LOGIC - DO NOT MODIFY WITHOUT UNDERSTANDING THE IMPACT
            # ====================================================================================
            # This code was implemented to fix a critical bug where random games were selected
            # instead of the most recent ones. The two-step approach is REQUIRED to maintain
            # chronological ordering. See docs/GAME_SELECTION_PROTECTION.md for details.
            # 
            # WARNING: Any changes to this logic MUST:
            # 1. Maintain chronological order (most recent first)
            # 2. Include validation calls
            # 3. Be thoroughly tested
            # 4. Update the protection documentation
            # ====================================================================================
            
            # Get the most recent games by first fetching from games table, then getting PGN data
            # This ensures we get games in the correct chronological order
            # Increased multiplier to ensure we find enough unanalyzed games even if many recent games are already analyzed
            fetch_limit = max(limit * 10, 100)  # Get 10x the limit (minimum 100) to ensure we find unanalyzed games
            print(f"[info] Fetching up to {fetch_limit} most recent games to find {limit} unanalyzed games")
            
            # First get game IDs from games table ordered by played_at (most recent first)
            games_list_response = supabase.table('games').select('provider_game_id, played_at').eq('user_id', canonical_user_id).eq('platform', platform).order('played_at', desc=True).limit(fetch_limit).execute()
            
            if games_list_response.data:
                # Get provider_game_ids in order with their played_at dates
                ordered_games = games_list_response.data
                provider_game_ids = [g['provider_game_id'] for g in ordered_games]
                print(f"[info] Found {len(provider_game_ids)} games in database (ordered by most recent)")
                
                # Now fetch PGN data for these games
                pgn_response = supabase.table('games_pgn').select('*').eq('user_id', canonical_user_id).eq('platform', platform).in_('provider_game_id', provider_game_ids).execute()
                
                # Re-order PGN data to match the games table order and add played_at info
                pgn_map = {g['provider_game_id']: g for g in (pgn_response.data or [])}
                all_games = []
                for game_info in ordered_games:
                    provider_game_id = game_info['provider_game_id']
                    if provider_game_id in pgn_map:
                        pgn_data = pgn_map[provider_game_id].copy()
                        pgn_data['played_at'] = game_info['played_at']  # Add played_at to PGN data
                        all_games.append(pgn_data)
                
                print(f"[info] Found {len(all_games)} games with PGN data (ordered by most recent played_at)")
                if all_games:
                    print(f"[info] First game played_at: {all_games[0].get('played_at')}")
                    print(f"[info] Last game played_at: {all_games[-1].get('played_at')}")
                    
                    # CRITICAL: Validate chronological order to prevent regression
                    _validate_game_chronological_order(all_games, "parallel analysis")
            else:
                all_games = []
            
            # Filter out already analyzed games
            games = await _filter_unanalyzed_games(all_games, canonical_user_id, platform, analysis_type, limit)
        else:
            print('[warn] Database client not available. Using mock games for progress testing.')
            games = []
            
        # If no games found, create some mock games for testing
        if not games:
            print("[TEST] No games found, creating mock games for progress testing")
            games = [{"id": f"mock_game_{i}", "pgn": "1. e4 e5 2. Nf3 Nc6", "provider_game_id": f"mock_{i}"} for i in range(limit)]
            
        analysis_progress[key]["total_games"] = len(games)

        if not games:
            print(f"No unanalyzed games found for {user_id} on {platform}")
            analysis_progress[key].update({
                "is_complete": True,
                "current_phase": "complete",
                "progress_percentage": 100,
                "status_message": "All your recent games have already been analyzed! Your analytics are up to date.",
                "all_games_analyzed": True
            })
            return
        
        print(f"Found {len(games)} unanalyzed games to analyze")
        
        # Phase 2: Use parallel analysis engine
        analysis_progress[key]["current_phase"] = "analyzing"
        analysis_progress[key]["progress_percentage"] = 20
        analysis_progress[key]["analyzed_games"] = 0
        analysis_progress[key]["total_games"] = len(games)
        
        print(f"Phase 2 - Starting analysis: {analysis_progress[key]}")
        
        # Import and use the new parallel analysis engine
        from .parallel_analysis_engine import ParallelAnalysisEngine
        
        # Create parallel analysis engine with dynamic worker count
        # This prevents CPU saturation while maintaining good performance
        parallel_engine = ParallelAnalysisEngine()  # Uses auto-calculated worker count
        
        print(f"PARALLEL BATCH ANALYSIS: Using {parallel_engine.max_workers} parallel workers for {len(games)} games")
        print(f"Games to analyze: {[game.get('provider_game_id', 'unknown') for game in games[:5]]}...")
        
        # Create progress callback function
        def update_progress(completed: int, total: int, percentage: int):
            progress_update = {
                "analyzed_games": completed,
                "total_games": total,
                "progress_percentage": percentage,
                "current_phase": "analyzing"
            }
            analysis_progress[key].update(progress_update)
            print(f"[parallel] Progress update for key {key}: {progress_update}")

            # Also log the current progress state for debugging
            print(f"[parallel] Current stored progress: {analysis_progress[key]}")
            print(f"[parallel] Available progress keys after update: {list(analysis_progress.keys())}")
        
        # Start parallel analysis
        start_time = datetime.now()
        result = await parallel_engine.analyze_games_parallel(
            user_id=canonical_user_id,
            platform=platform,
            analysis_type=analysis_type,
            limit=limit,
            depth=depth,
            skill_level=skill_level,
            progress_callback=update_progress
        )
        end_time = datetime.now()
        
        # Process results
        if result['success']:
            processed = result['analyzed_games']
            failed = result['failed_games']
            total_time = result['total_time']
            avg_accuracy = result['average_accuracy']
            speedup = result['speedup']
            
            print("[parallel] Analysis complete")
            print(f"   Total time: {total_time:.1f}s")
            print(f"   Games analyzed: {processed}/{len(games)}")
            print(f"   Average accuracy: {avg_accuracy:.1f}%")
            print(f"   Speedup: {speedup:.1f}x")
            
            # Update progress to complete
            analysis_progress[key].update({
                "is_complete": True,
                "current_phase": "complete",
                "progress_percentage": 100,
                "analyzed_games": processed,
                "total_time": total_time,
                "average_accuracy": avg_accuracy,
                "speedup": speedup
            })
            
            print(f"[COMPLETE] Parallel batch analysis complete for {user_id}! Processed: {processed}, Failed: {failed}")
            
            # Schedule cleanup of progress data after 2 minutes to prevent memory leaks
            # This gives the frontend enough time to detect completion
            import asyncio
            async def cleanup_progress():
                await asyncio.sleep(120)  # Wait 2 minutes
                if key in analysis_progress:
                    print(f"[CLEANUP] Removing completed progress for key: {key}")
                    del analysis_progress[key]
            
            # Schedule cleanup in background
            asyncio.create_task(cleanup_progress())
        else:
            print(f"[ERROR] Parallel analysis failed: {result['message']}")
            analysis_progress[key].update({
                "is_complete": True,
                "current_phase": "error",
                "progress_percentage": 100
            })
            
            # Schedule cleanup of error progress data after 2 minutes
            import asyncio
            async def cleanup_progress():
                await asyncio.sleep(120)  # Wait 2 minutes
                if key in analysis_progress:
                    print(f"[CLEANUP] Removing error progress for key: {key}")
                    del analysis_progress[key]
            
            # Schedule cleanup in background
            asyncio.create_task(cleanup_progress())
        
    except Exception as e:
        print(f"[error] ERROR in parallel batch analysis: {e}")
        import traceback
        traceback.print_exc()
        analysis_progress[key].update({
            "is_complete": True,
            "current_phase": "error",
            "progress_percentage": 100
        })
        
        # Schedule cleanup of error progress data after 2 minutes
        import asyncio
        async def cleanup_progress():
            await asyncio.sleep(120)  # Wait 2 minutes
            if key in analysis_progress:
                print(f"[CLEANUP] Removing exception progress for key: {key}")
                del analysis_progress[key]
        
        # Schedule cleanup in background
        asyncio.create_task(cleanup_progress())

async def _perform_sequential_batch_analysis(user_id: str, platform: str, analysis_type: str, 
                                           limit: int, depth: int, skill_level: int):
    """Perform batch analysis for a user's games using sequential processing (fallback)."""
    # Canonicalize user ID for database operations
    canonical_user_id = _canonical_user_id(user_id, platform)
    print(f"[BACKGROUND] SEQUENTIAL batch analysis for {user_id} (canonical: {canonical_user_id}) on {platform}")
    platform_key = platform.strip().lower()
    key = f"{canonical_user_id}_{platform_key}"
    limit = limit or ANALYSIS_TEST_LIMIT
    if ANALYSIS_TEST_LIMIT:
        limit = min(limit, ANALYSIS_TEST_LIMIT)
    limit = max(1, limit)
    analysis_progress[key] = {
        "analyzed_games": 0,
        "total_games": limit,
        "progress_percentage": 0,
        "is_complete": False,
        "current_phase": "fetching",
        "estimated_time_remaining": None,
        "parallel_mode": False
    }
    
    try:
        resolved_type = _normalize_analysis_type(analysis_type, quiet=True)
        if resolved_type != analysis_type:
            print(f"[info] Sequential batch analysis requested as '{analysis_type}' mapped to '{resolved_type}'.")
        analysis_type = resolved_type
        print(f"[sequential] Starting batch analysis for {user_id} on {platform}")
        
        # Phase 1: Fetch games
        analysis_progress[key]["current_phase"] = "fetching"
        analysis_progress[key]["progress_percentage"] = 10
        
        # Get games from database (join games table for ordering with games_pgn for PGN data)
        if supabase:
            # ====================================================================================
            # CRITICAL: GAME SELECTION LOGIC - DO NOT MODIFY WITHOUT UNDERSTANDING THE IMPACT
            # ====================================================================================
            # This code was implemented to fix a critical bug where random games were selected
            # instead of the most recent ones. The two-step approach is REQUIRED to maintain
            # chronological ordering. See docs/GAME_SELECTION_PROTECTION.md for details.
            # 
            # WARNING: Any changes to this logic MUST:
            # 1. Maintain chronological order (most recent first)
            # 2. Include validation calls
            # 3. Be thoroughly tested
            # 4. Update the protection documentation
            # ====================================================================================
            
            # Get the most recent games by first fetching from games table, then getting PGN data
            # This ensures we get games in the correct chronological order
            # Increased multiplier to ensure we find enough unanalyzed games even if many recent games are already analyzed
            fetch_limit = max(limit * 10, 100)  # Get 10x the limit (minimum 100) to ensure we find unanalyzed games
            print(f"[info] Fetching up to {fetch_limit} most recent games to find {limit} unanalyzed games")
            
            # First get game IDs from games table ordered by played_at (most recent first)
            games_list_response = supabase.table('games').select('provider_game_id, played_at').eq('user_id', canonical_user_id).eq('platform', platform).order('played_at', desc=True).limit(fetch_limit).execute()
            
            if games_list_response.data:
                # Get provider_game_ids in order with their played_at dates
                ordered_games = games_list_response.data
                provider_game_ids = [g['provider_game_id'] for g in ordered_games]
                print(f"[info] Found {len(provider_game_ids)} games in database (ordered by most recent)")
                
                # Now fetch PGN data for these games
                pgn_response = supabase.table('games_pgn').select('*').eq('user_id', canonical_user_id).eq('platform', platform).in_('provider_game_id', provider_game_ids).execute()
                
                # Re-order PGN data to match the games table order and add played_at info
                pgn_map = {g['provider_game_id']: g for g in (pgn_response.data or [])}
                all_games = []
                for game_info in ordered_games:
                    provider_game_id = game_info['provider_game_id']
                    if provider_game_id in pgn_map:
                        pgn_data = pgn_map[provider_game_id].copy()
                        pgn_data['played_at'] = game_info['played_at']  # Add played_at to PGN data
                        all_games.append(pgn_data)
                
                print(f"[info] Found {len(all_games)} games with PGN data (ordered by most recent played_at)")
                if all_games:
                    print(f"[info] First game played_at: {all_games[0].get('played_at')}")
                    print(f"[info] Last game played_at: {all_games[-1].get('played_at')}")
                    
                    # CRITICAL: Validate chronological order to prevent regression
                    _validate_game_chronological_order(all_games, "sequential analysis")
            else:
                all_games = []
            
            # Filter out already analyzed games
            games = await _filter_unanalyzed_games(all_games, canonical_user_id, platform, analysis_type, limit)
            analysis_progress[key]["total_games"] = len(games)
        else:
            print("[warn]  Database not available. Using mock data for development.")
            games = []
            analysis_progress[key]["total_games"] = 0

        if not games:
            print(f"No unanalyzed games found for {user_id} on {platform}")
            analysis_progress[key].update({
                "is_complete": True,
                "current_phase": "complete",
                "progress_percentage": 100,
                "status_message": "All your recent games have already been analyzed! Your analytics are up to date.",
                "all_games_analyzed": True
            })
            return
        
        print(f"Found {len(games)} unanalyzed games to analyze")
        
        # Phase 2: Sequential analysis
        analysis_progress[key]["current_phase"] = "analyzing"
        analysis_progress[key]["progress_percentage"] = 20
        
        # Get analysis engine
        engine = get_analysis_engine()
        analysis_type_enum = AnalysisType(resolved_type)
        
        # Configure analysis
        if resolved_type == "deep":
            engine.config = AnalysisConfig.for_deep_analysis()
        else:
            engine.config = AnalysisConfig(
                analysis_type=analysis_type_enum,
                depth=depth,
                skill_level=skill_level
            )
        
        # Analyze games sequentially
        start_time = datetime.now()
        successful_analyses = 0
        failed_analyses = 0
        
        for i, game in enumerate(games):
            try:
                print(f"[ANALYZING] Game {i+1}/{len(games)}: {game.get('provider_game_id', 'unknown')}")
                
                # Analyze single game
                game_analysis = await _analyze_single_game(engine, game, canonical_user_id, platform, analysis_type_enum)
                
                if game_analysis:
                    successful_analyses += 1
                    print(f"[SUCCESS] Game {i+1} analyzed successfully")
                else:
                    failed_analyses += 1
                    print(f"[FAILED] Game {i+1} analysis failed")
                
                # Update progress
                progress_percentage = 20 + int((i + 1) / len(games) * 70)  # 20-90%
                analysis_progress[key].update({
                    "analyzed_games": i + 1,
                    "progress_percentage": progress_percentage
                })
                
            except Exception as e:
                failed_analyses += 1
                print(f"[ERROR] Error analyzing game {i+1}: {e}")
        
        end_time = datetime.now()
        total_time = (end_time - start_time).total_seconds()
        
        # Calculate average accuracy
        avg_accuracy = 0.0
        if successful_analyses > 0:
            # This would need to be calculated from the actual analysis results
            # For now, we'll use a placeholder
            avg_accuracy = 75.0  # Placeholder value
        
        print("[sequential] Analysis complete")
        print(f"   Total time: {total_time:.1f}s")
        print(f"   Games analyzed: {successful_analyses}/{len(games)}")
        print(f"   Average accuracy: {avg_accuracy:.1f}%")
        
        # Update progress to complete
        analysis_progress[key].update({
            "is_complete": True,
            "current_phase": "complete",
            "progress_percentage": 100,
            "analyzed_games": successful_analyses,
            "total_time": total_time,
            "average_accuracy": avg_accuracy
        })
        
        print(f"[COMPLETE] Sequential batch analysis complete for {user_id}! Processed: {successful_analyses}, Failed: {failed_analyses}")
        
    except Exception as e:
        print(f"[error] ERROR in sequential batch analysis: {e}")
        import traceback
        traceback.print_exc()
        analysis_progress[key].update({
            "is_complete": True,
            "current_phase": "error",
            "progress_percentage": 100
        })

async def _analyze_single_game(engine, game, user_id, platform, analysis_type_enum):
    """Helper function to analyze a single game."""
    try:
        # Get PGN data directly from the game record
        pgn_data = game.get('pgn')
        
        if not pgn_data:
            print(f"No PGN data for game {game.get('provider_game_id', 'unknown')}")
            return None
        
        # Analyze game with the correct game_id from games_pgn table
        from datetime import datetime
        game_id = game.get('provider_game_id', f"game_{datetime.now().timestamp()}")
        game_analysis = await engine.analyze_game(pgn_data, user_id, platform, analysis_type_enum, game_id)
        
        if game_analysis:
            # Save analysis to move_analyses table (all analysis types now use Stockfish)
            await _save_stockfish_analysis(game_analysis)
            return game_analysis
        else:
            return None
            
    except Exception as e:
        print(f"[error] ERROR analyzing game {game.get('provider_game_id', 'unknown')}: {e}")
        return None



async def _save_stockfish_analysis(analysis: GameAnalysis) -> bool:
    """Persist Stockfish/deep analysis using reliable persistence fallback."""
    try:
        canonical_user_id = _canonical_user_id(analysis.user_id, analysis.platform)

        if persistence:
            result = await persistence.save_analysis_with_retry(analysis)
            return result.success

        moves_analysis_dict = []
        for move in analysis.moves_analysis:
            moves_analysis_dict.append({
                'move': move.move,
                'move_san': move.move_san,
                'evaluation': move.evaluation,
                'is_best': move.is_best,
                'is_blunder': move.is_blunder,
                'is_mistake': move.is_mistake,
                'is_inaccuracy': move.is_inaccuracy,
                'is_good': move.is_good,
                'is_acceptable': move.is_acceptable,
                'centipawn_loss': move.centipawn_loss,
                'depth_analyzed': move.depth_analyzed,
                'is_user_move': move.is_user_move,
                'player_color': move.player_color,
                'ply_index': move.ply_index
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
        return bool(getattr(response, 'data', None))

    except Exception as e:
        print(f"Error saving Stockfish analysis: {e}")
        return False


async def _save_game_analysis(analysis: GameAnalysis) -> bool:
    """Save game analysis using reliable persistence system."""
    if persistence is None:
        print("Warning: Persistence system not available, skipping save")
        return False
    
    try:
        result = await persistence.save_analysis_with_retry(analysis)
        return result.success
    except Exception as e:
        print(f"Error in reliable persistence: {e}")
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

        opening_moves = [move for move in moves_analysis if move.get('opening_ply', 0) <= 15]
        if opening_moves:
            opening_best_moves = sum(1 for move in opening_moves if move.get('is_best'))
            opening_accuracy = (opening_best_moves / len(opening_moves)) * 100
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
                opening_moves = [move for move in moves_analysis if move.get('opening_ply', 0) <= 15 and move.get('is_user_move', False)]
                if opening_moves:
                    opening_best_moves = sum(1 for move in opening_moves if move.get('is_best', False))
                    total_opening_accuracy += (opening_best_moves / len(opening_moves)) * 100
        
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
            opening_moves = [move for move in moves_analysis if move.get('opening_ply', 0) <= 15 and move.get('is_user_move', False)]
            if opening_moves:
                opening_best_moves = sum(1 for move in opening_moves if move.get('is_best', False))
                total_opening_accuracy += (opening_best_moves / len(opening_moves)) * 100
    
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
            stockfish_depth=8
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








































