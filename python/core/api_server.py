#!/usr/bin/env python3
"""
Unified Chess Analysis API Server
Provides a single, comprehensive API for all chess analysis operations.
Supports both basic and Stockfish analysis with real-time progress tracking.
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

# Initialize Supabase clients
supabase: Client = create_client(str(config.database.url), config.database.anon_key)

# Use service role key for move_analyses operations if available, otherwise fall back to anon key
if config.database.service_role_key:
    supabase_service: Client = create_client(str(config.database.url), config.database.service_role_key)
    print("✅ Using service role key for move_analyses operations")
else:
    supabase_service: Client = supabase  # Fall back to anon key
    print("⚠️  Service role key not found, using anon key for move_analyses operations (may cause RLS issues)")

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
    description="Comprehensive chess analysis API supporting basic and Stockfish analysis"
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

# Pydantic models
class AnalysisRequest(BaseModel):
    user_id: str = Field(..., description="User ID to analyze games for")
    platform: str = Field(..., description="Platform (lichess, chess.com, etc.)")
    analysis_type: str = Field("stockfish", description="Type of analysis: basic, stockfish, or deep")
    limit: Optional[int] = Field(10, description="Maximum number of games to analyze")
    depth: Optional[int] = Field(8, description="Analysis depth for Stockfish")
    skill_level: Optional[int] = Field(8, description="Stockfish skill level (0-20)")

class PositionAnalysisRequest(BaseModel):
    fen: str = Field(..., description="FEN string of the position to analyze")
    analysis_type: str = Field("stockfish", description="Type of analysis: basic, stockfish, or deep")
    depth: Optional[int] = Field(8, description="Analysis depth for Stockfish")

class MoveAnalysisRequest(BaseModel):
    fen: str = Field(..., description="FEN string of the position")
    move: str = Field(..., description="Move in UCI format (e.g., e2e4)")
    analysis_type: str = Field("stockfish", description="Type of analysis: basic, stockfish, or deep")
    depth: Optional[int] = Field(8, description="Analysis depth for Stockfish")

class GameAnalysisRequest(BaseModel):
    pgn: str = Field(..., description="PGN string of the game to analyze")
    user_id: str = Field(..., description="User ID")
    platform: str = Field(..., description="Platform")
    analysis_type: str = Field("stockfish", description="Type of analysis: basic, stockfish, or deep")
    depth: Optional[int] = Field(8, description="Analysis depth for Stockfish")

class AnalysisResponse(BaseModel):
    success: bool
    message: str
    analysis_id: Optional[str] = None

class GameAnalysisSummary(BaseModel):
    game_id: str
    accuracy: float
    blunders: int
    mistakes: int
    inaccuracies: int
    brilliant_moves: int
    best_moves: int
    opening_accuracy: float
    middle_game_accuracy: float
    endgame_accuracy: float
    tactical_score: float
    positional_score: float
    aggressive_score: float
    patient_score: float
    endgame_score: float
    opening_score: float
    analysis_type: str
    analysis_date: str
    processing_time_ms: int

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

def get_analysis_engine() -> ChessAnalysisEngine:
    """Get or create the analysis engine instance."""
    global analysis_engine
    if analysis_engine is None:
        # Find Stockfish path
        stockfish_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "stockfish", "stockfish-windows-x86-64-avx2.exe")
        if not os.path.exists(stockfish_path):
            stockfish_path = None
        
        analysis_engine = ChessAnalysisEngine(stockfish_path=stockfish_path)
    return analysis_engine

def map_analysis_to_unified_response(analysis: dict, analysis_type: str) -> GameAnalysisSummary:
    """Map analysis data from different database tables to unified response format."""
    
    # Calculate missing fields from moves_analysis if available
    def calculate_missing_fields(analysis_data: dict) -> dict:
        """Calculate blunders, mistakes, inaccuracies from moves_analysis JSONB."""
        moves_analysis = analysis_data.get('moves_analysis', [])
        if not isinstance(moves_analysis, list):
            return {'blunders': 0, 'mistakes': 0, 'inaccuracies': 0, 'best_moves': 0, 'opening_accuracy': 0}
        
        blunders = sum(1 for move in moves_analysis if move.get('is_blunder', False))
        mistakes = sum(1 for move in moves_analysis if move.get('is_mistake', False))
        inaccuracies = sum(1 for move in moves_analysis if move.get('is_inaccuracy', False))
        best_moves = sum(1 for move in moves_analysis if move.get('is_best', False))
        
        # Calculate opening accuracy from moves in first 15 moves
        opening_moves = [move for move in moves_analysis if move.get('opening_ply', 0) <= 15]
        opening_accuracy = 0
        if opening_moves:
            opening_best_moves = sum(1 for move in opening_moves if move.get('is_best', False))
            opening_accuracy = round((opening_best_moves / len(opening_moves)) * 100, 1)
        
        return {
            'blunders': blunders,
            'mistakes': mistakes,
            'inaccuracies': inaccuracies,
            'best_moves': best_moves,
            'opening_accuracy': opening_accuracy
        }
    
    # Get base fields that are common across all analysis types
    base_fields = {
        'game_id': analysis.get('game_id', ''),
        'accuracy': analysis.get('accuracy', analysis.get('best_move_percentage', 0)),
        'middle_game_accuracy': analysis.get('middle_game_accuracy', 0),
        'endgame_accuracy': analysis.get('endgame_accuracy', 0),
        'tactical_score': analysis.get('tactical_score', 0),
        'positional_score': analysis.get('positional_score', 0),
        'aggressive_score': analysis.get('aggressive_score', 0),
        'patient_score': analysis.get('patient_score', 0),
        'endgame_score': analysis.get('endgame_score', 0),
        'opening_score': analysis.get('opening_score', 0),
        'analysis_type': analysis.get('analysis_type', analysis.get('analysis_method', 'unknown')),
        'analysis_date': analysis.get('analysis_date', ''),
        'processing_time_ms': analysis.get('processing_time_ms', 0)
    }
    
    if analysis_type in ["stockfish", "deep"]:
        # For Stockfish analysis (move_analyses table), calculate missing fields
        calculated_fields = calculate_missing_fields(analysis)
        
        return GameAnalysisSummary(
            game_id=base_fields['game_id'],
            accuracy=base_fields['accuracy'],
            blunders=calculated_fields['blunders'],
            mistakes=calculated_fields['mistakes'],
            inaccuracies=calculated_fields['inaccuracies'],
            brilliant_moves=analysis.get('material_sacrifices', 0),  # Map material_sacrifices to brilliant_moves
            best_moves=calculated_fields['best_moves'],
            opening_accuracy=calculated_fields['opening_accuracy'],
            middle_game_accuracy=base_fields['middle_game_accuracy'],
            endgame_accuracy=base_fields['endgame_accuracy'],
            tactical_score=base_fields['tactical_score'],
            positional_score=base_fields['positional_score'],
            aggressive_score=base_fields['aggressive_score'],
            patient_score=base_fields['patient_score'],
            endgame_score=base_fields['endgame_score'],
            opening_score=base_fields['opening_score'],
            analysis_type=base_fields['analysis_type'],
            analysis_date=base_fields['analysis_date'],
            processing_time_ms=base_fields['processing_time_ms']
        )
    else:
        # For basic analysis (game_analyses table), use direct field mapping
        return GameAnalysisSummary(
            game_id=base_fields['game_id'],
            accuracy=base_fields['accuracy'],
            blunders=analysis.get('blunders', 0),
            mistakes=analysis.get('mistakes', 0),
            inaccuracies=analysis.get('inaccuracies', 0),
            brilliant_moves=analysis.get('brilliant_moves', 0),
            best_moves=analysis.get('best_moves', 0),
            opening_accuracy=analysis.get('opening_accuracy', 0),
            middle_game_accuracy=base_fields['middle_game_accuracy'],
            endgame_accuracy=base_fields['endgame_accuracy'],
            tactical_score=base_fields['tactical_score'],
            positional_score=base_fields['positional_score'],
            aggressive_score=base_fields['aggressive_score'],
            patient_score=base_fields['patient_score'],
            endgame_score=base_fields['endgame_score'],
            opening_score=base_fields['opening_score'],
            analysis_type=base_fields['analysis_type'],
            analysis_date=base_fields['analysis_date'],
            processing_time_ms=base_fields['processing_time_ms']
        )

def calculate_unified_stats(analyses: list, analysis_type: str) -> dict:
    """Calculate unified statistics from analysis data regardless of source table."""
    if not analyses:
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
                    if move.get('is_blunder', False):
                        total_blunders += 1
                    if move.get('is_mistake', False):
                        total_mistakes += 1
                    if move.get('is_inaccuracy', False):
                        total_inaccuracies += 1
                    if move.get('is_best', False) and move.get('centipawn_loss', 0) < 10:
                        total_brilliant_moves += 1
                
                # Calculate opening accuracy for this game
                opening_moves = [move for move in moves_analysis if move.get('opening_ply', 0) <= 15]
                if opening_moves:
                    opening_best_moves = sum(1 for move in opening_moves if move.get('is_best', False))
                    total_opening_accuracy += (opening_best_moves / len(opening_moves)) * 100
        
        return {
            "total_games_analyzed": total_games,
            "average_accuracy": round(sum(a.get('best_move_percentage', a.get('accuracy', 0)) for a in analyses) / total_games, 1),
            "total_blunders": total_blunders,
            "total_mistakes": total_mistakes,
            "total_inaccuracies": total_inaccuracies,
            "total_brilliant_moves": total_brilliant_moves,
            "total_material_sacrifices": sum(a.get('material_sacrifices', 0) for a in analyses),
            "average_opening_accuracy": round(total_opening_accuracy / total_games, 1) if total_games > 0 else 0,
            "average_middle_game_accuracy": round(sum(a.get('middle_game_accuracy', 0) for a in analyses) / total_games, 1),
            "average_endgame_accuracy": round(sum(a.get('endgame_accuracy', 0) for a in analyses) / total_games, 1),
            "average_aggressiveness_index": round(sum(a.get('aggressive_score', 0) for a in analyses) / total_games, 1),
            "blunders_per_game": round(total_blunders / total_games, 2) if total_games > 0 else 0,
            "mistakes_per_game": round(total_mistakes / total_games, 2) if total_games > 0 else 0,
            "inaccuracies_per_game": round(total_inaccuracies / total_games, 2) if total_games > 0 else 0,
            "brilliant_moves_per_game": round(total_brilliant_moves / total_games, 2) if total_games > 0 else 0,
            "material_sacrifices_per_game": round(sum(a.get('material_sacrifices', 0) for a in analyses) / total_games, 2) if total_games > 0 else 0
        }
    else:
        # Calculate from game_analyses table data
        total_blunders = sum(a.get('blunders', 0) for a in analyses)
        total_mistakes = sum(a.get('mistakes', 0) for a in analyses)
        total_inaccuracies = sum(a.get('inaccuracies', 0) for a in analyses)
        total_brilliant_moves = sum(a.get('brilliant_moves', 0) for a in analyses)
        
        return {
            "total_games_analyzed": total_games,
            "average_accuracy": round(sum(a.get('accuracy', 0) for a in analyses) / total_games, 1),
            "total_blunders": total_blunders,
            "total_mistakes": total_mistakes,
            "total_inaccuracies": total_inaccuracies,
            "total_brilliant_moves": total_brilliant_moves,
            "total_material_sacrifices": 0,  # Not available in game_analyses
            "average_opening_accuracy": round(sum(a.get('opening_accuracy', 0) for a in analyses) / total_games, 1),
            "average_middle_game_accuracy": round(sum(a.get('middle_game_accuracy', 0) for a in analyses) / total_games, 1),
            "average_endgame_accuracy": round(sum(a.get('endgame_accuracy', 0) for a in analyses) / total_games, 1),
            "average_aggressiveness_index": round(sum(a.get('aggressive_score', 0) for a in analyses) / total_games, 1),
            "blunders_per_game": round(total_blunders / total_games, 2) if total_games > 0 else 0,
            "mistakes_per_game": round(total_mistakes / total_games, 2) if total_games > 0 else 0,
            "inaccuracies_per_game": round(total_inaccuracies / total_games, 2) if total_games > 0 else 0,
            "brilliant_moves_per_game": round(total_brilliant_moves / total_games, 2) if total_games > 0 else 0,
            "material_sacrifices_per_game": 0  # Not available in game_analyses
        }

def map_unified_analysis_to_response(analysis: dict) -> GameAnalysisSummary:
    """Map unified analysis data to response format (simplified since view provides consistent fields)."""
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
        endgame_score=analysis.get('endgame_score', 0),
        opening_score=analysis.get('opening_score', 0),
        analysis_type=analysis.get('analysis_type', 'unknown'),
        analysis_date=analysis.get('analysis_date', ''),
        processing_time_ms=analysis.get('processing_time_ms', 0)
    )

async def perform_batch_analysis(user_id: str, platform: str, analysis_type: str, 
                                limit: int, depth: int, skill_level: int):
    """Perform batch analysis for a user's games."""
    print(f"🚀 BACKGROUND TASK STARTED: perform_batch_analysis for {user_id} on {platform}")
    key = f"{user_id}_{platform}"
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
        
        # Get games from database (games_pgn table)
        games_response = supabase.table('games_pgn').select('*').eq('user_id', user_id).eq('platform', platform).limit(limit).execute()
        games = games_response.data or []
        
        if not games:
            print(f"No games found for {user_id} on {platform}")
            analysis_progress[key].update({
                "is_complete": True,
                "current_phase": "complete",
                "progress_percentage": 100
            })
            return
        
        print(f"Found {len(games)} games to analyze")
        
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
                return await _analyze_single_game(engine, game, user_id, platform, analysis_type_enum)
        
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
        print(f"❌ ERROR in batch analysis: {e}")
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
            if analysis_type_enum == AnalysisType.STOCKFISH or analysis_type_enum == AnalysisType.DEEP:
                # Save Stockfish analysis to move_analyses table
                await save_stockfish_analysis(game_analysis)
            else:
                # Save basic analysis to game_analyses table
                await save_basic_analysis(game_analysis)
            return game_analysis
        else:
            return None
            
    except Exception as e:
        print(f"❌ ERROR analyzing game {game.get('provider_game_id', 'unknown')}: {e}")
        return None

async def save_basic_analysis(analysis: GameAnalysis) -> bool:
    """Save basic analysis to game_analyses table."""
    try:
        # Convert moves analysis to dict format
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
                'centipawn_loss': move.centipawn_loss,
                'depth_analyzed': move.depth_analyzed
            })
        
        # Prepare data for game_analyses table
        data = {
            'game_id': analysis.game_id,
            'user_id': analysis.user_id,
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
            'endgame_score': analysis.endgame_score,
            'opening_score': analysis.opening_score,
            'tactical_patterns': analysis.tactical_patterns,
            'positional_patterns': analysis.positional_patterns,
            'strategic_themes': analysis.strategic_themes,
            'moves_analysis': moves_analysis_dict,
            'analysis_type': str(analysis.analysis_type),
            'analysis_date': analysis.analysis_date.isoformat(),
            'processing_time_ms': analysis.processing_time_ms,
            'stockfish_depth': analysis.stockfish_depth
        }
        
        # Insert or update analysis in game_analyses table
        response = supabase.table('game_analyses').upsert(
            data,
            on_conflict='user_id,platform,game_id'
        ).execute()
        
        if response.data:
            print(f"Successfully saved basic analysis for game {analysis.game_id}")
            return True
        else:
            print(f"Failed to save basic analysis for game {analysis.game_id}")
            return False
            
    except Exception as e:
        print(f"Error saving basic analysis: {e}")
        return False

async def save_stockfish_analysis(analysis: GameAnalysis) -> bool:
    """Save Stockfish analysis to move_analyses table."""
    try:
        # Convert moves analysis to dict format
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
                'centipawn_loss': move.centipawn_loss,
                'depth_analyzed': move.depth_analyzed
            })
        
        # Prepare data for move_analyses table
        data = {
            'game_id': analysis.game_id,
            'user_id': analysis.user_id,
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
            'endgame_score': analysis.endgame_score,
            'opening_score': analysis.opening_score,
            'tactical_patterns': analysis.tactical_patterns,
            'positional_patterns': analysis.positional_patterns,
            'strategic_themes': analysis.strategic_themes,
            'moves_analysis': moves_analysis_dict,
            'analysis_method': analysis.analysis_type.value if hasattr(analysis.analysis_type, 'value') else str(analysis.analysis_type),
            'analysis_date': analysis.analysis_date.isoformat(),
            'processing_time_ms': analysis.processing_time_ms,
            'stockfish_depth': analysis.stockfish_depth
        }
        
        # Insert or update analysis in move_analyses table using service role
        response = supabase_service.table('move_analyses').upsert(
            data,
            on_conflict='user_id,platform,game_id'
        ).execute()
        
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
        # Convert moves analysis to dict format
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
                'centipawn_loss': move.centipawn_loss,
                'depth_analyzed': move.depth_analyzed
            })
        
        # Prepare data for game_analyses table
        data = {
            'game_id': analysis.game_id,
            'user_id': analysis.user_id,
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
            'endgame_score': analysis.endgame_score,
            'opening_score': analysis.opening_score,
            'tactical_patterns': analysis.tactical_patterns,
            'positional_patterns': analysis.positional_patterns,
            'strategic_themes': analysis.strategic_themes,
            'moves_analysis': moves_analysis_dict,
            'analysis_type': str(analysis.analysis_type),
            'analysis_date': analysis.analysis_date.isoformat(),
            'processing_time_ms': analysis.processing_time_ms,
            'stockfish_depth': analysis.stockfish_depth
        }
        
        # Insert or update analysis in game_analyses table
        response = supabase.table('game_analyses').upsert(
            data,
            on_conflict='user_id,platform,game_id'
        ).execute()
        
        if response.data:
            print(f"Successfully saved analysis for game {analysis.game_id}")
            return True
        else:
            print(f"Failed to save analysis for game {analysis.game_id}")
            return False
            
    except Exception as e:
        print(f"Error saving game analysis: {e}")
        return False

# API Endpoints

@app.get("/")
async def root():
    return {
        "message": "Unified Chess Analysis API is running!",
        "version": "2.0.0",
        "features": ["position_analysis", "move_analysis", "game_analysis", "batch_analysis"]
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
        "analysis_types": ["basic", "stockfish", "deep"]
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
                return {"error": f"User not found or API returned status {response.status_code}"}
                
    except Exception as e:
        print(f"Error proxying Chess.com user request: {e}")
        return {"error": str(e)}

@app.post("/analyze-games", response_model=AnalysisResponse)
async def analyze_games(
    request: AnalysisRequest, 
    background_tasks: BackgroundTasks
):
    """Start batch analysis for a user's games."""
    try:
        # Validate analysis type
        if request.analysis_type not in ["basic", "stockfish", "deep"]:
            raise ValidationError("Invalid analysis_type. Must be 'basic', 'stockfish', or 'deep'", "analysis_type")
        
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

@app.post("/analyze-position", response_model=PositionAnalysisResult)
async def analyze_position(request: PositionAnalysisRequest):
    """Analyze a chess position."""
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

@app.post("/analyze-move", response_model=MoveAnalysisResult)
async def analyze_move(request: MoveAnalysisRequest):
    """Analyze a specific move in a position."""
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

@app.post("/analyze-game", response_model=AnalysisResponse)
async def analyze_game(request: GameAnalysisRequest):
    """Analyze a single game from PGN."""
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

@app.get("/analysis/{user_id}/{platform}", response_model=List[GameAnalysisSummary])
async def get_analysis_results(
    user_id: str, 
    platform: str, 
    limit: int = Query(10, ge=1, le=100), 
    analysis_type: str = Query("basic"),
    # Optional authentication - can be enabled via config
    _: Optional[bool] = Depends(verify_user_access) if config.api.auth_enabled else None
):
    """Get analysis results for a user from appropriate table based on analysis type."""
    try:
        # Use unified view for consistent data access
        if analysis_type in ["stockfish", "deep"]:
            # Filter by analysis type in the unified view
            response = supabase_service.table('unified_analyses').select('*').eq(
                'user_id', user_id
            ).eq('platform', platform).eq(
                'analysis_type', analysis_type
            ).order(
                'analysis_date', desc=True
            ).limit(limit).execute()
        else:
            # Use basic analysis type
            response = supabase.table('unified_analyses').select('*').eq(
                'user_id', user_id
            ).eq('platform', platform).eq(
                'analysis_type', 'basic'
            ).order(
                'analysis_date', desc=True
            ).limit(limit).execute()
        
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

@app.get("/analysis-stats/{user_id}/{platform}")
async def get_analysis_stats(
    user_id: str, 
    platform: str, 
    analysis_type: str = Query("basic"),
    # Optional authentication - can be enabled via config
    _: Optional[bool] = Depends(verify_user_access) if config.api.auth_enabled else None
):
    """Get analysis statistics for a user from appropriate table based on analysis type."""
    try:
        # Use unified view for consistent data access
        if analysis_type in ["stockfish", "deep"]:
            response = supabase_service.table('unified_analyses').select('*').eq(
                'user_id', user_id
            ).eq('platform', platform).eq(
                'analysis_type', analysis_type
            ).execute()
        else:
            response = supabase.table('unified_analyses').select('*').eq(
                'user_id', user_id
            ).eq('platform', platform).eq(
                'analysis_type', 'basic'
            ).execute()
        
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

@app.get("/analysis-progress/{user_id}/{platform}", response_model=AnalysisProgress)
async def get_analysis_progress(
    user_id: str, 
    platform: str,
    # Optional authentication - can be enabled via config
    _: Optional[bool] = Depends(verify_user_access) if config.api.auth_enabled else None
):
    """Get analysis progress for a user."""
    key = f"{user_id}_{platform}"
    
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
    print("Available analysis types: basic, stockfish, deep")
    
    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)
