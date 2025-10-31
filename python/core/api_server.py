#!/usr/bin/env python3
"""
Unified Chess Analysis API Server
Provides a single, comprehensive API for all chess analysis operations.
Supports Stockfish analysis with real-time progress tracking.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Annotated
import uvicorn
import asyncio
import os
from datetime import datetime
from supabase import create_client, Client
from jose import jwt as jose_jwt

# Import our unified analysis engine
from .analysis_engine import ChessAnalysisEngine, AnalysisConfig, AnalysisType, GameAnalysis

# Import error handlers
from .error_handlers import (
    ChessAnalyticsError, DatabaseError, AnalysisError, AuthenticationError,
    ValidationError, create_error_response, handle_database_error,
    handle_analysis_error, validate_game_data, validate_analysis_request,
    global_exception_handler
)

# Load validated environment configuration
from .env_validation import config
from .cors_security import get_default_cors_config, get_production_cors_config

# Log configuration status
config.log_configuration()

# Initialize secure CORS configuration
if config.environment == 'production':
    # In production, use strict CORS with your actual domains
    cors_config = get_production_cors_config(config.api.cors_origins)
else:
    # In development, use default secure configuration
    cors_config = get_default_cors_config()

cors_config.log_security_status()

supabase = None
supabase_service = None

if config.database.url and config.database.anon_key:
    supabase = create_client(str(config.database.url), config.database.anon_key)

    if config.database.service_role_key:
        supabase_service = create_client(str(config.database.url), config.database.service_role_key)
        print("Using service role key for move_analyses operations")
    else:
        supabase_service = supabase
        print("Warning: Service role key not found, using anon key for move_analyses operations (may cause RLS issues)")
else:
    print("[warn] Supabase credentials not configured; running in offline mode for tests")

# Authentication setup
security = HTTPBearer()
JWT_SECRET = config.security.jwt_secret

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

# Optional authentication dependency (can be disabled for development)
def get_optional_auth():
    """Optional authentication dependency that can be disabled."""
    if config.api.auth_enabled:
        return Depends(verify_user_access)
    else:
        return None

# FastAPI app
app = FastAPI(
    title="Unified Chess Analysis API",
    version="2.0.0",
    description="Comprehensive chess analysis API supporting Stockfish analysis"
)

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

# In-memory storage for analysis progress
analysis_progress = {}
ANALYSIS_TEST_LIMIT = int(os.getenv("ANALYSIS_TEST_LIMIT", "5"))

# Pydantic models
class AnalysisRequest(BaseModel):
    user_id: str = Field(..., description="User ID to analyze games for")
    platform: str = Field(..., description="Platform (lichess, chess.com, etc.)")
    analysis_type: str = Field("stockfish", description="Type of analysis: stockfish or deep")
    limit: Optional[int] = Field(10, description="Maximum number of games to analyze")
    depth: Optional[int] = Field(14, description="Analysis depth for Stockfish")
    skill_level: Optional[int] = Field(20, description="Stockfish skill level (0-20)")

class PositionAnalysisRequest(BaseModel):
    fen: str = Field(..., description="FEN string of the position to analyze")
    analysis_type: str = Field("stockfish", description="Type of analysis: stockfish or deep")
    depth: Optional[int] = Field(14, description="Analysis depth for Stockfish")

class MoveAnalysisRequest(BaseModel):
    fen: str = Field(..., description="FEN string of the position")
    move: str = Field(..., description="Move in UCI format (e.g., e2e4)")
    analysis_type: str = Field("stockfish", description="Type of analysis: stockfish or deep")
    depth: Optional[int] = Field(14, description="Analysis depth for Stockfish")

class GameAnalysisRequest(BaseModel):
    pgn: str = Field(..., description="PGN string of the game to analyze")
    user_id: str = Field(..., description="User ID")
    platform: str = Field(..., description="Platform")
    analysis_type: str = Field("stockfish", description="Type of analysis: stockfish or deep")
    depth: Optional[int] = Field(14, description="Analysis depth for Stockfish")

class AnalysisResponse(BaseModel):
    success: bool
    message: str
    analysis_id: Optional[str] = None

class GameAnalysisSummary(BaseModel):
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

class PositionAnalysisResult(BaseModel):
    evaluation: Dict[str, Any]
    best_move: Optional[str]
    fen: str
    analysis_type: str
    depth: Optional[int] = None

class MoveAnalysisResult(BaseModel):
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

class AnalysisProgress(BaseModel):
    analyzed_games: int
    total_games: int
    progress_percentage: int
    is_complete: bool
    current_phase: str
    estimated_time_remaining: Optional[int] = None

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


def get_analysis_engine() -> ChessAnalysisEngine:
    """Get or create the analysis engine instance."""
    global analysis_engine
    if analysis_engine is None:
        # Pass stockfish path from config to ensure production paths are checked
        from .config import get_config
        config = get_config()
        stockfish_path = config.stockfish.path
        if stockfish_path:
            print(f"[ENGINE] Using Stockfish from config: {stockfish_path}")
        else:
            print(f"[ENGINE] Warning: No Stockfish path found in config")
        analysis_engine = ChessAnalysisEngine(stockfish_path=stockfish_path)
    return analysis_engine

def map_analysis_to_unified_response(analysis: dict, analysis_type: str) -> GameAnalysisSummary:
    """Map analysis data from different database tables to unified response format."""

    def compute_move_metrics(analysis_data: dict) -> dict:
        moves = analysis_data.get('moves_analysis') or []
        if not isinstance(moves, list):
            return {
                'blunders': int(analysis_data.get('blunders', 0)),
                'mistakes': int(analysis_data.get('mistakes', 0)),
                'inaccuracies': int(analysis_data.get('inaccuracies', 0)),
                'brilliant_moves': int(analysis_data.get('brilliant_moves', 0)),
                'best_moves': int(analysis_data.get('best_moves', 0)),
                'good_moves': int(analysis_data.get('good_moves', 0)),
                'acceptable_moves': int(analysis_data.get('acceptable_moves', 0)),
                'opening_accuracy': float(analysis_data.get('opening_accuracy', 0)),
                'total_moves': 0
            }

        blunders = sum(1 for move in moves if move.get('is_blunder'))
        mistakes = sum(1 for move in moves if move.get('is_mistake'))
        inaccuracies = sum(1 for move in moves if move.get('is_inaccuracy'))
        best_moves = sum(1 for move in moves if move.get('is_best'))
        brilliants = sum(1 for move in moves if move.get('is_brilliant'))
        good_moves = sum(1 for move in moves if move.get('is_good'))
        acceptable_moves = sum(1 for move in moves if move.get('is_acceptable'))

        # Use opening_ply <= 20 (10 full moves) to match Chess.com's typical opening phase
        opening_moves = [move for move in moves if move.get('opening_ply', 0) <= 20 and move.get('is_user_move', False)]
        if opening_moves:
            # Use Chess.com win probability method for opening accuracy
            opening_accuracy = _calculate_opening_accuracy_chesscom(opening_moves)
        else:
            opening_accuracy = float(analysis_data.get('opening_accuracy', 0))

        return {
            'blunders': blunders,
            'mistakes': mistakes,
            'inaccuracies': inaccuracies,
            'brilliant_moves': brilliants,
            'best_moves': best_moves,
            'good_moves': good_moves,
            'acceptable_moves': acceptable_moves,
            'opening_accuracy': opening_accuracy,
            'total_moves': len(moves)
        }

    move_metrics = compute_move_metrics(analysis)

    accuracy_value = analysis.get('accuracy')
    if accuracy_value is None:
        accuracy_value = analysis.get('best_move_percentage', 0)

    best_move_pct = analysis.get('best_move_percentage')
    if best_move_pct is None:
        total_moves = move_metrics['total_moves']
        if total_moves:
            best_move_pct = round((move_metrics['best_moves'] / total_moves) * 100, 2)
        else:
            best_move_pct = accuracy_value or 0

    summary_kwargs = {
        'game_id': analysis.get('game_id', ''),
        'accuracy': float(accuracy_value or 0),
        'best_move_percentage': float(best_move_pct or 0),
        'opponent_accuracy': float(analysis.get('opponent_accuracy', 0)),
        'blunders': int(move_metrics['blunders']),
        'mistakes': int(move_metrics['mistakes']),
        'inaccuracies': int(move_metrics['inaccuracies']),
        'brilliant_moves': int(move_metrics['brilliant_moves']),
        'best_moves': int(move_metrics['best_moves']),
        'good_moves': int(move_metrics['good_moves']),
        'acceptable_moves': int(move_metrics['acceptable_moves']),
        'opening_accuracy': float(move_metrics['opening_accuracy']),
        'middle_game_accuracy': float(analysis.get('middle_game_accuracy', 0)),
        'endgame_accuracy': float(analysis.get('endgame_accuracy', 0)),
        'average_centipawn_loss': float(analysis.get('average_centipawn_loss', 0)),
        'opponent_average_centipawn_loss': float(analysis.get('opponent_average_centipawn_loss', 0)),
        'worst_blunder_centipawn_loss': float(analysis.get('worst_blunder_centipawn_loss', 0)),
        'opponent_worst_blunder_centipawn_loss': float(analysis.get('opponent_worst_blunder_centipawn_loss', 0)),
        'time_management_score': float(analysis.get('time_management_score', 0)),
        'opponent_time_management_score': float(analysis.get('opponent_time_management_score', 0)),
        'material_sacrifices': int(analysis.get('material_sacrifices', move_metrics['brilliant_moves'])),
        'aggressiveness_index': float(analysis.get('aggressiveness_index', analysis.get('aggressive_score', 0))),
        'tactical_score': float(analysis.get('tactical_score', 0)),
        'positional_score': float(analysis.get('positional_score', 0)),
        'aggressive_score': float(analysis.get('aggressive_score', 0)),
        'patient_score': float(analysis.get('patient_score', 0)),
        'novelty_score': float(analysis.get('novelty_score', 0)),
        'staleness_score': float(analysis.get('staleness_score', 0)),
        'average_evaluation': float(analysis.get('average_evaluation', 0)),
        'analysis_type': str(analysis.get('analysis_type', analysis.get('analysis_method', analysis_type))),
        'analysis_date': str(analysis.get('analysis_date', '')),
        'processing_time_ms': int(analysis.get('processing_time_ms', 0)),
        'stockfish_depth': int(analysis.get('stockfish_depth', 0))
    }

    return GameAnalysisSummary(**summary_kwargs)

def map_unified_analysis_to_response(analysis: dict) -> GameAnalysisSummary:
    """Map unified analysis data to response format (simplified since view provides consistent fields)."""
    return GameAnalysisSummary(
        game_id=analysis.get('game_id', ''),
        accuracy=analysis.get('accuracy', 0),
        best_move_percentage=analysis.get('best_move_percentage', analysis.get('accuracy', 0)),
        opponent_accuracy=analysis.get('opponent_accuracy', 0),
        blunders=analysis.get('blunders', 0),
        mistakes=analysis.get('mistakes', 0),
        inaccuracies=analysis.get('inaccuracies', 0),
        brilliant_moves=analysis.get('brilliant_moves', 0),
        best_moves=analysis.get('best_moves', 0),
        good_moves=analysis.get('good_moves', 0),
        acceptable_moves=analysis.get('acceptable_moves', 0),
        opening_accuracy=analysis.get('opening_accuracy', 0),
        middle_game_accuracy=analysis.get('middle_game_accuracy', 0),
        endgame_accuracy=analysis.get('endgame_accuracy', 0),
        average_centipawn_loss=analysis.get('average_centipawn_loss', 0),
        opponent_average_centipawn_loss=analysis.get('opponent_average_centipawn_loss', 0),
        worst_blunder_centipawn_loss=analysis.get('worst_blunder_centipawn_loss', 0),
        opponent_worst_blunder_centipawn_loss=analysis.get('opponent_worst_blunder_centipawn_loss', 0),
        time_management_score=analysis.get('time_management_score', 0),
        opponent_time_management_score=analysis.get('opponent_time_management_score', 0),
        material_sacrifices=analysis.get('material_sacrifices', 0),
        aggressiveness_index=analysis.get('aggressiveness_index', analysis.get('aggressive_score', 0)),
        tactical_score=analysis.get('tactical_score', 0),
        positional_score=analysis.get('positional_score', 0),
        aggressive_score=analysis.get('aggressive_score', 0),
        patient_score=analysis.get('patient_score', 0),
        novelty_score=analysis.get('novelty_score', 0),
        staleness_score=analysis.get('staleness_score', 0),
        average_evaluation=analysis.get('average_evaluation', 0),
        analysis_type=analysis.get('analysis_type', 'unknown'),
        analysis_date=analysis.get('analysis_date', ''),
        processing_time_ms=analysis.get('processing_time_ms', 0),
        stockfish_depth=analysis.get('stockfish_depth', 0)
    )

def _validate_game_chronological_order(games: list, context: str) -> None:
    """
    CRITICAL VALIDATION: Ensure games are in correct chronological order (most recent first).

    This function prevents regression of the game selection bug where random games
    were selected instead of the most recent ones.

    Args:
        games: List of games with 'played_at' field
        context: Context string for error messages (e.g., "legacy batch analysis")

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
        # Check move_analyses table - filter by analysis_method (stockfish/deep)
        if not supabase:
            raise HTTPException(status_code=503, detail="Supabase not configured")

        move_analyses_response = await asyncio.to_thread(
            lambda: supabase.table('move_analyses').select('game_id').eq('user_id', user_id).eq('platform', platform).eq('analysis_method', analysis_type).in_('game_id', game_ids).execute()
        )
        if move_analyses_response.data:
            analyzed_game_ids.update(row['game_id'] for row in move_analyses_response.data)

        # Check game_analyses table - filter by analysis_type (stockfish/deep)
        game_analyses_response = await asyncio.to_thread(
            lambda: supabase.table('game_analyses').select('game_id').eq('user_id', user_id).eq('platform', platform).eq('analysis_type', analysis_type).in_('game_id', game_ids).execute()
        )
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
    print(f"[info] Skipped {analyzed_count} already-analyzed games from the fetched set")
    print(f"[info] Total analyzed games in database for this user: {len(analyzed_game_ids)}")
    if unanalyzed_games:
        print(f"[info] First unanalyzed game ID: {unanalyzed_games[0].get('provider_game_id')}")
        print(f"[info] Last unanalyzed game ID: {unanalyzed_games[-1].get('provider_game_id')}")
    return unanalyzed_games

async def perform_batch_analysis(user_id: str, platform: str, analysis_type: str,
                                limit: int, depth: int, skill_level: int):
    """Perform batch analysis for a user's games."""
    # Canonicalize user ID for database operations
    canonical_user_id = _canonical_user_id(user_id, platform)
    print(f"BACKGROUND TASK STARTED: perform_batch_analysis for {user_id} (canonical: {canonical_user_id}) on {platform}")
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
        "estimated_time_remaining": None
    }

    try:
        print(f"Starting batch analysis for {user_id} on {platform}")

        # Phase 1: Fetch games
        analysis_progress[key]["current_phase"] = "fetching"
        analysis_progress[key]["progress_percentage"] = 10

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

        # Get games from database by first fetching from games table, then getting PGN data
        # Get the most recent unanalyzed games by ordering by played_at DESC from games table
        # This ensures we always get the next batch of most recent unanalyzed games
        # Increased multiplier to ensure we find enough unanalyzed games even if many recent games are already analyzed
        fetch_limit = max(limit * 10, 100)  # Get 10x the limit (minimum 100) to ensure we find unanalyzed games
        print(f"[info] Fetching up to {fetch_limit} most recent games to find {limit} unanalyzed games")

        # First get game IDs from games table ordered by played_at (most recent first)
        if not supabase:
            raise HTTPException(status_code=503, detail="Supabase not configured")

        games_list_response = await asyncio.to_thread(
            lambda: supabase.table('games').select('provider_game_id, played_at').eq('user_id', canonical_user_id).eq('platform', platform).order('played_at', desc=True).limit(fetch_limit).execute()
        )

        if games_list_response.data:
            # Get provider_game_ids in order with their played_at dates
            ordered_games = games_list_response.data
            provider_game_ids = [g['provider_game_id'] for g in ordered_games]
            print(f"[info] Found {len(provider_game_ids)} games in database (ordered by most recent)")

            # Now fetch PGN data for these games
            if not supabase:
                raise HTTPException(status_code=503, detail="Supabase not configured")

            pgn_response = await asyncio.to_thread(
                lambda: supabase.table('games_pgn').select('*').eq('user_id', canonical_user_id).eq('platform', platform).in_('provider_game_id', provider_game_ids).execute()
            )

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
                _validate_game_chronological_order(all_games, "legacy batch analysis")
        else:
            all_games = []

        # Filter out already analyzed games
        games = await _filter_unanalyzed_games(all_games, canonical_user_id, platform, analysis_type, limit)
        analysis_progress[key]["total_games"] = len(games)

        if not games:
            print(f"No unanalyzed games found for {user_id} on {platform}")
            analysis_progress[key].update({
                "is_complete": True,
                "current_phase": "complete",
                "progress_percentage": 100
            })
            return

        print(f"Found {len(games)} unanalyzed games to analyze")

        # Phase 2: Analyze games
        analysis_progress[key]["current_phase"] = "analyzing"
        analysis_progress[key]["progress_percentage"] = 20

        engine = get_analysis_engine()

        # Configure analysis type
        analysis_type_enum = AnalysisType(analysis_type)
        config = AnalysisConfig(
            analysis_type=analysis_type_enum,
            depth=depth,
            skill_level=skill_level
        )
        engine.config = config

        processed = 0
        failed = 0

        # Process games in parallel with proper concurrency control
        max_concurrent = min(5, len(games))  # Limit concurrent games to prevent resource exhaustion
        semaphore = asyncio.Semaphore(max_concurrent)

        async def analyze_with_semaphore(game):
            async with semaphore:
                return await _analyze_single_game(engine, game, canonical_user_id, platform, analysis_type_enum)

        # Process all games in parallel with concurrency limit
        tasks = [analyze_with_semaphore(game) for game in games]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for i, result in enumerate(batch_results):
            if isinstance(result, Exception):
                print(f"Error analyzing game {i + 1}: {result}")
                failed += 1
            elif result:
                processed += 1
                print(f"Successfully analyzed game {i + 1}/{len(games)} with {analysis_type} analysis")
            else:
                failed += 1
                print(f"Failed to analyze game {i + 1}/{len(games)}")

            # Update progress
            progress = int(((i + 1) / len(games)) * 70) + 20  # 20-90% range
            analysis_progress[key].update({
                "analyzed_games": i + 1,
                "progress_percentage": progress,
                "current_phase": "analyzing"
            })

        # Phase 3: Complete
        analysis_progress[key].update({
            "is_complete": True,
            "current_phase": "complete",
            "progress_percentage": 100
        })

        print(f"Batch analysis complete for {user_id}! Processed: {processed}, Failed: {failed}")

    except Exception as e:
        print(f"ERROR in batch analysis: {e}")
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
            # Save to appropriate table based on analysis type
            # Save analysis to move_analyses table (all analysis types now use Stockfish)
            await save_stockfish_analysis(game_analysis)
            return game_analysis
        else:
            return None

    except Exception as e:
        print(f"ERROR analyzing game {game.get('provider_game_id', 'unknown')}: {e}")
        return None


async def save_stockfish_analysis(analysis: GameAnalysis) -> bool:
    """Save Stockfish analysis to move_analyses table."""
    try:
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(analysis.user_id, analysis.platform)

        # Convert moves analysis to dict format
        moves_analysis_dict = []
        for move in analysis.moves_analysis:
            moves_analysis_dict.append({
                'move': move.move,
                'move_san': move.move_san,
                'evaluation': move.evaluation,
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
                'opening_ply': move.ply_index,  # Add opening_ply field for opening accuracy calculation
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

        # Prepare data for move_analyses table
        data = {
            'game_id': analysis.game_id,
            'user_id': canonical_user_id,
            'platform': analysis.platform,
            'average_centipawn_loss': analysis.average_centipawn_loss,
            'worst_blunder_centipawn_loss': analysis.worst_blunder_centipawn_loss,
            'best_move_percentage': analysis.accuracy,  # Map accuracy to best_move_percentage
            'middle_game_accuracy': analysis.middle_game_accuracy,
            'endgame_accuracy': analysis.endgame_accuracy,
            'time_management_score': analysis.time_management_score,
            'material_sacrifices': analysis.brilliant_moves,  # Map brilliant_moves to material_sacrifices
            'aggressiveness_index': analysis.aggressive_score,  # Map aggressive_score to aggressiveness_index
            'average_evaluation': getattr(analysis, 'average_evaluation', 0.0),
            'tactical_score': analysis.tactical_score,
            'positional_score': analysis.positional_score,
            'aggressive_score': analysis.aggressive_score,
            'patient_score': analysis.patient_score,
            'novelty_score': getattr(analysis, 'novelty_score', 0.0),
            'staleness_score': getattr(analysis, 'staleness_score', 0.0),
            'tactical_patterns': analysis.tactical_patterns,
            'positional_patterns': analysis.positional_patterns,
            'strategic_themes': analysis.strategic_themes,
            'moves_analysis': moves_analysis_dict,
            'analysis_method': str(analysis.analysis_type),
            'analysis_date': analysis.analysis_date.isoformat(),
            'processing_time_ms': analysis.processing_time_ms,
            'stockfish_depth': analysis.stockfish_depth
        }

        # Insert or update analysis in move_analyses table using service role
        response = await asyncio.to_thread(
            lambda: supabase_service.table('move_analyses').upsert(
                data,
                on_conflict='user_id,platform,game_id'
            ).execute()
        )

        if response.data:
            print(f"Successfully saved Stockfish analysis for game {analysis.game_id}")
            return True
        else:
            print(f"Failed to save Stockfish analysis for game {analysis.game_id}")
            return False

    except Exception as e:
        print(f"Error saving Stockfish analysis: {e}")
        return False

async def save_game_analysis(analysis: GameAnalysis) -> bool:
    """Save game analysis to move_analyses table only."""
    try:
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(analysis.user_id, analysis.platform)

        # Convert moves analysis to dict format
        moves_analysis_dict = []
        for move in analysis.moves_analysis:
            moves_analysis_dict.append({
                'move': move.move,
                'move_san': move.move_san,
                'evaluation': move.evaluation,
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
                'opening_ply': move.ply_index,  # Add opening_ply field for opening accuracy calculation
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

        # Prepare data for game_analyses table
        data = {
            'game_id': analysis.game_id,
            'user_id': canonical_user_id,
            'platform': analysis.platform,
            'total_moves': analysis.total_moves,
            'accuracy': analysis.accuracy,
            'blunders': analysis.blunders,
            'mistakes': analysis.mistakes,
            'inaccuracies': analysis.inaccuracies,
            'brilliant_moves': analysis.brilliant_moves,
            'best_moves': analysis.best_moves,
            'opening_accuracy': analysis.opening_accuracy,
            'middle_game_accuracy': analysis.middle_game_accuracy,
            'endgame_accuracy': analysis.endgame_accuracy,
            'average_centipawn_loss': analysis.average_centipawn_loss,
            'worst_blunder_centipawn_loss': analysis.worst_blunder_centipawn_loss,
            'time_management_score': analysis.time_management_score,
            'tactical_score': analysis.tactical_score,
            'positional_score': analysis.positional_score,
            'aggressive_score': analysis.aggressive_score,
            'patient_score': analysis.patient_score,
            'novelty_score': getattr(analysis, 'novelty_score', 0.0),
            'staleness_score': getattr(analysis, 'staleness_score', 0.0),
            'tactical_patterns': analysis.tactical_patterns,
            'positional_patterns': analysis.positional_patterns,
            'strategic_themes': analysis.strategic_themes,
            'moves_analysis': moves_analysis_dict,
            'analysis_type': str(analysis.analysis_type),
            'analysis_date': analysis.analysis_date.isoformat(),
            'processing_time_ms': analysis.processing_time_ms,
            'stockfish_depth': analysis.stockfish_depth
        }

        # Insert or update analysis in game_analyses table using service role
        response = await asyncio.to_thread(
            lambda: supabase_service.table('game_analyses').upsert(
                data,
                on_conflict='user_id,platform,game_id'
            ).execute()
        )

        if response.data:
            print(f"Successfully saved analysis for game {analysis.game_id}")
            return True
        else:
            print(f"Failed to save analysis for game {analysis.game_id}")
            return False

    except Exception as e:
        print(f"Error saving game analysis: {e}")
        return False

# Helper functions
def _canonical_user_id(user_id: str, platform: str) -> str:
    """Canonicalize user ID for database operations.

    Chess.com usernames are case-insensitive and should be stored/queried in lowercase.
    Lichess usernames are case-sensitive and should be left unchanged.
    """
    if platform == "chess.com":
        return user_id.strip().lower()
    else:  # lichess
        return user_id.strip()

# API Endpoints

@app.get("/")
async def root():
    return {
        "message": "Legacy Chess Analysis API is running!",
        "version": "2.0.0",
        "status": "deprecated",
        "warning": "⚠️ This API is deprecated. Please migrate to the Unified API at /api/v1/*",
        "migration_url": "/api/v1/",
        "features": ["position_analysis", "move_analysis", "game_analysis", "batch_analysis"],
        "deprecated_endpoints": [
            "/analyze-games → /api/v1/analyze",
            "/analyze-position → /api/v1/analyze",
            "/analyze-move → /api/v1/analyze",
            "/analyze-game → /api/v1/analyze",
            "/analysis/{user_id}/{platform} → /api/v1/results/{user_id}/{platform}",
            "/analysis-stats/{user_id}/{platform} → /api/v1/stats/{user_id}/{platform}",
            "/analysis-progress/{user_id}/{platform} → /api/v1/progress/{user_id}/{platform}"
        ]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    engine = get_analysis_engine()
    stockfish_available = engine.stockfish_path is not None

    return {
        "status": "healthy",
        "service": "unified-chess-analysis-api",
        "stockfish_available": stockfish_available,
        "analysis_types": ["stockfish", "deep"]
    }

@app.get("/proxy/chess-com/{username}/games/{year}/{month}")
async def proxy_chess_com_games(username: str, year: int, month: int):
    """Proxy endpoint for Chess.com API to avoid CORS issues."""
    import httpx

    try:
        url = f"https://api.chess.com/pub/player/{username}/games/{year}/{month}"
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
        url = f"https://api.chess.com/pub/player/{username}"
        print(f"Proxying user request to: {url}")

        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30.0)

            if response.status_code == 200:
                return response.json()
            else:
                print(f"Chess.com API returned status {response.status_code}")
                return {"success": False, "message": f"User not found or API returned status {response.status_code}"}

    except Exception as e:
        print(f"Error proxying Chess.com user request: {e}")
        return {"success": False, "message": str(e)}

@app.post("/analyze-games", response_model=AnalysisResponse, deprecated=True)
async def analyze_games(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks
):
    """
    Start batch analysis for a user's games.

    ⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version.
    Please migrate to: POST /api/v1/analyze

    Migration guide:
    - Replace with: POST /api/v1/analyze
    - Add 'pgn' field for single game analysis
    - Add 'fen' field for position analysis
    - Add 'move' field for move analysis
    """
    try:
        # Validate analysis type
        if request.analysis_type not in ["stockfish", "deep"]:
            raise ValidationError("Invalid analysis_type. Must be 'stockfish' or 'deep'", "analysis_type")

        # Validate user_id and platform
        if not request.user_id or not isinstance(request.user_id, str):
            raise ValidationError("User ID must be a non-empty string", "user_id")

        if request.platform not in ["lichess", "chess.com"]:
            raise ValidationError("Platform must be 'lichess' or 'chess.com'", "platform")

        # Start analysis in background
        background_tasks.add_task(
            perform_batch_analysis,
            request.user_id,
            request.platform,
            request.analysis_type,
            request.limit,
            request.depth,
            request.skill_level
        )

        return AnalysisResponse(
            success=True,
            message=f"Analysis started for {request.user_id} on {request.platform} using {request.analysis_type} analysis",
            analysis_id=f"{request.user_id}_{request.platform}_{datetime.now().timestamp()}"
        )
    except ValidationError as e:
        raise e
    except Exception as e:
        raise AnalysisError(f"Failed to start batch analysis: {str(e)}", "batch")

@app.post("/analyze-position", response_model=PositionAnalysisResult, deprecated=True)
async def analyze_position(request: PositionAnalysisRequest):
    """
    Analyze a chess position.

    ⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version.
    Please migrate to: POST /api/v1/analyze

    Migration guide:
    - Replace with: POST /api/v1/analyze
    - Add 'fen' field to request body
    - All other parameters remain the same
    """
    try:
        engine = get_analysis_engine()

        # Configure analysis type
        analysis_type_enum = AnalysisType(request.analysis_type)
        config = AnalysisConfig(
            analysis_type=analysis_type_enum,
            depth=request.depth
        )
        engine.config = config

        result = await engine.analyze_position(request.fen, analysis_type_enum)

        return PositionAnalysisResult(
            evaluation=result['evaluation'],
            best_move=result.get('best_move'),
            fen=result['fen'],
            analysis_type=result['analysis_type'],
            depth=result.get('depth')
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-move", response_model=MoveAnalysisResult, deprecated=True)
async def analyze_move(request: MoveAnalysisRequest):
    """
    Analyze a specific move in a position.

    ⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version.
    Please migrate to: POST /api/v1/analyze

    Migration guide:
    - Replace with: POST /api/v1/analyze
    - Add 'fen' and 'move' fields to request body
    - All other parameters remain the same
    """
    try:
        import chess

        engine = get_analysis_engine()

        # Configure analysis type
        analysis_type_enum = AnalysisType(request.analysis_type)
        config = AnalysisConfig(
            analysis_type=analysis_type_enum,
            depth=request.depth
        )
        engine.config = config

        # Parse position and move
        board = chess.Board(request.fen)
        move = chess.Move.from_uci(request.move)

        result = await engine.analyze_move(board, move, analysis_type_enum)

        return MoveAnalysisResult(
            move=result.move,
            move_san=result.move_san,
            evaluation=result.evaluation,
            best_move=result.best_move,
            is_best=result.is_best,
            is_blunder=result.is_blunder,
            is_mistake=result.is_mistake,
            is_inaccuracy=result.is_inaccuracy,
            centipawn_loss=result.centipawn_loss,
            depth_analyzed=result.depth_analyzed
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-game", response_model=AnalysisResponse, deprecated=True)
async def analyze_game(request: GameAnalysisRequest):
    """
    Analyze a single game from PGN.

    ⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version.
    Please migrate to: POST /api/v1/analyze

    Migration guide:
    - Replace with: POST /api/v1/analyze
    - Add 'pgn' field to request body
    - All other parameters remain the same
    """
    try:
        engine = get_analysis_engine()

        # Configure analysis type
        analysis_type_enum = AnalysisType(request.analysis_type)
        config = AnalysisConfig(
            analysis_type=analysis_type_enum,
            depth=request.depth
        )
        engine.config = config

        # Analyze game
        game_analysis = await engine.analyze_game(
            request.pgn,
            request.user_id,
            request.platform,
            analysis_type_enum
        )

        if game_analysis:
            # Save to database
            success = await save_game_analysis(game_analysis)
            if success:
                return AnalysisResponse(
                    success=True,
                    message=f"Game analysis completed and saved",
                    analysis_id=game_analysis.game_id
                )
            else:
                return AnalysisResponse(
                    success=False,
                    message="Game analysis completed but failed to save to database"
                )
        else:
            return AnalysisResponse(
                success=False,
                message="Failed to analyze game"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analysis/{user_id}/{platform}", response_model=List[GameAnalysisSummary], deprecated=True)
async def get_analysis_results(
    user_id: str,
    platform: str,
    limit: int = Query(10, ge=1, le=100),
    analysis_type: str = Query("stockfish"),
    # Optional authentication - can be enabled via config
    _: Optional[bool] = Depends(verify_user_access) if config.api.auth_enabled else None
):
    """
    Get analysis results for a user from appropriate table based on analysis type.

    ⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version.
    Please migrate to: GET /api/v1/results/{user_id}/{platform}

    Migration guide:
    - Replace with: GET /api/v1/results/{user_id}/{platform}
    - All parameters remain the same
    - Response format is identical
    """
    try:
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)

        if not supabase_service or not supabase:
            raise HTTPException(status_code=503, detail="Supabase not configured")

        # Use unified view for consistent data access
        if analysis_type in ["stockfish", "deep"]:
            # Filter by analysis type in the unified view
            response = await asyncio.to_thread(
                lambda: supabase_service.table('unified_analyses').select('*').eq(
                    'user_id', canonical_user_id
                ).eq('platform', platform).eq(
                    'analysis_type', analysis_type
                ).order(
                    'analysis_date', desc=True
                ).limit(limit).execute()
            )
        else:
            # Use stockfish analysis type as default
            response = await asyncio.to_thread(
                lambda: supabase.table('unified_analyses').select('*').eq(
                    'user_id', canonical_user_id
                ).eq('platform', platform).eq(
                    'analysis_type', 'stockfish'
                ).order(
                    'analysis_date', desc=True
                ).limit(limit).execute()
            )

        if not response.data:
            return []

        results = []
        for analysis in response.data:
            # Use simplified mapping since unified view provides consistent fields
            results.append(map_unified_analysis_to_response(analysis))

        return results
    except Exception as e:
        print(f"Error fetching analysis results: {e}")
        return []

@app.get("/analysis-stats/{user_id}/{platform}", deprecated=True)
async def get_analysis_stats(
    user_id: str,
    platform: str,
    analysis_type: str = Query("stockfish"),
    # Optional authentication - can be enabled via config
    _: Optional[bool] = Depends(verify_user_access) if config.api.auth_enabled else None
):
    """
    Get analysis statistics for a user.

    ⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version.
    Please migrate to: GET /api/v1/stats/{user_id}/{platform}

    Migration guide:
    - Replace with: GET /api/v1/stats/{user_id}/{platform}
    - All parameters remain the same
    - Response format is identical
    """
    """Get analysis statistics for a user from appropriate table based on analysis type."""
    try:
        # Canonicalize user ID for database operations
        canonical_user_id = _canonical_user_id(user_id, platform)

        if not supabase_service or not supabase:
            raise HTTPException(status_code=503, detail="Supabase not configured")

        # Use unified view for consistent data access
        if analysis_type in ["stockfish", "deep"]:
            response = await asyncio.to_thread(
                lambda: supabase_service.table('unified_analyses').select('*').eq(
                    'user_id', canonical_user_id
                ).eq('platform', platform).eq(
                    'analysis_type', analysis_type
                ).execute()
            )
        else:
            response = await asyncio.to_thread(
                lambda: supabase.table('unified_analyses').select('*').eq(
                    'user_id', canonical_user_id
                ).eq('platform', platform).eq(
                    'analysis_type', 'stockfish'
                ).execute()
            )

        if not response.data:
            return {
                "total_games_analyzed": 0,
                "average_accuracy": 0,
                "total_blunders": 0,
                "total_mistakes": 0,
                "total_inaccuracies": 0,
                "total_brilliant_moves": 0,
                "total_material_sacrifices": 0,
                "average_opening_accuracy": 0,
                "average_middle_game_accuracy": 0,
                "average_endgame_accuracy": 0,
                "average_aggressiveness_index": 0,
                "blunders_per_game": 0,
                "mistakes_per_game": 0,
                "inaccuracies_per_game": 0,
                "brilliant_moves_per_game": 0,
                "material_sacrifices_per_game": 0
            }

        # Use unified stats calculation
        return calculate_unified_stats(response.data, analysis_type)
    except Exception as e:
        print(f"Error fetching analysis stats: {e}")
        return {
            "total_games_analyzed": 0,
            "average_accuracy": 0,
            "total_blunders": 0,
            "total_mistakes": 0,
            "total_inaccuracies": 0,
            "total_brilliant_moves": 0,
            "total_material_sacrifices": 0,
            "average_opening_accuracy": 0,
            "average_middle_game_accuracy": 0,
            "average_endgame_accuracy": 0,
            "average_aggressiveness_index": 0,
            "blunders_per_game": 0,
            "mistakes_per_game": 0,
            "inaccuracies_per_game": 0,
            "brilliant_moves_per_game": 0,
            "material_sacrifices_per_game": 0
        }

@app.get("/analysis-progress/{user_id}/{platform}", response_model=AnalysisProgress, deprecated=True)
async def get_analysis_progress(
    user_id: str,
    platform: str,
    # Optional authentication - can be enabled via config
    _: Optional[bool] = Depends(verify_user_access) if config.api.auth_enabled else None
):
    """
    Get analysis progress for a user.

    ⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version.
    Please migrate to: GET /api/v1/progress/{user_id}/{platform}

    Migration guide:
    - Replace with: GET /api/v1/progress/{user_id}/{platform}
    - All parameters remain the same
    - Response format is identical
    """
    canonical_user_id = _canonical_user_id(user_id, platform)
    platform_key = platform.strip().lower()
    key = f"{canonical_user_id}_{platform_key}"

    if key not in analysis_progress:
        return AnalysisProgress(
            analyzed_games=0,
            total_games=10,
            progress_percentage=0,
            is_complete=False,
            current_phase="not_started"
        )

    progress = analysis_progress[key]
    return AnalysisProgress(
        analyzed_games=progress["analyzed_games"],
        total_games=progress["total_games"],
        progress_percentage=progress["progress_percentage"],
        is_complete=progress["is_complete"],
        current_phase=progress["current_phase"],
        estimated_time_remaining=progress.get("estimated_time_remaining")
    )

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Unified Chess Analysis API Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=config.api.port, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")

    args = parser.parse_args()

    print(f"Starting Unified Chess Analysis API Server on {args.host}:{args.port}")
    print("This server provides comprehensive chess analysis capabilities!")
    print("Available analysis types: stockfish, deep")

    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)
