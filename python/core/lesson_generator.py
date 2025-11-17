#!/usr/bin/env python3
"""
Lesson Generator Module
Generates personalized chess lessons from user's game analysis data.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)


class LessonGenerator:
    """Generates personalized lessons from game analysis data."""

    def __init__(self, supabase_client):
        """
        Initialize lesson generator.

        Args:
            supabase_client: Supabase client instance
        """
        self.supabase = supabase_client

    async def generate_opening_lessons(
        self, user_id: str, platform: str, game_analyses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Generate opening lessons based on user's opening mistakes.

        Args:
            user_id: User ID
            platform: Platform ('lichess' or 'chess.com')
            game_analyses: List of game analysis records

        Returns:
            List of lesson dictionaries
        """
        lessons = []

        if not game_analyses:
            return lessons

        # Analyze opening performance
        opening_stats = {}
        opening_mistakes = {}

        for analysis in game_analyses:
            opening = analysis.get('opening') or analysis.get('opening_family')
            if not opening:
                continue

            opening_accuracy = analysis.get('opening_accuracy', 0)
            blunders = analysis.get('blunders', 0)
            mistakes = analysis.get('mistakes', 0)

            if opening not in opening_stats:
                opening_stats[opening] = {
                    'games': 0,
                    'total_accuracy': 0,
                    'total_errors': 0,
                }
                opening_mistakes[opening] = []

            opening_stats[opening]['games'] += 1
            opening_stats[opening]['total_accuracy'] += opening_accuracy
            opening_stats[opening]['total_errors'] += blunders + mistakes

            if blunders > 0 or mistakes > 0:
                opening_mistakes[opening].append({
                    'game_id': analysis.get('game_id'),
                    'blunders': blunders,
                    'mistakes': mistakes,
                    'accuracy': opening_accuracy,
                })

        # Find openings with low performance
        logger.info(f"[LESSON_GENERATOR] Analyzing {len(opening_stats)} openings for user")
        for opening, stats in opening_stats.items():
            avg_accuracy = stats['total_accuracy'] / stats['games']
            error_rate = stats['total_errors'] / stats['games']
            logger.info(f"[LESSON_GENERATOR] Opening '{opening}': avg_accuracy={avg_accuracy:.1f}%, error_rate={error_rate:.2f}")

            # Generate lesson if opening has issues (lowered threshold to generate more lessons)
            if avg_accuracy < 80 or error_rate > 0.5:
                priority = 'critical' if avg_accuracy < 60 else 'important'

                lesson = {
                    'user_id': user_id,
                    'platform': platform,
                    'lesson_type': 'opening',
                    'lesson_title': f'Master {opening}',
                    'lesson_description': f'Improve your {opening} play. Your current accuracy is {avg_accuracy:.1f}% with {error_rate:.1f} errors per game.',
                    'lesson_content': {
                        'theory': f'Learn the key principles and common plans in {opening}.',
                        'common_mistakes': opening_mistakes.get(opening, [])[:3],  # Top 3 mistake examples
                        'practice_positions': [],
                        'action_items': [
                            f'Study {opening} theory',
                            f'Review your {len(opening_mistakes.get(opening, []))} games with mistakes',
                            'Practice this opening in your next games',
                        ],
                    },
                    'priority': priority,
                    'estimated_time_minutes': 20,
                    'generated_from_games': [m['game_id'] for m in opening_mistakes.get(opening, [])[:5]],
                }
                lessons.append(lesson)

        return lessons[:5]  # Limit to top 5 opening lessons

    async def generate_tactical_lessons(
        self, user_id: str, platform: str, game_analyses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Generate tactical lessons based on tactical score and blunders.

        Args:
            user_id: User ID
            platform: Platform
            game_analyses: List of game analysis records

        Returns:
            List of lesson dictionaries
        """
        lessons = []

        if not game_analyses:
            return lessons

        # Calculate average tactical score
        tactical_scores = [a.get('tactical_score', 50) for a in game_analyses if a.get('tactical_score')]
        avg_tactical = sum(tactical_scores) / len(tactical_scores) if tactical_scores else 50

        # Count total blunders
        total_blunders = sum(a.get('blunders', 0) for a in game_analyses)
        total_games = len(game_analyses)
        blunders_per_game = total_blunders / total_games if total_games > 0 else 0

        # Find games with most blunders
        high_blunder_games = sorted(
            [a for a in game_analyses if a.get('blunders', 0) > 0],
            key=lambda x: x.get('blunders', 0),
            reverse=True
        )[:5]

        logger.info(f"[LESSON_GENERATOR] Tactical analysis: avg_tactical={avg_tactical:.1f}, blunders_per_game={blunders_per_game:.2f}")

        # Always generate at least one tactical lesson if there are any blunders, or if tactical score is below 80
        if avg_tactical < 80 or blunders_per_game > 0.3:
            priority = 'critical' if avg_tactical < 50 or blunders_per_game > 1.0 else 'important'

            lesson = {
                'user_id': user_id,
                'platform': platform,
                'lesson_type': 'tactical',
                'lesson_title': 'Improve Your Tactical Vision',
                'lesson_description': f'Your tactical score is {avg_tactical:.1f}/100. You average {blunders_per_game:.1f} blunders per game. Let\'s fix that!',
                'lesson_content': {
                    'theory': 'Tactical vision is about recognizing patterns: pins, forks, skewers, discovered attacks. Practice identifying these motifs.',
                    'common_mistakes': [
                        {
                            'game_id': g.get('game_id'),
                            'blunders': g.get('blunders', 0),
                            'tactical_score': g.get('tactical_score', 0),
                        }
                        for g in high_blunder_games[:3]
                    ],
                    'practice_positions': [],
                    'action_items': [
                        'Solve 10 tactical puzzles daily',
                        'Review your blunders and identify the tactical pattern you missed',
                        'Practice calculation: visualize 3-4 moves ahead',
                    ],
                },
                'priority': priority,
                'estimated_time_minutes': 25,
                'generated_from_games': [g.get('game_id') for g in high_blunder_games],
            }
            lessons.append(lesson)

        return lessons

    async def generate_positional_lessons(
        self, user_id: str, platform: str, game_analyses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Generate positional lessons based on positional score and phase accuracy.

        Args:
            user_id: User ID
            platform: Platform
            game_analyses: List of game analysis records

        Returns:
            List of lesson dictionaries
        """
        lessons = []

        if not game_analyses:
            return lessons

        # Calculate average positional score
        positional_scores = [a.get('positional_score', 50) for a in game_analyses if a.get('positional_score')]
        avg_positional = sum(positional_scores) / len(positional_scores) if positional_scores else 50

        # Calculate phase accuracies
        middlegame_accuracies = [a.get('middle_game_accuracy', 0) for a in game_analyses if a.get('middle_game_accuracy')]
        endgame_accuracies = [a.get('endgame_accuracy', 0) for a in game_analyses if a.get('endgame_accuracy')]

        avg_middlegame = sum(middlegame_accuracies) / len(middlegame_accuracies) if middlegame_accuracies else 0
        avg_endgame = sum(endgame_accuracies) / len(endgame_accuracies) if endgame_accuracies else 0

        # Identify weakest phase
        weakest_phase = None
        if avg_middlegame < avg_endgame and avg_middlegame < 70:
            weakest_phase = 'middlegame'
        elif avg_endgame < 70:
            weakest_phase = 'endgame'

        logger.info(f"[LESSON_GENERATOR] Positional analysis: avg_positional={avg_positional:.1f}, avg_middlegame={avg_middlegame:.1f}%, avg_endgame={avg_endgame:.1f}%, weakest_phase={weakest_phase}")

        # Always generate at least one positional lesson if positional score is below 80 or there's a weak phase
        if avg_positional < 80 or weakest_phase:
            priority = 'critical' if avg_positional < 50 else 'important'

            phase_name = weakest_phase or 'positional play'
            phase_accuracy = avg_middlegame if weakest_phase == 'middlegame' else avg_endgame if weakest_phase == 'endgame' else avg_positional

            lesson = {
                'user_id': user_id,
                'platform': platform,
                'lesson_type': 'positional',
                'lesson_title': f'Master {phase_name.title()} Strategy',
                'lesson_description': f'Your {phase_name} accuracy is {phase_accuracy:.1f}%. Learn to play quiet positions and convert advantages.',
                'lesson_content': {
                    'theory': f'Positional chess is about long-term planning, pawn structure, piece placement, and king safety. Focus on improving your {phase_name} understanding.',
                    'common_mistakes': [],
                    'practice_positions': [],
                    'action_items': [
                        f'Study {phase_name} principles',
                        'Review games where you had an advantage but didn\'t convert',
                        'Practice endgame technique' if weakest_phase == 'endgame' else 'Practice quiet middlegame planning',
                    ],
                },
                'priority': priority,
                'estimated_time_minutes': 30,
                'generated_from_games': [],
            }
            lessons.append(lesson)

        return lessons

    async def get_all_lessons(
        self, user_id: str, platform: str, force_regenerate: bool = False, game_analyses: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all lessons for a user, generating if needed.

        Args:
            user_id: User ID (UUID for authenticated users, used for lessons table)
            platform: Platform
            force_regenerate: If True, regenerate lessons even if they exist
            game_analyses: Optional pre-fetched game analyses. If not provided, will fetch using user_id.

        Returns:
            List of lesson dictionaries with progress status
        """
        # Check if lessons already exist
        if not force_regenerate:
            existing_lessons_result = await asyncio.to_thread(
                lambda: self.supabase.table('lessons')
                .select('*')
                .eq('user_id', user_id)
                .eq('platform', platform)
                .execute()
            )

            if existing_lessons_result.data:
                # Get progress for each lesson
                lesson_ids = [l['id'] for l in existing_lessons_result.data]
                progress_result = await asyncio.to_thread(
                    lambda: self.supabase.table('lesson_progress')
                    .select('*')
                    .eq('user_id', user_id)
                    .in_('lesson_id', lesson_ids)
                    .execute()
                )

                progress_map = {p['lesson_id']: p for p in progress_result.data}

                # Add progress status to lessons
                for lesson in existing_lessons_result.data:
                    progress = progress_map.get(lesson['id'])
                    if progress:
                        lesson['status'] = progress['status']
                        lesson['completion_percentage'] = progress['completion_percentage']
                    else:
                        lesson['status'] = 'not_started'
                        lesson['completion_percentage'] = 0

                return existing_lessons_result.data

        # Generate new lessons
        # Use provided game_analyses or fetch them
        if game_analyses is None:
            # Fetch game analyses (note: user_id here should be canonical username for game_analyses table)
            analyses_result = await asyncio.to_thread(
                lambda: self.supabase.table('game_analyses')
                .select('*')
                .eq('user_id', user_id)
                .eq('platform', platform)
                .order('created_at', desc=True)
                .limit(100)  # Analyze last 100 games
                .execute()
            )
            game_analyses = analyses_result.data or []
        else:
            game_analyses = game_analyses or []

        # Generate lessons
        logger.info(f"[LESSON_GENERATOR] Starting lesson generation for user_id={user_id}, platform={platform}, game_analyses_count={len(game_analyses)}")
        all_lessons = []

        opening_lessons = await self.generate_opening_lessons(user_id, platform, game_analyses)
        logger.info(f"[LESSON_GENERATOR] Generated {len(opening_lessons)} opening lessons")
        all_lessons.extend(opening_lessons)

        tactical_lessons = await self.generate_tactical_lessons(user_id, platform, game_analyses)
        logger.info(f"[LESSON_GENERATOR] Generated {len(tactical_lessons)} tactical lessons")
        all_lessons.extend(tactical_lessons)

        positional_lessons = await self.generate_positional_lessons(user_id, platform, game_analyses)
        logger.info(f"[LESSON_GENERATOR] Generated {len(positional_lessons)} positional lessons")
        all_lessons.extend(positional_lessons)

        logger.info(f"[LESSON_GENERATOR] Total lessons generated: {len(all_lessons)}")

        # If no lessons generated, create a general improvement lesson
        if not all_lessons and game_analyses:
            logger.info(f"[LESSON_GENERATOR] No specific lessons generated, creating general improvement lesson")
            general_lesson = {
                'user_id': user_id,
                'platform': platform,
                'lesson_type': 'tactical',
                'lesson_title': 'Continue Your Chess Improvement',
                'lesson_description': f'You have {len(game_analyses)} analyzed games. Review your games to identify patterns and areas for improvement.',
                'lesson_content': {
                    'theory': 'Regular review of your games is key to improvement. Focus on understanding why moves were played and what alternatives existed.',
                    'common_mistakes': [],
                    'practice_positions': [],
                    'action_items': [
                        'Review your recent games and identify recurring patterns',
                        'Focus on one aspect at a time (openings, tactics, or endgames)',
                        'Practice with puzzles to sharpen your tactical vision',
                    ],
                },
                'priority': 'enhancement',
                'estimated_time_minutes': 15,
                'generated_from_games': [a.get('game_id') for a in game_analyses[:5] if a.get('game_id')],
            }
            all_lessons.append(general_lesson)
            logger.info(f"[LESSON_GENERATOR] Created general improvement lesson")

        # Save lessons to database
        saved_count = 0
        for lesson in all_lessons:
            try:
                await asyncio.to_thread(
                    lambda l=lesson: self.supabase.table('lessons')
                    .insert(l)
                    .execute()
                )
                saved_count += 1
            except Exception as e:
                logger.error(f"[LESSON_GENERATOR] Failed to save lesson '{lesson.get('lesson_title', 'Unknown')}': {e}")
                # Continue with other lessons

        logger.info(f"[LESSON_GENERATOR] Saved {saved_count} out of {len(all_lessons)} lessons to database")

        # Return lessons with default status
        for lesson in all_lessons:
            lesson['status'] = 'not_started'
            lesson['completion_percentage'] = 0

        return all_lessons
