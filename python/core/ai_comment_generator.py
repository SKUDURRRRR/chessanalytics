"""
AI-Powered Chess Comment Generator using Claude (Anthropic)

This module uses Anthropic's Claude models to generate human-like,
educational chess comments tailored for players rated 600-1800 ELO.

Features:
- Automatic model fallback: Tries known working models first, then falls back
  to configured or optional models if the primary model fails
- Supports multiple Claude models:
  - claude-3-haiku-20240307 (recommended: fastest, cheapest, most reliable)
  - claude-3-sonnet-20240229 (good balance of quality and cost)
  - claude-3-5-sonnet-20241022 (best quality, may not be available to all API keys)
- Graceful error handling with clear logging for debugging
"""

import os
import re
from pathlib import Path
from typing import Dict, Any, Optional
from enum import Enum
import chess
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Try to import Anthropic, but make it optional
try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    Anthropic = None  # type: ignore

# Load environment variables from .env.local files
BASE_DIR = Path(__file__).resolve().parent.parent
# Load from python/.env.local first (highest priority)
load_dotenv(BASE_DIR / '.env.local', override=True)
# Then python/.env
load_dotenv(BASE_DIR / '.env', override=False)
# Then root .env.local
load_dotenv(BASE_DIR.parent / '.env.local', override=False)
# Finally root .env (lowest priority)
load_dotenv(BASE_DIR.parent / '.env', override=False)


class AIConfig(BaseSettings):
    """Configuration for AI comment generation.

    Model options:
    - claude-3-haiku-20240307 (recommended: fastest, cheapest, most reliable)
    - claude-3-sonnet-20240229 (good balance of quality and cost)
    - claude-3-5-sonnet-20241022 (best quality, may not be available to all API keys)

    The system will automatically fall back to working models if the configured
    model is not available.
    """
    anthropic_api_key: Optional[str] = None
    ai_enabled: bool = True
    ai_model: str = "claude-3-haiku-20240307"  # Recommended: most reliable, fastest, cheapest
    max_tokens: int = 200  # Reduced to enforce shorter comments (3-4 sentences max)
    temperature: float = 0.85  # Higher creativity for Tal-inspired playful, imaginative style

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Manual override: Check for AI_MODEL (without double prefix) as fallback
        # Pydantic with env_prefix="AI_" looks for AI_AI_MODEL, but we also support AI_MODEL
        # Always check AI_MODEL directly from environment (common in .env.local files)
        direct_model = os.getenv("AI_MODEL")
        if direct_model:
            self.ai_model = direct_model
            print(f"[AI] Using AI_MODEL from environment: {direct_model}")

    class Config:
        env_prefix = "AI_"
        case_sensitive = False
        extra = "ignore"


class MoveQuality(Enum):
    """Move quality classifications."""
    BRILLIANT = "brilliant"
    BEST = "best"
    EXCELLENT = "excellent"
    GOOD = "good"
    INACCURACY = "inaccuracy"
    MISTAKE = "mistake"
    BLUNDER = "blunder"


class AIChessCommentGenerator:
    """
    Generates human-like chess comments using Claude (Anthropic) models.

    Features automatic model fallback - if the configured model is unavailable,
    it will automatically try working alternatives in order of reliability.

    Designed for players rated 600-1800 ELO, providing:
    - Clear, simple explanations
    - Educational context
    - Encouraging tone (inspired by Mikhail Tal's playful style)
    - No technical jargon without explanation

    The comment generation uses a Tal-inspired system prompt that makes
    chess feel alive and emotional, focusing on principles and ideas rather
    than just evaluation numbers.
    """

    def __init__(self):
        print("[AI] Initializing AIChessCommentGenerator...")
        self.config = AIConfig()
        print(f"[AI] Config loaded - Model: {self.config.ai_model}, Enabled: {self.config.ai_enabled}")
        print(f"[AI] API Key present: {bool(self.config.anthropic_api_key)}")
        self.client = None
        self.enabled = False

        # Check if Anthropic package is available
        if not ANTHROPIC_AVAILABLE:
            print("[AI] ❌ Warning: Anthropic package not installed. AI comments will be disabled.")
            print("[AI] Install with: pip install anthropic>=0.18.0")
            return

        print("[AI] ✅ Anthropic package is available")

        # Initialize Anthropic client if API key is available
        api_key = None
        if self.config.anthropic_api_key:
            api_key = self.config.anthropic_api_key
            print("[AI] Found API key in config.anthropic_api_key")
        else:
            # Try to get from environment variable directly
            api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("AI_ANTHROPIC_API_KEY")
            if api_key:
                print("[AI] Found API key in environment variable")
            else:
                print("[AI] ⚠️  No API key found in config or environment variables")

        if api_key:
            try:
                # Mask API key for logging (show first 10 and last 4 chars)
                masked_key = f"{api_key[:10]}...{api_key[-4:]}" if len(api_key) > 14 else "***"
                print(f"[AI] Attempting to initialize Anthropic client with key: {masked_key}")
                print(f"[AI] Model from config: {self.config.ai_model}")
                print(f"[AI] AI_ENABLED from config: {self.config.ai_enabled}")
                self.client = Anthropic(api_key=api_key)
                self.enabled = self.config.ai_enabled
                if self.enabled:
                    print(f"[AI] ✅ Anthropic client initialized successfully!")
                    print(f"[AI] ✅ Model: {self.config.ai_model}")
                    print(f"[AI] ✅ AI enabled: {self.enabled}")
                    # Test the model by trying to list available models (if possible) or just confirm setup
                    print(f"[AI] Ready to generate comments with model: {self.config.ai_model}")
                else:
                    print(f"[AI] ⚠️  Anthropic client initialized but AI is disabled (AI_ENABLED={self.config.ai_enabled})")
                    print(f"[AI] ⚠️  Set AI_ENABLED=true in your .env file to enable AI comments")
            except Exception as e:
                print(f"[AI] ❌ Warning: Failed to initialize Anthropic client: {e}")
                import traceback
                print(f"[AI] Traceback: {traceback.format_exc()}")
                self.enabled = False
        else:
            print("[AI] ⚠️  No API key available, AI comments will be disabled")
            print("[AI] ⚠️  Check your .env.local file for ANTHROPIC_API_KEY")

    def generate_comment(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move,
        is_user_move: bool = True,
        player_elo: int = 1200  # Default to middle of target range
    ) -> Optional[str]:
        """
        Generate an AI-powered comment for a chess move.

        Args:
            move_analysis: Dictionary containing move analysis data
            board: Chess board position after the move
            move: The chess move being analyzed
            is_user_move: Whether this is the user's move or opponent's
            player_elo: Estimated player ELO (for tailoring complexity)

        Returns:
            Generated comment string, or None if AI is disabled/failed
        """
        if not self.enabled:
            print("[AI] Generator is not enabled")
            return None

        if not self.client:
            print("[AI] Anthropic client is not initialized")
            return None

        try:
            print(f"[AI] Building prompt for move {move_analysis.get('move_san', 'unknown')}, ELO: {player_elo}")
            # Prepare prompt with move context
            prompt = self._build_prompt(move_analysis, board, move, is_user_move, player_elo)

            print(f"[AI] Calling Anthropic API with model {self.config.ai_model}")
            system_prompt = "You are Mikhail Tal, the Magician from Riga. You teach chess with energy and insight, explaining the principles behind each move. Your comments are engaging and instructive—you help players understand why moves work or fail. Focus on teaching chess concepts clearly: piece coordination, tactical patterns, positional understanding. Use occasional metaphors when they help explain, but prioritize clear analysis and principle-based teaching. You encourage creative thinking while building solid chess understanding. Never start comments with 'Ah,' 'Oh,' or similar interjections—begin directly with your commentary."

            # Use the helper method with fallback
            comment = self._call_api_with_fallback(
                prompt=prompt,
                system=system_prompt,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature
            )

            if comment:
                comment = self._clean_comment(comment, is_user_move)
                print(f"[AI] Generated comment ({len(comment)} chars): {comment[:100]}...")
                return comment

            print("[AI] Response had no content")
            return None

        except Exception as e:
            import traceback
            print(f"[AI] Error generating AI comment: {e}")
            print(f"[AI] Full traceback: {traceback.format_exc()}")
            return None

    def _clean_comment(self, comment: str, is_user_move: bool = True) -> str:
        """Remove common interjections at the start of comments and limit to 3-4 sentences maximum."""
        if not comment:
            return comment

        comment = comment.strip()
        # Remove common prefixes
        for prefix in ["Ah, ", "Ah ", "Oh, ", "Oh ", "Well, ", "Well "]:
            if comment.startswith(prefix):
                comment = comment[len(prefix):].strip()
                # Capitalize first letter if needed
                if comment and comment[0].islower():
                    comment = comment[0].upper() + comment[1:]
                break  # Only remove one prefix

        # Replace "the player's" with "your" when analyzing user's moves
        if is_user_move:
            # Use regex to replace "the player's" with "your" (case-insensitive) - handles all possessive forms
            pattern = r'\bthe player\'s\b'
            comment = re.sub(pattern, 'your', comment, flags=re.IGNORECASE)

        # Limit to 3 sentences maximum (strictly enforced)
        # Use regex to split on sentence endings (period, exclamation, question mark)
        # Split on sentence endings, keeping the punctuation
        sentence_pattern = r'([^.!?]*[.!?]+)'
        sentences = re.findall(sentence_pattern, comment)

        # If no sentences found (unlikely), try simple split
        if not sentences:
            # Fallback: split on punctuation
            parts = re.split(r'([.!?]+)', comment)
            sentences = []
            for i in range(0, len(parts) - 1, 2):
                if i + 1 < len(parts):
                    sentence = (parts[i] + parts[i + 1]).strip()
                    if sentence:
                        sentences.append(sentence)

        # Add any remaining text if it doesn't end with punctuation
        remaining = comment[len(''.join(sentences)):].strip()
        if remaining and remaining not in ''.join(sentences):
            sentences.append(remaining)

        # Filter out incomplete sentences (ending with ".." or without proper punctuation)
        complete_sentences = [s for s in sentences if s and s.endswith(('.', '!', '?')) and not s.endswith('..')]

        # If no complete sentences found, try to use original comment
        if not complete_sentences:
            # Check if original comment ends properly
            if comment.endswith(('.', '!', '?')) and not comment.endswith('..'):
                return comment.strip()
            # Otherwise, try to fix it by removing trailing ".."
            comment = comment.rstrip('.')
            if comment and not comment.endswith(('.', '!', '?')):
                comment += "."
            return comment.strip()

        # Strictly limit to 3 sentences maximum
        if len(complete_sentences) > 3:
            complete_sentences = complete_sentences[:3]

        comment = " ".join(complete_sentences)

        # Ensure it ends with proper punctuation
        if comment and not comment.endswith(('.', '!', '?')):
            comment += "."

        return comment.strip()

    def _call_api_with_fallback(
        self,
        prompt: str,
        system: str,
        max_tokens: int = None,
        temperature: float = None
    ) -> Optional[str]:
        """
        Call Anthropic API with automatic model fallback on 404 errors.

        Args:
            prompt: The user prompt
            system: The system prompt
            max_tokens: Maximum tokens (defaults to config value)
            temperature: Temperature (defaults to config value)

        Returns:
            Generated text or None if all attempts failed
        """
        if not self.enabled or not self.client:
            return None

        max_tokens = max_tokens or self.config.max_tokens
        temperature = temperature if temperature is not None else self.config.temperature

        # List of models to try (in order of preference)
        # Known working models that should be available to all API keys
        known_working_models = [
            "claude-3-haiku-20240307",     # Claude 3 Haiku (most reliable, fastest, cheapest)
            "claude-3-sonnet-20240229",    # Claude 3 Sonnet (Feb 2024 - reliable fallback)
        ]

        # Models that may not be available to all API keys
        optional_models = [
            "claude-3-5-sonnet-20241022",  # Claude 3.5 Sonnet (October 2024 - may not be available)
        ]

        # Build model list: try configured model first if it's a known working one,
        # otherwise try known working models first, then configured model, then optional models
        models_to_try = []

        # If configured model is in known working models, try it first
        if self.config.ai_model in known_working_models:
            models_to_try.append(self.config.ai_model)
            # Add other known working models
            for model in known_working_models:
                if model != self.config.ai_model:
                    models_to_try.append(model)
        else:
            # Try known working models first (they're more reliable)
            models_to_try.extend(known_working_models)
            # Then try configured model
            if self.config.ai_model not in models_to_try:
                models_to_try.append(self.config.ai_model)

        # Add optional models if not already in list
        for model in optional_models:
            if model not in models_to_try:
                models_to_try.append(model)

        # Remove duplicates while preserving order
        seen = set()
        unique_models = []
        for model in models_to_try:
            if model not in seen:
                seen.add(model)
                unique_models.append(model)

        last_error = None
        for model in unique_models:
            try:
                response = self.client.messages.create(
                    model=model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    system=system,
                    messages=[{"role": "user", "content": prompt}]
                )

                if response.content and len(response.content) > 0:
                    comment = response.content[0].text.strip()
                    if model != self.config.ai_model:
                        print(f"[AI] ✅ Successfully generated using model: {model} (configured model was {self.config.ai_model})")
                        print(f"[AI] 💡 Update your .env.local: AI_MODEL={model}")
                    return comment
            except Exception as e:
                error_msg = str(e)
                last_error = e

                # If it's a 404 (model not found), try next model
                if "404" in error_msg or "not_found" in error_msg.lower():
                    if model == self.config.ai_model:
                        print(f"[AI] ❌ Model {model} not found (404). Trying alternatives...")
                    else:
                        print(f"[AI]   Model {model} also not found (404). Trying next...")
                    continue
                else:
                    # For other errors, log but continue trying
                    print(f"[AI]   Model {model} failed with error: {error_msg}")
                    continue

        # All models failed
        print(f"[AI] ❌ All model attempts failed.")
        if last_error:
            print(f"[AI] Last error: {last_error}")
        print(f"[AI] Please check:")
        print(f"[AI]   1. Your API key has access to Claude models")
        print(f"[AI]   2. Your Anthropic account is active")
        print(f"[AI]   3. Try logging into console.anthropic.com to verify access")
        return None

    def _build_prompt(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move,
        is_user_move: bool,
        player_elo: int
    ) -> str:
        """Build a Tal-inspired prompt that explains the idea and principle behind moves."""

        # Extract key information
        move_san = move_analysis.get('move_san', '')
        move_quality = self._get_move_quality(move_analysis)
        best_move_san = move_analysis.get('best_move_san', '')
        centipawn_loss = move_analysis.get('centipawn_loss', 0)

        # Get position context
        game_phase = move_analysis.get('game_phase', 'middlegame')
        move_number = move_analysis.get('fullmove_number', 0)

        # Identify opening from move sequence
        opening_name = ""
        move_sequence = move_analysis.get('move_sequence', [])
        if move_sequence and len(move_sequence) >= 2:
            first_two = move_sequence[:2]
            if first_two == ['e4', 'e5']:
                opening_name = "King's Pawn Game"
            elif first_two == ['e4', 'c5']:
                opening_name = "Sicilian Defense"
            elif first_two == ['e4', 'e6']:
                opening_name = "French Defense"
            elif first_two == ['e4', 'c6']:
                opening_name = "Caro-Kann Defense"
            elif first_two == ['d4', 'd5']:
                opening_name = "Queen's Pawn Game"
            elif first_two == ['d4', 'Nf6']:
                opening_name = "Indian Defense"
            elif first_two == ['e4', 'd5']:
                opening_name = "Scandinavian Defense"
            elif first_two == ['e4', 'Nf6']:
                opening_name = "Alekhine Defense"

        # Also check opening_info if available
        if not opening_name:
            opening_info = move_analysis.get('opening_info', {})
            if opening_info and opening_info.get('name'):
                opening_name = opening_info['name']

        # Tactical and positional insights
        tactical_insights = move_analysis.get('tactical_insights', [])
        positional_insights = move_analysis.get('positional_insights', [])

        # Get Stockfish analysis data
        best_move_pv = move_analysis.get('best_move_pv', [])  # Principal Variation from Stockfish
        depth_analyzed = move_analysis.get('depth_analyzed', 0)  # Stockfish depth
        evaluation_before = move_analysis.get('evaluation_before')
        evaluation_after = move_analysis.get('evaluation_after')
        evaluation = move_analysis.get('evaluation', {})  # Stockfish evaluation object

        # Build FEN and move notation context
        fen_after = board.fen()

        # Get position before the move and capture information
        board_before = move_analysis.get('board_before')
        fen_before = ""
        capture_info = ""

        if board_before and move:
            try:
                fen_before = board_before.fen()
                # Check if this is a capture move
                captured_piece = board_before.piece_at(move.to_square)
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
                    capture_info = f"\n**CAPTURE:** This move captures the {color} {piece_name} on {chess.square_name(move.to_square)}."
            except Exception as e:
                print(f"[AI] Warning: Could not extract capture info: {e}")

        # Determine complexity level based on ELO
        if player_elo < 900:
            complexity = "beginner"
            tal_style = "clear and accessible, focusing on fundamental principles with enthusiasm"
        elif player_elo < 1400:
            complexity = "intermediate"
            tal_style = "engaging and instructive, explaining principles clearly with energy"
        else:
            complexity = "advanced intermediate"
            tal_style = "analytical and insightful, teaching advanced concepts with clarity"

        # Determine style intensity based on move quality
        if move_quality in [MoveQuality.BRILLIANT, MoveQuality.BLUNDER]:
            style_intensity = "highly analytical—explain the tactical and positional reasoning clearly, teach why this matters"
        elif move_quality in [MoveQuality.MISTAKE, MoveQuality.EXCELLENT]:
            style_intensity = "strong analytical focus—explain principles and patterns, what works and why"
        else:
            style_intensity = "teaching-focused—explain the chess principles clearly, build understanding"

        # Convert centipawn loss to descriptive language
        if centipawn_loss > 100:
            eval_description = "a decisive advantage"
            eval_explanation = "This creates a significant shift that dramatically changes the position."
            eval_verb = "loses"
        elif centipawn_loss > 50:
            eval_description = "a substantial advantage"
            eval_explanation = "This creates a noticeable shift that gives meaningful control."
            eval_verb = "loses"
        elif centipawn_loss > 25:
            eval_description = "a small advantage"
            eval_explanation = "This creates a subtle shift that provides a slight edge."
            eval_verb = "loses"
        elif centipawn_loss > 0:
            eval_description = "a tiny advantage"
            eval_explanation = "This creates a minimal shift, barely noticeable but still present."
            eval_verb = "loses"
        elif centipawn_loss < 0:
            eval_description = "an advantage"
            eval_explanation = "This improves the position."
            eval_verb = "gains"
        else:
            eval_description = "the position"
            eval_explanation = "This maintains the position effectively."
            eval_verb = "maintains"

        # Build tactical context
        tactical_context = ""
        if tactical_insights:
            tactical_context = f"\n**TACTICAL IDEAS IN THE POSITION:**\n"
            for insight in tactical_insights[:3]:
                tactical_context += f"- {insight}\n"

        positional_context = ""
        if positional_insights:
            positional_context = f"\n**POSITIONAL THEMES:**\n"
            for insight in positional_insights[:3]:
                positional_context += f"- {insight}\n"

        # Build Stockfish analysis context
        stockfish_context = ""
        if depth_analyzed > 0:
            stockfish_context = f"\n**STOCKFISH ANALYSIS (depth {depth_analyzed}):**\n"

            # Add evaluation information
            if evaluation_before is not None and evaluation_after is not None:
                eval_before_str = f"{evaluation_before/100:+.2f}" if abs(evaluation_before) < 10000 else "mate"
                eval_after_str = f"{evaluation_after/100:+.2f}" if abs(evaluation_after) < 10000 else "mate"
                stockfish_context += f"- Evaluation before move: {eval_before_str} (from White's perspective)\n"
                stockfish_context += f"- Evaluation after move: {eval_after_str} (from White's perspective)\n"

            # Add Principal Variation (best continuation line)
            if best_move_pv and len(best_move_pv) > 0:
                # Convert PV from UCI to SAN for readability
                try:
                    pv_san = []
                    temp_board = board_before.copy() if board_before else board.copy()
                    if board_before:
                        # PV is from position before the move
                        for uci_move in best_move_pv[:6]:  # Show first 6 moves of PV
                            try:
                                move_obj = chess.Move.from_uci(uci_move)
                                if move_obj in temp_board.legal_moves:
                                    san_move = temp_board.san(move_obj)
                                    pv_san.append(san_move)
                                    temp_board.push(move_obj)
                                else:
                                    break
                            except:
                                break

                    if pv_san:
                        pv_line = " ".join(pv_san)
                        stockfish_context += f"- Best continuation (Principal Variation): {pv_line}\n"
                        stockfish_context += f"  (This shows Stockfish's calculated best line from this position)\n"
                except Exception as e:
                    print(f"[AI] Warning: Could not convert PV to SAN: {e}")

        # Build the prompt
        position_context = ""
        if fen_before:
            position_context = f"""**THE POSITION BEFORE {move_san}:**
{fen_before}
"""

        # Add opening context if available
        opening_context = ""
        if opening_name and move_number <= 3:
            opening_context = f"\n**OPENING:** {opening_name} (identified from move sequence: {' '.join(move_sequence[:2]) if move_sequence and len(move_sequence) >= 2 else 'N/A'})\n"

        prompt = f"""A player rated {player_elo} ELO ({complexity} level) just played {move_san} in the {game_phase} (move {move_number}).

**THE MOVE:** {move_san}
**MOVE QUALITY:** {move_quality.value}
**THIS IS:** {"the player's move" if is_user_move else "the opponent's move"}
{opening_context}{capture_info}
{stockfish_context}
**WHAT HAPPENED:**
This move {eval_verb} {eval_description}. {eval_explanation}
{tactical_context}{positional_context}
{position_context}
**THE POSITION AFTER {move_san}:**
{fen_after}

**YOUR MISSION (Tal-Style Commentary):**

Write 3 sentences MAXIMUM (preferably 2-3) that capture the *idea* and *principle* behind this move. Be concise and focused. Channel Mikhail Tal's spirit:

**STYLE:** {tal_style}
**INTENSITY:** {style_intensity}

**WHAT TO FOCUS ON:**
1. Explain the *why* behind the move—the idea, the principle, the pattern—not just what happened. What chess principle was followed or violated?
2. Use descriptive language like "{eval_description}" instead of numbers. Explain the impact in chess terms: "loses the attack", "gives up the center", "weakens the kingside"
3. Explain the concrete reasons: "loses the attack because the knight retreats and the kingside becomes vulnerable" - explain the tactical or positional consequences clearly
4. Use occasional metaphors only when they clarify a concept—prioritize clear, analytical explanations
5. Teach a principle the player can learn: "This abandons the center, giving your opponent space to maneuver" - explain what principle applies here and why it matters
6. Focus on concrete chess analysis: piece coordination, tactical patterns, positional weaknesses, and strategic plans
7. {"Explain the brilliant tactical or positional reasoning—what makes this move exceptional and what principles it demonstrates!" if move_quality == MoveQuality.BRILLIANT else "Be constructive and educational—explain what went wrong tactically or positionally, what principle was violated, and what should be played instead" if move_quality in [MoveQuality.MISTAKE, MoveQuality.BLUNDER, MoveQuality.INACCURACY] else "Explain the reasoning behind the move—what principle it follows and how it improves the position"}
8. AVOID generic phrases like "This is a good move", "This permits you to gain an advantage", "They are making a solid move" - be SPECIFIC and ANALYTICAL
9. {"Use the Principal Variation (best continuation line) to understand why the move works or fails—explain what the best line shows about the position" if best_move_pv and len(best_move_pv) > 0 else ""}
10. Consider the Stockfish evaluation change—explain what the evaluation shift means in concrete chess terms (piece activity, king safety, material balance, etc.)

**CRITICAL RULES:**
- NEVER start with "Ah," "Oh," or similar interjections - begin directly with your commentary
- NEVER mention "centipawns", "evaluation", "engine", "permit", "allows", "enables" in the comment text - these are too generic
- NEVER use numbers like "+1.27" or "-4.36" in the comment—only descriptive phrases
- You can reference the Stockfish analysis data (Principal Variation, evaluation changes) to understand the position, but explain it in chess terms, not technical terms
- NEVER use boring phrases like "This is a good move", "This permits you to gain", "They are making a solid move" - be SPECIFIC
- ACCURATELY describe the move: If the move is a capture (e.g., Kxf2), say "the king captures on f2" NOT "sacrificing a pawn on f2". Understand what the move notation means.
- For capture moves: Clearly state what piece was captured (e.g., "captures the knight on f2" not "sacrifices a pawn")
- {"CRITICAL: The opening is " + opening_name + ". Use this EXACT opening name. Do NOT guess or invent opening names. If the opening is 'Sicilian Defense', say 'Sicilian Defense' NOT 'Caro-Kann' or any other opening." if opening_name else ""}
- {"CRITICAL: This is the player's move. Always use 'your' instead of 'the player's' when referring to the player. For example, say 'your understanding' NOT 'the player's understanding', 'your move' NOT 'the player's move', 'your position' NOT 'the player's position'. This makes the commentary personal and direct." if is_user_move else "CRITICAL: This is the opponent's move. Use 'your opponent' or 'the opponent' when referring to them, not 'the player'."}
- Focus on the *principle* and *idea*, not just the evaluation - explain WHAT principle and WHY it matters
- Keep it 3 sentences MAXIMUM (preferably 2-3), clear and instructive - be concise and focused
- If you write more than 3 sentences, your response will be truncated
- Prioritize clear analysis over flowery language - teach chess principles, tactical patterns, and positional understanding
- For mistakes/blunders: Explain what principle was violated and why it matters tactically/positionally. What should they have played instead and why?
- For good moves: Explain what principle they followed and how it improves their position (tactically, positionally, or strategically)

{"If there's a better move (" + best_move_san + "), mention it naturally as part of the idea—what principle does that move follow?" if best_move_san and move_quality not in [MoveQuality.BRILLIANT, MoveQuality.BEST] else ""}

Write the comment now:"""

        return prompt

    def _get_move_quality(self, move_analysis: Dict[str, Any]) -> MoveQuality:
        """Determine move quality from analysis data."""
        if move_analysis.get('is_brilliant', False):
            return MoveQuality.BRILLIANT
        elif move_analysis.get('is_best', False):
            return MoveQuality.BEST
        elif move_analysis.get('is_excellent', False) or move_analysis.get('is_great', False):
            return MoveQuality.EXCELLENT
        elif move_analysis.get('is_good', False) or move_analysis.get('is_acceptable', False):
            return MoveQuality.GOOD
        elif move_analysis.get('is_inaccuracy', False):
            return MoveQuality.INACCURACY
        elif move_analysis.get('is_mistake', False):
            return MoveQuality.MISTAKE
        elif move_analysis.get('is_blunder', False):
            return MoveQuality.BLUNDER
        else:
            return MoveQuality.GOOD

    def generate_style_analysis(
        self,
        personality_scores: Dict[str, float],
        player_style: Dict[str, Any],
        player_level: str,
        total_games: int,
        average_accuracy: float,
        phase_accuracies: Dict[str, float]
    ) -> Optional[Dict[str, str]]:
        """
        Generate AI-powered style analysis content for player profile.

        Args:
            personality_scores: Dictionary of personality trait scores (tactical, positional, aggressive, patient, novelty, staleness)
            player_style: Dictionary with player style category and confidence
            player_level: Player skill level (beginner, intermediate, advanced, expert)
            total_games: Total number of games analyzed
            average_accuracy: Average move accuracy percentage
            phase_accuracies: Dictionary with 'opening', 'middle', 'endgame' accuracy percentages

        Returns:
            Dictionary with style analysis fields, or None if AI is disabled/failed
        """
        if not self.enabled:
            print("[AI] Generator is not enabled for style analysis")
            return None

        if not self.client:
            print("[AI] Anthropic client is not initialized for style analysis")
            return None

        try:
            print(f"[AI] Generating style analysis for {player_level} player with {total_games} games")

            # Build comprehensive prompt with all player data
            prompt = self._build_style_analysis_prompt(
                personality_scores,
                player_style,
                player_level,
                total_games,
                average_accuracy,
                phase_accuracies
            )

            system_prompt = """You are a chess analyst creating personalized style profiles for players. Your analysis is:
- Data-driven and specific: Use actual scores and percentages when relevant
- Insightful and educational: Explain what the scores mean and how they translate to playing style
- Encouraging and constructive: Highlight strengths while providing actionable improvement guidance
- Clear and concise: Write in a natural, engaging style that helps players understand their chess identity
- Personalized: Tailor your analysis to match the player's level and unique profile

Focus on teaching chess concepts and helping players understand their playing style."""

            # Use longer max_tokens for style analysis (more comprehensive content)
            result = self._call_api_with_fallback(
                prompt=prompt,
                system=system_prompt,
                max_tokens=800,  # More tokens for comprehensive analysis
                temperature=0.7  # Slightly lower for more consistent, analytical output
            )

            if result:
                # Parse the AI response into structured format
                return self._parse_style_analysis_response(result, personality_scores, player_style, player_level, total_games, average_accuracy, phase_accuracies)

            print("[AI] Style analysis response had no content")
            return None

        except Exception as e:
            import traceback
            print(f"[AI] Error generating style analysis: {e}")
            print(f"[AI] Full traceback: {traceback.format_exc()}")
            return None

    def _build_style_analysis_prompt(
        self,
        personality_scores: Dict[str, float],
        player_style: Dict[str, Any],
        player_level: str,
        total_games: int,
        average_accuracy: float,
        phase_accuracies: Dict[str, float]
    ) -> str:
        """Build prompt for AI style analysis generation."""

        # Rank traits
        ranked_traits = sorted(
            ((key, personality_scores.get(key, 0.0)) for key in ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']),
            key=lambda item: item[1],
            reverse=True
        )

        dominant_trait, dominant_score = ranked_traits[0]
        second_trait, second_score = ranked_traits[1] if len(ranked_traits) > 1 else (dominant_trait, dominant_score)
        lowest_trait, lowest_score = ranked_traits[-1]

        style_category = player_style.get('category', 'balanced')
        style_confidence = player_style.get('confidence', 0)

        # Format personality scores
        scores_text = "\n".join([f"- {trait}: {score:.1f}" for trait, score in ranked_traits])

        # Format phase accuracies
        phase_text = f"- Opening: {phase_accuracies.get('opening', 0):.1f}%\n- Middlegame: {phase_accuracies.get('middle', 0):.1f}%\n- Endgame: {phase_accuracies.get('endgame', 0):.1f}%"

        prompt = f"""Analyze a chess player's playing style based on their game data:

**PLAYER PROFILE:**
- Level: {player_level}
- Total Games Analyzed: {total_games}
- Average Accuracy: {average_accuracy:.1f}%
- Style Category: {style_category} (confidence: {style_confidence:.0f}%)

**PERSONALITY TRAIT SCORES (0-100):**
{scores_text}

**PHASE ACCURACIES:**
{phase_text}

**YOUR TASK:**
Generate a comprehensive, personalized style analysis in JSON format with these exact fields:

1. **style_summary**: A 2-3 sentence overview describing the player's chess identity, their dominant trait ({dominant_trait} at {dominant_score:.0f}), and how {total_games} games reveal their playing style. Make it personal and engaging.

2. **characteristics**: A concise description (2-3 sentences) of the player's key characteristics. Highlight the top traits ({dominant_trait}, {second_trait}) and explain how they combine to create a unique playing style. Use actual scores when relevant.

3. **strengths**: A specific list of the player's main strengths (2-3 sentences). Mention their best traits ({dominant_trait} at {dominant_score:.0f}, {second_trait} at {second_score:.0f}) and their strongest phase (best phase accuracy). Be specific and encouraging.

4. **playing_patterns**: Explain how the player typically approaches games (2-3 sentences). Describe their playing patterns based on their trait combination. For example, if aggressive > patient, mention they "seek initiative early"; if tactical > positional, mention "calculation in complex positions". Use actual scores when relevant.

5. **improvement_focus**: Specific, actionable guidance (2-3 sentences) on what to focus on for improvement. Highlight their weakest area ({lowest_trait} at {lowest_score:.0f}) and provide concrete suggestions. Also mention their weakest phase if accuracy is below 65%.

**REQUIREMENTS:**
- Use actual scores and percentages when relevant (e.g., "tactical play at 72" or "middlegame accuracy of 68%")
- Be specific and data-driven, not generic
- Write in a natural, engaging style
- Keep each field to 2-3 sentences maximum
- Focus on helping the player understand their chess identity
- Provide actionable improvement guidance

**OUTPUT FORMAT:**
Return ONLY valid JSON with these exact keys:
{{
  "style_summary": "...",
  "characteristics": "...",
  "strengths": "...",
  "playing_patterns": "...",
  "improvement_focus": "..."
}}

Do not include any text outside the JSON. Start directly with {{."""

        return prompt

    def _parse_style_analysis_response(
        self,
        response: str,
        personality_scores: Dict[str, float],
        player_style: Dict[str, Any],
        player_level: str,
        total_games: int,
        average_accuracy: float,
        phase_accuracies: Dict[str, float]
    ) -> Dict[str, str]:
        """Parse AI response into structured style analysis format."""
        import json

        try:
            # Try to extract JSON from response
            # Remove any markdown code blocks
            response = response.strip()
            if response.startswith("```"):
                # Remove markdown code blocks
                lines = response.split("\n")
                response = "\n".join(lines[1:-1]) if len(lines) > 2 else response

            # Try to find JSON object
            if response.startswith("{"):
                # Find the JSON object
                brace_count = 0
                json_start = -1
                json_end = -1

                for i, char in enumerate(response):
                    if char == "{":
                        if json_start == -1:
                            json_start = i
                        brace_count += 1
                    elif char == "}":
                        brace_count -= 1
                        if brace_count == 0:
                            json_end = i + 1
                            break

                if json_start != -1 and json_end != -1:
                    json_str = response[json_start:json_end]
                    parsed = json.loads(json_str)

                    # Validate required fields
                    required_fields = ['style_summary', 'characteristics', 'strengths', 'playing_patterns', 'improvement_focus']
                    if all(field in parsed for field in required_fields):
                        print("[AI] ✅ Successfully parsed style analysis response")
                        return parsed

                    print("[AI] ⚠️  Style analysis response missing required fields")

            # If JSON parsing failed, try to extract fields manually
            print("[AI] ⚠️  Could not parse JSON, attempting fallback parsing")

        except json.JSONDecodeError as e:
            print(f"[AI] ⚠️  JSON parsing error: {e}")
        except Exception as e:
            print(f"[AI] ⚠️  Error parsing style analysis: {e}")

        # Fallback: Return structured response with AI text in first field
        # This allows the system to still use the AI-generated content even if parsing fails
        return {
            'style_summary': response[:500] if len(response) > 500 else response,
            'characteristics': "See style summary for details.",
            'strengths': "See style summary for details.",
            'playing_patterns': "See style summary for details.",
            'improvement_focus': "See style summary for details."
        }
