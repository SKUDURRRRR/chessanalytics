"""
Study Plan Generator
Creates weekly structured training plans based on user weaknesses and progress.
Generates specific, actionable daily activities linked to real content
(puzzles by theme, lessons by category, opening drills, game reviews).
"""

import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta, date
from typing import Dict, List, Optional, Any, Tuple
import json

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rating-band configurations
# ---------------------------------------------------------------------------
RATING_BANDS = {
    'beginner': {
        'max_rating': 1000,
        'focus': ['blunders', 'basic_tactics', 'simple_openings'],
        'puzzle_themes': ['mateIn1', 'hangingPiece', 'fork', 'pin'],
        'daily_puzzles': 3,
        'weekly_puzzle_target': 15,
        'lesson_focus': ['tactical', 'opening'],
        'description': 'Focus on reducing blunders and basic pattern recognition',
    },
    'intermediate': {
        'max_rating': 1500,
        'focus': ['tactics', 'opening_repertoire', 'endgame_basics'],
        'puzzle_themes': ['fork', 'pin', 'skewer', 'discoveredAttack', 'sacrifice'],
        'daily_puzzles': 5,
        'weekly_puzzle_target': 20,
        'lesson_focus': ['tactical', 'positional', 'opening'],
        'description': 'Build tactical sharpness and opening knowledge',
    },
    'advanced': {
        'max_rating': 2000,
        'focus': ['positional_play', 'complex_tactics', 'opening_prep', 'endgames'],
        'puzzle_themes': ['sacrifice', 'deflection', 'discoveredAttack', 'crushing', 'advantage'],
        'daily_puzzles': 5,
        'weekly_puzzle_target': 25,
        'lesson_focus': ['positional', 'tactical', 'opening'],
        'description': 'Deepen positional understanding and calculation',
    },
    'expert': {
        'max_rating': 9999,
        'focus': ['deep_theory', 'strategic_planning', 'endgame_technique'],
        'puzzle_themes': ['crushing', 'advantage', 'sacrifice', 'deflection', 'endgame'],
        'daily_puzzles': 5,
        'weekly_puzzle_target': 25,
        'lesson_focus': ['positional', 'opening'],
        'description': 'Refine strategic depth and endgame precision',
    },
}

# Time estimates per activity type (minutes)
TIME_ESTIMATES: Dict[str, int] = {
    'puzzle': 5,
    'lesson': 10,
    'review': 10,
    'opening': 10,
    'play': 15,
}


class StudyPlanGenerator:
    """Generates and manages weekly study plans for chess improvement."""

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    # ========================================================================
    # PUBLIC API
    # ========================================================================

    async def generate_weekly_plan(
        self,
        user_id: str,
        platform: str,
        canonical_user_id: str
    ) -> Dict[str, Any]:
        """
        Generate a new weekly study plan based on user weaknesses.

        Args:
            user_id: Auth UUID
            platform: 'lichess' or 'chess.com'
            canonical_user_id: Platform username for querying game data

        Returns:
            The created study plan dict
        """
        try:
            # 1. Fetch game analyses
            analyses_result = await asyncio.to_thread(
                lambda: self.supabase.table('game_analyses')
                .select('tactical_score,positional_score,opening_accuracy,'
                        'middle_game_accuracy,endgame_accuracy,blunders,mistakes,'
                        'tactical_patterns,created_at,played_at,game_id')
                .eq('user_id', canonical_user_id)
                .eq('platform', platform)
                .order('analyzed_at', desc=True)
                .limit(100)
                .execute()
            )
            game_analyses = analyses_result.data or []

            # 2. Fetch games for opening/result data
            games_result = await asyncio.to_thread(
                lambda: self.supabase.table('games')
                .select('game_id,opening_family,color,result,rating,played_at')
                .eq('user_id', canonical_user_id)
                .eq('platform', platform)
                .order('played_at', desc=True)
                .limit(100)
                .execute()
            )
            games_data = games_result.data or []

            # 3. Analyze weaknesses from game data
            weakness_profile = self._analyze_game_weaknesses(game_analyses, games_data)

            # 4. Get rating band config
            rating_config = self._get_rating_config(weakness_profile.get('avg_rating', 1200))

            # 5. Get weakness evolution for snapshot
            from .progress_analyzer import ProgressAnalyzer
            progress = ProgressAnalyzer(self.supabase)
            weakness_data = await progress.get_weakness_evolution(
                user_id, platform, game_analyses, weeks=4
            )

            # 6. Build weakness snapshot (current scores)
            weakness_snapshot = {}
            if weakness_data:
                weakness_snapshot = weakness_data[-1].get('scores', {})

            # 7. Compute weekly summary (comparing with previous plan)
            weekly_summary = await self._compute_weekly_summary(
                user_id, platform, weakness_snapshot
            )

            # 8. Create smart goals
            goals = self._create_goals(weakness_profile, rating_config)

            # 9. Generate smart daily activities
            daily_activities = self._generate_daily_activities(
                weakness_profile, rating_config, goals
            )

            # 10. Calculate week start (Monday)
            today = date.today()
            week_start = today - timedelta(days=today.weekday())

            # 11. Mark any existing active plan as completed
            await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .update({'status': 'completed'})
                .eq('user_id', user_id)
                .eq('platform', platform)
                .eq('status', 'active')
                .execute()
            )

            # 12. Get week number
            count_result = await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .select('id', count='exact', head=True)
                .eq('user_id', user_id)
                .eq('platform', platform)
                .execute()
            )
            week_number = (count_result.count or 0) + 1

            # 13. Save study plan
            plan_data = {
                'user_id': user_id,
                'platform': platform,
                'week_start': week_start.isoformat(),
                'week_number': week_number,
                'goals': json.dumps(goals),
                'daily_activities': json.dumps(daily_activities),
                'weakness_snapshot': json.dumps(weakness_snapshot),
                'weekly_summary': json.dumps(weekly_summary),
                'days_completed': 0,
                'status': 'active',
            }

            try:
                result = await asyncio.to_thread(
                    lambda: self.supabase.table('study_plans')
                    .upsert(plan_data, on_conflict='user_id,platform,week_start')
                    .execute()
                )
            except Exception as upsert_err:
                # Fallback: if new columns don't exist yet, try without them
                logger.warning(f"[STUDY_PLAN] Upsert with new columns failed, retrying without: {upsert_err}")
                plan_data.pop('weakness_snapshot', None)
                plan_data.pop('weekly_summary', None)
                plan_data.pop('days_completed', None)
                result = await asyncio.to_thread(
                    lambda: self.supabase.table('study_plans')
                    .upsert(plan_data, on_conflict='user_id,platform,week_start')
                    .execute()
                )

            plan = result.data[0] if result.data else plan_data

            # 14. Create user_goals records
            for goal in goals:
                goal_data = {
                    'user_id': user_id,
                    'platform': platform,
                    'study_plan_id': plan.get('id'),
                    'goal_type': goal['type'],
                    'goal_description': goal['description'],
                    'target_value': goal['target'],
                    'current_value': 0,
                    'status': 'in_progress',
                }
                await asyncio.to_thread(
                    lambda gd=goal_data: self.supabase.table('user_goals')
                    .insert(gd)
                    .execute()
                )

            # Parse JSONB fields for response
            plan['goals'] = goals
            plan['daily_activities'] = daily_activities
            plan['weakness_snapshot'] = weakness_snapshot
            plan['weekly_summary'] = weekly_summary

            logger.info(f"[STUDY_PLAN] Generated week {week_number} plan for {canonical_user_id}")
            return plan

        except Exception as e:
            logger.error(f"[STUDY_PLAN] Error generating plan: {e}", exc_info=True)
            raise

    async def get_current_plan(
        self,
        user_id: str,
        platform: str
    ) -> Optional[Dict[str, Any]]:
        """Get the active study plan for a user."""
        try:
            result = await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .select('*')
                .eq('user_id', user_id)
                .eq('platform', platform)
                .eq('status', 'active')
                .order('created_at', desc=True)
                .limit(1)
                .execute()
            )

            if not result.data:
                return None

            plan = result.data[0]

            # Parse JSONB fields
            for field in ('goals', 'daily_activities', 'weakness_snapshot', 'weekly_summary'):
                if isinstance(plan.get(field), str):
                    try:
                        plan[field] = json.loads(plan[field])
                    except (json.JSONDecodeError, TypeError):
                        pass

            # Fetch linked goals
            goals_result = await asyncio.to_thread(
                lambda: self.supabase.table('user_goals')
                .select('*')
                .eq('study_plan_id', plan['id'])
                .execute()
            )
            plan['user_goals'] = goals_result.data or []

            return plan

        except Exception as e:
            logger.error(f"[STUDY_PLAN] Error getting current plan: {e}", exc_info=True)
            return None

    async def complete_daily_activity(
        self,
        user_id: str,
        plan_id: str,
        day: int,
        activity_index: int
    ) -> Dict[str, Any]:
        """
        Mark a daily activity as completed and update goal progress.

        Args:
            user_id: Auth UUID
            plan_id: Study plan UUID
            day: Day number (0-6, Monday=0)
            activity_index: Index of activity within the day
        """
        try:
            # Get plan
            result = await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .select('*')
                .eq('id', plan_id)
                .eq('user_id', user_id)
                .execute()
            )

            if not result.data:
                raise ValueError("Plan not found")

            plan = result.data[0]
            daily_activities = plan.get('daily_activities', {})
            if isinstance(daily_activities, str):
                daily_activities = json.loads(daily_activities)

            day_key = str(day)
            if day_key not in daily_activities:
                raise ValueError(f"No activities for day {day}")
            if activity_index >= len(daily_activities[day_key]):
                raise ValueError(f"Activity index {activity_index} out of range")

            # Mark activity completed
            daily_activities[day_key][activity_index]['completed'] = True

            # Count days where ALL activities are completed
            days_completed = 0
            for dk, acts in daily_activities.items():
                if acts and all(a.get('completed', False) for a in acts):
                    days_completed += 1

            # Update plan
            await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .update({
                    'daily_activities': json.dumps(daily_activities),
                    'days_completed': days_completed,
                })
                .eq('id', plan_id)
                .execute()
            )

            # Update goal progress via RPC
            activity = daily_activities[day_key][activity_index]
            goal_type = activity.get('goal_type')
            if goal_type:
                try:
                    await asyncio.to_thread(
                        lambda: self.supabase.rpc('increment_goal_progress', {
                            'p_user_id': user_id,
                            'p_plan_id': plan_id,
                            'p_goal_type': goal_type,
                        }).execute()
                    )
                except Exception as rpc_err:
                    logger.warning(f"[STUDY_PLAN] RPC increment failed: {rpc_err}")

            # Parse fields for response
            plan['daily_activities'] = daily_activities
            plan['days_completed'] = days_completed
            for field in ('goals', 'weakness_snapshot', 'weekly_summary'):
                if isinstance(plan.get(field), str):
                    try:
                        plan[field] = json.loads(plan[field])
                    except (json.JSONDecodeError, TypeError):
                        pass

            return plan

        except Exception as e:
            logger.error(f"[STUDY_PLAN] Error completing activity: {e}", exc_info=True)
            raise

    async def get_goals(
        self,
        user_id: str,
        platform: str
    ) -> List[Dict[str, Any]]:
        """Get all goals for a user."""
        try:
            result = await asyncio.to_thread(
                lambda: self.supabase.table('user_goals')
                .select('*')
                .eq('user_id', user_id)
                .eq('platform', platform)
                .order('created_at', desc=True)
                .limit(20)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"[STUDY_PLAN] Error getting goals: {e}", exc_info=True)
            return []

    # ========================================================================
    # TIER 2: SMART WEAKNESS ANALYSIS
    # ========================================================================

    def _analyze_game_weaknesses(
        self,
        game_analyses: List[Dict[str, Any]],
        games_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze specific weaknesses from game data.

        Returns a rich weakness profile with tactical themes, openings,
        phase weaknesses, blunder rate, and average rating.
        """
        profile: Dict[str, Any] = {
            'missed_tactical_themes': [],
            'weakest_openings': [],
            'weakest_phase': 'middlegame',
            'phase_scores': {},
            'blunder_rate': 0.0,
            'avg_rating': 1200,
            'total_games': len(game_analyses),
        }

        if not game_analyses:
            return profile

        # --- Tactical themes missed ---
        theme_counts: Dict[str, int] = defaultdict(int)
        for a in game_analyses:
            patterns = a.get('tactical_patterns') or []
            if isinstance(patterns, list):
                for p in patterns:
                    if isinstance(p, dict):
                        ptype = p.get('type') or p.get('pattern_type', '')
                        if ptype:
                            theme_counts[ptype] += 1
            elif isinstance(patterns, str):
                try:
                    parsed = json.loads(patterns)
                    for p in parsed:
                        if isinstance(p, dict):
                            ptype = p.get('type') or p.get('pattern_type', '')
                            if ptype:
                                theme_counts[ptype] += 1
                except (json.JSONDecodeError, TypeError):
                    pass

        profile['missed_tactical_themes'] = sorted(
            theme_counts.items(), key=lambda x: x[1], reverse=True
        )[:5]

        # --- Phase accuracy scores ---
        phase_totals: Dict[str, List[float]] = defaultdict(list)
        total_blunders = 0
        for a in game_analyses:
            for phase_key, field in [
                ('opening', 'opening_accuracy'),
                ('middlegame', 'middle_game_accuracy'),
                ('endgame', 'endgame_accuracy'),
                ('tactical', 'tactical_score'),
                ('positional', 'positional_score'),
            ]:
                val = a.get(field)
                if val is not None:
                    try:
                        phase_totals[phase_key].append(float(val))
                    except (ValueError, TypeError):
                        pass
            total_blunders += (a.get('blunders') or 0)

        phase_scores = {}
        for phase, values in phase_totals.items():
            if values:
                phase_scores[phase] = round(sum(values) / len(values), 1)

        profile['phase_scores'] = phase_scores

        # Find weakest phase
        if phase_scores:
            profile['weakest_phase'] = min(phase_scores, key=phase_scores.get)

        # Blunder rate
        if game_analyses:
            profile['blunder_rate'] = round(total_blunders / len(game_analyses), 2)

        # --- Opening analysis ---
        games_lookup = {g['game_id']: g for g in games_data if g.get('game_id')}
        opening_stats: Dict[Tuple[str, str], Dict[str, Any]] = defaultdict(
            lambda: {'wins': 0, 'losses': 0, 'draws': 0, 'games': 0, 'accuracies': []}
        )

        for a in game_analyses:
            game = games_lookup.get(a.get('game_id', ''))
            if not game:
                continue
            opening = game.get('opening_family') or 'Unknown'
            color = game.get('color') or 'white'
            result = game.get('result', '')
            key = (opening, color)

            opening_stats[key]['games'] += 1
            if result == 'win':
                opening_stats[key]['wins'] += 1
            elif result == 'loss':
                opening_stats[key]['losses'] += 1
            else:
                opening_stats[key]['draws'] += 1

            acc = a.get('opening_accuracy')
            if acc is not None:
                try:
                    opening_stats[key]['accuracies'].append(float(acc))
                except (ValueError, TypeError):
                    pass

        weakest_openings = []
        for (opening, color), stats in opening_stats.items():
            if stats['games'] < 3:
                continue
            total = stats['games']
            win_rate = round(stats['wins'] / total, 2) if total > 0 else 0
            avg_acc = round(sum(stats['accuracies']) / len(stats['accuracies']), 1) if stats['accuracies'] else 50
            weakest_openings.append({
                'name': opening,
                'color': color,
                'win_rate': win_rate,
                'avg_accuracy': avg_acc,
                'games': total,
            })

        # Sort by win rate ascending (worst first)
        weakest_openings.sort(key=lambda x: x['win_rate'])
        profile['weakest_openings'] = weakest_openings[:3]

        # --- Average rating ---
        ratings = [g.get('rating') for g in games_data if g.get('rating')]
        if ratings:
            try:
                profile['avg_rating'] = round(sum(float(r) for r in ratings) / len(ratings))
            except (ValueError, TypeError):
                pass

        return profile

    def _get_rating_config(self, avg_rating: int) -> Dict[str, Any]:
        """Get the rating band config for the player's level."""
        for band_name, config in RATING_BANDS.items():
            if avg_rating < config['max_rating']:
                return {**config, 'band': band_name}
        return {**RATING_BANDS['expert'], 'band': 'expert'}

    # ========================================================================
    # TIER 2: SMART GOAL CREATION
    # ========================================================================

    def _create_goals(
        self,
        weakness_profile: Dict[str, Any],
        rating_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Create 2-3 specific goals from the weakness profile."""
        goals = []
        phase_scores = weakness_profile.get('phase_scores', {})
        missed_themes = weakness_profile.get('missed_tactical_themes', [])
        weakest_openings = weakness_profile.get('weakest_openings', [])
        blunder_rate = weakness_profile.get('blunder_rate', 0)
        weekly_target = rating_config.get('weekly_puzzle_target', 20)

        # Goal 1: Tactical puzzles (always include, tailored to themes)
        if missed_themes:
            top_theme = missed_themes[0][0]
            top_count = missed_themes[0][1]
            goals.append({
                'type': 'puzzles',
                'description': f'Practice {top_theme} puzzles — you missed {top_count} recently',
                'target': weekly_target,
                'theme': top_theme,
            })
        else:
            default_themes = rating_config.get('puzzle_themes', ['fork', 'pin'])
            goals.append({
                'type': 'puzzles',
                'description': f'Solve {weekly_target} tactical puzzles ({", ".join(default_themes[:2])})',
                'target': weekly_target,
                'theme': default_themes[0] if default_themes else 'fork',
            })

        # Goal 2: Opening or blunder reduction (pick the more impactful)
        if blunder_rate >= 2.0 and rating_config.get('band') in ('beginner', 'intermediate'):
            goals.append({
                'type': 'review',
                'description': f'Review 5 games to reduce blunders ({blunder_rate:.1f}/game average)',
                'target': 5,
            })
        elif weakest_openings:
            worst = weakest_openings[0]
            goals.append({
                'type': 'openings',
                'description': f'Drill {worst["name"]} as {worst["color"]} ({int(worst["win_rate"] * 100)}% win rate)',
                'target': 5,
                'opening': worst['name'],
                'color': worst['color'],
            })
        else:
            goals.append({
                'type': 'lessons',
                'description': 'Complete 3 lessons on your weakest area',
                'target': 3,
            })

        # Goal 3: Phase improvement (if data available)
        weakest_phase = weakness_profile.get('weakest_phase', '')
        phase_score = phase_scores.get(weakest_phase)
        if phase_score is not None and phase_score < 70:
            phase_labels = {
                'opening': 'opening preparation',
                'middlegame': 'middlegame strategy',
                'endgame': 'endgame technique',
                'tactical': 'tactical calculation',
                'positional': 'positional understanding',
            }
            label = phase_labels.get(weakest_phase, weakest_phase)
            goals.append({
                'type': 'lessons',
                'description': f'Study {label} (accuracy: {phase_score:.0f}%)',
                'target': 3,
                'category': weakest_phase,
            })

        # Ensure at least 2 goals
        if len(goals) < 2:
            goals.append({
                'type': 'lessons',
                'description': 'Complete chess lessons to broaden your knowledge',
                'target': 3,
            })

        return goals[:3]

    # ========================================================================
    # TIER 2+3: SMART DAILY ACTIVITIES
    # ========================================================================

    def _generate_daily_activities(
        self,
        weakness_profile: Dict[str, Any],
        rating_config: Dict[str, Any],
        goals: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Generate 7 days of specific, linked activities.
        Activities vary by day and link to real content pages.
        """
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        activities: Dict[str, List[Dict[str, Any]]] = {}

        # Build activity templates from goals and weakness data
        templates = self._build_activity_templates(weakness_profile, rating_config, goals)

        for day_idx in range(7):
            day_key = str(day_idx)
            day_activities = []

            # Weekdays: 2 activities, weekends: 3
            num_activities = 3 if day_idx >= 5 else 2

            for i in range(num_activities):
                # Rotate through templates so activities vary day-to-day
                template_idx = (day_idx * num_activities + i) % len(templates)
                template = templates[template_idx]

                day_activities.append({
                    'type': template['type'],
                    'label': template['label'],
                    'description': template.get('description', ''),
                    'route': template['route'],
                    'target_id': template.get('target_id', ''),
                    'goal_type': template.get('goal_type', ''),
                    'time_estimate': template.get('time_estimate', 5),
                    'completed': False,
                    'day_name': day_names[day_idx],
                })

            activities[day_key] = day_activities

        return activities

    def _build_activity_templates(
        self,
        weakness_profile: Dict[str, Any],
        rating_config: Dict[str, Any],
        goals: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Build a diverse pool of activity templates from goals and weakness data."""
        templates = []
        missed_themes = weakness_profile.get('missed_tactical_themes', [])
        weakest_openings = weakness_profile.get('weakest_openings', [])
        phase_scores = weakness_profile.get('phase_scores', {})
        daily_puzzles = rating_config.get('daily_puzzles', 5)
        puzzle_themes = rating_config.get('puzzle_themes', ['fork', 'pin'])

        # --- Puzzle activities (at least 2 templates with different themes) ---
        themes_to_use = []
        for theme, _count in missed_themes[:3]:
            themes_to_use.append(theme)
        # Pad with defaults from rating band
        for t in puzzle_themes:
            if t not in themes_to_use:
                themes_to_use.append(t)
            if len(themes_to_use) >= 3:
                break

        for i, theme in enumerate(themes_to_use[:3]):
            label = f'{theme.replace("mateIn1", "Mate in 1").replace("mateIn2", "Mate in 2").replace("hangingPiece", "Hanging piece")} puzzles ({daily_puzzles})'
            # Capitalize first letter
            label = label[0].upper() + label[1:]
            templates.append({
                'type': 'puzzle',
                'label': label,
                'description': f'Solve {daily_puzzles} puzzles focused on {theme} patterns',
                'route': '/coach/puzzles/solve',
                'target_id': theme,
                'goal_type': 'puzzles',
                'time_estimate': TIME_ESTIMATES['puzzle'],
            })

        # --- Opening drill activities ---
        if weakest_openings:
            for opening in weakest_openings[:2]:
                wr_pct = int(opening['win_rate'] * 100)
                templates.append({
                    'type': 'opening',
                    'label': f'Drill {opening["name"]} ({opening["color"]})',
                    'description': f'{wr_pct}% win rate in {opening["games"]} games — practice key positions',
                    'route': '/coach/openings',
                    'target_id': opening['name'],
                    'goal_type': 'openings',
                    'time_estimate': TIME_ESTIMATES['opening'],
                })

        # --- Lesson activities ---
        lesson_categories = rating_config.get('lesson_focus', ['tactical'])
        weakest_phase = weakness_profile.get('weakest_phase', 'tactical')

        # Prioritize weakest phase lesson
        phase_label_map = {
            'opening': 'Opening',
            'middlegame': 'Middlegame',
            'endgame': 'Endgame',
            'tactical': 'Tactical',
            'positional': 'Positional',
        }

        # Add lesson for weakest phase
        phase_score = phase_scores.get(weakest_phase, 50)
        templates.append({
            'type': 'lesson',
            'label': f'{phase_label_map.get(weakest_phase, weakest_phase)} lesson',
            'description': f'Your {weakest_phase} accuracy is {phase_score:.0f}% — study to improve',
            'route': '/coach/lessons',
            'target_id': weakest_phase if weakest_phase in ('opening', 'tactical', 'positional') else 'positional',
            'goal_type': 'lessons',
            'time_estimate': TIME_ESTIMATES['lesson'],
        })

        # Add lesson for another focus area
        for cat in lesson_categories:
            if cat != weakest_phase:
                templates.append({
                    'type': 'lesson',
                    'label': f'{phase_label_map.get(cat, cat)} lesson',
                    'description': f'Broaden your {cat} understanding',
                    'route': '/coach/lessons',
                    'target_id': cat,
                    'goal_type': 'lessons',
                    'time_estimate': TIME_ESTIMATES['lesson'],
                })
                break

        # --- Game review activity ---
        blunder_rate = weakness_profile.get('blunder_rate', 0)
        if blunder_rate >= 1.5:
            templates.append({
                'type': 'review',
                'label': 'Review a recent game with blunders',
                'description': f'You average {blunder_rate:.1f} blunders/game — find the patterns',
                'route': '/coach/progress',
                'target_id': '',
                'goal_type': 'review',
                'time_estimate': TIME_ESTIMATES['review'],
            })
        else:
            templates.append({
                'type': 'review',
                'label': 'Review your latest game',
                'description': 'Analyze key moments and learn from mistakes',
                'route': '/coach/progress',
                'target_id': '',
                'goal_type': 'review',
                'time_estimate': TIME_ESTIMATES['review'],
            })

        # --- Play activity (weekends) ---
        templates.append({
            'type': 'play',
            'label': 'Play a rated game',
            'description': 'Apply what you\'ve learned in a real game',
            'route': '/coach/play',
            'target_id': '',
            'goal_type': 'games',
            'time_estimate': TIME_ESTIMATES['play'],
        })

        # Ensure we have at least 5 templates for good daily variety
        while len(templates) < 5:
            templates.append({
                'type': 'puzzle',
                'label': f'Tactical puzzles ({daily_puzzles})',
                'description': 'Practice pattern recognition',
                'route': '/coach/puzzles/solve',
                'target_id': puzzle_themes[0] if puzzle_themes else 'fork',
                'goal_type': 'puzzles',
                'time_estimate': TIME_ESTIMATES['puzzle'],
            })

        return templates

    # ========================================================================
    # TIER 3: WEEKLY SUMMARY & STREAK
    # ========================================================================

    async def _compute_weekly_summary(
        self,
        user_id: str,
        platform: str,
        current_snapshot: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compute a weekly summary by comparing current scores to the previous plan's snapshot.
        """
        summary: Dict[str, Any] = {
            'improved_areas': [],
            'declined_areas': [],
            'activities_completed': 0,
            'activities_total': 0,
            'completion_rate': 0,
            'plan_streak': 0,
            'focus_next_week': '',
        }

        try:
            # Get the most recent completed plan
            prev_result = await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .select('weakness_snapshot,daily_activities,days_completed,status')
                .eq('user_id', user_id)
                .eq('platform', platform)
                .eq('status', 'completed')
                .order('created_at', desc=True)
                .limit(1)
                .execute()
            )

            if prev_result.data:
                prev_plan = prev_result.data[0]

                # Parse previous snapshot
                prev_snapshot = prev_plan.get('weakness_snapshot', {})
                if isinstance(prev_snapshot, str):
                    try:
                        prev_snapshot = json.loads(prev_snapshot)
                    except (json.JSONDecodeError, TypeError):
                        prev_snapshot = {}

                # Compare scores
                for area, current_score in current_snapshot.items():
                    prev_score = prev_snapshot.get(area)
                    if prev_score is not None:
                        try:
                            change = round(float(current_score) - float(prev_score), 1)
                            entry = {'area': area, 'change': change}
                            if change > 1:
                                summary['improved_areas'].append(entry)
                            elif change < -1:
                                summary['declined_areas'].append(entry)
                        except (ValueError, TypeError):
                            pass

                # Count completion from previous plan
                prev_activities = prev_plan.get('daily_activities', {})
                if isinstance(prev_activities, str):
                    try:
                        prev_activities = json.loads(prev_activities)
                    except (json.JSONDecodeError, TypeError):
                        prev_activities = {}

                total = 0
                completed = 0
                for day_acts in prev_activities.values():
                    if isinstance(day_acts, list):
                        total += len(day_acts)
                        completed += sum(1 for a in day_acts if a.get('completed'))

                summary['activities_completed'] = completed
                summary['activities_total'] = total
                summary['completion_rate'] = round(completed / total, 2) if total > 0 else 0

            # Calculate plan streak (consecutive completed plans with >50% completion)
            streak_result = await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .select('daily_activities,status')
                .eq('user_id', user_id)
                .eq('platform', platform)
                .eq('status', 'completed')
                .order('created_at', desc=True)
                .limit(10)
                .execute()
            )

            streak = 0
            for sp in (streak_result.data or []):
                acts = sp.get('daily_activities', {})
                if isinstance(acts, str):
                    try:
                        acts = json.loads(acts)
                    except (json.JSONDecodeError, TypeError):
                        acts = {}
                t = sum(len(da) for da in acts.values() if isinstance(da, list))
                c = sum(
                    sum(1 for a in da if a.get('completed'))
                    for da in acts.values() if isinstance(da, list)
                )
                if t > 0 and (c / t) >= 0.5:
                    streak += 1
                else:
                    break

            summary['plan_streak'] = streak

            # Determine next week's focus
            if summary['declined_areas']:
                # Sort by most declined
                worst = min(summary['declined_areas'], key=lambda x: x['change'])
                summary['focus_next_week'] = worst['area']
            elif current_snapshot:
                # Focus on lowest scoring area
                lowest = min(current_snapshot.items(), key=lambda x: x[1])
                summary['focus_next_week'] = lowest[0]

        except Exception as e:
            logger.warning(f"[STUDY_PLAN] Error computing weekly summary: {e}")

        return summary
