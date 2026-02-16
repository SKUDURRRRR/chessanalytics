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

    async def _get_fen_positions_from_game(
        self, game_id: str, user_id: str, platform: str, max_positions: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Extract FEN positions from a game's move analysis where mistakes/blunders occurred.

        Args:
            game_id: Game ID to get positions from
            user_id: Canonical user ID (username)
            platform: Platform
            max_positions: Maximum positions to return

        Returns:
            List of {fen, description, correct_move} dicts
        """
        try:
            result = await asyncio.to_thread(
                lambda: self.supabase.table('move_analyses')
                .select('moves_analysis')
                .eq('user_id', user_id)
                .eq('platform', platform)
                .eq('game_id', game_id)
                .limit(1)
                .execute()
            )

            if not result.data or not result.data[0].get('moves_analysis'):
                return []

            moves = result.data[0]['moves_analysis']
            positions = []

            for move in moves:
                classification = move.get('classification', '')
                fen_before = move.get('fen_before', '')
                best_move = move.get('best_move_san') or move.get('bestMoveSan', '')

                if classification in ('blunder', 'mistake') and fen_before:
                    move_san = move.get('san', move.get('move_san', ''))
                    move_num = move.get('move_number', move.get('moveNumber', '?'))
                    positions.append({
                        'fen': fen_before,
                        'description': f"Move {move_num}: You played {move_san} ({classification})",
                        'correct_move': best_move or None,
                    })

                if len(positions) >= max_positions:
                    break

            return positions
        except Exception as e:
            logger.warning(f"[LESSON_GENERATOR] Failed to get FEN positions for game {game_id}: {e}")
            return []

    async def _enrich_practice_positions(
        self, practice_positions: List[Dict[str, Any]], user_id: str, platform: str
    ) -> List[Dict[str, Any]]:
        """
        Enrich practice positions with actual FEN data from move analyses.

        Args:
            practice_positions: Positions with game_id but possibly no FEN
            user_id: Canonical user ID
            platform: Platform

        Returns:
            Enriched positions with FEN data
        """
        enriched = []
        for pos in practice_positions:
            game_id = pos.get('game_id')
            if game_id and not pos.get('fen'):
                fen_positions = await self._get_fen_positions_from_game(
                    game_id, user_id, platform, max_positions=1
                )
                if fen_positions:
                    enriched.append(fen_positions[0])
                    continue
            if pos.get('fen'):
                enriched.append(pos)
        return enriched

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

                # Build data-driven theory description
                mistake_count = len(opening_mistakes.get(opening, []))
                game_count = stats['games']
                if avg_accuracy < 60:
                    severity_desc = f"Your {opening} accuracy is critically low at {avg_accuracy:.0f}%"
                elif avg_accuracy < 70:
                    severity_desc = f"Your {opening} accuracy needs work at {avg_accuracy:.0f}%"
                else:
                    severity_desc = f"Your {opening} accuracy of {avg_accuracy:.0f}% can be improved"

                theory = (
                    f"{severity_desc} across {game_count} games. "
                    f"You averaged {error_rate:.1f} errors per game in this opening. "
                    f"Focus on the critical positions where your play diverges from best practice."
                )

                # Extract practice positions from actual mistake games
                practice_positions = []
                for mistake_data in opening_mistakes.get(opening, [])[:3]:
                    game_id = mistake_data.get('game_id')
                    if game_id and mistake_data.get('accuracy', 100) < 70:
                        practice_positions.append({
                            'game_id': game_id,
                            'accuracy': mistake_data.get('accuracy', 0),
                            'blunders': mistake_data.get('blunders', 0),
                            'description': f"Game with {mistake_data.get('blunders', 0)} blunders and {mistake_data.get('accuracy', 0):.0f}% accuracy",
                        })

                lesson = {
                    'user_id': user_id,
                    'platform': platform,
                    'lesson_type': 'opening',
                    'lesson_title': f'Master {opening}',
                    'lesson_description': f'Improve your {opening} play. Your current accuracy is {avg_accuracy:.1f}% with {error_rate:.1f} errors per game.',
                    'lesson_content': {
                        'theory': theory,
                        'common_mistakes': opening_mistakes.get(opening, [])[:3],
                        'practice_positions': practice_positions,
                        'action_items': [
                            f'Study {opening} theory and main lines',
                            f'Review your {mistake_count} games with mistakes in this opening',
                            'Practice this opening in your next games and track accuracy improvement',
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
                    'theory': (
                        f"Your tactical score is {avg_tactical:.0f}/100 with {blunders_per_game:.1f} blunders per game. "
                        f"{'This is a critical weakness that costs you many games. ' if avg_tactical < 50 else ''}"
                        f"Focus on pattern recognition: pins, forks, skewers, and discovered attacks. "
                        f"Your worst games had {high_blunder_games[0].get('blunders', 0) if high_blunder_games else 0}+ blunders - "
                        f"review these to identify recurring tactical blind spots."
                    ),
                    'common_mistakes': [
                        {
                            'game_id': g.get('game_id'),
                            'blunders': g.get('blunders', 0),
                            'tactical_score': g.get('tactical_score', 0),
                        }
                        for g in high_blunder_games[:3]
                    ],
                    'practice_positions': [
                        {
                            'game_id': g.get('game_id'),
                            'blunders': g.get('blunders', 0),
                            'description': f"Game with {g.get('blunders', 0)} blunders - tactical score {g.get('tactical_score', 0):.0f}/100",
                        }
                        for g in high_blunder_games[:3] if g.get('game_id')
                    ],
                    'action_items': [
                        f'Solve tactical puzzles daily - focus on positions similar to your {total_blunders} blunders',
                        'Review your blunders and identify the tactical pattern you missed',
                        'Practice calculation: visualize 3-4 moves ahead before making a move',
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
                    'theory': (
                        f"Your {phase_name} accuracy is {phase_accuracy:.0f}%. "
                        f"{'Your middlegame accuracy is ' + f'{avg_middlegame:.0f}%' + ' and endgame accuracy is ' + f'{avg_endgame:.0f}%' + '. ' if avg_middlegame and avg_endgame else ''}"
                        f"Focus on long-term planning, pawn structure evaluation, and piece activity. "
                        f"{'Endgame technique is crucial - practice king activity and pawn promotion patterns.' if weakest_phase == 'endgame' else 'Middlegame planning requires evaluating pawn structures and creating plans around piece placement.'}"
                    ),
                    'common_mistakes': [],
                    'practice_positions': [],
                    'action_items': [
                        f'Study {phase_name} principles and typical pawn structures',
                        'Review games where you had an advantage but didn\'t convert',
                        'Practice endgame technique with K+P vs K positions' if weakest_phase == 'endgame' else 'Practice quiet middlegame planning - identify the best piece placement',
                    ],
                },
                'priority': priority,
                'estimated_time_minutes': 30,
                'generated_from_games': [],
            }
            lessons.append(lesson)

        return lessons

    async def generate_time_management_lessons(
        self, user_id: str, platform: str, game_analyses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Generate time management lessons based on time_management_score and time control performance.

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

        # Calculate average time management score
        tm_scores = [a.get('time_management_score', 0) for a in game_analyses if a.get('time_management_score') is not None]
        avg_tm_score = sum(tm_scores) / len(tm_scores) if tm_scores else 50

        # Group by time control category
        time_control_stats: Dict[str, Dict[str, Any]] = {}
        for analysis in game_analyses:
            tc = analysis.get('time_control', 'unknown')
            # Classify into categories: bullet/blitz/rapid/classical
            if tc in ('bullet', 'blitz', 'rapid', 'classical'):
                tc_cat = tc
            elif tc and any(t in str(tc).lower() for t in ['1+0', '2+1', '1+1']):
                tc_cat = 'bullet'
            elif tc and any(t in str(tc).lower() for t in ['3+0', '3+2', '5+0', '5+3']):
                tc_cat = 'blitz'
            elif tc and any(t in str(tc).lower() for t in ['10+', '15+', '10+0', '15+10']):
                tc_cat = 'rapid'
            else:
                tc_cat = 'other'

            if tc_cat == 'other':
                continue

            if tc_cat not in time_control_stats:
                time_control_stats[tc_cat] = {'games': 0, 'total_accuracy': 0, 'total_tm_score': 0}
            time_control_stats[tc_cat]['games'] += 1
            time_control_stats[tc_cat]['total_accuracy'] += analysis.get('accuracy', 0)
            time_control_stats[tc_cat]['total_tm_score'] += analysis.get('time_management_score', 0)

        logger.info(f"[LESSON_GENERATOR] Time management: avg_score={avg_tm_score:.1f}, time_controls={list(time_control_stats.keys())}")

        # Find significant accuracy drops in faster time controls
        blitz_accuracy = None
        rapid_accuracy = None
        for tc_cat, stats in time_control_stats.items():
            if stats['games'] >= 3:
                avg_acc = stats['total_accuracy'] / stats['games']
                if tc_cat == 'blitz':
                    blitz_accuracy = avg_acc
                elif tc_cat == 'rapid':
                    rapid_accuracy = avg_acc

        # Generate lesson if time management is weak
        if avg_tm_score < 60 or (blitz_accuracy and rapid_accuracy and rapid_accuracy - blitz_accuracy > 10):
            priority = 'critical' if avg_tm_score < 40 else 'important'

            # Build context-specific theory
            theory_parts = [f"Your time management score is {avg_tm_score:.0f}/100."]

            if blitz_accuracy and rapid_accuracy and rapid_accuracy - blitz_accuracy > 10:
                theory_parts.append(
                    f"Your accuracy drops from {rapid_accuracy:.0f}% in rapid to {blitz_accuracy:.0f}% in blitz - "
                    f"a {rapid_accuracy - blitz_accuracy:.0f}% gap. You likely rush decisions under time pressure."
                )

            if avg_tm_score < 40:
                theory_parts.append(
                    "This is a critical weakness. Poor time management leads to unnecessary blunders "
                    "in winning positions. Focus on allocating time to critical moments."
                )

            theory_parts.append(
                "Key principles: spend more time on complex positions with many piece interactions, "
                "play quickly in familiar positions, and always keep a time buffer for the endgame."
            )

            # Find worst time-managed games for practice
            worst_tm_games = sorted(
                [a for a in game_analyses if a.get('time_management_score', 100) < 50],
                key=lambda x: x.get('time_management_score', 100)
            )[:5]

            practice_positions = [
                {
                    'game_id': g.get('game_id'),
                    'accuracy': g.get('accuracy', 0),
                    'blunders': g.get('blunders', 0),
                    'description': f"Time management score: {g.get('time_management_score', 0):.0f}/100, accuracy: {g.get('accuracy', 0):.0f}%",
                }
                for g in worst_tm_games[:3] if g.get('game_id')
            ]

            lesson = {
                'user_id': user_id,
                'platform': platform,
                'lesson_type': 'time_management',
                'lesson_title': 'Master Your Clock',
                'lesson_description': f'Your time management score is {avg_tm_score:.0f}/100. Learn to allocate time effectively.',
                'lesson_content': {
                    'theory': ' '.join(theory_parts),
                    'common_mistakes': [
                        {
                            'game_id': g.get('game_id'),
                            'blunders': g.get('blunders', 0),
                            'accuracy': g.get('accuracy', 0),
                            'tactical_score': g.get('time_management_score', 0),
                        }
                        for g in worst_tm_games[:3]
                    ],
                    'practice_positions': practice_positions,
                    'action_items': [
                        'Before each move, quickly assess: is this position critical or routine?',
                        'Spend more time on moves where many pieces interact or tensions exist',
                        'In time trouble, prefer safe moves over ambitious ones',
                    ],
                },
                'priority': priority,
                'estimated_time_minutes': 20,
                'generated_from_games': [g.get('game_id') for g in worst_tm_games],
            }
            lessons.append(lesson)

        return lessons

    async def generate_style_lessons(
        self, user_id: str, platform: str, game_analyses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Generate playing style lessons based on personality scores.

        Uses the 6 personality traits: tactical, positional, aggressive, patient, novelty, staleness.

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

        # Calculate average personality scores
        score_keys = ['tactical_score', 'positional_score', 'aggressive_score',
                      'patient_score', 'novelty_score', 'staleness_score']
        avg_scores: Dict[str, float] = {}

        for key in score_keys:
            values = [a.get(key, 50) for a in game_analyses if a.get(key) is not None]
            avg_scores[key] = sum(values) / len(values) if values else 50

        logger.info(f"[LESSON_GENERATOR] Style scores: {', '.join(f'{k}={v:.1f}' for k, v in avg_scores.items())}")

        # Define style-based lesson triggers
        style_triggers = []

        # Aggressive but impatient
        if avg_scores.get('aggressive_score', 50) > 70 and avg_scores.get('patient_score', 50) < 40:
            style_triggers.append({
                'title': 'Channel Your Aggression',
                'description': f'Aggressive score: {avg_scores["aggressive_score"]:.0f}, Patient score: {avg_scores["patient_score"]:.0f}. Learn to combine attack with restraint.',
                'theory': (
                    f"Your aggressive score of {avg_scores['aggressive_score']:.0f}/100 shows you love to attack, "
                    f"but your patience score of {avg_scores['patient_score']:.0f}/100 means you sometimes rush into "
                    f"premature attacks. The best attackers know when to build pressure gradually. "
                    f"Study games of Tal and Kasparov - they prepared devastating attacks with quiet moves first."
                ),
                'action_items': [
                    'Before launching an attack, ensure at least 3 of your pieces are participating',
                    'Practice prophylaxis - improve your worst-placed piece before attacking',
                    'In your next 5 games, consciously delay attacks by one move to improve preparation',
                ],
                'priority': 'important',
            })

        # Too passive
        if avg_scores.get('patient_score', 50) > 70 and avg_scores.get('aggressive_score', 50) < 40:
            style_triggers.append({
                'title': 'When Patience Becomes Passivity',
                'description': f'Patient score: {avg_scores["patient_score"]:.0f}, Aggressive score: {avg_scores["aggressive_score"]:.0f}. Learn to seize the initiative.',
                'theory': (
                    f"Your patience score of {avg_scores['patient_score']:.0f}/100 shows great discipline, "
                    f"but your aggressive score of {avg_scores['aggressive_score']:.0f}/100 suggests you may be "
                    f"too passive in critical positions. Chess rewards initiative - sometimes you need to create "
                    f"imbalances and complications. Study Petrosian's prophylactic style to see how defense and "
                    f"counter-attack work together."
                ),
                'action_items': [
                    'Look for tactical opportunities even in quiet positions',
                    'Practice creating pawn breaks to open the position',
                    'When ahead in development, look for ways to open the position immediately',
                ],
                'priority': 'important',
            })

        # Low novelty / stuck in patterns
        if avg_scores.get('novelty_score', 50) < 35:
            style_triggers.append({
                'title': 'Break Out of Your Comfort Zone',
                'description': f'Novelty score: {avg_scores["novelty_score"]:.0f}. You tend to repeat the same patterns.',
                'theory': (
                    f"Your novelty score of {avg_scores['novelty_score']:.0f}/100 means you tend to play the same "
                    f"types of positions and moves repeatedly. While consistency has value, chess improvement "
                    f"requires exploring new ideas. Try different openings, practice unfamiliar pawn structures, "
                    f"and study a variety of game styles."
                ),
                'action_items': [
                    'Play a new opening you\'ve never tried in your next 3 games',
                    'Study games from a player with a very different style than yours',
                    'In each game, make at least one move that surprises you',
                ],
                'priority': 'enhancement',
            })

        # Tactical weakness with positional strength
        if avg_scores.get('tactical_score', 50) < 50 and avg_scores.get('positional_score', 50) > 65:
            style_triggers.append({
                'title': 'Add Tactics to Your Positional Play',
                'description': f'Tactical: {avg_scores["tactical_score"]:.0f}, Positional: {avg_scores["positional_score"]:.0f}. Your strategy needs sharper execution.',
                'theory': (
                    f"Your positional score of {avg_scores['positional_score']:.0f}/100 shows strong strategic "
                    f"understanding, but your tactical score of {avg_scores['tactical_score']:.0f}/100 means you "
                    f"often miss the concrete execution. Great strategy without tactics is like having a plan but "
                    f"not the tools to execute it. Focus on calculation and pattern recognition."
                ),
                'action_items': [
                    'Solve 10 tactical puzzles daily focusing on combinations',
                    'In analyzed games, review positions where you had an advantage but failed to convert',
                    'Practice calculating forced sequences 4-5 moves deep',
                ],
                'priority': 'important',
            })

        # High staleness
        if avg_scores.get('staleness_score', 50) > 65:
            style_triggers.append({
                'title': 'Refresh Your Repertoire',
                'description': f'Staleness score: {avg_scores["staleness_score"]:.0f}. Your play has become predictable.',
                'theory': (
                    f"Your staleness score of {avg_scores['staleness_score']:.0f}/100 indicates your play has "
                    f"become predictable and repetitive. Opponents who study your games will exploit this. "
                    f"Introduce surprise weapons in your opening repertoire and practice different middlegame plans."
                ),
                'action_items': [
                    'Learn one new opening line for both colors this week',
                    'Study a GM who plays a completely different style than you',
                    'Try playing the opposite side of positions you normally play',
                ],
                'priority': 'important',
            })

        # Generate at most 2 style lessons (most relevant)
        for trigger in style_triggers[:2]:
            lesson = {
                'user_id': user_id,
                'platform': platform,
                'lesson_type': 'style',
                'lesson_title': trigger['title'],
                'lesson_description': trigger['description'],
                'lesson_content': {
                    'theory': trigger['theory'],
                    'common_mistakes': [],
                    'practice_positions': [],
                    'action_items': trigger['action_items'],
                },
                'priority': trigger['priority'],
                'estimated_time_minutes': 20,
                'generated_from_games': [],
            }
            lessons.append(lesson)

        return lessons

    async def get_all_lessons(
        self, user_id: str, platform: str, force_regenerate: bool = False,
        game_analyses: Optional[List[Dict[str, Any]]] = None, canonical_user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all lessons for a user, generating if needed.

        Args:
            user_id: User ID (UUID for authenticated users, used for lessons table)
            platform: Platform
            force_regenerate: If True, regenerate lessons even if they exist
            game_analyses: Optional pre-fetched game analyses. If not provided, will fetch using user_id.
            canonical_user_id: Platform username for querying move_analyses/game_analyses tables.
                If not provided, falls back to user_id.

        Returns:
            List of lesson dictionaries with progress status
        """
        # canonical_user_id is the platform username for game data tables
        # user_id is UUID for coaching tables (lessons, lesson_progress)
        query_user_id = canonical_user_id or user_id
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
            # Fetch game analyses using canonical username (game_analyses.user_id is TEXT)
            analyses_result = await asyncio.to_thread(
                lambda: self.supabase.table('game_analyses')
                .select('*')
                .eq('user_id', query_user_id)
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

        time_mgmt_lessons = await self.generate_time_management_lessons(user_id, platform, game_analyses)
        logger.info(f"[LESSON_GENERATOR] Generated {len(time_mgmt_lessons)} time management lessons")
        all_lessons.extend(time_mgmt_lessons)

        style_lessons = await self.generate_style_lessons(user_id, platform, game_analyses)
        logger.info(f"[LESSON_GENERATOR] Generated {len(style_lessons)} style lessons")
        all_lessons.extend(style_lessons)

        logger.info(f"[LESSON_GENERATOR] Total lessons generated: {len(all_lessons)}")

        if not all_lessons:
            logger.info(f"[LESSON_GENERATOR] No lessons generated - user has no specific weaknesses to address")

        # Enrich practice positions with actual FEN data from move analyses
        for lesson in all_lessons:
            positions = lesson.get('lesson_content', {}).get('practice_positions', [])
            if positions:
                enriched = await self._enrich_practice_positions(positions, query_user_id, platform)
                lesson['lesson_content']['practice_positions'] = enriched

        # Save lessons to database (upsert to prevent duplicates)
        saved_count = 0
        for lesson in all_lessons:
            try:
                await asyncio.to_thread(
                    lambda l=lesson: self.supabase.table('lessons')
                    .upsert(l, on_conflict='user_id,platform,lesson_type,lesson_title')
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
