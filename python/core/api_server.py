#!/usr/bin/env python3
"""
Unified Chess Analysis API Server
Provides a single, comprehensive API for all chess analysis operations.
Supports both basic and Stockfish analysis with real-time progress tracking.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uvicorn
import asyncio
import os
import sys
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Import our unified analysis engine
from .analysis_engine import ChessAnalysisEngine, AnalysisConfig, AnalysisType, GameAnalysis

# Load environment variables
load_dotenv()

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables")

supabase: Client = create_client(supabase_url, supabase_key)

# FastAPI app
app = FastAPI(
    title="Unified Chess Analysis API",
    version="2.0.0",
    description="Comprehensive chess analysis API supporting basic and Stockfish analysis"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
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
    depth: Optional[int] = Field(15, description="Analysis depth for Stockfish")
    skill_level: Optional[int] = Field(20, description="Stockfish skill level (0-20)")

class PositionAnalysisRequest(BaseModel):
    fen: str = Field(..., description="FEN string of the position to analyze")
    analysis_type: str = Field("stockfish", description="Type of analysis: basic, stockfish, or deep")
    depth: Optional[int] = Field(15, description="Analysis depth for Stockfish")

class MoveAnalysisRequest(BaseModel):
    fen: str = Field(..., description="FEN string of the position")
    move: str = Field(..., description="Move in UCI format (e.g., e2e4)")
    analysis_type: str = Field("stockfish", description="Type of analysis: basic, stockfish, or deep")
    depth: Optional[int] = Field(15, description="Analysis depth for Stockfish")

class GameAnalysisRequest(BaseModel):
    pgn: str = Field(..., description="PGN string of the game to analyze")
    user_id: str = Field(..., description="User ID")
    platform: str = Field(..., description="Platform")
    analysis_type: str = Field("stockfish", description="Type of analysis: basic, stockfish, or deep")
    depth: Optional[int] = Field(15, description="Analysis depth for Stockfish")

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

async def perform_batch_analysis(user_id: str, platform: str, analysis_type: str, 
                                limit: int, depth: int, skill_level: int):
    """Perform batch analysis for a user's games."""
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
        
        # Get games from database
        games_response = supabase.table('games').select('*').eq('user_id', user_id).eq('platform', platform).limit(limit).execute()
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
        
        for i, game in enumerate(games):
            try:
                # Get PGN data
                pgn_response = supabase.table('games_pgn').select('pgn').eq(
                    'user_id', user_id
                ).eq('platform', platform).eq(
                    'provider_game_id', game['provider_game_id']
                ).execute()
                
                if not pgn_response.data or not pgn_response.data[0].get('pgn'):
                    print(f"No PGN data for game {game.get('provider_game_id', 'unknown')}")
                    failed += 1
                    continue
                
                pgn_data = pgn_response.data[0]['pgn']
                
                # Analyze game
                game_analysis = await engine.analyze_game(pgn_data, user_id, platform, analysis_type_enum)
                
                if game_analysis:
                    # Save to database
                    await save_game_analysis(game_analysis)
                    processed += 1
                    print(f"Successfully analyzed game {i+1}/{len(games)}")
                else:
                    failed += 1
                    print(f"Failed to analyze game {i+1}/{len(games)}")
                
                # Update progress
                progress = int(((i + 1) / len(games)) * 70) + 20  # 20-90% range
                analysis_progress[key].update({
                    "analyzed_games": i + 1,
                    "progress_percentage": progress,
                    "current_phase": "analyzing"
                })
                
                # Small delay to prevent overwhelming the system
                await asyncio.sleep(0.1)
                
            except Exception as e:
                print(f"Error analyzing game {i+1}: {e}")
                failed += 1
                continue
        
        # Phase 3: Complete
        analysis_progress[key].update({
            "is_complete": True,
            "current_phase": "complete",
            "progress_percentage": 100
        })
        
        print(f"Batch analysis complete for {user_id}! Processed: {processed}, Failed: {failed}")
        
    except Exception as e:
        print(f"Error in batch analysis: {e}")
        analysis_progress[key].update({
            "is_complete": True,
            "current_phase": "error",
            "progress_percentage": 100
        })

async def save_game_analysis(analysis: GameAnalysis) -> bool:
    """Save game analysis to the database."""
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
        
        # Prepare data for insertion
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
            'analysis_type': analysis.analysis_type,
            'analysis_date': analysis.analysis_date.isoformat(),
            'processing_time_ms': analysis.processing_time_ms,
            'stockfish_depth': analysis.stockfish_depth
        }
        
        # Insert or update analysis
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

@app.post("/analyze-games", response_model=AnalysisResponse)
async def analyze_games(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Start batch analysis for a user's games."""
    try:
        # Validate analysis type
        if request.analysis_type not in ["basic", "stockfish", "deep"]:
            raise HTTPException(status_code=400, detail="Invalid analysis_type. Must be 'basic', 'stockfish', or 'deep'")
        
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
async def get_analysis_results(user_id: str, platform: str, limit: int = Query(10, ge=1, le=100)):
    """Get analysis results for a user."""
    try:
        response = supabase.table('game_analyses').select('*').eq(
            'user_id', user_id
        ).eq('platform', platform).order(
            'analysis_date', desc=True
        ).limit(limit).execute()
        
        if not response.data:
            return []
        
        results = []
        for analysis in response.data:
            results.append(GameAnalysisSummary(
                game_id=analysis['game_id'],
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
            ))
        
        return results
    except Exception as e:
        print(f"Error fetching analysis results: {e}")
        return []

@app.get("/analysis-stats/{user_id}/{platform}")
async def get_analysis_stats(user_id: str, platform: str):
    """Get analysis statistics for a user."""
    try:
        response = supabase.table('game_analyses').select('*').eq(
            'user_id', user_id
        ).eq('platform', platform).execute()
        
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
        
        analyses = response.data
        total_games = len(analyses)
        
        # Calculate additional metrics
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
            "total_material_sacrifices": 0,  # Placeholder - not calculated yet
            "average_opening_accuracy": round(sum(a.get('opening_accuracy', 0) for a in analyses) / total_games, 1),
            "average_middle_game_accuracy": round(sum(a.get('middle_game_accuracy', 0) for a in analyses) / total_games, 1),
            "average_endgame_accuracy": round(sum(a.get('endgame_accuracy', 0) for a in analyses) / total_games, 1),
            "average_aggressiveness_index": round(sum(a.get('aggressive_score', 0) for a in analyses) / total_games, 1),
            "blunders_per_game": round(total_blunders / total_games, 2),
            "mistakes_per_game": round(total_mistakes / total_games, 2),
            "inaccuracies_per_game": round(total_inaccuracies / total_games, 2),
            "brilliant_moves_per_game": round(total_brilliant_moves / total_games, 2),
            "material_sacrifices_per_game": 0  # Placeholder - not calculated yet
        }
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
async def get_analysis_progress(user_id: str, platform: str):
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
    print("Starting Unified Chess Analysis API Server on port 8002...")
    print("This server provides comprehensive chess analysis capabilities!")
    print("Available analysis types: basic, stockfish, deep")
    uvicorn.run(app, host="127.0.0.1", port=8002)
