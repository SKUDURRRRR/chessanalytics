#!/usr/bin/env python3
"""
Progress Analyzer Module
Analyzes user's game data to identify strengths, weaknesses, and generate recommendations.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta, date
from collections import defaultdict
import asyncio

logger = logging.getLogger(__name__)


class ProgressAnalyzer:
    """Analyzes user progress and generates recommendations."""

    def __init__(self, supabase_client):
        """
        Initialize progress analyzer.

        Args:
            supabase_client: Supabase client instance
        """
        self.supabase = supabase_client

    async def get_user_weaknesses(
        self, user_id: str, platform: str, game_analyses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Identify user's top weaknesses from game analysis.

        Args:
            user_id: User ID
            platform: Platform
            game_analyses: List of game analysis records

        Returns:
            List of weakness dictionaries (top 3)
        """
        weaknesses = []

        if not game_analyses:
            return weaknesses

        # Calculate average scores
        tactical_scores = [a.get('tactical_score', 50) for a in game_analyses if a.get('tactical_score')]
        positional_scores = [a.get('positional_score', 50) for a in game_analyses if a.get('positional_score')]
        opening_accuracies = [a.get('opening_accuracy', 0) for a in game_analyses if a.get('opening_accuracy')]
        middlegame_accuracies = [a.get('middle_game_accuracy', 0) for a in game_analyses if a.get('middle_game_accuracy')]
        endgame_accuracies = [a.get('endgame_accuracy', 0) for a in game_analyses if a.get('endgame_accuracy')]

        avg_tactical = sum(tactical_scores) / len(tactical_scores) if tactical_scores else 50
        avg_positional = sum(positional_scores) / len(positional_scores) if positional_scores else 50
        avg_opening = sum(opening_accuracies) / len(opening_accuracies) if opening_accuracies else 0
        avg_middlegame = sum(middlegame_accuracies) / len(middlegame_accuracies) if middlegame_accuracies else 0
        avg_endgame = sum(endgame_accuracies) / len(endgame_accuracies) if endgame_accuracies else 0

        # Calculate error rates
        total_blunders = sum(a.get('blunders', 0) for a in game_analyses)
        total_mistakes = sum(a.get('mistakes', 0) for a in game_analyses)
        total_games = len(game_analyses)
        blunders_per_game = total_blunders / total_games if total_games > 0 else 0
        mistakes_per_game = total_mistakes / total_games if total_games > 0 else 0

        # Determine rating-adjusted thresholds
        # Extract user rating from game analyses for threshold adjustment
        ratings = [a.get('my_rating', 0) or a.get('rating', 0) for a in game_analyses if a.get('my_rating') or a.get('rating')]
        user_rating = sum(ratings) / len(ratings) if ratings else 1500

        if user_rating < 1200:
            tactical_threshold, positional_threshold = 45, 45
            opening_threshold, phase_threshold = 55, 55
            blunder_rate_threshold = 1.0
        elif user_rating < 1800:
            tactical_threshold, positional_threshold = 55, 55
            opening_threshold, phase_threshold = 65, 65
            blunder_rate_threshold = 0.5
        else:
            tactical_threshold, positional_threshold = 65, 65
            opening_threshold, phase_threshold = 75, 75
            blunder_rate_threshold = 0.3

        # Identify weaknesses (low scores or high error rates)
        weakness_candidates = []

        if avg_tactical < tactical_threshold:
            weakness_candidates.append({
                'category': 'tactical',
                'title': 'Tactical Vision',
                'description': f'Your tactical score is {avg_tactical:.1f}/100. You average {blunders_per_game:.1f} blunders per game.',
                'score': avg_tactical,
                'severity': 'critical' if avg_tactical < 50 else 'important',
                'recommendation': 'Focus on tactical puzzles and pattern recognition.',
            })

        if avg_positional < positional_threshold:
            weakness_candidates.append({
                'category': 'positional',
                'title': 'Positional Understanding',
                'description': f'Your positional score is {avg_positional:.1f}/100. Improve your strategic play.',
                'score': avg_positional,
                'severity': 'critical' if avg_positional < 50 else 'important',
                'recommendation': 'Study positional concepts and endgame technique.',
            })

        if avg_opening < opening_threshold and opening_accuracies:
            weakness_candidates.append({
                'category': 'opening',
                'title': 'Opening Accuracy',
                'description': f'Your opening accuracy is {avg_opening:.1f}%. Learn opening principles.',
                'score': avg_opening,
                'severity': 'critical' if avg_opening < 60 else 'important',
                'recommendation': 'Study opening theory and build a consistent repertoire.',
            })

        if avg_middlegame < phase_threshold and middlegame_accuracies:
            weakness_candidates.append({
                'category': 'middlegame',
                'title': 'Middlegame Play',
                'description': f'Your middlegame accuracy is {avg_middlegame:.1f}%.',
                'score': avg_middlegame,
                'severity': 'critical' if avg_middlegame < 60 else 'important',
                'recommendation': 'Practice planning and piece coordination.',
            })

        if avg_endgame < phase_threshold and endgame_accuracies:
            weakness_candidates.append({
                'category': 'endgame',
                'title': 'Endgame Technique',
                'description': f'Your endgame accuracy is {avg_endgame:.1f}%.',
                'score': avg_endgame,
                'severity': 'critical' if avg_endgame < 60 else 'important',
                'recommendation': 'Study endgame theory and practice conversion.',
            })

        if blunders_per_game > blunder_rate_threshold:
            weakness_candidates.append({
                'category': 'blunders',
                'title': 'Blunder Rate',
                'description': f'You average {blunders_per_game:.1f} blunders per game.',
                'score': 100 - (blunders_per_game * 20),  # Convert to score (lower is worse)
                'severity': 'critical' if blunders_per_game > 1.0 else 'important',
                'recommendation': 'Slow down and double-check moves before playing.',
            })

        # Sort by severity and score (worst first)
        weakness_candidates.sort(key=lambda x: (
            0 if x['severity'] == 'critical' else 1,
            x['score']
        ))

        return weakness_candidates[:3]  # Top 3 weaknesses

    async def get_user_strengths(
        self, user_id: str, platform: str, game_analyses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Identify user's top strengths from game analysis.

        Args:
            user_id: User ID
            platform: Platform
            game_analyses: List of game analysis records

        Returns:
            List of strength dictionaries (top 3)
        """
        strengths = []

        if not game_analyses:
            return strengths

        # Calculate average scores
        tactical_scores = [a.get('tactical_score', 50) for a in game_analyses if a.get('tactical_score')]
        positional_scores = [a.get('positional_score', 50) for a in game_analyses if a.get('positional_score')]
        opening_accuracies = [a.get('opening_accuracy', 0) for a in game_analyses if a.get('opening_accuracy')]
        middlegame_accuracies = [a.get('middle_game_accuracy', 0) for a in game_analyses if a.get('middle_game_accuracy')]
        endgame_accuracies = [a.get('endgame_accuracy', 0) for a in game_analyses if a.get('endgame_accuracy')]

        avg_tactical = sum(tactical_scores) / len(tactical_scores) if tactical_scores else 50
        avg_positional = sum(positional_scores) / len(positional_scores) if positional_scores else 50
        avg_opening = sum(opening_accuracies) / len(opening_accuracies) if opening_accuracies else 0
        avg_middlegame = sum(middlegame_accuracies) / len(middlegame_accuracies) if middlegame_accuracies else 0
        avg_endgame = sum(endgame_accuracies) / len(endgame_accuracies) if endgame_accuracies else 0

        # Calculate error rates
        total_blunders = sum(a.get('blunders', 0) for a in game_analyses)
        total_games = len(game_analyses)
        blunders_per_game = total_blunders / total_games if total_games > 0 else 0

        # Identify strengths (high scores or low error rates)
        strength_candidates = []

        if avg_tactical >= 70:
            strength_candidates.append({
                'category': 'tactical',
                'title': 'Strong Tactical Vision',
                'description': f'Your tactical score is {avg_tactical:.1f}/100. You spot tactics well!',
                'score': avg_tactical,
                'icon': '🎯',
            })

        if avg_positional >= 70:
            strength_candidates.append({
                'category': 'positional',
                'title': 'Solid Positional Play',
                'description': f'Your positional score is {avg_positional:.1f}/100. Great strategic understanding!',
                'score': avg_positional,
                'icon': '🏰',
            })

        if avg_opening >= 80 and opening_accuracies:
            strength_candidates.append({
                'category': 'opening',
                'title': 'Strong Opening Play',
                'description': f'Your opening accuracy is {avg_opening:.1f}%. Excellent opening knowledge!',
                'score': avg_opening,
                'icon': '♟️',
            })

        if avg_middlegame >= 80 and middlegame_accuracies:
            strength_candidates.append({
                'category': 'middlegame',
                'title': 'Strong Middlegame',
                'description': f'Your middlegame accuracy is {avg_middlegame:.1f}%.',
                'score': avg_middlegame,
                'icon': '⚔️',
            })

        if avg_endgame >= 80 and endgame_accuracies:
            strength_candidates.append({
                'category': 'endgame',
                'title': 'Strong Endgame',
                'description': f'Your endgame accuracy is {avg_endgame:.1f}%.',
                'score': avg_endgame,
                'icon': '👑',
            })

        if blunders_per_game < 0.3:
            strength_candidates.append({
                'category': 'accuracy',
                'title': 'Low Blunder Rate',
                'description': f'You average only {blunders_per_game:.1f} blunders per game. Great accuracy!',
                'score': 100 - (blunders_per_game * 30),
                'icon': '✨',
            })

        # Sort by score (best first)
        strength_candidates.sort(key=lambda x: x['score'], reverse=True)

        return strength_candidates[:3]  # Top 3 strengths

    async def generate_recommendations(
        self, weaknesses: List[Dict[str, Any]], strengths: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Generate actionable recommendations based on weaknesses and strengths.

        Args:
            weaknesses: List of weakness dictionaries
            strengths: List of strength dictionaries

        Returns:
            List of recommendation strings
        """
        recommendations = []

        # Recommendations based on weaknesses
        for weakness in weaknesses[:2]:  # Top 2 weaknesses
            category = weakness.get('category')
            if category == 'tactical':
                recommendations.append('Complete tactical training lessons and solve 10 puzzles daily')
            elif category == 'positional':
                recommendations.append('Study positional concepts and practice endgame technique')
            elif category == 'opening':
                recommendations.append('Build a consistent opening repertoire and study theory')
            elif category == 'middlegame':
                recommendations.append('Practice planning and piece coordination exercises')
            elif category == 'endgame':
                recommendations.append('Study endgame theory and practice conversion techniques')
            elif category == 'blunders':
                recommendations.append('Slow down and double-check moves before playing')

        # Leverage strengths
        if strengths:
            top_strength = strengths[0]
            category = top_strength.get('category')
            if category == 'tactical':
                recommendations.append('Leverage your tactical strength in sharp positions')
            elif category == 'positional':
                recommendations.append('Use your positional understanding to outplay opponents')

        return recommendations[:3]  # Top 3 recommendations

    async def get_progress_time_series(
        self, user_id: str, platform: str,
        game_analyses: List[Dict[str, Any]],
        period_days: int = 90
    ) -> Dict[str, Any]:
        """
        Aggregate progress data into weekly time series for charts.

        Args:
            user_id: Canonical user ID (username)
            platform: Platform
            game_analyses: Game analysis records (should be ordered by created_at)
            period_days: Number of days to look back

        Returns:
            Dictionary with rating_trend, accuracy_by_phase, blunder_rate_trend, personality_trends
        """
        cutoff = datetime.utcnow() - timedelta(days=period_days)

        # Filter analyses within period
        recent = []
        for a in game_analyses:
            created = a.get('created_at') or a.get('played_at', '')
            if isinstance(created, str) and created:
                try:
                    dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                    if dt.replace(tzinfo=None) >= cutoff:
                        a['_parsed_date'] = dt.replace(tzinfo=None)
                        recent.append(a)
                except (ValueError, TypeError):
                    recent.append(a)
                    a['_parsed_date'] = datetime.utcnow()
            else:
                recent.append(a)
                a['_parsed_date'] = datetime.utcnow()

        # Group by ISO week
        def week_key(dt: datetime) -> str:
            iso = dt.isocalendar()
            return f"{iso[0]}-W{iso[1]:02d}"

        weekly: Dict[str, List[Dict]] = defaultdict(list)
        for a in recent:
            wk = week_key(a.get('_parsed_date', datetime.utcnow()))
            weekly[wk].append(a)

        sorted_weeks = sorted(weekly.keys())

        # Rating trend (from games table - use my_rating from analyses if available)
        rating_trend = []
        for wk in sorted_weeks:
            ratings = [a.get('my_rating', 0) or a.get('rating', 0) for a in weekly[wk] if a.get('my_rating') or a.get('rating')]
            if ratings:
                rating_trend.append({
                    'week': wk,
                    'avg_rating': round(sum(ratings) / len(ratings), 1),
                    'games': len(weekly[wk]),
                })

        # Accuracy by phase
        accuracy_by_phase = []
        for wk in sorted_weeks:
            analyses = weekly[wk]
            op = [a.get('opening_accuracy', 0) for a in analyses if a.get('opening_accuracy')]
            mg = [a.get('middle_game_accuracy', 0) for a in analyses if a.get('middle_game_accuracy')]
            eg = [a.get('endgame_accuracy', 0) for a in analyses if a.get('endgame_accuracy')]
            if op or mg or eg:
                accuracy_by_phase.append({
                    'week': wk,
                    'opening': round(sum(op) / len(op), 1) if op else 0,
                    'middlegame': round(sum(mg) / len(mg), 1) if mg else 0,
                    'endgame': round(sum(eg) / len(eg), 1) if eg else 0,
                })

        # Blunder rate trend
        blunder_rate_trend = []
        for wk in sorted_weeks:
            analyses = weekly[wk]
            total_blunders = sum(a.get('blunders', 0) for a in analyses)
            total_games = len(analyses)
            if total_games > 0:
                blunder_rate_trend.append({
                    'week': wk,
                    'blunders_per_game': round(total_blunders / total_games, 2),
                })

        # Personality score trends
        personality_trends = []
        score_keys = {
            'tactical': 'tactical_score',
            'positional': 'positional_score',
            'aggressive': 'aggressive_score',
            'patient': 'patient_score',
            'novelty': 'novelty_score',
            'staleness': 'staleness_score',
        }
        for wk in sorted_weeks:
            analyses = weekly[wk]
            week_scores: Dict[str, float] = {'week': wk}
            for label, key in score_keys.items():
                values = [a.get(key, 50) for a in analyses if a.get(key) is not None]
                week_scores[label] = round(sum(values) / len(values), 1) if values else 50
            personality_trends.append(week_scores)

        return {
            'rating_trend': rating_trend,
            'accuracy_by_phase': accuracy_by_phase,
            'blunder_rate_trend': blunder_rate_trend,
            'personality_trends': personality_trends,
        }

    async def get_streak_data(
        self, user_id: str, platform: str
    ) -> Dict[str, Any]:
        """
        Calculate activity streaks and completion stats.

        Args:
            user_id: Auth user UUID (for lesson_progress/puzzle_attempts) or canonical user_id
            platform: Platform

        Returns:
            Streak data including current streak, best streak, days active, and completion counts
        """
        # Collect all activity dates
        activity_dates: set = set()

        # Game analyses dates (uses canonical user_id)
        try:
            ga_result = await asyncio.to_thread(
                lambda: self.supabase.table('game_analyses')
                .select('created_at')
                .eq('user_id', user_id)
                .eq('platform', platform)
                .execute()
            )
            for r in (ga_result.data or []):
                if r.get('created_at'):
                    try:
                        dt = datetime.fromisoformat(r['created_at'].replace('Z', '+00:00'))
                        activity_dates.add(dt.date())
                    except (ValueError, TypeError):
                        pass
        except Exception as e:
            logger.warning(f"[PROGRESS] Failed to fetch game_analyses dates: {e}")

        # Lesson progress dates
        try:
            lp_result = await asyncio.to_thread(
                lambda: self.supabase.table('lesson_progress')
                .select('updated_at, status')
                .eq('user_id', user_id)
                .execute()
            )
            lessons_completed = 0
            for r in (lp_result.data or []):
                if r.get('status') == 'completed':
                    lessons_completed += 1
                if r.get('updated_at'):
                    try:
                        dt = datetime.fromisoformat(r['updated_at'].replace('Z', '+00:00'))
                        activity_dates.add(dt.date())
                    except (ValueError, TypeError):
                        pass
        except Exception as e:
            logger.warning(f"[PROGRESS] Failed to fetch lesson_progress dates: {e}")
            lessons_completed = 0

        # Puzzle attempt dates
        try:
            pa_result = await asyncio.to_thread(
                lambda: self.supabase.table('puzzle_attempts')
                .select('attempted_at, was_correct')
                .eq('user_id', user_id)
                .execute()
            )
            puzzles_solved = 0
            puzzles_correct = 0
            for r in (pa_result.data or []):
                puzzles_solved += 1
                if r.get('was_correct'):
                    puzzles_correct += 1
                if r.get('attempted_at'):
                    try:
                        dt = datetime.fromisoformat(r['attempted_at'].replace('Z', '+00:00'))
                        activity_dates.add(dt.date())
                    except (ValueError, TypeError):
                        pass
        except Exception as e:
            logger.warning(f"[PROGRESS] Failed to fetch puzzle_attempts dates: {e}")
            puzzles_solved = 0
            puzzles_correct = 0

        # Calculate streaks
        today = date.today()
        sorted_dates = sorted(activity_dates, reverse=True)

        current_streak = 0
        best_streak = 0

        if sorted_dates:
            # Current streak - count consecutive days ending at today or yesterday
            streak = 0
            check_date = today
            # Allow starting from today or yesterday
            if sorted_dates[0] == today or sorted_dates[0] == today - timedelta(days=1):
                check_date = sorted_dates[0]
                for d in sorted_dates:
                    if d == check_date:
                        streak += 1
                        check_date -= timedelta(days=1)
                    elif d < check_date:
                        break
                current_streak = streak

            # Best streak
            streak = 1
            prev = sorted_dates[0]
            for d in sorted_dates[1:]:
                if prev - d == timedelta(days=1):
                    streak += 1
                else:
                    best_streak = max(best_streak, streak)
                    streak = 1
                prev = d
            best_streak = max(best_streak, streak)

        puzzle_solve_rate = puzzles_correct / puzzles_solved if puzzles_solved > 0 else 0

        return {
            'current_streak': current_streak,
            'best_streak': best_streak,
            'days_active': len(activity_dates),
            'lessons_completed': lessons_completed,
            'puzzles_solved': puzzles_solved,
            'puzzle_solve_rate': round(puzzle_solve_rate, 2),
        }

    async def get_weakness_evolution(
        self, user_id: str, platform: str,
        game_analyses: List[Dict[str, Any]],
        weeks: int = 8
    ) -> List[Dict[str, Any]]:
        """
        Track how weakness scores evolve over time (weekly).

        Args:
            user_id: User ID
            platform: Platform
            game_analyses: Game analysis records
            weeks: Number of weeks to track

        Returns:
            List of weekly score snapshots
        """
        cutoff = datetime.utcnow() - timedelta(weeks=weeks)

        # Group analyses by week
        weekly: Dict[str, List[Dict]] = defaultdict(list)
        for a in game_analyses:
            created = a.get('created_at') or a.get('played_at', '')
            if isinstance(created, str) and created:
                try:
                    dt = datetime.fromisoformat(created.replace('Z', '+00:00')).replace(tzinfo=None)
                    if dt >= cutoff:
                        iso = dt.isocalendar()
                        wk = f"{iso[0]}-W{iso[1]:02d}"
                        weekly[wk].append(a)
                except (ValueError, TypeError):
                    pass

        evolution = []
        for wk in sorted(weekly.keys()):
            analyses = weekly[wk]
            scores: Dict[str, Any] = {'week': wk, 'scores': {}}

            # Calculate category scores for this week
            categories = {
                'tactical': 'tactical_score',
                'positional': 'positional_score',
                'opening': 'opening_accuracy',
                'middlegame': 'middle_game_accuracy',
                'endgame': 'endgame_accuracy',
            }
            for cat, key in categories.items():
                values = [a.get(key, 0) for a in analyses if a.get(key) is not None]
                if values:
                    scores['scores'][cat] = round(sum(values) / len(values), 1)

            # Blunder rate as inverted score
            total_blunders = sum(a.get('blunders', 0) for a in analyses)
            if analyses:
                blunder_rate = total_blunders / len(analyses)
                scores['scores']['blunders'] = round(max(0, 100 - blunder_rate * 20), 1)

            if scores['scores']:
                evolution.append(scores)

        return evolution

    # ========================================================================
    # ADVANCED METRICS (Phase 1-3)
    # ========================================================================

    def _build_games_lookup(self, games_data: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Build a lookup dict from games table data, keyed by provider_game_id."""
        lookup = {}
        for g in games_data:
            gid = g.get('provider_game_id')
            if gid:
                lookup[gid] = g
        return lookup

    def _get_user_eval(self, raw_eval: float, player_color: str) -> float:
        """Convert raw evaluation to user's perspective (positive = user is winning)."""
        if player_color == 'black':
            return -raw_eval
        return raw_eval

    def _compute_game_eval_metrics(
        self, analysis: Dict[str, Any], game_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Single-pass through moves_analysis for one game. Computes:
        - Advantage conversion tracking
        - Comeback/throw tracking
        - Phase transition evals

        Args:
            analysis: game_analyses record with moves_analysis JSONB
            game_data: Corresponding games table record (result, color, etc.)

        Returns:
            Per-game eval metrics dict
        """
        moves = analysis.get('moves_analysis') or []
        if not moves or not game_data:
            return {}

        result = game_data.get('result', '')  # win/loss/draw
        player_color = game_data.get('color', 'white')

        # Tracking state
        max_user_eval = -9999.0
        min_user_eval = 9999.0
        had_winning_position = False   # eval > +200cp at any point
        had_losing_position = False    # eval < -200cp at any point

        # Phase transition evals
        last_opening_eval = None
        last_middlegame_eval = None
        first_endgame_eval = None
        prev_phase = None

        for move in moves:
            if not isinstance(move, dict):
                continue

            is_user_move = move.get('is_user_move', False)
            eval_before = move.get('evaluation_before')
            eval_after = move.get('evaluation_after')
            game_phase = move.get('game_phase', '')

            # Use eval_after for the state after this move
            if eval_after is not None:
                try:
                    user_eval = self._get_user_eval(float(eval_after), player_color)
                except (ValueError, TypeError):
                    continue

                max_user_eval = max(max_user_eval, user_eval)
                min_user_eval = min(min_user_eval, user_eval)

                if user_eval >= 200:
                    had_winning_position = True
                if user_eval <= -200:
                    had_losing_position = True

            # Track phase transition evals
            if eval_before is not None:
                try:
                    user_eval_before = self._get_user_eval(float(eval_before), player_color)
                except (ValueError, TypeError):
                    user_eval_before = None

                if user_eval_before is not None:
                    if game_phase == 'opening':
                        last_opening_eval = user_eval_before
                    elif game_phase == 'middlegame':
                        if prev_phase == 'opening' and last_opening_eval is None:
                            last_opening_eval = user_eval_before
                        last_middlegame_eval = user_eval_before
                    elif game_phase == 'endgame':
                        if first_endgame_eval is None:
                            first_endgame_eval = user_eval_before

            prev_phase = game_phase

        # Determine advantage conversion
        converted = had_winning_position and result == 'win'
        threw = had_winning_position and result == 'loss'
        comeback = had_losing_position and result == 'win'

        return {
            'had_winning_position': had_winning_position,
            'had_losing_position': had_losing_position,
            'converted': converted,
            'threw': threw,
            'comeback': comeback,
            'result': result,
            'last_opening_eval': last_opening_eval,
            'last_middlegame_eval': last_middlegame_eval,
            'first_endgame_eval': first_endgame_eval,
        }

    async def get_advanced_metrics(
        self, user_id: str, platform: str,
        game_analyses: List[Dict[str, Any]],
        games_data: List[Dict[str, Any]],
        period_days: int = 90
    ) -> Dict[str, Any]:
        """
        Compute advanced progress metrics from game analyses and games data.

        Args:
            user_id: Canonical user ID
            platform: Platform
            game_analyses: Game analysis records (with moves_analysis)
            games_data: Games table records (with result, color, opening, etc.)
            period_days: Number of days to look back

        Returns:
            Dict with advantage_conversion, comeback_throw, win_loss_by_phase
        """
        cutoff = datetime.utcnow() - timedelta(days=period_days)
        games_lookup = self._build_games_lookup(games_data)

        # Per-game results
        game_metrics: List[Dict[str, Any]] = []
        game_weeks: List[str] = []
        game_weeks_map: Dict[str, str] = {}  # game_id -> week key

        for a in game_analyses:
            # Parse date and filter by period
            created = a.get('created_at') or a.get('played_at', '')
            parsed_date = datetime.utcnow()
            if isinstance(created, str) and created:
                try:
                    parsed_date = datetime.fromisoformat(created.replace('Z', '+00:00')).replace(tzinfo=None)
                except (ValueError, TypeError):
                    pass

            if parsed_date < cutoff:
                continue

            game_id = a.get('game_id', '')
            game_data = games_lookup.get(game_id)
            iso = parsed_date.isocalendar()
            wk = f"{iso[0]}-W{iso[1]:02d}"
            game_weeks_map[game_id] = wk

            metrics = self._compute_game_eval_metrics(a, game_data)
            if metrics:
                game_metrics.append(metrics)
                game_weeks.append(wk)

        # Aggregate: Advantage Conversion
        games_with_advantage = sum(1 for m in game_metrics if m.get('had_winning_position'))
        games_converted = sum(1 for m in game_metrics if m.get('converted'))
        overall_conversion = (
            round(games_converted / games_with_advantage * 100, 1)
            if games_with_advantage > 0 else 0
        )

        # Aggregate: Comeback / Throw
        total_comebacks = sum(1 for m in game_metrics if m.get('comeback'))
        total_throws = sum(1 for m in game_metrics if m.get('threw'))
        games_with_losing = sum(1 for m in game_metrics if m.get('had_losing_position'))
        total_decided = len([m for m in game_metrics if m.get('result') in ('win', 'loss')])

        comeback_rate = (
            round(total_comebacks / games_with_losing * 100, 1)
            if games_with_losing > 0 else 0
        )
        throw_rate = (
            round(total_throws / games_with_advantage * 100, 1)
            if games_with_advantage > 0 else 0
        )

        # Weekly trends
        weekly_data: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            'advantage_opps': 0, 'converted': 0,
            'comebacks': 0, 'throws': 0, 'decided': 0,
            'opening_evals': [], 'middlegame_evals': [], 'endgame_evals': [],
        })

        for i, metrics in enumerate(game_metrics):
            wk = game_weeks[i]
            wd = weekly_data[wk]

            if metrics.get('had_winning_position'):
                wd['advantage_opps'] += 1
            if metrics.get('converted'):
                wd['converted'] += 1
            if metrics.get('comeback'):
                wd['comebacks'] += 1
            if metrics.get('threw'):
                wd['throws'] += 1
            if metrics.get('result') in ('win', 'loss'):
                wd['decided'] += 1

            if metrics.get('last_opening_eval') is not None:
                wd['opening_evals'].append(metrics['last_opening_eval'])
            if metrics.get('last_middlegame_eval') is not None:
                wd['middlegame_evals'].append(metrics['last_middlegame_eval'])
            if metrics.get('first_endgame_eval') is not None:
                wd['endgame_evals'].append(metrics['first_endgame_eval'])

        sorted_weeks = sorted(weekly_data.keys())

        conversion_trend = []
        comeback_throw_trend = []
        phase_eval_trend = []

        for wk in sorted_weeks:
            wd = weekly_data[wk]

            if wd['advantage_opps'] > 0:
                conversion_trend.append({
                    'week': wk,
                    'rate': round(wd['converted'] / wd['advantage_opps'] * 100, 1),
                    'opportunities': wd['advantage_opps'],
                    'converted': wd['converted'],
                })

            comeback_throw_trend.append({
                'week': wk,
                'comebacks': wd['comebacks'],
                'throws': wd['throws'],
                'total_decided': wd['decided'],
            })

            if wd['opening_evals'] or wd['middlegame_evals'] or wd['endgame_evals']:
                phase_eval_trend.append({
                    'week': wk,
                    'avg_opening_eval': round(
                        sum(wd['opening_evals']) / len(wd['opening_evals']), 1
                    ) if wd['opening_evals'] else None,
                    'avg_middlegame_eval': round(
                        sum(wd['middlegame_evals']) / len(wd['middlegame_evals']), 1
                    ) if wd['middlegame_evals'] else None,
                    'avg_endgame_eval': round(
                        sum(wd['endgame_evals']) / len(wd['endgame_evals']), 1
                    ) if wd['endgame_evals'] else None,
                })

        # Win/Loss by phase summary
        opening_advantage_wins = 0
        middlegame_decided = 0
        endgame_decided = 0

        for m in game_metrics:
            op_eval = m.get('last_opening_eval')
            mg_eval = m.get('last_middlegame_eval')
            eg_eval = m.get('first_endgame_eval')
            res = m.get('result')

            if res == 'win' and op_eval is not None and op_eval >= 100:
                opening_advantage_wins += 1
            if mg_eval is not None and op_eval is not None:
                if abs(mg_eval - (op_eval or 0)) > 150:
                    middlegame_decided += 1
            if eg_eval is not None and mg_eval is not None:
                if abs(eg_eval - (mg_eval or 0)) > 150:
                    endgame_decided += 1

        # Phase 2: Opening repertoire and time trouble
        opening_repertoire = self._compute_opening_repertoire(game_analyses, games_data, game_weeks_map)
        time_trouble = self._compute_time_trouble_proxy(game_analyses, games_data, game_weeks_map)

        # Phase 3: Deep per-move metrics
        deep_metrics = self._compute_deep_move_metrics(game_analyses, games_data, game_weeks_map)

        result = {
            'advantage_conversion': {
                'overall_rate': overall_conversion,
                'total_opportunities': games_with_advantage,
                'total_converted': games_converted,
                'weekly_trend': conversion_trend,
            },
            'comeback_throw': {
                'comeback_rate': comeback_rate,
                'throw_rate': throw_rate,
                'total_comebacks': total_comebacks,
                'total_throws': total_throws,
                'weekly_trend': comeback_throw_trend,
            },
            'win_loss_by_phase': {
                'summary': {
                    'opening_advantage_wins': opening_advantage_wins,
                    'middlegame_decided': middlegame_decided,
                    'endgame_decided': endgame_decided,
                },
                'weekly_trend': phase_eval_trend,
            },
        }

        if opening_repertoire:
            result['opening_repertoire'] = opening_repertoire
        if time_trouble:
            result['time_trouble'] = time_trouble
        if deep_metrics:
            result.update(deep_metrics)

        return result

    # ========================================================================
    # PHASE 2: Opening Repertoire & Time Trouble
    # ========================================================================

    @staticmethod
    def _parse_time_control_category(tc: str) -> str:
        """Classify time control string into category."""
        if not tc:
            return 'unknown'
        try:
            parts = tc.split('+')
            base_seconds = int(parts[0])
            increment = int(parts[1]) if len(parts) > 1 else 0
            total_estimated = base_seconds + 40 * increment
            if total_estimated < 180:
                return 'Bullet'
            elif total_estimated < 600:
                return 'Blitz'
            elif total_estimated < 1800:
                return 'Rapid'
            else:
                return 'Classical'
        except (ValueError, IndexError):
            return 'unknown'

    def _compute_opening_repertoire(
        self, game_analyses: List[Dict[str, Any]],
        games_data: List[Dict[str, Any]],
        game_weeks_map: Dict[str, str]
    ) -> Optional[Dict[str, Any]]:
        """Compute opening repertoire performance by grouping games by opening + color."""
        games_lookup = self._build_games_lookup(games_data)

        # Group by (opening_family, color)
        opening_stats: Dict[Tuple[str, str], Dict[str, Any]] = defaultdict(
            lambda: {'wins': 0, 'losses': 0, 'draws': 0, 'accuracies': [], 'games': 0}
        )

        for a in game_analyses:
            game_id = a.get('game_id', '')
            if game_id not in game_weeks_map:
                continue  # Outside period
            game = games_lookup.get(game_id)
            if not game:
                continue

            opening = game.get('opening_family') or 'Unknown'
            color = game.get('color') or 'white'
            result = game.get('result', '')
            accuracy = a.get('accuracy', 0)

            key = (opening, color)
            stats = opening_stats[key]
            stats['games'] += 1
            if result == 'win':
                stats['wins'] += 1
            elif result == 'loss':
                stats['losses'] += 1
            elif result == 'draw':
                stats['draws'] += 1
            if accuracy and accuracy > 0:
                stats['accuracies'].append(accuracy)

        if not opening_stats:
            return None

        openings = []
        for (opening, color), stats in opening_stats.items():
            if stats['games'] < 3:
                continue
            total = stats['games']
            win_rate = round(stats['wins'] / total * 100, 1)
            draw_rate = round(stats['draws'] / total * 100, 1)
            avg_acc = round(
                sum(stats['accuracies']) / len(stats['accuracies']), 1
            ) if stats['accuracies'] else 0
            performance = round(win_rate * 0.6 + avg_acc * 0.4, 1)

            openings.append({
                'opening_family': opening,
                'color': color,
                'games': total,
                'win_rate': win_rate,
                'draw_rate': draw_rate,
                'avg_accuracy': avg_acc,
                'performance_score': performance,
            })

        openings.sort(key=lambda x: x['games'], reverse=True)

        best = max(openings, key=lambda x: x['performance_score']) if openings else None
        worst = min(openings, key=lambda x: x['performance_score']) if openings else None

        return {
            'openings': openings[:20],  # Top 20 by game count
            'best_opening': {
                'name': best['opening_family'],
                'color': best['color'],
                'win_rate': best['win_rate'],
            } if best else None,
            'worst_opening': {
                'name': worst['opening_family'],
                'color': worst['color'],
                'win_rate': worst['win_rate'],
            } if worst else None,
        }

    def _compute_time_trouble_proxy(
        self, game_analyses: List[Dict[str, Any]],
        games_data: List[Dict[str, Any]],
        game_weeks_map: Dict[str, str]
    ) -> Optional[Dict[str, Any]]:
        """Compute time trouble proxy via accuracy degradation in endgame vs earlier phases."""
        games_lookup = self._build_games_lookup(games_data)

        degradations: List[float] = []
        weekly_degs: Dict[str, List[float]] = defaultdict(list)
        tc_stats: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {'accuracies': [], 'blunders': [], 'games': 0}
        )

        for a in game_analyses:
            game_id = a.get('game_id', '')
            wk = game_weeks_map.get(game_id)
            if not wk:
                continue

            op_acc = a.get('opening_accuracy', 0) or 0
            mg_acc = a.get('middle_game_accuracy', 0) or 0
            eg_acc = a.get('endgame_accuracy', 0) or 0

            # Skip games without endgame data
            if eg_acc <= 0 or (op_acc <= 0 and mg_acc <= 0):
                continue

            early_avg = 0
            count = 0
            if op_acc > 0:
                early_avg += op_acc
                count += 1
            if mg_acc > 0:
                early_avg += mg_acc
                count += 1
            if count > 0:
                early_avg /= count

            degradation = round(early_avg - eg_acc, 1)
            degradations.append(degradation)
            weekly_degs[wk].append(degradation)

            # Time control stats
            game = games_lookup.get(game_id)
            if game:
                tc = game.get('time_control', '')
                category = self._parse_time_control_category(tc)
                if category != 'unknown':
                    tc_stats[category]['accuracies'].append(a.get('accuracy', 0) or 0)
                    tc_stats[category]['blunders'].append(a.get('blunders', 0) or 0)
                    tc_stats[category]['games'] += 1

        if not degradations:
            return None

        avg_degradation = round(sum(degradations) / len(degradations), 1)

        by_time_control = []
        for cat in ['Bullet', 'Blitz', 'Rapid', 'Classical']:
            if cat in tc_stats and tc_stats[cat]['games'] >= 2:
                stats = tc_stats[cat]
                by_time_control.append({
                    'category': cat,
                    'avg_accuracy': round(
                        sum(stats['accuracies']) / len(stats['accuracies']), 1
                    ) if stats['accuracies'] else 0,
                    'avg_blunders': round(
                        sum(stats['blunders']) / len(stats['blunders']), 1
                    ) if stats['blunders'] else 0,
                    'games': stats['games'],
                })

        weekly_trend = []
        for wk in sorted(weekly_degs.keys()):
            vals = weekly_degs[wk]
            weekly_trend.append({
                'week': wk,
                'degradation': round(sum(vals) / len(vals), 1),
            })

        return {
            'avg_accuracy_degradation': avg_degradation,
            'by_time_control': by_time_control,
            'weekly_trend': weekly_trend,
        }

    # ========================================================================
    # PHASE 3: Deep Per-Move Analysis
    # ========================================================================

    @staticmethod
    def _classify_endgame_type(fen: str) -> str:
        """Classify endgame type from FEN by counting pieces."""
        if not fen:
            return 'complex'
        piece_section = fen.split(' ')[0]
        pieces = {'R': 0, 'N': 0, 'B': 0, 'Q': 0, 'r': 0, 'n': 0, 'b': 0, 'q': 0}
        for ch in piece_section:
            if ch in pieces:
                pieces[ch] += 1

        has_rook = (pieces['R'] + pieces['r']) > 0
        has_minor = (pieces['N'] + pieces['n'] + pieces['B'] + pieces['b']) > 0
        has_queen = (pieces['Q'] + pieces['q']) > 0

        if has_queen:
            return 'Queen'
        if has_rook and not has_minor:
            return 'Rook'
        if has_minor and not has_rook:
            return 'Minor Piece'
        if has_rook and has_minor:
            return 'Rook + Minor'
        return 'Pawn'

    def _compute_deep_move_metrics(
        self, game_analyses: List[Dict[str, Any]],
        games_data: List[Dict[str, Any]],
        game_weeks_map: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Compute Phase 3 metrics: critical moments, endgame types, missed tactics.
        Single pass through moves_analysis for each game.
        """
        games_lookup = self._build_games_lookup(games_data)

        # Accumulators
        critical_cpls: List[float] = []
        normal_cpls: List[float] = []
        weekly_critical: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {'cpls': [], 'count': 0}
        )

        endgame_type_stats: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {'cpls': [], 'games': set()}
        )

        missed_tactics_per_game: List[float] = []
        missed_pattern_counts: Dict[str, int] = defaultdict(int)
        weekly_missed: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {'missed': 0, 'games': 0}
        )

        total_games_processed = 0

        for a in game_analyses:
            game_id = a.get('game_id', '')
            wk = game_weeks_map.get(game_id)
            if not wk:
                continue

            moves = a.get('moves_analysis') or []
            if not moves or not isinstance(moves, list):
                continue

            game_data = games_lookup.get(game_id)
            player_color = (game_data or {}).get('color', 'white')
            total_games_processed += 1
            game_missed_count = 0

            for i, move in enumerate(moves):
                if not isinstance(move, dict):
                    continue

                is_user = move.get('is_user_move', False)
                cpl = move.get('centipawn_loss')
                game_phase = move.get('game_phase', '')
                eval_before = move.get('evaluation_before')

                if cpl is None:
                    continue

                try:
                    cpl = float(cpl)
                except (ValueError, TypeError):
                    continue

                if not is_user:
                    continue

                # Critical moment detection:
                # Position is roughly equal AND there's a high-CPL move nearby
                is_critical = False
                if eval_before is not None:
                    try:
                        user_eval = self._get_user_eval(float(eval_before), player_color)
                        if abs(user_eval) < 200:
                            # Check if any neighboring moves had high CPL
                            for j in range(max(0, i - 2), min(len(moves), i + 3)):
                                neighbor = moves[j]
                                if isinstance(neighbor, dict):
                                    ncpl = neighbor.get('centipawn_loss')
                                    if ncpl is not None:
                                        try:
                                            if float(ncpl) > 100:
                                                is_critical = True
                                                break
                                        except (ValueError, TypeError):
                                            pass
                    except (ValueError, TypeError):
                        pass

                if is_critical:
                    critical_cpls.append(cpl)
                    weekly_critical[wk]['cpls'].append(cpl)
                    weekly_critical[wk]['count'] += 1
                else:
                    normal_cpls.append(cpl)

                # Endgame type classification
                if game_phase == 'endgame':
                    fen = move.get('fen_before', '')
                    eg_type = self._classify_endgame_type(fen)
                    endgame_type_stats[eg_type]['cpls'].append(cpl)
                    endgame_type_stats[eg_type]['games'].add(game_id)

                # Missed tactic detection
                is_mistake = move.get('is_mistake', False) or move.get('is_blunder', False)
                tactical_insights = move.get('tactical_insights') or []
                if is_mistake and tactical_insights:
                    game_missed_count += 1

            missed_tactics_per_game.append(game_missed_count)
            weekly_missed[wk]['missed'] += game_missed_count
            weekly_missed[wk]['games'] += 1

            # Check game-level tactical_patterns for most common missed types
            patterns = a.get('tactical_patterns') or []
            if isinstance(patterns, list):
                for p in patterns:
                    if isinstance(p, dict):
                        ptype = p.get('type') or p.get('pattern_type', '')
                        if ptype:
                            missed_pattern_counts[ptype] += 1

        result: Dict[str, Any] = {}

        # Critical moments
        if critical_cpls:
            avg_critical = round(sum(critical_cpls) / len(critical_cpls), 1)
            avg_normal = round(
                sum(normal_cpls) / len(normal_cpls), 1
            ) if normal_cpls else 0
            ratio = round(avg_critical / avg_normal, 2) if avg_normal > 0 else 1.0

            critical_trend = []
            for wk in sorted(weekly_critical.keys()):
                wd = weekly_critical[wk]
                if wd['cpls']:
                    critical_trend.append({
                        'week': wk,
                        'avg_cpl_critical': round(sum(wd['cpls']) / len(wd['cpls']), 1),
                        'critical_count': wd['count'],
                    })

            result['critical_moments'] = {
                'avg_cpl_critical': avg_critical,
                'avg_cpl_normal': avg_normal,
                'critical_performance_ratio': ratio,
                'total_critical_moments': len(critical_cpls),
                'weekly_trend': critical_trend,
            }

        # Endgame types
        if endgame_type_stats:
            types_list = []
            for eg_type, stats in endgame_type_stats.items():
                if stats['cpls']:
                    avg_cpl = round(sum(stats['cpls']) / len(stats['cpls']), 1)
                    acc_est = round(max(0, 100 - avg_cpl * 0.5), 1)
                    types_list.append({
                        'type': eg_type,
                        'games': len(stats['games']),
                        'avg_cpl': avg_cpl,
                        'accuracy_estimate': acc_est,
                    })

            types_list.sort(key=lambda x: x['games'], reverse=True)
            best_t = min(types_list, key=lambda x: x['avg_cpl']) if types_list else None
            worst_t = max(types_list, key=lambda x: x['avg_cpl']) if types_list else None

            result['endgame_types'] = {
                'types': types_list,
                'best_type': best_t['type'] if best_t else None,
                'worst_type': worst_t['type'] if worst_t else None,
            }

        # Missed tactics
        if total_games_processed > 0:
            total_missed = sum(missed_tactics_per_game)
            per_game = round(total_missed / total_games_processed, 2)
            most_common = max(
                missed_pattern_counts, key=missed_pattern_counts.get
            ) if missed_pattern_counts else None

            missed_trend = []
            for wk in sorted(weekly_missed.keys()):
                wd = weekly_missed[wk]
                if wd['games'] > 0:
                    missed_trend.append({
                        'week': wk,
                        'missed_per_game': round(wd['missed'] / wd['games'], 2),
                    })

            result['missed_tactics'] = {
                'total_missed': total_missed,
                'per_game_rate': per_game,
                'most_common_missed': most_common,
                'weekly_trend': missed_trend,
            }

        return result

    # ========================================================================
    # PHASE 4: Peer Comparison & Diagnostic
    # ========================================================================

    async def get_peer_comparison(
        self, user_id: str, platform: str,
        user_metrics: Dict[str, Any], user_rating: int
    ) -> Optional[Dict[str, Any]]:
        """
        Compare user's metrics against peers at similar rating.

        Args:
            user_id: Canonical user ID
            platform: Platform
            user_metrics: User's computed metrics (accuracy, blunders, etc.)
            user_rating: User's average rating

        Returns:
            Peer comparison data or None if insufficient peers
        """
        rating_min = user_rating - 100
        rating_max = user_rating + 100

        try:
            # Step 1: Get distinct peer user IDs at similar rating
            peers_result = await asyncio.to_thread(
                lambda: self.supabase.rpc('get_peer_user_ids', {
                    'p_platform': platform,
                    'p_rating_min': rating_min,
                    'p_rating_max': rating_max,
                    'p_exclude_user': user_id,
                    'p_limit': 100,
                }).execute()
            )
        except Exception:
            # RPC may not exist - fall back to direct query
            try:
                peers_result = await asyncio.to_thread(
                    lambda: self.supabase.table('games')
                    .select('user_id')
                    .eq('platform', platform)
                    .gte('my_rating', rating_min)
                    .lte('my_rating', rating_max)
                    .neq('user_id', user_id)
                    .limit(500)
                    .execute()
                )
            except Exception as e:
                logger.warning(f"[PROGRESS] Failed to fetch peer data: {e}")
                return None

        peer_data = peers_result.data or []
        if not peer_data:
            return None

        # Get unique peer user IDs
        peer_ids = list(set(
            p.get('user_id') for p in peer_data if p.get('user_id')
        ))[:50]  # Cap at 50 peers for performance

        if len(peer_ids) < 3:
            return None

        # Step 2: Get aggregate stats for peers
        try:
            peer_analyses = await asyncio.to_thread(
                lambda: self.supabase.table('game_analyses')
                .select('accuracy, blunders, mistakes, average_centipawn_loss, tactical_score, positional_score, total_moves')
                .eq('platform', platform)
                .in_('user_id', peer_ids)
                .limit(2000)
                .execute()
            )
        except Exception as e:
            logger.warning(f"[PROGRESS] Failed to fetch peer analyses: {e}")
            return None

        peer_records = peer_analyses.data or []
        if len(peer_records) < 10:
            return None

        # Compute peer averages
        def peer_avg(key: str) -> float:
            vals = [r.get(key, 0) for r in peer_records if r.get(key) is not None and r.get(key, 0) > 0]
            return round(sum(vals) / len(vals), 1) if vals else 0

        def peer_blunders_per_game() -> float:
            total_b = sum(r.get('blunders', 0) for r in peer_records)
            total_g = len(peer_records)
            return round(total_b / total_g, 2) if total_g > 0 else 0

        peer_accuracy = peer_avg('accuracy')
        peer_bpg = peer_blunders_per_game()
        peer_acl = peer_avg('average_centipawn_loss')
        peer_tactical = peer_avg('tactical_score')

        # Build comparisons
        comparisons = []
        metrics_to_compare = [
            ('accuracy', 'Accuracy', user_metrics.get('accuracy', 0), peer_accuracy, True),
            ('blunders_per_game', 'Blunders/Game', user_metrics.get('blunders_per_game', 0), peer_bpg, False),
            ('avg_cpl', 'Avg Centipawn Loss', user_metrics.get('avg_cpl', 0), peer_acl, False),
            ('tactical_score', 'Tactical Score', user_metrics.get('tactical_score', 0), peer_tactical, True),
        ]

        for metric, label, your_val, peer_val, higher_is_better in metrics_to_compare:
            if peer_val == 0:
                continue

            if higher_is_better:
                percentile = min(99, max(1, round(50 + (your_val - peer_val) / max(peer_val, 1) * 100)))
                assessment = 'above_average' if your_val > peer_val * 1.05 else (
                    'below_average' if your_val < peer_val * 0.95 else 'average'
                )
            else:
                percentile = min(99, max(1, round(50 + (peer_val - your_val) / max(peer_val, 1) * 100)))
                assessment = 'above_average' if your_val < peer_val * 0.95 else (
                    'below_average' if your_val > peer_val * 1.05 else 'average'
                )

            comparisons.append({
                'metric': metric,
                'label': label,
                'your_value': round(your_val, 1),
                'peer_avg': peer_val,
                'percentile': percentile,
                'assessment': assessment,
            })

        if not comparisons:
            return None

        return {
            'peer_rating_range': {'min': rating_min, 'max': rating_max},
            'peer_count': len(peer_ids),
            'comparisons': comparisons,
        }

    @staticmethod
    def generate_diagnostic_summary(
        advanced_metrics: Dict[str, Any],
        peer_comparison: Optional[Dict[str, Any]],
        user_rating: int
    ) -> Dict[str, Any]:
        """
        Generate a template-based diagnostic summary from computed metrics.
        No AI call - fast and deterministic.

        Args:
            advanced_metrics: All computed advanced metrics
            peer_comparison: Peer comparison data (optional)
            user_rating: User's average rating

        Returns:
            Diagnostic summary dict
        """
        insights: List[str] = []
        key_insight = ''

        # Advantage conversion
        conv = advanced_metrics.get('advantage_conversion', {})
        conv_rate = conv.get('overall_rate', 0)
        if conv_rate > 0:
            if conv_rate < 40:
                insights.append(
                    f"Your advantage conversion rate is {conv_rate}% - you're losing many games "
                    f"where you had a winning position. Focus on technique when ahead."
                )
                if not key_insight:
                    key_insight = 'Low advantage conversion'
            elif conv_rate >= 70:
                insights.append(
                    f"Excellent conversion rate ({conv_rate}%) - you close out winning positions well."
                )

        # Throw rate
        ct = advanced_metrics.get('comeback_throw', {})
        throw_rate = ct.get('throw_rate', 0)
        if throw_rate > 30:
            insights.append(
                f"You throw away winning positions {throw_rate}% of the time. "
                f"Double-check moves when you're ahead."
            )
            if not key_insight:
                key_insight = 'High throw rate'

        # Opening weakness
        openings = advanced_metrics.get('opening_repertoire', {})
        worst = openings.get('worst_opening')
        if worst and worst.get('win_rate', 50) < 35:
            insights.append(
                f"Your weakest opening is {worst['name']} as {worst['color']} "
                f"({worst['win_rate']}% win rate). Consider studying alternatives."
            )
            if not key_insight:
                key_insight = f"Weak in {worst['name']}"

        # Time trouble
        tt = advanced_metrics.get('time_trouble', {})
        degradation = tt.get('avg_accuracy_degradation', 0)
        if degradation > 10:
            insights.append(
                f"Your accuracy drops {degradation}% in endgames vs earlier phases. "
                f"This suggests time trouble or endgame weakness."
            )
            if not key_insight:
                key_insight = 'Endgame accuracy drop'

        # Missed tactics
        mt = advanced_metrics.get('missed_tactics', {})
        if mt.get('per_game_rate', 0) > 1.5:
            common = mt.get('most_common_missed', 'tactics')
            insights.append(
                f"You miss {mt['per_game_rate']} tactics per game. "
                f"Practice {common.lower()} patterns."
            )
            if not key_insight:
                key_insight = 'High missed tactics rate'

        # Endgame types
        eg = advanced_metrics.get('endgame_types', {})
        worst_eg = eg.get('worst_type')
        if worst_eg:
            worst_type_data = next(
                (t for t in eg.get('types', []) if t['type'] == worst_eg), None
            )
            if worst_type_data and worst_type_data.get('avg_cpl', 0) > 40:
                insights.append(
                    f"Your weakest endgame type is {worst_eg} endgames "
                    f"(avg {worst_type_data['avg_cpl']} centipawn loss)."
                )

        # Peer comparison
        if peer_comparison:
            below = [
                c for c in peer_comparison.get('comparisons', [])
                if c.get('assessment') == 'below_average'
            ]
            if below:
                labels = ', '.join(c['label'].lower() for c in below[:2])
                insights.append(
                    f"Compared to {peer_comparison.get('peer_count', 0)} peers at your rating, "
                    f"your {labels} could improve."
                )

        if not insights:
            summary = (
                f"As a ~{user_rating}-rated player, your metrics look solid. "
                f"Keep playing and analyzing to build more data for detailed insights."
            )
        else:
            summary = ' '.join(insights[:4])

        return {
            'summary': summary,
            'generated_by': 'template',
            'key_insight': key_insight or 'Keep improving',
        }
