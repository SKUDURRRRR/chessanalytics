"""
Study Plan Generator
Creates weekly structured training plans based on user weaknesses and progress.
Generates daily activities (lessons, puzzles, game reviews) and tracks goals.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Dict, List, Optional, Any
import json

logger = logging.getLogger(__name__)


class StudyPlanGenerator:
    """Generates and manages weekly study plans for chess improvement."""

    def __init__(self, supabase_client):
        self.supabase = supabase_client

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
            # 1. Get weakness data from progress analyzer
            from .progress_analyzer import ProgressAnalyzer
            progress = ProgressAnalyzer(self.supabase)

            # Fetch game analyses for weakness assessment
            analyses_result = await asyncio.to_thread(
                lambda: self.supabase.table('game_analyses')
                .select('*')
                .eq('user_id', canonical_user_id)
                .eq('platform', platform)
                .order('analyzed_at', desc=True)
                .limit(100)
                .execute()
            )
            game_analyses = analyses_result.data or []

            weakness_data = await progress.get_weakness_evolution(
                user_id, platform, game_analyses, weeks=4
            )

            # 2. Identify top weaknesses to target
            top_weaknesses = self._identify_top_weaknesses(weakness_data)

            # 3. Create 2-3 goals targeting weaknesses
            goals = self._create_goals(top_weaknesses)

            # 4. Generate 7 days of activities
            daily_activities = self._generate_daily_activities(top_weaknesses, goals)

            # 5. Calculate week start (Monday)
            today = date.today()
            week_start = today - timedelta(days=today.weekday())

            # 6. Mark any existing active plan as completed
            await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .update({'status': 'completed'})
                .eq('user_id', user_id)
                .eq('platform', platform)
                .eq('status', 'active')
                .execute()
            )

            # 7. Get week number (count of existing plans + 1)
            count_result = await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .select('id', count='exact', head=True)
                .eq('user_id', user_id)
                .eq('platform', platform)
                .execute()
            )
            week_number = (count_result.count or 0) + 1

            # 8. Save study plan
            plan_data = {
                'user_id': user_id,
                'platform': platform,
                'week_start': week_start.isoformat(),
                'week_number': week_number,
                'goals': json.dumps(goals),
                'daily_activities': json.dumps(daily_activities),
                'status': 'active',
            }

            result = await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .upsert(plan_data, on_conflict='user_id,platform,week_start')
                .execute()
            )

            plan = result.data[0] if result.data else plan_data

            # 9. Create user_goals records
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
            if isinstance(plan.get('goals'), str):
                plan['goals'] = json.loads(plan['goals'])
            if isinstance(plan.get('daily_activities'), str):
                plan['daily_activities'] = json.loads(plan['daily_activities'])

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
        Mark a daily activity as completed.

        Args:
            user_id: Auth UUID
            plan_id: Study plan UUID
            day: Day number (0-6, Monday=0)
            activity_index: Index of activity within the day

        Returns:
            Updated plan
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
            if day_key in daily_activities and activity_index < len(daily_activities[day_key]):
                daily_activities[day_key][activity_index]['completed'] = True

            # Update plan
            await asyncio.to_thread(
                lambda: self.supabase.table('study_plans')
                .update({'daily_activities': json.dumps(daily_activities)})
                .eq('id', plan_id)
                .execute()
            )

            # Update goal progress
            activity = daily_activities.get(day_key, [{}])[activity_index] if day_key in daily_activities else {}
            goal_type = activity.get('goal_type')
            if goal_type:
                await asyncio.to_thread(
                    lambda: self.supabase.rpc('increment_goal_progress', {
                        'p_user_id': user_id,
                        'p_plan_id': plan_id,
                        'p_goal_type': goal_type,
                    }).execute()
                )

            plan['daily_activities'] = daily_activities
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

    def _identify_top_weaknesses(
        self,
        weakness_data: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Identify the top 3 weaknesses from evolution data."""
        if not weakness_data:
            return [
                {'area': 'tactics', 'score': 50, 'priority': 'important'},
                {'area': 'openings', 'score': 50, 'priority': 'important'},
                {'area': 'endgame', 'score': 50, 'priority': 'enhancement'},
            ]

        # Use the latest week's scores
        latest = weakness_data[-1].get('scores', {})

        # Sort by score (lower = weaker)
        sorted_weaknesses = sorted(latest.items(), key=lambda x: x[1])

        result = []
        for i, (area, score) in enumerate(sorted_weaknesses[:3]):
            priority = 'critical' if i == 0 else 'important' if i == 1 else 'enhancement'
            result.append({
                'area': area,
                'score': score,
                'priority': priority,
            })

        return result if result else [
            {'area': 'tactics', 'score': 50, 'priority': 'important'},
        ]

    def _create_goals(
        self,
        weaknesses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Create 2-3 goals from weaknesses."""
        goal_templates = {
            'tactics': {
                'type': 'puzzles',
                'description': 'Solve 20 tactical puzzles this week',
                'target': 20,
            },
            'tactical': {
                'type': 'puzzles',
                'description': 'Solve 20 tactical puzzles this week',
                'target': 20,
            },
            'openings': {
                'type': 'lessons',
                'description': 'Complete 3 opening lessons this week',
                'target': 3,
            },
            'opening': {
                'type': 'lessons',
                'description': 'Complete 3 opening lessons this week',
                'target': 3,
            },
            'endgame': {
                'type': 'lessons',
                'description': 'Study 2 endgame lessons this week',
                'target': 2,
            },
            'positional': {
                'type': 'lessons',
                'description': 'Complete 3 positional lessons this week',
                'target': 3,
            },
            'time_management': {
                'type': 'games',
                'description': 'Play 5 games with careful time usage',
                'target': 5,
            },
            'blunders': {
                'type': 'review',
                'description': 'Review 5 games where you blundered',
                'target': 5,
            },
        }

        goals = []
        seen_types = set()

        for weakness in weaknesses[:3]:
            area = weakness['area'].lower()
            template = goal_templates.get(area)
            if template and template['type'] not in seen_types:
                goals.append(template)
                seen_types.add(template['type'])

        # Always add at least one goal
        if not goals:
            goals.append(goal_templates['tactics'])

        return goals

    def _generate_daily_activities(
        self,
        weaknesses: List[Dict[str, Any]],
        goals: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Generate 7 days of activities.
        Each day has 2-3 activities mapped to the goals.
        """
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        activities: Dict[str, List[Dict[str, Any]]] = {}

        # Activity pool based on goals
        activity_pool = []
        for goal in goals:
            if goal['type'] == 'puzzles':
                activity_pool.extend([
                    {'type': 'puzzle', 'label': 'Solve 3 tactical puzzles', 'goal_type': goal['type'], 'completed': False},
                    {'type': 'puzzle', 'label': 'Solve 3 tactical puzzles', 'goal_type': goal['type'], 'completed': False},
                ])
            elif goal['type'] == 'lessons':
                activity_pool.extend([
                    {'type': 'lesson', 'label': f"Study a {weaknesses[0]['area'] if weaknesses else 'chess'} lesson", 'goal_type': goal['type'], 'completed': False},
                ])
            elif goal['type'] == 'review':
                activity_pool.extend([
                    {'type': 'review', 'label': 'Review a recent game', 'goal_type': goal['type'], 'completed': False},
                ])
            elif goal['type'] == 'games':
                activity_pool.extend([
                    {'type': 'play', 'label': 'Play a rated game', 'goal_type': goal['type'], 'completed': False},
                ])

        for day_idx in range(7):
            day_key = str(day_idx)
            day_activities = []

            # Weekdays: 2 activities, weekends: 3 activities
            num_activities = 3 if day_idx >= 5 else 2

            for i in range(num_activities):
                if activity_pool:
                    # Cycle through activities
                    activity = dict(activity_pool[i % len(activity_pool)])
                    activity['day_name'] = day_names[day_idx]
                    day_activities.append(activity)
                else:
                    day_activities.append({
                        'type': 'puzzle',
                        'label': 'Solve 3 tactical puzzles',
                        'goal_type': 'puzzles',
                        'completed': False,
                        'day_name': day_names[day_idx],
                    })

            activities[day_key] = day_activities

        return activities
