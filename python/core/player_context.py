#!/usr/bin/env python3
"""
Player Context Module
Aggregates personality scores, weakness rankings, rating, and learning history
into a single PlayerContext object for personalized coaching decisions.
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

from .personality_scoring import PersonalityScores
from .progress_analyzer import ProgressAnalyzer, get_weakness_puzzle_themes

logger = logging.getLogger(__name__)


@dataclass
class PlayerContext:
    """Unified player profile for coaching personalization."""

    # Identity
    user_id: str  # UUID for auth/coaching tables
    canonical_user_id: str  # Platform username for game tables
    platform: str  # 'lichess' or 'chess.com'

    # Rating & skill
    current_rating: int = 1500
    skill_level: str = "intermediate"  # beginner/intermediate/advanced/expert/master

    # Aggregated personality (6 traits, 0-100)
    personality: Optional[PersonalityScores] = None

    # Weakness prioritization (top 3 from ProgressAnalyzer)
    top_weaknesses: List[Dict[str, Any]] = field(default_factory=list)
    weakness_themes: List[Dict[str, Any]] = field(default_factory=list)

    # Accuracy by game phase
    accuracy_by_phase: Dict[str, float] = field(default_factory=dict)

    # Error rates
    blunders_per_game: float = 0.0
    mistakes_per_game: float = 0.0

    # Opening profile
    best_opening: Optional[Dict[str, Any]] = None
    worst_opening: Optional[Dict[str, Any]] = None

    # Learning state
    games_analyzed: int = 0
    puzzle_solve_rate: float = 0.0
    puzzles_attempted: int = 0

    def __post_init__(self) -> None:
        """Auto-derive skill_level from current_rating."""
        self.skill_level = self._compute_skill_level()

    def _compute_skill_level(self) -> str:
        """Compute skill level from rating."""
        if self.current_rating < 1000:
            return "beginner"
        elif self.current_rating < 1400:
            return "intermediate"
        elif self.current_rating < 1800:
            return "advanced"
        elif self.current_rating < 2200:
            return "expert"
        return "master"

    def get_skill_level(self) -> str:
        """Derive skill level from rating."""
        if self.current_rating < 1000:
            return "beginner"
        elif self.current_rating < 1400:
            return "intermediate"
        elif self.current_rating < 1800:
            return "advanced"
        elif self.current_rating < 2200:
            return "expert"
        return "master"

    def get_weakest_trait(self) -> Optional[str]:
        """Return the personality trait with the lowest score."""
        if not self.personality:
            return None
        scores = self.personality.to_dict()
        # Exclude staleness (high staleness is the weakness, not low)
        relevant = {k: v for k, v in scores.items() if k != 'staleness'}
        if not relevant:
            return None
        return min(relevant, key=relevant.get)

    def get_coaching_summary(self) -> str:
        """Generate a concise text summary for AI coach context injection."""
        parts = []
        parts.append(f"Rating: {self.current_rating} ({self.skill_level})")

        if self.personality:
            scores = self.personality.to_dict()
            trait_strs = [f"{k}={v:.0f}" for k, v in scores.items()]
            parts.append(f"Personality: {', '.join(trait_strs)}")

        if self.accuracy_by_phase:
            phase_strs = [f"{k}: {v:.1f}%" for k, v in self.accuracy_by_phase.items()]
            parts.append(f"Phase accuracy: {', '.join(phase_strs)}")

        if self.blunders_per_game > 0:
            parts.append(f"Blunders/game: {self.blunders_per_game:.1f}")

        if self.top_weaknesses:
            weak_strs = [w.get('title', w.get('category', '')) for w in self.top_weaknesses[:3]]
            parts.append(f"Top weaknesses: {', '.join(weak_strs)}")

        weakest = self.get_weakest_trait()
        if weakest:
            parts.append(f"Weakest trait: {weakest}")

        return " | ".join(parts)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize for API responses."""
        return {
            'current_rating': self.current_rating,
            'skill_level': self.skill_level,
            'personality': self.personality.to_dict() if self.personality else None,
            'top_weaknesses': self.top_weaknesses,
            'weakness_themes': self.weakness_themes,
            'accuracy_by_phase': self.accuracy_by_phase,
            'blunders_per_game': round(self.blunders_per_game, 2),
            'mistakes_per_game': round(self.mistakes_per_game, 2),
            'best_opening': self.best_opening,
            'worst_opening': self.worst_opening,
            'games_analyzed': self.games_analyzed,
            'weakest_trait': self.get_weakest_trait(),
        }


async def build_player_context(
    user_id: str,
    canonical_user_id: str,
    platform: str,
    game_analyses: List[Dict[str, Any]],
    progress_analyzer: ProgressAnalyzer,
    supabase_client: Any = None,
    theme_solve_rates: Optional[Dict[str, Dict[str, Any]]] = None,
) -> PlayerContext:
    """
    Build a PlayerContext from game analyses and coaching data.

    Args:
        user_id: Auth UUID
        canonical_user_id: Platform username
        platform: 'lichess' or 'chess.com'
        game_analyses: Recent game analysis records
        progress_analyzer: ProgressAnalyzer instance
        supabase_client: Optional Supabase client for learning state lookups
        theme_solve_rates: Optional pre-fetched puzzle theme solve rates

    Returns:
        Populated PlayerContext
    """
    ctx = PlayerContext(
        user_id=user_id,
        canonical_user_id=canonical_user_id,
        platform=platform,
        games_analyzed=len(game_analyses),
    )

    if not game_analyses:
        return ctx

    # -- Rating --
    ratings = [
        a.get('my_rating') or a.get('rating', 0)
        for a in game_analyses
        if a.get('my_rating') or a.get('rating')
    ]
    if ratings:
        ctx.current_rating = round(sum(ratings) / len(ratings))
    ctx.skill_level = ctx.get_skill_level()

    # -- Personality (aggregate across games) --
    trait_keys = ['tactical_score', 'positional_score', 'aggressive_score',
                  'patient_score', 'novelty_score', 'staleness_score']
    trait_sums: Dict[str, float] = {k: 0.0 for k in trait_keys}
    trait_counts: Dict[str, int] = {k: 0 for k in trait_keys}

    for a in game_analyses:
        for k in trait_keys:
            val = a.get(k)
            if val is not None and isinstance(val, (int, float)):
                trait_sums[k] += float(val)
                trait_counts[k] += 1

    if any(trait_counts[k] > 0 for k in trait_keys):
        ctx.personality = PersonalityScores(
            tactical=trait_sums['tactical_score'] / max(1, trait_counts['tactical_score']),
            positional=trait_sums['positional_score'] / max(1, trait_counts['positional_score']),
            aggressive=trait_sums['aggressive_score'] / max(1, trait_counts['aggressive_score']),
            patient=trait_sums['patient_score'] / max(1, trait_counts['patient_score']),
            novelty=trait_sums['novelty_score'] / max(1, trait_counts['novelty_score']),
            staleness=trait_sums['staleness_score'] / max(1, trait_counts['staleness_score']),
        )

    # -- Phase accuracy --
    phase_keys = {
        'opening': 'opening_accuracy',
        'middlegame': 'middle_game_accuracy',
        'endgame': 'endgame_accuracy',
    }
    for label, db_key in phase_keys.items():
        vals = [a.get(db_key, 0) for a in game_analyses if a.get(db_key)]
        if vals:
            ctx.accuracy_by_phase[label] = round(sum(vals) / len(vals), 1)

    # -- Error rates --
    total_games = len(game_analyses)
    ctx.blunders_per_game = sum(a.get('blunders', 0) for a in game_analyses) / total_games
    ctx.mistakes_per_game = sum(a.get('mistakes', 0) for a in game_analyses) / total_games

    # -- Weaknesses & themes --
    ctx.top_weaknesses = await progress_analyzer.get_user_weaknesses(
        canonical_user_id, platform, game_analyses
    )
    ctx.weakness_themes = get_weakness_puzzle_themes(
        ctx.top_weaknesses, theme_solve_rates
    )

    # -- Opening profile (best/worst by win rate from game_analyses) --
    try:
        opening_stats: Dict[str, Dict[str, int]] = {}
        for a in game_analyses:
            opening = a.get('opening_name') or a.get('opening_family')
            result = a.get('result')
            if opening and result:
                if opening not in opening_stats:
                    opening_stats[opening] = {'wins': 0, 'total': 0}
                opening_stats[opening]['total'] += 1
                if result == 'win':
                    opening_stats[opening]['wins'] += 1

        # Filter openings with enough games
        qualified = {k: v for k, v in opening_stats.items() if v['total'] >= 3}
        if qualified:
            best_name = max(qualified, key=lambda k: qualified[k]['wins'] / qualified[k]['total'])
            worst_name = min(qualified, key=lambda k: qualified[k]['wins'] / qualified[k]['total'])
            best_s = qualified[best_name]
            worst_s = qualified[worst_name]
            ctx.best_opening = {
                'name': best_name,
                'win_rate': round(best_s['wins'] / best_s['total'] * 100, 1),
                'games': best_s['total'],
            }
            ctx.worst_opening = {
                'name': worst_name,
                'win_rate': round(worst_s['wins'] / worst_s['total'] * 100, 1),
                'games': worst_s['total'],
            }
    except Exception as e:
        logger.warning(f"Opening profile extraction failed: {e}")

    # -- Learning state from puzzle attempts --
    if supabase_client:
        try:
            import asyncio
            puzzle_result = await asyncio.to_thread(
                lambda: supabase_client.table('puzzle_attempts')
                .select('was_correct', count='exact')
                .eq('user_id', user_id)
                .execute()
            )
            attempts = puzzle_result.data or []
            ctx.puzzles_attempted = len(attempts)
            if attempts:
                correct = sum(1 for a in attempts if a.get('was_correct'))
                ctx.puzzle_solve_rate = round(correct / len(attempts) * 100, 1)
        except Exception as e:
            logger.warning(f"Puzzle stats lookup failed: {e}")

    return ctx
