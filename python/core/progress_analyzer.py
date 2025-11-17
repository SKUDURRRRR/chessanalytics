#!/usr/bin/env python3
"""
Progress Analyzer Module
Analyzes user's game data to identify strengths, weaknesses, and generate recommendations.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
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

        # Identify weaknesses (low scores or high error rates)
        weakness_candidates = []

        if avg_tactical < 60:
            weakness_candidates.append({
                'category': 'tactical',
                'title': 'Tactical Vision',
                'description': f'Your tactical score is {avg_tactical:.1f}/100. You average {blunders_per_game:.1f} blunders per game.',
                'score': avg_tactical,
                'severity': 'critical' if avg_tactical < 50 else 'important',
                'recommendation': 'Focus on tactical puzzles and pattern recognition.',
            })

        if avg_positional < 60:
            weakness_candidates.append({
                'category': 'positional',
                'title': 'Positional Understanding',
                'description': f'Your positional score is {avg_positional:.1f}/100. Improve your strategic play.',
                'score': avg_positional,
                'severity': 'critical' if avg_positional < 50 else 'important',
                'recommendation': 'Study positional concepts and endgame technique.',
            })

        if avg_opening < 70 and opening_accuracies:
            weakness_candidates.append({
                'category': 'opening',
                'title': 'Opening Accuracy',
                'description': f'Your opening accuracy is {avg_opening:.1f}%. Learn opening principles.',
                'score': avg_opening,
                'severity': 'critical' if avg_opening < 60 else 'important',
                'recommendation': 'Study opening theory and build a consistent repertoire.',
            })

        if avg_middlegame < 70 and middlegame_accuracies:
            weakness_candidates.append({
                'category': 'middlegame',
                'title': 'Middlegame Play',
                'description': f'Your middlegame accuracy is {avg_middlegame:.1f}%.',
                'score': avg_middlegame,
                'severity': 'critical' if avg_middlegame < 60 else 'important',
                'recommendation': 'Practice planning and piece coordination.',
            })

        if avg_endgame < 70 and endgame_accuracies:
            weakness_candidates.append({
                'category': 'endgame',
                'title': 'Endgame Technique',
                'description': f'Your endgame accuracy is {avg_endgame:.1f}%.',
                'score': avg_endgame,
                'severity': 'critical' if avg_endgame < 60 else 'important',
                'recommendation': 'Study endgame theory and practice conversion.',
            })

        if blunders_per_game > 0.5:
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
