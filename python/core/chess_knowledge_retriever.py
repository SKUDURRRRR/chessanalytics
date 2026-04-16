import logging

logger = logging.getLogger(__name__)

"""
Chess Knowledge Retriever

This module retrieves relevant chess knowledge from the knowledge base
based on position context, move analysis, and player skill level.
It formats the knowledge for injection into AI prompts.
"""

from typing import Dict, List, Optional, Any
import chess
from .chess_knowledge_base import ChessKnowledgeBase, SkillLevel
from .advanced_chess_analysis import AdvancedChessAnalyzer, TacticalPattern, PositionalConcept


class ChessKnowledgeRetriever:
    """
    Retrieves and formats relevant chess knowledge for AI prompts.

    Analyzes the position and move context to determine which chess
    concepts, patterns, and teaching points are most relevant.
    """

    def __init__(self):
        """Initialize the knowledge retriever."""
        self.knowledge_base = ChessKnowledgeBase()
        self.advanced_analyzer = AdvancedChessAnalyzer()

    def retrieve_relevant_knowledge(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move,
        game_phase: str,
        player_elo: int = 1200
    ) -> str:
        """
        Retrieve and format all relevant chess knowledge for a position.

        Args:
            move_analysis: Dictionary containing move analysis data
            board: Chess board position after the move
            move: The chess move being analyzed
            game_phase: Current game phase (opening, middlegame, endgame)
            player_elo: Player's ELO rating

        Returns:
            Formatted string with relevant chess knowledge for AI prompt
        """
        # Determine player skill level
        skill_level = self.knowledge_base.get_skill_level_from_elo(player_elo)

        # Get teaching methodology guidance
        teaching_guidance = self.knowledge_base.get_teaching_guidance(skill_level)

        # Detect tactical patterns in the position
        tactical_patterns = self._detect_tactical_patterns(move_analysis, board, move)

        # Detect positional concepts
        positional_concepts = self._detect_positional_concepts(move_analysis, board, move)

        # Get relevant knowledge from knowledge base
        tactical_knowledge = self.knowledge_base.get_relevant_tactical_patterns(
            tactical_patterns,
            skill_level
        )

        positional_knowledge = self.knowledge_base.get_relevant_positional_concepts(
            positional_concepts,
            skill_level
        )

        # Get phase-specific knowledge
        move_number = move_analysis.get('fullmove_number', 0)
        endgame_knowledge = self.knowledge_base.get_endgame_knowledge(game_phase, skill_level)
        opening_knowledge = self.knowledge_base.get_opening_knowledge(game_phase, move_number, skill_level)

        # Get common mistakes context if move quality is poor
        # Handle both string and enum types for move_quality
        move_quality = move_analysis.get('move_quality', 'good')
        if isinstance(move_quality, str):
            move_quality_str = move_quality
        elif hasattr(move_quality, 'value'):
            move_quality_str = move_quality.value
        else:
            move_quality_str = str(move_quality).lower()

        common_mistakes = self.knowledge_base.get_common_mistakes_context(
            move_quality_str,
            skill_level
        )

        # Format knowledge for prompt injection
        # Use condensed format to stay within token budget (300 chars max)
        knowledge_text = self.knowledge_base.format_condensed_knowledge(
            tactical_patterns=tactical_knowledge,
            positional_concepts=positional_knowledge,
            endgame_knowledge=endgame_knowledge,
            opening_knowledge=opening_knowledge,
            common_mistakes=common_mistakes,
            max_chars=300
        )

        return knowledge_text

    def _detect_tactical_patterns(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move
    ) -> List[str]:
        """
        Detect tactical patterns present in the position.
        Analyzes board directly first, then checks move_analysis insights.

        Args:
            move_analysis: Move analysis dictionary
            board: Current board position
            move: The move being analyzed

        Returns:
            List of detected tactical pattern names
        """
        patterns = []

        # PRIORITY 1: Analyze board position directly for tactical patterns
        try:
            # Detect pins
            if self._detect_pins(board):
                patterns.append('pin')

            # Detect forks (piece attacking 2+ pieces)
            if self._detect_forks(board, move):
                patterns.append('fork')

            # Detect hanging pieces (critical tactical issue)
            heuristic_details = move_analysis.get('heuristic_details', {})
            if heuristic_details.get('new_hanging_pieces', []):
                patterns.append('hanging_pieces')
        except Exception as e:
            logger.error(f"Warning: Direct pattern detection failed: {e}")

        # PRIORITY 2: Use advanced analyzer to detect patterns
        try:
            analysis = self.advanced_analyzer.analyze_position(board)
            if hasattr(analysis, 'tactical_patterns'):
                for pattern in analysis.tactical_patterns:
                    if isinstance(pattern, TacticalPattern):
                        patterns.append(pattern.value)
                    else:
                        patterns.append(str(pattern))
        except Exception:
            pass

        # PRIORITY 3: Check move_analysis for detected patterns (fallback)
        tactical_insights = move_analysis.get('tactical_insights', [])
        for insight in tactical_insights:
            insight_lower = insight.lower()
            if 'pin' in insight_lower:
                patterns.append('pin')
            elif 'fork' in insight_lower:
                patterns.append('fork')
            elif 'skewer' in insight_lower:
                patterns.append('skewer')
            elif 'discovered' in insight_lower:
                patterns.append('discovered_attack')
            elif 'double attack' in insight_lower or 'double_attack' in insight_lower:
                patterns.append('double_attack')
            elif 'deflection' in insight_lower:
                patterns.append('deflection')
            elif 'removal' in insight_lower and 'defender' in insight_lower:
                patterns.append('removal_of_defender')

        # Remove duplicates while preserving order
        seen = set()
        unique_patterns = []
        for pattern in patterns:
            if pattern not in seen:
                seen.add(pattern)
                unique_patterns.append(pattern)

        if unique_patterns:
            logger.info(f"Detected tactical patterns: {', '.join(unique_patterns)}")

        return unique_patterns

    def _detect_positional_concepts(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move
    ) -> List[str]:
        """
        Detect positional concepts present in the position.
        Analyzes board directly first, then checks move_analysis insights.

        Args:
            move_analysis: Move analysis dictionary
            board: Current board position
            move: The move being analyzed

        Returns:
            List of detected positional concept names
        """
        concepts = []

        # PRIORITY 1: Analyze board position directly for positional concepts
        try:
            # Detect center control
            if self._detect_center_control(board, move):
                concepts.append('center_control')

            # Detect king safety issues
            if self._detect_king_safety_relevance(board):
                concepts.append('king_safety')

            # Detect pawn structure features
            if self._detect_pawn_structure_features(board):
                concepts.append('pawn_structure')

            # Detect piece activity
            if self._detect_piece_activity(board, move):
                concepts.append('piece_activity')
        except Exception as e:
            logger.error(f"Warning: Direct concept detection failed: {e}")

        # PRIORITY 2: Use advanced analyzer to detect concepts
        try:
            analysis = self.advanced_analyzer.analyze_position(board)
            if hasattr(analysis, 'positional_concepts'):
                for concept in analysis.positional_concepts:
                    if isinstance(concept, PositionalConcept):
                        concepts.append(concept.value)
                    else:
                        concepts.append(str(concept))
        except Exception:
            pass

        # PRIORITY 3: Check move_analysis for detected concepts (fallback)
        positional_insights = move_analysis.get('positional_insights', [])
        for insight in positional_insights:
            insight_lower = insight.lower().replace(' ', '_')
            if 'center' in insight_lower or 'central' in insight_lower:
                concepts.append('center_control')
            elif 'activity' in insight_lower or 'active' in insight_lower:
                concepts.append('piece_activity')
            elif 'king' in insight_lower and 'safety' in insight_lower:
                concepts.append('king_safety')
            elif 'pawn' in insight_lower and 'structure' in insight_lower:
                concepts.append('pawn_structure')
            elif 'space' in insight_lower:
                concepts.append('space_advantage')
            elif 'coordination' in insight_lower or 'coordinate' in insight_lower:
                concepts.append('piece_coordination')

        # Remove duplicates while preserving order
        seen = set()
        unique_concepts = []
        for concept in concepts:
            if concept not in seen:
                seen.add(concept)
                unique_concepts.append(concept)

        if unique_concepts:
            logger.info(f"Detected positional concepts: {', '.join(unique_concepts)}")

        return unique_concepts

    def _detect_pins(self, board: chess.Board) -> bool:
        """Detect if there are pins in the position."""
        # Look for pieces on same rank/file/diagonal with king/queen
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if not piece:
                continue

            # Check if this piece could be pinning something
            if piece.piece_type in [chess.BISHOP, chess.ROOK, chess.QUEEN]:
                # Get squares this piece attacks
                attacks = board.attacks(square)
                for attacked_sq in attacks:
                    attacked_piece = board.piece_at(attacked_sq)
                    if attacked_piece and attacked_piece.color != piece.color:
                        # Check if there's a more valuable piece behind
                        direction = self._get_direction(square, attacked_sq)
                        if direction:
                            behind_sq = attacked_sq + direction
                            if chess.square_name(behind_sq) in chess.SQUARE_NAMES:
                                behind_piece = board.piece_at(behind_sq)
                                if behind_piece and behind_piece.color == attacked_piece.color:
                                    if behind_piece.piece_type > attacked_piece.piece_type or behind_piece.piece_type == chess.KING:
                                        return True
        return False

    def _get_direction(self, from_sq: int, to_sq: int) -> Optional[int]:
        """Get direction vector between two squares."""
        from_rank, from_file = divmod(from_sq, 8)
        to_rank, to_file = divmod(to_sq, 8)

        rank_diff = to_rank - from_rank
        file_diff = to_file - from_file

        if rank_diff == 0 and file_diff != 0:  # Same rank
            return 1 if file_diff > 0 else -1
        elif file_diff == 0 and rank_diff != 0:  # Same file
            return 8 if rank_diff > 0 else -8
        elif abs(rank_diff) == abs(file_diff):  # Diagonal
            return (8 if rank_diff > 0 else -8) + (1 if file_diff > 0 else -1)
        return None

    def _detect_forks(self, board: chess.Board, move: chess.Move) -> bool:
        """Detect if a piece is forking (attacking 2+ pieces)."""
        # Check if the moved piece attacks 2+ enemy pieces
        moved_piece = board.piece_at(move.to_square)
        if not moved_piece:
            return False

        attacks = board.attacks(move.to_square)
        attacked_pieces = []
        for attacked_sq in attacks:
            piece = board.piece_at(attacked_sq)
            if piece and piece.color != moved_piece.color:
                attacked_pieces.append(piece)

        return len(attacked_pieces) >= 2

    def _detect_center_control(self, board: chess.Board, move: chess.Move) -> bool:
        """Detect if move involves center control (d4, d5, e4, e5)."""
        center_squares = [chess.D4, chess.D5, chess.E4, chess.E5]

        # Check if move targets or involves center
        if move.to_square in center_squares or move.from_square in center_squares:
            return True

        # Check if moved piece attacks center
        attacks = board.attacks(move.to_square)
        for center_sq in center_squares:
            if center_sq in attacks:
                return True

        return False

    def _detect_king_safety_relevance(self, board: chess.Board) -> bool:
        """Detect if king safety is relevant (castling rights, king exposure)."""
        # Check if either king has castling rights
        if board.has_kingside_castling_rights(chess.WHITE) or board.has_queenside_castling_rights(chess.WHITE):
            return True
        if board.has_kingside_castling_rights(chess.BLACK) or board.has_queenside_castling_rights(chess.BLACK):
            return True

        # Check if king is in center (exposed)
        white_king_sq = board.king(chess.WHITE)
        black_king_sq = board.king(chess.BLACK)

        center_files = [chess.FILE_D, chess.FILE_E]
        if white_king_sq and chess.square_file(white_king_sq) in center_files:
            if chess.square_rank(white_king_sq) < 2:  # King still in starting area
                return True
        if black_king_sq and chess.square_file(black_king_sq) in center_files:
            if chess.square_rank(black_king_sq) > 5:  # King still in starting area
                return True

        return False

    def _detect_pawn_structure_features(self, board: chess.Board) -> bool:
        """Detect notable pawn structure features."""
        # Simple check: look for doubled pawns or isolated pawns
        for color in [chess.WHITE, chess.BLACK]:
            pawns = board.pieces(chess.PAWN, color)
            files_with_pawns = {}
            for sq in pawns:
                file = chess.square_file(sq)
                if file not in files_with_pawns:
                    files_with_pawns[file] = 0
                files_with_pawns[file] += 1

            # Doubled pawns
            if any(count >= 2 for count in files_with_pawns.values()):
                return True

        return False

    def _detect_piece_activity(self, board: chess.Board, move: chess.Move) -> bool:
        """Detect if move improves piece activity (mobility)."""
        piece = board.piece_at(move.to_square)
        if not piece:
            return False

        # Check if piece is now more centralized or more mobile
        to_rank = chess.square_rank(move.to_square)
        to_file = chess.square_file(move.to_square)

        # Central squares are more active
        is_centralized = to_rank in [2, 3, 4, 5] and to_file in [2, 3, 4, 5]

        # Check mobility (number of squares piece can move to)
        mobility = len(list(board.attacks(move.to_square)))

        return is_centralized or mobility >= 6  # Arbitrary threshold for "active"

    def get_enhanced_system_prompt(
        self,
        player_elo: int = 1200,
        base_prompt: str = None
    ) -> str:
        """
        Get an enhanced system prompt with chess teaching methodology.
        Simplified to avoid conflicts with user prompts.

        Args:
            player_elo: Player's ELO rating
            base_prompt: Base system prompt to enhance

        Returns:
            Enhanced system prompt with teaching methodology
        """
        skill_level = self.knowledge_base.get_skill_level_from_elo(player_elo)
        teaching_guidance = self.knowledge_base.get_teaching_guidance(skill_level)

        # Build simplified enhanced prompt
        enhanced_parts = []

        if base_prompt:
            enhanced_parts.append(base_prompt)
        else:
            enhanced_parts.append(
                "You are Mikhail Tal teaching chess. Focus on clear, educational explanations of chess concepts."
            )

        enhanced_parts.append(f"\n**SKILL LEVEL FOCUS:** {teaching_guidance.get('explanation_style', 'Explain clearly')}")
        enhanced_parts.append(f"**TEACHING TOPICS:** {', '.join(teaching_guidance.get('focus_points', [])[:3])}")

        return "\n".join(enhanced_parts)
