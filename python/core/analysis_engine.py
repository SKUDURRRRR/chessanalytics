#!/usr/bin/env python3
"""
Unified Chess Analysis Engine
Provides a single, configurable interface for all chess analysis operations.
Supports both basic heuristic analysis and Stockfish engine analysis.
"""

import os
import sys
import asyncio
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Union
from dataclasses import dataclass
from enum import Enum
import chess
import chess.pgn
import chess.engine
import io

# Try to import stockfish package, fall back to engine if not available
try:
    from stockfish import Stockfish
    STOCKFISH_PACKAGE_AVAILABLE = True
except ImportError:
    STOCKFISH_PACKAGE_AVAILABLE = False
    print("Warning: stockfish package not available, using chess.engine only")

class AnalysisType(Enum):
    """Types of analysis available."""
    BASIC = "basic"           # Fast heuristic analysis
    STOCKFISH = "stockfish"   # Full Stockfish engine analysis
    DEEP = "deep"            # High-depth Stockfish analysis

class AnalysisMode(Enum):
    """Analysis execution modes."""
    POSITION = "position"     # Analyze single position
    MOVE = "move"            # Analyze single move
    GAME = "game"            # Analyze complete game
    BATCH = "batch"          # Analyze multiple games

@dataclass
class AnalysisConfig:
    """Configuration for analysis operations."""
    analysis_type: AnalysisType = AnalysisType.STOCKFISH
    depth: int = 8
    skill_level: int = 8
    time_limit: float = 1.0
    use_opening_book: bool = True
    use_endgame_tablebase: bool = True
    parallel_analysis: bool = False
    max_concurrent: int = 4
    
    @classmethod
    def for_basic_analysis(cls) -> 'AnalysisConfig':
        """Configuration optimized for basic analysis (fast, good accuracy)."""
        return cls(
            analysis_type=AnalysisType.STOCKFISH,
            depth=6,
            skill_level=2,
            time_limit=0.1,  # 100ms per position
            use_opening_book=True,
            use_endgame_tablebase=True,
            parallel_analysis=False,
            max_concurrent=4
        )
    
    @classmethod
    def for_deep_analysis(cls) -> 'AnalysisConfig':
        """Configuration optimized for deep analysis (thorough, high accuracy)."""
        return cls(
            analysis_type=AnalysisType.STOCKFISH,
            depth=12,
            skill_level=8,
            time_limit=0.5,  # 500ms per position
            use_opening_book=True,
            use_endgame_tablebase=True,
            parallel_analysis=False,
            max_concurrent=4
        )

@dataclass
class MoveAnalysis:
    """Result of analyzing a single move."""
    move: str
    move_san: str
    evaluation: Dict
    best_move: str
    is_best: bool
    is_blunder: bool
    is_mistake: bool
    is_inaccuracy: bool
    centipawn_loss: float
    depth_analyzed: int
    analysis_time_ms: int

@dataclass
class GameAnalysis:
    """Result of analyzing a complete game."""
    game_id: str
    user_id: str
    platform: str
    total_moves: int
    moves_analysis: List[MoveAnalysis]
    
    # Basic metrics
    accuracy: float
    blunders: int
    mistakes: int
    inaccuracies: int
    brilliant_moves: int
    best_moves: int
    
    # Phase analysis
    opening_accuracy: float
    middle_game_accuracy: float
    endgame_accuracy: float
    
    # Advanced metrics
    average_centipawn_loss: float
    worst_blunder_centipawn_loss: float
    time_management_score: float
    
    # Personality scores
    tactical_score: float
    positional_score: float
    aggressive_score: float
    patient_score: float
    novelty_score: float
    staleness_score: float
    
    # Patterns and themes
    tactical_patterns: List[Dict]
    positional_patterns: List[Dict]
    strategic_themes: List[Dict]
    
    # Metadata
    analysis_type: str
    analysis_date: datetime
    processing_time_ms: int
    stockfish_depth: int

class ChessAnalysisEngine:
    """Unified chess analysis engine supporting multiple analysis types."""
    
    def __init__(self, config: Optional[AnalysisConfig] = None, stockfish_path: Optional[str] = None):
        """Initialize the analysis engine."""
        self.config = config or AnalysisConfig()
        self.stockfish_path = self._find_stockfish_path(stockfish_path)
        self._engine_pool = []
        self._opening_database = self._load_opening_database()
        
    def _find_stockfish_path(self, custom_path: Optional[str]) -> Optional[str]:
        """Find the best available Stockfish executable."""
        if custom_path and os.path.exists(custom_path):
            return custom_path
            
        # Try common paths
        possible_paths = [
            # Windows winget installation
            os.path.expanduser("~\\AppData\\Local\\Microsoft\\WinGet\\Packages\\"
                             "Stockfish.Stockfish_Microsoft.Winget.Source_8wekyb3d8bbwe\\"
                             "stockfish\\stockfish-windows-x86-64-avx2.exe"),
            # Local stockfish directory
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "stockfish", "stockfish-windows-x86-64-avx2.exe"),
            # System PATH
            "stockfish",
            "stockfish.exe"
        ]
        
        for path in possible_paths:
            if os.path.exists(path) or (path in ["stockfish", "stockfish.exe"] and self._check_command_exists(path)):
                return path
                
        return None
    
    def _check_command_exists(self, command: str) -> bool:
        """Check if a command exists in the system PATH."""
        try:
            import subprocess
            subprocess.run([command, "--version"], capture_output=True, timeout=5)
            return True
        except:
            return False
    
    def _load_opening_database(self) -> Dict:
        """Load opening database for basic analysis."""
        return {
            'e4': {
                'e5': 'King\'s Pawn Game',
                'c5': 'Sicilian Defense',
                'c6': 'Caro-Kann Defense',
                'e6': 'French Defense',
                'd6': 'Pirc Defense',
                'g6': 'Modern Defense'
            },
            'd4': {
                'd5': 'Queen\'s Pawn Game',
                'Nf6': 'Indian Defense',
                'e6': 'Queen\'s Gambit Declined'
            },
            'Nf3': {
                'd5': 'Réti Opening',
                'Nf6': 'English Opening'
            }
        }
    
    async def analyze_position(self, fen: str, analysis_type: Optional[AnalysisType] = None) -> Dict:
        """Analyze a chess position."""
        analysis_type = analysis_type or self.config.analysis_type
        start_time = datetime.now()
        
        try:
            if analysis_type == AnalysisType.BASIC:
                return await self._analyze_position_basic(fen)
            else:
                return await self._analyze_position_stockfish(fen, analysis_type)
        finally:
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            print(f"Position analysis completed in {processing_time:.1f}ms")
    
    async def analyze_move(self, board: chess.Board, move: chess.Move, 
                          analysis_type: Optional[AnalysisType] = None) -> MoveAnalysis:
        """Analyze a specific move in a position."""
        analysis_type = analysis_type or self.config.analysis_type
        start_time = datetime.now()
        
        try:
            if analysis_type == AnalysisType.BASIC:
                return await self._analyze_move_basic(board, move)
            else:
                return await self._analyze_move_stockfish(board, move, analysis_type)
        finally:
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            print(f"Move analysis completed in {processing_time:.1f}ms")
    
    async def analyze_game(self, pgn: str, user_id: str, platform: str, 
                          analysis_type: Optional[AnalysisType] = None, 
                          game_id: Optional[str] = None) -> Optional[GameAnalysis]:
        """Analyze a complete game from PGN."""
        analysis_type = analysis_type or self.config.analysis_type
        start_time = datetime.now()
        
        try:
            # Parse PGN
            pgn_io = io.StringIO(pgn)
            game = chess.pgn.read_game(pgn_io)
            
            if not game:
                return None
            
            # Use provided game_id or extract from PGN headers
            if not game_id:
                headers = game.headers
                game_id = headers.get('Site', '').split('/')[-1] if headers.get('Site') else f"game_{datetime.now().timestamp()}"
            
            # Analyze each move
            moves_analysis = []
            board = game.board()
            
            for move in game.mainline_moves():
                # Create a copy of the board for analysis to avoid modifying the original
                board_copy = board.copy()
                move_analysis = await self.analyze_move(board_copy, move, analysis_type)
                moves_analysis.append(move_analysis)
                board.push(move)
            
            if not moves_analysis:
                return None
            
            # Calculate game-level metrics
            game_analysis = self._calculate_game_metrics(
                game_id, user_id, platform, moves_analysis, analysis_type
            )
            
            # Calculate processing time
            processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            game_analysis.processing_time_ms = processing_time_ms
            
            return game_analysis
            
        except Exception as e:
            print(f"Error analyzing game: {e}")
            return None
    
    async def _analyze_position_basic(self, fen: str) -> Dict:
        """Basic position analysis using heuristics."""
        board = chess.Board(fen)
        
        # Simple material count
        material_balance = 0
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece:
                value = {'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0}[piece.symbol().upper()]
                if piece.color == chess.WHITE:
                    material_balance += value
                else:
                    material_balance -= value
        
        return {
            'evaluation': {'value': material_balance, 'type': 'cp'},
            'best_move': 'e2e4',  # Placeholder
            'fen': fen,
            'analysis_type': 'basic'
        }
    
    async def _analyze_position_stockfish(self, fen: str, analysis_type: AnalysisType) -> Dict:
        """Stockfish position analysis."""
        if not self.stockfish_path:
            raise ValueError("Stockfish executable not found")
        
        depth = self.config.depth
        if analysis_type == AnalysisType.DEEP:
            depth = max(depth, 20)
        
        try:
            with chess.engine.SimpleEngine.popen_uci(self.stockfish_path) as engine:
                # Configure engine for skill level 8 (faster analysis)
                engine.configure({
                    'Skill Level': self.config.skill_level,
                    'UCI_LimitStrength': True,
                    'UCI_Elo': 2000  # Lower ELO for faster analysis
                })
                
                # Use time limit for faster analysis regardless of depth
                # 0.2 seconds per position should be sufficient for skill level 8
                info = engine.analyse(chess.Board(fen), chess.engine.Limit(time=0.2))
                score = info.get("score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))
                best_move = info.get("pv", [None])[0]
                
                # Convert score to dict
                if score.pov(chess.WHITE).is_mate():
                    evaluation = {
                        'value': score.pov(chess.WHITE).mate(),
                        'type': 'mate'
                    }
                else:
                    evaluation = {
                        'value': score.pov(chess.WHITE).score(),
                        'type': 'cp'
                    }
                
                return {
                    'evaluation': evaluation,
                    'best_move': best_move.uci() if best_move else None,
                    'fen': fen,
                    'analysis_type': analysis_type.value,
                    'depth': depth
                }
                
        except Exception as e:
            print(f"Stockfish analysis failed: {e}")
            # Fallback to basic analysis
            return await self._analyze_position_basic(fen)
    
    async def _analyze_move_basic(self, board: chess.Board, move: chess.Move) -> MoveAnalysis:
        """Basic move analysis using improved heuristics."""
        move_san = board.san(move)
        
        # Improved heuristics for move quality
        is_tactical = any(char in move_san for char in ['x', '+', '#'])
        is_developing = move_san in ['Nf3', 'Nc3', 'Bc4', 'Bf4', 'O-O', 'O-O-O', 'e4', 'd4', 'Nf6', 'Nc6']
        is_center = any(square in [chess.E4, chess.E5, chess.D4, chess.D5] for square in [move.from_square, move.to_square])
        is_castling = move_san in ['O-O', 'O-O-O']
        is_pawn_push = move_san[0].islower() and len(move_san) <= 3
        
        # More realistic move quality estimation
        centipawn_loss = 25  # Default to decent move
        
        if is_castling:
            centipawn_loss = 5   # Castling is almost always good
        elif is_tactical and is_center:
            centipawn_loss = 10  # Tactical center moves are good
        elif is_developing:
            centipawn_loss = 15  # Development moves are good
        elif is_center:
            centipawn_loss = 20  # Center moves are decent
        elif is_pawn_push:
            centipawn_loss = 30  # Pawn pushes are okay
        elif is_tactical:
            centipawn_loss = 35  # Tactical moves are okay
        else:
            centipawn_loss = 40  # Other moves are average
        
        # More realistic thresholds
        is_best = centipawn_loss < 25      # More moves qualify as "best"
        is_blunder = centipawn_loss > 150  # Higher threshold for blunders
        is_mistake = 75 < centipawn_loss <= 150
        is_inaccuracy = 40 < centipawn_loss <= 75
        
        return MoveAnalysis(
            move=move.uci(),
            move_san=move_san,
            evaluation={'value': 0, 'type': 'cp'},
            best_move=move.uci(),
            is_best=is_best,
            is_blunder=is_blunder,
            is_mistake=is_mistake,
            is_inaccuracy=is_inaccuracy,
            centipawn_loss=centipawn_loss,
            depth_analyzed=0,
            analysis_time_ms=0
        )
    
    async def _analyze_move_stockfish(self, board: chess.Board, move: chess.Move, 
                                    analysis_type: AnalysisType) -> MoveAnalysis:
        """Stockfish move analysis."""
        if not self.stockfish_path:
            raise ValueError("Stockfish executable not found")
        
        depth = self.config.depth
        if analysis_type == AnalysisType.DEEP:
            depth = max(depth, 20)
        
        try:
            with chess.engine.SimpleEngine.popen_uci(self.stockfish_path) as engine:
                # Configure engine for skill level 8 (faster analysis)
                engine.configure({
                    'Skill Level': self.config.skill_level,
                    'UCI_LimitStrength': True,
                    'UCI_Elo': 2000  # Lower ELO for faster analysis
                })
                
                # Use time limit for faster analysis regardless of depth
                # 0.2 seconds per position should be sufficient for skill level 8
                time_limit = 0.2
                
                # Get evaluation before move
                info_before = engine.analyse(board, chess.engine.Limit(time=time_limit))
                eval_before = info_before.get("score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))
                best_move_before = info_before.get("pv", [None])[0]
                
                # Get SAN notation before making the move
                move_san = board.san(move)
                
                # Make the move
                board.push(move)
                
                # Get evaluation after move
                info_after = engine.analyse(board, chess.engine.Limit(time=time_limit))
                eval_after = info_after.get("score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))
                
                # Calculate centipawn loss
                if eval_before.pov(chess.WHITE).is_mate() or eval_after.pov(chess.WHITE).is_mate():
                    centipawn_loss = 0
                else:
                    cp_before = eval_before.pov(chess.WHITE).score()
                    cp_after = eval_after.pov(chess.WHITE).score()
                    centipawn_loss = abs(cp_after - cp_before)
                
                # Determine move quality
                is_best = centipawn_loss < 10
                is_blunder = centipawn_loss > 200
                is_mistake = 100 < centipawn_loss <= 200
                is_inaccuracy = 50 < centipawn_loss <= 100
                
                # Convert evaluation to dict
                evaluation = {
                    "value": eval_after.pov(chess.WHITE).score() if not eval_after.pov(chess.WHITE).is_mate() else 0,
                    "type": "cp" if not eval_after.pov(chess.WHITE).is_mate() else "mate"
                }
                
                return MoveAnalysis(
                    move=move.uci(),
                    move_san=move_san,
                    evaluation=evaluation,
                    best_move=best_move_before.uci() if best_move_before else None,
                    is_best=is_best,
                    is_blunder=is_blunder,
                    is_mistake=is_mistake,
                    is_inaccuracy=is_inaccuracy,
                    centipawn_loss=centipawn_loss,
                    depth_analyzed=depth,
                    analysis_time_ms=0
                )
                
        except Exception as e:
            print(f"Stockfish move analysis failed: {e}")
            # Fallback to basic analysis
            return await self._analyze_move_basic(board, move)
    
    def _calculate_game_metrics(self, game_id: str, user_id: str, platform: str, 
                               moves_analysis: List[MoveAnalysis], 
                               analysis_type: AnalysisType) -> GameAnalysis:
        """Calculate comprehensive game-level metrics."""
        total_moves = len(moves_analysis)
        
        # Basic metrics
        blunders = sum(1 for m in moves_analysis if m.is_blunder)
        mistakes = sum(1 for m in moves_analysis if m.is_mistake)
        inaccuracies = sum(1 for m in moves_analysis if m.is_inaccuracy)
        best_moves = sum(1 for m in moves_analysis if m.is_best)
        brilliant_moves = sum(1 for m in moves_analysis if m.centipawn_loss < -100)
        
        # Calculate accuracy
        accuracy = (best_moves / total_moves) * 100 if total_moves > 0 else 0
        
        # Phase analysis
        opening_end = min(12, total_moves // 3)
        endgame_start = max(total_moves - 20, total_moves // 2)
        
        opening_moves = moves_analysis[:opening_end]
        middle_game_moves = moves_analysis[opening_end:endgame_start]
        endgame_moves = moves_analysis[endgame_start:]
        
        opening_accuracy = self._calculate_phase_accuracy(opening_moves)
        middle_game_accuracy = self._calculate_phase_accuracy(middle_game_moves)
        endgame_accuracy = self._calculate_phase_accuracy(endgame_moves)
        
        # Advanced metrics
        centipawn_losses = [m.centipawn_loss for m in moves_analysis]
        average_centipawn_loss = sum(centipawn_losses) / len(centipawn_losses) if centipawn_losses else 0
        worst_blunder_centipawn_loss = max(centipawn_losses) if centipawn_losses else 0
        
        # Calculate additional metrics for personality scores
        material_sacrifices = sum(1 for m in moves_analysis if m.centipawn_loss < -200)  # Major sacrifices
        aggressiveness_index = self._calculate_aggressiveness_index(moves_analysis)
        time_management_score = self._calculate_time_management_score(moves_analysis)
        opening_repetition_data = self._calculate_opening_repetition(moves_analysis)
        
        # Personality scores
        personality_scores = self._calculate_personality_scores(
            moves_analysis, 
            material_sacrifices, 
            aggressiveness_index, 
            time_management_score, 
            opening_repetition_data
        )
        
        # Patterns and themes
        tactical_patterns = self._extract_tactical_patterns(moves_analysis)
        positional_patterns = self._extract_positional_patterns(moves_analysis)
        strategic_themes = self._extract_strategic_themes(moves_analysis)
        
        return GameAnalysis(
            game_id=game_id,
            user_id=user_id,
            platform=platform,
            total_moves=total_moves,
            moves_analysis=moves_analysis,
            accuracy=round(accuracy, 2),
            blunders=blunders,
            mistakes=mistakes,
            inaccuracies=inaccuracies,
            brilliant_moves=brilliant_moves,
            best_moves=best_moves,
            opening_accuracy=round(opening_accuracy, 2),
            middle_game_accuracy=round(middle_game_accuracy, 2),
            endgame_accuracy=round(endgame_accuracy, 2),
            average_centipawn_loss=round(average_centipawn_loss, 2),
            worst_blunder_centipawn_loss=round(worst_blunder_centipawn_loss, 2),
            time_management_score=round(time_management_score, 2),
            **personality_scores,
            tactical_patterns=tactical_patterns,
            positional_patterns=positional_patterns,
            strategic_themes=strategic_themes,
            analysis_type=analysis_type.value,
            analysis_date=datetime.utcnow(),
            processing_time_ms=0,  # Will be set by caller
            stockfish_depth=self.config.depth
        )
    
    def _calculate_phase_accuracy(self, moves: List[MoveAnalysis]) -> float:
        """Calculate accuracy for a game phase."""
        if not moves:
            return 0.0
        good_moves = sum(1 for move in moves if move.is_best)
        return (good_moves / len(moves)) * 100
    
    def _calculate_personality_scores(self, moves_analysis: List[MoveAnalysis], 
                                    material_sacrifices: int = 0,
                                    aggressiveness_index: float = 0,
                                    time_management_score: float = 0,
                                    opening_repetition_data: float = None) -> Dict[str, float]:
        """Calculate personality scores from move analysis using improved formulas."""
        if not moves_analysis:
            return {
                'tactical_score': 50.0,
                'positional_score': 50.0,
                'aggressive_score': 50.0,
                'patient_score': 50.0,
                'novelty_score': 50.0,
                'staleness_score': 50.0
            }
        
        # Calculate improved scores with additional parameters
        tactical_score = self._calculate_tactical_score(moves_analysis)
        positional_score = self._calculate_positional_score(moves_analysis)
        aggressive_score = self._calculate_aggressive_score(moves_analysis, material_sacrifices, aggressiveness_index)
        patient_score = self._calculate_patient_score(moves_analysis, time_management_score)
        novelty_score = self._calculate_novelty_score(moves_analysis)
        staleness_score = self._calculate_staleness_score(moves_analysis, opening_repetition_data)
        
        return {
            'tactical_score': round(tactical_score, 1),
            'positional_score': round(positional_score, 1),
            'aggressive_score': round(aggressive_score, 1),
            'patient_score': round(patient_score, 1),
            'novelty_score': round(novelty_score, 1),
            'staleness_score': round(staleness_score, 1)
        }
    
    def _extract_tactical_patterns(self, moves_analysis: List[MoveAnalysis]) -> List[Dict]:
        """Extract tactical patterns from move analysis."""
        patterns = []
        
        # Find sequences of good moves
        good_sequences = []
        current_sequence = []
        
        for move in moves_analysis:
            if move.is_best:
                current_sequence.append(move)
            else:
                if len(current_sequence) >= 3:
                    good_sequences.append(current_sequence)
                current_sequence = []
        
        if len(current_sequence) >= 3:
            good_sequences.append(current_sequence)
        
        # Add tactical patterns
        for sequence in good_sequences:
            patterns.append({
                'type': 'good_move_sequence',
                'length': len(sequence),
                'moves': [m.move_san for m in sequence],
                'average_centipawn_loss': sum(m.centipawn_loss for m in sequence) / len(sequence)
            })
        
        return patterns
    
    def _extract_positional_patterns(self, moves_analysis: List[MoveAnalysis]) -> List[Dict]:
        """Extract positional patterns from move analysis."""
        patterns = []
        
        inaccuracies = [m for m in moves_analysis if m.is_inaccuracy]
        mistakes = [m for m in moves_analysis if m.is_mistake]
        
        if inaccuracies:
            patterns.append({
                'type': 'positional_inaccuracies',
                'count': len(inaccuracies),
                'moves': [m.move_san for m in inaccuracies]
            })
        
        if mistakes:
            patterns.append({
                'type': 'positional_mistakes',
                'count': len(mistakes),
                'moves': [m.move_san for m in mistakes]
            })
        
        return patterns
    
    def _extract_strategic_themes(self, moves_analysis: List[MoveAnalysis]) -> List[Dict]:
        """Extract strategic themes from move analysis."""
        themes = []
        
        total_moves = len(moves_analysis)
        if total_moves == 0:
            return themes
        
        best_moves = sum(1 for m in moves_analysis if m.is_best)
        blunders = sum(1 for m in moves_analysis if m.is_blunder)
        
        # Add strategic themes based on performance
        if best_moves / total_moves > 0.7:
            themes.append({
                'type': 'excellent_play',
                'description': 'High percentage of best moves',
                'strength': 'strong'
            })
        
        if blunders / total_moves > 0.1:
            themes.append({
                'type': 'tactical_weakness',
                'description': 'High number of blunders',
                'strength': 'weak'
            })
        
        return themes
    
    def _calculate_tactical_score(self, moves_analysis: List[MoveAnalysis]) -> float:
        """Calculate improved tactical score using multiple indicators."""
        if not moves_analysis:
            return 50.0
        
        total_moves = len(moves_analysis)
        
        # Base score from move quality
        blunders = sum(1 for m in moves_analysis if m.is_blunder)
        mistakes = sum(1 for m in moves_analysis if m.is_mistake)
        brilliant_moves = sum(1 for m in moves_analysis if m.centipawn_loss < -100)
        best_moves = sum(1 for m in moves_analysis if m.is_best)
        
        # Calculate tactical patterns bonus
        tactical_patterns_bonus = 0
        for move in moves_analysis:
            if hasattr(move, 'tactical_patterns') and move.tactical_patterns:
                tactical_patterns_bonus += len(move.tactical_patterns) * 2
        
        # Weighted calculation
        base_score = 100 - (blunders * 15 + mistakes * 8) / total_moves
        positive_bonus = (brilliant_moves * 20 + best_moves * 5) / total_moves
        pattern_bonus = min(20, tactical_patterns_bonus / total_moves)
        
        return max(0, min(100, base_score + positive_bonus + pattern_bonus))
    
    def _calculate_positional_score(self, moves_analysis: List[MoveAnalysis]) -> float:
        """Calculate improved positional score using patterns and accuracy."""
        if not moves_analysis:
            return 50.0
        
        total_moves = len(moves_analysis)
        
        # Base score from accuracy
        inaccuracies = sum(1 for m in moves_analysis if m.is_inaccuracy)
        mistakes = sum(1 for m in moves_analysis if m.is_mistake)
        blunders = sum(1 for m in moves_analysis if m.is_blunder)
        
        # Calculate positional patterns bonus
        positional_patterns_bonus = 0
        for move in moves_analysis:
            if hasattr(move, 'positional_patterns') and move.positional_patterns:
                positional_patterns_bonus += len(move.positional_patterns) * 3
        
        # Consider centipawn loss for positional accuracy
        avg_centipawn_loss = sum(m.centipawn_loss for m in moves_analysis) / total_moves
        centipawn_factor = max(0, 1 - (avg_centipawn_loss / 100))
        
        base_score = 100 - (inaccuracies * 3 + mistakes * 6 + blunders * 12) / total_moves
        pattern_bonus = min(25, positional_patterns_bonus / total_moves)
        
        return max(0, min(100, base_score * centipawn_factor + pattern_bonus))
    
    def _calculate_aggressive_score(self, moves_analysis: List[MoveAnalysis], 
                                  material_sacrifices: int = 0, 
                                  aggressiveness_index: float = 0) -> float:
        """Calculate improved aggressive score using multiple indicators."""
        if not moves_analysis:
            return 50.0
        
        total_moves = len(moves_analysis)
        
        # Move-based aggression indicators
        brilliant_moves = sum(1 for m in moves_analysis if m.centipawn_loss < -100)
        tactical_moves = sum(1 for m in moves_analysis if 'x' in m.move_san or '+' in m.move_san)
        king_attacks = sum(1 for m in moves_analysis if '+' in m.move_san)
        
        # Use available aggressiveness data
        base_aggression = aggressiveness_index * 100 if aggressiveness_index else 0
        sacrifice_bonus = min(30, material_sacrifices * 5)
        
        # Calculate move-based score
        move_score = (brilliant_moves * 15 + tactical_moves * 3 + king_attacks * 8) / total_moves
        
        # Combine factors
        final_score = (base_aggression * 0.4 + move_score * 0.4 + sacrifice_bonus * 0.2)
        
        return max(0, min(100, final_score))
    
    def _calculate_patient_score(self, moves_analysis: List[MoveAnalysis], 
                               time_management_score: float = 0) -> float:
        """Calculate improved patient score using time management and accuracy."""
        if not moves_analysis:
            return 50.0
        
        total_moves = len(moves_analysis)
        
        # Patience indicators
        blunders = sum(1 for m in moves_analysis if m.is_blunder)
        mistakes = sum(1 for m in moves_analysis if m.is_mistake)
        inaccuracies = sum(1 for m in moves_analysis if m.is_inaccuracy)
        
        # Time management factor
        time_factor = time_management_score / 100 if time_management_score else 0.5
        
        # Endgame performance (if available)
        endgame_moves = [m for m in moves_analysis if hasattr(m, 'ply') and m.ply > 30]
        endgame_accuracy = 0
        if endgame_moves:
            endgame_accuracy = sum(1 for m in endgame_moves if m.is_best) / len(endgame_moves)
        
        # Calculate base patience score
        base_score = 100 - (blunders * 12 + mistakes * 6 + inaccuracies * 2) / total_moves
        
        # Apply time management and endgame factors
        final_score = base_score * time_factor + endgame_accuracy * 20
        
        return max(0, min(100, final_score))
    
    def _calculate_novelty_score(self, moves_analysis: List[MoveAnalysis]) -> float:
        """Calculate improved novelty score based on creativity and diversity."""
        if not moves_analysis:
            return 50.0
        
        total_moves = len(moves_analysis)
        
        # Creative moves: good moves that aren't engine's top choice
        creative_moves = sum(1 for m in moves_analysis if 
                            not m.is_best and not m.is_mistake and not m.is_inaccuracy 
                            and m.centipawn_loss < 50)
        
        # Unorthodox patterns: moves with unique characteristics
        unorthodox_moves = sum(1 for m in moves_analysis if 
                              hasattr(m, 'move_san') and 
                              ('!' in m.move_san or '?' in m.move_san or 
                               len(m.move_san) > 4))  # Complex notation
        
        # Position diversity: variety in move types and patterns
        move_types = set()
        for m in moves_analysis:
            if hasattr(m, 'move_san'):
                move_types.add(m.move_san[0])  # First character (piece type)
        
        diversity_bonus = len(move_types) * 5
        
        # Calculate novelty score
        creative_score = (creative_moves / total_moves) * 60
        unorthodox_score = (unorthodox_moves / total_moves) * 30
        diversity_score = min(20, diversity_bonus)
        
        return max(0, min(100, creative_score + unorthodox_score + diversity_score))
    
    def _calculate_staleness_score(self, moves_analysis: List[MoveAnalysis], 
                                 opening_repetition_data: float = None) -> float:
        """Calculate improved staleness score based on pattern repetition and diversity."""
        if not moves_analysis:
            return 50.0
        
        total_moves = len(moves_analysis)
        
        # Opening repetition (if available)
        opening_staleness = 0
        if opening_repetition_data:
            opening_staleness = opening_repetition_data * 30
        
        # Move pattern repetition
        move_patterns = {}
        for m in moves_analysis:
            if hasattr(m, 'move_san'):
                pattern = m.move_san[:2]  # First two characters
                move_patterns[pattern] = move_patterns.get(pattern, 0) + 1
        
        # Calculate pattern diversity
        unique_patterns = len(move_patterns)
        pattern_diversity = (unique_patterns / total_moves) * 100
        
        # Standard opening moves (ply <= 15)
        opening_moves = sum(1 for m in moves_analysis if 
                           hasattr(m, 'ply') and m.ply <= 15)
        opening_ratio = opening_moves / total_moves
        
        # Calculate staleness (higher = more stale)
        pattern_staleness = 100 - pattern_diversity
        opening_staleness_score = opening_ratio * 40 + opening_staleness
        
        final_score = (pattern_staleness * 0.6 + opening_staleness_score * 0.4)
        
        return max(0, min(100, final_score))
    
    def _calculate_aggressiveness_index(self, moves_analysis: List[MoveAnalysis]) -> float:
        """Calculate aggressiveness index based on tactical moves and sacrifices."""
        if not moves_analysis:
            return 0.0
        
        total_moves = len(moves_analysis)
        tactical_moves = sum(1 for m in moves_analysis if 'x' in m.move_san or '+' in m.move_san)
        king_attacks = sum(1 for m in moves_analysis if '+' in m.move_san)
        sacrifices = sum(1 for m in moves_analysis if m.centipawn_loss < -100)
        
        # Calculate aggressiveness as a ratio (0-1)
        aggressiveness = (tactical_moves * 0.3 + king_attacks * 0.5 + sacrifices * 0.2) / total_moves
        return min(1.0, aggressiveness)
    
    def _calculate_time_management_score(self, moves_analysis: List[MoveAnalysis]) -> float:
        """Calculate time management score based on move quality consistency."""
        if not moves_analysis:
            return 50.0
        
        # Calculate consistency of move quality
        centipawn_losses = [m.centipawn_loss for m in moves_analysis]
        if not centipawn_losses:
            return 50.0
        
        # Lower variance = better time management
        mean_loss = sum(centipawn_losses) / len(centipawn_losses)
        variance = sum((loss - mean_loss) ** 2 for loss in centipawn_losses) / len(centipawn_losses)
        std_dev = variance ** 0.5
        
        # Convert to 0-100 scale (lower std dev = higher score)
        time_score = max(0, 100 - (std_dev / 10))
        return min(100, time_score)
    
    def _calculate_opening_repetition(self, moves_analysis: List[MoveAnalysis]) -> float:
        """Calculate opening repetition factor."""
        if not moves_analysis:
            return 0.0
        
        # Count opening moves (first 15 moves)
        opening_moves = [m for m in moves_analysis if hasattr(m, 'ply') and m.ply <= 15]
        if len(opening_moves) < 2:
            return 0.0
        
        # Count repeated opening patterns
        opening_patterns = [m.move_san for m in opening_moves if hasattr(m, 'move_san')]
        unique_patterns = len(set(opening_patterns))
        repetition_factor = 1 - (unique_patterns / len(opening_patterns))
        
        return repetition_factor

# Example usage and testing
if __name__ == "__main__":
    async def test_analysis_engine():
        """Test the analysis engine with different configurations."""
        print("Testing Chess Analysis Engine...")
        
        # Test basic analysis
        print("\n=== Testing Basic Analysis ===")
        basic_config = AnalysisConfig(analysis_type=AnalysisType.BASIC)
        basic_engine = ChessAnalysisEngine(config=basic_config)
        
        starting_position = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        basic_result = await basic_engine.analyze_position(starting_position)
        print(f"Basic analysis result: {basic_result}")
        
        # Test Stockfish analysis (if available)
        if basic_engine.stockfish_path:
            print("\n=== Testing Stockfish Analysis ===")
            stockfish_config = AnalysisConfig(analysis_type=AnalysisType.STOCKFISH, depth=10)
            stockfish_engine = ChessAnalysisEngine(config=stockfish_config, stockfish_path=basic_engine.stockfish_path)
            
            stockfish_result = await stockfish_engine.analyze_position(starting_position)
            print(f"Stockfish analysis result: {stockfish_result}")
        else:
            print("Stockfish not available, skipping Stockfish tests")
        
        print("\n🎉 Analysis engine testing complete!")
    
    asyncio.run(test_analysis_engine())
