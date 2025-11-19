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

        # Format all knowledge for prompt injection
        knowledge_text = self.knowledge_base.format_knowledge_for_prompt(
            tactical_patterns=tactical_knowledge,
            positional_concepts=positional_knowledge,
            endgame_knowledge=endgame_knowledge,
            opening_knowledge=opening_knowledge,
            common_mistakes=common_mistakes,
            teaching_guidance=teaching_guidance
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

        Args:
            move_analysis: Move analysis dictionary
            board: Current board position
            move: The move being analyzed

        Returns:
            List of detected tactical pattern names
        """
        patterns = []

        # Check move_analysis for detected patterns
        tactical_insights = move_analysis.get('tactical_insights', [])
        for insight in tactical_insights:
            insight_lower = insight.lower()
            # Map insight text to pattern names
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
            elif 'decoy' in insight_lower:
                patterns.append('decoy')
            elif 'overload' in insight_lower:
                patterns.append('overloading')
            elif 'interference' in insight_lower:
                patterns.append('interference')
            elif 'zwischenzug' in insight_lower or 'in-between' in insight_lower:
                patterns.append('zwischenzug')
            elif 'clearance' in insight_lower:
                patterns.append('clearance')
            elif 'defender' in insight_lower:
                patterns.append('removal_of_defender')

        # Use advanced analyzer to detect patterns
        try:
            analysis = self.advanced_analyzer.analyze_position(board)
            if hasattr(analysis, 'tactical_patterns'):
                for pattern in analysis.tactical_patterns:
                    if isinstance(pattern, TacticalPattern):
                        patterns.append(pattern.value)
                    else:
                        patterns.append(str(pattern))
        except Exception:
            # If analysis fails, continue with patterns from move_analysis
            pass

        # Remove duplicates while preserving order
        seen = set()
        unique_patterns = []
        for pattern in patterns:
            if pattern not in seen:
                seen.add(pattern)
                unique_patterns.append(pattern)

        return unique_patterns

    def _detect_positional_concepts(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move
    ) -> List[str]:
        """
        Detect positional concepts present in the position.

        Args:
            move_analysis: Move analysis dictionary
            board: Current board position
            move: The move being analyzed

        Returns:
            List of detected positional concept names
        """
        concepts = []

        # Check move_analysis for detected concepts
        positional_insights = move_analysis.get('positional_insights', [])
        for insight in positional_insights:
            insight_lower = insight.lower().replace(' ', '_')
            # Map insight text to concept names
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
            elif 'weak' in insight_lower and 'square' in insight_lower:
                concepts.append('weak_squares')
            elif 'outpost' in insight_lower:
                concepts.append('outpost')
            elif 'pawn' in insight_lower and 'break' in insight_lower:
                concepts.append('pawn_breaks')
            elif 'placement' in insight_lower or 'place' in insight_lower:
                concepts.append('piece_placement')

        # Use advanced analyzer to detect concepts
        try:
            analysis = self.advanced_analyzer.analyze_position(board)
            if hasattr(analysis, 'positional_concepts'):
                for concept in analysis.positional_concepts:
                    if isinstance(concept, PositionalConcept):
                        concepts.append(concept.value)
                    else:
                        concepts.append(str(concept))
        except Exception:
            # If analysis fails, continue with concepts from move_analysis
            pass

        # Remove duplicates while preserving order
        seen = set()
        unique_concepts = []
        for concept in concepts:
            if concept not in seen:
                seen.add(concept)
                unique_concepts.append(concept)

        return unique_concepts

    def get_enhanced_system_prompt(
        self,
        player_elo: int = 1200,
        base_prompt: str = None
    ) -> str:
        """
        Get an enhanced system prompt with chess teaching methodology.

        Args:
            player_elo: Player's ELO rating
            base_prompt: Base system prompt to enhance

        Returns:
            Enhanced system prompt with teaching methodology
        """
        skill_level = self.knowledge_base.get_skill_level_from_elo(player_elo)
        teaching_guidance = self.knowledge_base.get_teaching_guidance(skill_level)

        # Build enhanced prompt
        enhanced_parts = []

        if base_prompt:
            enhanced_parts.append(base_prompt)
        else:
            enhanced_parts.append(
                "You are Mikhail Tal, the Magician from Riga. You teach chess with energy and insight, "
                "explaining the principles behind each move. Your comments are engaging and instructive—"
                "you help players understand why moves work or fail."
            )

        enhanced_parts.append("\n**YOUR TEACHING APPROACH:**")
        enhanced_parts.append(f"- {teaching_guidance.get('explanation_style', 'Explain clearly and instructively')}")
        enhanced_parts.append(f"- Focus on: {', '.join(teaching_guidance.get('focus_points', [])[:3])}")

        enhanced_parts.append("\n**KEY TEACHING PRINCIPLES:**")
        enhanced_parts.append("- Explain chess concepts clearly and directly—show genuine enthusiasm")
        enhanced_parts.append("- Use concrete examples from the position—make it real and tangible")
        enhanced_parts.append("- Connect moves to fundamental chess principles—show the logic")
        enhanced_parts.append("- Help players understand the 'why' behind moves—the reasoning matters")
        enhanced_parts.append("- Encourage learning and improvement—be supportive but honest")
        enhanced_parts.append("- Show passion for tactics and creative possibilities—this is what makes chess exciting")
        enhanced_parts.append("- Never start comments with 'Ah,' 'Oh,' or similar interjections—begin directly with your commentary")

        enhanced_parts.append("\n**TAL'S AUTHENTIC STYLE:**")
        enhanced_parts.append("- Be direct and energetic—no unnecessary words, just clear insights")
        enhanced_parts.append("- Show enthusiasm for good moves and tactical opportunities")
        enhanced_parts.append("- Be passionate about chess but keep explanations grounded in reality")
        enhanced_parts.append("- Celebrate brilliant moves—acknowledge when players find something special")
        enhanced_parts.append("- Explain mistakes honestly but constructively—help players learn")

        return "\n".join(enhanced_parts)
