"""
AI Comment Service - Parallel Batch Processing

This module handles async generation of AI comments in parallel batches
to restore AI coaching comments without blocking analysis speed.
"""

import asyncio
import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .coaching_comment_generator import ChessCoachingGenerator, GamePhase
from .analysis_engine import MoveAnalysis, GameAnalysis
import chess


@dataclass
class CommentGenerationConfig:
    """Configuration for AI comment generation."""
    enabled: bool = True
    selective: bool = True  # Only significant moves (blunders, mistakes, brilliant, inaccuracies)
    batch_size: int = 8  # Parallel batch size
    rate_limit_delay: float = 2.0  # Seconds between batches
    max_retries: int = 2  # Max retries for failed comments

    @classmethod
    def from_env(cls) -> 'CommentGenerationConfig':
        """Load configuration from environment variables."""
        return cls(
            enabled=os.getenv('AI_COMMENTS_ENABLED', 'true').lower() == 'true',
            selective=os.getenv('AI_COMMENTS_SELECTIVE', 'true').lower() == 'true',
            batch_size=int(os.getenv('AI_COMMENTS_BATCH_SIZE', '8')),
            rate_limit_delay=float(os.getenv('AI_COMMENTS_RATE_LIMIT', '2.0')),
            max_retries=int(os.getenv('AI_COMMENTS_MAX_RETRIES', '2'))
        )


def _should_generate_ai_comment(move_analysis: MoveAnalysis, config: CommentGenerationConfig) -> bool:
    """
    Determine if AI comment should be generated for this move.

    If selective mode is enabled, only generate for significant moves:
    - Player's first move (always - greeting)
    - Brilliant moves (exceptional plays worth celebrating)
    - Learning moments (blunders, mistakes, inaccuracies) - error correction

    This reduces API calls by ~70-80% (only ~8-15 moves per game instead of 60).
    Regular good/excellent moves don't need AI commentary - players know they're doing well.
    """
    if not config.enabled:
        return False

    if not config.selective:
        # Generate for all moves (not recommended - slow and expensive)
        return True

    # Skip AI generation for first move - we already have instant greeting
    # The instant greeting shows immediately, and AI can optionally enhance it later
    # but we don't want to regenerate it since instant one is already shown
    if move_analysis.is_user_move and move_analysis.fullmove_number == 1:
        # Additional check: ensure it's actually one of the first two moves (ply 1 or 2)
        # ply_index starts at 1, so check for 1 or 2 (or None if not set)
        if move_analysis.ply_index is None or move_analysis.ply_index in [1, 2]:
            # Skip - instant greeting already added during analysis
            return False

    # Selective: ONLY critical moments
    # Focus on learning moments (errors) and exceptional plays (brilliant)
    # Skip routine good/excellent moves - they don't need commentary
    return (
        move_analysis.is_blunder or      # Critical error - needs explanation
        move_analysis.is_mistake or      # Significant error - teaching moment
        move_analysis.is_inaccuracy or   # Minor error - gentle correction
        move_analysis.is_brilliant       # Exceptional play - celebrate it!
    )


async def generate_comments_parallel(
    game_analysis: GameAnalysis,
    config: Optional[CommentGenerationConfig] = None
) -> GameAnalysis:
    """
    Generate AI comments in parallel batches for a game analysis.

    Args:
        game_analysis: The game analysis with moves to generate comments for
        config: Configuration for comment generation (defaults to env-based)

    Returns:
        Updated game_analysis with AI comments populated
    """
    if config is None:
        config = CommentGenerationConfig.from_env()

    if not config.enabled:
        print("[AI_COMMENTS] ❌ AI comments disabled via config, skipping generation")
        print(f"[AI_COMMENTS] Config enabled: {config.enabled}")
        print(f"[AI_COMMENTS] AI_COMMENTS_ENABLED env var: {os.getenv('AI_COMMENTS_ENABLED', 'not set')}")
        return game_analysis

    print(f"[AI_COMMENTS] ✅ AI comments enabled, initializing generator...")
    # Initialize coaching generator (includes AI comment generator)
    generator = ChessCoachingGenerator()

    if not generator.ai_generator:
        print("[AI_COMMENTS] ❌ AI generator not initialized (None)")
        return game_analysis

    if not generator.ai_generator.enabled:
        print("[AI_COMMENTS] ❌ AI generator disabled")
        print(f"[AI_COMMENTS] AI enabled: {generator.ai_generator.enabled if generator.ai_generator else 'N/A'}")
        print(f"[AI_COMMENTS] AI client exists: {generator.ai_generator.client is not None if generator.ai_generator else 'N/A'}")
        return game_analysis

    print(f"[AI_COMMENTS] ✅ AI generator ready: enabled={generator.ai_generator.enabled}, model={generator.ai_generator.config.ai_model if generator.ai_generator else 'N/A'}")

    # Filter moves that need AI comments
    moves_to_comment = []
    for move in game_analysis.moves_analysis:
        if _should_generate_ai_comment(move, config):
            moves_to_comment.append(move)

    if not moves_to_comment:
        print(f"[AI_COMMENTS] No moves require AI comments (selective mode: {config.selective})")
        return game_analysis

    print(f"[AI_COMMENTS] Generating AI comments for {len(moves_to_comment)} moves (out of {len(game_analysis.moves_analysis)} total)")

    # Process in parallel batches
    total_batches = (len(moves_to_comment) + config.batch_size - 1) // config.batch_size

    for batch_idx in range(0, len(moves_to_comment), config.batch_size):
        batch = moves_to_comment[batch_idx:batch_idx + config.batch_size]
        batch_num = (batch_idx // config.batch_size) + 1

        print(f"[AI_COMMENTS] Processing batch {batch_num}/{total_batches} ({len(batch)} moves)")

        # Generate comments in parallel for this batch
        tasks = []
        for move in batch:
            task = _generate_single_comment(generator, move, game_analysis, config)
            tasks.append(task)

        # Wait for all comments in batch to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results and update moves
        for move, result in zip(batch, results):
            if isinstance(result, Exception):
                print(f"[AI_COMMENTS] Error generating comment for move {move.move_san}: {result}")
                # Keep empty comment fields on error
            else:
                # Result is already applied to move object (passed by reference)
                pass

        # Rate limit: Wait between batches (except last batch)
        if batch_idx + config.batch_size < len(moves_to_comment):
            await asyncio.sleep(config.rate_limit_delay)

    print(f"[AI_COMMENTS] ✅ Completed generating AI comments for {len(moves_to_comment)} moves")
    return game_analysis


async def _generate_single_comment(
    generator: ChessCoachingGenerator,
    move: MoveAnalysis,
    game_analysis: GameAnalysis,
    config: CommentGenerationConfig
) -> None:
    """
    Generate AI comment for a single move.

    Updates the move object in-place with AI comment fields.
    """
    try:
        # Reconstruct board state for this move
        board = chess.Board()

        # Find this move's position in the game
        move_index = game_analysis.moves_analysis.index(move)

        # Replay moves up to this point
        for i in range(move_index):
            prev_move = game_analysis.moves_analysis[i]
            try:
                move_obj = chess.Move.from_uci(prev_move.move)
                board.push(move_obj)
            except Exception:
                # Skip invalid moves
                continue

        # Get the current move - ensure it's a chess.Move object
        try:
            if isinstance(move.move, str):
                current_move = chess.Move.from_uci(move.move)
            elif hasattr(move.move, 'uci'):
                # Already a chess.Move object
                current_move = move.move
            else:
                # Try to convert from UCI string
                current_move = chess.Move.from_uci(str(move.move))
        except Exception as e:
            print(f"[AI_COMMENTS] Error converting move to chess.Move: {e}, move={move.move}")
            raise

        # Prepare move analysis dict for coaching generator
        move_data = {
            'move_san': move.move_san,
            'move': move.move,
            'evaluation': move.evaluation,
            'evaluation_before': move.evaluation_before,
            'evaluation_after': move.evaluation_after,
            'is_best': move.is_best,
            'is_blunder': move.is_blunder,
            'is_mistake': move.is_mistake,
            'is_inaccuracy': move.is_inaccuracy,
            'is_brilliant': move.is_brilliant,
            'is_great': move.is_great,
            'is_excellent': move.is_excellent,
            'is_good': move.is_good,
            'is_acceptable': move.is_acceptable,
            'centipawn_loss': move.centipawn_loss,
            'board_before': board.copy(),
            'board_after': board.copy(),  # Will be updated after move
            'heuristic_details': move.heuristic_details or {},
            'player_color': move.player_color or 'white',
            # CRITICAL: Add these fields so greeting logic can detect first move
            'fullmove_number': move.fullmove_number,
            'ply_index': move.ply_index,
            'is_user_move': move.is_user_move,
            'player_elo': getattr(move, 'player_elo', 1200)  # Default ELO if not set
        }

        # Apply the move to get board_after
        board.push(current_move)
        move_data['board_after'] = board.copy()

        # Determine game phase
        game_phase_str = move.game_phase if hasattr(move, 'game_phase') and move.game_phase else "middlegame"
        game_phase = GamePhase.MIDDLEGAME
        if game_phase_str == "opening":
            game_phase = GamePhase.OPENING
        elif game_phase_str == "endgame":
            game_phase = GamePhase.ENDGAME

        # Determine player skill level (default to intermediate)
        player_skill_level = "intermediate"  # Could be extracted from game_analysis if available
        is_user_move = move.is_user_move

        # Generate coaching comment (run in thread pool since it's synchronous)
        loop = asyncio.get_event_loop()
        coaching_result = await loop.run_in_executor(
            None,
            lambda: generator.generate_coaching_comment(
                move_data,
                board,
                current_move,
                game_phase=game_phase,
                player_skill_level=player_skill_level,
                is_user_move=is_user_move
            )
        )

        if coaching_result:
            # Update move with AI comment data
            # BUT: Don't overwrite instant greeting for first move - keep the instant one
            is_first_move = move.is_user_move and move.fullmove_number == 1 and (move.ply_index is None or move.ply_index in [1, 2])
            if is_first_move and move.coaching_comment:
                # Keep the instant greeting, don't overwrite with AI
                print(f"[AI_COMMENTS] Keeping instant greeting for first move, skipping AI replacement")
            else:
                move.coaching_comment = coaching_result.main_comment
            move.what_went_right = coaching_result.what_went_right or ""
            move.what_went_wrong = coaching_result.what_went_wrong or ""
            move.how_to_improve = coaching_result.how_to_improve or ""
            move.tactical_insights = coaching_result.tactical_insights or []
            move.positional_insights = coaching_result.positional_insights or []
            move.risks = coaching_result.risks or []
            move.benefits = coaching_result.benefits or []
            move.learning_points = coaching_result.learning_points or []
            move.encouragement_level = coaching_result.encouragement_level
            move.move_quality = coaching_result.move_quality.value if hasattr(coaching_result.move_quality, 'value') else str(coaching_result.move_quality)
            move.game_phase = coaching_result.game_phase.value if hasattr(coaching_result.game_phase, 'value') else str(coaching_result.game_phase)
        else:
            # AI generation failed, keep default values
            print(f"[AI_COMMENTS] No comment generated for move {move.move_san}")

    except Exception as e:
        print(f"[AI_COMMENTS] Error generating comment for move {move.move_san}: {e}")
        import traceback
        traceback.print_exc()
        # Keep default empty values on error
