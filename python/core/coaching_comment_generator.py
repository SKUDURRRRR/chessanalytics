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
from .ai_comment_generator import AIChessCommentGenerator
from .tal_greetings import TAL_GREETINGS
import random


class MoveQuality(Enum):
    """Classification of move quality for coaching purposes."""
    BRILLIANT = "brilliant"
    BEST = "best"
    EXCELLENT = "excellent"  # Merged great+excellent (5-25cp loss)
    GOOD = "good"  # Merged good+acceptable (25-100cp loss)
    INACCURACY = "inaccuracy"
    MISTAKE = "mistake"
    BLUNDER = "blunder"
    # Keep old values for backward compatibility
    GREAT = "excellent"  # Alias
    ACCEPTABLE = "good"  # Alias


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
        # Initialize AI comment generator (will be None if API key not configured)
        print("[COACHING] Initializing ChessCoachingGenerator...")
        try:
            print("[COACHING] Attempting to initialize AI comment generator...")
            self.ai_generator = AIChessCommentGenerator()
            if self.ai_generator and self.ai_generator.enabled:
                print(f"[COACHING] ✅ AI comment generator initialized successfully!")
                print(f"[COACHING] ✅ Model: {self.ai_generator.config.ai_model}")
                print(f"[COACHING] ✅ Ready to generate Tal-style comments")
            elif self.ai_generator:
                print("[COACHING] ⚠️  AI comment generator created but disabled")
                print(f"[COACHING] ⚠️  Check: AI_ENABLED={self.ai_generator.config.ai_enabled}")
                print(f"[COACHING] ⚠️  Check: API key present={bool(self.ai_generator.config.anthropic_api_key)}")
            else:
                print("[COACHING] ❌ AI comment generator not available")
        except Exception as e:
            import traceback
            print(f"[COACHING] ❌ AI comment generator not available: {e}")
            print(f"[COACHING] Traceback: {traceback.format_exc()}")
            self.ai_generator = None
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
        is_user_move: bool = True,
        previous_phase: Optional[GamePhase] = None
    ) -> CoachingComment:
        """Generate comprehensive coaching comment for a move.

        Priority hierarchy (highest to lowest):
        1. Critical tactical issues (checkmate, hanging queen/rook, forced mate)
        2. Major tactical issues (blunders, mistakes, hanging pieces)
        3. Move-specific analysis (brilliant, inaccuracies, good moves)
        4. Contextual commentary (position descriptions, phase transitions, generic advice)
        """

        # Determine move quality
        move_quality = self._determine_move_quality(move_analysis)

        # Use board_after from move_analysis if available (position after the move), otherwise use board
        board_after = move_analysis.get('board_after', board)

        # PRIORITY 0: Player's first move greeting - ALWAYS show greeting for player's first move
        move_number = move_analysis.get('fullmove_number', 0)
        ply_index = move_analysis.get('ply_index', None)
        is_player_first_move = is_user_move and move_number == 1 and (ply_index is None or ply_index in [1, 2])

        if is_player_first_move:
            # Get player_elo from move_analysis if available, otherwise use a default
            player_elo = move_analysis.get('player_elo', 1200)
            greeting = self._generate_move_1_welcome_comment(board_after, move, player_elo, move_analysis, is_user_move)
            if greeting:
                # Use greeting as main comment, skip tactical analysis for first move
                main_comment = greeting
            else:
                # Fallback if greeting generation fails
                main_comment = "Welcome to the game! The pieces are ready, and so are you. Let's see what magic you create today!"
        else:
            # PRIORITY 1 & 2: Check if this is a critical/major tactical move that MUST be highlighted
            # These always take priority over generic position descriptions
            has_critical_tactical_issue = self._has_critical_tactical_issue(move_analysis)

            # PRIORITY 3 & 4: Only use special comments (position descriptions, etc.) if no critical tactical issues
            # This ensures tactical accuracy is always prioritized over generic commentary
            special_comment = None
            if not has_critical_tactical_issue:
                special_comment = self._check_for_special_comments(move_analysis, board_after, move, game_phase, previous_phase, is_user_move, player_skill_level)

            if special_comment:
                # Use special comment (only if no critical tactical issues)
                main_comment = special_comment
            else:
                # Generate main comment (move-specific analysis or tactical commentary)
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
        elif move_analysis.get('is_excellent', False) or move_analysis.get('is_great', False):
            return MoveQuality.EXCELLENT  # Merged great+excellent
        elif move_analysis.get('is_good', False) or move_analysis.get('is_acceptable', False):
            return MoveQuality.GOOD  # Merged good+acceptable
        elif move_analysis.get('is_inaccuracy', False):
            return MoveQuality.INACCURACY
        elif move_analysis.get('is_mistake', False):
            return MoveQuality.MISTAKE
        elif move_analysis.get('is_blunder', False):
            return MoveQuality.BLUNDER
        else:
            return MoveQuality.GOOD  # Default to good instead of acceptable

    def _should_use_ai_comment(self, move_analysis: Dict[str, Any], move_quality: MoveQuality) -> bool:
        """Determine if this move warrants AI/Tal-style commentary vs template-based comments."""
        move_number = move_analysis.get('fullmove_number', 0)
        # Check if this is a user move (default to True if not specified)
        is_user_move = move_analysis.get('is_user_move', True)

        # First check: special comments (move 1 welcome, position update windows) always use AI
        # Both White's first move and Black's first move have fullmove_number == 1
        # Additional check: ensure this is actually one of the first two moves (ply 1 or 2) if ply_index is available
        ply_index = move_analysis.get('ply_index', None)
        if move_number == 1:
            # If ply_index is available, verify it's one of the first two moves
            # Otherwise, just trust fullmove_number == 1
            if ply_index is None or ply_index in [1, 2]:
                return True
        if is_user_move and self._is_in_position_update_window(move_number):
            return True

        # Always use AI for significant move types (learning moments!)
        if move_quality in [MoveQuality.BRILLIANT, MoveQuality.BLUNDER, MoveQuality.MISTAKE, MoveQuality.INACCURACY]:
            return True

        # Check if routine - if so, don't use AI (unless it's already a significant move type above)
        if self._is_routine_move(move_analysis, move_quality):
            return False

        # Use AI if tactical insights present (forks, pins, skewers, etc.)
        tactical_insights = move_analysis.get('tactical_insights', [])
        if tactical_insights and len(tactical_insights) > 0:
            return True

        # Use AI for significant positional shifts (>30cp)
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        if centipawn_loss > 30:
            return True

        # Use AI for important captures (piece captures, not simple pawn captures)
        if self._is_significant_capture(move_analysis):
            return True

        # Use AI for excellent and best moves (celebration moments and important decisions)
        if move_quality in [MoveQuality.EXCELLENT, MoveQuality.BEST]:
            return True

        # Use AI for "good" moves that have some positional impact (>15cp) - more opportunities for Tal-style commentary
        if move_quality == MoveQuality.GOOD and centipawn_loss > 15:
            return True

        return False

    def _is_significant_capture(self, move_analysis: Dict[str, Any]) -> bool:
        """Check if this is a capture move.

        All captures are considered significant enough to warrant AI commentary,
        as even pawn captures can have important tactical/positional implications.
        """
        move_san = move_analysis.get('move_san', '')

        # Check for capture notation in SAN
        if 'x' in move_san:
            print(f"[CAPTURE DETECTION] {move_san} is a capture - will use AI commentary")
            return True

        # Double-check with board state if available
        board_before = move_analysis.get('board_before')
        move = move_analysis.get('move')

        if board_before and move:
            try:
                # Check if there's a piece on the target square
                captured_piece = board_before.piece_at(move.to_square)
                if captured_piece:
                    print(f"[CAPTURE DETECTION] {move_san} captures piece on {chess.square_name(move.to_square)} - will use AI commentary")
                    return True
            except Exception as e:
                print(f"[CAPTURE DETECTION] Error checking capture: {e}")

        return False

    def _is_routine_move(self, move_analysis: Dict[str, Any], move_quality: MoveQuality) -> bool:
        """Check if this is a routine move that should use templates instead of AI."""
        # Book moves are routine (but not if it's a brilliant/best move - those might still warrant AI commentary)
        if self._is_opening_book_move(move_analysis) and move_quality not in [MoveQuality.BRILLIANT, MoveQuality.BEST]:
            return True

        # Simple captures (pawn captures) are routine
        move_san = move_analysis.get('move_san', '')
        if move_san and 'x' in move_san:
            board_before = move_analysis.get('board_before')
            move = move_analysis.get('move')
            if board_before and move:
                try:
                    captured_piece = board_before.piece_at(move.to_square)
                    if captured_piece and captured_piece.piece_type == 1:  # Pawn capture
                        # Only routine if it's a quiet/good move with low centipawn loss
                        centipawn_loss = move_analysis.get('centipawn_loss', 0)
                        if centipawn_loss <= 25 and move_quality in [MoveQuality.BEST, MoveQuality.GOOD]:
                            return True
                except Exception:
                    pass

        # Quiet moves with minimal impact are routine (but not "best" moves - those might still be interesting)
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        tactical_insights = move_analysis.get('tactical_insights', [])
        # Only mark as routine if it's GOOD (not BEST) and truly quiet
        if (centipawn_loss <= 25 and
            not tactical_insights and
            move_quality == MoveQuality.GOOD):
            return True

        return False

    def _has_critical_tactical_issue(self, move_analysis: Dict[str, Any]) -> bool:
        """Check if move has critical tactical issues that should override generic position descriptions.

        These are moves that MUST be commented on tactically, not with generic positional descriptions:
        - Blunders (hanging pieces, major material loss)
        - Mistakes (significant evaluation drops)
        - Inaccuracies (moderate evaluation drops)
        - Brilliant moves (tactical sacrifices, forcing sequences)
        """
        # PRIORITY 1: Critical blunders (checkmate, hanging queen/rook)
        if move_analysis.get('is_blunder', False):
            return True

        # PRIORITY 2: Major tactical issues (mistakes, hanging valuable pieces)
        if move_analysis.get('is_mistake', False):
            return True

        # PRIORITY 2.5: Inaccuracies should be highlighted (not overridden by position descriptions)
        if move_analysis.get('is_inaccuracy', False):
            return True

        # PRIORITY 3: Brilliant moves (always highlight these!)
        if move_analysis.get('is_brilliant', False):
            return True

        # Check for hanging pieces (critical tactical issue)
        heuristic_details = move_analysis.get('heuristic_details', {})
        new_hanging = heuristic_details.get('new_hanging_pieces', [])
        if new_hanging:
            # Any hanging pieces should be highlighted (even pawns in some contexts)
            for hanging in new_hanging:
                piece_symbol = hanging.get('piece', '').upper()
                # Critical: Queen, Rook always mentioned
                if piece_symbol in ['Q', 'R']:
                    return True
                # Important: Knight, Bishop mentioned if it's a mistake/blunder
                if piece_symbol in ['N', 'B'] and (move_analysis.get('is_mistake', False) or move_analysis.get('is_blunder', False)):
                    return True

        # Check for significant material loss (SEE < -100)
        see_score = heuristic_details.get('see', 0)
        if see_score < -100:  # Losing at least a pawn worth without compensation
            return True

        # CRITICAL: Captures should ALWAYS be highlighted with move-specific commentary
        # (not generic position descriptions)
        move_san = move_analysis.get('move_san', '')
        if 'x' in move_san:
            print(f"[CRITICAL_TACTICAL] {move_san} is a CAPTURE - must use move-specific commentary, not position description")
            return True

        # Check for significant evaluation drop (>100cp loss = inaccuracy threshold)
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        if centipawn_loss > 100:  # Inaccuracy threshold
            return True

        return False

    def _is_in_position_update_window(self, move_number: int) -> bool:
        """Check if a move number falls in a position update window.

        Windows are: 5-10, 14-17, 21-24, 28-31, 35-38, etc.
        Formula: For moves >= 14, window_start = ((move_number - 14) // 7) * 7 + 14
        Each window spans 4 moves.
        """
        # Moves 5-10: position update
        if 5 <= move_number <= 10:
            return True

        # Moves 14-17, 21-24, 28-31, etc.
        if move_number >= 14:
            window_start = ((move_number - 14) // 7) * 7 + 14
            window_end = window_start + 3
            if window_start <= move_number <= window_end:
                return True

        return False

    def _check_for_special_comments(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move,
        game_phase: GamePhase,
        previous_phase: Optional[GamePhase],
        is_user_move: bool,
        player_elo: int
    ) -> Optional[str]:
        """Check if this move warrants a special Tal-style comment (move 1, position update windows, phase transitions)."""
        move_number = move_analysis.get('fullmove_number', 0)
        # Use player_elo from move_analysis if available, otherwise use parameter
        player_elo = move_analysis.get('player_elo', player_elo)

        # Move 1: Welcome comment (for both user's and opponent's first move)
        # Both White's first move and Black's first move have fullmove_number == 1
        # Additional check: ensure this is actually one of the first two moves (ply 1 or 2) if ply_index is available
        ply_index = move_analysis.get('ply_index', None)
        if move_number == 1:
            # If ply_index is available, verify it's one of the first two moves
            # Otherwise, just trust fullmove_number == 1
            if ply_index is None or ply_index in [1, 2]:
                return self._generate_move_1_welcome_comment(board, move, player_elo, move_analysis, is_user_move)

        # Position descriptions: Windows 5-10, 14-17, 21-24, 28-31, etc.
        # NOTE: Tactical issues are already filtered at the top level (in generate_coaching_comment)
        # So if we reach here, it's safe to use position descriptions
        if is_user_move and self._is_in_position_update_window(move_number):
            return self._generate_position_description_comment(move_analysis, board, move, move_number, player_elo)

        # Phase transitions: Opening -> Middlegame
        if previous_phase == GamePhase.OPENING and game_phase == GamePhase.MIDDLEGAME:
            return self._generate_phase_transition_comment(move_analysis, board, move, "middlegame", player_elo)

        # Phase transitions: Middlegame -> Endgame
        if previous_phase == GamePhase.MIDDLEGAME and game_phase == GamePhase.ENDGAME:
            return self._generate_phase_transition_comment(move_analysis, board, move, "endgame", player_elo)

        return None

    def _generate_move_1_welcome_comment(self, board: chess.Board, move: chess.Move, player_elo: int, move_analysis: Optional[Dict[str, Any]] = None, is_user_move: bool = True) -> Optional[str]:
        """Generate a Tal-inspired welcoming comment for the first move."""
        if not self.ai_generator or not self.ai_generator.enabled:
            # Use instant Tal greetings instead of waiting for AI
            if is_user_move:
                return random.choice(TAL_GREETINGS)
            else:
                return "The game begins! Your opponent makes their first move. The adventure is underway!"

        # Get move_san from move_analysis if available, otherwise try to get from board
        if move_analysis and 'move_san' in move_analysis:
            move_san = move_analysis['move_san']
        else:
            # Board is already after the move, so we need to get SAN differently
            # Create a temporary board before the move to get SAN
            try:
                temp_board = board.copy()
                temp_board.pop()  # Go back to before the move
                move_san = temp_board.san(move)
            except:
                move_san = move.uci() if hasattr(move, 'uci') else str(move)

        # Get player color - CRITICAL for correct greeting
        player_color = move_analysis.get('player_color', 'white') if move_analysis else 'white'
        color_name = player_color.capitalize()  # "White" or "Black"

        fen_after = board.fen()  # Board is already after the move

        # Build special prompt for move 1
        if is_user_move:
            # Personal greeting for the player's first move
            prompt = f"""The player is playing as {color_name} (rated {player_elo} ELO) and has just made their first move: {move_san}.

**YOUR MISSION:**
Write a warm, personal GREETING to the player (1-2 sentences MAXIMUM, 20-30 words total).

**CRITICAL RULES:**
- This is a GREETING, NOT move analysis
- The player is playing as {color_name}, but DO NOT mention "{color_name}" or "White" or "Black" in your greeting
- ALWAYS use "you", "your", "yours" - never mention the color name
- Do NOT say "White" or "Black" anywhere in the greeting
- Do NOT say "It's wonderful to see {color_name}" or "{color_name}'s moment" or anything like that
- Do NOT mention the move name ({move_san}) or analyze what it does
- Do NOT include meta-descriptions like "*Mikhail Tal's voice*" or stage directions
- Do NOT explain chess concepts or the position
- Just write a direct, warm greeting using "you/your" as if you're welcoming a friend to play chess
- Be encouraging, playful, and make them feel good about starting the game

**EXAMPLES OF GOOD GREETINGS:**
- "Welcome to the board! The pieces are ready, and so are you. Let's see what magic you create today!"
- "The adventure begins! Every game is a new story waiting to unfold. Enjoy the journey!"
- "Welcome! The board is your canvas, and these pieces are your tools. Let's make this game memorable!"

**BAD EXAMPLES (DO NOT DO THIS):**
- "*Mikhail Tal's voice greets you*" (no meta-text)
- "e4 is a strong opening move" (no move analysis)
- "This move controls the center" (no chess explanations)

Write ONLY the greeting text, nothing else:"""
        else:
            # For opponent's first move, keep it simpler
            move_owner = "the opponent"
            prompt = f"""Welcome! {move_owner.capitalize()} rated {player_elo} ELO has just made their first move: {move_san}.

**THE POSITION AFTER {move_san}:**
{fen_after}

**YOUR MISSION:**
Write a warm, inspiring, Tal-style welcome comment (2 sentences MAXIMUM) that:
- Welcomes the game with enthusiasm and charm
- Uses Tal's playful, imaginative language
- Makes chess feel like an exciting adventure about to begin
- Avoids being too long or instructional - just a warm welcome
- Acknowledge the opponent's first move and the game beginning

**STYLE:** Channel Mikhail Tal's energy: "Welcome to the deep dark forest where 2+2=5! The pieces are ready, the board awaits. Let's see what adventure unfolds."

Write the welcome comment now:"""

        try:
            # Use the helper method with fallback
            if is_user_move:
                # Personal greeting system prompt for player's first move
                system_prompt = """You are greeting a chess player as they start their game. Write a warm, direct greeting (1-2 sentences, 20-30 words).

CRITICAL:
- Write ONLY the greeting text, no meta-descriptions, no stage directions, no move analysis
- Do NOT mention the move name or what it does
- Do NOT include text like "*Mikhail Tal's voice*" or any meta-commentary
- Just write a simple, warm, encouraging greeting as if welcoming a friend to play chess
- Be playful and energetic, but keep it concise and direct"""
            else:
                # Standard welcome for opponent's move
                system_prompt = "You are Mikhail Tal, the Magician from Riga. You welcome players to chess with warmth and enthusiasm, helping them understand the game with your creative, tactical spirit. Focus on teaching and building chess understanding while appreciating the adventure and tactical possibilities ahead."

            comment = self.ai_generator._call_api_with_fallback(
                prompt=prompt,
                system=system_prompt,
                max_tokens=150,  # Reduced for welcome comments (2 sentences max)
                temperature=0.9  # Higher creativity for welcome
            )

            if comment:
                # Don't convert to color - keep "you/your" pronouns
                comment = self.ai_generator._clean_comment(comment, convert_to_color=False)
                # Remove meta-text patterns (stage directions, voice descriptions, etc.)
                # Remove patterns like "*Mikhail Tal's voice*" or "*...*" at the start
                import re
                comment = re.sub(r'^\*[^*]+\*', '', comment, flags=re.IGNORECASE)
                # Remove any remaining asterisk-wrapped meta-text anywhere in the comment
                comment = re.sub(r'\*[^*]+\*', '', comment, flags=re.IGNORECASE)

                # CRITICAL: Replace ALL color references with "you/your"
                # First, replace contractions like "White'll", "White'd", "White've"
                comment = re.sub(r'\b(White|Black)\'ll\b', r"you'll", comment, flags=re.IGNORECASE)
                comment = re.sub(r'\b(White|Black)\'d\b', r"you'd", comment, flags=re.IGNORECASE)
                comment = re.sub(r'\b(White|Black)\'ve\b', r"you've", comment, flags=re.IGNORECASE)
                comment = re.sub(r'\b(White|Black)\'re\b', r"you're", comment, flags=re.IGNORECASE)

                # Replace possessive forms
                comment = re.sub(r'\b(White|Black)\'?s\b', 'your', comment, flags=re.IGNORECASE)

                # Replace "the White" or "the Black" with "you"
                comment = re.sub(r'\bthe\s+(White|Black)\b', 'you', comment, flags=re.IGNORECASE)

                # Replace "have White here" or "have Black here" with "have you here"
                comment = re.sub(r'\bhave\s+(White|Black)\s+here\b', 'have you here', comment, flags=re.IGNORECASE)
                comment = re.sub(r'\bto\s+have\s+(White|Black)\s+here\b', 'to have you here', comment, flags=re.IGNORECASE)

                # Replace color + verb patterns (most common issue)
                # Catch patterns like "White weave", "White create", "White play", "White has", etc.
                verbs = r'(weave|creates?|makes?|plays?|starts?|begins?|shows?|demonstrates?|brings?|builds?|develops?|forms?|takes?|gains?|loses?|controls?|dominates?|attacks?|defends?|moves?|advances?|retreats?|sacrifices?|exchanges?|trades?|improves?|weakens?|strengthens?|establishes?|challenges?|undermines?|maintains?|unleashes?|unleash|has|have|had|do|does|did|will|would|could|should|can|may|might|is|are|was|were|be|been|being)'
                comment = re.sub(r'\b(White|Black)\s+' + verbs, r'you \2', comment, flags=re.IGNORECASE)

                # Fix grammar: "you has" -> "you have" (third person to second person)
                comment = re.sub(r'\byou\s+has\b', 'you have', comment, flags=re.IGNORECASE)
                comment = re.sub(r'\byou\s+does\b', 'you do', comment, flags=re.IGNORECASE)
                comment = re.sub(r'\byou\s+is\b', 'you are', comment, flags=re.IGNORECASE)

                # Special case: "White has in store" -> "you have in store"
                comment = re.sub(r'\b(White|Black)\s+has\s+in\s+store\b', 'you have in store', comment, flags=re.IGNORECASE)
                comment = re.sub(r'\b(White|Black)\s+have\s+in\s+store\b', 'you have in store', comment, flags=re.IGNORECASE)

                # Replace color + noun patterns
                nouns = r'(moment|turn|move|game|adventure|journey|magic|pieces?|board|side|position|strategy|plan|idea|concept|approach|style|way|path|road|story|tale|tale|narrative|experience|challenge|opportunity|chance|time|day|night|opening|middlegame|endgame|phase|stage)'
                comment = re.sub(r'\b(White|Black)\s+' + nouns, r'your \2', comment, flags=re.IGNORECASE)

                # Replace "see White" or "see Black" with "see you"
                comment = re.sub(r'\bsee\s+(White|Black)\b', 'see you', comment, flags=re.IGNORECASE)

                # Replace "watch White" or "watch Black" with "watch you"
                comment = re.sub(r'\bwatch\s+(White|Black)\b', 'watch you', comment, flags=re.IGNORECASE)

                # Replace standalone "White" or "Black" at start of sentences/clauses
                comment = re.sub(r'^(White|Black)\s+', 'You ', comment, flags=re.IGNORECASE)
                comment = re.sub(r'[.!?]\s+(White|Black)\s+', r'. You ', comment, flags=re.IGNORECASE)

                # Catch any remaining standalone "White" or "Black" that might refer to the player
                # This is a catch-all for edge cases
                comment = re.sub(r'\b(White|Black)\s+(in|on|at|with|for|to|from)\s+', r'you \2 ', comment, flags=re.IGNORECASE)

                # Final aggressive pass: Replace any remaining "White" or "Black" in common greeting contexts
                # Patterns like "magic White" or "magic Black" -> "magic you"
                comment = re.sub(r'\b(magic|adventure|journey|game|story|tale|brilliant|great|excellent|good|amazing|wonderful|fantastic|incredible|spectacular)\s+(White|Black)\b', r'\1 you', comment, flags=re.IGNORECASE)
                # Patterns like "White in this game" -> "you in this game"
                comment = re.sub(r'\b(White|Black)\s+in\s+(this|the)\s+game\b', r'you in \2 game', comment, flags=re.IGNORECASE)
                # Patterns like "see the moves White has" -> "see the moves you have"
                comment = re.sub(r'\b(moves?|strategies?|plans?|ideas?|concepts?|approaches?)\s+(White|Black)\s+has\b', r'\1 you have', comment, flags=re.IGNORECASE)
                comment = re.sub(r'\b(White|Black)\s+has\s+(moves?|strategies?|plans?|ideas?|concepts?|approaches?)\b', r'you have \2', comment, flags=re.IGNORECASE)

                # Final aggressive pass: Replace any remaining standalone "White" or "Black"
                # in contexts that clearly refer to the player (after "see", "watch", "masterpiece", etc.)
                # This catches patterns like "see the masterpiece White'll create" -> "see the masterpiece you'll create"
                comment = re.sub(r'\b(the|a|an)\s+(masterpiece|magic|adventure|journey|game|story|tale|brilliance|genius|skill|talent|artistry|creativity|strategy|plan|idea|concept|approach|style|way|path|road|narrative|experience|challenge|opportunity|chance)\s+(White|Black)\b', r'\1 \2 you', comment, flags=re.IGNORECASE)

                # Catch remaining standalone "White" or "Black" before verbs (most common remaining case)
                # This is a very aggressive catch-all for any remaining color references
                comment = re.sub(r'\b(White|Black)\s+(will|would|could|should|can|may|might|shall)\s+', r'you \2 ', comment, flags=re.IGNORECASE)

                # ULTRA-AGGRESSIVE: Catch any remaining "White" or "Black" followed by any word
                # This is a final safety net for any color references we might have missed
                # Only apply if it's clearly referring to the player (after "see", "watch", "brilliance", etc.)
                comment = re.sub(r'\b(brilliance|brilliant|magic|adventure|masterpiece|genius|skill|talent|artistry|creativity)\s+(White|Black)\s+(\w+)', r'\1 you \3', comment, flags=re.IGNORECASE)

                # Final catch-all: Replace any standalone "White" or "Black" that appears in contexts
                # where it clearly refers to the player (after "see", "watch", "let's see", etc.)
                comment = re.sub(r'\b(see|watch|let\'?s\s+see|can\'?t\s+wait\s+to\s+see)\s+(the\s+)?(brilliance|brilliant|magic|adventure|masterpiece|genius|skill|talent|artistry|creativity|what)\s+(White|Black)\s+', r'\1 \2\3 you ', comment, flags=re.IGNORECASE)

                # Specific pattern for "Let's see the brilliance White unleash" -> "Let's see the brilliance you unleash"
                comment = re.sub(r'\blet\'?s\s+see\s+(the\s+)?(brilliance|brilliant|magic|adventure|masterpiece|genius|skill|talent|artistry|creativity|what)\s+(White|Black)\s+', r"let's see \1\2 you ", comment, flags=re.IGNORECASE)

                # Ultra-final catch-all: Any "White" or "Black" that's clearly the subject of a sentence
                # and appears before a verb (catches remaining cases like "White unleash")
                comment = re.sub(r'\b(White|Black)\s+([a-z]+)\s+(today|tomorrow|now|here|there)', r'you \2 \3', comment, flags=re.IGNORECASE)

                # FINAL FINAL catch-all: Replace ANY remaining "White" or "Black" that appears
                # as a standalone word in contexts that suggest it's the player
                # This is the absolute last resort to catch anything we missed
                # Only apply to patterns that clearly refer to the player (not opponent)
                # This catches "White unleash", "White create", etc. in any context
                comment = re.sub(r'\b(White|Black)\s+([a-z]{2,})\s+', r'you \2 ', comment, flags=re.IGNORECASE)

                # EXTRA SAFETY: One more pass for "brilliance White" -> "brilliance you"
                # (catches cases where there's no space or different spacing)
                comment = re.sub(r'\b(brilliance|brilliant|magic|adventure|masterpiece|genius|skill|talent|artistry|creativity)\s+(White|Black)\s+', r'\1 you ', comment, flags=re.IGNORECASE)

                # Clean up extra spaces
                comment = re.sub(r'\s+', ' ', comment).strip()
                # Remove leading/trailing punctuation artifacts
                comment = re.sub(r'^[,\s\.]+', '', comment)
                comment = re.sub(r'[,\s\.]+$', '', comment)
                print(f"[AI] ✅ Generated move 1 welcome comment: {comment[:50]}...")
                return comment
            else:
                # AI generation failed, fallback to instant Tal greeting
                if is_user_move:
                    print(f"[AI] ⚠️ AI generation returned empty, using instant Tal greeting")
                    return random.choice(TAL_GREETINGS)
                return None
        except Exception as e:
            print(f"[AI] Failed to generate move 1 welcome: {e}")
            import traceback
            print(f"[AI] Traceback: {traceback.format_exc()}")
            # Fallback to instant Tal greeting on error
            if is_user_move:
                print(f"[AI] ⚠️ Using instant Tal greeting as fallback")
                return random.choice(TAL_GREETINGS)
            return None

    def _generate_position_description_comment(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move,
        move_number: int,
        player_elo: int
    ) -> Optional[str]:
        """Generate a Tal-style description of how the position is taking shape (moves 5-10)."""
        if not self.ai_generator or not self.ai_generator.enabled:
            return None  # Only use AI for this

        move_san = move_analysis.get('move_san', '')
        fen_after = board.fen()
        tactical_insights = move_analysis.get('tactical_insights', [])
        positional_insights = move_analysis.get('positional_insights', [])

        tactical_context = ""
        if tactical_insights:
            tactical_context = "\n**TACTICAL IDEAS BEGINNING TO EMERGE:**\n" + "\n".join(f"- {insight}" for insight in tactical_insights[:2])

        positional_context = ""
        if positional_insights:
            positional_context = "\n**POSITIONAL THEMES TAKING SHAPE:**\n" + "\n".join(f"- {insight}" for insight in positional_insights[:2])

        prompt = f"""A player rated {player_elo} ELO just played move {move_number}: {move_san}. The position is starting to take shape!

**THE POSITION AFTER {move_san}:**
{fen_after}
{tactical_context}{positional_context}

**YOUR MISSION:**
Write a Tal-style comment (2 sentences MAXIMUM) describing how the position is developing. Focus on teaching and analysis:

- Describe the key characteristics: Is it sharp? Solid? Dynamic? Tense?
- Explain the tactical and positional features clearly: piece activity, center control, king safety
- Focus on concrete chess concepts the player can learn from
- Use occasional metaphors only if they help clarify a concept

**STYLE:** Engaging and instructive, explaining the position's key features clearly while building understanding.

Write the position description now:"""

        try:
            # Use the helper method with fallback
            comment = self.ai_generator._call_api_with_fallback(
                prompt=prompt,
                system="You are Mikhail Tal, the Magician from Riga. You analyze chess positions clearly, explaining their key features and teaching what matters with your tactical vision. Focus on concrete chess concepts while appreciating the tactical possibilities and creative opportunities in the position.",
                max_tokens=150,  # Reduced for position descriptions (2 sentences max)
                temperature=0.85
            )

            if comment:
                comment = self.ai_generator._clean_comment(comment)
                print(f"[AI] ✅ Generated position description for move {move_number}: {comment[:50]}...")
                return comment
        except Exception as e:
            print(f"[AI] Failed to generate position description: {e}")
            import traceback
            print(f"[AI] Traceback: {traceback.format_exc()}")

        return None

    def _generate_phase_transition_comment(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move,
        new_phase: str,
        player_elo: int
    ) -> Optional[str]:
        """Generate a Tal-style comment when transitioning between game phases."""
        if not self.ai_generator or not self.ai_generator.enabled:
            # Fallback templates
            if new_phase == "middlegame":
                return "The opening has ended. The pieces are developed, and now the real battle begins—the middlegame, where tactics and strategy collide."
            elif new_phase == "endgame":
                return "The middlegame gives way to the endgame. Now precision and technique become paramount, where every move counts."
            return None

        move_san = move_analysis.get('move_san', '')
        fen_after = board.fen()
        piece_count = len(board.piece_map())

        phase_description = "middlegame" if new_phase == "middlegame" else "endgame"
        phase_character = "tactics and strategy collide" if new_phase == "middlegame" else "precision and technique become paramount"

        prompt = f"""A player rated {player_elo} ELO just played {move_san}, and we've entered the {phase_description}!

**THE POSITION:**
{fen_after}
**PIECES ON BOARD:** {piece_count}

**YOUR MISSION:**
Write a Tal-style comment (2 sentences MAXIMUM) explaining the transition to the {phase_description}. Focus on teaching what this phase means:

- Acknowledge the phase transition clearly
- Explain what this phase means strategically: "{phase_character}"
- Teach the key principles and priorities for this phase
- Focus on concrete chess concepts: what to look for, what matters most

**STYLE:** Engaging and instructive, explaining the phase transition and what it means for the game.

**EXAMPLES:**
- For middlegame: "The opening has ended. The pieces are developed, and now the middlegame begins—where tactics and strategy combine. Focus on piece coordination, tactical opportunities, and improving your position."
- For endgame: "The middlegame gives way to the endgame. Precision becomes crucial—activate your king, push passed pawns, and coordinate your pieces to support pawn promotion."

Write the phase transition comment now:"""

        try:
            # Use the helper method with fallback
            comment = self.ai_generator._call_api_with_fallback(
                prompt=prompt,
                system="You are Mikhail Tal, the Magician from Riga. You explain chess phases clearly, teaching what each phase means strategically with your creative, tactical perspective. Focus on the principles and priorities for each phase while appreciating the tactical opportunities each phase offers.",
                max_tokens=150,  # Reduced for phase transitions (2 sentences max)
                temperature=0.85
            )

            if comment:
                comment = self.ai_generator._clean_comment(comment)
                print(f"[AI] ✅ Generated {new_phase} transition comment: {comment[:50]}...")
                return comment
        except Exception as e:
            print(f"[AI] Failed to generate phase transition comment: {e}")
            import traceback
            print(f"[AI] Traceback: {traceback.format_exc()}")

        return None

    def _generate_main_comment(self, move_quality: MoveQuality, move_analysis: Dict[str, Any], is_user_move: bool = True) -> str:
        """Generate the main coaching comment with detailed explanations."""
        # Check if this move warrants AI commentary
        should_use_ai = self._should_use_ai_comment(move_analysis, move_quality)

        # Try AI generation first if available and move is significant
        if should_use_ai and self.ai_generator and self.ai_generator.enabled:
            try:
                # Get board from move_analysis - it should be the board AFTER the move
                board = move_analysis.get('board_after')
                move_raw = move_analysis.get('move')
                player_elo = move_analysis.get('player_elo', 1200)  # Default to middle of target range

                # Convert move to chess.Move object if it's a string
                move = None
                if move_raw:
                    try:
                        if isinstance(move_raw, str):
                            move = chess.Move.from_uci(move_raw)
                        elif hasattr(move_raw, 'to_square'):
                            # Already a chess.Move object
                            move = move_raw
                        else:
                            move = chess.Move.from_uci(str(move_raw))
                    except Exception as e:
                        print(f"[AI] Warning: Could not convert move to chess.Move: {e}, move={move_raw}")
                        move = None

                # Debug logging
                if not board:
                    print("[AI] Warning: board_after not found in move_analysis, skipping AI generation")
                elif not move:
                    print("[AI] Warning: move not found or invalid in move_analysis, skipping AI generation")
                elif board and move:
                    # Check if AI comment was pre-generated in parallel
                    pre_generated = move_analysis.get('_pre_generated_ai_comment')
                    if pre_generated:
                        print(f"[AI] ✅ Using pre-generated AI comment for {move_analysis.get('move_san', 'unknown')}")
                        return self._limit_comment_length(pre_generated)

                    # Otherwise generate synchronously (fallback for non-parallel path)
                    print(f"[AI] ✅ Attempting to generate AI comment for move {move_analysis.get('move_san', 'unknown')}, quality: {move_quality}, is_user_move: {is_user_move}")
                    ai_comment = self.ai_generator.generate_comment(
                        move_analysis=move_analysis,
                        board=board,
                        move=move,
                        is_user_move=is_user_move,
                        player_elo=player_elo
                    )
                    if ai_comment:
                        print(f"[AI] ✅ Successfully generated AI comment ({len(ai_comment)} chars): {ai_comment[:100]}...")
                        return self._limit_comment_length(ai_comment)
                    else:
                        print(f"[AI] ❌ AI generator returned None for {move_analysis.get('move_san', 'unknown')}, falling back to templates")
            except Exception as e:
                import traceback
                print(f"[AI] AI comment generation failed, falling back to templates: {e}")
                print(f"[AI] Traceback: {traceback.format_exc()}")
                # Fall through to template-based generation
        elif should_use_ai:
            if not self.ai_generator:
                print("[AI] AI generator not available (not initialized), using templates")
            elif not self.ai_generator.enabled:
                print("[AI] AI generator is disabled, using templates")

        # Fallback to template-based generation
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

        # Add positional context for non-brilliant, non-best moves
        if move_quality not in [MoveQuality.BRILLIANT, MoveQuality.BEST]:
            board_after = move_analysis.get('board_after')
            if board_after:
                positional_context = self._generate_positional_context(move_analysis, board_after, game_phase)
                if positional_context:
                    comment = f"{comment} {positional_context}"

        # Limit to 3-4 sentences maximum for concise, readable comments
        # Frontend expandable UI handles display, but we keep comments concise at the source
        return self._limit_comment_length(comment, max_sentences=4)

    def _limit_comment_length(self, comment: str, max_sentences: int = 4) -> str:
        """Limit comment to 3-4 sentences maximum for concise, readable coaching comments.

        Frontend expandable UI handles display truncation, but we keep comments concise
        at the source to ensure they're focused and digestible.
        """
        if not comment:
            return comment

        # Clean up any trailing incomplete sentences (ending with ".." or incomplete)
        comment = comment.strip()
        # Remove trailing ellipsis or incomplete endings
        while comment.endswith('..') or comment.endswith('...'):
            comment = comment[:-1].strip()

        # Split by sentence endings
        sentences = []
        current_sentence = ""

        for char in comment:
            current_sentence += char
            if char in '.!?':
                sentence = current_sentence.strip()
                # Only add complete sentences (ending with proper punctuation)
                if sentence and sentence.endswith(('.', '!', '?')):
                    sentences.append(sentence)
                current_sentence = ""

        # Only add remaining text if it ends with proper punctuation
        remaining = current_sentence.strip()
        if remaining and remaining.endswith(('.', '!', '?')):
            sentences.append(remaining)

        # Filter out any incomplete sentences (those ending with ".." or without punctuation)
        complete_sentences = [s for s in sentences if s and s.endswith(('.', '!', '?')) and not s.endswith('..')]

        # If no complete sentences, return original (might be a single sentence without punctuation)
        if not complete_sentences:
            # If original ends properly, return it
            if comment.endswith(('.', '!', '?')):
                return comment
            # Otherwise, return first part up to last complete sentence
            return comment

        # Limit to max_sentences
        if len(complete_sentences) <= max_sentences:
            return " ".join(complete_sentences)

        # Take first max_sentences complete sentences
        result = " ".join(complete_sentences[:max_sentences])

        # Ensure it ends with proper punctuation (should already, but double-check)
        if not result.endswith(('.', '!', '?')):
            result += "."

        return result

    def _generate_opponent_move_comment(self, move_quality: MoveQuality, move_analysis: Dict[str, Any]) -> str:
        """Generate coaching comment for opponent moves using color-based references."""
        # Get opponent color from move_analysis
        opponent_color = move_analysis.get('player_color', 'black')
        color_name = opponent_color.capitalize()  # "White" or "Black"

        opponent_templates = {
            MoveQuality.BRILLIANT: [
                f"{color_name} played a brilliant move! This shows strong tactical vision.",
                f"Excellent move by {color_name}. This demonstrates advanced chess understanding.",
                f"{color_name} found a very strong move. Study this position to understand the tactics.",
                f"Outstanding play by {color_name}. This is the kind of move that wins games."
            ],
            MoveQuality.BEST: [
                f"{color_name} played the best move available. This is solid, accurate play.",
                f"Strong move by {color_name}. They found the optimal continuation.",
                f"{color_name} played precisely. This maintains their position well.",
                f"Good move by {color_name}. They're playing accurately."
            ],
            MoveQuality.GREAT: [
                f"{color_name} played a great move! This shows excellent chess understanding.",
                f"Very strong move by {color_name}. They found a move that significantly improves their position.",
                f"{color_name} played excellently. This demonstrates advanced tactical awareness.",
                f"Great play by {color_name}. This kind of move shows strong chess skills."
            ],
            MoveQuality.EXCELLENT: [
                f"{color_name} played an excellent move! This shows good chess fundamentals.",
                f"Very well played by {color_name}. They found a move that maintains their position well.",
                f"{color_name} played excellently. This demonstrates solid chess understanding.",
                f"Excellent move by {color_name}. This shows good tactical awareness."
            ],
            MoveQuality.GOOD: [
                f"{color_name} made a good move. This maintains a solid position.",
                f"Decent move by {color_name}. They're playing reasonably well.",
                f"{color_name} played a solid move. Nothing spectacular, but sound.",
                f"Good choice by {color_name}. This keeps their position healthy."
            ],
            MoveQuality.ACCEPTABLE: [
                f"{color_name}'s move is acceptable, but not the strongest choice.",
                f"Playable move by {color_name}, though better options were available.",
                f"{color_name}'s move works, but it's not optimal.",
                f"Acceptable move by {color_name}, but room for improvement."
            ],
            MoveQuality.INACCURACY: [
                f"{color_name} made an inaccuracy. This creates an opportunity.",
                f"{color_name}'s move has some issues. Look for ways to exploit this.",
                f"Inaccurate move by {color_name}. This weakens their position slightly.",
                f"{color_name} missed a better move. Take advantage of this."
            ],
            MoveQuality.MISTAKE: [
                f"{color_name} made a mistake! This significantly weakens their position.",
                f"{color_name}'s move has problems. This is a good opportunity.",
                f"Mistake by {color_name}. Look for tactical opportunities.",
                f"{color_name}'s move creates difficulties for them. Exploit this."
            ],
            MoveQuality.BLUNDER: [
                f"{color_name} blundered! This is a major error to exploit.",
                f"{color_name} made a serious mistake. Look for winning tactics.",
                f"Blunder by {color_name}! This could be game-changing.",
                f"{color_name}'s move is a significant error. Find the refutation."
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

        # Check for tactical patterns (SEE-based sacrifice detection)
        heuristic_details = move_analysis.get('heuristic_details', {})
        see_score = heuristic_details.get('see', 0)

        # ONLY call it a sacrifice if SEE shows we're actually losing material in the exchange
        # (not just playing a move that's slightly worse than the best move)
        if see_score < -100:  # Significant material sacrifice
            explanations.append("This is a brilliant tactical sacrifice")
            explanations.append("that creates devastating threats")
        elif see_score < -50:  # Moderate sacrifice (at least half a pawn worth)
            explanations.append("with a calculated sacrifice")
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
        # Get player color for reference
        player_color = move_analysis.get('player_color', 'white')
        color_name = player_color.capitalize()  # "White" or "Black"

        if explanations:
            base = "🌟 Outstanding! This move demonstrates exceptional tactical vision. "
            base += f"{color_name} found a brilliant resource that "

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
                base += f"{color_name} found a brilliant resource that even strong players might miss. "
            else:
                base += f"{color_name} found a brilliant resource that shows advanced tactical vision. "

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

        # Avoid centipawn numbers; describe the impact plainly
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        if centipawn_loss > 500:
            problems.append("drops a piece or more without compensation")
        elif centipawn_loss > 200:
            problems.append("loses significant material")
        elif centipawn_loss > 100:
            problems.append("loses material")

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
                problems.append("Your opponent's move loses material or creates serious weaknesses — seize the chance.")
            elif centipawn_loss > 50:
                problems.append("Your opponent's move weakens their position noticeably.")
            elif centipawn_loss > 10:
                problems.append("Your opponent missed a stronger option; look to improve your position.")

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

        # Avoid centipawn loss phrasing; speak plainly
        centipawn_loss = move_analysis.get('centipawn_loss', 0)
        if centipawn_loss > 100:
            problems.append("This move loses material compared to a better line.")
        elif centipawn_loss > 50:
            problems.append("This move weakens your position and hands the initiative to your opponent.")
        elif centipawn_loss > 10:
            problems.append("This move lets your opponent equalize or improve easily.")

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
                suggestions.append(f"Consider {best_move_san} instead.")
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

            # Analyze sacrifice patterns (SEE shows actual material loss in exchange)
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
        is_great = move_analysis.get('is_great', False)
        is_excellent = move_analysis.get('is_excellent', False)
        is_good = move_analysis.get('is_good', False)

        # If it's the best move with minimal loss, it's likely a book move
        if is_best and centipawn_loss <= 10:
            return True

        # Also consider great/excellent/good moves in opening as potential book moves
        if (is_great or is_excellent or is_good) and centipawn_loss <= 25:
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

        # Check if this is a capture (to add to template comment as backup if AI failed)
        move_san = move_analysis.get('move_san', '')
        capture_prefix = ""
        if 'x' in move_san and board and move:
            try:
                captured_piece = board.piece_at(move.to_square)
                if captured_piece:
                    piece_names = {
                        chess.PAWN: "pawn",
                        chess.KNIGHT: "knight",
                        chess.BISHOP: "bishop",
                        chess.ROOK: "rook",
                        chess.QUEEN: "queen",
                        chess.KING: "king"
                    }
                    piece_name = piece_names.get(captured_piece.piece_type, "piece")
                    color = "white" if captured_piece.color == chess.WHITE else "black"
                    capture_prefix = f"By capturing the {color} {piece_name}, "
                    print(f"[TEMPLATE FALLBACK] Adding capture info to template comment: {capture_prefix}")
            except Exception as e:
                print(f"[TEMPLATE FALLBACK] Error adding capture info: {e}")

        if move_quality == MoveQuality.BEST:
            if is_opening:
                return self._generate_opening_explanation(move_analysis, is_user_move)
            elif abs(evaluation_change) < 10:
                return f"{capture_prefix}this keeps the position balanced and safe. Best move."
            else:
                return f"{capture_prefix}this improves your position and follows sound principles. Best move."

        elif move_quality == MoveQuality.GREAT:
            if is_opening:
                return self._generate_opening_explanation(move_analysis, is_user_move)
            elif abs(evaluation_change) < 10:
                return f"{capture_prefix}you maintain control and keep things balanced. Great move."
            elif evaluation_change > 0:
                return f"{capture_prefix}you clearly improve your position. Great move."
            else:
                return f"{capture_prefix}you keep your position solid. Great move."

        elif move_quality == MoveQuality.EXCELLENT:
            if is_opening:
                return self._generate_opening_explanation(move_analysis, is_user_move)
            elif abs(evaluation_change) < 10:
                return f"{capture_prefix}you keep everything under control. Excellent move."
            elif evaluation_change > 0:
                return f"{capture_prefix}you strengthen your position. Excellent move."
            else:
                return f"{capture_prefix}you hold the balance well. Excellent move."

        elif move_quality == MoveQuality.GOOD:
            if is_opening:
                return self._generate_opening_explanation(move_analysis, is_user_move)
            elif abs(evaluation_change) < 10:
                return f"{capture_prefix}you keep a playable position. Good move."
            elif evaluation_change > 0:
                return f"{capture_prefix}you improve your position. Good move."
            else:
                return f"{capture_prefix}you keep the position safe. Good move."

        elif move_quality == MoveQuality.ACCEPTABLE:
            if is_opening:
                return self._generate_opening_explanation(move_analysis, is_user_move)
            elif centipawn_loss > 0:
                return f"{capture_prefix}this is playable, but a stronger option was available."
            else:
                return f"{capture_prefix}this is acceptable, though not the most accurate."

        else:
            # Fall back to original templates for other qualities
            templates = self.encouragement_templates[move_quality]
            return random.choice(templates)

    def _generate_opening_explanation(self, move_analysis: Dict[str, Any], is_user_move: bool = True) -> str:
        """Generate educational opening move explanations."""
        move_number = move_analysis.get('fullmove_number', 0)
        move_san = move_analysis.get('move_san', '')

        if move_number == 1:
            # First move - keep it short and Tal'ish to cheer up the player
            return "The adventure begins! Time to bring out your forces and claim the center."
        elif move_number <= 3:
            return f"Book move. {move_san} is a fundamental opening move that helps control the center and develop your position."
        elif move_number <= 6:
            return f"Book move. {move_san} follows established opening theory and helps develop your pieces effectively."
        elif move_number <= 10:
            return f"Book move. {move_san} is a well-known opening continuation that maintains good piece coordination."
        else:
            return f"Book move. {move_san} is a standard opening move that follows sound chess principles."

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

    def _generate_positional_context(self, move_analysis: Dict[str, Any], board: chess.Board, game_phase: str) -> str:
        """Generate rich positional context based on material balance, game phase, and position evaluation."""
        context_parts = []

        # Get material balance from heuristic details
        heuristic_details = move_analysis.get('heuristic_details', {})
        material_balance = heuristic_details.get('material_balance', 0)
        evaluation_after = move_analysis.get('evaluation_after', 0)
        move_number = move_analysis.get('fullmove_number', 0)

        # Convert evaluation to material perspective (positive = white better, negative = black better)
        # evaluation_after is already in centipawns from white's perspective

        # Add game phase specific advice
        if game_phase == 'opening' or move_number <= 15:
            development_advice = [
                "Look to develop knights and bishops toward the center.",
                "Focus on developing pieces and controlling the center.",
                "Consider castling to ensure king safety.",
                "Control central squares with pawns and pieces.",
                "Develop pieces before moving the same piece twice."
            ]
            # Use move number for consistency
            context_parts.append(development_advice[move_number % len(development_advice)])

        elif game_phase == 'middlegame' or (move_number > 15 and move_number <= 40):
            middlegame_advice = [
                "Look for tactical opportunities and threats.",
                "Evaluate pawn structure and weak squares.",
                "Look for ways to improve piece placement.",
                "Search for tactical motifs like pins, forks, or skewers."
            ]
            context_parts.append(middlegame_advice[move_number % len(middlegame_advice)])

        elif game_phase == 'endgame' or move_number > 40:
            endgame_advice = [
                "Activate your king - it's a strong piece in the endgame.",
                "Push passed pawns and restrict opponent's pawns.",
                "Look for opportunities to create passed pawns.",
                "Coordinate pieces to support pawn advancement.",
                "Calculate carefully - precision matters in the endgame."
            ]
            context_parts.append(endgame_advice[move_number % len(endgame_advice)])

        # Add material balance context
        # Material balance is in centipawns (100 = 1 pawn)
        if abs(material_balance) >= 300:  # 3 or more pawns
            if material_balance > 0:
                context_parts.append("White is up material and should look to convert the advantage.")
            else:
                context_parts.append("Black is up material. White needs to create counterplay.")
        elif abs(material_balance) >= 100:  # 1-3 pawns
            if material_balance > 0:
                context_parts.append("White is up material. Black needs to create counterplay.")
            else:
                context_parts.append("Black is up material. White needs to create counterplay.")

        # Add evaluation-based context (only if significantly different from material)
        # evaluation_after is in centipawns from white's perspective
        if abs(evaluation_after) >= 200 and abs(evaluation_after - material_balance) >= 100:
            # Significant positional imbalance
            if evaluation_after > 0:
                if evaluation_after > material_balance + 100:
                    context_parts.append("White has strong positional compensation.")
            else:
                if evaluation_after < material_balance - 100:
                    context_parts.append("Black has strong positional compensation.")

        return " ".join(context_parts) if context_parts else ""
