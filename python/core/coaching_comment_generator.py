"""
AI Coaching Comment Generator for Chess Move Analysis

This module provides comprehensive coaching comments that help players learn from their moves,
including explanations of what went right, what went wrong, and how to improve.
"""

import chess
import chess.engine
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
import random
from .advanced_chess_analysis import AdvancedChessAnalyzer, TacticalPattern, PositionalConcept
from .contextual_explanation_generator import ContextualExplanationGenerator


class MoveQuality(Enum):
    """Classification of move quality for coaching purposes."""
    BRILLIANT = "brilliant"
    BEST = "best"
    GREAT = "great"  # NEW: Very strong moves (5-15cp loss)
    EXCELLENT = "excellent"  # NEW: Nearly optimal moves (15-25cp loss)
    GOOD = "good"
    ACCEPTABLE = "acceptable"
    INACCURACY = "inaccuracy"
    MISTAKE = "mistake"
    BLUNDER = "blunder"


class GamePhase(Enum):
    """Game phases for contextual coaching."""
    OPENING = "opening"
    MIDDLEGAME = "middlegame"
    ENDGAME = "endgame"


@dataclass
class CoachingComment:
    """Comprehensive coaching comment for a move."""
    # Main coaching message
    main_comment: str
    
    # Detailed explanations
    what_went_right: Optional[str] = None
    what_went_wrong: Optional[str] = None
    how_to_improve: Optional[str] = None
    
    # Tactical and positional insights
    tactical_insights: List[str] = None
    positional_insights: List[str] = None
    
    # Risk and benefit analysis
    risks: List[str] = None
    benefits: List[str] = None
    
    # Learning opportunities
    learning_points: List[str] = None
    
    # Encouragement level (1-5, where 5 is most encouraging)
    encouragement_level: int = 3
    
    # Move quality classification
    move_quality: MoveQuality = MoveQuality.ACCEPTABLE
    
    # Game phase context
    game_phase: GamePhase = GamePhase.MIDDLEGAME
    
    def __post_init__(self):
        if self.tactical_insights is None:
            self.tactical_insights = []
        if self.positional_insights is None:
            self.positional_insights = []
        if self.risks is None:
            self.risks = []
        if self.benefits is None:
            self.benefits = []
        if self.learning_points is None:
            self.learning_points = []


class ChessCoachingGenerator:
    """Generates comprehensive coaching comments for chess moves."""
    
    def __init__(self):
        self.advanced_analyzer = AdvancedChessAnalyzer()
        self.contextual_generator = ContextualExplanationGenerator()
        self.encouragement_templates = {
            MoveQuality.BRILLIANT: [
                "This move demonstrates exceptional chess understanding.",
                "You've found a move that even strong players might miss.",
                "This is the kind of move that wins games.",
                "Your tactical vision is spot on here.",
                "This move shows real chess mastery."
            ],
            MoveQuality.BEST: [
                "This is exactly what the position demands.",
                "You've found the strongest move available.",
                "This move keeps you on the right track.",
                "This move maintains your advantage.",
                "This is the move a strong player would make."
            ],
            MoveQuality.GREAT: [
                "This is a great move that shows strong chess understanding.",
                "You've found a move that significantly improves your position.",
                "This demonstrates excellent tactical awareness.",
                "This kind of play will help you win more games.",
                "You're showing advanced chess skills here."
            ],
            MoveQuality.EXCELLENT: [
                "This is an excellent move that shows good chess fundamentals.",
                "You've found a move that maintains your position well.",
                "This demonstrates solid chess understanding.",
                "Keep up the good work with moves like this.",
                "This shows good tactical awareness."
            ],
            MoveQuality.GOOD: [
                "This maintains a solid position.",
                "This is a solid choice in this position.",
                "This move keeps your position healthy.",
                "This move works well here.",
                "This is a reliable move in this situation."
            ],
            MoveQuality.ACCEPTABLE: [
                "Okay move. There were better options available.",
                "Playable, but not the most accurate choice.",
                "This works, though stronger moves were possible.",
                "Acceptable, but room for improvement here.",
                "Not bad, but the position could be handled better."
            ],
            MoveQuality.INACCURACY: [
                "This move has some issues. Let's see what went wrong.",
                "Not quite right. There's a better way to handle this position.",
                "This move isn't optimal. Here's what to consider instead.",
                "There's room for improvement here. Let's analyze what happened.",
                "This move misses some key points. Let's learn from it."
            ],
            MoveQuality.MISTAKE: [
                "This move has problems. Let's understand what went wrong.",
                "This isn't the right approach. Here's what to do instead.",
                "This move creates difficulties. Let's see how to avoid this.",
                "This choice has drawbacks. Here's a better way to think about it.",
                "This move needs improvement. Let's learn from this mistake."
            ],
            MoveQuality.BLUNDER: [
                "This move has serious issues. Let's learn from this mistake.",
                "This is a significant error. Here's what went wrong and how to fix it.",
                "This move creates major problems. Let's understand why and how to avoid it.",
                "This is a blunder. Don't worry - we all make them. Let's learn from it.",
                "This move has serious consequences. Here's how to improve your play."
            ]
        }
        
        self.tactical_patterns = {
            "pin": "This move creates/breaks a pin, which is a fundamental tactical pattern.",
            "fork": "This move sets up/prevents a fork, a powerful tactical weapon.",
            "skewer": "This move creates/breaks a skewer, another important tactical motif.",
            "discovered_attack": "This move involves a discovered attack, a key tactical concept.",
            "double_attack": "This move creates/prevents a double attack, a common tactical theme.",
            "deflection": "This move involves deflection, an advanced tactical idea.",
            "decoy": "This move uses a decoy, a sophisticated tactical pattern.",
            "overloading": "This move overloads a piece, creating tactical opportunities.",
            "interference": "This move interferes with piece coordination, a tactical concept.",
            "zwischenzug": "This move is an in-between move, a subtle tactical resource."
        }
        
        self.positional_concepts = {
            "center_control": "This move affects central control, a fundamental positional principle.",
            "piece_activity": "This move improves/weakens piece activity, crucial for good play.",
            "king_safety": "This move impacts king safety, always a critical consideration.",
            "pawn_structure": "This move affects pawn structure, which influences the entire game.",
            "space_advantage": "This move gains/loses space, an important positional factor.",
            "piece_coordination": "This move improves/weakens piece coordination.",
            "weak_squares": "This move creates/exploits weak squares in the position.",
            "outpost": "This move establishes/prevents an outpost for a piece.",
            "pawn_breaks": "This move involves pawn breaks, key to opening up positions.",
            "piece_placement": "This move improves/weakens piece placement."
        }

    def generate_coaching_comment(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move,
        game_phase: GamePhase = GamePhase.MIDDLEGAME,
        player_skill_level: str = "intermediate",
        is_user_move: bool = True
    ) -> CoachingComment:
        """Generate comprehensive coaching comment for a move."""
        
        # Determine move quality
        move_quality = self._determine_move_quality(move_analysis)
        
        # Generate main comment (different for user vs opponent moves)
        main_comment = self._generate_main_comment(move_quality, move_analysis, is_user_move)
        
        # Generate detailed explanations (different perspective for opponent moves)
        what_went_right = self._analyze_what_went_right(move_analysis, board, move, move_quality, is_user_move)
        what_went_wrong = self._analyze_what_went_wrong(move_analysis, board, move, move_quality, is_user_move)
        how_to_improve = self._suggest_improvements(move_analysis, board, move, move_quality, player_skill_level, is_user_move)
        
        # Generate tactical and positional insights
        tactical_insights = self._generate_tactical_insights(move_analysis, board, move, game_phase)
        positional_insights = self._generate_positional_insights(move_analysis, board, move, game_phase)
        
        # Generate risk and benefit analysis
        risks = self._analyze_risks(move_analysis, board, move, move_quality)
        benefits = self._analyze_benefits(move_analysis, board, move, move_quality)
        
        # Generate learning points
        learning_points = self._generate_learning_points(move_analysis, board, move, move_quality, game_phase)
        
        # Determine encouragement level
        encouragement_level = self._determine_encouragement_level(move_quality, move_analysis)
        
        return CoachingComment(
            main_comment=main_comment,
            what_went_right=what_went_right,
            what_went_wrong=what_went_wrong,
            how_to_improve=how_to_improve,
            tactical_insights=tactical_insights,
            positional_insights=positional_insights,
            risks=risks,
            benefits=benefits,
            learning_points=learning_points,
            encouragement_level=encouragement_level,
            move_quality=move_quality,
            game_phase=game_phase
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

    def _generate_main_comment(self, move_quality: MoveQuality, move_analysis: Dict[str, Any], is_user_move: bool = True) -> str:
        """Generate the main coaching comment with detailed explanations."""
        # Check if this is an opening move and handle it specially
        game_phase = move_analysis.get('game_phase', 'middlegame')
        if game_phase == 'opening' and self._is_opening_book_move(move_analysis):
            return self._generate_opening_explanation(move_analysis, is_user_move)
        
        if move_quality == MoveQuality.BRILLIANT:
            comment = self._generate_brilliant_move_explanation(move_analysis, is_user_move)
        elif move_quality == MoveQuality.BLUNDER:
            comment = self._generate_blunder_explanation(move_analysis, is_user_move)
        elif is_user_move:
            # Use evaluation-aware templates instead of generic ones
            comment = self._generate_evaluation_aware_comment(move_quality, move_analysis, is_user_move)
        else:
            # Opponent move analysis
            comment = self._generate_opponent_move_comment(move_quality, move_analysis)
        
        # Limit to 2-3 sentences maximum
        return self._limit_comment_length(comment)

    def _limit_comment_length(self, comment: str) -> str:
        """Limit comment to 2-3 sentences maximum for consistent UI display."""
        if not comment:
            return comment
        
        # Split by sentence endings
        sentences = []
        current_sentence = ""
        
        for char in comment:
            current_sentence += char
            if char in '.!?':
                sentences.append(current_sentence.strip())
                current_sentence = ""
        
        # Add any remaining text as a sentence
        if current_sentence.strip():
            sentences.append(current_sentence.strip())
        
        # Limit to 3 sentences maximum
        if len(sentences) <= 3:
            return comment
        
        # Take first 2-3 sentences and add ellipsis if truncated
        limited_sentences = sentences[:3]
        result = " ".join(limited_sentences)
        
        # Ensure it ends with proper punctuation
        if not result.endswith(('.', '!', '?')):
            result += "."
        
        return result

    def _generate_opponent_move_comment(self, move_quality: MoveQuality, move_analysis: Dict[str, Any]) -> str:
        """Generate coaching comment for opponent moves."""
        opponent_templates = {
            MoveQuality.BRILLIANT: [
                "Your opponent played a brilliant move! This shows strong tactical vision.",
                "Excellent move by your opponent. This demonstrates advanced chess understanding.",
                "Your opponent found a very strong move. Study this position to understand the tactics.",
                "Outstanding play by your opponent. This is the kind of move that wins games."
            ],
            MoveQuality.BEST: [
                "Your opponent played the best move available. This is solid, accurate play.",
                "Strong move by your opponent. They found the optimal continuation.",
                "Your opponent played precisely. This maintains their position well.",
                "Good move by your opponent. They're playing accurately."
            ],
            MoveQuality.GREAT: [
                "Your opponent played a great move! This shows excellent chess understanding.",
                "Very strong move by your opponent. They found a move that significantly improves their position.",
                "Your opponent played excellently. This demonstrates advanced tactical awareness.",
                "Great play by your opponent. This kind of move shows strong chess skills."
            ],
            MoveQuality.EXCELLENT: [
                "Your opponent played an excellent move! This shows good chess fundamentals.",
                "Very well played by your opponent. They found a move that maintains their position well.",
                "Your opponent played excellently. This demonstrates solid chess understanding.",
                "Excellent move by your opponent. This shows good tactical awareness."
            ],
            MoveQuality.GOOD: [
                "Your opponent made a good move. This maintains a solid position.",
                "Decent move by your opponent. They're playing reasonably well.",
                "Your opponent played a solid move. Nothing spectacular, but sound.",
                "Good choice by your opponent. This keeps their position healthy."
            ],
            MoveQuality.ACCEPTABLE: [
                "Your opponent's move is acceptable, but not the strongest choice.",
                "Playable move by your opponent, though better options were available.",
                "Your opponent's move works, but it's not optimal.",
                "Acceptable move by your opponent, but room for improvement."
            ],
            MoveQuality.INACCURACY: [
                "Your opponent made an inaccuracy. This gives you an opportunity.",
                "Your opponent's move has some issues. Look for ways to exploit this.",
                "Inaccurate move by your opponent. This weakens their position slightly.",
                "Your opponent missed a better move. Take advantage of this."
            ],
            MoveQuality.MISTAKE: [
                "Your opponent made a mistake! This significantly weakens their position.",
                "Your opponent's move has problems. This is a good opportunity for you.",
                "Mistake by your opponent. Look for tactical opportunities.",
                "Your opponent's move creates difficulties for them. Exploit this."
            ],
            MoveQuality.BLUNDER: [
                "Your opponent blundered! This is a major error that you can exploit.",
                "Your opponent made a serious mistake. Look for winning tactics.",
                "Blunder by your opponent! This could be game-changing.",
                "Your opponent's move is a significant error. Find the refutation."
            ]
        }
        
        templates = opponent_templates[move_quality]
        return random.choice(templates)

    def _generate_brilliant_move_explanation(self, move_analysis: Dict[str, Any], is_user_move: bool = True) -> str:
        """Generate detailed explanation for brilliant moves using contextual analysis."""
        # Try to get board positions for contextual analysis
        board_before = move_analysis.get('board_before')
        board_after = move_analysis.get('board_after')
        move = move_analysis.get('move')
        move_san = move_analysis.get('move_san', '')
        evaluation_before = move_analysis.get('evaluation_before', 0)
        evaluation_after = move_analysis.get('evaluation_after', 0)
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        
        # If we have the necessary data, use contextual analysis
        if board_before and board_after and move:
            try:
                contextual_explanation = self.contextual_generator.generate_explanation(
                    board_before, board_after, move, move_san, 
                    evaluation_before, evaluation_after, 
                    is_brilliant=True, centipawn_loss=centipawn_loss
                )
                return contextual_explanation.main_explanation
            except Exception as e:
                print(f"Error in contextual analysis: {e}")
                # Fall back to enhanced explanation
        
        # Fallback to enhanced explanation if contextual analysis fails
        explanations = []
        
        # Check for material sacrifice
        if centipawn_loss > 0:
            explanations.append(f"This move sacrifices {int(centipawn_loss)} centipawns of material")
        
        # Check for tactical patterns
        heuristic_details = move_analysis.get('heuristic_details', {})
        see_score = heuristic_details.get('see', 0)
        
        if see_score < -100:  # Significant material sacrifice
            explanations.append("in a brilliant tactical sacrifice")
            explanations.append("that creates devastating threats")
        elif see_score < 0:
            explanations.append("in a calculated sacrifice")
            explanations.append("that gains significant positional advantages")
        
        # Check for king safety improvements
        king_safety_drop = heuristic_details.get('king_safety_drop', 0)
        if king_safety_drop < -50:  # Negative means improvement
            explanations.append("while dramatically improving king safety")
        
        # Check for mobility improvements
        mobility_change = heuristic_details.get('mobility_change', 0)
        if mobility_change > 20:
            explanations.append("and significantly increases piece mobility")
        
        # Check for hanging pieces created
        new_hanging = heuristic_details.get('new_hanging_pieces', [])
        if new_hanging:
            explanations.append("by creating tactical threats that force the opponent into difficult positions")
        
        # Check for evaluation swing
        delta = heuristic_details.get('delta', 0)
        if delta > 200:
            explanations.append("resulting in a massive evaluation swing in your favor")
        elif delta > 100:
            explanations.append("creating a significant advantage")
        
        # Check for check delivery
        if move_analysis.get('gives_check', False):
            explanations.append("while delivering a powerful check")
        
        # Build the explanation
        if explanations:
            base = "🌟 Outstanding! This move demonstrates exceptional tactical vision. "
            if is_user_move:
                base += "You've found a brilliant resource that "
            else:
                base += "Your opponent found a brilliant resource that "
            
            base += " ".join(explanations) + ". "
            
            if is_user_move:
                base += "This is the kind of move that wins games and shows real chess mastery!"
            else:
                base += "Study this position to understand the advanced tactics involved."
            
            return base
        else:
            # Enhanced fallback for brilliant moves without specific indicators
            base = "🌟 Outstanding! This move demonstrates exceptional chess understanding and tactical mastery. "
            if is_user_move:
                base += "You've found a brilliant resource that even strong players might miss. "
            else:
                base += "Your opponent found a brilliant resource that shows advanced tactical vision. "
            
            # Add context based on available data
            if move_analysis.get('gives_check', False):
                base += "This move delivers a powerful check while creating tactical threats. "
            elif move_analysis.get('is_best', False):
                base += "This move is not only the best available but demonstrates sophisticated positional understanding. "
            else:
                base += "This move involves complex tactical or positional concepts that create significant advantages. "
            
            if is_user_move:
                base += "This is the kind of move that wins games and shows real chess mastery!"
            else:
                base += "Study this position carefully to understand the advanced tactics involved."
            
            return base

    def _generate_blunder_explanation(self, move_analysis: Dict[str, Any], is_user_move: bool = True) -> str:
        """Generate detailed explanation for blunders."""
        problems = []
        
        # Check centipawn loss
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        if centipawn_loss > 500:
            problems.append(f"loses {int(centipawn_loss)} centipawns - a catastrophic material loss")
        elif centipawn_loss > 200:
            problems.append(f"loses {int(centipawn_loss)} centipawns - a significant material disadvantage")
        elif centipawn_loss > 100:
            problems.append(f"loses {int(centipawn_loss)} centipawns - a serious material loss")
        
        # Check for specific tactical problems
        heuristic_details = move_analysis.get('heuristic_details', {})
        see_score = heuristic_details.get('see', 0)
        
        if see_score < -200:
            problems.append("involves a terrible material exchange that loses significant value")
        elif see_score < -100:
            problems.append("involves a poor material exchange that loses material")
        
        # Check for hanging pieces
        new_hanging = heuristic_details.get('new_hanging_pieces', [])
        if new_hanging:
            hanging_list = [f"{entry['piece']} on {entry['square']}" for entry in new_hanging]
            problems.append(f"hangs {', '.join(hanging_list)} - a critical tactical error")
        
        # Check for king safety issues
        king_safety_drop = heuristic_details.get('king_safety_drop', 0)
        if king_safety_drop > 100:
            problems.append("severely compromises king safety, making the king vulnerable to attack")
        elif king_safety_drop > 50:
            problems.append("weakens king safety significantly")
        
        # Check for mobility loss
        mobility_change = heuristic_details.get('mobility_change', 0)
        if mobility_change < -20:
            problems.append("dramatically reduces piece mobility and coordination")
        elif mobility_change < -10:
            problems.append("reduces piece mobility and limits tactical options")
        
        # Check for evaluation swing
        delta = heuristic_details.get('delta', 0)
        if delta < -300:
            problems.append("causes a devastating evaluation swing that could be game-losing")
        elif delta < -200:
            problems.append("causes a massive evaluation swing in the opponent's favor")
        elif delta < -100:
            problems.append("causes a significant evaluation swing that severely weakens the position")
        
        # Check for missed opportunities
        best_alternative = heuristic_details.get('best_alternative')
        if best_alternative and best_alternative.get('score', 0) > 200:
            problems.append(f"misses the much stronger {best_alternative.get('san', 'move')} that would have maintained the advantage")
        
        # Build the explanation
        if problems:
            base = "❌ This is a serious blunder that "
            base += ", ".join(problems) + ". "
            
            if is_user_move:
                base += "Don't worry - we all make blunders. Take more time to calculate before moving and always check for hanging pieces."
            else:
                base += "This gives you a major opportunity to exploit the mistake and gain a significant advantage."
            
            return base
        else:
            # Fallback to generic blunder explanation
            if is_user_move:
                return "❌ This is a significant error. Don't worry - we all make blunders. Learn from this mistake to avoid similar errors."
            else:
                return "❌ Your opponent made a serious mistake. This could be game-changing - look for winning tactics."

    def _analyze_what_went_right(self, move_analysis: Dict[str, Any], board: chess.Board, 
                                move: chess.Move, move_quality: MoveQuality, is_user_move: bool = True) -> Optional[str]:
        """Analyze what went right with the move."""
        if move_quality in [MoveQuality.BLUNDER, MoveQuality.MISTAKE]:
            return None
            
        positive_aspects = []
        
        if not is_user_move:
            # For opponent moves, focus on what they did well
            if move_analysis.get('is_best', False):
                positive_aspects.append("Your opponent found the strongest move available.")
            
            if move_analysis.get('is_brilliant', False):
                positive_aspects.append("Your opponent demonstrated exceptional tactical vision.")
            
            if self._is_developing_move(move, board):
                positive_aspects.append("Your opponent developed a piece, which is generally good.")
            
            if self._improves_king_safety(move, board):
                positive_aspects.append("Your opponent improved their king's safety.")
            
            if self._controls_center(move, board):
                positive_aspects.append("Your opponent helped control the center of the board.")
            
            if self._creates_threats(move, board):
                positive_aspects.append("Your opponent created threats against your position.")
            
            if positive_aspects:
                return " ".join(positive_aspects)
            return None
        
        # Check for tactical strengths
        if move_analysis.get('is_best', False):
            positive_aspects.append("This is the strongest move available in this position.")
        
        if move_analysis.get('is_brilliant', False):
            positive_aspects.append("This move demonstrates exceptional tactical vision.")
        
        # Check for positional strengths
        if self._is_developing_move(move, board):
            positive_aspects.append("This move develops a piece, which is generally good.")
        
        if self._improves_king_safety(move, board):
            positive_aspects.append("This move improves your king's safety.")
        
        if self._controls_center(move, board):
            positive_aspects.append("This move helps control the center of the board.")
        
        if self._creates_threats(move, board):
            positive_aspects.append("This move creates threats against your opponent.")
        
        if positive_aspects:
            return " ".join(positive_aspects)
        return None

    def _analyze_what_went_wrong(self, move_analysis: Dict[str, Any], board: chess.Board, 
                                move: chess.Move, move_quality: MoveQuality, is_user_move: bool = True) -> Optional[str]:
        """Analyze what went wrong with the move."""
        if move_quality in [MoveQuality.BRILLIANT, MoveQuality.BEST]:
            return None
            
        problems = []
        
        if not is_user_move:
            # For opponent moves, focus on what they did wrong and opportunities for you
            centipawn_loss = move_analysis.get('centipawn_loss', 0)
            if centipawn_loss > 100:
                problems.append(f"Your opponent's move loses {int(centipawn_loss)} centipawns compared to the best move - this gives you an advantage.")
            elif centipawn_loss > 50:
                problems.append(f"Your opponent's move loses {int(centipawn_loss)} centipawns, which is significant.")
            elif centipawn_loss > 10:
                problems.append(f"Your opponent's move loses {int(centipawn_loss)} centipawns compared to optimal play.")
            
            if self._hangs_piece(move, board):
                problems.append("Your opponent's move hangs a piece - look for tactics to win material.")
            
            if self._weakens_king_safety(move, board):
                problems.append("Your opponent's move weakens their king's safety - consider attacking.")
            
            if self._loses_material(move, board):
                problems.append("Your opponent's move loses material without sufficient compensation.")
            
            if self._blocks_development(move, board):
                problems.append("Your opponent's move blocks the development of other pieces.")
            
            if self._creates_weaknesses(move, board):
                problems.append("Your opponent's move creates weaknesses that you can exploit.")
            
            if problems:
                return " ".join(problems)
            return None
        
        # Check centipawn loss
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        if centipawn_loss > 100:
            problems.append(f"This move loses {int(centipawn_loss)} centipawns compared to the best move.")
        elif centipawn_loss > 50:
            problems.append(f"This move loses {int(centipawn_loss)} centipawns, which is significant.")
        elif centipawn_loss > 10:
            problems.append(f"This move loses {int(centipawn_loss)} centipawns compared to optimal play.")
        
        # Check for specific tactical problems
        if self._hangs_piece(move, board):
            problems.append("This move hangs a piece, which is a serious tactical error.")
        
        if self._weakens_king_safety(move, board):
            problems.append("This move weakens your king's safety.")
        
        if self._loses_material(move, board):
            problems.append("This move loses material without sufficient compensation.")
        
        if self._blocks_development(move, board):
            problems.append("This move blocks the development of other pieces.")
        
        if self._creates_weaknesses(move, board):
            problems.append("This move creates weaknesses in your position.")
        
        if problems:
            return " ".join(problems)
        return None

    def _suggest_improvements(self, move_analysis: Dict[str, Any], board: chess.Board, 
                            move: chess.Move, move_quality: MoveQuality, 
                            player_skill_level: str, is_user_move: bool = True) -> Optional[str]:
        """Suggest how to improve the move."""
        if move_quality in [MoveQuality.BRILLIANT, MoveQuality.BEST]:
            return None
            
        suggestions = []
        
        if not is_user_move:
            # For opponent moves, suggest how you can take advantage
            if move_quality == MoveQuality.BLUNDER:
                suggestions.append("Look for immediate tactical opportunities to win material or checkmate.")
            elif move_quality == MoveQuality.MISTAKE:
                suggestions.append("Look for tactical patterns like pins, forks, or discovered attacks.")
            elif move_quality == MoveQuality.INACCURACY:
                suggestions.append("Look for ways to improve your position and create threats.")
            
            # Suggest the best move if available
            best_move = move_analysis.get('best_move')
            if best_move:
                try:
                    best_move_obj = chess.Move.from_uci(best_move)
                    best_move_san = board.san(best_move_obj)
                    suggestions.append(f"Your opponent should have played {best_move_san} instead.")
                except:
                    pass
            
            if suggestions:
                return " ".join(suggestions)
            return None
        
        # Suggest the best move if available
        best_move = move_analysis.get('best_move')
        if best_move:
            try:
                best_move_obj = chess.Move.from_uci(best_move)
                best_move_san = board.san(best_move_obj)
                suggestions.append(f"Consider {best_move_san} instead, which is the engine's top choice.")
            except:
                pass
        
        # General improvement suggestions based on move quality
        if move_quality == MoveQuality.BLUNDER:
            suggestions.append("Take more time to calculate before moving. Look for tactics and check for hanging pieces.")
        elif move_quality == MoveQuality.MISTAKE:
            suggestions.append("Before moving, consider all your opponent's possible responses and threats.")
        elif move_quality == MoveQuality.INACCURACY:
            suggestions.append("Look for moves that improve your position more significantly.")
        
        # Skill-level specific suggestions
        if player_skill_level == "beginner":
            suggestions.append("Focus on basic principles: develop pieces, control the center, and keep your king safe.")
        elif player_skill_level == "intermediate":
            suggestions.append("Look for tactical opportunities and consider the long-term consequences of your moves.")
        elif player_skill_level == "advanced":
            suggestions.append("Calculate deeper variations and consider subtle positional nuances.")
        
        if suggestions:
            return " ".join(suggestions)
        return None

    def _generate_tactical_insights(self, move_analysis: Dict[str, Any], board: chess.Board, 
                                  move: chess.Move, game_phase: GamePhase) -> List[str]:
        """Generate tactical insights about the move."""
        insights = []
        
        # Use advanced analyzer for tactical patterns
        tactical_analysis = self.advanced_analyzer.analyze_tactical_patterns(board, move)
        
        # Add insights for found patterns
        for pattern in tactical_analysis.patterns_found:
            pattern_name = pattern.value.replace('_', ' ').title()
            insights.append(f"This move demonstrates {pattern_name} - a fundamental tactical pattern in chess.")
        
        # Add tactical opportunities
        insights.extend(tactical_analysis.tactical_opportunities)
        
        # Add insights for missed patterns
        for pattern in tactical_analysis.patterns_missed:
            pattern_name = pattern.value.replace('_', ' ').title()
            insights.append(f"Consider looking for {pattern_name} opportunities in similar positions.")
        
        # Enhanced analysis for brilliant moves
        if move_analysis.get('is_brilliant', False):
            heuristic_details = move_analysis.get('heuristic_details', {})
            
            # Analyze sacrifice patterns
            see_score = heuristic_details.get('see', 0)
            if see_score < -200:
                insights.append("This is a brilliant sacrifice that gives up significant material for devastating tactical compensation.")
            elif see_score < -100:
                insights.append("This is a calculated sacrifice that trades material for powerful positional advantages.")
            
            # Analyze forcing moves
            if move_analysis.get('gives_check', False):
                insights.append("The check creates immediate threats and forces the opponent to respond defensively.")
            
            # Analyze piece coordination
            mobility_change = heuristic_details.get('mobility_change', 0)
            if mobility_change > 15:
                insights.append("This move dramatically improves piece coordination and creates multiple tactical threats.")
            
            # Analyze king safety
            king_safety_drop = heuristic_details.get('king_safety_drop', 0)
            if king_safety_drop < -30:
                insights.append("This move significantly improves king safety while maintaining attacking potential.")
        
        # Enhanced analysis for blunders
        if move_analysis.get('is_blunder', False):
            heuristic_details = move_analysis.get('heuristic_details', {})
            
            # Analyze hanging pieces
            new_hanging = heuristic_details.get('new_hanging_pieces', [])
            if new_hanging:
                for entry in new_hanging:
                    insights.append(f"The {entry['piece']} on {entry['square']} is now undefended and vulnerable to capture.")
            
            # Analyze material loss
            see_score = heuristic_details.get('see', 0)
            if see_score < -200:
                insights.append("This move involves a terrible material exchange that loses significant value.")
            elif see_score < -100:
                insights.append("This move involves a poor material exchange that loses material without compensation.")
            
            # Analyze king safety issues
            king_safety_drop = heuristic_details.get('king_safety_drop', 0)
            if king_safety_drop > 50:
                insights.append("This move severely compromises king safety, making the king vulnerable to tactical attacks.")
        
        # Add material balance insights
        if abs(tactical_analysis.material_balance) > 3:
            if tactical_analysis.material_balance > 0:
                insights.append("You have a material advantage. Look for ways to convert this into a winning position.")
            else:
                insights.append("You're behind in material. Look for tactical opportunities to equalize or create counterplay.")
        
        # Add piece activity insights
        if tactical_analysis.piece_activity_score > 20:
            insights.append("Your pieces are very active. This gives you many tactical opportunities.")
        elif tactical_analysis.piece_activity_score < 10:
            insights.append("Your pieces could be more active. Look for ways to improve their mobility.")
        
        return insights

    def _generate_positional_insights(self, move_analysis: Dict[str, Any], board: chess.Board, 
                                    move: chess.Move, game_phase: GamePhase) -> List[str]:
        """Generate positional insights about the move."""
        insights = []
        
        # Use advanced analyzer for positional concepts
        positional_analysis = self.advanced_analyzer.analyze_positional_concepts(board, move)
        
        # Add insights for improved concepts
        for concept in positional_analysis.concepts_improved:
            concept_name = concept.value.replace('_', ' ').title()
            insights.append(f"This move improves {concept_name} - an important positional principle.")
        
        # Add insights for weakened concepts
        for concept in positional_analysis.concepts_weakened:
            concept_name = concept.value.replace('_', ' ').title()
            insights.append(f"This move weakens {concept_name} - be careful about this in future positions.")
        
        # Add positional advantages
        insights.extend(positional_analysis.positional_advantages)
        
        # Add positional weaknesses
        insights.extend(positional_analysis.positional_weaknesses)
        
        # Add space advantage insights
        if positional_analysis.space_advantage > 5:
            insights.append("You have a space advantage. Use it to restrict your opponent's pieces and create threats.")
        elif positional_analysis.space_advantage < -5:
            insights.append("Your opponent has more space. Look for ways to break through or create counterplay.")
        
        # Add piece coordination insights
        if positional_analysis.piece_coordination_score > 60:
            insights.append("Your pieces are well coordinated. This creates powerful attacking and defensive possibilities.")
        elif positional_analysis.piece_coordination_score < 40:
            insights.append("Your pieces could work together better. Look for ways to improve their coordination.")
        
        # Add pawn structure insights
        if positional_analysis.pawn_structure_score > 60:
            insights.append("Your pawn structure is solid. This provides a strong foundation for your pieces.")
        elif positional_analysis.pawn_structure_score < 40:
            insights.append("Your pawn structure has weaknesses. Be careful about pawn moves and consider pawn breaks.")
        
        # Game phase specific insights
        if game_phase == GamePhase.OPENING:
            insights.append("In the opening, focus on rapid development and controlling the center.")
        elif game_phase == GamePhase.MIDDLEGAME:
            insights.append("In the middlegame, look for tactical opportunities and improve your piece placement.")
        elif game_phase == GamePhase.ENDGAME:
            insights.append("In the endgame, king activity and pawn promotion become crucial.")
        
        return insights

    def _analyze_risks(self, move_analysis: Dict[str, Any], board: chess.Board, 
                      move: chess.Move, move_quality: MoveQuality) -> List[str]:
        """Analyze the risks associated with the move."""
        risks = []
        
        if self._hangs_piece(move, board):
            risks.append("This move hangs a piece, which could lead to material loss.")
        
        if self._weakens_king_safety(move, board):
            risks.append("This move weakens king safety, making your king vulnerable to attack.")
        
        if self._creates_weaknesses(move, board):
            risks.append("This move creates weaknesses that your opponent can exploit.")
        
        if self._loses_material(move, board):
            risks.append("This move loses material without sufficient compensation.")
        
        if self._blocks_development(move, board):
            risks.append("This move blocks the development of other pieces, slowing your progress.")
        
        return risks

    def _analyze_benefits(self, move_analysis: Dict[str, Any], board: chess.Board, 
                        move: chess.Move, move_quality: MoveQuality) -> List[str]:
        """Analyze the benefits of the move."""
        benefits = []
        
        if self._improves_king_safety(move, board):
            benefits.append("This move improves your king's safety.")
        
        if self._controls_center(move, board):
            benefits.append("This move helps control the center of the board.")
        
        if self._develops_piece(move, board):
            benefits.append("This move develops a piece, bringing it into active play.")
        
        if self._creates_threats(move, board):
            benefits.append("This move creates threats against your opponent.")
        
        if self._improves_piece_coordination(move, board):
            benefits.append("This move improves the coordination between your pieces.")
        
        return benefits

    def _generate_learning_points(self, move_analysis: Dict[str, Any], board: chess.Board, 
                                move: chess.Move, move_quality: MoveQuality, 
                                game_phase: GamePhase) -> List[str]:
        """Generate learning points from the move."""
        learning_points = []
        
        # General learning points based on move quality
        if move_quality == MoveQuality.BRILLIANT:
            learning_points.append("Study this position to understand what made this move brilliant.")
            learning_points.append("Look for similar tactical patterns in your future games.")
        elif move_quality == MoveQuality.BLUNDER:
            learning_points.append("Always check for hanging pieces before moving.")
            learning_points.append("Take time to calculate your opponent's threats.")
        elif move_quality == MoveQuality.MISTAKE:
            learning_points.append("Consider all your opponent's possible responses before moving.")
            learning_points.append("Look for tactical patterns you might have missed.")
        
        # Game phase specific learning points
        if game_phase == GamePhase.OPENING:
            learning_points.append("In the opening, prioritize rapid development and center control.")
        elif game_phase == GamePhase.MIDDLEGAME:
            learning_points.append("In the middlegame, look for tactical opportunities and improve piece placement.")
        elif game_phase == GamePhase.ENDGAME:
            learning_points.append("In the endgame, king activity and pawn promotion are crucial.")
        
        return learning_points

    def _determine_encouragement_level(self, move_quality: MoveQuality, 
                                     move_analysis: Dict[str, Any]) -> int:
        """Determine the encouragement level (1-5) for the move."""
        if move_quality == MoveQuality.BRILLIANT:
            return 5
        elif move_quality == MoveQuality.BEST:
            return 4
        elif move_quality == MoveQuality.GOOD:
            return 3
        elif move_quality == MoveQuality.ACCEPTABLE:
            return 2
        elif move_quality == MoveQuality.INACCURACY:
            return 2
        elif move_quality == MoveQuality.MISTAKE:
            return 1
        elif move_quality == MoveQuality.BLUNDER:
            return 1
        else:
            return 3

    # Helper methods for analyzing move characteristics
    def _is_developing_move(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move develops a piece."""
        piece = board.piece_at(move.from_square)
        if not piece:
            return False
        
        # Check if it's moving a piece from its starting position
        if piece.piece_type == chess.PAWN:
            return move.from_square in [chess.A2, chess.B2, chess.C2, chess.D2, 
                                      chess.E2, chess.F2, chess.G2, chess.H2,
                                      chess.A7, chess.B7, chess.C7, chess.D7,
                                      chess.E7, chess.F7, chess.G7, chess.H7]
        elif piece.piece_type in [chess.KNIGHT, chess.BISHOP]:
            return move.from_square in [chess.A1, chess.B1, chess.C1, chess.D1,
                                      chess.E1, chess.F1, chess.G1, chess.H1,
                                      chess.A8, chess.B8, chess.C8, chess.D8,
                                      chess.E8, chess.F8, chess.G8, chess.H8]
        return False

    def _improves_king_safety(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move improves king safety."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return move == chess.Move.from_uci("e1g1") or move == chess.Move.from_uci("e8g8")  # Castling

    def _weakens_king_safety(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move weakens king safety."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _controls_center(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move controls center squares."""
        center_squares = [chess.D4, chess.D5, chess.E4, chess.E5]
        return move.to_square in center_squares

    def _creates_threats(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move creates threats."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _hangs_piece(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move hangs a piece."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _loses_material(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move loses material."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _blocks_development(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move blocks development."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _creates_weaknesses(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move creates weaknesses."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _creates_pin(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move creates a pin."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _creates_fork(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move creates a fork."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _creates_skewer(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move creates a skewer."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _creates_discovered_attack(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move creates a discovered attack."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _creates_double_attack(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move creates a double attack."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _misses_tactical_opportunity(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move misses a tactical opportunity."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _affects_center_control(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move affects center control."""
        return self._controls_center(move, board)

    def _affects_piece_activity(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move affects piece activity."""
        return self._develops_piece(move, board)

    def _affects_king_safety(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move affects king safety."""
        return self._improves_king_safety(move, board) or self._weakens_king_safety(move, board)

    def _affects_pawn_structure(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move affects pawn structure."""
        piece = board.piece_at(move.from_square)
        return piece and piece.piece_type == chess.PAWN

    def _affects_space_advantage(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move affects space advantage."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _develops_piece(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move develops a piece."""
        return self._is_developing_move(move, board)

    def _improves_piece_coordination(self, move: chess.Move, board: chess.Board) -> bool:
        """Check if the move improves piece coordination."""
        # This is a simplified check - in practice, you'd need more sophisticated analysis
        return False

    def _is_opening_book_move(self, move_analysis: Dict[str, Any]) -> bool:
        """Check if this is a standard opening book move that should get educational treatment."""
        # Check if it's in the opening phase (first 15 moves)
        move_number = move_analysis.get('fullmove_number', 0)
        if move_number > 15:
            return False
        
        # Check if it's a standard opening move (best move with low centipawn loss)
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        is_best = move_analysis.get('is_best', False)
        
        # If it's the best move with minimal loss, it's likely a book move
        if is_best and centipawn_loss <= 10:
            return True
        
        # Also consider good moves in opening as potential book moves
        is_good = move_analysis.get('is_good', False)
        if is_good and centipawn_loss <= 25:
            return True
        
        return False

    def _generate_evaluation_aware_comment(self, move_quality: MoveQuality, move_analysis: Dict[str, Any], is_user_move: bool = True) -> str:
        """Generate evaluation-aware coaching comments that match the actual position evaluation."""
        # Import the enhanced comment generator
        from .enhanced_comment_generator import EnhancedCommentGenerator
        
        # Create enhanced generator instance
        enhanced_generator = EnhancedCommentGenerator()
        
        # Get board and move objects
        board = move_analysis.get('board_before')
        move = move_analysis.get('move')
        
        if board and move:
            # Use enhanced comment generation
            return enhanced_generator.generate_enhanced_comment(move_analysis, board, move, is_user_move)
        
        # Fallback to original logic if enhanced generation fails
        evaluation_before = move_analysis.get('evaluation_before', 0)
        evaluation_after = move_analysis.get('evaluation_after', 0)
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        
        # Calculate evaluation change
        evaluation_change = evaluation_after - evaluation_before
        
        # Determine if this is an opening move
        move_number = move_analysis.get('fullmove_number', 0)
        is_opening = move_number <= 15
        
        if move_quality == MoveQuality.BEST:
            if is_opening:
                return "Book move."
            elif abs(evaluation_change) < 10:  # Minimal evaluation change
                return "This is the best move available and maintains the current position. You're playing accurately and keeping the position balanced."
            else:
                return f"This is the strongest move available. {'It improves your position' if evaluation_change > 0 else 'It maintains your position well'} with optimal play."
        
        elif move_quality == MoveQuality.GREAT:
            if is_opening:
                return "Book move."
            elif abs(evaluation_change) < 10:  # Minimal evaluation change
                return "This is a very strong move that maintains the current position well. You're playing accurately and keeping things balanced."
            elif evaluation_change > 0:
                return f"This is a great move that improves your position by about {abs(evaluation_change)} centipawns. You're showing strong chess understanding."
            else:
                return "This is a great move that maintains your position well. You're playing accurately and keeping the position balanced."
        
        elif move_quality == MoveQuality.EXCELLENT:
            if is_opening:
                return "Book move."
            elif abs(evaluation_change) < 10:
                return "This is an excellent move that maintains the current position. You're playing solidly and keeping things balanced."
            elif evaluation_change > 0:
                return f"This is an excellent move that slightly improves your position. You're showing good chess fundamentals."
            else:
                return "This is an excellent move that maintains your position well. You're playing solidly and keeping the position balanced."
        
        elif move_quality == MoveQuality.GOOD:
            if is_opening:
                return "Book move."
            elif abs(evaluation_change) < 10:
                return "This is a good move that maintains the current position. You're playing solidly and keeping things balanced."
            elif evaluation_change > 0:
                return f"This is a good move that slightly improves your position. You're making sound decisions."
            else:
                return "This is a good move that maintains your position well. You're playing solidly and keeping the position balanced."
        
        elif move_quality == MoveQuality.ACCEPTABLE:
            if is_opening:
                return "Book move."
            elif centipawn_loss > 0:
                return f"This move is acceptable but loses about {int(centipawn_loss)} centipawns compared to the best move. There were stronger options available."
            else:
                return "This move is acceptable but not the most accurate. There were stronger options available that could have improved your position."
        
        else:
            # Fall back to original templates for other qualities
            templates = self.encouragement_templates[move_quality]
            return random.choice(templates)

    def _generate_opening_explanation(self, move_analysis: Dict[str, Any], is_user_move: bool = True) -> str:
        """Generate educational explanation for opening moves instead of hype."""
        move_san = move_analysis.get('move_san', '')
        move_number = move_analysis.get('fullmove_number', 0)
        
        # Get opening information if available
        opening_name = self._get_opening_name_from_context(move_analysis)
        
        if opening_name:
            if is_user_move:
                return f"This is a standard move in the {opening_name}. {self._get_opening_educational_context(opening_name, move_san, move_number)}"
            else:
                return f"Your opponent played a standard move in the {opening_name}. {self._get_opening_educational_context(opening_name, move_san, move_number)}"
        else:
            # Generic opening explanation
            if is_user_move:
                return f"This is a solid opening move. {self._get_generic_opening_principle(move_san, move_number)}"
            else:
                return f"Your opponent played a solid opening move. {self._get_generic_opening_principle(move_san, move_number)}"

    def _get_opening_name_from_context(self, move_analysis: Dict[str, Any]) -> str:
        """Try to identify the opening name from the move context."""
        # Try to get opening info from the move analysis if available
        opening_info = move_analysis.get('opening_info', {})
        if opening_info and opening_info.get('name'):
            return opening_info['name']
        
        # Get the move sequence context if available
        move_sequence = move_analysis.get('move_sequence', [])
        if not move_sequence:
            return ""
        
        # Basic opening identification based on common patterns
        if len(move_sequence) >= 2:
            first_two = move_sequence[:2]
            if first_two == ['e4', 'e5']:
                return "King's Pawn Game"
            elif first_two == ['e4', 'c5']:
                return "Sicilian Defense"
            elif first_two == ['e4', 'e6']:
                return "French Defense"
            elif first_two == ['e4', 'c6']:
                return "Caro-Kann Defense"
            elif first_two == ['d4', 'd5']:
                return "Queen's Pawn Game"
            elif first_two == ['d4', 'Nf6']:
                return "Indian Defense"
            elif first_two == ['e4', 'd5']:
                return "Scandinavian Defense"
            elif first_two == ['e4', 'Nf6']:
                return "Alekhine Defense"
        
        # Try to identify from longer sequences
        if len(move_sequence) >= 3:
            first_three = move_sequence[:3]
            if first_three == ['e4', 'e5', 'Nf3']:
                return "King's Pawn Game"
            elif first_three == ['e4', 'e5', 'Bc4']:
                return "Bishop's Opening"
            elif first_three == ['e4', 'e5', 'Nc3']:
                return "Vienna Game"
            elif first_three == ['e4', 'c5', 'Nf3']:
                return "Sicilian Defense"
            elif first_three == ['e4', 'e6', 'd4']:
                return "French Defense"
            elif first_three == ['e4', 'c6', 'd4']:
                return "Caro-Kann Defense"
        
        return ""

    def _get_opening_educational_context(self, opening_name: str, move_san: str, move_number: int) -> str:
        """Get educational context about the opening move."""
        educational_contexts = {
            "King's Pawn Game": "This follows classical opening principles by controlling the center and preparing for rapid piece development. The key ideas are to control central squares (d4, d5, e4, e5) and develop pieces to active squares.",
            "Sicilian Defense": "This is the most popular response to 1.e4, creating an asymmetrical position that leads to complex tactical battles. Black aims to control the d4 square and create counterplay on the queenside.",
            "French Defense": "This solid defense focuses on controlling the center with pawns and preparing for counterplay on the queenside. The typical plan involves ...c5 to challenge White's center and ...f6 to break through.",
            "Caro-Kann Defense": "This reliable opening emphasizes solid pawn structure and gradual piece development. Black avoids early pawn weaknesses and aims for a solid, defensive setup.",
            "Queen's Pawn Game": "This follows modern opening principles by controlling the center and preparing for flexible piece development. White can choose from many different systems depending on Black's response.",
            "Indian Defense": "This hypermodern approach allows White to control the center with pawns while Black develops pieces to challenge it later. The key is to avoid overextending and maintain piece activity.",
            "Scandinavian Defense": "This direct approach immediately challenges White's center pawn. While it can lead to tactical complications, it requires precise play to avoid falling behind in development.",
            "Alekhine Defense": "This provocative opening invites White to advance pawns and then attack them with pieces. It requires good tactical awareness and understanding of pawn weaknesses.",
            "Bishop's Opening": "This classical opening develops the bishop to an active square early. It can transpose into other openings or lead to independent lines with rapid development.",
            "Vienna Game": "This opening combines central control with piece development. It often leads to tactical positions where both sides have active piece play."
        }
        
        return educational_contexts.get(opening_name, "This move follows established opening theory and helps develop your position according to sound chess principles.")

    def _get_generic_opening_principle(self, move_san: str, move_number: int) -> str:
        """Get generic opening principle explanation."""
        if move_number <= 3:
            return "In the early opening, focus on controlling the center (d4, d5, e4, e5), developing pieces quickly to active squares, and ensuring king safety. Avoid moving the same piece twice and don't bring out the queen too early."
        elif move_number <= 8:
            return "Continue developing pieces to active squares while maintaining control of the center and preparing for castling. Connect your rooks and avoid creating pawn weaknesses. The goal is to complete development before launching attacks."
        else:
            return "Complete your development, castle your king to safety, and prepare for the middlegame by connecting your rooks and improving piece coordination. Look for tactical opportunities while maintaining a solid position."
