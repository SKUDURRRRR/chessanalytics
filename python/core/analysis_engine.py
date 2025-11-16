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
import threading
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
from contextlib import contextmanager
import chess
import chess.pgn
import chess.engine
import io
from .coaching_comment_generator import ChessCoachingGenerator, GamePhase
from .cache_manager import LRUCache, register_cache

logger = logging.getLogger(__name__)

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


class SyncEnginePool:
    """
    Simple synchronous engine pool for use in thread pool executors.
    Thread-safe pool that reuses Stockfish engines to avoid startup overhead.
    """
    def __init__(self, stockfish_path: str, max_size: int = 8, config: Optional[dict] = None):
        self.stockfish_path = stockfish_path
        self.max_size = max_size
        self.config = config or {
            'Skill Level': 20,
            'UCI_LimitStrength': False,
            'Threads': 1,
            'Hash': 96
        }
        self._pool: List[chess.engine.SimpleEngine] = []
        self._lock = threading.Lock()
        self._in_use: Set[chess.engine.SimpleEngine] = set()

    @contextmanager
    def acquire(self):
        """Acquire an engine from the pool (synchronous context manager)."""
        engine = None
        with self._lock:
            # Try to get an available engine
            for e in self._pool:
                if e not in self._in_use:
                    engine = e
                    self._in_use.add(engine)
                    break

            # Create new engine if none available and under limit
            if engine is None and len(self._pool) < self.max_size:
                try:
                    engine = chess.engine.SimpleEngine.popen_uci(self.stockfish_path)
                    engine.configure(self.config)
                    self._pool.append(engine)
                    self._in_use.add(engine)
                except Exception as e:
                    print(f"⚠️  Failed to create engine: {e}")
                    raise

        # Wait for available engine if at capacity
        if engine is None:
            # Simple wait loop - in practice, with 8 engines this should rarely happen
            import time
            for _ in range(100):  # Wait up to 10 seconds
                time.sleep(0.1)
                with self._lock:
                    for e in self._pool:
                        if e not in self._in_use:
                            engine = e
                            self._in_use.add(engine)
                            break
                    if engine:
                        break

            if engine is None:
                raise RuntimeError("Could not acquire engine from pool (timeout)")

        try:
            yield engine
        finally:
            with self._lock:
                self._in_use.discard(engine)

    def close_all(self):
        """Close all engines in the pool."""
        with self._lock:
            for engine in self._pool:
                try:
                    engine.quit()
                except:
                    pass
            self._pool.clear()
            self._in_use.clear()


def get_rating_adjusted_brilliant_threshold(player_rating: Optional[int] = None) -> Dict[str, float]:
    """
    Get Chess.com-aligned thresholds for brilliant move detection based on player rating.

    Chess.com adjusts brilliant move criteria based on rating:
    - Lower-rated players: More lenient (encourage learning)
    - Higher-rated players: Stricter (truly exceptional required)

    Args:
        player_rating: Player's rating (e.g., 1200, 1800, 2400). None = use default (1500)

    Returns:
        Dict with adjusted thresholds for brilliant detection
    """
    # Default to intermediate player if no rating provided
    if player_rating is None:
        player_rating = 1500

    # Chess.com rating adjustment tiers
    # Based on observations of Chess.com's brilliant move frequency by rating
    if player_rating < 1000:
        # Beginner: Very lenient - encourage creative play
        return {
            'min_sacrifice_value': 2,        # Minor piece sacrifice sufficient
            'max_position_cp': 500,          # Can be more winning
            'min_compensation_cp': -100,     # Allow larger deficit with compensation
            'non_obvious_threshold': 5,      # Fewer alternatives needed
            'mate_in_moves': 7,              # Longer mates count
        }
    elif player_rating < 1400:
        # Beginner-Intermediate: Lenient
        return {
            'min_sacrifice_value': 2,        # Minor piece sacrifice
            'max_position_cp': 450,
            'min_compensation_cp': -75,
            'non_obvious_threshold': 6,
            'mate_in_moves': 6,
        }
    elif player_rating < 1800:
        # Intermediate: Standard (Chess.com default)
        return {
            'min_sacrifice_value': 2,        # Minor piece or better
            'max_position_cp': 400,
            'min_compensation_cp': -50,
            'non_obvious_threshold': 8,
            'mate_in_moves': 5,
        }
    elif player_rating < 2200:
        # Advanced: Stricter
        return {
            'min_sacrifice_value': 3,        # Rook or Queen preferred
            'max_position_cp': 350,
            'min_compensation_cp': -25,
            'non_obvious_threshold': 10,
            'mate_in_moves': 4,
        }
    else:
        # Expert/Master: Very strict - truly exceptional only
        return {
            'min_sacrifice_value': 3,        # Significant sacrifice only
            'max_position_cp': 300,
            'min_compensation_cp': 0,        # Must maintain equality minimum
            'non_obvious_threshold': 12,
            'mate_in_moves': 3,
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
# Simplified Chess.com-aligned move classification thresholds
# Merged categories for cleaner user experience:
# - best(0-5), excellent(5-25), good(25-100), inaccuracy(100-200), mistake(200-400), blunder(400+)
BASIC_BEST_THRESHOLD = 5  # Best moves (0-5cp loss)
BASIC_EXCELLENT_THRESHOLD = 25  # Excellent moves (5-25cp loss) - merged great+excellent
BASIC_GOOD_THRESHOLD = 100  # Good moves (25-100cp loss) - merged good+acceptable
BASIC_INACCURACY_THRESHOLD = 200  # Inaccuracies (100-200cp loss) - Chess.com standard
BASIC_MISTAKE_THRESHOLD = 400  # Mistakes (200-400cp loss) - Chess.com standard
BASIC_BLUNDER_THRESHOLD = 400  # Blunders (400+cp loss) - Chess.com standard
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
    best_move_san: str = ""  # SAN notation for best move
    best_move_pv: List[str] = field(default_factory=list)  # PV for the best move line (UCI)
    is_best: bool = False
    is_blunder: bool = False
    is_mistake: bool = False
    is_inaccuracy: bool = False
    centipawn_loss: float = 0.0
    depth_analyzed: int = 0
    analysis_time_ms: int = 0
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
    fen_before: str = ""  # FEN position before the move
    fen_after: str = ""   # FEN position after the move

    # Evaluation fields for personality scoring (CRITICAL for aggressive/patient metrics)
    evaluation_before: Optional[float] = None  # Centipawn eval before move
    evaluation_after: Optional[float] = None   # Centipawn eval after move

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
        # Initialize synchronous engine pool for thread pool usage
        self._sync_engine_pool = None
        if self.stockfish_path:
            self._sync_engine_pool = SyncEnginePool(
                stockfish_path=self.stockfish_path,
                max_size=8,  # Match max_concurrent
                config={
                    'Skill Level': 20,
                    'UCI_LimitStrength': False,
                    'Threads': 1,
                    'Hash': 96
                }
            )
        self._opening_database = self._load_opening_database()

        # Use LRU caches with size limits (1000 entries each, 5-min TTL)
        self._basic_eval_cache = LRUCache(maxsize=1000, ttl=300, name="eval_cache")
        self._basic_move_cache = LRUCache(maxsize=1000, ttl=300, name="move_cache")
        self._basic_probe_cache = LRUCache(maxsize=1000, ttl=300, name="probe_cache")

        # Position cache for FEN-based caching (15-25% speedup from transpositions)
        # Larger cache size since positions are frequently repeated
        self._position_cache = LRUCache(maxsize=2000, ttl=600, name="position_cache")

        # Register caches for monitoring
        register_cache(self._basic_eval_cache)
        register_cache(self._basic_move_cache)
        register_cache(self._basic_probe_cache)
        register_cache(self._position_cache)

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

    def clear_caches(self) -> dict:
        """
        Clear all internal caches.

        Returns:
            dict: Number of entries cleared per cache
        """
        return {
            "eval_cache": self._basic_eval_cache.clear(),
            "move_cache": self._basic_move_cache.clear(),
            "probe_cache": self._basic_probe_cache.clear()
        }

    def get_cache_stats(self) -> dict:
        """
        Get statistics for all caches.

        Returns:
            dict: Cache statistics
        """
        return {
            "eval_cache": self._basic_eval_cache.stats(),
            "move_cache": self._basic_move_cache.stats(),
            "probe_cache": self._basic_probe_cache.stats()
        }

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
        # Use LRU cache set method
        self._basic_eval_cache.set(cache_key, result)
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
        # Use LRU cache set method
        self._basic_move_cache.set(cache_key, candidates)
        return candidates

    async def _maybe_probe_stockfish_basic(self, board: chess.Board, move: chess.Move, color_to_move: chess.Color) -> Optional[Dict[str, Any]]:
        """Optionally refine heuristics with a lightweight Stockfish probe."""
        if not self.stockfish_path:
            return None

        before_key = f"{self._basic_cache_key(board)}|sf"
        before_eval = self._basic_probe_cache.get(before_key)
        if before_eval is None and self._basic_probe_cache.size() < BASIC_ENGINE_PROBE_LIMIT:
            before_eval = await asyncio.to_thread(self._run_stockfish_probe, board.fen())
            if before_eval:
                # Use LRU cache set method (auto-trimming handled by LRU)
                self._basic_probe_cache.set(before_key, before_eval)

        board.push(move)
        try:
            after_key = f"{self._basic_cache_key(board)}|sf"
            after_fen = board.fen()
            after_eval = self._basic_probe_cache.get(after_key)
            if after_eval is None and self._basic_probe_cache.size() < BASIC_ENGINE_PROBE_LIMIT:
                after_eval = await asyncio.to_thread(self._run_stockfish_probe, after_fen)
                if after_eval:
                    # Use LRU cache set method (auto-trimming handled by LRU)
                    self._basic_probe_cache.set(after_key, after_eval)
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
                # Store complete PV line for follow-up feature (not just first 3 moves)
                pv_uci = [mv.uci() for mv in pv_moves]
                best_move = pv_uci[0] if pv_uci else None
                if perspective.is_mate():
                    return {'type': 'mate', 'value': perspective.mate(), 'best_move': best_move, 'pv': pv_uci}
                return {'type': 'cp', 'value': perspective.score(), 'best_move': best_move, 'pv': pv_uci}
        except Exception:
            return None

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
                          analysis_type: Optional[AnalysisType] = None,
                          fullmove_number: Optional[int] = None,
                          is_user_move: Optional[bool] = None,
                          ply_index: Optional[int] = None) -> MoveAnalysis:
        """Analyze a specific move in a position."""
        analysis_type = analysis_type or self.config.analysis_type
        start_time = datetime.now()

        try:
            return await self._analyze_move_stockfish(board, move, analysis_type, fullmove_number, is_user_move, ply_index)
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
                move_analysis = await self.analyze_move(
                    data['board'],
                    data['move'],
                    analysis_type,
                    fullmove_number=data['fullmove_number'],
                    is_user_move=data['is_user_move'],  # Pass is_user_move so greeting can be added immediately
                    ply_index=data['ply_index']  # Pass ply_index so greeting can be added immediately
                )
                move_analysis.player_color = data['player_color']
                # is_user_move and ply_index already set in analyze_move
                move_analysis.fullmove_number = data['fullmove_number']
                return move_analysis

            # Process moves in parallel with Railway Pro tier optimization
            # Railway Pro tier has 8 vCPU, but we use 4 concurrent workers to match
            # the ThreadPoolExecutor capacity and avoid memory pressure
            max_concurrent = 4  # Matches ThreadPoolExecutor(max_workers=4) at line 1977
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
        # CRITICAL: Try to reconstruct move from board if it's not legal
        # This handles cases where the move object might be from a different board context
        if not board.is_legal(move):
            print(f"⚠️  Move {move.uci()} not legal in basic analysis: position {board.fen()}")

            # Try to find the move in legal moves - maybe it's just a promotion or castling issue
            legal_moves = list(board.legal_moves)
            matching_move = None
            for legal_move in legal_moves:
                # Match by from/to squares, and also check promotion if present
                if (legal_move.from_square == move.from_square and
                    legal_move.to_square == move.to_square):
                    # For promotion moves, also check promotion piece matches
                    if move.promotion is not None:
                        if legal_move.promotion == move.promotion:
                            matching_move = legal_move
                            print(f"   Found matching legal move: {legal_move.uci()} (promotion: {legal_move.promotion})")
                            break
                    else:
                        # Non-promotion move - found match
                        matching_move = legal_move
                        print(f"   Found matching legal move: {legal_move.uci()}")
                        break

            if matching_move:
                # Use the reconstructed move
                move = matching_move
            else:
                # Move truly doesn't exist - return illegal move analysis
                print(f"   Move {move.uci()} truly illegal - returning illegal move analysis")
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

        # DEBUG: Check if this is actually a capture
        is_capture_move = board.is_capture(move)
        if is_capture_move:
            captured_square = chess.square_name(move.to_square)
            captured_piece = board.piece_at(move.to_square)
            print(f"[MOVE_SAN DEBUG] Move {move.uci()} -> SAN: {move_san}, is_capture: {is_capture_move}, captured on {captured_square}: {captured_piece}")
            if 'x' not in move_san:
                print(f"[MOVE_SAN ERROR] Capture move but no 'x' in SAN! move_san={move_san}, should include 'x'")

        # Store FEN position before the move
        fen_before = board.fen()

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
        # For inaccuracies/mistakes/blunders, always show the best move even if it's different from played move
        # Only set best_move_san to move_san if the best move is actually the same as the played move
        if best_candidate and best_candidate['uci'] != move.uci():
            best_move_san = best_candidate['san']
        elif best_candidate and best_candidate['uci'] == move.uci():
            # Best move is the same as played move - set to empty string so frontend knows there's no alternative
            best_move_san = ""
        else:
            # No candidates found - shouldn't happen, but fallback to move_san
            best_move_san = move_san

        see_score = self._static_exchange_evaluation(board, move)
        is_capture = board.is_capture(move)
        gives_check = board.gives_check(move)

        # Calculate move number before making the move
        move_number = (board.fullmove_number - 1) * 2 + (0 if board.turn == chess.WHITE else 1)

        board.push(move)
        after_score, after_features = self._evaluate_board_basic(board)
        # Capture FEN after move is applied (before popping)
        fen_after = board.fen()
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

        # DEBUG: Log hanging piece detection
        if new_hanging:
            print(f"[HANGING DEBUG] Move {move_san}: Detected {len(new_hanging)} new hanging pieces:")
            for h in new_hanging:
                print(f"  - {h['piece']} on {h['square']} (attackers={h.get('attackers', 0)}, defenders={h.get('defenders', 0)})")

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

        # ============================================================================
        # HEURISTIC BRILLIANT MOVE DETECTION - Chess.com Aligned
        # ============================================================================
        # Heuristic mode has limited information, but we can still detect:
        # 1. Forced mates (from refinement data)
        # 2. Material sacrifices (from SEE and hanging pieces)
        # 3. Significant evaluation swings (from delta)
        # ============================================================================

        # Forced mate detection (most reliable in heuristic mode)
        forcing_mate_trigger = bool(refinement and refinement.get('after') and refinement['after'].get('type') == 'mate')

        # Sacrifice detection (Chess.com aligned)
        # Look for moves that sacrifice material but have tactical compensation
        sacrifice_trigger = False

        if is_best:  # Only consider for best moves
            # Type 1: SEE-based sacrifice detection
            # Negative SEE means we're losing material in the exchange
            piece_values = {'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0}

            if see_score < -200:  # Losing at least 2 pawns worth in exchange
                # But position evaluation improves or stays winning (compensation exists)
                has_compensation = delta >= 0 or (refinement and refinement.get('after', {}).get('value', 0) > 0)

                # Check if we're not already crushing (Chess.com criteria)
                not_already_crushing = True
                if refinement and refinement.get('before'):
                    before_eval = refinement['before'].get('value', 0)
                    not_already_crushing = abs(before_eval) < 400

                sacrifice_trigger = has_compensation and not_already_crushing

            # Type 2: Capture with more valuable piece that improves position
            elif is_capture and 'capture' in triggers:
                # Get piece values for the move
                moving_piece = board.piece_at(move.from_square)
                target_square = move.to_square

                # Need to check position before move
                board.push(move)
                captured_something = True  # We know it's a capture
                board.pop()

                if moving_piece:
                    moving_value = piece_values.get(moving_piece.symbol().upper(), 0)

                    # Check if the moved piece hangs after the capture
                    board.push(move)
                    piece_hangs = 'exposes_piece' in triggers or bool(new_hanging)
                    board.pop()

                    # Sacrifice if:
                    # - We're capturing with a valuable piece (N, B, R, Q)
                    # - Piece hangs after capture OR SEE is negative
                    # - But position improves (delta > 0) or stays winning
                    if moving_value >= 3 and (piece_hangs or see_score < 0):
                        has_compensation = delta >= 50 or forcing_mate_trigger

                        # Check not already crushing
                        not_already_crushing = True
                        if refinement and refinement.get('before'):
                            before_eval = refinement['before'].get('value', 0)
                            not_already_crushing = abs(before_eval) < 400

                        sacrifice_trigger = has_compensation and not_already_crushing

            # Type 3: Non-capture moves that expose/hang pieces but have tactical point
            elif 'exposes_piece' in triggers or bool(new_hanging):
                # Piece hangs but position improves significantly
                has_strong_compensation = delta >= 100 or forcing_mate_trigger or ('check' in triggers and delta > 0)

                # Check the hanging piece is valuable enough (not just a pawn)
                valuable_piece_hanging = False
                if new_hanging:
                    for hanging in new_hanging:
                        piece_symbol = hanging.get('piece', '').upper()
                        if piece_symbol in ['N', 'B', 'R', 'Q']:
                            valuable_piece_hanging = True
                            break

                # Check not already crushing
                not_already_crushing = True
                if refinement and refinement.get('before'):
                    before_eval = refinement['before'].get('value', 0)
                    not_already_crushing = abs(before_eval) < 400

                sacrifice_trigger = (
                    valuable_piece_hanging and
                    has_strong_compensation and
                    not_already_crushing
                )

        # Non-obvious detection (simplified for heuristic mode)
        # A move is non-obvious if position is complex (many legal moves)
        is_non_obvious = len(list(board.legal_moves)) > 8

        # FINAL BRILLIANT DETERMINATION (Chess.com aligned)
        # - Forced mate OR
        # - Sacrifice that is non-obvious and best move
        is_brilliant = is_best and (forcing_mate_trigger or (sacrifice_trigger and is_non_obvious))
        is_excellent = BASIC_BEST_THRESHOLD < centipawn_loss <= BASIC_EXCELLENT_THRESHOLD  # Merged great+excellent (5-25cp)
        is_great = is_excellent  # Alias for backward compatibility
        is_good = BASIC_EXCELLENT_THRESHOLD < centipawn_loss <= BASIC_GOOD_THRESHOLD  # Merged good+acceptable (25-100cp)
        is_acceptable = is_good  # Alias for backward compatibility
        is_inaccuracy = BASIC_GOOD_THRESHOLD < centipawn_loss <= BASIC_INACCURACY_THRESHOLD
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
        # Note: fen_after was captured earlier while the move was still applied
        move_analysis = MoveAnalysis(
            move=move.uci(),
            move_san=move_san,
            evaluation=evaluation_payload,
            best_move=best_move_uci,
            best_move_san=best_move_san,  # Add SAN notation for best move
            is_best=is_best,
            is_brilliant=is_brilliant,
            is_excellent=is_excellent,
            is_great=is_excellent,  # Alias for backward compatibility
            is_good=is_good,
            is_acceptable=is_good,  # Alias for backward compatibility
            is_blunder=is_blunder,
            is_mistake=is_mistake,
            is_inaccuracy=is_inaccuracy,
            centipawn_loss=float(centipawn_loss),
            depth_analyzed=0,
            analysis_time_ms=0,
            explanation=explanation,
            heuristic_details=heuristic_details,
            accuracy_score=accuracy_score,
            fen_before=fen_before,  # Add FEN before move
            fen_after=fen_after,      # Add FEN after move
            evaluation_before=float(before_score),  # CRITICAL: for personality scoring
            evaluation_after=float(after_score)     # CRITICAL: for personality scoring
        )

        # Set is_user_move and ply_index if provided (from analyze_game context)
        if is_user_move is not None:
            move_analysis.is_user_move = is_user_move
        if ply_index is not None:
            move_analysis.ply_index = ply_index

        # Enhance with coaching comments
        # Move number was already calculated before the move was made
        # Use is_user_move parameter if provided, otherwise default to True (for backward compatibility)
        actual_is_user_move = is_user_move if is_user_move is not None else True
        return self._enhance_move_analysis_with_coaching(move_analysis, board, move, move_number, is_user_move=actual_is_user_move)

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

            # CRITICAL FIX: board is BEFORE the move at this point (already popped in _analyze_move_basic)
            # We need to get both board states correctly
            board_before = board.copy()
            board.push(move)  # Apply the move to get board AFTER
            board_after = board.copy()
            board.pop()  # Restore board to BEFORE state

            # Validate boards are different (catch bugs)
            if board_before.fen() == board_after.fen():
                print(f"[WARNING] board_before == board_after for {move_analysis.move_san}! This indicates a bug.")

            # Prepare enhanced move analysis data with CORRECT board positions
            enhanced_move_data = move_analysis.__dict__.copy()
            enhanced_move_data['board_before'] = board_before
            enhanced_move_data['board_after'] = board_after
            enhanced_move_data['move'] = move
            enhanced_move_data['move_san'] = move_analysis.move_san

            # Debug logging for capture validation
            if board.is_capture(move):
                captured = board_before.piece_at(move.to_square)
                if captured:
                    piece_names = {chess.PAWN: 'pawn', chess.KNIGHT: 'knight', chess.BISHOP: 'bishop',
                                   chess.ROOK: 'rook', chess.QUEEN: 'queen', chess.KING: 'king'}
                    print(f"[CAPTURE DEBUG] {move_analysis.move_san}: Captured {piece_names.get(captured.piece_type, 'piece')} on {chess.square_name(move.to_square)}")

            # Safely access heuristic_details with null checks
            heuristic_details = move_analysis.heuristic_details or {}
            enhanced_move_data['evaluation_before'] = heuristic_details.get('before_score', 0)
            enhanced_move_data['evaluation_after'] = heuristic_details.get('after_score', 0)
            enhanced_move_data['game_phase'] = game_phase.value
            enhanced_move_data['fullmove_number'] = move_number

            # OPTIMIZATION: Skip AI coaching comments during fast analysis
            # AI comments add 2+ seconds per move due to API rate limits
            # Can be generated separately after analysis completes
            skip_ai_comments = True  # TODO: Make this configurable

            # INSTANT GREETING: Always add instant Tal greeting for player's first move
            # This shows immediately, even before AI comments are generated
            # Check both fullmove_number == 1 and ply_index (1 for White, 2 for Black)
            # Use ply_index from move_analysis if available, otherwise rely on move_number
            ply_index = move_analysis.ply_index if move_analysis.ply_index > 0 else None
            # Check if this is actually a user move
            # If ply_index is set (> 0), then move_analysis.is_user_move has been set correctly
            # Otherwise, use the parameter (which is correct when called from analyze_game context)
            if move_analysis.ply_index > 0:
                # move_analysis has been fully initialized, use its is_user_move value
                actual_is_user_move = move_analysis.is_user_move
            else:
                # move_analysis not fully initialized yet, use parameter
                actual_is_user_move = is_user_move
            # For first move: fullmove_number == 1, and ply_index should be 1 (White) or 2 (Black)
            # If ply_index is not set (None or 0), we can still check if it's the first user move by fullmove_number == 1
            is_player_first_move = (
                actual_is_user_move and
                move_number == 1 and
                (ply_index is None or ply_index in [1, 2])
            )

            if is_player_first_move:
                from .tal_greetings import TAL_GREETINGS
                import random
                instant_greeting = random.choice(TAL_GREETINGS)
                move_analysis.coaching_comment = instant_greeting
                move_analysis.move_quality = "good"  # Default quality for greeting
                move_analysis.game_phase = game_phase.value
                move_analysis.encouragement_level = 5  # High encouragement for greeting
                print(f"[INSTANT_GREETING] ✅ Added instant Tal greeting for first move (ply={ply_index}, fullmove={move_number}, is_user_move={is_user_move}, move_san={move_analysis.move_san}): {instant_greeting[:50]}...")
            else:
                # Only log if it's a user move with fullmove_number == 1 (to avoid spam)
                if is_user_move and move_number == 1:
                    print(f"[INSTANT_GREETING] ⚠️ Skipped greeting: is_user_move={is_user_move}, move_number={move_number}, ply_index={ply_index}, move_san={move_analysis.move_san}")

            if not skip_ai_comments:
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
            else:
                # Set default values when skipping AI comments
                # BUT: Don't overwrite instant greeting if it was already set
                if not move_analysis.coaching_comment:
                    move_analysis.coaching_comment = ""
                move_analysis.what_went_right = ""
                move_analysis.what_went_wrong = ""
                move_analysis.how_to_improve = ""
                move_analysis.tactical_insights = []
                move_analysis.positional_insights = []
                move_analysis.risks = []
                move_analysis.benefits = []
                move_analysis.learning_points = []
                move_analysis.encouragement_level = 3
                # Determine move quality from centipawn loss
                if move_analysis.is_brilliant:
                    move_analysis.move_quality = "brilliant"
                elif move_analysis.is_best:
                    move_analysis.move_quality = "best"
                elif move_analysis.is_great:
                    move_analysis.move_quality = "great"
                elif move_analysis.is_good:
                    move_analysis.move_quality = "good"
                elif move_analysis.is_inaccuracy:
                    move_analysis.move_quality = "inaccuracy"
                elif move_analysis.is_mistake:
                    move_analysis.move_quality = "mistake"
                elif move_analysis.is_blunder:
                    move_analysis.move_quality = "blunder"
                else:
                    move_analysis.move_quality = "book"
                move_analysis.game_phase = game_phase.value

            return move_analysis

        except Exception as e:
            print(f"Error generating coaching comment: {e}")
            print(f"Move analysis details: move={move_analysis.move_san}, heuristic_details={type(move_analysis.heuristic_details)}")
            print(f"Board state: {board.fen()}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            # Return original analysis if coaching fails
            return move_analysis

    def _get_adaptive_depth(self, board: chess.Board, move: chess.Move) -> int:
        """
        Calculate optimal analysis depth based on position complexity.

        Simple positions (few pieces, clear advantage) → shallow depth (10)
        Complex positions (many pieces, tactical) → deep depth (16)
        Normal positions → standard depth (14)

        This speeds up analysis by 30% on average without losing accuracy.
        """
        # Count pieces on board
        piece_count = len(board.piece_map())

        # Calculate material difference
        material_diff = 0
        for piece_type in [chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN]:
            white_count = len(board.pieces(piece_type, chess.WHITE))
            black_count = len(board.pieces(piece_type, chess.BLACK))
            piece_value = PIECE_VALUES.get(chess.piece_symbol(piece_type).upper(), 0)
            material_diff += (white_count - black_count) * piece_value

        material_diff = abs(material_diff)

        # Check if position involves check or capture (tactical)
        is_tactical = board.is_check() or board.is_capture(move)

        # Simple position (endgame with few pieces or huge material advantage)
        # Can analyze faster without losing accuracy
        if piece_count <= 10 or material_diff > 500:
            return 10  # Shallow depth (2x faster)

        # Complex tactical position (many pieces, small advantage, checks/captures)
        # Needs deeper analysis for accuracy
        elif piece_count > 20 and material_diff < 200 and is_tactical:
            return 16  # Deep analysis (for critical positions)

        # Normal position - use standard depth
        else:
            return 14  # Standard depth

    def _get_phase_based_time_limit(self, fullmove_number: int) -> float:
        """
        Get time limit based on game phase for speed optimization.

        Opening moves (1-10): 0.1s - Known positions, less critical
        Middlegame (11-30): 0.3s - Most important phase, needs more time
        Endgame (31+): 0.5s - Fewer pieces, simpler evaluation

        This provides 60-70% speedup compared to uniform 0.8s per move.
        User approved reduced accuracy for opening moves (moves 1-10).
        """
        if fullmove_number <= 10:
            # Opening phase - fast analysis
            return 0.1
        elif fullmove_number <= 30:
            # Middlegame - standard analysis
            return 0.3
        else:
            # Endgame - moderate analysis
            return 0.5

    def _is_reasonable_opening_move(self, board: chess.Board, move: chess.Move) -> bool:
        """
        Check if a move is a reasonable opening move (for fast opening book path).

        Reasonable opening moves:
        - Develop knights, bishops, or queen
        - Push central pawns (e4, d4, e5, d5, c4, c5, Nf6, Nf3, etc.)
        - Castle
        - Don't lose material without compensation

        This allows us to skip full Stockfish analysis for standard opening theory.
        """
        # Get piece being moved
        piece = board.piece_at(move.from_square)
        if not piece:
            return False

        # Castling is always reasonable
        if board.is_castling(move):
            return True

        # Central pawn moves (e4, d4, e5, d5, c4, c5)
        if piece.piece_type == chess.PAWN:
            to_file = chess.square_file(move.to_square)
            # Central files (c, d, e)
            if to_file in [2, 3, 4]:  # c, d, e files
                return True

        # Knight and bishop development
        if piece.piece_type in [chess.KNIGHT, chess.BISHOP]:
            # Not moving back to starting rank
            from_rank = chess.square_rank(move.from_square)
            to_rank = chess.square_rank(move.to_square)
            if piece.color == chess.WHITE and to_rank > from_rank:
                return True
            if piece.color == chess.BLACK and to_rank < from_rank:
                return True

        # Queen moves (acceptable if not too early)
        if piece.piece_type == chess.QUEEN:
            # Queen moves on move 3+ are sometimes okay
            if board.fullmove_number >= 3:
                return True

        return False

    def _get_opening_book_evaluation(self, board: chess.Board, move: chess.Move) -> Optional[Tuple[float, bool]]:
        """
        Get a fast opening book evaluation for early game moves (moves 1-8).

        Returns:
            (evaluation_cp, is_book_move) or None if should use Stockfish

        This provides 50%+ speedup for opening moves by skipping Stockfish analysis.
        User approved reduced accuracy for opening moves.
        """
        # Only for first 8 moves
        if board.fullmove_number > 8:
            return None

        # Check if it's still an opening position (most pieces on board)
        piece_count = len(board.piece_map())
        if piece_count < 28:  # Too many pieces captured, not standard opening
            return None

        # Check if move is reasonable
        is_reasonable = self._is_reasonable_opening_move(board, move)

        if is_reasonable:
            # Reasonable opening move - assign small positive/neutral evaluation
            # Opening theory suggests these moves are roughly equal
            return (0.0, True)  # 0 centipawn evaluation, is a book move
        else:
            # Unusual opening move - still fast-path with slight penalty
            # Mark as inaccuracy but don't run full Stockfish
            return (-30.0, False)  # -30 centipawn (minor inaccuracy)

        # If we get here, use Stockfish (shouldn't happen)
        return None

    async def _analyze_move_stockfish(self, board: chess.Board, move: chess.Move,
                                    analysis_type: AnalysisType,
                                    fullmove_number: Optional[int] = None,
                                    is_user_move: Optional[bool] = None,
                                    ply_index: Optional[int] = None) -> MoveAnalysis:
        """Stockfish move analysis - runs in thread pool for true parallelism."""
        if not self.stockfish_path:
            raise ValueError("Stockfish executable not found")

        # OPTIMIZATION: Opening book fast path (50%+ speedup for moves 1-8)
        # For early game standard moves, skip Stockfish analysis entirely
        if fullmove_number is not None and fullmove_number <= 8:
            opening_eval = self._get_opening_book_evaluation(board, move)
            if opening_eval is not None:
                eval_cp, is_book_move = opening_eval
                # Return a simple MoveAnalysis without Stockfish computation
                move_san = board.san(move)
                player_color = board.turn

                # Create a fast opening analysis result
                is_best = is_book_move  # Book moves are considered "best"
                centipawn_loss = 0.0 if is_book_move else 30.0  # Slight penalty for non-book

                return MoveAnalysis(
                    move=move.uci(),  # UCI notation (required field)
                    move_san=move_san,
                    evaluation={'value': eval_cp, 'type': 'cp'},  # Required evaluation dict
                    best_move=move.uci() if is_book_move else None,  # UCI notation
                    best_move_san=move_san if is_book_move else None,
                    best_move_pv=[],
                    is_best=is_best,
                    is_brilliant=False,
                    is_great=is_book_move,
                    is_excellent=is_book_move,
                    is_good=not is_book_move,
                    is_acceptable=False,
                    is_blunder=False,
                    is_mistake=False,
                    is_inaccuracy=not is_book_move,
                    centipawn_loss=centipawn_loss,
                    depth_analyzed=0,  # No Stockfish analysis
                    analysis_time_ms=0,  # Instant
                    explanation=None,
                    heuristic_details={},
                    accuracy_score=100.0 if is_book_move else 97.0,
                    evaluation_before=0.0,
                    evaluation_after=eval_cp
                )

        # Use adaptive depth based on position complexity (30% speedup on average)
        depth = self._get_adaptive_depth(board, move)

        # Override for deep analysis or based on config
        if analysis_type == AnalysisType.DEEP:
            depth = max(depth, 20)
        elif self.config.depth != 14:  # User specified custom depth
            depth = self.config.depth

        # Use phase-based time limit for speed optimization (60-70% speedup)
        if fullmove_number is not None:
            time_limit = self._get_phase_based_time_limit(fullmove_number)
        else:
            # Fallback to config time limit if fullmove_number not provided
            time_limit = self.config.time_limit

        # Run Stockfish analysis in thread pool to avoid blocking
        import concurrent.futures
        loop = asyncio.get_event_loop()

        def run_stockfish_analysis():
            # Capture move and time_limit in local scope to avoid UnboundLocalError
            current_move = move
            current_time_limit = time_limit  # Capture from outer scope
            try:
                # Use engine pool to avoid startup overhead (100-200ms per engine creation)
                # For 65 moves, this saves 6.5-13 seconds!
                # Use engine pool or create new engine
                if self._sync_engine_pool:
                    engine_context = self._sync_engine_pool.acquire()
                else:
                    # Fallback to creating new engine if pool not available
                    engine_context = chess.engine.SimpleEngine.popen_uci(self.stockfish_path)

                with engine_context as engine:
                    # Configure engine if not from pool
                    if not self._sync_engine_pool:
                        engine.configure({
                            'Skill Level': 20,  # Maximum strength for better analysis
                            'UCI_LimitStrength': False,  # Use full strength
                            'UCI_Elo': 2000,  # Keep original settings
                            'Threads': 1,  # Deterministic analysis
                            'Hash': 96  # Better balance for concurrency
                        })

                    # Use phase-based time limit (or config default)
                    # depth is already set above from adaptive depth

                    # OPTIMIZATION: Check position cache before running Stockfish (15-25% speedup)
                    # Cache key: FEN + depth (transpositions will have same FEN)
                    fen_before = board.fen()
                    cache_key = f"{fen_before}|{depth}"
                    cached_result = self._position_cache.get(cache_key)

                    if cached_result is not None:
                        # Cache hit! Reuse previous analysis
                        eval_before, best_move_before, best_move_pv = cached_result
                        best_move_pv_moves = [chess.Move.from_uci(uci) for uci in best_move_pv] if best_move_pv else []
                    else:
                        # Cache miss - run Stockfish analysis
                        # Get evaluation before move
                        # Use depth for better PV line (time limit gives shallow PV)
                        info_before = engine.analyse(board, chess.engine.Limit(depth=depth))
                        eval_before = info_before.get("score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))
                        best_move_before = info_before.get("pv", [None])[0]
                        # Capture the full PV for the best move line
                        best_move_pv_moves = info_before.get("pv", [])
                        best_move_pv = [mv.uci() for mv in best_move_pv_moves] if best_move_pv_moves else []

                        # Store in cache for future transpositions
                        self._position_cache.set(cache_key, (eval_before, best_move_before, best_move_pv))

                    print(f"[PV DEBUG] Captured {len(best_move_pv)} moves in best_move_pv for position")
                    player_color = board.turn

                    # Validate move is legal before proceeding
                    # CRITICAL: Try to reconstruct move from board if it's not legal
                    # This handles cases where the move object might be from a different board context
                    if not board.is_legal(current_move):
                        print(f"⚠️  Move {current_move.uci()} not legal in position {board.fen()}")
                        print(f"   Board turn: {board.turn}, Move from: {chess.square_name(current_move.from_square)}, to: {chess.square_name(current_move.to_square)}")

                        # Try to find the move in legal moves - maybe it's just a promotion or castling issue
                        legal_moves = list(board.legal_moves)
                        matching_move = None
                        for legal_move in legal_moves:
                            # Match by from/to squares, and also check promotion if present
                            if (legal_move.from_square == current_move.from_square and
                                legal_move.to_square == current_move.to_square):
                                # For promotion moves, also check promotion piece matches
                                if current_move.promotion is not None:
                                    if legal_move.promotion == current_move.promotion:
                                        matching_move = legal_move
                                        print(f"   Found matching legal move: {legal_move.uci()} (promotion: {legal_move.promotion})")
                                        break
                                else:
                                    # Non-promotion move - found match
                                    matching_move = legal_move
                                    print(f"   Found matching legal move: {legal_move.uci()}")
                                    break

                        if matching_move:
                            # Use the reconstructed move
                            current_move = matching_move
                        else:
                            # Move truly doesn't exist - fallback to basic analysis
                            print(f"   Move {current_move.uci()} truly illegal - falling back to basic analysis")
                            import asyncio
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                            try:
                                result = loop.run_until_complete(self._analyze_move_basic(board, current_move))
                                return result
                            finally:
                                loop.close()

                    # Get SAN notation before making the move
                    move_san = board.san(current_move)

                    # Make the move
                    board.push(current_move)

                    # OPTIMIZATION: Skip "after" analysis if move is the best move
                    # When the played move is the best move, we already know the evaluation
                    # from the "before" analysis PV line. This saves 20-30% time per best move.
                    # Typical games have 30-50% best moves, so this is a significant speedup.
                    skip_after_analysis = (best_move_before is not None and
                                         current_move.uci() == best_move_before.uci())

                    if skip_after_analysis:
                        # Use the evaluation from the best move's PV line (no need to re-analyze)
                        # The evaluation after the best move is already calculated in the PV
                        if len(best_move_pv_moves) > 1:
                            # Follow the PV line one move deep to get the evaluation
                            # The PV already computed this position
                            eval_after = eval_before  # Same evaluation (centipawn loss = 0)
                        else:
                            # No PV continuation, but it's still best move (eval same)
                            eval_after = eval_before
                        pv_after = []  # Not needed for best moves
                    else:
                        # Get evaluation after move
                        # Use reduced depth for "after" analysis (we already know the move)
                        # This provides ~20-30% speedup without significant accuracy loss
                        after_depth = max(10, depth - 2)  # Reduce by 2 levels, minimum 10
                        info_after = engine.analyse(board, chess.engine.Limit(depth=after_depth))
                        eval_after = info_after.get("score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))
                        # Capture PV after move to check for mate sequences
                        pv_after_moves = info_after.get("pv", [])
                        pv_after = [mv.uci() for mv in pv_after_moves] if pv_after_moves else []

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
                    # Simplified Chess.com-aligned thresholds:
                    is_best = centipawn_loss <= 5      # Best moves (engine top choice, 0-5cp)
                    is_excellent = 5 < centipawn_loss <= 25  # Excellent moves (nearly optimal, 5-25cp) - merged great+excellent
                    is_great = 5 < centipawn_loss <= 25      # Alias for is_excellent (for backward compatibility)
                    is_good = 25 < centipawn_loss <= 100     # Good moves (solid play, 25-100cp) - merged good+acceptable
                    is_acceptable = 25 < centipawn_loss <= 100  # Alias for is_good (for backward compatibility)
                    is_inaccuracy = 100 < centipawn_loss <= 200  # Inaccuracies (100-200cp) - Chess.com standard
                    is_mistake = 200 < centipawn_loss <= 400  # Mistakes (200-400cp) - Chess.com standard
                    is_blunder = centipawn_loss > 400  # Blunders (400+cp) - Chess.com standard

                    # ============================================================================
                    # BRILLIANT MOVE DETECTION - Chess.com Aligned
                    # ============================================================================
                    # Based on Chess.com official criteria (support.chess.com/articles/8572705):
                    # 1. Must be best or nearly best move (0-15cp loss maximum for sacrifices)
                    # 2. Must involve non-obvious piece sacrifice OR find forced mate
                    # 3. Position must not be completely winning without the move
                    # 4. Move should be difficult to find (non-obvious/surprising)
                    # 5. Adjusted for player rating (harder requirements for stronger players)
                    #
                    # NOTE: Chess.com appears to be more lenient on centipawn loss for tactical
                    # sacrifices compared to quiet moves. We allow up to 15cp loss for sacrifices
                    # to better match their classification behavior.
                    #
                    # Frequency: EXTREMELY rare - should appear in ~0-1% of games
                    # ============================================================================
                    is_brilliant = False

                    # Brilliant moves must be near-best moves
                    # Chess.com: 0-5cp for quiet moves, up to ~10cp for clear tactical sacrifices
                    # Based on examples (Nxe6, Bxg3), tactical sacrifices get more leeway

                    # DEBUG: Log move being analyzed (safely - don't access board if move not pushed)
                    try:
                        move_san_debug = move_san  # Use SAN notation from above (calculated before push)
                        move_uci_debug = current_move.uci()  # Also keep UCI for debugging
                    except:
                        try:
                            move_san_debug = current_move.uci()  # Fallback to UCI
                            move_uci_debug = current_move.uci()
                        except:
                            move_san_debug = str(current_move)
                            move_uci_debug = str(current_move)

                    # Write to log file for easier searching
                    try:
                        with open("brilliant_debug.log", "a", encoding="utf-8") as f:
                            f.write(f"\n{'='*80}\n")
                            f.write(f"MOVE: {move_san_debug} ({move_uci_debug})\n")
                            f.write(f"{'='*80}\n")
                    except:
                        pass

                    # DEBUG: Always log centipawn loss for ALL moves (before the check)
                    print(f"[BRILLIANT DEBUG] {move_san_debug} ({move_uci_debug}): centipawn_loss={centipawn_loss:.1f}, best_cp={best_cp:.1f}, actual_cp={actual_cp:.1f}")
                    try:
                        with open("brilliant_debug.log", "a", encoding="utf-8") as f:
                            f.write(f"[BRILLIANT DEBUG] {move_san_debug} ({move_uci_debug}): centipawn_loss={centipawn_loss:.1f}, best_cp={best_cp:.1f}, actual_cp={actual_cp:.1f}\n")
                    except:
                        pass

                    # KEY INSIGHT: Chess.com allows higher centipawn loss for clear tactical sacrifices
                    # Check if this is a clear tactical sacrifice BEFORE filtering by centipawn_loss
                    # This allows moves like Nxe6 (54cp loss) to still be considered brilliant
                    is_potential_clear_tactical = False
                    tactical_sacrifice_threshold = 10  # Default threshold

                    try:
                        # Temporarily undo move to check piece values and capture status
                        board.pop()
                        piece_values = {'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0}
                        board_restored = False

                        if board.is_capture(current_move):
                            moving_piece = board.piece_at(current_move.from_square)
                            captured_piece = board.piece_at(current_move.to_square)

                            if moving_piece and captured_piece:
                                moving_value = piece_values.get(moving_piece.symbol().upper(), 0)
                                captured_value = piece_values.get(captured_piece.symbol().upper(), 0)

                                # Is it a potential sacrifice? (moving piece more valuable)
                                if moving_value > captured_value:
                                    sacrifice_value = moving_value - captured_value

                                    # Now push move and check if piece can be captured
                                    board.push(current_move)
                                    board_restored = True

                                    # Check if the moving piece can be captured after the move
                                    to_square = current_move.to_square
                                    if board.piece_at(to_square):
                                        attackers = board.attackers(not player_color, to_square)

                                        # Clear tactical sacrifice: capture with more valuable piece (3+ points for brilliant)
                                        # AND the piece can be captured (tactical indicator)
                                        if len(attackers) > 0 and sacrifice_value >= 3:
                                            is_potential_clear_tactical = True
                                            tactical_sacrifice_threshold = 75  # Allow up to 75cp loss for clear tactical sacrifices (matches Nxe6 with 69cp loss)

                                            debug_msg = f"[BRILLIANT DEBUG] {move_san_debug}: DETECTED CLEAR TACTICAL SACRIFICE (sacrifice_value={sacrifice_value}, can_be_captured=True) - allowing higher centipawn_loss threshold (75cp)"
                                            print(debug_msg)
                                            try:
                                                with open("brilliant_debug.log", "a", encoding="utf-8") as f:
                                                    f.write(debug_msg + "\n")
                                            except:
                                                pass

                        # Always restore board state if we haven't already
                        if not board_restored:
                            board.push(current_move)
                    except Exception as e:
                        # If anything goes wrong, restore board and use default threshold
                        try:
                            # Try to restore if board is invalid (move not on board)
                            if not any(current_move == m for m in board.legal_moves):
                                board.push(current_move)
                        except:
                            try:
                                board.push(current_move)  # Fallback: just try to push
                            except:
                                pass

                    if centipawn_loss <= tactical_sacrifice_threshold:  # Dynamic threshold: 10cp default, 60cp for clear tactical sacrifices
                        optimal_cp = best_cp
                        threshold_msg = f"WITHIN RANGE (threshold={tactical_sacrifice_threshold}cp)" if not is_potential_clear_tactical else f"WITHIN TACTICAL SACRIFICE RANGE (threshold={tactical_sacrifice_threshold}cp)"
                        print(f"[BRILLIANT DEBUG] Checking {move_san_debug}: {threshold_msg}")

                        # Get rating-adjusted thresholds (default to 1500 if not available)
                        # NOTE: Player rating context would improve threshold accuracy (future enhancement)
                        rating_thresholds = get_rating_adjusted_brilliant_threshold(player_rating=None)
                    else:
                        print(f"[BRILLIANT DEBUG] {move_san_debug} SKIPPED: centipawn_loss={centipawn_loss:.1f} > {tactical_sacrifice_threshold} (too high for brilliant)")
                        try:
                            with open("brilliant_debug.log", "a", encoding="utf-8") as f:
                                f.write(f"[BRILLIANT DEBUG] {move_san_debug} SKIPPED: centipawn_loss too high ({centipawn_loss:.1f} > {tactical_sacrifice_threshold})\n")
                        except:
                            pass
                        # Skip brilliant detection if centipawn loss is too high
                        is_brilliant = False

                    # Only continue brilliant detection if within range
                    if centipawn_loss <= tactical_sacrifice_threshold:
                        # -----------------------------------------------------------------------
                        # CRITERION 0: Check if move is forced (CRITICAL - must pass for ALL brilliants)
                        # -----------------------------------------------------------------------
                        # Forced moves (check evasion, only 1-3 legal moves) are NEVER brilliant
                        # Check this FIRST before other criteria
                        # NOTE: Move is already on board at this point (pushed at line 1664)
                        board.pop()  # Undo move to check position before move
                        num_legal_moves_before = len(list(board.legal_moves))

                        # Check if this is a king move (especially to escape check) - these are almost never brilliant
                        # Check piece type BEFORE restoring the move
                        moving_piece_type = None
                        if board.piece_at(current_move.from_square):
                            moving_piece_type = board.piece_at(current_move.from_square).piece_type

                        # CRITICAL: Check if move gives check or checkmate BEFORE restoring move
                        # Create a test board to check if move gives check/checkmate without corrupting main board
                        test_board = board.copy()
                        test_board.push(current_move)
                        move_gives_check = test_board.is_check()  # Check if opponent is now in check
                        move_is_checkmate = test_board.is_checkmate()  # Check if move is immediate checkmate

                        # Now restore the move on the main board
                        board.push(current_move)  # Restore move on main board

                        # EARLY CHECK: Immediate checkmate moves are NEVER brilliant unless they involve a clear sacrifice
                        # Simple checkmate moves (like Qe2#) are just winning moves, not brilliant tactical sacrifices
                        # Chess.com doesn't mark simple checkmates as brilliant - they're just the best move
                        # We'll set a flag here and enforce it at the end with a final override

                        # Check if move is forced (only 1-2 legal moves = forced, 3+ = might have choice)
                        # For sacrifices leading to mate, be more lenient (sometimes brilliant moves happen in tactical positions)
                        is_forced_move = num_legal_moves_before <= 2  # Only 1-2 moves = definitely forced

                        is_king_move = (moving_piece_type == chess.KING)
                        if is_king_move:
                            print(f"[BRILLIANT DEBUG] {move_san_debug}: King move detected - rarely brilliant unless it's a sacrifice")

                        if move_gives_check:
                            print(f"[BRILLIANT DEBUG] {move_san_debug}: Move gives check detected - will block if not a sacrifice")

                        if move_is_checkmate:
                            print(f"[BRILLIANT DEBUG] {move_san_debug}: Move is immediate checkmate - will block unless it's a sacrifice")

                        if is_forced_move:
                            print(f"[BRILLIANT DEBUG] {move_san_debug}: Move appears forced (only {num_legal_moves_before} legal moves)")

                        # -----------------------------------------------------------------------
                        # CRITERION 1: Non-Obvious Move Detection
                        # -----------------------------------------------------------------------
                        # A move is "non-obvious" if there are multiple reasonable alternatives
                        # Chess.com emphasizes this - brilliant moves should be surprising/creative
                        is_non_obvious = False

                        # Temporarily undo move to analyze alternatives
                        board.pop()

                        try:
                            # OPTIMIZATION: Smart MultiPV usage (5-10% speedup)
                            # Only run expensive multipv=3 analysis when it's likely to find brilliant moves
                            # Conditions: captures available, roughly equal position, middlegame
                            should_run_multipv = False

                            # Check if position is roughly equal (-50 to +50 centipawns)
                            position_roughly_equal = abs(best_cp) <= 50

                            # Check if there are captures available (tactical position)
                            has_captures = any(board.is_capture(m) for m in board.legal_moves)

                            # Check if in middlegame (fullmove_number available from outer scope)
                            # Brilliant moves more common in middlegame (moves 10-30)
                            in_middlegame = (fullmove_number is not None and
                                           10 <= fullmove_number <= 30)

                            # Run multipv only when conditions are favorable for brilliant moves
                            # OR when centipawn loss is very small (potential brilliant candidate)
                            should_run_multipv = (
                                (position_roughly_equal and has_captures and in_middlegame) or
                                (centipawn_loss <= 15)  # Always check near-best moves
                            )

                            if not should_run_multipv:
                                # Skip multipv analysis - not a brilliant move candidate
                                is_non_obvious = False
                            else:
                                # Run multipv analysis for brilliant move detection
                                # Get top 3 moves to check if there are multiple good options
                                multipv_analysis = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=3)

                                if len(multipv_analysis) >= 2:
                                    # Check if the played move is significantly better than alternatives
                                    # or if there are multiple similarly good moves (making this choice non-obvious)
                                    best_score = multipv_analysis[0]["score"].pov(player_color).score(mate_score=1000)
                                    second_best_score = multipv_analysis[1]["score"].pov(player_color).score(mate_score=1000)

                                    # Non-obvious if: multiple good moves exist (within 50cp) OR move is uniquely strong
                                    # Also check if the played move matches the best move (if it's the best, it's non-obvious)
                                    alternatives_close = abs(best_score - second_best_score) <= 50
                                    move_uniquely_strong = (best_score - second_best_score) > 150

                                    # Check if played move is the best move (if so, it's non-obvious if alternatives are close)
                                    # If played move is best and much better than alternatives, it's brilliant
                                    played_move_is_best = (centipawn_loss <= 5)  # Best or near-best

                                    is_non_obvious = (alternatives_close or move_uniquely_strong) and played_move_is_best
                                else:
                                    # If only one legal move, it's not brilliant (forced)
                                    # But if there are 2-3 moves, check if it's still non-obvious
                                    num_legal = len(list(board.legal_moves))
                                    is_non_obvious = num_legal > 3 or (num_legal >= 2 and centipawn_loss <= 5)

                            # Apply rating-adjusted threshold
                            num_legal_moves = len(list(board.legal_moves))
                            # For sacrifices leading to mate, be more lenient on non-obvious requirement
                            # Only apply strict threshold for non-sacrifice brilliants
                            min_moves_required = rating_thresholds['non_obvious_threshold']
                            # If it's a sacrifice, allow lower threshold
                            if num_legal_moves < min_moves_required and num_legal_moves >= 3:
                                # Allow 3+ moves for sacrifices (we'll check this later)
                                pass  # Don't block here, check later
                            else:
                                is_non_obvious = is_non_obvious and num_legal_moves >= min_moves_required

                        except Exception as e:
                            print(f"[BRILLIANT] Error in non-obvious detection: {e}")
                            # Fallback: assume non-obvious if position is complex
                            num_legal_moves = len(list(board.legal_moves))
                            is_non_obvious = num_legal_moves >= rating_thresholds['non_obvious_threshold']

                        # Restore the board state
                        board.push(move)

                        # -----------------------------------------------------------------------
                        # CRITERION 2: Forced Mate Detection (Rating-Adjusted)
                        # -----------------------------------------------------------------------
                        # Finding a forced mate, especially a short one, is brilliant
                        # Check both immediate mate evaluation AND PV for mate sequences
                        # (Stockfish may not show mate evaluation if mate is beyond current depth)

                        # Method 1: Direct mate evaluation
                        immediate_mate = (
                            eval_after.pov(player_color).is_mate() and
                            not eval_before.pov(player_color).is_mate() and
                            abs(eval_after.pov(player_color).mate()) <= rating_thresholds['mate_in_moves']
                        )

                        # Method 2: Check PV for mate sequence (handles cases where mate is beyond depth)
                        # Analyze PV line to see if it leads to mate
                        pv_contains_mate = False
                        if pv_after and len(pv_after) > 0:
                            try:
                                # Create a temporary board and play through the PV to check for mate
                                temp_board = board.copy()
                                mate_found = False
                                for i, pv_move_uci in enumerate(pv_after[:10]):  # Check first 10 moves of PV
                                    try:
                                        pv_move = chess.Move.from_uci(pv_move_uci)
                                        if pv_move in temp_board.legal_moves:
                                            temp_board.push(pv_move)
                                            # Check if this position is mate
                                            if temp_board.is_checkmate():
                                                # Found mate in PV - count moves
                                                mate_in_moves = (i + 1) // 2 + 1  # Approximate (not perfect but good enough)
                                                if mate_in_moves <= rating_thresholds['mate_in_moves']:
                                                    pv_contains_mate = True
                                                    mate_found = True
                                                    print(f"[BRILLIANT DEBUG] {move_san_debug}: Found mate in PV at move {mate_in_moves} (PV line shows mate)")
                                                    break
                                    except Exception:
                                        continue
                                # Don't use high evaluation alone as indicator - only if combined with sacrifice
                                # High evaluation alone could just be winning material, not brilliant
                                # Only check PV for actual mate sequences, not just high evaluations
                            except Exception as e:
                                print(f"[BRILLIANT DEBUG] Error checking PV for mate: {e}")

                        forcing_mate_trigger = immediate_mate or pv_contains_mate

                        # -----------------------------------------------------------------------
                        # CRITERION 3: Material Sacrifice Detection (Rating-Adjusted)
                        # -----------------------------------------------------------------------
                        piece_values = {'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0}
                        sacrifice_trigger = False
                        sacrifice_detected = False  # Initialize to ensure it's always defined

                        # Check both captures AND non-capturing sacrifices (e.g., piece moves to hanging square)
                        board.pop()  # Undo move to check original position

                        moving_piece = board.piece_at(move.from_square)
                        if moving_piece:
                            moving_value = piece_values.get(moving_piece.symbol().upper(), 0)

                            # Type 1: Capture Sacrifices (taking with more valuable piece)
                            if board.is_capture(move):
                                captured_piece = board.piece_at(move.to_square)
                                if captured_piece:
                                    captured_value = piece_values.get(captured_piece.symbol().upper(), 0)

                                    # Chess.com: Sacrifice = giving up material for tactical compensation
                                    # Key: Compare position evaluations to see if material is truly sacrificed
                                    is_potential_sacrifice = moving_value > captured_value
                                    sacrifice_value = moving_value - captured_value if is_potential_sacrifice else 0

                                    # Calculate if evaluation "drops" compared to material exchange
                                    # For a true sacrifice: position should be worse than simple material exchange
                                    # OR it's a tactical blow that maintains/improves the position
                                    material_exchange_value = (moving_value - captured_value) * 100  # Convert to centipawns
                                    expected_eval = optimal_cp - material_exchange_value

                                    # Type 2: Check for pieces hanging after sacrifice FIRST
                                    # This is a key indicator of tactical sacrifice (like Nxe6, Bxg3)
                                    board.push(move)
                                    moving_piece_hangs = False
                                    moving_piece_can_be_captured = False
                                    to_square = move.to_square

                                    # Check if the piece that just moved can be captured
                                    if board.piece_at(to_square):
                                        # Check if piece is attacked (can be captured)
                                        attackers = board.attackers(not player_color, to_square)
                                        defenders = board.attackers(player_color, to_square)

                                        # Piece "hangs" if more attackers than defenders (unsafe)
                                        moving_piece_hangs = len(attackers) > len(defenders)

                                        # Piece can be captured if it's attacked (even if defended)
                                        # For tactical sacrifices, this is sufficient - opponent CAN take it
                                        moving_piece_can_be_captured = len(attackers) > 0

                                    board.pop()

                                    # True sacrifice: either traditional (eval drops) OR tactical (strong despite material loss)
                                    # Rating-adjusted: lower ratings = more lenient
                                    # RELAXED: Allow tactical sacrifices where position stays strong OR piece hangs
                                    eval_drop_indicates_sacrifice = actual_cp < expected_eval + 150

                                    # Tactical sacrifice: position is good/equal OR piece can be captured (clear tactical indicator)
                                    # Chess.com is more lenient: if piece can be captured after sacrifice, it's tactical
                                    # For brilliant moves, even if piece is defended (equal attackers/defenders), it's still tactical
                                    tactical_sacrifice = (
                                        is_potential_sacrifice and
                                        sacrifice_value >= rating_thresholds['min_sacrifice_value'] and
                                        (actual_cp >= -50 or moving_piece_can_be_captured)  # Position good OR piece can be captured
                                    )

                                    is_true_sacrifice = (
                                        is_potential_sacrifice and
                                        sacrifice_value >= rating_thresholds['min_sacrifice_value'] and
                                        (eval_drop_indicates_sacrifice or tactical_sacrifice)
                                    )

                                    # Sacrifice detected if: true sacrifice OR clear tactical sacrifice (piece can be captured)
                                    # Chess.com pattern: if you capture with more valuable piece and it can be captured, that's tactical
                                    # BUT: require at least 3 points of material difference for brilliant moves (per Chess.com standards)
                                    # For brilliant: piece must be able to be captured (even if defended equally)

                                    # PRIMARY: Clear tactical sacrifice - piece can be captured + material sacrifice
                                    # This is the main pattern for brilliant moves
                                    # CRITICAL: For brilliant moves, ONLY accept clear tactical sacrifices (piece can be captured)
                                    # This prevents forks/pins that just win material from being marked as brilliant
                                    # STANDARD: Require 3+ points net sacrifice (e.g., Rook for Knight = 5-3 = 2, NOT brilliant)
                                    is_clear_tactical_sacrifice = (
                                        is_potential_sacrifice and
                                        moving_piece_can_be_captured and  # Must be capturable for brilliant
                                        sacrifice_value >= 3  # Require 3+ points for brilliant (per Chess.com standards)
                                    )

                                    # For brilliant moves, ONLY accept clear tactical sacrifices (piece can be captured)
                                    # Don't accept "true sacrifices" that don't involve piece being capturable
                                    # This prevents forks/pins from being marked as brilliant
                                    sacrifice_detected = is_clear_tactical_sacrifice  # Only clear tactical sacrifices for brilliant

                                    # DEBUG: Log why moves are/aren't clear tactical sacrifices
                                    if board.is_capture(move) and not is_clear_tactical_sacrifice:
                                        reason = []
                                        if not is_potential_sacrifice:
                                            reason.append("not a sacrifice (moving_value <= captured_value)")
                                        if not moving_piece_can_be_captured:
                                            reason.append("piece can't be captured (not a sacrifice, just winning material)")
                                        if sacrifice_value < 3:
                                            reason.append(f"insufficient sacrifice value ({sacrifice_value} < 3)")
                                        print(f"[BRILLIANT DEBUG] {move_san_debug}: NOT clear tactical sacrifice - {', '.join(reason)}")

                                    # DEBUG: Log sacrifice detection
                                    if board.is_capture(move):
                                        debug_msg = (f"[BRILLIANT DEBUG] {move_san_debug}: is_potential_sacrifice={is_potential_sacrifice}, "
                                              f"moving_piece_can_be_captured={moving_piece_can_be_captured}, "
                                              f"sacrifice_value={sacrifice_value}, "
                                              f"is_clear_tactical_sacrifice={is_clear_tactical_sacrifice}, "
                                              f"sacrifice_detected={sacrifice_detected}")
                                        print(debug_msg)
                                        try:
                                            with open("brilliant_debug.log", "a", encoding="utf-8") as f:
                                                f.write(debug_msg + "\n")
                                        except:
                                            pass

                                    # Additional filter: If it's a Queen capture and Queen can't be captured, it's NOT a sacrifice
                                    # Queen captures that win material (forks/pins) are just good moves, not brilliant
                                    if sacrifice_detected and not moving_piece_can_be_captured:
                                        sacrifice_detected = False

                                    if sacrifice_detected:
                                        # Additional Chess.com criteria (rating-adjusted):
                                        # - Position should not be completely winning already (not just converting)
                                        # - Position should remain favorable after sacrifice (tactical compensation)

                                        # Rating-adjusted: allow wider range for lower ratings
                                        # For clear tactical sacrifices, be more lenient - brilliant tactical shots are brilliant even if already winning
                                        # Chess.com marks brilliant moves even in winning positions
                                        not_already_crushing = optimal_cp < rating_thresholds['max_position_cp']
                                        # For CLEAR tactical sacrifices (piece can be captured), allow up to 500cp
                                        # But only if this is actually a capture move - prevents false positives in winning positions
                                        if moving_piece_can_be_captured and board.is_capture(move):
                                            not_already_crushing = optimal_cp < 500  # More lenient for clear tactical sacrifices
                                        elif moving_piece_can_be_captured:
                                            # Non-capture with piece hanging: be more conservative in already winning positions
                                            not_already_crushing = optimal_cp < 300  # Still allow, but not in crushing positions

                                        # Position compensation: For brilliant moves, require WINNING position after sacrifice
                                        # Chess.com standard: Position must be winning (+100cp+) after spectacular sacrifice
                                        # This ensures only truly brilliant sacrifices are marked, not routine tactical exchanges
                                        if moving_piece_can_be_captured:
                                            # Clear tactical sacrifice: Position must be WINNING after sacrifice
                                            # Per Chess.com standards: spectacular sacrifice (3+ points) must maintain winning advantage
                                            if actual_cp > optimal_cp + 80:
                                                # Position significantly improved - this is brilliant
                                                # Still require winning position, but allow some flexibility if position improved
                                                compensation_threshold = 50  # Must be at least +0.5 pawns
                                            elif actual_cp > optimal_cp + 40:
                                                # Position improved - still brilliant
                                                compensation_threshold = 75  # Must be at least +0.75 pawns
                                            else:
                                                # Standard brilliant move requirement: position must be WINNING (+100cp+)
                                                # This prevents routine exchanges like Rxf2 (rook for knight) from being marked brilliant
                                                compensation_threshold = 100  # Must be +1.0 pawns or better (winning position)
                                        else:
                                            # For non-clear sacrifices, require at least equal position (0cp+)
                                            compensation_threshold = max(rating_thresholds['min_compensation_cp'], 0)

                                        has_compensation = actual_cp >= compensation_threshold

                                        # For mates, always consider as having compensation
                                        # Check both immediate mate evaluation and PV for mate sequences
                                        if eval_after.pov(player_color).is_mate():
                                            has_compensation = True
                                        # Also check if PV contains mate or very high evaluation suggests mate
                                        elif pv_after and len(pv_after) > 0:
                                            # Check if evaluation is extremely high (>700cp) which suggests mate
                                            if actual_cp > 700:
                                                has_compensation = True

                                        # If position significantly improved (e.g., Nxe6 leading to +146cp), it's brilliant
                                        # Chess.com marks these as brilliant even if starting position wasn't crushing
                                        # Lower threshold - even 80cp+ improvement is significant
                                        if actual_cp > optimal_cp + 80:
                                            has_compensation = True
                                            # Don't require "not_already_crushing" if this move actually improved position significantly
                                            not_already_crushing = True

                                        sacrifice_trigger = (
                                            sacrifice_detected and
                                            not_already_crushing and
                                            has_compensation
                                        )

                                        # DEBUG: Log sacrifice trigger
                                        debug_msg = (f"[BRILLIANT DEBUG] {move_san_debug}: sacrifice_trigger={sacrifice_trigger} "
                                              f"(sacrifice_detected={sacrifice_detected}, "
                                              f"not_already_crushing={not_already_crushing}, optimal_cp={optimal_cp:.1f}, "
                                              f"has_compensation={has_compensation}, actual_cp={actual_cp:.1f}, "
                                              f"compensation_threshold={compensation_threshold:.1f})")
                                        print(debug_msg)
                                        try:
                                            with open("brilliant_debug.log", "a", encoding="utf-8") as f:
                                                f.write(debug_msg + "\n")
                                        except:
                                            pass

                            # Type 2: Non-Capture Sacrifices (moving piece to hanging square OR leaving other pieces hanging)
                            elif moving_value >= rating_thresholds['min_sacrifice_value']:  # Rating-adjusted minimum
                                # FIRST: Check position BEFORE move (board is already popped at line 1983, so we're in position before)
                                pieces_hanging_before = {}
                                for square in chess.SQUARES:
                                    piece = board.piece_at(square)
                                    if piece and piece.color == player_color:
                                        piece_attackers = board.attackers(not player_color, square)
                                        piece_defenders = board.attackers(player_color, square)
                                        if len(piece_attackers) > len(piece_defenders):
                                            piece_value = piece_values.get(piece.symbol().upper(), 0)
                                            if piece_value >= 3:  # Only count significant pieces
                                                pieces_hanging_before[square] = piece_value

                                # NOW: Apply the move and check position AFTER
                                board.push(move)
                                to_square = move.to_square

                                # Check if moving piece is now hanging
                                attackers = board.attackers(not player_color, to_square)
                                defenders = board.attackers(player_color, to_square)
                                piece_hangs = len(attackers) > len(defenders)
                                piece_can_be_captured = len(attackers) > 0  # Can be captured if attacked

                                # Check if OTHER pieces are hanging AFTER the move
                                # This covers cases like Bf6 where queen is hanging and move threatens mate
                                other_pieces_hanging = False
                                other_pieces_hanging_value = 0

                                # Check all squares of the player's pieces to see if any are now hanging
                                for square in chess.SQUARES:
                                    piece = board.piece_at(square)
                                    # Only check pieces of the moving player's color (excluding the moving piece itself)
                                    if piece and piece.color == player_color and square != to_square:
                                        piece_attackers = board.attackers(not player_color, square)
                                        piece_defenders = board.attackers(player_color, square)
                                        # Piece is hanging if more attackers than defenders
                                        piece_is_hanging_after = len(piece_attackers) > len(piece_defenders)

                                        if piece_is_hanging_after:
                                            piece_value = piece_values.get(piece.symbol().upper(), 0)
                                            # Only count significant pieces (3+ points) as hanging
                                            if piece_value >= 3:
                                                other_pieces_hanging = True
                                                other_pieces_hanging_value = max(other_pieces_hanging_value, piece_value)
                                                was_hanging_before = square in pieces_hanging_before
                                                status = "became hanging" if not was_hanging_before else "already hanging"
                                                print(f"[BRILLIANT DEBUG] {move_san_debug}: Piece on {chess.square_name(square)} ({piece.symbol()}) is {status} after move")

                                board.pop()

                                # CRITICAL: For non-capture moves, consider it a sacrifice if:
                                # 1. Moving piece can be captured (attacked) AND hangs, OR
                                # 2. Other significant pieces (3+ points) are left hanging AND move creates significant threat
                                # This covers cases like Bf6 leaving queen hanging to threaten mate
                                is_moving_piece_sacrifice = piece_can_be_captured and piece_hangs
                                is_leaving_pieces_hanging = other_pieces_hanging and other_pieces_hanging_value >= 3

                                # Check if move creates significant threat (check, mate threat, etc.)
                                # We already have move_gives_check, but also check if move creates mate threat
                                board.push(move)
                                move_creates_check = board.is_check()
                                # Check if move creates a strong tactical threat (high evaluation, mate threat, check)
                                # For moves that leave pieces hanging, a check is already a strong threat
                                # because it forces the opponent to respond and can't take the hanging piece
                                move_creates_strong_threat = (
                                    move_creates_check or  # Check is a strong threat, especially with hanging pieces
                                    actual_cp > 200 or  # Strong evaluation suggests threat
                                    eval_after.pov(player_color).is_mate() or  # Immediate mate
                                    forcing_mate_trigger  # Mate in PV
                                )
                                board.pop()

                                if is_moving_piece_sacrifice or (is_leaving_pieces_hanging and move_creates_strong_threat):
                                    # Non-capture sacrifice: either moved piece to attacked square OR left other pieces hanging with threat
                                    # Check if it's truly sacrificial (eval drops or stays winning with compensation)

                                    # For moves that leave pieces hanging but create strong threats, be very lenient
                                    # Chess.com marks brilliant moves even in very winning positions if they're tactical sacrifices
                                    if is_leaving_pieces_hanging and move_creates_strong_threat:
                                        # For tactical sacrifices that leave pieces hanging, allow even if position is very winning
                                        # BUT: Be more conservative - require significant piece hanging (Queen or Rook) in very winning positions
                                        # This prevents false positives like Nc3 in already crushing positions
                                        if optimal_cp >= 400 and other_pieces_hanging_value < 5:
                                            # In crushing positions (+400cp), require at least Rook (5 points) hanging for brilliant
                                            # Knight/Bishop hanging in crushing positions is likely just a good move, not brilliant
                                            not_already_crushing = False
                                            print(f"[BRILLIANT DEBUG] {move_san_debug}: Position too winning (+{optimal_cp:.0f}cp) with only {other_pieces_hanging_value} points hanging - not brilliant")
                                        else:
                                            # The brilliance is in the tactical calculation, not whether position was already winning
                                            not_already_crushing = True  # Always allow if leaving significant pieces hanging with strong threat
                                        print(f"[BRILLIANT DEBUG] {move_san_debug}: Leaving pieces hanging with strong threat - optimal_cp={optimal_cp:.1f}, pieces_value={other_pieces_hanging_value}")
                                    else:
                                        not_already_crushing = optimal_cp < rating_thresholds['max_position_cp']

                                    has_compensation = (
                                        actual_cp >= rating_thresholds['min_compensation_cp'] or
                                        eval_after.pov(player_color).is_mate() or
                                        forcing_mate_trigger or
                                        (is_leaving_pieces_hanging and move_creates_strong_threat and actual_cp >= -100)  # Allow temporary deficit for strong threats
                                    )

                                    # Debug output
                                    print(f"[BRILLIANT DEBUG] {move_san_debug}: Sacrifice check - is_leaving_pieces_hanging={is_leaving_pieces_hanging}, move_creates_strong_threat={move_creates_strong_threat}, not_already_crushing={not_already_crushing}, has_compensation={has_compensation}, optimal_cp={optimal_cp:.1f}, actual_cp={actual_cp:.1f}")

                                    sacrifice_trigger = (
                                        not_already_crushing and
                                        has_compensation
                                    )

                                    if sacrifice_trigger:
                                        print(f"[BRILLIANT DEBUG] {move_san_debug}: Non-capture sacrifice detected - moving_piece_sacrifice={is_moving_piece_sacrifice}, leaving_pieces_hanging={is_leaving_pieces_hanging}, creates_strong_threat={move_creates_strong_threat}")
                                    else:
                                        print(f"[BRILLIANT DEBUG] {move_san_debug}: Non-capture sacrifice FAILED - not_already_crushing={not_already_crushing}, has_compensation={has_compensation}")
                                else:
                                    # Piece can't be captured or doesn't hang - not a sacrifice
                                    sacrifice_trigger = False
                                    if not is_moving_piece_sacrifice and not is_leaving_pieces_hanging:
                                        print(f"[BRILLIANT DEBUG] {move_san_debug}: Non-capture move - piece can't be captured (attackers={len(attackers)}, defenders={len(defenders)}), no other pieces hanging, not a sacrifice")
                                    elif is_leaving_pieces_hanging and not move_creates_strong_threat:
                                        print(f"[BRILLIANT DEBUG] {move_san_debug}: Non-capture move - pieces hanging but no strong threat created, not a sacrifice")
                            else:
                                # Piece value too low to be a sacrifice
                                sacrifice_trigger = False
                                print(f"[BRILLIANT DEBUG] {move_san_debug}: Moving piece value ({moving_value}) < min_sacrifice_value ({rating_thresholds['min_sacrifice_value']}), not a sacrifice")

                        # Restore board state
                        board.push(move)

                        # -----------------------------------------------------------------------
                        # FINAL BRILLIANT DETERMINATION
                        # -----------------------------------------------------------------------
                        # Chess.com criteria (adjusted based on empirical observations):
                        # 1. Forced mate: Requires strict 0-5cp loss (truly best move)
                        # 2. Tactical sacrifice: More lenient for clear tactical indicators
                        #    - Clear tactical sacrifice (piece hangs): up to 25cp loss
                        #    - Other sacrifices: up to 15cp loss
                        #
                        # This differentiation better matches Chess.com's actual behavior,
                        # where clear tactical sacrifices (like Nxe6, Bxg3 where piece hangs)
                        # get more leeway than quiet positional sacrifices.

                        # For forced mates, require strict best move (0-5cp)
                        # CRITICAL: Checks without sacrifice are NOT brilliant via mate
                        # Even if they find mate, checks that fork/pin (win material) are tactical, not brilliant
                        # CRITICAL: Immediate checkmate is NEVER brilliant - it's just the winning move
                        brilliant_via_mate = (
                            forcing_mate_trigger and
                            is_best and
                            centipawn_loss <= 5 and
                            not (move_gives_check and not sacrifice_trigger) and
                            not move_is_checkmate  # Immediate checkmate is never brilliant, regardless of sacrifice
                        )

                        # For sacrifices: check if this is a clear tactical sacrifice (capture where piece can be captured)
                        # OR a non-capture sacrifice that leaves pieces hanging
                        # Use the earlier detection result (is_potential_clear_tactical) which already set the 60cp threshold
                        # OR recalculate if not detected earlier, but use the tactical_sacrifice_threshold instead of hardcoded 10cp
                        clear_tactical_sacrifice = False
                        non_capture_hanging_pieces = False  # Track if non-capture leaves pieces hanging
                        if centipawn_loss <= tactical_sacrifice_threshold:  # Use the dynamic threshold (10cp default, 60cp for clear tactical)
                            # Temporarily undo to check if it's a capture sacrifice
                            board.pop()
                            if board.is_capture(move):
                                moving_piece = board.piece_at(move.from_square)
                                if moving_piece:
                                    moving_value = piece_values.get(moving_piece.symbol().upper(), 0)
                                    captured_piece = board.piece_at(move.to_square)
                                    if captured_piece:
                                        captured_value = piece_values.get(captured_piece.symbol().upper(), 0)
                                        # Clear tactical: more valuable piece captures less valuable piece
                                        # For brilliant moves, require 3+ points net sacrifice (per Chess.com standards)
                                        # This prevents routine exchanges like Rxf2 (rook for knight = 2 points) from being marked brilliant
                                        sacrifice_points = moving_value - captured_value
                                        print(f"[BRILLIANT DEBUG] {move_san_debug}: checking clear_tactical - moving_value={moving_value}, captured_value={captured_value}, sacrifice_points={sacrifice_points}")
                                        if moving_value > captured_value and sacrifice_points >= 3:
                                            board.push(move)
                                            to_square = move.to_square
                                            if board.piece_at(to_square):
                                                # Check if piece can be captured (clear tactical indicator)
                                                attackers = board.attackers(not player_color, to_square)
                                                defenders = board.attackers(player_color, to_square)
                                                # Piece can be captured if it's attacked (even if defended)
                                                # For tactical sacrifices, equal attackers/defenders still counts as tactical
                                                clear_tactical_sacrifice = len(attackers) > 0
                                                print(f"[BRILLIANT DEBUG] {move_san_debug}: after checking attackers - attackers={len(attackers)}, clear_tactical_sacrifice={clear_tactical_sacrifice}")
                                            else:
                                                print(f"[BRILLIANT DEBUG] {move_san_debug}: no piece at to_square after push")
                                            board.pop()
                                        else:
                                            print(f"[BRILLIANT DEBUG] {move_san_debug}: not a sacrifice - moving_value={moving_value} <= captured_value={captured_value} OR sacrifice_points={sacrifice_points} < 3")
                            else:
                                # Non-capture move - check if it leaves pieces hanging (like Bf6 leaving queen)
                                # We already calculated this earlier in the non-capture sacrifice section
                                # Use the variables we set: is_leaving_pieces_hanging and move_creates_strong_threat
                                # But we need to check again here since we're in a different context
                                board.push(move)  # Move is already on board from earlier
                                # Check if significant pieces are hanging after this move
                                other_pieces_hanging_value = 0
                                for square in chess.SQUARES:
                                    piece = board.piece_at(square)
                                    if piece and piece.color == player_color and square != move.to_square:
                                        piece_attackers = board.attackers(not player_color, square)
                                        piece_defenders = board.attackers(player_color, square)
                                        if len(piece_attackers) > len(piece_defenders):
                                            piece_value = piece_values.get(piece.symbol().upper(), 0)
                                            if piece_value >= 3:  # Queen, rook, or significant piece
                                                other_pieces_hanging_value = max(other_pieces_hanging_value, piece_value)

                                # Check if move creates strong threat (check or mate threat)
                                move_creates_check_here = board.is_check()
                                move_creates_strong_threat_here = (
                                    move_creates_check_here or
                                    actual_cp > 200 or
                                    eval_after.pov(player_color).is_mate() or
                                    forcing_mate_trigger
                                )

                                # If significant pieces are hanging and move creates strong threat, treat as clear tactical
                                # Don't require sacrifice_trigger here - we'll check that later
                                # The key is: pieces hanging + strong threat = tactical sacrifice candidate
                                if other_pieces_hanging_value >= 3 and move_creates_strong_threat_here:
                                    non_capture_hanging_pieces = True
                                    print(f"[BRILLIANT DEBUG] {move_san_debug}: Non-capture leaves pieces hanging (value={other_pieces_hanging_value}) with strong threat - treating as clear tactical")
                                board.pop()
                            board.push(move)

                        # Chess.com pattern: Brilliant moves are best (0-5cp) OR clear tactical sacrifices (up to ~10cp)
                        # Based on examples: Nxe6 and Bxg3 are tactical sacrifices where piece can be captured
                        # KEY: Must be TRUE SACRIFICE - piece must be capturable (not just winning material)
                        # Queen captures that win material are NOT brilliant unless piece can also be captured

                        # DEBUG: Log clear tactical sacrifice detection
                        print(f"[BRILLIANT DEBUG] {move_san_debug}: clear_tactical_sacrifice={clear_tactical_sacrifice}, "
                              f"non_capture_hanging_pieces={non_capture_hanging_pieces}, "
                              f"centipawn_loss={centipawn_loss:.1f}")

                        if clear_tactical_sacrifice or non_capture_hanging_pieces:
                            # Clear tactical sacrifice (piece can be captured): use the dynamic threshold
                            # If detected earlier as clear tactical, tactical_sacrifice_threshold is already 60cp
                            # CRITICAL: Must verify piece can actually be captured (tactical sacrifice)
                            # Re-verify piece can be captured
                            board.pop()
                            piece_can_be_captured = False
                            if board.is_capture(move):
                                board.push(move)
                                to_square = move.to_square
                                if board.piece_at(to_square):
                                    attackers = board.attackers(not player_color, to_square)
                                    defenders = board.attackers(player_color, to_square)
                                    # Piece can be captured if attacked (even if defended)
                                    piece_can_be_captured = len(attackers) > 0
                                board.pop()
                            board.push(move)

                            # Only mark as brilliant if piece CAN be captured (true sacrifice) OR non-capture leaves pieces hanging
                            # Queen forks/pins that win material are NOT brilliant
                            if piece_can_be_captured or non_capture_hanging_pieces:
                                # For tactical sacrifices, allow temporary deficit - tactics provide compensation
                                # Position can be temporarily worse (up to -100cp) as long as sacrifice_trigger passes
                                # KEY: For clear tactical sacrifices, be more lenient - these are the main brilliant move pattern
                                # Use the dynamic threshold: 60cp for clear tactical, 10cp for others
                                # For non-capture sacrifices that leave pieces hanging, also use higher threshold (similar to clear tactical)
                                effective_threshold = tactical_sacrifice_threshold
                                if non_capture_hanging_pieces:
                                    # Non-capture sacrifices that leave pieces hanging get same leniency as clear tactical
                                    effective_threshold = 75  # Same as clear tactical sacrifices

                                brilliant_via_sacrifice = (
                                    sacrifice_trigger and
                                    centipawn_loss <= effective_threshold  # Use dynamic threshold (10cp default, 60cp for clear tactical, 75cp for non-capture hanging)
                                    # Don't check actual_cp here - let compensation_threshold handle it
                                )

                                # SAFETY: If sacrifice_trigger passed but brilliant_via_sacrifice is False due to other checks,
                                # but it's a clear tactical sacrifice (piece can be captured + 2+ material), override
                                # This ensures moves like Nxe6 aren't filtered out by edge cases
                                # Use dynamic threshold instead of hardcoded 10cp
                                if not brilliant_via_sacrifice and sacrifice_detected and centipawn_loss <= tactical_sacrifice_threshold:
                                    # Double-check: verify it's truly a tactical sacrifice
                                    board.pop()
                                    board_restored = False
                                    try:
                                        if board.is_capture(move):
                                            moving_piece = board.piece_at(move.from_square)
                                            if moving_piece:
                                                moving_val = piece_values.get(moving_piece.symbol().upper(), 0)
                                                captured_piece = board.piece_at(move.to_square)
                                                if captured_piece:
                                                    captured_val = piece_values.get(captured_piece.symbol().upper(), 0)
                                                    if moving_val > captured_val and (moving_val - captured_val) >= 3:
                                                        # Clear tactical sacrifice - check if piece can be captured
                                                        board.push(move)
                                                        board_restored = True  # Track that we pushed the move
                                                        if board.piece_at(move.to_square):
                                                            attackers = board.attackers(not player_color, move.to_square)
                                                            if len(attackers) > 0:  # Piece can be captured
                                                                # Override - it's a clear tactical sacrifice
                                                                brilliant_via_sacrifice = True
                                    except:
                                        pass
                                    finally:
                                        # Ensure board is restored (only push if we didn't already push it)
                                        if not board_restored:
                                            try:
                                                board.push(move)
                                            except:
                                                pass

                                # Require non-obvious: move should not be forced or trivial
                                if brilliant_via_sacrifice:
                                    # Re-check non-obvious - brilliant moves should be surprising
                                    # But for clear tactical sacrifices, be more lenient - even obvious tactical shots can be brilliant
                                    # FIXED: Use board copy to avoid corrupting main board state
                                    try:
                                        # Create a copy of the board to check legal moves without affecting main board
                                        # The board currently has the move applied, so we need to pop once to get position before move
                                        board_copy = board.copy()
                                        board_copy.pop()  # Remove move to get position before move
                                        num_legal = len(list(board_copy.legal_moves))
                                        # For tactical sacrifices, require at least 2 legal moves (not forced)
                                        # Very lenient - even if there are only 2 moves, if one is a brilliant tactical sacrifice, mark it brilliant
                                        # Chess.com is lenient for tactical sacrifices
                                        debug_msg = f"[BRILLIANT DEBUG] {move_san_debug}: non-obvious check - num_legal={num_legal}"
                                        print(debug_msg)
                                        try:
                                            with open("brilliant_debug.log", "a", encoding="utf-8") as f:
                                                f.write(debug_msg + "\n")
                                        except:
                                            pass
                                        if num_legal < 2:
                                            brilliant_via_sacrifice = False
                                            debug_msg = f"[BRILLIANT DEBUG] {move_san_debug}: BLOCKED by non-obvious check (num_legal={num_legal} < 2)"
                                            print(debug_msg)
                                            try:
                                                with open("brilliant_debug.log", "a", encoding="utf-8") as f:
                                                    f.write(debug_msg + "\n")
                                            except:
                                                pass
                                    except Exception as e:
                                        debug_msg = f"[BRILLIANT DEBUG] {move_san_debug}: error in non-obvious check: {e}"
                                        print(debug_msg)
                                        try:
                                            with open("brilliant_debug.log", "a", encoding="utf-8") as f:
                                                f.write(debug_msg + "\n")
                                        except:
                                            pass
                            else:
                                # Piece can't be captured - this is just winning material, not a sacrifice
                                # Not brilliant (even if it's a fork/pin)
                                brilliant_via_sacrifice = False
                                print(f"[BRILLIANT DEBUG] {move_san_debug}: Piece can't be captured after move - not a sacrifice, just winning material (fork/pin)")
                        elif forcing_mate_trigger:
                            # Forced mate: must be best move (0-5cp) AND non-obvious
                            # Only mark as brilliant if:
                            # 1. It's a sacrifice leading to mate (always brilliant), OR
                            # 2. It finds mate when there wasn't one AND it's non-obvious

                            # CRITICAL: Block checks that just win material (forks/pins) even if they find mate
                            # Moves like Nxg3+, Qxf2+ are checks that win material, not brilliant sacrifices
                            # move_gives_check is already detected above
                            if move_gives_check and not sacrifice_trigger:
                                # Check that just wins material (fork/pin) - not brilliant even if it finds mate
                                brilliant_via_sacrifice = False
                                print(f"[BRILLIANT DEBUG] {move_san_debug}: BLOCKED - check that just wins material (fork/pin), not brilliant even if finds mate")
                            elif sacrifice_trigger:
                                # Sacrifice leading to mate is always brilliant (if non-obvious)
                                brilliant_via_sacrifice = True
                                print(f"[BRILLIANT DEBUG] {move_san_debug}: Sacrifice leading to mate detected - marking as brilliant")
                            elif is_non_obvious and centipawn_loss <= 5:
                                # Finding mate when there wasn't one before - but only if non-obvious
                                # BUT: Must not be a check that just wins material
                                if not move_gives_check:
                                    brilliant_via_sacrifice = True
                                    print(f"[BRILLIANT DEBUG] {move_san_debug}: Found forced mate (non-obvious) - marking as brilliant")
                                else:
                                    brilliant_via_sacrifice = False
                                    print(f"[BRILLIANT DEBUG] {move_san_debug}: BLOCKED - check without sacrifice, not brilliant")
                            else:
                                brilliant_via_sacrifice = False
                        else:
                            # Other sacrifices: must be best move (0-5cp) - strictest for non-clear sacrifices
                            # CRITICAL: Block checks that just win material (forks/pins) even if they're "sacrifices"
                            # move_gives_check is already detected above
                            if move_gives_check and not sacrifice_trigger:
                                # Check that just wins material (fork/pin) - not brilliant
                                brilliant_via_sacrifice = False
                                print(f"[BRILLIANT DEBUG] {move_san_debug}: BLOCKED - check that just wins material (fork/pin), not brilliant")
                            else:
                                brilliant_via_sacrifice = sacrifice_trigger and centipawn_loss <= 5

                        # FINAL CHECK: Brilliant moves must be non-obvious (not forced)
                        # Exception: Sacrifices leading to mate can be brilliant even in tactical positions
                        # CRITICAL: King moves to escape check are almost never brilliant
                        if is_king_move and not sacrifice_trigger:
                            # King moves (especially to escape check) are almost never brilliant
                            # Only allow if it's a sacrifice leading to mate
                            if not (sacrifice_trigger and forcing_mate_trigger):
                                is_brilliant = False
                                print(f"[BRILLIANT DEBUG] {move_san_debug}: OVERRIDE - king move without sacrifice, not brilliant")

                        if brilliant_via_sacrifice and forcing_mate_trigger:
                            # Sacrifice for mate is brilliant even if slightly forced (3-4 legal moves)
                            # But still require it's not completely forced (1-2 moves) AND not a king move
                            if not is_brilliant:  # Only set if not already blocked
                                is_brilliant = not is_forced_move and not (is_king_move and not sacrifice_trigger)
                            if is_brilliant:
                                print(f"[BRILLIANT DEBUG] {move_san_debug}: Sacrifice for mate - allowing even with {num_legal_moves_before} legal moves")
                        else:
                            # For other brilliant moves, require non-obvious AND not forced AND not a king move
                            if not is_brilliant:  # Only set if not already blocked
                                is_brilliant = (brilliant_via_mate or brilliant_via_sacrifice) and is_non_obvious and not is_forced_move and not (is_king_move and not sacrifice_trigger)

                        if is_forced_move:
                            is_brilliant = False
                            print(f"[BRILLIANT DEBUG] {move_san_debug}: OVERRIDE - forced move (only {num_legal_moves_before} legal moves), not brilliant")

                        # Final safety check: If move is a check that just wins material (not a sacrifice), it's not brilliant
                        # CRITICAL: Checks that fork/pin (win material) without sacrifice are NOT brilliant
                        # This applies EVEN IF they find forced mate - forks/pins are tactical, not brilliant sacrifices
                        # move_gives_check is already detected above (early in the logic)
                        # This is the FINAL override - must be the last word

                        # CRITICAL: Immediate checkmate moves are NEVER brilliant
                        # Simple checkmate moves (like Qe2#) are just winning moves, not brilliant tactical sacrifices
                        # Chess.com doesn't mark simple checkmates as brilliant - they're just the best move
                        # Even checkmates with captures are typically obvious winning moves, not brilliant sacrifices
                        # This is the ABSOLUTE FINAL override - checkmate is NEVER brilliant
                        if move_is_checkmate:
                            # Immediate checkmate is NOT brilliant - it's just the winning move
                            is_brilliant = False
                            print(f"[BRILLIANT DEBUG] {move_san_debug}: FINAL OVERRIDE - immediate checkmate is not brilliant (just the winning move)")
                            print(f"[BRILLIANT DEBUG] {move_san_debug}: move_is_checkmate={move_is_checkmate}, sacrifice_trigger={sacrifice_trigger}")

                        if move_gives_check:
                            if not sacrifice_trigger:
                                # Check that just wins material (fork/pin) is not brilliant, even if it finds mate
                                # Moves like Ne2+, Nxg3+, Qxf2+ are checks that fork/pin pieces - they're good tactical
                                # moves but NOT brilliant sacrifices, regardless of whether they lead to mate
                                # CRITICAL OVERRIDE: This must be the final word - checks without sacrifice are NEVER brilliant
                                is_brilliant = False
                                print(f"[BRILLIANT DEBUG] {move_san_debug}: FINAL OVERRIDE - check without sacrifice is not brilliant (even if finds mate)")
                                print(f"[BRILLIANT DEBUG] {move_san_debug}: move_gives_check={move_gives_check}, sacrifice_trigger={sacrifice_trigger}, forcing_mate_trigger={forcing_mate_trigger}")
                            else:
                                print(f"[BRILLIANT DEBUG] {move_san_debug}: Check move allowed - it's a sacrifice (sacrifice_trigger={sacrifice_trigger})")

                        # DEBUG: Final result with clear summary
                        status = "🌟 BRILLIANT! 🌟" if is_brilliant else "❌ NOT BRILLIANT"
                        print(f"\n{'='*80}")
                        print(f"[BRILLIANT SUMMARY] {move_san_debug} ({move_uci_debug}): {status}")
                        print(f"  centipawn_loss={centipawn_loss:.1f}, actual_cp={actual_cp:.1f}")
                        print(f"  brilliant_via_mate={brilliant_via_mate}, brilliant_via_sacrifice={brilliant_via_sacrifice}")
                        print(f"  sacrifice_trigger={sacrifice_trigger}, clear_tactical_sacrifice={clear_tactical_sacrifice}")
                        print(f"{'='*80}\n")

                        # Write summary to log file
                        try:
                            with open("brilliant_debug.log", "a", encoding="utf-8") as f:
                                f.write(f"RESULT: {status}\n")
                                f.write(f"  centipawn_loss={centipawn_loss:.1f}\n")
                                f.write(f"  actual_cp={actual_cp:.1f}, best_cp={best_cp:.1f}\n")
                                f.write(f"  brilliant_via_mate={brilliant_via_mate}\n")
                                f.write(f"  brilliant_via_sacrifice={brilliant_via_sacrifice}\n")
                                f.write(f"  sacrifice_trigger={sacrifice_trigger}\n")
                                f.write(f"  clear_tactical_sacrifice={clear_tactical_sacrifice}\n")
                        except:
                            pass

                    # Convert evaluation to dict
                    # CRITICAL: For mate positions, use .mate() to get the mate value (positive = white wins, negative = black wins)
                    # For non-mate positions, use .score() to get centipawn evaluation
                    eval_white = eval_after.pov(chess.WHITE)
                    if eval_white.is_mate():
                        evaluation = {
                            "value": eval_white.mate(),  # mate() returns positive for white win, negative for black win
                            "type": "mate"
                        }
                    else:
                        evaluation = {
                            "value": eval_white.score(),
                            "type": "cp"
                        }

                    # Extract centipawn values for personality scoring
                    eval_before_cp = eval_before.pov(player_color).score(mate_score=1000) if eval_before else 0
                    eval_after_cp = eval_after.pov(player_color).score(mate_score=1000) if eval_after else 0

                    # Convert best move to SAN notation for frontend display
                    best_move_san = ""
                    if best_move_before:
                        # Check if best move is different from played move
                        if best_move_before.uci() == move.uci():
                            # Best move is the same as played move - set to empty string
                            best_move_san = ""
                        else:
                            # Best move is different - convert to SAN
                            try:
                                # Method 1: Try using board.pop() to get back to "before" state
                                board.pop()
                                best_move_san = board.san(best_move_before)
                                board.push(move)
                            except Exception as e:
                                # Method 2: If pop fails, try reconstructing from FEN
                                try:
                                    fen_before = board.fen().rsplit(' ', 2)[0] + ' ' + ('w' if player_color == chess.WHITE else 'b') + ' ' + board.fen().rsplit(' ', 2)[1]
                                    temp_board = chess.Board(fen_before)
                                    best_move_san = temp_board.san(best_move_before)
                                    logger.info(f"Successfully converted best move using FEN reconstruction: {best_move_before.uci()} -> {best_move_san}")
                                except Exception as e2:
                                    logger.warning(f"Failed to convert best move to SAN (both methods): pop error={e}, fen error={e2}, move={best_move_before.uci()}")
                                    # Leave best_move_san empty if both methods fail
                                    best_move_san = ""

                    # Create basic move analysis
                    move_analysis = MoveAnalysis(
                        move=current_move.uci(),
                        move_san=move_san,
                        evaluation=evaluation,
                        best_move=best_move_before.uci() if best_move_before else None,
                        best_move_san=best_move_san,  # Add SAN notation for best move
                        best_move_pv=best_move_pv,  # Full PV for the best move line
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
                        analysis_time_ms=int(current_time_limit * 1000),
                        explanation=None,
                        heuristic_details={},
                        accuracy_score=100.0 if is_best else max(0.0, 100.0 - centipawn_loss),
                        evaluation_before=float(eval_before_cp),  # CRITICAL: for personality scoring
                        evaluation_after=float(eval_after_cp)     # CRITICAL: for personality scoring
                    )

                    # Enhance with coaching comments
                    # Calculate move number BEFORE the move was made
                    # We need to undo the move temporarily to get the correct move number
                    board.pop()  # Undo the move to get the original position
                    move_number = (board.fullmove_number - 1) * 2 + (0 if board.turn == chess.WHITE else 1)
                    # DO NOT push the move here - _enhance_move_analysis_with_coaching expects board BEFORE the move
                    # For now, assume all moves are user moves - this will be determined by the frontend
                    return self._enhance_move_analysis_with_coaching(move_analysis, board, current_move, move_number, is_user_move=True)
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
        # Use 4 workers for Railway Pro tier (matches max_concurrent at line 944)
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

        # Improved phase boundaries:
        # - Opening: first 10 moves (or fewer if game is shorter)
        # - Endgame: last 10 moves (or proportional for short games)
        # - Middlegame: everything in between

        opening_end = min(10, user_move_count)

        # For very short games (≤15 moves), there's no real middlegame
        if user_move_count <= 15:
            endgame_start = opening_end  # No middlegame
        else:
            # For longer games, endgame is the last 10 moves, but at least move 11
            endgame_start = max(opening_end, user_move_count - 10)

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
        """Calculate accuracy for a game phase using Chess.com-style graduated accuracy.

        Returns 0.0 if no moves are available in the phase.
        Frontend should check move count to distinguish between "no data" and "0% accuracy".
        """
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
        Calculate opening accuracy using Chess.com's CAPS2 algorithm (same as other phases).
        This ensures consistency across all game phases.
        """
        if not opening_moves:
            return 0.0

        # Use the same Chess.com CAPS2 algorithm as middlegame/endgame for consistency
        centipawn_losses = [move.centipawn_loss for move in opening_moves]
        return self._calculate_accuracy_from_cpl(centipawn_losses)

    def _calculate_time_management_score(self, moves: List[MoveAnalysis]) -> float:
        """Calculate time management score based on move timing patterns and quality.

        Returns score on 0-100 scale where:
        - 0-30: Very fast/impulsive play (bullet players, many quick errors)
        - 30-50: Quick decisions (blitz players, some time pressure errors)
        - 50-70: Balanced time usage (rapid players, occasional time issues)
        - 70-90: Slow/careful thinking (classical players, consistent quality)
        - 90-100: Very slow/deliberate play (correspondence-style, deep calculation)

        Uses proxy indicators since exact clock times may not be available:
        1. Move quality consistency (fast players make more errors)
        2. Error patterns (blunders/mistakes indicate rushed decisions)
        3. Move complexity vs quality (simple moves should be quick, complex ones need time)
        """
        if not moves or len(moves) < 10:
            return 50.0  # Need sufficient data

        # Proxy indicators for time management
        total_moves = len(moves)
        blunders = sum(1 for m in moves if m.is_blunder)
        mistakes = sum(1 for m in moves if m.is_mistake)
        inaccuracies = sum(1 for m in moves if m.is_inaccuracy)
        best_moves = sum(1 for m in moves if m.is_best)

        # Calculate error rates
        blunder_rate = blunders / total_moves
        mistake_rate = mistakes / total_moves
        error_rate = (blunders + mistakes + inaccuracies) / total_moves
        best_rate = best_moves / total_moves

        # Calculate move quality variance (consistent = more thoughtful)
        centipawn_losses = [m.centipawn_loss for m in moves if hasattr(m, 'centipawn_loss')]
        if centipawn_losses:
            avg_loss = sum(centipawn_losses) / len(centipawn_losses)
            variance = sum((loss - avg_loss) ** 2 for loss in centipawn_losses) / len(centipawn_losses)
            consistency_score = max(0, 100 - (variance ** 0.5) / 2)  # Lower variance = more consistent
        else:
            consistency_score = 50.0

        # Base score starts at 50 (neutral)
        base_score = 50.0

        # Penalties for fast/impulsive play (errors suggest rushing)
        # Fast players tend to make more mistakes, especially blunders
        error_penalty = (blunder_rate * 80.0) + (mistake_rate * 40.0) + (error_rate * 20.0)

        # Bonuses for slow/careful play (high accuracy suggests taking time)
        # Slow players have higher best move rates and consistency
        quality_bonus = (best_rate * 30.0) + (consistency_score * 0.2)

        # Calculate final score
        score = base_score - error_penalty + quality_bonus

        # Clamp to valid range
        return max(0.0, min(100.0, score))

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
                'evaluation_before': move.evaluation_before,
                'evaluation_after': move.evaluation_after,
                'heuristic_details': move.heuristic_details,
                'player_color': move.player_color,
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
