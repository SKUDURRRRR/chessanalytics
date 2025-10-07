"""
Advanced Chess Analysis Module

This module provides sophisticated tactical and positional analysis capabilities
for generating detailed coaching insights.
"""

import chess
import chess.engine
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass
from enum import Enum


class TacticalPattern(Enum):
    """Tactical patterns that can be identified in chess positions."""
    PIN = "pin"
    FORK = "fork"
    SKEWER = "skewer"
    DISCOVERED_ATTACK = "discovered_attack"
    DOUBLE_ATTACK = "double_attack"
    DEFLECTION = "deflection"
    DECOY = "decoy"
    OVERLOADING = "overloading"
    INTERFERENCE = "interference"
    ZWISCHENZUG = "zwischenzug"
    SACRIFICE = "sacrifice"
    WINDMILL = "windmill"
    CLEARANCE = "clearance"


class PositionalConcept(Enum):
    """Positional concepts in chess."""
    CENTER_CONTROL = "center_control"
    PIECE_ACTIVITY = "piece_activity"
    KING_SAFETY = "king_safety"
    PAWN_STRUCTURE = "pawn_structure"
    SPACE_ADVANTAGE = "space_advantage"
    PIECE_COORDINATION = "piece_coordination"
    WEAK_SQUARES = "weak_squares"
    OUTPOST = "outpost"
    PAWN_BREAKS = "pawn_breaks"
    PIECE_PLACEMENT = "piece_placement"
    DEVELOPMENT = "development"
    CASTLING = "castling"
    PAWN_MAJORITY = "pawn_majority"
    BACKWARD_PAWN = "backward_pawn"
    ISOLATED_PAWN = "isolated_pawn"
    DOUBLED_PAWN = "doubled_pawn"


@dataclass
class TacticalAnalysis:
    """Result of tactical analysis for a move."""
    patterns_found: List[TacticalPattern]
    patterns_missed: List[TacticalPattern]
    tactical_opportunities: List[str]
    tactical_threats: List[str]
    material_balance: int
    piece_activity_score: int
    king_safety_score: int


@dataclass
class PositionalAnalysis:
    """Result of positional analysis for a move."""
    concepts_improved: List[PositionalConcept]
    concepts_weakened: List[PositionalConcept]
    positional_advantages: List[str]
    positional_weaknesses: List[str]
    space_advantage: int
    piece_coordination_score: int
    pawn_structure_score: int


class AdvancedChessAnalyzer:
    """Advanced chess analysis engine for tactical and positional insights."""
    
    def __init__(self):
        self.piece_values = {
            chess.PAWN: 1,
            chess.KNIGHT: 3,
            chess.BISHOP: 3,
            chess.ROOK: 5,
            chess.QUEEN: 9,
            chess.KING: 0
        }
        
        self.center_squares = {
            chess.D4, chess.D5, chess.E4, chess.E5,
            chess.C3, chess.C6, chess.D3, chess.D6,
            chess.E3, chess.E6, chess.F3, chess.F6
        }
        
        self.weak_square_patterns = {
            # Squares that become weak after pawn moves
            'e4_weak': {chess.D3, chess.F3},
            'e5_weak': {chess.D6, chess.F6},
            'd4_weak': {chess.C3, chess.E3},
            'd5_weak': {chess.C6, chess.E6},
        }

    def analyze_tactical_patterns(self, board: chess.Board, move: chess.Move) -> TacticalAnalysis:
        """Analyze tactical patterns in the position after the move."""
        patterns_found = []
        patterns_missed = []
        tactical_opportunities = []
        tactical_threats = []
        
        # Check for pins
        if self._creates_pin(board, move):
            patterns_found.append(TacticalPattern.PIN)
            tactical_opportunities.append("This move creates a pin, restricting your opponent's piece movement.")
        elif self._breaks_pin(board, move):
            patterns_found.append(TacticalPattern.PIN)
            tactical_opportunities.append("This move breaks a pin, freeing your piece.")
        
        # Check for forks
        if self._creates_fork(board, move):
            patterns_found.append(TacticalPattern.FORK)
            tactical_opportunities.append("This move creates a fork, attacking multiple pieces simultaneously.")
        elif self._prevents_fork(board, move):
            patterns_found.append(TacticalPattern.FORK)
            tactical_opportunities.append("This move prevents a fork, protecting your pieces.")
        
        # Check for skewers
        if self._creates_skewer(board, move):
            patterns_found.append(TacticalPattern.SKEWER)
            tactical_opportunities.append("This move creates a skewer, forcing your opponent to move a valuable piece.")
        
        # Check for discovered attacks
        if self._creates_discovered_attack(board, move):
            patterns_found.append(TacticalPattern.DISCOVERED_ATTACK)
            tactical_opportunities.append("This move creates a discovered attack, revealing a threat from another piece.")
        
        # Check for double attacks
        if self._creates_double_attack(board, move):
            patterns_found.append(TacticalPattern.DOUBLE_ATTACK)
            tactical_opportunities.append("This move creates a double attack, threatening multiple targets.")
        
        # Check for sacrifices
        if self._is_sacrifice(board, move):
            patterns_found.append(TacticalPattern.SACRIFICE)
            tactical_opportunities.append("This move involves a sacrifice, giving up material for positional or tactical gain.")
        
        # Check for missed tactical opportunities
        missed_patterns = self._find_missed_tactical_patterns(board, move)
        patterns_missed.extend(missed_patterns)
        
        # Calculate material balance
        material_balance = self._calculate_material_balance(board)
        
        # Calculate piece activity score
        piece_activity_score = self._calculate_piece_activity(board)
        
        # Calculate king safety score
        king_safety_score = self._calculate_king_safety(board)
        
        return TacticalAnalysis(
            patterns_found=patterns_found,
            patterns_missed=patterns_missed,
            tactical_opportunities=tactical_opportunities,
            tactical_threats=tactical_threats,
            material_balance=material_balance,
            piece_activity_score=piece_activity_score,
            king_safety_score=king_safety_score
        )

    def analyze_positional_concepts(self, board: chess.Board, move: chess.Move) -> PositionalAnalysis:
        """Analyze positional concepts in the position after the move."""
        concepts_improved = []
        concepts_weakened = []
        positional_advantages = []
        positional_weaknesses = []
        
        # Check center control
        if self._improves_center_control(board, move):
            concepts_improved.append(PositionalConcept.CENTER_CONTROL)
            positional_advantages.append("This move improves central control, a fundamental positional principle.")
        elif self._weakens_center_control(board, move):
            concepts_weakened.append(PositionalConcept.CENTER_CONTROL)
            positional_weaknesses.append("This move weakens central control, giving your opponent more space.")
        
        # Check piece activity
        if self._improves_piece_activity(board, move):
            concepts_improved.append(PositionalConcept.PIECE_ACTIVITY)
            positional_advantages.append("This move improves piece activity, making your pieces more effective.")
        elif self._weakens_piece_activity(board, move):
            concepts_weakened.append(PositionalConcept.PIECE_ACTIVITY)
            positional_weaknesses.append("This move reduces piece activity, limiting your options.")
        
        # Check king safety
        if self._improves_king_safety(board, move):
            concepts_improved.append(PositionalConcept.KING_SAFETY)
            positional_advantages.append("This move improves king safety, protecting your most important piece.")
        elif self._weakens_king_safety(board, move):
            concepts_weakened.append(PositionalConcept.KING_SAFETY)
            positional_weaknesses.append("This move weakens king safety, making your king vulnerable.")
        
        # Check pawn structure
        if self._improves_pawn_structure(board, move):
            concepts_improved.append(PositionalConcept.PAWN_STRUCTURE)
            positional_advantages.append("This move improves pawn structure, creating a solid foundation.")
        elif self._weakens_pawn_structure(board, move):
            concepts_weakened.append(PositionalConcept.PAWN_STRUCTURE)
            positional_weaknesses.append("This move weakens pawn structure, creating long-term weaknesses.")
        
        # Check piece coordination
        if self._improves_piece_coordination(board, move):
            concepts_improved.append(PositionalConcept.PIECE_COORDINATION)
            positional_advantages.append("This move improves piece coordination, making your pieces work together.")
        elif self._weakens_piece_coordination(board, move):
            concepts_weakened.append(PositionalConcept.PIECE_COORDINATION)
            positional_weaknesses.append("This move weakens piece coordination, reducing piece harmony.")
        
        # Check for weak squares
        weak_squares = self._identify_weak_squares(board, move)
        if weak_squares:
            concepts_weakened.append(PositionalConcept.WEAK_SQUARES)
            positional_weaknesses.append(f"This move creates weak squares: {', '.join(weak_squares)}")
        
        # Calculate space advantage
        space_advantage = self._calculate_space_advantage(board)
        
        # Calculate piece coordination score
        piece_coordination_score = self._calculate_piece_coordination(board)
        
        # Calculate pawn structure score
        pawn_structure_score = self._calculate_pawn_structure_score(board)
        
        return PositionalAnalysis(
            concepts_improved=concepts_improved,
            concepts_weakened=concepts_weakened,
            positional_advantages=positional_advantages,
            positional_weaknesses=positional_weaknesses,
            space_advantage=space_advantage,
            piece_coordination_score=piece_coordination_score,
            pawn_structure_score=pawn_structure_score
        )

    def _creates_pin(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move creates a pin."""
        # This is a simplified implementation
        # In practice, you'd need to check if the moved piece pins an opponent piece to their king
        return False

    def _breaks_pin(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move breaks a pin."""
        # This is a simplified implementation
        return False

    def _creates_fork(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move creates a fork."""
        # This is a simplified implementation
        # In practice, you'd check if the moved piece attacks multiple opponent pieces
        return False

    def _prevents_fork(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move prevents a fork."""
        # This is a simplified implementation
        return False

    def _creates_skewer(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move creates a skewer."""
        # This is a simplified implementation
        return False

    def _creates_discovered_attack(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move creates a discovered attack."""
        # This is a simplified implementation
        return False

    def _creates_double_attack(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move creates a double attack."""
        # This is a simplified implementation
        return False

    def _is_sacrifice(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move involves a sacrifice."""
        if not board.is_capture(move):
            return False
        
        captured_piece = board.piece_at(move.to_square)
        moving_piece = board.piece_at(move.from_square)
        
        if not captured_piece or not moving_piece:
            return False
        
        captured_value = self.piece_values.get(captured_piece.piece_type, 0)
        moving_value = self.piece_values.get(moving_piece.piece_type, 0)
        
        return moving_value > captured_value

    def _find_missed_tactical_patterns(self, board: chess.Board, move: chess.Move) -> List[TacticalPattern]:
        """Find tactical patterns that were missed."""
        missed_patterns = []
        
        # This is a simplified implementation
        # In practice, you'd analyze the position to find tactical opportunities that weren't taken
        
        return missed_patterns

    def _calculate_material_balance(self, board: chess.Board) -> int:
        """Calculate material balance (positive for white, negative for black)."""
        balance = 0
        
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece:
                value = self.piece_values.get(piece.piece_type, 0)
                if piece.color == chess.WHITE:
                    balance += value
                else:
                    balance -= value
        
        return balance

    def _calculate_piece_activity(self, board: chess.Board) -> int:
        """Calculate piece activity score."""
        activity = 0
        
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece:
                # Count legal moves for each piece
                legal_moves = len([m for m in board.legal_moves if m.from_square == square])
                activity += legal_moves
        
        return activity

    def _calculate_king_safety(self, board: chess.Board) -> int:
        """Calculate king safety score."""
        # This is a simplified implementation
        # In practice, you'd analyze pawn structure around the king, piece attacks, etc.
        return 50  # Neutral score

    def _improves_center_control(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move improves center control."""
        return move.to_square in self.center_squares

    def _weakens_center_control(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move weakens center control."""
        return move.from_square in self.center_squares and move.to_square not in self.center_squares

    def _improves_piece_activity(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move improves piece activity."""
        # This is a simplified implementation
        return True

    def _weakens_piece_activity(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move weakens piece activity."""
        # This is a simplified implementation
        return False

    def _improves_king_safety(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move improves king safety."""
        # Check for castling
        return move == chess.Move.from_uci("e1g1") or move == chess.Move.from_uci("e8g8")

    def _weakens_king_safety(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move weakens king safety."""
        # This is a simplified implementation
        return False

    def _improves_pawn_structure(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move improves pawn structure."""
        piece = board.piece_at(move.from_square)
        return piece and piece.piece_type == chess.PAWN

    def _weakens_pawn_structure(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move weakens pawn structure."""
        # This is a simplified implementation
        return False

    def _improves_piece_coordination(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move improves piece coordination."""
        # This is a simplified implementation
        return True

    def _weakens_piece_coordination(self, board: chess.Board, move: chess.Move) -> bool:
        """Check if the move weakens piece coordination."""
        # This is a simplified implementation
        return False

    def _identify_weak_squares(self, board: chess.Board, move: chess.Move) -> List[str]:
        """Identify weak squares created by the move."""
        weak_squares = []
        
        # This is a simplified implementation
        # In practice, you'd analyze pawn structure and piece coverage
        
        return weak_squares

    def _calculate_space_advantage(self, board: chess.Board) -> int:
        """Calculate space advantage score."""
        # This is a simplified implementation
        return 0

    def _calculate_piece_coordination(self, board: chess.Board) -> int:
        """Calculate piece coordination score."""
        # This is a simplified implementation
        return 50

    def _calculate_pawn_structure_score(self, board: chess.Board) -> int:
        """Calculate pawn structure score."""
        # This is a simplified implementation
        return 50
