#!/usr/bin/env python3
"""
DEPRECATED: This file has been replaced by the unified architecture.

Please use the new unified system:
- Core Analysis Engine: python/core/analysis_engine.py
- Unified API Server: python/core/api_server.py
- Configuration: python/core/config.py

Migration guide: python/migrate_to_unified.py

This file is kept for reference but should not be used in new code.
"""

import warnings
warnings.warn(
    "This implementation is deprecated. Please use the unified architecture in python/core/",
    DeprecationWarning,
    stacklevel=2
)

# Original implementation code follows...
#!/usr/bin/env python3
"""
DEPRECATED: This file has been replaced by the unified architecture.

Please use the new unified system:
- Core Analysis Engine: python/core/analysis_engine.py
- Unified API Server: python/core/api_server.py
- Configuration: python/core/config.py

Migration guide: python/migrate_to_unified.py

This file is kept for reference but should not be used in new code.
"""

import warnings
warnings.warn(
    "This implementation is deprecated. Please use the unified architecture in python/core/",
    DeprecationWarning,
    stacklevel=2
)

# Original implementation code follows...
#!/usr/bin/env python3
"""
Chess Analysis Service using Stockfish engine.
Provides functions for analyzing chess games and positions.
"""

import chess
import chess.pgn
from stockfish import Stockfish
import os
import json
import io
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

@dataclass
class MoveAnalysis:
    """Data class for move analysis results."""
    move: str
    evaluation: Dict
    best_move: str
    is_best: bool
    is_blunder: bool
    is_mistake: bool
    is_inaccuracy: bool
    centipawn_loss: float

@dataclass
class GameAnalysis:
    """Data class for complete game analysis results."""
    moves_analysis: List[MoveAnalysis]
    overall_accuracy: float
    blunders: int
    mistakes: int
    inaccuracies: int
    best_moves: int
    brilliant_moves: int
    average_evaluation: float

class ChessAnalysisService:
    """Service for analyzing chess games using Stockfish."""
    
    def __init__(self, stockfish_path: Optional[str] = None):
        """Initialize the chess analysis service.
        
        Args:
            stockfish_path: Path to Stockfish executable. If None, uses default path.
        """
        if stockfish_path is None:
            # Default path for Windows winget installation
            stockfish_path = os.path.expanduser(
                "~\\AppData\\Local\\Microsoft\\WinGet\\Packages\\"
                "Stockfish.Stockfish_Microsoft.Winget.Source_8wekyb3d8bbwe\\"
                "stockfish\\stockfish-windows-x86-64-avx2.exe"
            )
        
        self.stockfish = Stockfish(path=stockfish_path)
        self.stockfish.set_depth(12)  # Set analysis depth (reduced for stability)
        self.stockfish.set_skill_level(20)  # Maximum skill level
        
    def analyze_position(self, fen: str) -> Dict:
        """Analyze a chess position.
        
        Args:
            fen: FEN string of the position to analyze
            
        Returns:
            Dictionary containing evaluation and best move
        """
        self.stockfish.set_fen_position(fen)
        
        evaluation = self.stockfish.get_evaluation()
        best_move = self.stockfish.get_best_move()
        
        return {
            'evaluation': evaluation,
            'best_move': best_move,
            'fen': fen
        }
    
    def analyze_move(self, board: chess.Board, move: chess.Move) -> MoveAnalysis:
        """Analyze a specific move in a position.
        
        Args:
            board: Chess board before the move
            move: The move to analyze
            
        Returns:
            MoveAnalysis object with analysis results
        """
        # Get position before move
        fen_before = board.fen()
        self.stockfish.set_fen_position(fen_before)
        evaluation_before = self.stockfish.get_evaluation()
        best_move_before = self.stockfish.get_best_move()
        
        # Make the move and analyze
        board.push(move)
        fen_after = board.fen()
        self.stockfish.set_fen_position(fen_after)
        evaluation_after = self.stockfish.get_evaluation()
        
        # Calculate centipawn loss
        if evaluation_before['type'] == 'cp' and evaluation_after['type'] == 'cp':
            centipawn_loss = evaluation_after['value'] - evaluation_before['value']
        else:
            centipawn_loss = 0
        
        # Determine move quality
        is_best = move.uci() == best_move_before
        is_blunder = centipawn_loss > 200
        is_mistake = 100 < centipawn_loss <= 200
        is_inaccuracy = 50 < centipawn_loss <= 100
        
        return MoveAnalysis(
            move=move.uci(),
            evaluation=evaluation_after,
            best_move=best_move_before,
            is_best=is_best,
            is_blunder=is_blunder,
            is_mistake=is_mistake,
            is_inaccuracy=is_inaccuracy,
            centipawn_loss=centipawn_loss
        )
    
    def analyze_game_from_pgn(self, pgn_string: str) -> GameAnalysis:
        """Analyze a complete game from PGN string.
        
        Args:
            pgn_string: PGN string of the game
            
        Returns:
            GameAnalysis object with complete analysis
        """
        pgn = io.StringIO(pgn_string)
        game = chess.pgn.read_game(pgn)
        
        if game is None:
            raise ValueError("Invalid PGN string")
        
        board = game.board()
        moves_analysis = []
        
        # Analyze each move
        for move in game.mainline_moves():
            move_analysis = self.analyze_move(board, move)
            moves_analysis.append(move_analysis)
        
        # Calculate overall statistics
        total_moves = len(moves_analysis)
        blunders = sum(1 for m in moves_analysis if m.is_blunder)
        mistakes = sum(1 for m in moves_analysis if m.is_mistake)
        inaccuracies = sum(1 for m in moves_analysis if m.is_inaccuracy)
        best_moves = sum(1 for m in moves_analysis if m.is_best)
        # Brilliant moves: moves that gain significant advantage (<-100 centipawns)
        brilliant_moves = sum(1 for m in moves_analysis if m.centipawn_loss < -100)
        
        # Calculate accuracy percentage
        if total_moves > 0:
            accuracy = (best_moves / total_moves) * 100
        else:
            accuracy = 0
        
        # Calculate average evaluation
        evaluations = [m.evaluation for m in moves_analysis if m.evaluation['type'] == 'cp']
        if evaluations:
            average_evaluation = sum(e['value'] for e in evaluations) / len(evaluations)
        else:
            average_evaluation = 0
        
        return GameAnalysis(
            moves_analysis=moves_analysis,
            overall_accuracy=accuracy,
            blunders=blunders,
            mistakes=mistakes,
            inaccuracies=inaccuracies,
            best_moves=best_moves,
            brilliant_moves=brilliant_moves,
            average_evaluation=average_evaluation
        )
    
    def analyze_game_from_moves(self, moves: List[str]) -> GameAnalysis:
        """Analyze a game from a list of moves in UCI format.
        
        Args:
            moves: List of moves in UCI format (e.g., ['e2e4', 'e7e5'])
            
        Returns:
            GameAnalysis object with complete analysis
        """
        board = chess.Board()
        moves_analysis = []
        
        # Analyze each move
        for move_str in moves:
            try:
                move = chess.Move.from_uci(move_str)
                move_analysis = self.analyze_move(board, move)
                moves_analysis.append(move_analysis)
            except ValueError:
                # Skip invalid moves
                continue
        
        # Calculate overall statistics
        total_moves = len(moves_analysis)
        blunders = sum(1 for m in moves_analysis if m.is_blunder)
        mistakes = sum(1 for m in moves_analysis if m.is_mistake)
        inaccuracies = sum(1 for m in moves_analysis if m.is_inaccuracy)
        best_moves = sum(1 for m in moves_analysis if m.is_best)
        # Brilliant moves: moves that gain significant advantage (<-100 centipawns)
        brilliant_moves = sum(1 for m in moves_analysis if m.centipawn_loss < -100)
        
        # Calculate accuracy percentage
        if total_moves > 0:
            accuracy = (best_moves / total_moves) * 100
        else:
            accuracy = 0
        
        # Calculate average evaluation
        evaluations = [m.evaluation for m in moves_analysis if m.evaluation['type'] == 'cp']
        if evaluations:
            average_evaluation = sum(e['value'] for e in evaluations) / len(evaluations)
        else:
            average_evaluation = 0
        
        return GameAnalysis(
            moves_analysis=moves_analysis,
            overall_accuracy=accuracy,
            blunders=blunders,
            mistakes=mistakes,
            inaccuracies=inaccuracies,
            best_moves=best_moves,
            brilliant_moves=brilliant_moves,
            average_evaluation=average_evaluation
        )
    
    def get_position_evaluation(self, fen: str) -> float:
        """Get the evaluation of a position in centipawns.
        
        Args:
            fen: FEN string of the position
            
        Returns:
            Evaluation in centipawns (positive = white advantage)
        """
        self.stockfish.set_fen_position(fen)
        evaluation = self.stockfish.get_evaluation()
        
        if evaluation['type'] == 'cp':
            return evaluation['value']
        elif evaluation['type'] == 'mate':
            # Convert mate to centipawns (approximate)
            return 10000 if evaluation['value'] > 0 else -10000
        else:
            return 0

# Example usage and testing
if __name__ == "__main__":
    import io
    
    # Initialize the service
    service = ChessAnalysisService()
    
    print("Chess Analysis Service initialized successfully!")
    
    # Test position analysis
    print("\n=== Testing Position Analysis ===")
    starting_position = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    analysis = service.analyze_position(starting_position)
    print(f"Starting position evaluation: {analysis}")
    
    # Test move analysis
    print("\n=== Testing Move Analysis ===")
    board = chess.Board()
    e4_move = chess.Move.from_uci("e2e4")
    move_analysis = service.analyze_move(board, e4_move)
    print(f"e2e4 analysis: {move_analysis}")
    
    # Test game analysis
    print("\n=== Testing Game Analysis ===")
    moves = ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]
    game_analysis = service.analyze_game_from_moves(moves)
    print(f"Game analysis results:")
    print(f"  Accuracy: {game_analysis.overall_accuracy:.1f}%")
    print(f"  Blunders: {game_analysis.blunders}")
    print(f"  Mistakes: {game_analysis.mistakes}")
    print(f"  Inaccuracies: {game_analysis.inaccuracies}")
    print(f"  Best moves: {game_analysis.best_moves}")
    print(f"  Brilliant moves: {game_analysis.brilliant_moves}")
    print(f"  Average evaluation: {game_analysis.average_evaluation:.1f}")
    
    print("\n🎉 Chess Analysis Service is ready for use!")
