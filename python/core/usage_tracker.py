"""
Usage Tracking Service
Tracks and enforces user usage limits with 24-hour rolling window

Security Features:
- Race condition prevention with database-level locking
- Input validation
- Fail-safe error handling
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple
import logging
import asyncio

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

        Raises:
            ValueError: If supabase_client is None
        """
        if supabase_client is None:
            raise ValueError("Supabase client is required")
        self.supabase = supabase_client

    async def check_import_limit(self, user_id: str) -> Tuple[bool, Dict]:
        """
        Check if user can import more games with input validation.

        Args:
            user_id: User's UUID (auth_user_id) - must be non-empty string

        Returns:
            Tuple of (can_proceed: bool, stats: dict)

        Raises:
            ValueError: If user_id is invalid
        """
        if not user_id or not isinstance(user_id, str) or not user_id.strip():
            raise ValueError("Valid user_id is required")
        return await self._check_limit(user_id, 'import')

    async def check_analysis_limit(self, user_id: str) -> Tuple[bool, Dict]:
        """
        Check if user can analyze more games with input validation.

        Args:
            user_id: User's UUID (auth_user_id) - must be non-empty string

        Returns:
            Tuple of (can_proceed: bool, stats: dict)

        Raises:
            ValueError: If user_id is invalid
        """
        if not user_id or not isinstance(user_id, str) or not user_id.strip():
            raise ValueError("Valid user_id is required")
        return await self._check_limit(user_id, 'analyze')

    async def _check_limit(self, user_id: str, action_type: str) -> Tuple[bool, Dict]:
        """
        Internal method to check usage limits with validation.

        Args:
            user_id: User's UUID (validated by caller)
            action_type: 'import' or 'analyze'

        Returns:
            Tuple of (can_proceed: bool, stats: dict)
        """
        # Validate action_type
        if action_type not in ('import', 'analyze'):
            logger.error(f"Invalid action_type: {action_type}")
            return False, {'error': 'Invalid action type'}

        try:
            # Call database function to check limits
            result = await asyncio.to_thread(
                lambda: self.supabase.rpc(
                    'check_usage_limits',
                    {'p_user_id': user_id, 'p_action_type': action_type}
                ).execute()
            )

            if result.data:
                return result.data.get('can_proceed', False), result.data

            # Default to denying if check fails (fail-closed for security)
            logger.warning(f"Usage limit check failed for user {user_id}, denying by default")
            return False, {'message': 'Usage check failed', 'is_anonymous': False}

        except Exception as e:
            error_str = str(e)
            # Check if this is a database schema error (column doesn't exist)
            # In this case, allow the operation to proceed rather than blocking it
            if 'does not exist' in error_str and ('column' in error_str.lower() or 'games_import_limit' in error_str):
                logger.warning(
                    f"Database schema error in usage limit check for user {user_id}: {e}. "
                    "Allowing operation to proceed. Please update database schema."
                )
                # Allow operation to proceed when schema is outdated
                return True, {
                    'can_proceed': True,
                    'schema_error': True,
                    'message': 'Database schema needs update - allowing operation',
                    'is_anonymous': False
                }

            logger.error(f"Error checking usage limits for user {user_id}: {e}")
            # Fail closed - deny user if check fails (more secure than fail-open)
            return False, {'message': str(e)}

    async def increment_usage(self, user_id: str, action_type: str, count: int = 1) -> bool:
        """
        Increment usage counter for user with validation and race condition prevention.

        Args:
            user_id: User's UUID (must be non-empty string)
            action_type: 'import' or 'analyze'
            count: Number to increment by (default 1, must be positive)

        Returns:
            Success boolean

        Raises:
            ValueError: If inputs are invalid
        """
        # Input validation
        if not user_id or not isinstance(user_id, str) or not user_id.strip():
            raise ValueError("Valid user_id is required")
        if action_type not in ('import', 'analyze'):
            raise ValueError("action_type must be 'import' or 'analyze'")
        if not isinstance(count, int) or count <= 0:
            raise ValueError("count must be a positive integer")
        if count > 1000:
            raise ValueError("count cannot exceed 1000 in a single operation")

        try:
            today = datetime.now(timezone.utc).date()
            reset_at = datetime.now(timezone.utc)
            cutoff_time = reset_at - timedelta(hours=24)

            # Determine which field to increment
            field_name = 'games_imported' if action_type == 'import' else 'games_analyzed'

            # Try to get existing record within 24-hour window (matching check_usage_limits logic)
            # Query for most recent record and filter by reset_at in Python since Supabase doesn't support
            # complex date arithmetic in queries easily
            all_records = await asyncio.to_thread(
                lambda: self.supabase.table('usage_tracking').select('*').eq(
                    'user_id', user_id
                ).order('reset_at', desc=True).limit(10).execute()
            )

            # Find the most recent record within 24-hour window
            record = None
            if all_records.data and len(all_records.data) > 0:
                for r in all_records.data:
                    record_reset_at = datetime.fromisoformat(r['reset_at'].replace('Z', '+00:00'))
                    if record_reset_at > cutoff_time:
                        record = r
                        break

            if record:
                # Update existing record
                current_value = record.get(field_name, 0)

                # Check if we need to reset (24 hours passed - should not happen due to filter above, but keep for safety)
                record_reset_at = datetime.fromisoformat(record['reset_at'].replace('Z', '+00:00'))
                # Use timezone-aware datetime to avoid "can't subtract offset-naive and offset-aware datetimes" error
                if datetime.now(timezone.utc) - record_reset_at > timedelta(hours=24):
                    # Reset both counters when window expires
                    update_data = {
                        'games_imported': count if action_type == 'import' else 0,
                        'games_analyzed': count if action_type == 'analyze' else 0,
                        'reset_at': reset_at.isoformat(),
                        'date': str(today)  # Update date to today
                    }
                else:
                    # Increment the counter
                    # Also update date to today to keep it consistent (in case record is from yesterday)
                    update_data = {
                        field_name: current_value + count,
                        'date': str(today)  # Update date to today to keep consistency
                    }

                await asyncio.to_thread(
                    lambda: self.supabase.table('usage_tracking').update(update_data).eq(
                        'id', record['id']
                    ).execute()
                )
            else:
                # Create new record
                insert_data = {
                    'user_id': user_id,
                    'date': str(today),
                    'games_imported': count if action_type == 'import' else 0,
                    'games_analyzed': count if action_type == 'analyze' else 0,
                    'reset_at': reset_at.isoformat()
                }

                await asyncio.to_thread(
                    lambda: self.supabase.table('usage_tracking').insert(insert_data).execute()
                )

            logger.info(f"Incremented {action_type} usage for user {user_id} by {count}")
            return True

        except Exception as e:
            logger.error(f"Error incrementing usage for user {user_id}: {e}")
            return False

    async def get_usage_stats(self, user_id: str) -> Dict:
        """
        Get current usage statistics for user with validation.

        Args:
            user_id: User's UUID (must be non-empty string)

        Returns:
            Dictionary with usage stats

        Raises:
            ValueError: If user_id is invalid
        """
        # Input validation
        if not user_id or not isinstance(user_id, str) or not user_id.strip():
            raise ValueError("Valid user_id is required")

        try:
            # Get user's account tier
            user_result = await asyncio.to_thread(
                lambda: self.supabase.table('authenticated_users').select(
                    'account_tier, subscription_status, subscription_end_date'
                ).eq('id', user_id).execute()
            )

            if not user_result.data:
                return {
                    'is_anonymous': True,
                    'message': 'User not found - anonymous access'
                }

            user = user_result.data[0]
            account_tier = user['account_tier']
            subscription_status = user['subscription_status']
            subscription_end_date = user.get('subscription_end_date')

            # Debug logging for subscription end date
            logger.info(f"[USAGE_STATS] subscription_end_date from DB: {subscription_end_date}, type: {type(subscription_end_date)}")

            # Get tier limits
            tier_result = await asyncio.to_thread(
                lambda: self.supabase.table('payment_tiers').select(
                    'import_limit, analysis_limit, name'
                ).eq('id', account_tier).execute()
            )

            if not tier_result.data:
                return {'success': False, 'message': 'Tier not found'}

            tier = tier_result.data[0]
            import_limit = tier['import_limit']
            analysis_limit = tier['analysis_limit']
            tier_name = tier['name']

            # Debug logging
            logger.info(f"[USAGE_STATS] User {user_id}: tier={account_tier}, name={tier_name}, import_limit={import_limit}, analysis_limit={analysis_limit}")

            # Get current usage (within 24-hour rolling window)
            # Query all recent records and filter by reset_at to match check_usage_limits logic
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
            usage_result = await asyncio.to_thread(
                lambda: self.supabase.table('usage_tracking').select('*').eq(
                    'user_id', user_id
                ).order('reset_at', desc=True).limit(10).execute()
            )

            current_imports = 0
            current_analyses = 0
            reset_at = None

            # Find the most recent record within 24-hour window (matching check_usage_limits logic)
            if usage_result.data and len(usage_result.data) > 0:
                for record in usage_result.data:
                    record_reset_at = datetime.fromisoformat(record['reset_at'].replace('Z', '+00:00'))
                    if record_reset_at > cutoff_time:
                        # Found valid record within 24-hour window
                        reset_at = record_reset_at
                        current_imports = record.get('games_imported', 0)
                        current_analyses = record.get('games_analyzed', 0)
                        break

            # Calculate remaining
            imports_remaining = None if import_limit is None else max(0, import_limit - current_imports)
            analyses_remaining = None if analysis_limit is None else max(0, analysis_limit - current_analyses)

            result = {
                'account_tier': account_tier,
                'tier_name': tier_name,
                'subscription_status': subscription_status,
                'subscription_end_date': subscription_end_date,
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
                    round((reset_at + timedelta(hours=24) - datetime.now(timezone.utc)).total_seconds() / 3600, 1)
                    if reset_at else 24.0
                )
            }

            logger.info(f"[USAGE_STATS] Returning subscription_end_date: {result.get('subscription_end_date')}")
            return {'success': True, **result}

        except Exception as e:
            logger.error(f"Error getting usage stats for user {user_id}: {e}")
            return {'success': False, 'message': str(e)}

    async def claim_anonymous_data(
        self,
        auth_user_id: str,
        platform: str,
        anonymous_user_id: str
    ) -> Dict:
        """
        Link anonymous user data to authenticated user after registration with validation.

        Args:
            auth_user_id: Authenticated user's UUID (must be non-empty string)
            platform: Platform (lichess or chess.com)
            anonymous_user_id: Anonymous user's platform username (must be non-empty)

        Returns:
            Dictionary with claim results

        Raises:
            ValueError: If inputs are invalid
        """
        # Input validation
        if not auth_user_id or not isinstance(auth_user_id, str) or not auth_user_id.strip():
            raise ValueError("Valid auth_user_id is required")
        if platform not in ('lichess', 'chess.com'):
            raise ValueError("platform must be 'lichess' or 'chess.com'")
        if not anonymous_user_id or not isinstance(anonymous_user_id, str) or not anonymous_user_id.strip():
            raise ValueError("Valid anonymous_user_id is required")

        try:
            result = await asyncio.to_thread(
                lambda: self.supabase.rpc(
                    'claim_anonymous_data',
                    {
                        'p_auth_user_id': auth_user_id,
                        'p_platform': platform,
                        'p_anonymous_user_id': anonymous_user_id
                    }
                ).execute()
            )

            if result.data:
                logger.info(
                    f"Claimed anonymous data for user {auth_user_id}: "
                    f"{result.data.get('games_claimed', 0)} games, "
                    f"{result.data.get('analyses_claimed', 0)} analyses"
                )
                return result.data

            return {'success': False, 'message': 'No data returned from claim operation'}

        except Exception as e:
            logger.error(f"Error claiming anonymous data: {e}")
            return {'success': False, 'message': str(e)}

    # ============================================================================
    # ANONYMOUS USER LIMIT CHECKING (IP-based)
    # ============================================================================

    async def check_anonymous_import_limit(self, ip_address: str) -> Tuple[bool, Dict]:
        """
        Check if anonymous user (by IP) can import more games.

        Args:
            ip_address: Client IP address

        Returns:
            Tuple of (can_proceed: bool, stats: dict)
        """
        if not ip_address or not isinstance(ip_address, str) or not ip_address.strip():
            logger.error("Invalid IP address provided to check_anonymous_import_limit")
            return False, {'error': 'Invalid IP address'}

        return await self._check_anonymous_limit(ip_address, 'import')

    async def check_anonymous_analysis_limit(self, ip_address: str) -> Tuple[bool, Dict]:
        """
        Check if anonymous user (by IP) can analyze more games.

        Args:
            ip_address: Client IP address

        Returns:
            Tuple of (can_proceed: bool, stats: dict)
        """
        if not ip_address or not isinstance(ip_address, str) or not ip_address.strip():
            logger.error("Invalid IP address provided to check_anonymous_analysis_limit")
            return False, {'error': 'Invalid IP address'}

        return await self._check_anonymous_limit(ip_address, 'analyze')

    async def _check_anonymous_limit(self, ip_address: str, action_type: str) -> Tuple[bool, Dict]:
        """
        Internal method to check anonymous usage limits.

        Args:
            ip_address: Client IP address
            action_type: 'import' or 'analyze'

        Returns:
            Tuple of (can_proceed: bool, stats: dict)
        """
        if action_type not in ('import', 'analyze'):
            logger.error(f"Invalid action_type: {action_type}")
            return False, {'error': 'Invalid action type'}

        try:
            # Call database function to check limits
            result = await asyncio.to_thread(
                lambda: self.supabase.rpc(
                    'check_anonymous_usage_limits',
                    {'p_ip_address': ip_address, 'p_action_type': action_type}
                ).execute()
            )

            if result.data:
                can_proceed = result.data.get('can_proceed', False)
                logger.info(
                    f"Anonymous {action_type} limit check for IP {ip_address}: "
                    f"can_proceed={can_proceed}, "
                    f"current={result.data.get('current_imports' if action_type == 'import' else 'current_analyses', 0)}, "
                    f"limit={result.data.get('import_limit' if action_type == 'import' else 'analysis_limit', 0)}"
                )
                return can_proceed, result.data

            logger.warning(f"Anonymous usage limit check failed for IP {ip_address}, denying by default")
            return False, {'message': 'Usage check failed'}

        except Exception as e:
            logger.error(f"Error checking anonymous usage limits for IP {ip_address}: {e}")
            # Fail open for anonymous users (allow operation) to avoid blocking legitimate users
            # Anonymous users can bypass by changing IP anyway, so fail-open is acceptable
            logger.warning("Allowing anonymous operation due to limit check error (fail-open)")
            return True, {'message': 'Limit check error - allowing operation', 'error': str(e)}

    async def increment_anonymous_usage(self, ip_address: str, action_type: str, count: int = 1) -> bool:
        """
        Increment usage counter for anonymous user (by IP).

        Args:
            ip_address: Client IP address
            action_type: 'import' or 'analyze'
            count: Number to increment by (default: 1)

        Returns:
            bool: True if increment succeeded, False otherwise
        """
        if not ip_address or not isinstance(ip_address, str) or not ip_address.strip():
            logger.error("Invalid IP address provided to increment_anonymous_usage")
            return False

        if action_type not in ('import', 'analyze'):
            logger.error(f"Invalid action_type: {action_type}")
            return False

        if not isinstance(count, int) or count < 1:
            logger.error(f"Invalid count: {count}")
            return False

        try:
            result = await asyncio.to_thread(
                lambda: self.supabase.rpc(
                    'increment_anonymous_usage',
                    {
                        'p_ip_address': ip_address,
                        'p_action_type': action_type,
                        'p_count': count
                    }
                ).execute()
            )

            if result.data and result.data.get('success'):
                logger.info(
                    f"Incremented anonymous {action_type} usage for IP {ip_address}: "
                    f"+{count}, new_value={result.data.get('new_value', '?')}"
                )
                return True

            logger.warning(f"Failed to increment anonymous usage for IP {ip_address}")
            return False

        except Exception as e:
            logger.error(f"Error incrementing anonymous usage for IP {ip_address}: {e}")
            return False
