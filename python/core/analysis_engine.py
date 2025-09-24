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
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
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

# Heuristic evaluation constants tuned for basic analysis
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
BASIC_BEST_THRESHOLD = 18
BASIC_INACCURACY_THRESHOLD = 80
BASIC_MISTAKE_THRESHOLD = 180
BASIC_BLUNDER_THRESHOLD = 280
SEE_MATERIAL_LOSS_TRIGGER = -40
KING_SAFETY_DROP_TRIGGER = 25
MOBILITY_DROP_TRIGGER = -2
BASIC_ENGINE_PROBE_LIMIT = 12
BASIC_ENGINE_PROBE_TIME = 0.08
BASIC_ENGINE_PROBE_MULTIPV = 2

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
        """Configuration optimized for basic analysis (fast, heuristic-only)."""
        return cls(
            analysis_type=AnalysisType.BASIC,  # Use heuristic analysis, not Stockfish
            depth=0,  # No depth needed for heuristic analysis
            skill_level=0,  # Not used for heuristic analysis
            time_limit=0.01,  # 10ms per position (very fast)
            use_opening_book=False,  # Not needed for heuristic
            use_endgame_tablebase=False,  # Not needed for heuristic
            parallel_analysis=True,  # Enable parallel processing for speed
            max_concurrent=8  # More concurrent processes for heuristic analysis
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
    explanation: str = ""
    heuristic_details: Dict[str, Any] = field(default_factory=dict)

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
        self._basic_eval_cache: Dict[str, Tuple[int, Dict[str, Any]]] = {}
        self._basic_move_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._basic_probe_cache: Dict[str, Dict[str, Any]] = {}
        
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
        '''Heuristic evaluation with feature breakdown for basic analysis.'''
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
                    'Skill Level': min(self.config.skill_level, 10),
                    'Threads': 1,
                    'Hash': 32,
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
            'analysis_type': 'basic',
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

        is_blunder = centipawn_loss >= BASIC_BLUNDER_THRESHOLD and (
            loss_from_best_gap or
            see_score <= SEE_MATERIAL_LOSS_TRIGGER or
            king_safety_drop >= KING_SAFETY_DROP_TRIGGER or
            bool(new_hanging)
        )
        is_mistake = not is_blunder and centipawn_loss >= BASIC_MISTAKE_THRESHOLD
        is_inaccuracy = not is_blunder and not is_mistake and centipawn_loss >= BASIC_INACCURACY_THRESHOLD
        played_is_best_candidate = bool(best_candidate and best_candidate['uci'] == move.uci())
        is_best = played_is_best_candidate or (centipawn_loss <= BASIC_BEST_THRESHOLD and delta >= -BASIC_BEST_THRESHOLD / 2)
        if is_blunder or is_mistake or is_inaccuracy:
            is_best = False

        explanation_parts = []
        if centipawn_loss > 0 and not is_best:
            explanation_parts.append(f"Costs roughly {int(centipawn_loss)} cp.")
        if see_score <= SEE_MATERIAL_LOSS_TRIGGER and is_capture:
            explanation_parts.append(f"Capture on {chess.square_name(move.to_square)} drops material (SEE {int(see_score)} cp).")
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
            explanation_parts.append(f"Better was {best_alternative['san']} ({int(best_alternative['score'])} cp).")
        if not explanation_parts:
            if delta > 0:
                explanation_parts.append(f"Improves evaluation by {int(delta)} cp.")
            else:
                explanation_parts.append("Keeps evaluation balanced.")
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

        return MoveAnalysis(
            move=move.uci(),
            move_san=move_san,
            evaluation=evaluation_payload,
            best_move=best_move_uci,
            is_best=is_best,
            is_blunder=is_blunder,
            is_mistake=is_mistake,
            is_inaccuracy=is_inaccuracy,
            centipawn_loss=float(centipawn_loss),
            depth_analyzed=0,
            analysis_time_ms=0,
            explanation=explanation,
            heuristic_details=heuristic_details
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
                    'UCI_Elo': 2000,  # Lower ELO for faster analysis
                    'Threads': 1,  # Single thread to prevent resource conflicts
                    'Hash': 32  # Smaller hash to reduce memory usage
                })
                
                # Use time limit for faster analysis regardless of depth
                # 0.5 seconds per position should be sufficient for skill level 8
                time_limit = 0.5
                
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
                    analysis_time_ms=0,
                    explanation="",
                    heuristic_details={}
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
        
        print("\nðŸŽ‰ Analysis engine testing complete!")
    
    asyncio.run(test_analysis_engine())


