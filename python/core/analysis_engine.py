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
    depth: int = 15
    skill_level: int = 20
    time_limit: float = 1.0
    use_opening_book: bool = True
    use_endgame_tablebase: bool = True
    parallel_analysis: bool = False
    max_concurrent: int = 4

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
    endgame_score: float
    opening_score: float
    
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
                          analysis_type: Optional[AnalysisType] = None) -> Optional[GameAnalysis]:
        """Analyze a complete game from PGN."""
        analysis_type = analysis_type or self.config.analysis_type
        start_time = datetime.now()
        
        try:
            # Parse PGN
            pgn_io = io.StringIO(pgn)
            game = chess.pgn.read_game(pgn_io)
            
            if not game:
                return None
            
            # Extract game info
            headers = game.headers
            game_id = headers.get('Site', '').split('/')[-1] if headers.get('Site') else f"game_{datetime.now().timestamp()}"
            
            # Analyze each move
            moves_analysis = []
            board = game.board()
            
            for move in game.mainline_moves():
                move_analysis = await self.analyze_move(board, move, analysis_type)
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
                # Configure engine
                engine.configure({
                    'Skill Level': self.config.skill_level,
                    'UCI_LimitStrength': False,
                    'UCI_Elo': 3000
                })
                
                # Analyze position
                info = engine.analyse(chess.Board(fen), chess.engine.Limit(depth=depth))
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
        """Basic move analysis using heuristics."""
        move_san = board.san(move)
        
        # Simple heuristics for move quality
        is_tactical = any(char in move_san for char in ['x', '+', '#'])
        is_developing = move_san in ['Nf3', 'Nc3', 'Bc4', 'Bf4', 'O-O', 'O-O-O']
        is_center = any(square in [chess.E4, chess.E5, chess.D4, chess.D5] for square in [move.from_square, move.to_square])
        
        # Estimate move quality based on heuristics
        centipawn_loss = 0
        if is_tactical and is_center:
            centipawn_loss = 10  # Good move
        elif is_developing:
            centipawn_loss = 30  # Decent move
        else:
            centipawn_loss = 50  # Average move
        
        is_best = centipawn_loss < 20
        is_blunder = centipawn_loss > 200
        is_mistake = 100 < centipawn_loss <= 200
        is_inaccuracy = 50 < centipawn_loss <= 100
        
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
                # Configure engine
                engine.configure({
                    'Skill Level': self.config.skill_level,
                    'UCI_LimitStrength': False,
                    'UCI_Elo': 3000
                })
                
                # Get evaluation before move
                info_before = engine.analyse(board, chess.engine.Limit(depth=depth))
                eval_before = info_before.get("score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))
                best_move_before = info_before.get("pv", [None])[0]
                
                # Make the move
                board.push(move)
                
                # Get evaluation after move
                info_after = engine.analyse(board, chess.engine.Limit(depth=depth))
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
                    move_san=board.san(move),
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
        
        # Personality scores
        personality_scores = self._calculate_personality_scores(moves_analysis)
        
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
            time_management_score=75.0,  # Placeholder
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
    
    def _calculate_personality_scores(self, moves_analysis: List[MoveAnalysis]) -> Dict[str, float]:
        """Calculate personality scores from move analysis."""
        if not moves_analysis:
            return {
                'tactical_score': 50.0,
                'positional_score': 50.0,
                'aggressive_score': 50.0,
                'patient_score': 50.0,
                'endgame_score': 50.0,
                'opening_score': 50.0
            }
        
        total_moves = len(moves_analysis)
        blunders = sum(1 for m in moves_analysis if m.is_blunder)
        mistakes = sum(1 for m in moves_analysis if m.is_mistake)
        inaccuracies = sum(1 for m in moves_analysis if m.is_inaccuracy)
        best_moves = sum(1 for m in moves_analysis if m.is_best)
        brilliant_moves = sum(1 for m in moves_analysis if m.is_blunder)
        
        # Calculate scores (0-100 scale)
        tactical_score = max(0, 100 - (blunders * 20 + mistakes * 10) / total_moves)
        positional_score = max(0, 100 - (inaccuracies * 5) / total_moves)
        aggressive_score = min(100, (brilliant_moves * 15) / total_moves)
        patient_score = max(0, 100 - (blunders * 15 + mistakes * 8) / total_moves)
        endgame_score = max(0, 100 - (blunders * 10) / total_moves)
        opening_score = max(0, 100 - (blunders * 5) / total_moves)
        
        return {
            'tactical_score': round(tactical_score, 1),
            'positional_score': round(positional_score, 1),
            'aggressive_score': round(aggressive_score, 1),
            'patient_score': round(patient_score, 1),
            'endgame_score': round(endgame_score, 1),
            'opening_score': round(opening_score, 1)
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
