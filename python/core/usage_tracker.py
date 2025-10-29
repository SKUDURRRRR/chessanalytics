"""
Usage Tracking Service
Tracks and enforces user usage limits with 24-hour rolling window
"""

from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class UsageTracker:
    """
    Tracks user usage limits for imports and analyses.
    Implements 24-hour rolling window for fair limit enforcement.
    """

    def __init__(self, supabase_client):
        """
        Initialize usage tracker with Supabase client.

        Args:
            supabase_client: Supabase client instance (should use service role key)
        """
        self.supabase = supabase_client

    async def check_import_limit(self, user_id: str) -> Tuple[bool, Dict]:
        """
        Check if user can import more games.

        Args:
            user_id: User's UUID (auth_user_id)

        Returns:
            Tuple of (can_proceed: bool, stats: dict)
        """
        return await self._check_limit(user_id, 'import')

    async def check_analysis_limit(self, user_id: str) -> Tuple[bool, Dict]:
        """
        Check if user can analyze more games.

        Args:
            user_id: User's UUID (auth_user_id)

        Returns:
            Tuple of (can_proceed: bool, stats: dict)
        """
        return await self._check_limit(user_id, 'analyze')

    async def _check_limit(self, user_id: str, action_type: str) -> Tuple[bool, Dict]:
        """
        Internal method to check usage limits.

        Args:
            user_id: User's UUID
            action_type: 'import' or 'analyze'

        Returns:
            Tuple of (can_proceed: bool, stats: dict)
        """
        try:
            # Call database function to check limits
            result = self.supabase.rpc(
                'check_usage_limits',
                {'p_user_id': user_id, 'p_action_type': action_type}
            ).execute()

            if result.data:
                return result.data.get('can_proceed', False), result.data

            # Default to allowing if check fails
            logger.warning(f"Usage limit check failed for user {user_id}, allowing by default")
            return True, {'is_anonymous': True}

        except Exception as e:
            logger.error(f"Error checking usage limits for user {user_id}: {e}")
            # Fail open - allow user to proceed if check fails
            return True, {'error': str(e)}

    async def increment_usage(self, user_id: str, action_type: str, count: int = 1) -> bool:
        """
        Increment usage counter for user.

        Args:
            user_id: User's UUID
            action_type: 'import' or 'analyze'
            count: Number to increment by (default 1)

        Returns:
            Success boolean
        """
        try:
            today = datetime.now().date()
            reset_at = datetime.now()

            # Determine which field to increment
            field_name = 'games_imported' if action_type == 'import' else 'games_analyzed'

            # Try to get existing record
            existing = self.supabase.table('usage_tracking').select('*').eq(
                'user_id', user_id
            ).eq('date', str(today)).execute()

            if existing.data and len(existing.data) > 0:
                # Update existing record
                record = existing.data[0]
                current_value = record.get(field_name, 0)

                # Check if we need to reset (24 hours passed)
                record_reset_at = datetime.fromisoformat(record['reset_at'].replace('Z', '+00:00'))
                if datetime.now() - record_reset_at > timedelta(hours=24):
                    # Reset both counters when window expires
                    update_data = {
                        'games_imported': count if action_type == 'import' else 0,
                        'games_analyzed': count if action_type == 'analyze' else 0,
                        'reset_at': reset_at.isoformat()
                    }
                else:
                    # Increment the counter
                    update_data = {
                        field_name: current_value + count
                    }

                self.supabase.table('usage_tracking').update(update_data).eq(
                    'id', record['id']
                ).execute()
            else:
                # Create new record
                insert_data = {
                    'user_id': user_id,
                    'date': str(today),
                    'games_imported': count if action_type == 'import' else 0,
                    'games_analyzed': count if action_type == 'analyze' else 0,
                    'reset_at': reset_at.isoformat()
                }

                self.supabase.table('usage_tracking').insert(insert_data).execute()

            logger.info(f"Incremented {action_type} usage for user {user_id} by {count}")
            return True

        except Exception as e:
            logger.error(f"Error incrementing usage for user {user_id}: {e}")
            return False

    async def get_usage_stats(self, user_id: str) -> Dict:
        """
        Get current usage statistics for user.

        Args:
            user_id: User's UUID

        Returns:
            Dictionary with usage stats
        """
        try:
            # Get user's account tier
            user_result = self.supabase.table('authenticated_users').select(
                'account_tier, subscription_status'
            ).eq('id', user_id).execute()

            if not user_result.data:
                return {
                    'is_anonymous': True,
                    'message': 'User not found - anonymous access'
                }

            user = user_result.data[0]
            account_tier = user['account_tier']
            subscription_status = user['subscription_status']

            # Get tier limits
            tier_result = self.supabase.table('payment_tiers').select(
                'import_limit, analysis_limit, name'
            ).eq('id', account_tier).execute()

            if not tier_result.data:
                return {'error': 'Tier not found'}

            tier = tier_result.data[0]
            import_limit = tier['import_limit']
            analysis_limit = tier['analysis_limit']
            tier_name = tier['name']

            # Get current usage (within 24-hour window)
            today = datetime.now().date()
            usage_result = self.supabase.table('usage_tracking').select('*').eq(
                'user_id', user_id
            ).eq('date', str(today)).execute()

            current_imports = 0
            current_analyses = 0
            reset_at = None

            if usage_result.data and len(usage_result.data) > 0:
                record = usage_result.data[0]
                reset_at = datetime.fromisoformat(record['reset_at'].replace('Z', '+00:00'))

                # Check if 24 hours have passed
                if datetime.now() - reset_at <= timedelta(hours=24):
                    current_imports = record.get('games_imported', 0)
                    current_analyses = record.get('games_analyzed', 0)
                else:
                    # Usage has reset
                    reset_at = None

            # Calculate remaining
            imports_remaining = None if import_limit is None else max(0, import_limit - current_imports)
            analyses_remaining = None if analysis_limit is None else max(0, analysis_limit - current_analyses)

            return {
                'account_tier': account_tier,
                'tier_name': tier_name,
                'subscription_status': subscription_status,
                'is_unlimited': import_limit is None and analysis_limit is None,
                'imports': {
                    'used': current_imports,
                    'limit': import_limit,
                    'remaining': imports_remaining,
                    'unlimited': import_limit is None
                },
                'analyses': {
                    'used': current_analyses,
                    'limit': analysis_limit,
                    'remaining': analyses_remaining,
                    'unlimited': analysis_limit is None
                },
                'reset_at': reset_at.isoformat() if reset_at else None,
                'resets_in_hours': (
                    round((reset_at + timedelta(hours=24) - datetime.now()).total_seconds() / 3600, 1)
                    if reset_at else 24.0
                )
            }

        except Exception as e:
            logger.error(f"Error getting usage stats for user {user_id}: {e}")
            return {'error': str(e)}

    async def claim_anonymous_data(
        self,
        auth_user_id: str,
        platform: str,
        anonymous_user_id: str
    ) -> Dict:
        """
        Link anonymous user data to authenticated user after registration.

        Args:
            auth_user_id: Authenticated user's UUID
            platform: Platform (lichess or chess.com)
            anonymous_user_id: Anonymous user's platform username

        Returns:
            Dictionary with claim results
        """
        try:
            result = self.supabase.rpc(
                'claim_anonymous_data',
                {
                    'p_auth_user_id': auth_user_id,
                    'p_platform': platform,
                    'p_anonymous_user_id': anonymous_user_id
                }
            ).execute()

            if result.data:
                logger.info(
                    f"Claimed anonymous data for user {auth_user_id}: "
                    f"{result.data.get('games_claimed', 0)} games, "
                    f"{result.data.get('analyses_claimed', 0)} analyses"
                )
                return result.data

            return {'success': False, 'error': 'No data returned from claim operation'}

        except Exception as e:
            logger.error(f"Error claiming anonymous data: {e}")
            return {'success': False, 'error': str(e)}
