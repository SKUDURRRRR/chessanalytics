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
