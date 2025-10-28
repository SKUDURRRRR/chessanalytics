"""
Enhanced Comment Generator for Chess Move Analysis

This module provides more insightful, position-specific comments that leverage
the rich analysis data already being collected to provide educational and
engaging feedback to users.
"""

import chess
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
from .coaching_comment_generator import MoveQuality, GamePhase


@dataclass
class PositionContext:
    """Context about the current position for generating insightful comments."""
    material_balance: int
    king_safety_score: int
    piece_activity_score: int
    center_control: int
    tactical_patterns: List[str]
    positional_factors: List[str]
    threats_created: List[str]
    weaknesses_created: List[str]
    evaluation_change: int
    game_phase: str
    move_number: int


class EnhancedCommentGenerator:
    """Generates insightful, position-specific comments for chess moves."""

    def __init__(self):
        self.position_analyzer = None  # Will be injected
        self._setup_comment_templates()
        self._setup_positional_insights()
        self._setup_tactical_insights()

    def _setup_comment_templates(self):
        """Setup diverse comment templates to avoid repetition."""
        self.comment_templates = {
            MoveQuality.BRILLIANT: {
                'tactical_sacrifice': [
                    "Brilliant sacrifice! {tactical_detail} This shows exceptional tactical vision and the ability to calculate complex variations.",
                    "Outstanding! {tactical_detail} This kind of move separates strong players from average ones.",
                    "Exceptional play! {tactical_detail} You've found a resource that even experienced players might miss."
                ],
                'positional_brilliance': [
                    "Brilliant positional understanding! {positional_detail} This demonstrates deep chess knowledge.",
                    "Outstanding strategic play! {positional_detail} This shows mastery of positional concepts.",
                    "Exceptional move! {positional_detail} This kind of understanding wins games."
                ],
                'general': [
                    "Brilliant! {specific_detail} This move demonstrates exceptional chess understanding.",
                    "Outstanding! {specific_detail} This is the kind of move that wins games.",
                    "Exceptional play! {specific_detail} You've shown real chess mastery here."
                ]
            },
            MoveQuality.BEST: {
                'opening': [
                    "{move_san} is the correct move in this opening. {opening_principle}",
                    "Good opening play with {move_san}. {opening_principle}",
                    "{move_san} follows sound opening principles. {opening_principle}"
                ],
                'tactical': [
                    "Perfect! {tactical_detail} This is exactly what the position demands.",
                    "Excellent! {tactical_detail} You've found the strongest continuation.",
                    "Well played! {tactical_detail} This maintains your advantage."
                ],
                'positional': [
                    "Strong move! {positional_detail} This improves your position significantly.",
                    "Excellent! {positional_detail} You're playing with good understanding.",
                    "Good play! {positional_detail} This keeps your position healthy."
                ],
                'balanced': [
                    "{move_san} is the best move available. {specific_detail}",
                    "Perfect! {move_san} maintains the position well. {specific_detail}",
                    "Excellent! {move_san} shows good chess understanding. {specific_detail}"
                ]
            },
            MoveQuality.GREAT: {
                'tactical': [
                    "Great move! {tactical_detail} This shows strong tactical awareness.",
                    "Well played! {tactical_detail} You're finding good moves consistently.",
                    "Excellent! {tactical_detail} This demonstrates solid chess understanding."
                ],
                'positional': [
                    "Great positional play! {positional_detail} This improves your position.",
                    "Well done! {positional_detail} You're showing good strategic understanding.",
                    "Excellent! {positional_detail} This kind of play wins games."
                ],
                'general': [
                    "Great move! {specific_detail} You're playing accurately.",
                    "Well played! {specific_detail} This shows good chess fundamentals.",
                    "Excellent! {specific_detail} Keep up the good work!"
                ]
            },
            MoveQuality.EXCELLENT: {
                'tactical': [
                    "Excellent! {tactical_detail} This shows good tactical awareness.",
                    "Well played! {tactical_detail} You're making solid decisions.",
                    "Good move! {tactical_detail} This demonstrates chess understanding."
                ],
                'positional': [
                    "Excellent positional play! {positional_detail} This improves your position.",
                    "Well done! {positional_detail} You're showing strategic understanding.",
                    "Good move! {positional_detail} This maintains your position well."
                ],
                'general': [
                    "Excellent! {specific_detail} You're playing solidly.",
                    "Well played! {specific_detail} This shows good fundamentals.",
                    "Good move! {specific_detail} Keep it up!"
                ]
            },
            MoveQuality.GOOD: {
                'tactical': [
                    "Good move! {tactical_detail} This shows tactical awareness.",
                    "Well played! {tactical_detail} You're making sound decisions.",
                    "Solid! {tactical_detail} This demonstrates chess understanding."
                ],
                'positional': [
                    "Good positional play! {positional_detail} This helps your position.",
                    "Well done! {positional_detail} You're showing strategic thinking.",
                    "Solid! {positional_detail} This maintains your position."
                ],
                'general': [
                    "Good move! {specific_detail} You're playing solidly.",
                    "Well played! {specific_detail} This shows good understanding.",
                    "Solid! {specific_detail} Keep going!"
                ]
            },
            MoveQuality.ACCEPTABLE: {
                'opening': [
                    "{move_san} is a book move. {opening_principle}",
                    "Standard opening play with {move_san}. {opening_principle}",
                    "{move_san} follows opening theory. {opening_principle}"
                ],
                'suboptimal': [
                    "{move_san} is acceptable but not optimal. {improvement_suggestion}",
                    "Playable move, but {improvement_suggestion}",
                    "{move_san} works, though {improvement_suggestion}"
                ],
                'general': [
                    "{move_san} is a reasonable choice. {specific_detail}",
                    "Solid move with {move_san}. {specific_detail}",
                    "{move_san} maintains the position. {specific_detail}"
                ]
            },
            MoveQuality.INACCURACY: {
                'tactical': [
                    "Inaccuracy! {tactical_problem} {improvement_suggestion}",
                    "Not quite right. {tactical_problem} {improvement_suggestion}",
                    "This move has issues. {tactical_problem} {improvement_suggestion}"
                ],
                'positional': [
                    "Inaccuracy! {positional_problem} {improvement_suggestion}",
                    "Not optimal. {positional_problem} {improvement_suggestion}",
                    "This weakens your position. {positional_problem} {improvement_suggestion}"
                ],
                'general': [
                    "Inaccuracy! {specific_problem} {improvement_suggestion}",
                    "Not quite right. {specific_problem} {improvement_suggestion}",
                    "This move has issues. {specific_problem} {improvement_suggestion}"
                ]
            },
            MoveQuality.MISTAKE: {
                'tactical': [
                    "Mistake! {tactical_problem} {improvement_suggestion}",
                    "This isn't right. {tactical_problem} {improvement_suggestion}",
                    "This creates problems. {tactical_problem} {improvement_suggestion}"
                ],
                'positional': [
                    "Mistake! {positional_problem} {improvement_suggestion}",
                    "This weakens your position. {positional_problem} {improvement_suggestion}",
                    "This isn't optimal. {positional_problem} {improvement_suggestion}"
                ],
                'general': [
                    "Mistake! {specific_problem} {improvement_suggestion}",
                    "This isn't right. {specific_problem} {improvement_suggestion}",
                    "This creates problems. {specific_problem} {improvement_suggestion}"
                ]
            },
            MoveQuality.BLUNDER: {
                'tactical': [
                    "Blunder! {tactical_problem} {improvement_suggestion}",
                    "Serious error! {tactical_problem} {improvement_suggestion}",
                    "This is a major mistake! {tactical_problem} {improvement_suggestion}"
                ],
                'positional': [
                    "Blunder! {positional_problem} {improvement_suggestion}",
                    "Serious error! {positional_problem} {improvement_suggestion}",
                    "This is a major mistake! {positional_problem} {improvement_suggestion}"
                ],
                'general': [
                    "Blunder! {specific_problem} {improvement_suggestion}",
                    "Serious error! {specific_problem} {improvement_suggestion}",
                    "This is a major mistake! {specific_problem} {improvement_suggestion}"
                ]
            }
        }

    def _setup_positional_insights(self):
        """Setup positional insight templates."""
        self.positional_insights = {
            'center_control': [
                "This move {action} central control, which is crucial for piece activity",
                "By {action} the center, you {benefit} your pieces' mobility",
                "Central control is fundamental - this move {action} it effectively"
            ],
            'king_safety': [
                "This move {action} king safety, which is always a priority",
                "King safety is crucial - this move {action} it well",
                "By {action} king safety, you allow other pieces to attack freely"
            ],
            'piece_activity': [
                "This move {action} piece activity, making your pieces more effective",
                "Active pieces are more valuable - this move {action} their activity",
                "By {action} piece activity, you create more tactical opportunities"
            ],
            'pawn_structure': [
                "This move {action} pawn structure, which affects the entire game",
                "Pawn structure is the foundation - this move {action} it well",
                "By {action} pawn structure, you create long-term advantages"
            ],
            'piece_coordination': [
                "This move {action} piece coordination, making your pieces work together",
                "Coordinated pieces are powerful - this move {action} their teamwork",
                "By {action} piece coordination, you create stronger attacks and defenses"
            ]
        }

    def _setup_tactical_insights(self):
        """Setup tactical insight templates."""
        self.tactical_insights = {
            'pin': [
                "This creates a pin that restricts your opponent's piece movement and creates tactical opportunities",
                "The pin limits your opponent's options and forces them to defend passively",
                "This pin is a powerful tactical weapon that gives you the initiative"
            ],
            'fork': [
                "This creates a fork that attacks multiple pieces simultaneously and forces your opponent to choose which piece to save",
                "The fork wins material by threatening two pieces at once - this is excellent tactical play",
                "This fork is a brilliant tactical pattern that creates immediate winning chances"
            ],
            'skewer': [
                "This creates a skewer that forces your opponent to move a valuable piece and exposes their king",
                "The skewer is a powerful tactical pattern that wins material through forced moves",
                "This skewer is well-timed and creates serious tactical problems for your opponent"
            ],
            'discovered_attack': [
                "This creates a discovered attack that reveals multiple threats from your pieces simultaneously",
                "The discovered attack is a powerful tactical pattern that creates winning chances",
                "This discovered attack is brilliantly calculated and gives you a major advantage"
            ],
            'double_attack': [
                "This creates a double attack that threatens two targets at once and forces your opponent to defend multiple threats",
                "The double attack is an excellent tactical pattern that creates immediate winning chances",
                "This double attack is brilliantly executed and gives you a decisive advantage"
            ],
            'sacrifice': [
                "This is a brilliant sacrifice that trades material for massive positional compensation and creates winning chances",
                "The sacrifice is perfectly calculated and gives you a decisive advantage through superior piece activity",
                "This sacrifice is a masterful tactical decision that creates mate threats and wins the game"
            ],
            'mate_threat': [
                "This creates a mate threat that forces your opponent to defend and gives you a winning advantage",
                "The mate threat is a powerful tactical weapon that creates immediate winning chances",
                "This mate threat is brilliantly calculated and could end the game quickly"
            ],
            'tactical_shot': [
                "This is a brilliant tactical shot that creates multiple threats and wins material",
                "The tactical shot is perfectly timed and gives you a decisive advantage",
                "This tactical shot is a masterful combination that creates winning chances"
            ]
        }

    def generate_enhanced_comment(self, move_analysis: Dict[str, Any], board: chess.Board,
                                move: chess.Move, is_user_move: bool = True) -> str:
        """Generate an enhanced, position-specific comment."""

        # Extract context from move analysis
        context = self._extract_position_context(move_analysis, board, move)

        # Determine move quality
        move_quality = self._determine_move_quality(move_analysis)

        # Generate specific details based on the position
        specific_details = self._generate_specific_details(move_analysis, context, move, board)

        # Select appropriate template category
        template_category = self._select_template_category(move_quality, context, specific_details)

        # Get template and fill it with specific details
        template = random.choice(self.comment_templates[move_quality][template_category])

        # Fill template with specific details
        comment = self._fill_template(template, move_analysis, context, specific_details, move, board)

        return comment

    def _extract_position_context(self, move_analysis: Dict[str, Any], board: chess.Board,
                                move: chess.Move) -> PositionContext:
        """Extract context about the current position."""
        heuristic_details = move_analysis.get('heuristic_details', {})

        return PositionContext(
            material_balance=heuristic_details.get('material_balance', 0),
            king_safety_score=heuristic_details.get('king_safety_score', 0),
            piece_activity_score=heuristic_details.get('piece_activity_score', 0),
            center_control=heuristic_details.get('center_control', 0),
            tactical_patterns=heuristic_details.get('tactical_patterns', []),
            positional_factors=heuristic_details.get('positional_factors', []),
            threats_created=heuristic_details.get('threats_created', []),
            weaknesses_created=heuristic_details.get('weaknesses_created', []),
            evaluation_change=heuristic_details.get('delta', 0),
            game_phase=move_analysis.get('game_phase', 'middlegame'),
            move_number=move_analysis.get('fullmove_number', 0)
        )

    def _determine_move_quality(self, move_analysis: Dict[str, Any]) -> MoveQuality:
        """Determine the quality of the move based on analysis data."""
        if move_analysis.get('is_brilliant', False):
            return MoveQuality.BRILLIANT
        elif move_analysis.get('is_best', False):
            return MoveQuality.BEST
        elif move_analysis.get('is_great', False):
            return MoveQuality.GREAT
        elif move_analysis.get('is_excellent', False):
            return MoveQuality.EXCELLENT
        elif move_analysis.get('is_good', False):
            return MoveQuality.GOOD
        elif move_analysis.get('is_acceptable', False):
            return MoveQuality.ACCEPTABLE
        elif move_analysis.get('is_inaccuracy', False):
            return MoveQuality.INACCURACY
        elif move_analysis.get('is_mistake', False):
            return MoveQuality.MISTAKE
        elif move_analysis.get('is_blunder', False):
            return MoveQuality.BLUNDER
        else:
            return MoveQuality.ACCEPTABLE

    def _generate_specific_details(self, move_analysis: Dict[str, Any], context: PositionContext,
                                 move: chess.Move, board: chess.Board) -> Dict[str, str]:
        """Generate specific details about the move and position."""
        details = {}

        # Tactical details with specific explanations
        if context.tactical_patterns:
            pattern = context.tactical_patterns[0]
            if pattern in self.tactical_insights:
                details['tactical_detail'] = random.choice(self.tactical_insights[pattern])

        # Positional details with specific explanations
        if context.positional_factors:
            factor = context.positional_factors[0]
            if factor in self.positional_insights:
                action = "improves" if context.evaluation_change > 0 else "affects"
                benefit = "increase" if context.evaluation_change > 0 else "maintain"
                details['positional_detail'] = random.choice(self.positional_insights[factor]).format(
                    action=action, benefit=benefit
                )

        # Specific impact details with more descriptive explanations
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        evaluation_change = context.evaluation_change

        if centipawn_loss > 0:
            if centipawn_loss < 10:
                details['specific_detail'] = "Loses only a tiny amount compared to the best move; this is nearly perfect play"
            elif centipawn_loss < 25:
                details['specific_detail'] = "Loses only a small amount compared to the best move; this is excellent play"
            else:
                details['specific_detail'] = "Loses material compared to the best move"
        elif evaluation_change > 100:
            details['specific_detail'] = "This is a brilliant sacrifice that gains massive positional compensation and creates winning chances"
        elif evaluation_change > 50:
            details['specific_detail'] = "This is an excellent move that significantly improves your position and creates strong attacking chances"
        elif evaluation_change > 0:
            details['specific_detail'] = "This improves your position and gives you better piece coordination"
        else:
            details['specific_detail'] = "This maintains your position well and keeps your pieces active"

        # Opening principles
        if context.game_phase == 'opening' and context.move_number <= 15:
            details['opening_principle'] = self._get_opening_principle(move, context.move_number)

        # Improvement suggestions with specific moves
        if centipawn_loss > 50:
            best_move = move_analysis.get('best_move')
            if best_move:
                try:
                    best_move_obj = chess.Move.from_uci(best_move)
                    best_move_san = board.san(best_move_obj)
                    details['improvement_suggestion'] = f"Consider {best_move_san} instead."
                except:
                    details['improvement_suggestion'] = "Consider a more accurate move that improves your position."

        return details

    def _select_template_category(self, move_quality: MoveQuality, context: PositionContext,
                                details: Dict[str, str]) -> str:
        """Select the most appropriate template category based on context."""

        if move_quality == MoveQuality.BRILLIANT:
            if 'tactical_detail' in details and 'sacrifice' in details['tactical_detail'].lower():
                return 'tactical_sacrifice'
            elif 'positional_detail' in details:
                return 'positional_brilliance'
            else:
                return 'general'

        elif move_quality == MoveQuality.BEST:
            if context.game_phase == 'opening' and context.move_number <= 15:
                return 'opening'
            elif 'tactical_detail' in details:
                return 'tactical'
            elif 'positional_detail' in details:
                return 'positional'
            else:
                return 'balanced'

        elif move_quality in [MoveQuality.GREAT, MoveQuality.EXCELLENT, MoveQuality.GOOD]:
            if 'tactical_detail' in details:
                return 'tactical'
            elif 'positional_detail' in details:
                return 'positional'
            else:
                return 'general'

        elif move_quality == MoveQuality.ACCEPTABLE:
            if context.game_phase == 'opening' and context.move_number <= 15:
                return 'opening'
            elif context.evaluation_change < -25:
                return 'suboptimal'
            else:
                return 'general'

        elif move_quality in [MoveQuality.INACCURACY, MoveQuality.MISTAKE, MoveQuality.BLUNDER]:
            if 'tactical_detail' in details:
                return 'tactical'
            elif 'positional_detail' in details:
                return 'positional'
            else:
                return 'general'

        return 'general'

    def _fill_template(self, template: str, move_analysis: Dict[str, Any], context: PositionContext,
                      details: Dict[str, str], move: chess.Move, board: chess.Board) -> str:
        """Fill the template with specific details."""
        move_san = move_analysis.get('move_san', '')

        # Replace placeholders with actual values
        filled = template.format(
            move_san=move_san,
            tactical_detail=details.get('tactical_detail', ''),
            positional_detail=details.get('positional_detail', ''),
            specific_detail=details.get('specific_detail', ''),
            opening_principle=details.get('opening_principle', ''),
            improvement_suggestion=details.get('improvement_suggestion', ''),
            tactical_problem=self._get_tactical_problem(move_analysis, context),
            positional_problem=self._get_positional_problem(move_analysis, context),
            specific_problem=self._get_specific_problem(move_analysis, context)
        )

        # Clean up any double spaces or formatting issues
        filled = ' '.join(filled.split())

        return filled

    def _get_opening_principle(self, move: chess.Move, move_number: int) -> str:
        """Get opening principle explanation for the move."""
        # Get piece type from the move
        piece_type = None
        if hasattr(move, 'piece_type'):
            piece_type = move.piece_type
        else:
            # Fallback: determine piece type from move
            if move.from_square is not None:
                # This is a simplified approach - in practice you'd need the board
                piece_type = chess.PAWN  # Default fallback

        if piece_type == chess.PAWN:
            if move_number <= 3:
                return "This pawn move helps control the center, which is fundamental in the opening."
            else:
                return "This pawn move supports your central control and piece development."

        elif piece_type in [chess.KNIGHT, chess.BISHOP]:
            if move_number <= 8:
                return "This develops a piece to an active square, following opening principles."
            else:
                return "This completes your development and improves piece coordination."

        elif piece_type == chess.QUEEN:
            return "This queen move supports your central control, but be careful not to bring it out too early."

        elif piece_type == chess.KING:
            if move.from_square in [chess.E1, chess.E8] and abs(move.to_square - move.from_square) == 2:
                return "This is castling, which brings your king to safety and connects your rooks."
            else:
                return "This king move improves safety, which is crucial in the opening."

        else:
            return "This move follows sound opening principles and helps develop your position."

    def _get_tactical_problem(self, move_analysis: Dict[str, Any], context: PositionContext) -> str:
        """Get description of tactical problems with the move."""
        problems = []

        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        best_move = move_analysis.get('best_move', '')
        move_san = move_analysis.get('move_san', '')

        # Generate specific tactical explanations based on centipawn loss
        if centipawn_loss > 300:
            problems.append("This is a catastrophic blunder; you likely hung a major piece or allowed mate in a few moves")
        elif centipawn_loss > 200:
            problems.append("This is a major blunder; you probably lost a piece or created a fatal weakness")
        elif centipawn_loss > 100:
            problems.append("This is a serious mistake; you likely lost material or created significant tactical problems")
        elif centipawn_loss > 50:
            problems.append("Loses material compared to the best move")

        # Add specific tactical problems based on context
        if context.weaknesses_created:
            for weakness in context.weaknesses_created[:2]:
                if 'king' in weakness.lower():
                    problems.append("You weakened king safety; this creates serious vulnerabilities")
                elif 'pawn' in weakness.lower():
                    problems.append("You created pawn weaknesses; this gives your opponent targets to attack")
                elif 'piece' in weakness.lower():
                    problems.append("You left pieces unprotected; this allows tactical shots")

        if context.threats_created:
            for threat in context.threats_created[:2]:
                if 'mate' in threat.lower():
                    problems.append("You allowed mate threats; this could be game-ending")
                elif 'fork' in threat.lower():
                    problems.append("You allowed a fork; this will lose material")
                elif 'pin' in threat.lower():
                    problems.append("You created a pin; this restricts your piece movement")

        return ", ".join(problems) if problems else "This weakens your position tactically"

    def _get_positional_problem(self, move_analysis: Dict[str, Any], context: PositionContext) -> str:
        """Get description of positional problems with the move."""
        problems = []

        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        best_move = move_analysis.get('best_move', '')

        # Generate specific positional explanations based on centipawn loss
        if centipawn_loss > 200:
            problems.append("This is a major positional blunder; you likely lost the initiative or created fatal weaknesses")
        elif centipawn_loss > 100:
            problems.append("This is a serious positional mistake; you probably lost control of key squares or piece coordination")
        elif centipawn_loss > 50:
            problems.append("This weakens your position")

        # Add specific positional problems based on context
        if context.king_safety_score < -50:
            problems.append("You compromised your king safety; this creates serious vulnerabilities and tactical threats")

        if context.piece_activity_score < -20:
            problems.append("You reduced piece activity; this makes your pieces passive and less effective")

        if context.center_control < -10:
            problems.append("You lost central control; this gives your opponent more space and attacking chances")

        # Add specific positional weaknesses
        if context.weaknesses_created:
            for weakness in context.weaknesses_created[:2]:
                if 'back rank' in weakness.lower():
                    problems.append("You created back rank weaknesses; this allows mate threats")
                elif 'diagonal' in weakness.lower():
                    problems.append("You weakened diagonal control; this allows bishop attacks")
                elif 'file' in weakness.lower():
                    problems.append("You lost file control; this allows rook infiltration")

        return ", ".join(problems) if problems else "This weakens your position positionally"

    def _get_specific_problem(self, move_analysis: Dict[str, Any], context: PositionContext) -> str:
        """Get specific problem description for the move."""
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        best_move = move_analysis.get('best_move', '')
        best_move_san = move_analysis.get('best_move_san', '')
        move_san = move_analysis.get('move_san', '')

        # Build suggestion text if we have the best move
        best_move_text = f" {best_move_san} was the best move here." if best_move_san else ""

        if centipawn_loss > 300:
            return f"This is a catastrophic blunder; you likely hung your queen or allowed mate in a few moves.{best_move_text}"
        elif centipawn_loss > 200:
            return f"This is a major blunder; you probably lost a piece or created fatal weaknesses that severely damage your position.{best_move_text}"
        elif centipawn_loss > 100:
            return f"This is a serious mistake; you likely lost material or created significant tactical problems that give your opponent a major advantage.{best_move_text}"
        elif centipawn_loss > 50:
            return f"This loses material compared to the best move and weakens your position.{best_move_text}"
        else:
            return f"This isn't the most accurate choice in this position.{best_move_text}"
