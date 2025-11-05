"""
Contextual Explanation Generator for Chess Moves

This module generates position-specific explanations for chess moves based on detailed
position analysis, providing insights into why moves are brilliant, tactical, or positional.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import chess
from .position_analyzer import PositionAnalyzer, MoveImpact, TacticalPattern, PositionalFactor


@dataclass
class ContextualExplanation:
    """A detailed, position-specific explanation of a move."""
    main_explanation: str
    tactical_details: List[str]
    positional_details: List[str]
    specific_impact: str
    educational_insights: List[str]
    move_significance: str


class ContextualExplanationGenerator:
    """Generates position-specific explanations for chess moves."""

    def __init__(self):
        self.position_analyzer = PositionAnalyzer()

    def generate_explanation(self, board_before: chess.Board, board_after: chess.Board,
                           move: chess.Move, move_san: str, evaluation_before: int,
                           evaluation_after: int, is_brilliant: bool = False,
                           is_blunder: bool = False, centipawn_loss: float = 0) -> ContextualExplanation:
        """Generate a comprehensive, position-specific explanation for a move."""

        # Analyze the move's impact
        impact = self.position_analyzer.analyze_move_impact(
            board_before, board_after, move, evaluation_before, evaluation_after
        )

        # Generate the main explanation
        main_explanation = self._generate_main_explanation(
            move, move_san, impact, is_brilliant, is_blunder, centipawn_loss
        )

        # Generate tactical details
        tactical_details = self._generate_tactical_details(impact, move, move_san)

        # Generate positional details
        positional_details = self._generate_positional_details(impact, move, move_san)

        # Generate specific impact description
        specific_impact = self._generate_specific_impact(impact, move, move_san)

        # Generate educational insights
        educational_insights = self._generate_educational_insights(impact, move, move_san)

        # Generate move significance
        move_significance = self._generate_move_significance(
            impact, is_brilliant, is_blunder, centipawn_loss
        )

        return ContextualExplanation(
            main_explanation=main_explanation,
            tactical_details=tactical_details,
            positional_details=positional_details,
            specific_impact=specific_impact,
            educational_insights=educational_insights,
            move_significance=move_significance
        )

    def _generate_main_explanation(self, move: chess.Move, move_san: str, impact: MoveImpact,
                                 is_brilliant: bool, is_blunder: bool, centipawn_loss: float) -> str:
        """Generate the main explanation of the move."""

        if is_brilliant:
            return self._generate_brilliant_explanation(move, move_san, impact)
        elif is_blunder:
            return self._generate_blunder_explanation(move, move_san, impact, centipawn_loss)
        elif impact.check_delivered:
            return self._generate_check_explanation(move, move_san, impact)
        elif impact.material_change < 0:
            return self._generate_sacrifice_explanation(move, move_san, impact)
        elif impact.tactical_patterns:
            return self._generate_tactical_explanation(move, move_san, impact)
        else:
            return self._generate_positional_explanation(move, move_san, impact)

    def _generate_brilliant_explanation(self, move: chess.Move, move_san: str, impact: MoveImpact) -> str:
        """Generate explanation for brilliant moves."""
        base = f"🌟 {move_san} is brilliant because "

        explanations = []

        # CRITICAL: Check for checkmate first - this takes priority over all other explanations
        # If the move is checkmate, it's brilliant because it ends the game, not because of fork/pin
        is_checkmate = move_san.endswith('#')
        if is_checkmate:
            # For checkmate moves, explain why the checkmate is brilliant (usually involves sacrifice or tactical sequence)
            if impact.tactical_patterns:
                has_sacrifice = any(p.pattern == TacticalPattern.SACRIFICE for p in impact.tactical_patterns)
                if has_sacrifice:
                    explanations.append(f"it delivers checkmate through a brilliant sacrifice")
                else:
                    explanations.append(f"it delivers checkmate through a brilliant tactical sequence")
            else:
                explanations.append(f"it delivers checkmate, ending the game decisively")

        # Only check for other tactical patterns if it's not checkmate
        if not is_checkmate:
        # Check for specific tactical patterns (avoid duplicates)
        patterns_seen = set()
        if impact.tactical_patterns:
            for pattern in impact.tactical_patterns:
                if pattern.pattern not in patterns_seen:
                    patterns_seen.add(pattern.pattern)
                    if pattern.pattern == TacticalPattern.SACRIFICE:
                        explanations.append(f"it sacrifices material ({abs(impact.material_change)} points) for devastating tactical compensation")
                    elif pattern.pattern == TacticalPattern.MATE_THREAT:
                        explanations.append(f"it creates a mate threat that forces the opponent into a losing position")
                    elif pattern.pattern == TacticalPattern.DISCOVERED_ATTACK:
                        explanations.append(f"it creates a discovered attack that exposes the opponent's king")
                    elif pattern.pattern == TacticalPattern.FORK:
                        explanations.append(f"it forks multiple enemy pieces, winning material")
                    elif pattern.pattern == TacticalPattern.PIN:
                        explanations.append(f"it pins an enemy piece, restricting the opponent's options")

        # Check for positional brilliance
        if impact.positional_changes:
            for change in impact.positional_changes:
                if change.improvement and change.factor == PositionalFactor.KING_SAFETY:
                    explanations.append(f"it dramatically improves king safety while maintaining attacking potential")
                elif change.improvement and change.factor == PositionalFactor.PIECE_ACTIVITY:
                    explanations.append(f"it significantly increases piece activity and coordination")

        # Check for evaluation swing
        if impact.evaluation_change > 200:
            explanations.append(f"it creates a massive evaluation swing of {impact.evaluation_change} centipawns in your favor")
        elif impact.evaluation_change > 100:
            explanations.append(f"it creates a significant advantage of {impact.evaluation_change} centipawns")

        # Check for forcing moves
        if impact.forcing_sequence:
            explanations.append(f"it creates a forcing sequence that limits the opponent's options")

        if explanations:
            # Limit to 2-3 key explanations to keep it concise
            limited_explanations = explanations[:2]
            result = base + ", ".join(limited_explanations) + ". This demonstrates exceptional tactical vision!"
            return self._limit_explanation_length(result)
        else:
            result = base + f"it demonstrates sophisticated chess understanding in this complex position."
            return self._limit_explanation_length(result)

    def _limit_explanation_length(self, explanation: str) -> str:
        """Limit explanation to 2-3 sentences maximum for consistent UI display."""
        if not explanation:
            return explanation

        # Split by sentence endings
        sentences = []
        current_sentence = ""

        for char in explanation:
            current_sentence += char
            if char in '.!?':
                sentences.append(current_sentence.strip())
                current_sentence = ""

        # Add any remaining text as a sentence
        if current_sentence.strip():
            sentences.append(current_sentence.strip())

        # Limit to 3 sentences maximum
        if len(sentences) <= 3:
            return explanation

        # Take first 2-3 sentences and add ellipsis if truncated
        limited_sentences = sentences[:3]
        result = " ".join(limited_sentences)

        # Ensure it ends with proper punctuation
        if not result.endswith(('.', '!', '?')):
            result += "."

        return result

    def _generate_blunder_explanation(self, move: chess.Move, move_san: str, impact: MoveImpact, centipawn_loss: float) -> str:
        """Generate explanation for blunders."""
        base = f"❌ {move_san} is a serious blunder because "

        problems = []

        # Material loss
        if centipawn_loss > 200:
            problems.append(f"it loses {int(centipawn_loss)} centipawns - a catastrophic material loss")
        elif centipawn_loss > 100:
            problems.append(f"it loses {int(centipawn_loss)} centipawns - a significant material disadvantage")

        # Specific tactical problems
        if impact.pieces_attacked:
            for square in impact.pieces_attacked:
                piece = chess.piece_name(chess.PAWN)  # Default, should get actual piece
                problems.append(f"it hangs the {piece} on {chess.square_name(square)}")

        # Positional problems
        if impact.positional_changes:
            for change in impact.positional_changes:
                if change.deterioration and change.factor == PositionalFactor.KING_SAFETY:
                    problems.append(f"it severely compromises king safety")
                elif change.deterioration and change.factor == PositionalFactor.PIECE_ACTIVITY:
                    problems.append(f"it reduces piece activity and coordination")

        # Evaluation swing
        if impact.evaluation_change < -200:
            problems.append(f"it causes a devastating evaluation swing of {abs(impact.evaluation_change)} centipawns in the opponent's favor")

        if problems:
            return base + ", ".join(problems) + ". This creates major difficulties for your position."
        else:
            return base + f"it creates significant problems that weaken your position and give the opponent a major advantage."

    def _generate_check_explanation(self, move: chess.Move, move_san: str, impact: MoveImpact) -> str:
        """Generate explanation for check moves."""
        base = f"✅ {move_san} delivers check"

        if impact.mate_threat:
            return base + " and creates a mate threat, forcing the opponent into a losing position."
        elif impact.tactical_patterns:
            return base + f" while creating tactical threats. {impact.tactical_patterns[0].description}."
        else:
            return base + ", forcing the opponent to respond defensively and limiting their options."

    def _generate_sacrifice_explanation(self, move: chess.Move, move_san: str, impact: MoveImpact) -> str:
        """Generate explanation for sacrifice moves."""
        base = f"🎯 {move_san} is a calculated sacrifice"

        if impact.tactical_patterns:
            return base + f" that creates tactical opportunities. {impact.tactical_patterns[0].description}."
        elif impact.evaluation_change > 0:
            return base + f" that gains {impact.evaluation_change} centipawns in positional compensation."
        else:
            return base + " that trades material for positional advantages."

    def _generate_tactical_explanation(self, move: chess.Move, move_san: str, impact: MoveImpact) -> str:
        """Generate explanation for tactical moves."""
        base = f"⚡ {move_san} is a tactical move"

        if impact.tactical_patterns:
            return base + f" that {impact.tactical_patterns[0].description.lower()}."
        else:
            return base + " that creates threats and improves the position tactically."

    def _generate_positional_explanation(self, move: chess.Move, move_san: str, impact: MoveImpact) -> str:
        """Generate explanation for positional moves."""
        base = f"🎯 {move_san} is a positional move"

        if impact.positional_changes:
            change = impact.positional_changes[0]
            return base + f" that {change.description.lower()}."
        else:
            return base + " that improves the position strategically."

    def _generate_tactical_details(self, impact: MoveImpact, move: chess.Move, move_san: str) -> List[str]:
        """Generate detailed tactical analysis."""
        details = []

        for pattern in impact.tactical_patterns:
            if pattern.pattern == TacticalPattern.PIN:
                details.append(f"Pin: {pattern.description}")
            elif pattern.pattern == TacticalPattern.FORK:
                details.append(f"Fork: {pattern.description}")
            elif pattern.pattern == TacticalPattern.SKEWER:
                details.append(f"Skewer: {pattern.description}")
            elif pattern.pattern == TacticalPattern.DISCOVERED_ATTACK:
                details.append(f"Discovered Attack: {pattern.description}")
            elif pattern.pattern == TacticalPattern.MATE_THREAT:
                details.append(f"Mate Threat: {pattern.description}")

        if impact.pieces_attacked:
            attacked_pieces = [chess.square_name(sq) for sq in impact.pieces_attacked]
            details.append(f"Attacks: {', '.join(attacked_pieces)}")

        if impact.material_change != 0:
            if impact.material_change > 0:
                details.append(f"Material gain: +{impact.material_change} points")
            else:
                details.append(f"Material loss: {impact.material_change} points")

        return details

    def _generate_positional_details(self, impact: MoveImpact, move: chess.Move, move_san: str) -> List[str]:
        """Generate detailed positional analysis."""
        details = []

        for change in impact.positional_changes:
            if change.factor == PositionalFactor.KING_SAFETY:
                details.append(f"King Safety: {change.description}")
            elif change.factor == PositionalFactor.PIECE_ACTIVITY:
                details.append(f"Piece Activity: {change.description}")
            elif change.factor == PositionalFactor.CENTER_CONTROL:
                details.append(f"Center Control: {change.description}")

        if impact.squares_controlled:
            controlled_squares = [chess.square_name(sq) for sq in impact.squares_controlled[:5]]  # Limit to 5
            details.append(f"Controls squares: {', '.join(controlled_squares)}")

        return details

    def _generate_specific_impact(self, impact: MoveImpact, move: chess.Move, move_san: str) -> str:
        """Generate description of the move's specific impact."""
        impacts = []

        if impact.evaluation_change != 0:
            if impact.evaluation_change > 0:
                impacts.append(f"improves evaluation by {impact.evaluation_change} centipawns")
            else:
                impacts.append(f"worsens evaluation by {abs(impact.evaluation_change)} centipawns")

        if impact.check_delivered:
            impacts.append("delivers check")

        if impact.mate_threat:
            impacts.append("creates mate threat")

        if impact.forcing_sequence:
            impacts.append("creates forcing sequence")

        if impacts:
            return f"This move {', '.join(impacts)}."
        else:
            return "This move improves the position strategically."

    def _generate_educational_insights(self, impact: MoveImpact, move: chess.Move, move_san: str) -> List[str]:
        """Generate educational insights about the move."""
        insights = []

        # Tactical insights
        if impact.tactical_patterns:
            for pattern in impact.tactical_patterns:
                if pattern.pattern == TacticalPattern.PIN:
                    insights.append("Pins are powerful tactical weapons that restrict enemy piece movement")
                elif pattern.pattern == TacticalPattern.FORK:
                    insights.append("Forks attack multiple pieces simultaneously, often winning material")
                elif pattern.pattern == TacticalPattern.SACRIFICE:
                    insights.append("Sacrifices can be brilliant when they lead to mate or significant positional gains")

        # Positional insights
        if impact.positional_changes:
            for change in impact.positional_changes:
                if change.factor == PositionalFactor.KING_SAFETY:
                    insights.append("King safety is crucial - a safe king allows other pieces to attack")
                elif change.factor == PositionalFactor.PIECE_ACTIVITY:
                    insights.append("Active pieces are more valuable than passive ones")

        # General insights
        if impact.material_change < 0 and impact.evaluation_change > 0:
            insights.append("Sometimes sacrificing material for positional advantages is the correct choice")

        if impact.forcing_sequence:
            insights.append("Forcing moves limit the opponent's options and create tactical opportunities")

        return insights

    def _generate_move_significance(self, impact: MoveImpact, is_brilliant: bool, is_blunder: bool, centipawn_loss: float) -> str:
        """Generate description of the move's significance."""
        if is_brilliant:
            return "This move demonstrates exceptional chess understanding and could be game-changing."
        elif is_blunder:
            return "This move significantly weakens the position and could be game-losing."
        elif abs(impact.evaluation_change) > 100:
            return "This move has a significant impact on the position's evaluation."
        elif impact.tactical_patterns:
            return "This move creates important tactical opportunities."
        else:
            return "This move improves the position strategically."
