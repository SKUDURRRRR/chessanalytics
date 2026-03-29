#!/usr/bin/env python3
"""
Puzzle Generator Module
Generates personalized puzzles from user's game mistakes (blunders, mistakes).
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import asyncio
import chess

logger = logging.getLogger(__name__)


class PuzzleGenerator:
    """Generates personalized puzzles from game analysis data."""

    def __init__(self, supabase_client):
        """
        Initialize puzzle generator.

        Args:
            supabase_client: Supabase client instance
        """
        self.supabase = supabase_client

    @staticmethod
    def _validate_fen(fen: str) -> bool:
        """Validate that a FEN string represents a legal chess position."""
        if not fen or not isinstance(fen, str) or len(fen.strip()) < 10:
            return False
        try:
            board = chess.Board(fen)
            return board.is_valid()
        except (ValueError, Exception):
            return False

    @staticmethod
    def _get_difficulty_rating(user_rating: int, is_blunder: bool) -> int:
        """Get rating-adjusted puzzle difficulty."""
        if user_rating < 1200:
            offset = 200 if is_blunder else 300
        elif user_rating < 1800:
            offset = 100 if is_blunder else 200
        else:
            offset = 50 if is_blunder else 100
        return max(800, min(2500, user_rating - offset))

    async def generate_puzzles_from_blunders(
        self, user_id: str, platform: str, game_analyses: List[Dict[str, Any]],
        canonical_user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate puzzles from positions where user blundered.

        Args:
            user_id: User ID (UUID for puzzles table)
            platform: Platform ('lichess' or 'chess.com')
            game_analyses: List of game analysis records
            canonical_user_id: Platform username for querying move_analyses/games tables.
                If not provided, falls back to user_id.

        Returns:
            List of puzzle dictionaries
        """
        # query_user_id is canonical username for game data tables
        query_user_id = canonical_user_id or user_id
        puzzles = []

        if not game_analyses:
            return puzzles

        # Find games with blunders
        blunder_games = [a for a in game_analyses if a.get('blunders', 0) > 0]

        for analysis in blunder_games[:20]:  # Limit to 20 games
            game_id = analysis.get('game_id')
            blunders = analysis.get('blunders', 0)

            if not game_id or blunders == 0:
                continue

            # Fetch move analyses for this game to find blunder positions
            try:
                move_analyses_result = await asyncio.to_thread(
                    lambda gid=game_id: self.supabase.table('move_analyses')
                    .select('*')
                    .eq('game_id', gid)
                    .eq('user_id', query_user_id)
                    .eq('platform', platform)
                    .order('created_at')
                    .execute()
                )

                move_analyses = move_analyses_result.data or []

                # Find moves with high centipawn loss (blunders)
                for move_analysis in move_analyses:
                    centipawn_loss = move_analysis.get('average_centipawn_loss', 0)
                    worst_blunder = move_analysis.get('worst_blunder_centipawn_loss', 0)

                    # Blunder threshold: 200+ centipawn loss
                    if worst_blunder >= 200 or centipawn_loss >= 200:
                        # Try to extract FEN from moves_analysis
                        moves_data = move_analysis.get('moves_analysis', [])
                        if not moves_data:
                            continue

                        # Find the blunder move in the sequence
                        blunder_move_data = None
                        for move_data in moves_data:
                            if isinstance(move_data, dict):
                                cp_loss = move_data.get('centipawn_loss', 0)
                                if cp_loss >= 200:
                                    blunder_move_data = move_data
                                    break

                        if not blunder_move_data:
                            continue

                        # Extract puzzle data
                        fen = blunder_move_data.get('fen_before', '')
                        user_move = blunder_move_data.get('move_san', '')
                        best_move = blunder_move_data.get('best_move', '')

                        if not self._validate_fen(fen) or not best_move:
                            continue

                        # Determine tactical theme if possible
                        tactical_patterns = move_analysis.get('tactical_patterns', [])
                        tactical_theme = None
                        if tactical_patterns:
                            # Try to identify common themes
                            patterns_str = str(tactical_patterns).lower()
                            if 'pin' in patterns_str:
                                tactical_theme = 'pin'
                            elif 'fork' in patterns_str:
                                tactical_theme = 'fork'
                            elif 'skewer' in patterns_str:
                                tactical_theme = 'skewer'
                            elif 'discovered' in patterns_str:
                                tactical_theme = 'discovered_attack'
                            elif 'double' in patterns_str:
                                tactical_theme = 'double_attack'

                        # Estimate difficulty based on user rating
                        # Fetch user's current rating from games (games.user_id is TEXT username)
                        games_result = await asyncio.to_thread(
                            lambda gid=game_id: self.supabase.table('games')
                            .select('my_rating')
                            .eq('id', gid)
                            .eq('user_id', query_user_id)
                            .limit(1)
                            .execute()
                        )

                        user_rating = 1500  # Default
                        if games_result.data:
                            user_rating = games_result.data[0].get('my_rating', 1500) or 1500

                        # Rating-adjusted difficulty
                        difficulty_rating = self._get_difficulty_rating(user_rating, is_blunder=True)

                        puzzle = {
                            'user_id': user_id,
                            'platform': platform,
                            'fen_position': fen,
                            'correct_move': best_move,
                            'solution_line': [best_move],  # Simplified - could be expanded
                            'puzzle_category': 'tactical',
                            'tactical_theme': tactical_theme,
                            'difficulty_rating': int(difficulty_rating),
                            'explanation': f'You played {user_move}, but the best move was {best_move}. This was a blunder costing {worst_blunder:.0f} centipawns.',
                            'source_game_id': game_id,
                            'source_move_number': move_analysis.get('move_number', 0),
                        }

                        puzzles.append(puzzle)

                        # Limit puzzles per game
                        if len([p for p in puzzles if p['source_game_id'] == game_id]) >= 2:
                            break

            except Exception as e:
                logger.warning(f"Error generating puzzles from game {game_id}: {e}")
                continue

        return puzzles[:50]  # Limit to 50 puzzles

    async def generate_puzzles_from_mistakes(
        self, user_id: str, platform: str, game_analyses: List[Dict[str, Any]],
        canonical_user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate puzzles from positions where user made mistakes (100-200 cp loss).

        Args:
            user_id: User ID (UUID for puzzles table)
            platform: Platform
            game_analyses: List of game analysis records
            canonical_user_id: Platform username for querying move_analyses/games tables.

        Returns:
            List of puzzle dictionaries
        """
        query_user_id = canonical_user_id or user_id
        puzzles = []

        if not game_analyses:
            return puzzles

        # Find games with mistakes
        mistake_games = [a for a in game_analyses if a.get('mistakes', 0) > 0]

        for analysis in mistake_games[:15]:  # Limit to 15 games
            game_id = analysis.get('game_id')
            mistakes = analysis.get('mistakes', 0)

            if not game_id or mistakes == 0:
                continue

            # Fetch move analyses (move_analyses.user_id is TEXT username)
            try:
                move_analyses_result = await asyncio.to_thread(
                    lambda gid=game_id: self.supabase.table('move_analyses')
                    .select('*')
                    .eq('game_id', gid)
                    .eq('user_id', query_user_id)
                    .eq('platform', platform)
                    .order('created_at')
                    .execute()
                )

                move_analyses = move_analyses_result.data or []

                for move_analysis in move_analyses:
                    centipawn_loss = move_analysis.get('average_centipawn_loss', 0)

                    # Mistake threshold: 100-200 centipawn loss
                    if 100 <= centipawn_loss < 200:
                        moves_data = move_analysis.get('moves_analysis', [])
                        if not moves_data:
                            continue

                        mistake_move_data = None
                        for move_data in moves_data:
                            if isinstance(move_data, dict):
                                cp_loss = move_data.get('centipawn_loss', 0)
                                if 100 <= cp_loss < 200:
                                    mistake_move_data = move_data
                                    break

                        if not mistake_move_data:
                            continue

                        fen = mistake_move_data.get('fen_before', '')
                        user_move = mistake_move_data.get('move_san', '')
                        best_move = mistake_move_data.get('best_move', '')

                        if not self._validate_fen(fen) or not best_move:
                            continue

                        # Get user rating for difficulty (games.user_id is TEXT username)
                        games_result = await asyncio.to_thread(
                            lambda gid=game_id: self.supabase.table('games')
                            .select('my_rating')
                            .eq('id', gid)
                            .eq('user_id', query_user_id)
                            .limit(1)
                            .execute()
                        )

                        user_rating = 1500
                        if games_result.data:
                            user_rating = games_result.data[0].get('my_rating', 1500) or 1500

                        difficulty_rating = self._get_difficulty_rating(user_rating, is_blunder=False)

                        puzzle = {
                            'user_id': user_id,
                            'platform': platform,
                            'fen_position': fen,
                            'correct_move': best_move,
                            'solution_line': [best_move],
                            'puzzle_category': 'tactical',
                            'tactical_theme': None,
                            'difficulty_rating': int(difficulty_rating),
                            'explanation': f'You played {user_move}, but {best_move} was better. This mistake cost {centipawn_loss:.0f} centipawns.',
                            'source_game_id': game_id,
                            'source_move_number': move_analysis.get('move_number', 0),
                        }

                        puzzles.append(puzzle)

                        if len([p for p in puzzles if p['source_game_id'] == game_id]) >= 1:
                            break

            except Exception as e:
                logger.warning(f"Error generating mistake puzzles from game {game_id}: {e}")
                continue

        return puzzles[:30]  # Limit to 30 puzzles

    def categorize_puzzles(self, puzzles: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Categorize puzzles by type.

        Args:
            puzzles: List of puzzle dictionaries

        Returns:
            Dictionary mapping categories to puzzle lists
        """
        categorized = {
            'tactical': [],
            'positional': [],
            'opening': [],
            'endgame': [],
        }

        for puzzle in puzzles:
            category = puzzle.get('puzzle_category', 'tactical')
            if category in categorized:
                categorized[category].append(puzzle)
            else:
                categorized['tactical'].append(puzzle)  # Default

        return categorized

    async def get_daily_puzzle(
        self, user_id: str, platform: str, puzzle_index: int = 0,
        canonical_user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get or generate a daily puzzle for the user.

        Args:
            user_id: User ID (UUID for puzzles table)
            platform: Platform
            puzzle_index: Index to cycle through daily puzzles (0-2)
            canonical_user_id: Platform username for querying game data tables.

        Returns:
            Puzzle dictionary or None
        """
        # query_user_id is canonical username for game data tables
        query_user_id = canonical_user_id or user_id
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())

        try:
            # Check for existing puzzles today (puzzles.user_id is UUID)
            existing_result = await asyncio.to_thread(
                lambda: self.supabase.table('puzzles')
                .select('*')
                .eq('user_id', user_id)
                .eq('platform', platform)
                .gte('created_at', today_start.isoformat())
                .order('created_at')
                .limit(3)
                .execute()
            )

            if existing_result.data and len(existing_result.data) > puzzle_index:
                return existing_result.data[puzzle_index]

            # If we have some puzzles but not enough for this index, return what we have
            if existing_result.data:
                return existing_result.data[0]

            # Generate new daily puzzles (up to 3)
            # game_analyses.user_id is TEXT username
            analyses_result = await asyncio.to_thread(
                lambda: self.supabase.table('game_analyses')
                .select('*')
                .eq('user_id', query_user_id)
                .eq('platform', platform)
                .order('created_at', desc=True)
                .limit(50)
                .execute()
            )

            game_analyses = analyses_result.data or []

            # Generate puzzles from blunders (prefer blunders for daily puzzle)
            puzzles = await self.generate_puzzles_from_blunders(
                user_id, platform, game_analyses, canonical_user_id=query_user_id
            )

            if not puzzles:
                puzzles = await self.generate_puzzles_from_mistakes(
                    user_id, platform, game_analyses, canonical_user_id=query_user_id
                )

            if puzzles:
                # Save up to 3 puzzles for daily rotation
                saved_puzzles = []
                for puzzle in puzzles[:3]:
                    try:
                        await asyncio.to_thread(
                            lambda p=puzzle: self.supabase.table('puzzles')
                            .insert(p)
                            .execute()
                        )
                        saved_puzzles.append(puzzle)
                    except Exception as e:
                        logger.warning(f"Error saving daily puzzle: {e}")

                if saved_puzzles:
                    idx = min(puzzle_index, len(saved_puzzles) - 1)
                    return saved_puzzles[idx]

        except Exception as e:
            logger.error(f"Error getting daily puzzle: {e}")

        return None
