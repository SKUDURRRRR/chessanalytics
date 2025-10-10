"""
Position-Specific Chess Analysis Engine

This module provides detailed analysis of chess positions, detecting specific tactical patterns,
positional factors, and move impacts to generate contextual explanations.
"""

import chess
import chess.engine
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Set, Any
from enum import Enum
import math


class TacticalPattern(Enum):
    """Specific tactical patterns that can be detected."""
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
    MATE_THREAT = "mate_threat"
    CHECK = "check"
    CAPTURE = "capture"
    PROMOTION = "promotion"


class PositionalFactor(Enum):
    """Positional factors that affect move evaluation."""
    KING_SAFETY = "king_safety"
    PIECE_ACTIVITY = "piece_activity"
    PAWN_STRUCTURE = "pawn_structure"
    CENTER_CONTROL = "center_control"
    SPACE_ADVANTAGE = "space_advantage"
    PIECE_COORDINATION = "piece_coordination"
    WEAK_SQUARES = "weak_squares"
    OUTPOST = "outpost"
    PAWN_BREAKS = "pawn_breaks"
    PIECE_PLACEMENT = "piece_placement"


@dataclass
class TacticalPatternInfo:
    """Information about a detected tactical pattern."""
    pattern: TacticalPattern
    pieces_involved: List[chess.Square]
    target_squares: List[chess.Square]
    description: str
    impact_score: int
    is_threat: bool = True
    is_defensive: bool = False


@dataclass
class PositionalFactorInfo:
    """Information about a positional factor."""
    factor: PositionalFactor
    score: int
    description: str
    affected_squares: List[chess.Square] = field(default_factory=list)
    improvement: bool = False
    deterioration: bool = False


@dataclass
class MoveImpact:
    """Detailed analysis of a move's impact on the position."""
    # Tactical impacts
    tactical_patterns: List[TacticalPatternInfo] = field(default_factory=list)
    material_change: int = 0
    threats_created: List[str] = field(default_factory=list)
    threats_prevented: List[str] = field(default_factory=list)
    
    # Positional impacts
    positional_changes: List[PositionalFactorInfo] = field(default_factory=list)
    king_safety_change: int = 0
    piece_activity_change: int = 0
    center_control_change: int = 0
    
    # Evaluation impact
    evaluation_change: int = 0
    forcing_sequence: bool = False
    check_delivered: bool = False
    mate_threat: bool = False
    
    # Specific move effects
    pieces_attacked: List[chess.Square] = field(default_factory=list)
    pieces_defended: List[chess.Square] = field(default_factory=list)
    squares_controlled: List[chess.Square] = field(default_factory=list)
    lines_opened: List[str] = field(default_factory=list)
    lines_closed: List[str] = field(default_factory=list)


class PositionAnalyzer:
    """Analyzes chess positions for tactical patterns and positional factors."""
    
    def __init__(self):
        self.piece_values = {
            chess.PAWN: 100,
            chess.KNIGHT: 320,
            chess.BISHOP: 330,
            chess.ROOK: 500,
            chess.QUEEN: 900,
            chess.KING: 0
        }
    
    def analyze_move_impact(self, board_before: chess.Board, board_after: chess.Board, 
                          move: chess.Move, evaluation_before: int, evaluation_after: int) -> MoveImpact:
        """Analyze the specific impact of a move on the position."""
        impact = MoveImpact()
        
        # Calculate evaluation change
        impact.evaluation_change = evaluation_after - evaluation_before
        
        # Analyze tactical patterns
        impact.tactical_patterns = self._detect_tactical_patterns(board_after, move)
        
        # Analyze material changes
        impact.material_change = self._calculate_material_change(board_before, board_after, move)
        
        # Analyze positional changes
        impact.positional_changes = self._analyze_positional_changes(board_before, board_after, move)
        
        # Analyze specific move effects
        impact.pieces_attacked = self._get_attacked_pieces(board_after, move)
        impact.pieces_defended = self._get_defended_pieces(board_after, move)
        impact.squares_controlled = self._get_controlled_squares(board_after, move)
        
        # Check for forcing moves
        impact.check_delivered = board_after.is_check()
        impact.mate_threat = self._detect_mate_threat(board_after)
        impact.forcing_sequence = impact.check_delivered or impact.mate_threat
        
        # Generate threat descriptions
        impact.threats_created = self._generate_threat_descriptions(impact.tactical_patterns, board_after)
        
        return impact
    
    def _detect_tactical_patterns(self, board: chess.Board, move: chess.Move) -> List[TacticalPatternInfo]:
        """Detect specific tactical patterns created by the move."""
        patterns = []
        
        # Check for pins
        pins = self._detect_pins(board, move)
        patterns.extend(pins)
        
        # Check for forks
        forks = self._detect_forks(board, move)
        patterns.extend(forks)
        
        # Check for skewers
        skewers = self._detect_skewers(board, move)
        patterns.extend(skewers)
        
        # Check for discovered attacks
        discovered = self._detect_discovered_attacks(board, move)
        patterns.extend(discovered)
        
        # Check for double attacks
        double_attacks = self._detect_double_attacks(board, move)
        patterns.extend(double_attacks)
        
        # Check for mate threats
        mate_threats = self._detect_mate_threats(board, move)
        patterns.extend(mate_threats)
        
        return patterns
    
    def _detect_pins(self, board: chess.Board, move: chess.Move) -> List[TacticalPatternInfo]:
        """Detect pins created by the move."""
        pins = []
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return pins
        
        # Check if the moved piece is pinning something
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.color != moved_piece.color:
                # Check if this piece is pinned by the moved piece
                if self._is_pinned(board, square, moved_piece.color):
                    pins.append(TacticalPatternInfo(
                        pattern=TacticalPattern.PIN,
                        pieces_involved=[move.to_square, square],
                        target_squares=[square],
                        description=f"{chess.piece_name(moved_piece.piece_type).title()} on {chess.square_name(move.to_square)} pins {chess.piece_name(piece.piece_type)} on {chess.square_name(square)}",
                        impact_score=self.piece_values[piece.piece_type]
                    ))
        
        return pins
    
    def _detect_forks(self, board: chess.Board, move: chess.Move) -> List[TacticalPatternInfo]:
        """Detect forks created by the move."""
        forks = []
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return forks
        
        # Check if the moved piece is attacking multiple enemy pieces
        attacked_pieces = []
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.color != moved_piece.color:
                if board.is_attacked_by(moved_piece.color, square):
                    attacked_pieces.append((square, piece))
        
        if len(attacked_pieces) >= 2:
            total_value = sum(self.piece_values[piece.piece_type] for _, piece in attacked_pieces)
            pieces_squares = [square for square, _ in attacked_pieces]
            pieces_names = [chess.piece_name(piece.piece_type) for _, piece in attacked_pieces]
            
            forks.append(TacticalPatternInfo(
                pattern=TacticalPattern.FORK,
                pieces_involved=[move.to_square] + pieces_squares,
                target_squares=pieces_squares,
                description=f"{chess.piece_name(moved_piece.piece_type).title()} on {chess.square_name(move.to_square)} forks {', '.join(pieces_names)}",
                impact_score=total_value
            ))
        
        return forks
    
    def _detect_skewers(self, board: chess.Board, move: chess.Move) -> List[TacticalPatternInfo]:
        """Detect skewers created by the move."""
        skewers = []
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return skewers
        
        # Check for skewers along the same line
        directions = [8, -8, 1, -1, 9, 7, -7, -9]  # N, S, E, W, NE, NW, SE, SW
        for direction in directions:
            line_pieces = self._get_pieces_on_line(board, move.to_square, direction)
            if len(line_pieces) >= 2:
                # Check if we can skewer (attack through a piece)
                enemy_pieces = [p for p in line_pieces if board.piece_at(p) and board.piece_at(p).color != moved_piece.color]
                if len(enemy_pieces) >= 2:
                    # Check if the first piece is less valuable than the second
                    first_piece = board.piece_at(enemy_pieces[0])
                    second_piece = board.piece_at(enemy_pieces[1])
                    if first_piece and second_piece:
                        if self.piece_values[first_piece.piece_type] < self.piece_values[second_piece.piece_type]:
                            skewers.append(TacticalPatternInfo(
                                pattern=TacticalPattern.SKEWER,
                                pieces_involved=[move.to_square, enemy_pieces[0], enemy_pieces[1]],
                                target_squares=[enemy_pieces[1]],
                                description=f"{chess.piece_name(moved_piece.piece_type).title()} on {chess.square_name(move.to_square)} skewers {chess.piece_name(first_piece.piece_type)} and {chess.piece_name(second_piece.piece_type)}",
                                impact_score=self.piece_values[second_piece.piece_type]
                            ))
        
        return skewers
    
    def _detect_discovered_attacks(self, board: chess.Board, move: chess.Move) -> List[TacticalPatternInfo]:
        """Detect discovered attacks created by the move."""
        discovered = []
        
        # Only check for discovered attacks if the move is not a capture
        if board.piece_at(move.to_square):
            return discovered
        
        # Check if moving this piece reveals an attack from another piece
        # This is a simplified implementation - in practice, you'd need more sophisticated analysis
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return discovered
        
        # Look for pieces that might have been blocked by the moved piece
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.color == moved_piece.color and square != move.to_square:
                # Check if this piece can attack something valuable
                for target_square in chess.SQUARES:
                    target_piece = board.piece_at(target_square)
                    if target_piece and target_piece.color != piece.color:
                        if board.is_attacked_by(piece.color, target_square):
                            # Only count as discovered attack if the target is valuable
                            if self.piece_values[target_piece.piece_type] >= 300:  # Knight or better
                                discovered.append(TacticalPatternInfo(
                                    pattern=TacticalPattern.DISCOVERED_ATTACK,
                                    pieces_involved=[move.to_square, square, target_square],
                                    target_squares=[target_square],
                                    description=f"Moving {chess.piece_name(moved_piece.piece_type)} discovers attack from {chess.piece_name(piece.piece_type)} on {chess.square_name(square)} to {chess.square_name(target_square)}",
                                    impact_score=self.piece_values[target_piece.piece_type]
                                ))
                                break  # Only count one discovered attack per piece
        
        return discovered
    
    def _detect_double_attacks(self, board: chess.Board, move: chess.Move) -> List[TacticalPatternInfo]:
        """Detect double attacks created by the move."""
        double_attacks = []
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return double_attacks
        
        # Check if the moved piece attacks multiple targets
        attacked_squares = []
        for square in chess.SQUARES:
            if board.is_attacked_by(moved_piece.color, square):
                piece = board.piece_at(square)
                if piece and piece.color != moved_piece.color:
                    attacked_squares.append(square)
        
        if len(attacked_squares) >= 2:
            total_value = sum(self.piece_values[board.piece_at(sq).piece_type] for sq in attacked_squares if board.piece_at(sq))
            double_attacks.append(TacticalPatternInfo(
                pattern=TacticalPattern.DOUBLE_ATTACK,
                pieces_involved=[move.to_square] + attacked_squares,
                target_squares=attacked_squares,
                description=f"{chess.piece_name(moved_piece.piece_type).title()} on {chess.square_name(move.to_square)} attacks multiple targets",
                impact_score=total_value
            ))
        
        return double_attacks
    
    def _detect_mate_threats(self, board: chess.Board, move: chess.Move) -> List[TacticalPatternInfo]:
        """Detect mate threats created by the move."""
        mate_threats = []
        
        if board.is_check():
            # Check if this is a mate threat
            if self._is_mate_threat(board):
                mate_threats.append(TacticalPatternInfo(
                    pattern=TacticalPattern.MATE_THREAT,
                    pieces_involved=[move.to_square],
                    target_squares=[board.king(board.turn)],
                    description=f"Check delivered by {chess.piece_name(board.piece_at(move.to_square).piece_type)} on {chess.square_name(move.to_square)} creates mate threat",
                    impact_score=1000  # Mate is the highest value
                ))
        
        return mate_threats
    
    def _calculate_material_change(self, board_before: chess.Board, board_after: chess.Board, move: chess.Move) -> int:
        """Calculate material change from the move."""
        # Count material before and after
        material_before = self._count_material(board_before)
        material_after = self._count_material(board_after)
        
        # Return the change (positive = gained material, negative = lost material)
        return material_after - material_before
    
    def _count_material(self, board: chess.Board) -> int:
        """Count total material value on the board."""
        total = 0
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece:
                if piece.color == chess.WHITE:
                    total += self.piece_values[piece.piece_type]
                else:
                    total -= self.piece_values[piece.piece_type]
        return total
    
    def _analyze_positional_changes(self, board_before: chess.Board, board_after: chess.Board, move: chess.Move) -> List[PositionalFactorInfo]:
        """Analyze positional changes from the move."""
        changes = []
        
        # King safety
        king_safety_before = self._evaluate_king_safety(board_before)
        king_safety_after = self._evaluate_king_safety(board_after)
        if king_safety_before != king_safety_after:
            changes.append(PositionalFactorInfo(
                factor=PositionalFactor.KING_SAFETY,
                score=king_safety_after - king_safety_before,
                description=f"King safety {'improved' if king_safety_after > king_safety_before else 'deteriorated'} by {abs(king_safety_after - king_safety_before)} points",
                improvement=king_safety_after > king_safety_before,
                deterioration=king_safety_after < king_safety_before
            ))
        
        # Piece activity
        activity_before = self._evaluate_piece_activity(board_before)
        activity_after = self._evaluate_piece_activity(board_after)
        if activity_before != activity_after:
            changes.append(PositionalFactorInfo(
                factor=PositionalFactor.PIECE_ACTIVITY,
                score=activity_after - activity_before,
                description=f"Piece activity {'increased' if activity_after > activity_before else 'decreased'} by {abs(activity_after - activity_before)} points",
                improvement=activity_after > activity_before,
                deterioration=activity_after < activity_before
            ))
        
        return changes
    
    def _evaluate_king_safety(self, board: chess.Board) -> int:
        """Evaluate king safety (higher = safer)."""
        king_square = board.king(board.turn)
        if king_square is None:
            return 0
        
        safety = 0
        
        # Check for pawn shield
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.piece_type == chess.PAWN and piece.color == board.turn:
                distance = abs(chess.square_rank(square) - chess.square_rank(king_square))
                if distance <= 2:
                    safety += 10
        
        # Check for enemy attacks on king
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.color != board.turn:
                if board.is_attacked_by(piece.color, king_square):
                    safety -= 20
        
        return safety
    
    def _evaluate_piece_activity(self, board: chess.Board) -> int:
        """Evaluate piece activity (higher = more active)."""
        activity = 0
        
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.color == board.turn:
                # Count squares this piece can move to
                legal_moves = [move for move in board.legal_moves if move.from_square == square]
                activity += len(legal_moves) * 2
                
                # Bonus for central control
                if chess.square_rank(square) in [3, 4] and chess.square_file(square) in [3, 4]:
                    activity += 5
        
        return activity
    
    def _get_attacked_pieces(self, board: chess.Board, move: chess.Move) -> List[chess.Square]:
        """Get pieces attacked by the moved piece."""
        attacked = []
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return attacked
        
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.color != moved_piece.color:
                if board.is_attacked_by(moved_piece.color, square):
                    attacked.append(square)
        
        return attacked
    
    def _get_defended_pieces(self, board: chess.Board, move: chess.Move) -> List[chess.Square]:
        """Get pieces defended by the moved piece."""
        defended = []
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return defended
        
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.color == moved_piece.color:
                if board.is_attacked_by(moved_piece.color, square):
                    defended.append(square)
        
        return defended
    
    def _get_controlled_squares(self, board: chess.Board, move: chess.Move) -> List[chess.Square]:
        """Get squares controlled by the moved piece."""
        controlled = []
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return controlled
        
        for square in chess.SQUARES:
            if board.is_attacked_by(moved_piece.color, square):
                controlled.append(square)
        
        return controlled
    
    def _detect_mate_threat(self, board: chess.Board) -> bool:
        """Detect if there's a mate threat."""
        if not board.is_check():
            return False
        
        # Check if the king has any legal moves
        legal_moves = list(board.legal_moves)
        return len(legal_moves) == 0
    
    def _generate_threat_descriptions(self, patterns: List[TacticalPatternInfo], board: chess.Board) -> List[str]:
        """Generate human-readable descriptions of threats."""
        descriptions = []
        
        for pattern in patterns:
            if pattern.is_threat:
                descriptions.append(pattern.description)
        
        return descriptions
    
    # Helper methods
    def _is_pinned(self, board: chess.Board, square: chess.Square, color: chess.Color) -> bool:
        """Check if a piece is pinned."""
        piece = board.piece_at(square)
        if not piece:
            return False
        
        # Check if removing this piece would expose the king to check
        temp_board = board.copy()
        temp_board.remove_piece_at(square)
        return temp_board.is_check()
    
    def _get_pieces_on_line(self, board: chess.Board, start_square: chess.Square, direction: int) -> List[chess.Square]:
        """Get all pieces on a line from a starting square."""
        pieces = []
        current = start_square
        
        while True:
            try:
                # Calculate next square based on direction
                if direction == 8:  # North
                    next_square = current + 8
                elif direction == -8:  # South
                    next_square = current - 8
                elif direction == 1:  # East
                    next_square = current + 1
                elif direction == -1:  # West
                    next_square = current - 1
                elif direction == 9:  # Northeast
                    next_square = current + 9
                elif direction == 7:  # Northwest
                    next_square = current + 7
                elif direction == -7:  # Southeast
                    next_square = current - 7
                elif direction == -9:  # Southwest
                    next_square = current - 9
                else:
                    break
                
                # Check if square is valid
                if not (0 <= next_square < 64):
                    break
                
                # Check if we're still on the same rank/file (for rook moves)
                if direction in [1, -1] and chess.square_rank(next_square) != chess.square_rank(current):
                    break
                if direction in [8, -8] and chess.square_file(next_square) != chess.square_file(current):
                    break
                
                current = next_square
                if board.piece_at(current):
                    pieces.append(current)
            except:
                break
        
        return pieces
    
    def _move_cleared_path(self, board: chess.Board, move: chess.Move, attacker_square: chess.Square, target_square: chess.Square) -> bool:
        """Check if a move cleared the path for an attack."""
        # This is a simplified check - in practice, you'd need more sophisticated path analysis
        return True  # Placeholder implementation
    
    def _is_mate_threat(self, board: chess.Board) -> bool:
        """Check if the current position is a mate threat."""
        if not board.is_check():
            return False
        
        # Check if there are any legal moves that don't result in check
        for move in board.legal_moves:
            temp_board = board.copy()
            temp_board.push(move)
            if not temp_board.is_check():
                return False
        
        return True
    
    def detect_hanging_pieces(self, board: chess.Board, color: chess.Color) -> List[Tuple[chess.Square, chess.Piece, int]]:
        """
        Detect hanging (undefended or insufficiently defended) pieces.
        Returns list of (square, piece, value) tuples.
        """
        hanging_pieces = []
        
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.color == color:
                # Check if piece is attacked by opponent
                if board.is_attacked_by(not color, square):
                    # Count attackers and defenders
                    attackers = self._count_attackers(board, square, not color)
                    defenders = self._count_attackers(board, square, color)
                    
                    # Piece is hanging if more attackers than defenders
                    if attackers > defenders:
                        hanging_pieces.append((square, piece, self.piece_values[piece.piece_type]))
        
        return hanging_pieces
    
    def _count_attackers(self, board: chess.Board, square: chess.Square, color: chess.Color) -> int:
        """Count number of pieces of given color attacking a square."""
        count = 0
        for attacker_square in chess.SQUARES:
            piece = board.piece_at(attacker_square)
            if piece and piece.color == color:
                if board.is_attacked_by(color, square):
                    # Check if this specific piece attacks the square
                    temp_board = board.copy()
                    temp_board.remove_piece_at(attacker_square)
                    if not temp_board.is_attacked_by(color, square):
                        count += 1
        return count
    
    def detect_lost_material(self, board_before: chess.Board, board_after: chess.Board, move: chess.Move) -> Optional[Tuple[str, int]]:
        """
        Detect if material was lost due to the move (not through capture).
        Returns (description, value) tuple or None.
        """
        # Get hanging pieces after the move
        hanging_after = self.detect_hanging_pieces(board_after, board_after.turn)
        
        if hanging_after:
            # Find the most valuable hanging piece
            most_valuable = max(hanging_after, key=lambda x: x[2])
            square, piece, value = most_valuable
            piece_name = chess.piece_name(piece.piece_type)
            square_name = chess.square_name(square)
            
            return (f"your {piece_name} on {square_name} is now hanging", value)
        
        return None
    
    def detect_specific_threats(self, board: chess.Board, move: chess.Move) -> List[str]:
        """
        Detect specific tactical threats created by the move.
        Returns list of specific threat descriptions.
        """
        threats = []
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return threats
        
        # Check for attacked pieces
        for square in chess.SQUARES:
            target_piece = board.piece_at(square)
            if target_piece and target_piece.color != moved_piece.color:
                if board.is_attacked_by(moved_piece.color, square):
                    # Check if piece is defended
                    defenders = self._count_attackers(board, square, target_piece.color)
                    attackers = self._count_attackers(board, square, moved_piece.color)
                    
                    if attackers > defenders:
                        piece_name = chess.piece_name(target_piece.piece_type)
                        square_name = chess.square_name(square)
                        threats.append(f"your {piece_name} on {square_name} is now under attack and insufficiently defended")
        
        return threats
    
    def generate_specific_blunder_explanation(self, board_before: chess.Board, board_after: chess.Board, 
                                            move: chess.Move, best_move_san: str, centipawn_loss: int) -> str:
        """
        Generate a specific, position-based explanation for a blunder.
        """
        explanations = []
        
        # Check for hung pieces
        lost_material = self.detect_lost_material(board_before, board_after, move)
        if lost_material:
            description, value = lost_material
            explanations.append(description)
        
        # Check for specific threats created
        threats = self.detect_specific_threats(board_after, move)
        if threats:
            explanations.extend(threats[:2])  # Limit to 2 threats
        
        # Check if the move allowed a fork/pin/skewer
        tactical_patterns = self._detect_tactical_patterns(board_after, move)
        for pattern in tactical_patterns[:1]:  # Limit to 1 pattern
            if pattern.pattern in [TacticalPattern.FORK, TacticalPattern.PIN, TacticalPattern.SKEWER]:
                explanations.append(pattern.description)
        
        # Check if king safety was compromised
        if board_after.is_check():
            explanations.append("this move puts your king in check")
        
        # Build the final explanation
        if explanations:
            specific_details = "; ".join(explanations[:2])  # Limit to 2 details
            if centipawn_loss > 300:
                return f"This is a catastrophic blunder - {specific_details}. {best_move_san} would be much better and avoid this disaster."
            elif centipawn_loss > 200:
                return f"This is a major blunder - {specific_details}. {best_move_san} would maintain your position and keep your pieces safe."
            else:
                return f"This creates major problems - {specific_details}. {best_move_san} would avoid these issues."
        else:
            # Generic explanation if we can't detect specifics
            if centipawn_loss > 300:
                return f"This is a catastrophic blunder that loses significant material. {best_move_san} would be much better."
            elif centipawn_loss > 200:
                return f"This is a major blunder that severely damages your position. {best_move_san} would be safer."
            else:
                return f"This creates serious problems for your position. {best_move_san} would be better."
    
    def generate_specific_brilliant_explanation(self, board_before: chess.Board, board_after: chess.Board, 
                                               move: chess.Move, centipawn_gain: int) -> str:
        """
        Generate a specific, position-based explanation for a brilliant move.
        """
        moved_piece = board_after.piece_at(move.to_square)
        if not moved_piece:
            return "Brilliant move!"
        
        explanations = []
        piece_name = chess.piece_name(moved_piece.piece_type)
        move_square = chess.square_name(move.to_square)
        
        # Check if it was a sacrifice
        captured_piece = board_before.piece_at(move.to_square)
        if captured_piece or self.piece_values[moved_piece.piece_type] > 100:
            # Check if the piece is now hanging (sacrifice)
            hanging = self.detect_hanging_pieces(board_after, moved_piece.color)
            for square, piece, value in hanging:
                if square == move.to_square:
                    explanations.append(f"you sacrificed your {piece_name} on {move_square}")
        
        # Check for mate threats
        if board_after.is_check():
            king_square = chess.square_name(board_after.king(not moved_piece.color))
            explanations.append(f"this creates a devastating check against the king on {king_square}")
            
            # Check if it's mate in a few moves
            if self._is_mate_threat(board_after):
                explanations.append("this leads to forced mate")
        
        # Check for tactical patterns
        tactical_patterns = self._detect_tactical_patterns(board_after, move)
        for pattern in tactical_patterns[:1]:
            if pattern.pattern == TacticalPattern.FORK:
                explanations.append(f"this creates a powerful fork attacking multiple pieces")
            elif pattern.pattern == TacticalPattern.PIN:
                explanations.append(f"this creates a devastating pin")
            elif pattern.pattern == TacticalPattern.DISCOVERED_ATTACK:
                explanations.append(f"this creates a discovered attack")
        
        # Build the final explanation
        if explanations:
            specific_details = ", ".join(explanations[:2])
            return f"Brilliant! {specific_details.capitalize()} - this shows exceptional tactical vision and creates winning chances."
        else:
            return f"Brilliant! {piece_name.capitalize()} to {move_square} is an exceptional move that creates winning chances."