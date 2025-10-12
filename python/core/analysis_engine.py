#!/usr/bin/env python3
"""
Unified Chess Analysis Engine
Provides a single, configurable interface for all chess analysis operations.
Supports Stockfish engine analysis with heuristic fallbacks.
"""

import os
import sys
import asyncio
import json
import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import chess
import chess.pgn
import chess.engine
import io
from .coaching_comment_generator import ChessCoachingGenerator, GamePhase

# Try to import stockfish package, fall back to engine if not available
try:
    from stockfish import Stockfish
    STOCKFISH_PACKAGE_AVAILABLE = True
except ImportError:
    STOCKFISH_PACKAGE_AVAILABLE = False
    print("Warning: stockfish package not available, using chess.engine only")

# Heuristic evaluation constants for fallback analysis
PIECE_VALUES = {
    'P': 100,
    'N': 320,
    'B': 330,
    'R': 500,
    'Q': 900,
    'K': 0
}

PIECE_SQUARE_TABLES = {
    'P': [
         0,   0,   0,   0,   0,   0,   0,   0,
         5,  10,  10, -20, -20,  10,  10,   5,
         5,  -5, -10,   0,   0, -10,  -5,   5,
         0,   0,   0,  20,  20,   0,   0,   0,
         5,   5,  10,  25,  25,  10,   5,   5,
        10,  10,  20,  30,  30,  20,  10,  10,
        50,  50,  50,  55,  55,  50,  50,  50,
         0,   0,   0,   0,   0,   0,   0,   0
    ],
    'N': [
       -50, -40, -30, -30, -30, -30, -40, -50,
       -40, -20,   0,   5,   5,   0, -20, -40,
       -30,   5,  10,  15,  15,  10,   5, -30,
       -30,   0,  15,  20,  20,  15,   0, -30,
       -30,   5,  15,  20,  20,  15,   5, -30,
       -30,   0,  10,  15,  15,  10,   0, -30,
       -40, -20,   0,   0,   0,   0, -20, -40,
       -50, -40, -30, -30, -30, -30, -40, -50
    ],
    'B': [
       -20, -10, -10, -10, -10, -10, -10, -20,
       -10,   5,   0,   0,   0,   0,   5, -10,
       -10,  10,  10,  10,  10,  10,  10, -10,
       -10,   0,  10,  10,  10,  10,   0, -10,
       -10,   5,   5,  10,  10,   5,   5, -10,
       -10,   0,   5,  10,  10,   5,   0, -10,
       -10,   0,   0,   0,   0,   0,   0, -10,
       -20, -10, -10, -10, -10, -10, -10, -20
    ],
    'R': [
         0,   0,   0,   5,   5,   0,   0,   0,
        -5,   0,   0,   0,   0,   0,   0,  -5,
        -5,   0,   0,   0,   0,   0,   0,  -5,
        -5,   0,   0,   0,   0,   0,   0,  -5,
        -5,   0,   0,   0,   0,   0,   0,  -5,
        -5,   0,   0,   0,   0,   0,   0,  -5,
         5,  10,  10,  10,  10,  10,  10,   5,
         0,   0,   0,   5,   5,   0,   0,   0
    ],
    'Q': [
       -20, -10, -10,  -5,  -5, -10, -10, -20,
       -10,   0,   0,   0,   0,   5,   0, -10,
       -10,   0,   5,   5,   5,   5,   5, -10,
        -5,   0,   5,   5,   5,   5,   0,  -5,
         0,   0,   5,   5,   5,   5,   0,  -5,
       -10,   5,   5,   5,   5,   5,   0, -10,
       -10,   0,   5,   0,   0,   0,   0, -10,
       -20, -10, -10,  -5,  -5, -10, -10, -20
    ],
    'K': [
       -30, -40, -40, -50, -50, -40, -40, -30,
       -30, -40, -40, -50, -50, -40, -40, -30,
       -30, -40, -40, -50, -50, -40, -40, -30,
       -30, -40, -40, -50, -50, -40, -40, -30,
       -20, -30, -30, -40, -40, -30, -30, -20,
       -10, -20, -20, -20, -20, -20, -20, -10,
        20,  20,   0,   0,   0,   0,  20,  20,
        20,  30,  10,   0,   0,  10,  30,  20
    ]
}

MOBILITY_WEIGHT = 5
KING_SAFETY_SHIELD_WEIGHT = 10
KING_SAFETY_ATTACK_WEIGHT = 18
KING_OPEN_FILE_PENALTY = 15
KING_RING_ATTACK_PENALTY = 12
PASSED_PAWN_BONUS = [0, 10, 20, 35, 60, 100, 160, 0]
HANGING_PIECE_VALUE_MULTIPLIER = 0.6
HANGING_PIECE_MIN_PENALTY = 40
BASIC_MOVE_CANDIDATE_LIMIT = 5
# Chess.com-aligned move classification thresholds
# For Stockfish analysis: best(0-5), great(5-15), excellent(15-25), good(25-50), acceptable(25-50), inaccuracy(50-100), mistake(100-200), blunder(200+)
# For basic analysis: combines categories for simpler classification
BASIC_BEST_THRESHOLD = 5  # Best moves (0-5cp loss)
BASIC_GREAT_THRESHOLD = 15  # Great moves (5-15cp loss) - for Stockfish analysis
BASIC_EXCELLENT_THRESHOLD = 25  # Excellent moves (15-25cp loss) - for Stockfish analysis
BASIC_GOOD_THRESHOLD = 25  # Good moves threshold for basic analysis (5-25cp loss)
BASIC_ACCEPTABLE_THRESHOLD = 50  # Acceptable moves (25-50cp loss)
BASIC_INACCURACY_THRESHOLD = 100  # Inaccuracies (50-100cp loss) - Chess.com standard
BASIC_MISTAKE_THRESHOLD = 200  # Mistakes (100-200cp loss) - Chess.com standard
BASIC_BLUNDER_THRESHOLD = 200  # Blunders (200+cp loss) - Chess.com standard
SEE_MATERIAL_LOSS_TRIGGER = -40
KING_SAFETY_DROP_TRIGGER = 25
MOBILITY_DROP_TRIGGER = -2
BASIC_ENGINE_PROBE_LIMIT = 12
BASIC_ENGINE_PROBE_TIME = 0.08
BASIC_ENGINE_PROBE_MULTIPV = 2

class AnalysisType(Enum):
    """Types of analysis available."""
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
    depth: int = 14  # Phase 1: Better depth for accuracy
    skill_level: int = 20  # Phase 1: Maximum strength
    time_limit: float = 0.8  # Phase 1: Faster analysis
    use_opening_book: bool = True
    use_endgame_tablebase: bool = True
    parallel_analysis: bool = False
    max_concurrent: int = 4
    
    
    @classmethod
    def for_deep_analysis(cls) -> 'AnalysisConfig':
        """Configuration optimized for deep analysis (thorough, high accuracy)."""
        # Use Railway Hobby settings from environment or defaults
        # This ensures consistency with Railway hobby tier performance settings
        import os
        depth = int(os.getenv("STOCKFISH_DEPTH", "14"))
        time_limit = float(os.getenv("STOCKFISH_TIME_LIMIT", "0.8"))
        
        return cls(
            analysis_type=AnalysisType.STOCKFISH,
            depth=depth,  # Use Railway Hobby optimized depth
            skill_level=20,  # Maximum skill level
            time_limit=time_limit,  # Use Railway Hobby optimized time limit
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
    is_brilliant: bool = False
    is_great: bool = False  # NEW: Very strong moves (5-15cp loss)
    is_excellent: bool = False  # NEW: Nearly optimal moves (15-25cp loss)
    is_good: bool = False
    is_acceptable: bool = False
    explanation: str = ""
    heuristic_details: Dict[str, Any] = field(default_factory=dict)
    player_color: str = ""
    is_user_move: bool = False
    ply_index: int = 0
    fullmove_number: int = 0
    accuracy_score: float = 0.0
    
    # Enhanced coaching fields
    coaching_comment: str = ""
    what_went_right: str = ""
    what_went_wrong: str = ""
    how_to_improve: str = ""
    tactical_insights: List[str] = field(default_factory=list)
    positional_insights: List[str] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)
    benefits: List[str] = field(default_factory=list)
    learning_points: List[str] = field(default_factory=list)
    encouragement_level: int = 3
    move_quality: str = "acceptable"
    game_phase: str = "middlegame"

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
    opponent_accuracy: float
    blunders: int
    mistakes: int
    inaccuracies: int
    brilliant_moves: int
    best_moves: int
    good_moves: int
    acceptable_moves: int
    
    # Phase analysis
    opening_accuracy: float
    middle_game_accuracy: float
    endgame_accuracy: float
    
    # Advanced metrics
    average_centipawn_loss: float
    worst_blunder_centipawn_loss: float
    time_management_score: float
    opponent_average_centipawn_loss: float
    opponent_worst_blunder_centipawn_loss: float
    opponent_time_management_score: float
    
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
        self._basic_eval_cache: Dict[str, Tuple[int, Dict[str, Any]]] = {}
        self._basic_move_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._basic_probe_cache: Dict[str, Dict[str, Any]] = {}
        self.coaching_generator = ChessCoachingGenerator()
        
    def _find_stockfish_path(self, custom_path: Optional[str]) -> Optional[str]:
        """Find the best available Stockfish executable."""
        if custom_path and os.path.exists(custom_path):
            print(f"[ENGINE] Using custom Stockfish path: {custom_path}")
            return custom_path
        
        # Check environment variable
        env_path = os.getenv("STOCKFISH_PATH")
        if env_path:
            if os.path.exists(env_path):
                print(f"[ENGINE] Using Stockfish from STOCKFISH_PATH env: {env_path}")
                return env_path
            elif env_path in ["stockfish", "stockfish.exe"] and self._check_command_exists(env_path):
                print(f"[ENGINE] Using Stockfish from PATH via env: {env_path}")
                return env_path
        
        # Determine OS-specific paths
        import platform
        is_windows = platform.system() == "Windows"
        
        if is_windows:
            # Windows paths for local development
            possible_paths = [
                # Local stockfish directory
                os.path.join(os.path.dirname(os.path.dirname(__file__)), "stockfish", "stockfish-windows-x86-64-avx2.exe"),
                # Windows winget installation
                os.path.expanduser("~\\AppData\\Local\\Microsoft\\WinGet\\Packages\\"
                                 "Stockfish.Stockfish_Microsoft.Winget.Source_8wekyb3d8bbwe\\"
                                 "stockfish\\stockfish-windows-x86-64-avx2.exe"),
                "stockfish.exe",
                "stockfish"
            ]
        else:
            # Linux/Unix paths for production (Railway, etc.)
            possible_paths = [
                "/usr/games/stockfish",      # Common Debian/Ubuntu location (Railway default)
                "/usr/bin/stockfish",        # Alternative Linux location
                "/usr/local/bin/stockfish",  # Custom installation location
                "stockfish"                   # Try PATH as fallback
            ]
        
        print(f"[ENGINE] Checking Stockfish paths: {possible_paths}")
        for path in possible_paths:
            if os.path.exists(path):
                print(f"[ENGINE] Found Stockfish at: {path}")
                return path
            elif path in ["stockfish", "stockfish.exe"] and self._check_command_exists(path):
                print(f"[ENGINE] Found Stockfish in PATH: {path}")
                return path
        
        print(f"[ENGINE] No Stockfish executable found")
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
        """Load opening database for heuristic analysis."""
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
                'd5': 'RÃ©ti Opening',
                'Nf6': 'English Opening'
            }
        }
    

    def _basic_cache_key(self, board: chess.Board) -> str:
        '''Create a normalized cache key for basic evaluation.'''
        try:
            pieces, turn, castling, en_passant, *_ = board.fen().split()
            return f"{pieces} {turn} {castling} {en_passant}"
        except ValueError:
            return board.fen()

    def _count_legal_moves(self, board: chess.Board, color: chess.Color) -> int:
        '''Count legal moves for a given color without mutating the original board.'''
        board_copy = board.copy(stack=False)
        board_copy.turn = color
        return sum(1 for _ in board_copy.legal_moves)

    def _pawn_shield_strength(self, board: chess.Board, color: chess.Color, king_square: chess.Square) -> float:
        '''Measure pawn shield coverage in front of the king.'''
        direction = 1 if color == chess.WHITE else -1
        strength = 0.0
        king_file = chess.square_file(king_square)
        king_rank = chess.square_rank(king_square)
        for file_offset in (-1, 0, 1):
            target_file = king_file + file_offset
            if not 0 <= target_file <= 7:
                continue
            for distance, weight in ((1, 1.0), (2, 0.5)):
                target_rank = king_rank + direction * distance
                if 0 <= target_rank <= 7:
                    sq = chess.square(target_file, target_rank)
                    piece = board.piece_at(sq)
                    if piece and piece.piece_type == chess.PAWN and piece.color == color:
                        strength += weight
        return strength

    def _king_open_file_penalty(self, board: chess.Board, color: chess.Color, king_square: chess.Square) -> int:
        '''Count semi-open files near the king as a danger indicator.'''
        files_to_check = {chess.square_file(king_square)}
        for offset in (-1, 1):
            f = chess.square_file(king_square) + offset
            if 0 <= f <= 7:
                files_to_check.add(f)
        pawns = board.pieces(chess.PAWN, color)
        penalty = 0
        for f in files_to_check:
            if not any(chess.square_file(square) == f for square in pawns):
                penalty += 1
        return penalty

    def _king_ring_attackers(self, board: chess.Board, color: chess.Color, king_square: chess.Square) -> int:
        '''Count opposing attackers in the king's immediate ring.'''
        opponent = not color
        attackers = 0
        for sq in chess.SQUARES:
            if chess.square_distance(sq, king_square) != 1:
                continue
            attackers += len(board.attackers(opponent, sq))
        return attackers

    def _king_safety_score(self, board: chess.Board, color: chess.Color) -> int:
        '''Aggregate king safety heuristics for a single side.'''
        king_square = board.king(color)
        if king_square is None:
            return 0
        shield = self._pawn_shield_strength(board, color, king_square)
        direct_attackers = len(board.attackers(not color, king_square))
        ring_attackers = self._king_ring_attackers(board, color, king_square)
        open_files = self._king_open_file_penalty(board, color, king_square)
        score = int(shield * KING_SAFETY_SHIELD_WEIGHT)
        score -= direct_attackers * KING_SAFETY_ATTACK_WEIGHT
        score -= ring_attackers * KING_RING_ATTACK_PENALTY
        score -= open_files * KING_OPEN_FILE_PENALTY
        return score

    def _passed_pawns(self, board: chess.Board, color: chess.Color):
        '''Identify passed pawns and compute their bonus score.'''
        direction = 1 if color == chess.WHITE else -1
        opponent = not color
        pawns = board.pieces(chess.PAWN, color)
        passed = []
        score = 0
        for pawn_square in pawns:
            file_idx = chess.square_file(pawn_square)
            rank_idx = chess.square_rank(pawn_square)
            is_blocked = False
            for file_offset in (-1, 0, 1):
                target_file = file_idx + file_offset
                if not 0 <= target_file <= 7:
                    continue
                r = rank_idx + direction
                while 0 <= r <= 7:
                    sq = chess.square(target_file, r)
                    piece = board.piece_at(sq)
                    if piece and piece.piece_type == chess.PAWN and piece.color == opponent:
                        is_blocked = True
                        break
                    r += direction
                if is_blocked:
                    break
            if is_blocked:
                continue
            passed.append(pawn_square)
            if color == chess.WHITE:
                index = max(0, min(7, rank_idx))
            else:
                index = max(0, min(7, 7 - rank_idx))
            score += PASSED_PAWN_BONUS[index]
        return passed, score

    def _identify_hanging_pieces(self, board: chess.Board, color: chess.Color):
        '''Find friendly pieces that are insufficiently defended.'''
        opponent = not color
        results: List[Dict[str, Any]] = []
        for square, piece in board.piece_map().items():
            if piece.color != color or piece.piece_type == chess.KING:
                continue
            attackers = board.attackers(opponent, square)
            if not attackers:
                continue
            defenders = board.attackers(color, square)
            attacker_count = len(attackers)
            defender_count = len(defenders)
            min_attacker_value = min(PIECE_VALUES[board.piece_at(attacker_sq).symbol().upper()] for attacker_sq in attackers)
            min_defender_value = min(PIECE_VALUES[board.piece_at(defender_sq).symbol().upper()] for defender_sq in defenders) if defenders else None
            piece_value = PIECE_VALUES[piece.symbol().upper()]
            hanging = defender_count == 0 or defender_count < attacker_count or (min_defender_value is not None and min_attacker_value < min_defender_value and min_attacker_value < piece_value)
            if not hanging:
                continue
            results.append({
                'square': chess.square_name(square),
                'piece': piece.symbol(),
                'value': piece_value,
                'attackers': attacker_count,
                'defenders': defender_count
            })
        return results

    def _hanging_penalty(self, hanging_pieces: List[Dict[str, Any]]) -> int:
        '''Translate hanging piece list into a score penalty.'''
        penalty = 0
        for entry in hanging_pieces:
            value = entry.get('value', 100)
            penalty += max(int(value * HANGING_PIECE_VALUE_MULTIPLIER), HANGING_PIECE_MIN_PENALTY)
        return penalty

    def _evaluate_board_basic(self, board: chess.Board):
        '''Heuristic evaluation with feature breakdown for fallback analysis.'''
        cache_key = self._basic_cache_key(board)
        cached = self._basic_eval_cache.get(cache_key)
        if cached is not None:
            return cached

        material_white = 0
        material_black = 0
        pst_white = 0
        pst_black = 0
        for square, piece in board.piece_map().items():
            value = PIECE_VALUES[piece.symbol().upper()]
            table = PIECE_SQUARE_TABLES[piece.symbol().upper()]
            if piece.color == chess.WHITE:
                material_white += value
                pst_white += table[square]
            else:
                material_black += value
                pst_black += table[chess.square_mirror(square)]

        material_score = material_white - material_black
        pst_score = pst_white - pst_black

        mobility_white = self._count_legal_moves(board, chess.WHITE)
        mobility_black = self._count_legal_moves(board, chess.BLACK)
        mobility_score = MOBILITY_WEIGHT * (mobility_white - mobility_black)

        king_safety_white = self._king_safety_score(board, chess.WHITE)
        king_safety_black = self._king_safety_score(board, chess.BLACK)
        king_safety_score = king_safety_white - king_safety_black

        passed_white, passed_white_score = self._passed_pawns(board, chess.WHITE)
        passed_black, passed_black_score = self._passed_pawns(board, chess.BLACK)
        passed_score = passed_white_score - passed_black_score

        hanging_white = self._identify_hanging_pieces(board, chess.WHITE)
        hanging_black = self._identify_hanging_pieces(board, chess.BLACK)
        hanging_penalty_white = self._hanging_penalty(hanging_white)
        hanging_penalty_black = self._hanging_penalty(hanging_black)
        threat_score = hanging_penalty_black - hanging_penalty_white

        total_score = material_score + pst_score + mobility_score + king_safety_score + passed_score + threat_score

        features = {
            'components': {
                'material': material_score,
                'piece_square': pst_score,
                'mobility': mobility_score,
                'king_safety': king_safety_score,
                'passed_pawns': passed_score,
                'threats': threat_score
            },
            'material': {'white': material_white, 'black': material_black},
            'piece_square': {'white': pst_white, 'black': pst_black},
            'mobility': {'white': mobility_white, 'black': mobility_black},
            'king_safety': {'white': king_safety_white, 'black': king_safety_black},
            'passed_pawns': {
                'white': {
                    'count': len(passed_white),
                    'score': passed_white_score,
                    'squares': [chess.square_name(s) for s in passed_white]
                },
                'black': {
                    'count': len(passed_black),
                    'score': passed_black_score,
                    'squares': [chess.square_name(s) for s in passed_black]
                }
            },
            'hanging_pieces': {
                'white': hanging_white,
                'black': hanging_black
            }
        }

        result = (total_score, features)
        self._basic_eval_cache[cache_key] = result
        if len(self._basic_eval_cache) > 5000:
            oldest_key = next(iter(self._basic_eval_cache))
            del self._basic_eval_cache[oldest_key]
        return result

    def _basic_move_candidates(self, board: chess.Board):
        '''Score legal moves using the heuristic evaluator and cache the results.'''
        cache_key = f"{self._basic_cache_key(board)}|moves"
        cached = self._basic_move_cache.get(cache_key)
        if cached is not None:
            return cached
        candidates = []
        color_to_move = board.turn
        for move in board.legal_moves:
            san = board.san(move)
            board.push(move)
            score, _ = self._evaluate_board_basic(board)
            board.pop()
            candidates.append({
                'move': move,
                'uci': move.uci(),
                'san': san,
                'score': score
            })
        reverse = color_to_move == chess.WHITE
        candidates.sort(key=lambda item: item['score'], reverse=reverse)
        self._basic_move_cache[cache_key] = candidates
        if len(self._basic_move_cache) > 2000:
            oldest_key = next(iter(self._basic_move_cache))
            del self._basic_move_cache[oldest_key]
        return candidates

    async def _maybe_probe_stockfish_basic(self, board: chess.Board, move: chess.Move, color_to_move: chess.Color) -> Optional[Dict[str, Any]]:
        """Optionally refine heuristics with a lightweight Stockfish probe."""
        if not self.stockfish_path:
            return None

        before_key = f"{self._basic_cache_key(board)}|sf"
        before_eval = self._basic_probe_cache.get(before_key)
        if before_eval is None and len(self._basic_probe_cache) < BASIC_ENGINE_PROBE_LIMIT:
            before_eval = await asyncio.to_thread(self._run_stockfish_probe, board.fen())
            if before_eval:
                self._basic_probe_cache[before_key] = before_eval
                self._trim_basic_probe_cache()

        board.push(move)
        try:
            after_key = f"{self._basic_cache_key(board)}|sf"
            after_fen = board.fen()
            after_eval = self._basic_probe_cache.get(after_key)
            if after_eval is None and len(self._basic_probe_cache) < BASIC_ENGINE_PROBE_LIMIT:
                after_eval = await asyncio.to_thread(self._run_stockfish_probe, after_fen)
                if after_eval:
                    self._basic_probe_cache[after_key] = after_eval
                    self._trim_basic_probe_cache()
        finally:
            board.pop()

        before_eval = self._basic_probe_cache.get(before_key)
        after_eval = self._basic_probe_cache.get(after_key)
        refined_loss = None
        if before_eval and after_eval and before_eval.get('type') == 'cp' and after_eval.get('type') == 'cp':
            if color_to_move == chess.WHITE:
                refined_loss = max(0, before_eval['value'] - after_eval['value'])
            else:
                refined_loss = max(0, after_eval['value'] - before_eval['value'])

        return {
            'before': before_eval,
            'after': after_eval,
            'loss': refined_loss
        }

    def _run_stockfish_probe(self, fen: str) -> Optional[Dict[str, Any]]:
        """Run a very short Stockfish evaluation for the given FEN."""
        if not self.stockfish_path:
            return None
        try:
            with chess.engine.SimpleEngine.popen_uci(self.stockfish_path) as engine:
                engine.configure({
                    'Skill Level': 20,  # Maximum strength
                    'Threads': 1,
                    'Hash': 96,  # Better balance for Railway Hobby tier
                    'UCI_AnalyseMode': True
                })
                limit = chess.engine.Limit(time=BASIC_ENGINE_PROBE_TIME)
                info = engine.analyse(chess.Board(fen), limit, multipv=BASIC_ENGINE_PROBE_MULTIPV)
                primary = info[0] if isinstance(info, list) else info
                score = primary.get('score', chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))
                perspective = score.pov(chess.WHITE)
                pv_moves = primary.get('pv', []) or []
                pv_uci = [mv.uci() for mv in pv_moves[:3]]
                best_move = pv_uci[0] if pv_uci else None
                if perspective.is_mate():
                    return {'type': 'mate', 'value': perspective.mate(), 'best_move': best_move, 'pv': pv_uci}
                return {'type': 'cp', 'value': perspective.score(), 'best_move': best_move, 'pv': pv_uci}
        except Exception:
            return None

    def _trim_basic_probe_cache(self) -> None:
        """Keep the probe cache within the configured limit."""
        while len(self._basic_probe_cache) > BASIC_ENGINE_PROBE_LIMIT:
            oldest_key = next(iter(self._basic_probe_cache))
            del self._basic_probe_cache[oldest_key]

    def _static_exchange_evaluation(self, board: chess.Board, move: chess.Move) -> int:
        """Compatibility wrapper around python-chess SEE helpers."""
        if hasattr(board, 'see'):
            return board.see(move)
        if hasattr(board, 'static_exchange_evaluation'):
            return board.static_exchange_evaluation(move)
        return 0

    async def analyze_position(self, fen: str, analysis_type: Optional[AnalysisType] = None) -> Dict:
        """Analyze a chess position."""
        analysis_type = analysis_type or self.config.analysis_type
        start_time = datetime.now()
        
        try:
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
            print(f"[GAME ANALYSIS] Parsing PGN for game_id: {game_id}, user: {user_id}, platform: {platform}")
            print(f"[GAME ANALYSIS] PGN preview (first 200 chars): {pgn[:200] if pgn else 'None'}...")
            pgn_io = io.StringIO(pgn)
            game = chess.pgn.read_game(pgn_io)
            
            if not game:
                print(f"[GAME ANALYSIS] ❌ Failed to parse PGN - chess.pgn.read_game() returned None")
                return None
            
            # Use provided game_id or extract from PGN headers
            if not game_id:
                headers = game.headers
                site = headers.get('Site', '')
                # Extract game ID from Site URL (e.g., "https://www.chess.com/game/live/123456" -> "123456")
                # or from Link header if Site is not a full URL
                
                # List of parts to exclude (domain names, path segments)
                excluded_parts = {'chess.com', 'lichess.org', 'www.chess.com', 'www.lichess.org', 'game', 'live', ''}
                
                if site:
                    parts = site.split('/')
                    # Get the last non-empty part that's not a domain/path segment
                    # Use case-insensitive comparison
                    game_id = next((part for part in reversed(parts) if part.lower() not in excluded_parts), None)
                
                # If we couldn't extract from Site, try Link header
                if not game_id:
                    link = headers.get('Link', '')
                    if link:
                        parts = link.split('/')
                        game_id = next((part for part in reversed(parts) if part.lower() not in excluded_parts), None)
                
                # Last resort: generate a unique game ID
                if not game_id:
                    game_id = f"game_{int(datetime.now().timestamp() * 1000)}"
                    print(f"[GAME ANALYSIS] ⚠️  Warning: Could not extract game_id from PGN headers. Site: '{site}'. Generated ID: {game_id}")
            
            # Analyze each move
            moves_analysis = []
            board = game.board()
            headers = game.headers
            user_is_white = True
            if headers:
                white_player = headers.get('White', '').strip()
                black_player = headers.get('Black', '').strip()
                
                # More robust user color detection
                if white_player and black_player:
                    # Try exact match first
                    if white_player.lower() == user_id.lower():
                        user_is_white = True
                    elif black_player.lower() == user_id.lower():
                        user_is_white = False
                    else:
                        # Try partial match (in case of usernames with extra characters)
                        white_match = user_id.lower() in white_player.lower() or white_player.lower() in user_id.lower()
                        black_match = user_id.lower() in black_player.lower() or black_player.lower() in user_id.lower()
                        
                        if white_match and not black_match:
                            user_is_white = True
                        elif black_match and not white_match:
                            user_is_white = False
                        else:
                            # If both match or neither match, default to white and log warning
                            print(f"Warning: Could not determine user color for {user_id}. White: '{white_player}', Black: '{black_player}'. Defaulting to white.")
                            user_is_white = True
                else:
                    print(f"Warning: Missing player names in PGN headers. Defaulting to white.")
                    user_is_white = True

            # Collect all moves and board states first
            move_data = []
            for ply_index, move in enumerate(game.mainline_moves(), start=1):
                # Validate move is legal before adding to move_data
                if not board.is_legal(move):
                    print(f"⚠️  WARNING: Illegal move detected during PGN parsing: {move.uci()} at ply {ply_index} in position {board.fen()}")
                    print(f"   This indicates a corrupted or invalid PGN. Skipping this move.")
                    continue
                
                player_color = 'white' if board.turn == chess.WHITE else 'black'
                is_user_move = (board.turn == (chess.WHITE if user_is_white else chess.BLACK))
                fullmove_number = board.fullmove_number
                
                move_data.append({
                    'board': board.copy(),
                    'move': move,
                    'ply_index': ply_index,
                    'player_color': player_color,
                    'is_user_move': is_user_move,
                    'fullmove_number': fullmove_number
                })
                board.push(move)
            
            print(f"[GAME ANALYSIS] Successfully parsed {len(move_data)} moves from PGN")
            
            if not move_data:
                print(f"[GAME ANALYSIS] ❌ No valid moves found in PGN")
                return None
            
            # Analyze moves in parallel for better performance
            async def analyze_single_move(data):
                move_analysis = await self.analyze_move(data['board'], data['move'], analysis_type)
                move_analysis.player_color = data['player_color']
                move_analysis.is_user_move = data['is_user_move']
                move_analysis.ply_index = data['ply_index']
                move_analysis.fullmove_number = data['fullmove_number']
                return move_analysis
            
            # Process moves in parallel with Railway Hobby tier optimization
            # Railway Hobby tier has 8 GB RAM, so we can enable parallel move analysis
            # for significant performance improvements
            max_concurrent = 4  # 4 concurrent moves per game for Railway Hobby tier
            semaphore = asyncio.Semaphore(max_concurrent)
            
            async def analyze_with_semaphore(data):
                async with semaphore:
                    return await analyze_single_move(data)
            
            # Analyze all moves in parallel
            tasks = [analyze_with_semaphore(data) for data in move_data]
            moves_analysis = await asyncio.gather(*tasks)
            
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
        score, features = self._evaluate_board_basic(board)
        move_candidates = self._basic_move_candidates(board)
        top_candidates = [
            {
                'move': item['uci'],
                'san': item['san'],
                'score': item['score']
            }
            for item in move_candidates[:BASIC_MOVE_CANDIDATE_LIMIT]
        ]
        best_candidate = move_candidates[0] if move_candidates else None

        return {
            'evaluation': {'value': score, 'type': 'cp'},
            'best_move': best_candidate['uci'] if best_candidate else None,
            'fen': fen,
            'analysis_type': 'stockfish',
            'details': {
                'best_move_san': best_candidate['san'] if best_candidate else None,
                'top_moves': top_candidates,
                'feature_breakdown': features
            }
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
                # Configure engine for fast analysis (keep original speed)
                engine.configure({
                    'Skill Level': 8,  # Keep original fast settings
                    'UCI_LimitStrength': True,  # Keep original settings
                    'UCI_Elo': 2000  # Keep original settings
                })
                
                # Use configured time limit from environment variables
                info = engine.analyse(chess.Board(fen), chess.engine.Limit(time=self.config.time_limit))
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
            # Fallback to heuristic analysis
            return await self._analyze_position_basic(fen)
    
    async def _analyze_move_basic(self, board: chess.Board, move: chess.Move) -> MoveAnalysis:
        """Basic move analysis using improved heuristics."""
        # Validate move is legal before proceeding
        if not board.is_legal(move):
            print(f"Illegal move detected in basic analysis: {move.uci()} in position {board.fen()}")
            # Return a basic analysis for illegal moves
            return MoveAnalysis(
                move=move.uci(),
                move_san="illegal",
                evaluation={"value": 0, "type": "cp"},
                best_move=None,
                is_best=False,
                is_brilliant=False,
                is_good=False,
                is_acceptable=False,
                is_blunder=True,
                is_mistake=True,
                is_inaccuracy=False,
                centipawn_loss=1000.0,
                depth_analyzed=0,
                analysis_time_ms=0,
                explanation="Illegal move",
                heuristic_details={},
                accuracy_score=0.0
            )
        
        move_san = board.san(move)
        color_to_move = board.turn
        before_score, before_features = self._evaluate_board_basic(board)
        move_candidates = self._basic_move_candidates(board)
        top_candidates = [
            {
                'move': item['uci'],
                'san': item['san'],
                'score': item['score']
            }
            for item in move_candidates[:BASIC_MOVE_CANDIDATE_LIMIT]
        ]
        best_candidate = move_candidates[0] if move_candidates else None
        best_move_uci = best_candidate['uci'] if best_candidate else move.uci()

        see_score = self._static_exchange_evaluation(board, move)
        is_capture = board.is_capture(move)
        gives_check = board.gives_check(move)

        # Calculate move number before making the move
        move_number = (board.fullmove_number - 1) * 2 + (0 if board.turn == chess.WHITE else 1)

        board.push(move)
        after_score, after_features = self._evaluate_board_basic(board)
        board.pop()

        color_key = 'white' if color_to_move == chess.WHITE else 'black'
        king_safety_before = before_features['king_safety'][color_key]
        king_safety_after = after_features['king_safety'][color_key]
        king_safety_drop = king_safety_before - king_safety_after

        mobility_before = before_features['mobility'][color_key]
        mobility_after = after_features['mobility'][color_key]
        mobility_change = mobility_after - mobility_before

        hanging_before = {entry['square'] for entry in before_features['hanging_pieces'][color_key]}
        hanging_after = after_features['hanging_pieces'][color_key]
        new_hanging = [entry for entry in hanging_after if entry['square'] not in hanging_before]

        if color_to_move == chess.WHITE:
            delta = after_score - before_score
            centipawn_loss = max(0, before_score - after_score)
        else:
            delta = before_score - after_score
            centipawn_loss = max(0, after_score - before_score)

        heuristic_loss = centipawn_loss

        best_alternative = None
        for candidate in move_candidates:
            if candidate['uci'] != move.uci():
                best_alternative = candidate
                break

        if best_candidate:
            if color_to_move == chess.WHITE:
                best_gap = max(0, best_candidate['score'] - after_score)
            else:
                best_gap = max(0, after_score - best_candidate['score'])
        else:
            best_gap = 0

        loss_from_best_gap = best_gap >= BASIC_INACCURACY_THRESHOLD
        if best_gap > centipawn_loss:
            centipawn_loss = best_gap

        triggers = []
        if is_capture:
            triggers.append('capture')
        if gives_check:
            triggers.append('check')
        if see_score <= SEE_MATERIAL_LOSS_TRIGGER:
            triggers.append('material_loss')
        if king_safety_drop >= KING_SAFETY_DROP_TRIGGER:
            triggers.append('king_safety')
        if mobility_change <= MOBILITY_DROP_TRIGGER:
            triggers.append('mobility_drop')
        if new_hanging:
            triggers.append('exposes_piece')

        refinement = None
        engine_probe_used = False
        if self.stockfish_path:
            should_probe = (
                centipawn_loss >= BASIC_MISTAKE_THRESHOLD
                or 'material_loss' in triggers
                or 'king_safety' in triggers
                or 'exposes_piece' in triggers
            )
            if should_probe:
                refinement = await self._maybe_probe_stockfish_basic(board, move, color_to_move)
                if refinement:
                    has_engine_data = bool(refinement.get('before') or refinement.get('after'))
                    engine_probe_used = has_engine_data
                    if has_engine_data:
                        refined_loss = refinement.get('loss')
                        if refined_loss is not None:
                            centipawn_loss = refined_loss

        # Industry-standard move classification for heuristic analysis
        is_best = centipawn_loss <= BASIC_BEST_THRESHOLD

        triggers = triggers or []
        # Heuristic brilliant move detection - much stricter to match Chess.com standards
        # Only mark as brilliant if it's a best move AND has very specific tactical brilliance
        sacrifice_trigger = ('capture' in triggers and delta > 0) or 'exposes_piece' in triggers
        forcing_mate_trigger = bool(refinement and refinement.get('after') and refinement['after'].get('type') == 'mate')
        evaluation_swing_trigger = delta >= 200
        checking_move_trigger = ('check' in triggers and delta > 0)

        # Much stricter brilliant criteria for heuristic analysis
        # Only allow if it's a best move AND has forced mate (heuristic can't detect sacrifices well)
        is_brilliant = is_best and forcing_mate_trigger
        is_good = BASIC_BEST_THRESHOLD < centipawn_loss <= BASIC_GOOD_THRESHOLD
        is_acceptable = BASIC_GOOD_THRESHOLD < centipawn_loss <= BASIC_ACCEPTABLE_THRESHOLD
        is_inaccuracy = BASIC_ACCEPTABLE_THRESHOLD < centipawn_loss <= BASIC_INACCURACY_THRESHOLD
        is_mistake = BASIC_INACCURACY_THRESHOLD < centipawn_loss <= BASIC_MISTAKE_THRESHOLD
        is_blunder = centipawn_loss > BASIC_BLUNDER_THRESHOLD and (
            loss_from_best_gap or
            see_score <= SEE_MATERIAL_LOSS_TRIGGER or
            king_safety_drop >= KING_SAFETY_DROP_TRIGGER or
            bool(new_hanging)
        )

        explanation_parts = []
        
        # Enhanced explanations for brilliant moves
        if is_brilliant:
            if centipawn_loss > 0:
                explanation_parts.append("Brilliant sacrifice of material")
            if see_score < -100:
                explanation_parts.append("in a calculated tactical sacrifice")
            elif see_score < 0:
                explanation_parts.append("in a tactical sacrifice")
            if gives_check:
                explanation_parts.append("while delivering a powerful check")
            if king_safety_drop < -30:
                explanation_parts.append("and dramatically improving king safety")
            if mobility_change > 15:
                explanation_parts.append("while significantly increasing piece mobility")
            if delta > 100:
                explanation_parts.append("resulting in a massive positional advantage")
            elif delta > 0:
                explanation_parts.append("creating a significant advantage")
            
            # Always provide a brilliant explanation, even if no specific criteria are met
            if not explanation_parts:
                if gives_check:
                    explanation_parts.append("Brilliant tactical resource that delivers a powerful check")
                else:
                    explanation_parts.append("Brilliant tactical resource that creates devastating threats")
            
            # Add context about why it's brilliant
            if len(explanation_parts) == 1 and "Brilliant" in explanation_parts[0]:
                explanation_parts.append("and demonstrates exceptional chess understanding")
        
        # Enhanced explanations for blunders
        elif is_blunder:
            if centipawn_loss > 200:
                explanation_parts.append("Catastrophic blunder losing significant material")
            elif centipawn_loss > 100:
                explanation_parts.append("Serious blunder losing material")
            if see_score < -200:
                explanation_parts.append("in a terrible material exchange")
            if new_hanging:
                for entry in new_hanging:
                    explanation_parts.append(f"and hangs {entry['piece']} on {entry['square']}")
            if king_safety_drop > 50:
                explanation_parts.append("while severely compromising king safety")
            if mobility_change < -15:
                explanation_parts.append("and dramatically reducing piece mobility")
            if delta < -200:
                explanation_parts.append("causing a devastating evaluation swing")
            if not explanation_parts:
                explanation_parts.append("Serious tactical error with major consequences")
        
        # Standard explanations for other moves
        else:
            if centipawn_loss > 0 and not is_best:
                explanation_parts.append("This move weakens your position.")
            if see_score <= SEE_MATERIAL_LOSS_TRIGGER and is_capture:
                explanation_parts.append(f"Capture on {chess.square_name(move.to_square)} drops material.")
            if new_hanging:
                for entry in new_hanging:
                    explanation_parts.append(f"Leaves {entry['piece']} on {entry['square']} undefended.")
            if king_safety_drop >= KING_SAFETY_DROP_TRIGGER:
                explanation_parts.append(f"King safety worsens by {int(king_safety_drop)} points.")
            if mobility_change <= MOBILITY_DROP_TRIGGER:
                explanation_parts.append(f"Reduces mobility by {abs(int(mobility_change))} moves.")
            if gives_check and centipawn_loss == 0:
                explanation_parts.append("Delivers check while staying safe.")
            if best_alternative and best_alternative['uci'] != move.uci() and best_gap > BASIC_BEST_THRESHOLD:
                explanation_parts.append(f"Better was {best_alternative['san']}.")
            if not explanation_parts:
                if delta > 0:
                    explanation_parts.append("Improves your position.")
                else:
                    explanation_parts.append("Keeps the position balanced.")
        
        explanation = ' '.join(explanation_parts)

        heuristic_details = {
            'before_score': before_score,
            'after_score': after_score,
            'delta': delta,
            'centipawn_loss': centipawn_loss,
            'heuristic_centipawn_loss': heuristic_loss,
            'see': see_score,
            'king_safety_before': king_safety_before,
            'king_safety_after': king_safety_after,
            'king_safety_drop': king_safety_drop,
            'mobility_before': mobility_before,
            'mobility_after': mobility_after,
            'mobility_change': mobility_change,
            'new_hanging_pieces': new_hanging,
            'best_candidate': {
                'move': best_candidate['uci'] if best_candidate else None,
                'san': best_candidate['san'] if best_candidate else None,
                'score': best_candidate['score'] if best_candidate else None
            },
            'best_alternative': {
                'move': best_alternative['uci'],
                'san': best_alternative['san'],
                'score': best_alternative['score']
            } if best_alternative else None,
            'top_candidates': top_candidates,
            'triggers': triggers,
            'best_gap': best_gap,
            'loss_from_best_gap': loss_from_best_gap
        }

        heuristic_details['engine_probe_used'] = engine_probe_used
        if refinement and engine_probe_used:
            heuristic_details['stockfish_refinement'] = refinement
            if refinement.get('loss') is not None:
                heuristic_details['refined_centipawn_loss'] = refinement['loss']
        evaluation_payload = {'value': after_score, 'type': 'cp', 'source': 'heuristic'}
        if refinement and refinement.get('after'):
            evaluation_payload = {
                'value': refinement['after'].get('value'),
                'type': refinement['after'].get('type', 'cp'),
                'source': 'stockfish',
                'best_move': refinement['after'].get('best_move'),
                'pv': refinement['after'].get('pv')
            }
        heuristic_details['evaluation_source'] = evaluation_payload['source']

        accuracy_score = 100.0 if is_best else 100.0 - min(100.0, centipawn_loss)

        # Create basic move analysis
        move_analysis = MoveAnalysis(
            move=move.uci(),
            move_san=move_san,
            evaluation=evaluation_payload,
            best_move=best_move_uci,
            is_best=is_best,
            is_brilliant=is_brilliant,
            is_good=is_good,
            is_acceptable=is_acceptable,
            is_blunder=is_blunder,
            is_mistake=is_mistake,
            is_inaccuracy=is_inaccuracy,
            centipawn_loss=float(centipawn_loss),
            depth_analyzed=0,
            analysis_time_ms=0,
            explanation=explanation,
            heuristic_details=heuristic_details,
            accuracy_score=accuracy_score
        )
        
        # Enhance with coaching comments
        # Move number was already calculated before the move was made
        # For now, assume all moves are user moves - this will be determined by the frontend
        return self._enhance_move_analysis_with_coaching(move_analysis, board, move, move_number, is_user_move=True)

    def _summarize_move_classifications(self, moves_analysis: List[MoveAnalysis]) -> Dict[str, int]:
        summary = {
            'brilliant': 0,
            'best': 0,
            'good': 0,
            'acceptable': 0,
            'inaccuracy': 0,
            'mistake': 0,
            'blunder': 0,
        }
        for move in moves_analysis:
            if move.is_brilliant:
                summary['brilliant'] += 1
            elif move.is_best:
                summary['best'] += 1
            elif move.is_good:
                summary['good'] += 1
            elif move.is_acceptable:
                summary['acceptable'] += 1
            elif move.is_inaccuracy:
                summary['inaccuracy'] += 1
            elif move.is_mistake:
                summary['mistake'] += 1
            elif move.is_blunder:
                summary['blunder'] += 1
        return summary

    def _determine_game_phase(self, board: chess.Board, move_number: int) -> GamePhase:
        """Determine the current game phase based on position and move number."""
        # Count pieces on the board
        piece_count = len(board.piece_map())
        
        # Opening: first 15 moves and many pieces on board
        if move_number <= 15 and piece_count >= 20:
            return GamePhase.OPENING
        
        # Endgame: few pieces remaining
        if piece_count <= 12:
            return GamePhase.ENDGAME
        
        # Middlegame: everything else
        return GamePhase.MIDDLEGAME

    def _enhance_move_analysis_with_coaching(self, move_analysis: MoveAnalysis, board: chess.Board, 
                                           move: chess.Move, move_number: int, 
                                           player_skill_level: str = "intermediate",
                                           is_user_move: bool = True) -> MoveAnalysis:
        """Enhance move analysis with comprehensive coaching comments."""
        try:
            # Determine game phase
            game_phase = self._determine_game_phase(board, move_number)
            
            # Prepare enhanced move analysis data with board positions
            enhanced_move_data = move_analysis.__dict__.copy()
            enhanced_move_data['board_before'] = board.copy()
            enhanced_move_data['board_after'] = board.copy()
            enhanced_move_data['move'] = move
            enhanced_move_data['move_san'] = move_analysis.move_san
            
            # Safely access heuristic_details with null checks
            heuristic_details = move_analysis.heuristic_details or {}
            enhanced_move_data['evaluation_before'] = heuristic_details.get('before_score', 0)
            enhanced_move_data['evaluation_after'] = heuristic_details.get('after_score', 0)
            enhanced_move_data['game_phase'] = game_phase.value
            enhanced_move_data['fullmove_number'] = move_number
            
            # Generate coaching comment
            coaching_comment = self.coaching_generator.generate_coaching_comment(
                enhanced_move_data,
                board,
                move,
                game_phase,
                player_skill_level,
                is_user_move
            )
            
            # Update move analysis with coaching data
            move_analysis.coaching_comment = coaching_comment.main_comment
            move_analysis.what_went_right = coaching_comment.what_went_right or ""
            move_analysis.what_went_wrong = coaching_comment.what_went_wrong or ""
            move_analysis.how_to_improve = coaching_comment.how_to_improve or ""
            move_analysis.tactical_insights = coaching_comment.tactical_insights
            move_analysis.positional_insights = coaching_comment.positional_insights
            move_analysis.risks = coaching_comment.risks
            move_analysis.benefits = coaching_comment.benefits
            move_analysis.learning_points = coaching_comment.learning_points
            move_analysis.encouragement_level = coaching_comment.encouragement_level
            move_analysis.move_quality = coaching_comment.move_quality.value
            move_analysis.game_phase = coaching_comment.game_phase.value
            
            return move_analysis
            
        except Exception as e:
            print(f"Error generating coaching comment: {e}")
            print(f"Move analysis details: move={move_analysis.move_san}, heuristic_details={type(move_analysis.heuristic_details)}")
            print(f"Board state: {board.fen()}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            # Return original analysis if coaching fails
            return move_analysis

    async def _analyze_move_stockfish(self, board: chess.Board, move: chess.Move, 
                                    analysis_type: AnalysisType) -> MoveAnalysis:
        """Stockfish move analysis - runs in thread pool for true parallelism."""
        if not self.stockfish_path:
            raise ValueError("Stockfish executable not found")
        
        depth = self.config.depth
        if analysis_type == AnalysisType.DEEP:
            depth = max(depth, 20)
        
        # Run Stockfish analysis in thread pool to avoid blocking
        import concurrent.futures
        loop = asyncio.get_event_loop()
        
        def run_stockfish_analysis():
            try:
                with chess.engine.SimpleEngine.popen_uci(self.stockfish_path) as engine:
                    # Configure engine for Railway Hobby tier optimization
                    # Phase 1: Speed + Accuracy optimizations
                    engine.configure({
                        'Skill Level': 20,  # Maximum strength for better analysis
                        'UCI_LimitStrength': False,  # Use full strength
                        'UCI_Elo': 2000,  # Keep original settings
                        'Threads': 1,  # Deterministic analysis
                        'Hash': 96  # Better balance for concurrency
                    })
                    
                    # Use configured time limit from environment variables
                    time_limit = self.config.time_limit
                    
                    # Get evaluation before move
                    info_before = engine.analyse(board, chess.engine.Limit(time=time_limit))
                    eval_before = info_before.get("score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))
                    best_move_before = info_before.get("pv", [None])[0]
                    player_color = board.turn

                    # Validate move is legal before proceeding
                    if not board.is_legal(move):
                        print(f"Illegal move detected: {move.uci()} in position {board.fen()}")
                        # Fallback to basic analysis for illegal moves - run in thread pool since this is not async
                        import asyncio
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        try:
                            result = loop.run_until_complete(self._analyze_move_basic(board, move))
                            return result
                        finally:
                            loop.close()
                    
                    # Get SAN notation before making the move
                    move_san = board.san(move)

                    # Make the move
                    board.push(move)

                    # Get evaluation after move
                    info_after = engine.analyse(board, chess.engine.Limit(time=time_limit))
                    eval_after = info_after.get("score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))

                    # Calculate centipawn loss relative to Stockfish's best move from the player's perspective
                    best_eval = eval_before.pov(player_color)
                    actual_eval = eval_after.pov(player_color)
                    mate_score = 1000  # treat forced mates as a 10-pawn swing
                    best_cp = best_eval.score(mate_score=mate_score)
                    actual_cp = actual_eval.score(mate_score=mate_score)
                    centipawn_loss = max(0, best_cp - actual_cp)
                    
                    # Chess.com EXACT standards (Expected Points Model)
                    # Reference: https://support.chess.com/en/articles/8572705
                    # Based on expected points (win probability) loss:
                    # - Best Move: 0.00 loss
                    # - Excellent: 0.00-0.02 loss  (~0-20cp depending on position)
                    # - Good: 0.02-0.05 loss       (~20-50cp depending on position)
                    # - Inaccuracy: 0.05-0.10 loss (~50-100cp depending on position)
                    # - Mistake: 0.10-0.20 loss    (~100-200cp depending on position)
                    # - Blunder: 0.20+ loss        (~200+cp depending on position)
                    #
                    # Chess.com-aligned thresholds:
                    is_best = centipawn_loss <= 5      # Best moves (engine top choice, 0-5cp)
                    is_great = 5 < centipawn_loss <= 15      # Great moves (very strong, 5-15cp)
                    is_excellent = 15 < centipawn_loss <= 25  # Excellent moves (nearly optimal, 15-25cp)
                    is_good = 25 < centipawn_loss <= 50      # Good/Acceptable moves (solid play, 25-50cp)
                    is_acceptable = 25 < centipawn_loss <= 50  # Same as good (conventional moves)
                    is_inaccuracy = 50 < centipawn_loss <= 100  # Inaccuracies (50-100cp) - Chess.com standard
                    is_mistake = 100 < centipawn_loss <= 200  # Mistakes (100-200cp) - Chess.com standard
                    is_blunder = centipawn_loss > 200  # Blunders (200+cp) - Chess.com standard

                    # Brilliant moves: EXTREMELY rare - Chess.com/Lichess standards
                    # Should appear in ~0-1 per 100+ games (not per game!)
                    # Requirements based on Chess.com official criteria:
                    # 1. Must be best or nearly best move (0-5cp loss maximum)
                    # 2. Must involve non-obvious piece sacrifice (3+ points net) OR find short forced mate
                    # 3. Position must remain winning after sacrifice (not just equal)
                    # 4. Player must not already be completely winning (not just converting)
                    # 5. Move must be difficult to find (tactical brilliance)
                    is_brilliant = False
                    
                    if is_best and centipawn_loss <= 5:  # Must be near-perfect move (0-5cp loss)
                        # Define optimal_cp (the evaluation if best move was played)
                        optimal_cp = best_cp
                        
                        # Check for forced mate found when there wasn't one before
                        forcing_mate_trigger = (
                            eval_after.pov(player_color).is_mate() and 
                            not eval_before.pov(player_color).is_mate() and
                            abs(eval_after.pov(player_color).mate()) <= 3  # Very short forced mate (within 3 moves)
                        )
                        
                        # Check for spectacular material sacrifice
                        piece_values = {'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0}
                        sacrifice_trigger = False
                        
                        # Look at the position BEFORE the move was made (need to undo it temporarily)
                        board.pop()  # Undo move to check original position
                        
                        # Check for sacrifice (giving up material for tactical gain)
                        if board.is_capture(move):
                            captured_piece = board.piece_at(move.to_square)
                            moving_piece = board.piece_at(move.from_square)
                            
                            if captured_piece and moving_piece:
                                captured_value = piece_values.get(captured_piece.symbol().upper(), 0)
                                moving_value = piece_values.get(moving_piece.symbol().upper(), 0)
                                
                                # Calculate net material sacrificed
                                # Positive = sacrificing material (e.g., Queen for Rook = 9-5 = 4)
                                # Negative = winning material (e.g., Rook for Pawn = 5-1 = 4... wait, that's also positive)
                                # Actually: moving_value - captured_value
                                # If we give up Queen (9) for Rook (5): 9-5 = 4 (sacrificed 4 points)
                                # If we give up Rook (5) for Pawn (1): 5-1 = 4 (sacrificed 4 points)
                                # If we capture Queen (9) with Knight (3): 3-9 = -6 (won 6 points)
                                net_material_sacrificed = moving_value - captured_value
                                
                                # STRICTER sacrifice criteria (aligned with Chess.com):
                                # 1. Must sacrifice at least 3 points net (e.g., Queen for Knight, Rook for Bishop)
                                # 2. Position must be WINNING after sacrifice (not just equal)
                                # 3. Player must not already be completely winning (not just converting)
                                # 4. Move must be engine's top choice
                                significant_sacrifice = net_material_sacrificed >= 3  # Stricter: 3+ points, not 2+
                                
                                # Position must be WINNING after sacrifice (not just equal)
                                # This prevents labeling equal trades as brilliant
                                position_winning_after = actual_cp >= 100  # Winning by at least 1.0 pawns
                                
                                # Player must not already be completely winning (not just converting)
                                # This prevents labeling obvious winning moves as brilliant
                                not_already_completely_winning = optimal_cp < 300  # Not already +3 pawns ahead
                                
                                # Position must be maintained or improved (not deteriorated)
                                position_maintained = actual_cp >= optimal_cp - 30  # Didn't get worse by more than 0.3 pawns
                                
                                sacrifice_trigger = (
                                    significant_sacrifice and 
                                    position_winning_after and 
                                    not_already_completely_winning and
                                    position_maintained
                                )
                        
                        # Restore the board state
                        board.push(move)
                        
                        # Brilliant ONLY for:
                        # - Finding very short forced mate (3 moves or less) OR
                        # - Spectacular sacrifice (3+ material) that maintains winning position
                        is_brilliant = forcing_mate_trigger or sacrifice_trigger
                    
                    # Convert evaluation to dict
                    evaluation = {
                        "value": eval_after.pov(chess.WHITE).score() if not eval_after.pov(chess.WHITE).is_mate() else 0,
                        "type": "cp" if not eval_after.pov(chess.WHITE).is_mate() else "mate"
                    }
                    
                    # Create basic move analysis
                    move_analysis = MoveAnalysis(
                        move=move.uci(),
                        move_san=move_san,
                        evaluation=evaluation,
                        best_move=best_move_before.uci() if best_move_before else None,
                        is_best=is_best,
                        is_brilliant=is_brilliant,
                        is_great=is_great,
                        is_excellent=is_excellent,
                        is_good=is_good,
                        is_acceptable=is_acceptable,
                        is_blunder=is_blunder,
                        is_mistake=is_mistake,
                        is_inaccuracy=is_inaccuracy,
                        centipawn_loss=float(centipawn_loss),
                        depth_analyzed=depth,
                        analysis_time_ms=int(time_limit * 1000),
                        explanation=None,
                        heuristic_details={},
                        accuracy_score=100.0 if is_best else max(0.0, 100.0 - centipawn_loss)
                    )
                    
                    # Enhance with coaching comments
                    # Calculate move number BEFORE the move was made
                    # We need to undo the move temporarily to get the correct move number
                    board.pop()  # Undo the move to get the original position
                    move_number = (board.fullmove_number - 1) * 2 + (0 if board.turn == chess.WHITE else 1)
                    board.push(move)  # Restore the move for coaching analysis
                    # For now, assume all moves are user moves - this will be determined by the frontend
                    return self._enhance_move_analysis_with_coaching(move_analysis, board, move, move_number, is_user_move=True)
            except Exception as e:
                error_msg = str(e)
                if "exit code: -9" in error_msg or "died unexpectedly" in error_msg:
                    print(f"⚠️  Stockfish move analysis failed (likely OOM): {e}")
                    print(f"   This is usually caused by memory constraints on Railway free tier.")
                    print(f"   Falling back to basic heuristic analysis...")
                else:
                    print(f"Stockfish move analysis failed: {e}")
                # Fallback to heuristic analysis - run in thread pool since this is not async
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    result = loop.run_until_complete(self._analyze_move_basic(board, move))
                    return result
                finally:
                    loop.close()
        
        # Run the blocking Stockfish call in a thread pool executor
        # Use Railway Hobby tier concurrency for better performance
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                result = await loop.run_in_executor(executor, run_stockfish_analysis)
                return result
        except Exception as e:
            error_msg = str(e)
            if "exit code: -9" in error_msg or "died unexpectedly" in error_msg:
                print(f"⚠️  Thread pool execution failed (likely OOM): {e}")
                print(f"   Stockfish process was killed by system. Falling back to basic analysis...")
            else:
                print(f"Thread pool execution failed: {e}")
            # Fallback to heuristic analysis
            return await self._analyze_move_basic(board, move)
    
    def _calculate_game_metrics(self, game_id: str, user_id: str, platform: str, 
                               moves_analysis: List[MoveAnalysis], 
                               analysis_type: AnalysisType) -> GameAnalysis:
        """Calculate comprehensive game-level metrics."""
        # Determine user/opponent moves
        user_moves = [m for m in moves_analysis if m.is_user_move]
        opponent_moves = [m for m in moves_analysis if not m.is_user_move]

        if not user_moves or not opponent_moves:
            user_is_white = moves_analysis[0].player_color == 'white' if moves_analysis else True
            user_moves = [m for m in moves_analysis if (m.player_color == 'white') == user_is_white]
            opponent_moves = [m for m in moves_analysis if m not in user_moves]

        if not user_moves:
            user_moves = moves_analysis[::2]
        if not opponent_moves:
            opponent_moves = moves_analysis[1::2]

        blunders = sum(1 for m in user_moves if m.is_blunder)
        mistakes = sum(1 for m in user_moves if m.is_mistake)
        inaccuracies = sum(1 for m in user_moves if m.is_inaccuracy)
        best_moves = sum(1 for m in user_moves if m.is_best)
        brilliant_moves = sum(1 for m in user_moves if m.is_brilliant)
        good_moves = sum(1 for m in user_moves if m.is_good)
        acceptable_moves = sum(1 for m in user_moves if m.is_acceptable)

        opponent_blunders = sum(1 for m in opponent_moves if m.is_blunder)
        opponent_mistakes = sum(1 for m in opponent_moves if m.is_mistake)
        opponent_inaccuracies = sum(1 for m in opponent_moves if m.is_inaccuracy)
        opponent_best_moves = sum(1 for m in opponent_moves if m.is_best)

        user_move_count = len(user_moves)
        opponent_move_count = len(opponent_moves)

        # Calculate accuracy using Chess.com-style formula based on win percentage
        # This uses a graduated accuracy system that more accurately reflects how
        # centipawn loss impacts actual game outcomes
        
        if user_move_count > 0:
            centipawn_losses = [m.centipawn_loss for m in user_moves]
            accuracy = self._calculate_accuracy_from_cpl(centipawn_losses)
        else:
            accuracy = 0
        
        # Calculate opponent accuracy similarly
        if opponent_move_count > 0:
            opponent_centipawn_losses = [m.centipawn_loss for m in opponent_moves]
            opponent_accuracy = self._calculate_accuracy_from_cpl(opponent_centipawn_losses)
        else:
            opponent_accuracy = 0
        
        # Phase analysis based on user's moves only
        user_move_count = len(user_moves)
        opponent_move_count = len(opponent_moves)

        # Chess.com typically uses first 10-12 moves for opening analysis
        # We'll use 10 moves maximum (20 ply) for more realistic opening accuracy
        opening_end = min(10, user_move_count)
        endgame_start = max(user_move_count - 10, user_move_count // 2)

        # Filter opening moves - first 10 moves (20 plies)
        opening_moves = user_moves[:opening_end]
        
        middle_game_moves = user_moves[opening_end:endgame_start]
        endgame_moves = user_moves[endgame_start:]
        
        # Use Chess.com method for opening only
        opening_accuracy = self._calculate_opening_accuracy_chesscom_style(opening_moves)
        middle_game_accuracy = self._calculate_phase_accuracy(middle_game_moves)
        endgame_accuracy = self._calculate_phase_accuracy(endgame_moves)
        
        # Advanced metrics
        centipawn_losses = [m.centipawn_loss for m in user_moves]
        average_centipawn_loss = sum(centipawn_losses) / len(centipawn_losses) if centipawn_losses else 0
        worst_blunder_centipawn_loss = max(centipawn_losses) if centipawn_losses else 0
        opponent_centipawn_losses = [m.centipawn_loss for m in opponent_moves]
        opponent_average_cpl = sum(opponent_centipawn_losses) / len(opponent_centipawn_losses) if opponent_centipawn_losses else 0
        opponent_worst_blunder = max(opponent_centipawn_losses) if opponent_centipawn_losses else 0
        
        # Calculate additional metrics for personality scores
        time_management_score = self._calculate_time_management_score(user_moves)
        opponent_time_management_score = self._calculate_time_management_score(opponent_moves)
        
        # Personality scores
        personality_scores = self._calculate_personality_scores(
            user_moves=user_moves,
            time_management_score=time_management_score
        )
        
        # Patterns and themes
        tactical_patterns = self._extract_tactical_patterns(moves_analysis)
        positional_patterns = self._extract_positional_patterns(moves_analysis)
        strategic_themes = self._extract_strategic_themes(moves_analysis)
        
        return GameAnalysis(
            game_id=game_id,
            user_id=user_id,
            platform=platform,
            total_moves=user_move_count,
            moves_analysis=moves_analysis,
            accuracy=round(accuracy, 2),
            opponent_accuracy=round(opponent_accuracy, 2),
            blunders=blunders,
            mistakes=mistakes,
            inaccuracies=inaccuracies,
            brilliant_moves=brilliant_moves,
            best_moves=best_moves,
            good_moves=good_moves,
            acceptable_moves=acceptable_moves,
            opening_accuracy=round(opening_accuracy, 2),
            middle_game_accuracy=round(middle_game_accuracy, 2),
            endgame_accuracy=round(endgame_accuracy, 2),
            average_centipawn_loss=round(average_centipawn_loss, 2),
            worst_blunder_centipawn_loss=round(worst_blunder_centipawn_loss, 2),
            time_management_score=round(time_management_score, 2),
            opponent_average_centipawn_loss=round(opponent_average_cpl, 2),
            opponent_worst_blunder_centipawn_loss=round(opponent_worst_blunder, 2),
            opponent_time_management_score=round(opponent_time_management_score, 2),
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
        """Calculate accuracy for a game phase using Chess.com-style graduated accuracy."""
        if not moves:
            return 0.0
        
        # Use the same graduated accuracy calculation as overall accuracy
        centipawn_losses = [move.centipawn_loss for move in moves]
        return self._calculate_accuracy_from_cpl(centipawn_losses)
    
    def _calculate_accuracy_from_cpl(self, centipawn_losses: List[float]) -> float:
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
    
    def _centipawns_to_win_prob(self, cp: float) -> float:
        """Convert centipawns to win probability using Chess.com formula."""
        return 1.0 / (1.0 + 10 ** (-cp / 400.0))

    def _calculate_opening_accuracy_chesscom_style(self, opening_moves: List[MoveAnalysis]) -> float:
        """
        Calculate opening accuracy using a more conservative approach that matches Chess.com.
        This provides realistic accuracy scores that don't inflate to 100%.
        """
        if not opening_moves:
            return 0.0
        
        total_accuracy = 0.0
        for move in opening_moves:
            # Use centipawn loss directly - this is more reliable than trying to reconstruct evaluations
            centipawn_loss = move.centipawn_loss
            
            # Much more conservative accuracy calculation to avoid 100% scores
            # Only truly perfect moves get 100%, everything else is penalized more heavily
            if centipawn_loss <= 2:
                move_accuracy = 100.0  # Only truly perfect moves (0-2 CPL)
            elif centipawn_loss <= 8:
                move_accuracy = 90.0 - (centipawn_loss - 2) * 2.5  # 90% to 75%
            elif centipawn_loss <= 20:
                move_accuracy = 75.0 - (centipawn_loss - 8) * 1.5  # 75% to 57%
            elif centipawn_loss <= 40:
                move_accuracy = 57.0 - (centipawn_loss - 20) * 1.0  # 57% to 37%
            elif centipawn_loss <= 80:
                move_accuracy = 37.0 - (centipawn_loss - 40) * 0.5  # 37% to 17%
            else:
                move_accuracy = max(5.0, 17.0 - (centipawn_loss - 80) * 0.1)  # 17% to 5%
            
            total_accuracy += move_accuracy
        
        return total_accuracy / len(opening_moves)
    
    def _calculate_time_management_score(self, moves: List[MoveAnalysis]) -> float:
        """Calculate time management score based on move timing patterns.
        
        Returns score on 0-100 scale where:
        - 0-30: Very fast/impulsive play
        - 30-50: Quick decisions
        - 50-70: Balanced time usage
        - 70-90: Slow/careful thinking
        - 90-100: Very slow/deliberate play
        """
        if not moves:
            return 50.0
        
        # TODO: Implement proper time management calculation using move timestamps
        # For now, return neutral score (50.0) since we don't have timing data
        # This prevents the bug where 0.75 was being treated as 0.75% instead of 75%
        return 50.0  # Neutral - awaiting implementation
    
    def _calculate_personality_scores(self, user_moves: List[MoveAnalysis], time_management_score: float = 0.0) -> Dict[str, float]:
        """Calculate six-trait personality scores from the user's moves."""
        from .personality_scoring import PersonalityScorer
        
        # Convert MoveAnalysis objects to dictionaries for the standardized scorer
        moves_data = []
        for move in user_moves:
            moves_data.append({
                'move_san': move.move_san,
                'ply_index': move.ply_index,
                'centipawn_loss': move.centipawn_loss,
                'is_best': move.is_best,
                'is_blunder': move.is_blunder,
                'is_mistake': move.is_mistake,
                'is_inaccuracy': move.is_inaccuracy,
            })
        
        scorer = PersonalityScorer()
        scores = scorer.calculate_scores(moves_data, time_management_score)
        
        # Return with legacy field names for backward compatibility
        return {
            'tactical_score': round(scores.tactical, 1),
            'positional_score': round(scores.positional, 1),
            'aggressive_score': round(scores.aggressive, 1),
            'patient_score': round(scores.patient, 1),
            'novelty_score': round(scores.novelty, 1),
            'staleness_score': round(scores.staleness, 1),
        }

    @staticmethod
    def _clamp_score(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
        """Clamp a score into a safe range."""
        return max(minimum, min(maximum, value))

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
        
        # Test heuristic fallback analysis
        print("\n=== Testing Heuristic Fallback Analysis ===")
        heuristic_config = AnalysisConfig(analysis_type=AnalysisType.STOCKFISH)
        heuristic_engine = ChessAnalysisEngine(config=heuristic_config)
        
        starting_position = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        heuristic_result = await heuristic_engine.analyze_position(starting_position)
        print(f"Heuristic fallback analysis result: {heuristic_result}")
        
        # Test Stockfish analysis (if available)
        if heuristic_engine.stockfish_path:
            print("\n=== Testing Stockfish Analysis ===")
            stockfish_config = AnalysisConfig(analysis_type=AnalysisType.STOCKFISH, depth=10)
            stockfish_engine = ChessAnalysisEngine(config=stockfish_config, stockfish_path=heuristic_engine.stockfish_path)
            
            stockfish_result = await stockfish_engine.analyze_position(starting_position)
            print(f"Stockfish analysis result: {stockfish_result}")
        else:
            print("Stockfish not available, skipping Stockfish tests")
        
        print("\nðŸŽ‰ Analysis engine testing complete!")
    
    asyncio.run(test_analysis_engine())













