"""
Puzzle Rating Engine - Glicko-style rating system for puzzle training.

Handles rating updates, XP calculation, and level progression.
"""

import math
import logging

logger = logging.getLogger(__name__)


class PuzzleRatingEngine:
    """Simplified Glicko-style puzzle rating system."""

    INITIAL_RATING = 1200
    INITIAL_RD = 350
    MIN_RD = 50
    MAX_RD = 350
    MIN_RATING = 400
    MAX_RATING = 3000
    Q = math.log(10) / 400  # Glicko constant

    @staticmethod
    def _g(rd: float) -> float:
        """Glicko g(RD) function."""
        return 1 / math.sqrt(
            1 + 3 * (PuzzleRatingEngine.Q ** 2) * (rd ** 2) / (math.pi ** 2)
        )

    @staticmethod
    def calculate_expected_score(
        user_rating: int, puzzle_rating: int, user_rd: int
    ) -> float:
        """Calculate expected probability of solving the puzzle."""
        g_rd = PuzzleRatingEngine._g(user_rd)
        exponent = -g_rd * (user_rating - puzzle_rating) / 400
        return 1 / (1 + 10 ** exponent)

    @staticmethod
    def update_rating(
        user_rating: int,
        user_rd: int,
        puzzle_rating: int,
        solved: bool,
    ) -> tuple[int, int]:
        """
        Update user rating after a puzzle attempt.

        Args:
            user_rating: Current user puzzle rating.
            user_rd: Current rating deviation.
            puzzle_rating: Puzzle's Elo rating.
            solved: Whether the user solved the puzzle.

        Returns:
            Tuple of (new_rating, new_rd).
        """
        q = PuzzleRatingEngine.Q
        expected = PuzzleRatingEngine.calculate_expected_score(
            user_rating, puzzle_rating, user_rd
        )
        score = 1.0 if solved else 0.0

        g_rd = PuzzleRatingEngine._g(user_rd)
        d_squared = 1 / (q ** 2 * g_rd ** 2 * expected * (1 - expected))

        new_rating = user_rating + (q / (1 / user_rd ** 2 + 1 / d_squared)) * g_rd * (
            score - expected
        )
        new_rd = math.sqrt(1 / (1 / user_rd ** 2 + 1 / d_squared))

        new_rating = max(
            PuzzleRatingEngine.MIN_RATING,
            min(PuzzleRatingEngine.MAX_RATING, round(new_rating)),
        )
        new_rd = max(
            PuzzleRatingEngine.MIN_RD,
            min(PuzzleRatingEngine.MAX_RD, round(new_rd)),
        )

        return new_rating, new_rd

    @staticmethod
    def calculate_xp(
        solved: bool,
        puzzle_rating: int,
        user_rating: int,
        time_seconds: int,
        streak_bonus: bool = False,
    ) -> int:
        """
        Calculate XP earned from a puzzle attempt.

        Args:
            solved: Whether the puzzle was solved.
            puzzle_rating: Puzzle's Elo rating.
            user_rating: User's current puzzle rating.
            time_seconds: Time taken to solve/fail.
            streak_bonus: Whether user has an active streak.

        Returns:
            XP earned.
        """
        if not solved:
            return 5  # Consolation XP

        # Base XP: 10-30 based on difficulty delta
        difficulty_diff = puzzle_rating - user_rating
        base_xp = max(10, min(30, 15 + difficulty_diff // 50))

        # Speed bonus
        if time_seconds and time_seconds < 30:
            base_xp = int(base_xp * 1.5)
        elif time_seconds and time_seconds < 60:
            base_xp = int(base_xp * 1.2)

        # Streak bonus: +25%
        if streak_bonus:
            base_xp = int(base_xp * 1.25)

        return base_xp

    @staticmethod
    def xp_for_level(level: int) -> int:
        """Total XP required to reach a given level."""
        if level <= 1:
            return 0
        base = (level - 1) * 100
        if level > 10:
            base += (level - 10) * 50
        return base

    @staticmethod
    def level_from_xp(xp: int) -> int:
        """Calculate level from total XP."""
        level = 1
        while PuzzleRatingEngine.xp_for_level(level + 1) <= xp:
            level += 1
        return level

    @staticmethod
    def xp_to_next_level(current_xp: int, current_level: int) -> int:
        """XP remaining until next level."""
        next_level_xp = PuzzleRatingEngine.xp_for_level(current_level + 1)
        return max(0, next_level_xp - current_xp)
