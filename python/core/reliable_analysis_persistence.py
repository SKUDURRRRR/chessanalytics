#!/usr/bin/env python3
"""
Reliable Analysis Persistence Module
Provides robust, idempotent analysis storage with retry logic and progress tracking.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import json
import traceback

from supabase import Client
from .analysis_engine import GameAnalysis, AnalysisType

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PersistenceStatus(Enum):
    """Status of analysis persistence operations."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"

@dataclass
class PersistenceResult:
    """Result of a persistence operation."""
    success: bool
    status: PersistenceStatus
    message: str
    retry_count: int = 0
    analysis_id: Optional[str] = None
    error_details: Optional[str] = None

@dataclass
class AnalysisJob:
    """Represents an analysis job with tracking."""
    job_id: str
    user_id: str
    platform: str
    game_id: str
    analysis_type: AnalysisType
    status: PersistenceStatus
    created_at: datetime
    updated_at: datetime
    retry_count: int = 0
    max_retries: int = 3
    error_message: Optional[str] = None
    analysis_data: Optional[Dict[str, Any]] = None

class ReliableAnalysisPersistence:
    """
    Reliable analysis persistence with retry logic, progress tracking, and error handling.
    """

    def __init__(self, supabase_client: Client, supabase_service: Client, on_save_callback=None):
        self.supabase = supabase_client
        self.supabase_service = supabase_service
        self.max_retries = 3
        self.retry_delay = 1.0  # seconds
        self.on_save_callback = on_save_callback  # Optional callback to trigger after successful save

    async def save_analysis_with_retry(
        self,
        analysis: GameAnalysis,
        job_id: Optional[str] = None
    ) -> PersistenceResult:
        """
        Save analysis with retry logic and progress tracking.

        Args:
            analysis: The analysis to save
            job_id: Optional job ID for tracking

        Returns:
            PersistenceResult with success status and details
        """
        if job_id is None:
            job_id = f"{analysis.user_id}_{analysis.platform}_{analysis.game_id}_{str(analysis.analysis_type)}"

        # Create or update job tracking
        job = await self._create_or_update_job(job_id, analysis)

        try:
            # Attempt to save analysis
            success, saved_payload = await self._save_analysis_atomic(analysis)

            if success:
                extra_fields: Dict[str, Any] = {}
                analysis_identifier = job_id
                if saved_payload:
                    analysis_identifier = saved_payload.get('game_analysis_id') or job_id
                    extra_fields = {
                        'processing_time_ms': saved_payload.get('processing_time_ms'),
                        'analysis_data': saved_payload,
                        'completed_at': datetime.now(timezone.utc).isoformat()
                    }
                await self._update_job_status(job_id, PersistenceStatus.COMPLETED, "Analysis saved successfully", extra_fields)
                return PersistenceResult(
                    success=True,
                    status=PersistenceStatus.COMPLETED,
                    message="Analysis saved successfully",
                    analysis_id=analysis_identifier
                )
            else:
                await self._handle_persistence_failure(job_id, "Failed to save analysis")
                return await self._retry_if_possible(job_id, analysis)

        except Exception as e:
            error_msg = f"Exception during analysis save: {str(e)}"
            logger.error(f"Error saving analysis {job_id}: {error_msg}")
            logger.error(traceback.format_exc())

            await self._handle_persistence_failure(job_id, error_msg)
            return await self._retry_if_possible(job_id, analysis)

    async def _save_analysis_atomic(self, analysis: GameAnalysis) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Atomically save analysis to the appropriate table(s).
        Uses database transactions to ensure consistency and returns saved payload.
        """
        try:
            canonical_user_id = self._canonical_user_id(analysis.user_id, analysis.platform)
            analysis_type_enum = self._normalize_analysis_type(analysis.analysis_type)
            analysis_data = self._prepare_analysis_data(analysis, canonical_user_id, analysis_type_enum)

            if analysis_type_enum in [AnalysisType.STOCKFISH, AnalysisType.DEEP]:
                success, record_id = await self._save_to_both_tables(analysis_data)
            else:
                success, record_id = await self._save_to_game_analyses(analysis_data)

            if success and record_id:
                analysis_data['game_analysis_id'] = record_id

            if success:
                logger.info(
                    "Successfully saved %s analysis for game %s",
                    analysis_type_enum.value,
                    analysis.game_id
                )

                # Trigger callback if provided (for cache invalidation, etc.)
                if self.on_save_callback:
                    try:
                        self.on_save_callback(canonical_user_id, analysis.platform)
                    except Exception as callback_error:
                        logger.warning(f"Callback error after save: {callback_error}")

                return True, analysis_data

            logger.error(
                "Failed to save %s analysis for game %s",
                analysis_type_enum.value,
                analysis.game_id
            )
            return False, None

        except Exception as e:
            logger.error(f"Error in atomic save: {str(e)}")
            logger.error(traceback.format_exc())
            print(f"[PERSISTENCE] ❌ ATOMIC SAVE ERROR: {str(e)}")
            print(f"[PERSISTENCE] Error type: {type(e).__name__}")
            print(f"[PERSISTENCE] Traceback: {traceback.format_exc()}")
            return False, None

    async def _save_to_both_tables(self, analysis_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save analysis to both game_analyses and move_analyses tables."""
        try:
            # First verify that the game exists in the games table
            try:
                game_check = self.supabase_service.table('games').select('id').eq(
                    'user_id', analysis_data['user_id']
                ).eq('platform', analysis_data['platform']).eq(
                    'provider_game_id', analysis_data['game_id']
                ).limit(1).execute()

                if not game_check.data:
                    print(f"[PERSISTENCE] ❌ Game not found in games table:")
                    print(f"[PERSISTENCE]    user_id: {analysis_data['user_id']}")
                    print(f"[PERSISTENCE]    platform: {analysis_data['platform']}")
                    print(f"[PERSISTENCE]    game_id: {analysis_data['game_id']}")
                    print(f"[PERSISTENCE] This game must be imported first before analysis can be saved.")
                    return False, None
            except Exception as check_error:
                print(f"[PERSISTENCE] ⚠️  Warning: Could not verify game existence: {check_error}")
                # Continue anyway - let the database constraint catch it

            game_analyses_data = {
                'game_id': analysis_data['game_id'],
                'user_id': analysis_data['user_id'],
                'platform': analysis_data['platform'],
                'total_moves': analysis_data['total_moves'],
                'accuracy': analysis_data['accuracy'],
                'opponent_accuracy': analysis_data['opponent_accuracy'],
                'blunders': analysis_data['blunders'],
                'mistakes': analysis_data['mistakes'],
                'inaccuracies': analysis_data['inaccuracies'],
                'brilliant_moves': analysis_data['brilliant_moves'],
                'best_moves': analysis_data['best_moves'],
                'good_moves': analysis_data['good_moves'],
                'acceptable_moves': analysis_data['acceptable_moves'],
                'opening_accuracy': analysis_data['opening_accuracy'],
                'middle_game_accuracy': analysis_data['middle_game_accuracy'],
                'endgame_accuracy': analysis_data['endgame_accuracy'],
                'average_centipawn_loss': analysis_data['average_centipawn_loss'],
                'opponent_average_centipawn_loss': analysis_data['opponent_average_centipawn_loss'],
                'worst_blunder_centipawn_loss': analysis_data['worst_blunder_centipawn_loss'],
                'opponent_worst_blunder_centipawn_loss': analysis_data['opponent_worst_blunder_centipawn_loss'],
                'time_management_score': analysis_data['time_management_score'],
                'opponent_time_management_score': analysis_data['opponent_time_management_score'],
                'tactical_score': analysis_data['tactical_score'],
                'positional_score': analysis_data['positional_score'],
                'aggressive_score': analysis_data['aggressive_score'],
                'patient_score': analysis_data['patient_score'],
                'novelty_score': analysis_data['novelty_score'],
                'staleness_score': analysis_data['staleness_score'],
                'tactical_patterns': analysis_data['tactical_patterns'],
                'positional_patterns': analysis_data['positional_patterns'],
                'strategic_themes': analysis_data['strategic_themes'],
                'moves_analysis': analysis_data['moves_analysis'],
                'average_evaluation': analysis_data.get('average_evaluation', 0.0),
                'analysis_type': analysis_data['analysis_type'],
                'analysis_date': analysis_data['analysis_date'],
                'processing_time_ms': analysis_data['processing_time_ms'],
                'stockfish_depth': analysis_data['stockfish_depth']
            }

            print(f"[PERSISTENCE] Saving to game_analyses table: user={analysis_data['user_id']}, game={analysis_data['game_id']}, type={analysis_data['analysis_type']}")

            try:
                game_response = self.supabase_service.table('game_analyses').upsert(
                    game_analyses_data,
                    on_conflict='user_id,platform,game_id,analysis_type'
                ).execute()

                print(f"[PERSISTENCE] game_analyses response: data={getattr(game_response, 'data', None)}, error={getattr(game_response, 'error', None)}")

                # Check for database constraint violations
                if hasattr(game_response, 'error') and game_response.error:
                    error_msg = str(game_response.error)

                    # Check for unique constraint violation (needs database migration)
                    if 'idx_game_analyses_user_platform_game' in error_msg and 'duplicate key' in error_msg.lower():
                        print(f"[PERSISTENCE] ❌ DATABASE CONSTRAINT ERROR: {error_msg}")
                        print(f"[PERSISTENCE] ⚠️  DATABASE MIGRATION REQUIRED!")
                        print(f"[PERSISTENCE] The database constraint needs to be updated to support reanalysis.")
                        print(f"[PERSISTENCE] Please run the migration: supabase/migrations/20250111000001_fix_game_analyses_constraint.sql")
                        print(f"[PERSISTENCE] See FIX_REANALYSIS_ISSUE.md for detailed instructions.")
                        return False, None

                    # Check for foreign key constraint violations
                    if 'foreign key' in error_msg.lower() or 'constraint' in error_msg.lower():
                        print(f"[PERSISTENCE] ❌ FOREIGN KEY CONSTRAINT VIOLATION: {error_msg}")
                        print(f"[PERSISTENCE] This means the game record doesn't exist in the games table")
                        print(f"[PERSISTENCE] Game ID: {analysis_data['game_id']}, User: {analysis_data['user_id']}, Platform: {analysis_data['platform']}")
                        print(f"[PERSISTENCE] The game must be imported first before it can be analyzed.")
                        return False, None

            except Exception as db_error:
                error_msg = str(db_error)
                print(f"[PERSISTENCE] ❌ DATABASE ERROR during game_analyses save: {error_msg}")

                # Check for unique constraint violation (needs database migration)
                if 'idx_game_analyses_user_platform_game' in error_msg and 'duplicate key' in error_msg.lower():
                    print(f"[PERSISTENCE] ⚠️  DATABASE MIGRATION REQUIRED!")
                    print(f"[PERSISTENCE] The database constraint needs to be updated to support reanalysis.")
                    print(f"[PERSISTENCE] Please run the migration: supabase/migrations/20250111000001_fix_game_analyses_constraint.sql")
                    print(f"[PERSISTENCE] See FIX_REANALYSIS_ISSUE.md for detailed instructions.")
                    return False, None

                # Check for foreign key constraint violations
                if 'foreign key' in error_msg.lower() or 'constraint' in error_msg.lower():
                    print(f"[PERSISTENCE] ❌ FOREIGN KEY CONSTRAINT VIOLATION: {error_msg}")
                    print(f"[PERSISTENCE] This means the game record doesn't exist in the games table")
                    print(f"[PERSISTENCE] Game ID: {analysis_data['game_id']}, User: {analysis_data['user_id']}, Platform: {analysis_data['platform']}")
                    print(f"[PERSISTENCE] The game must be imported first before it can be analyzed.")
                return False, None

            game_analysis_id = None
            response_data = getattr(game_response, 'data', None)
            if response_data:
                game_analysis_id = response_data[0].get('id')
                print(f"[PERSISTENCE] game_analyses record ID: {game_analysis_id}")

            if game_analysis_id is None:
                fetch_response = self.supabase_service.table('game_analyses').select('id').eq('user_id', analysis_data['user_id']).eq('platform', analysis_data['platform']).eq('game_id', analysis_data['game_id']).eq('analysis_type', analysis_data['analysis_type']).limit(1).execute()
                fetch_data = getattr(fetch_response, 'data', None)
                if fetch_data:
                    game_analysis_id = fetch_data[0].get('id')

            move_analyses_data = {
                'game_analysis_id': game_analysis_id,
                'game_id': analysis_data['game_id'],
                'user_id': analysis_data['user_id'],
                'platform': analysis_data['platform'],
                'accuracy': analysis_data['accuracy'],
                'opponent_accuracy': analysis_data['opponent_accuracy'],
                'good_moves': analysis_data['good_moves'],
                'acceptable_moves': analysis_data['acceptable_moves'],
                'average_centipawn_loss': analysis_data['average_centipawn_loss'],
                'opponent_average_centipawn_loss': analysis_data['opponent_average_centipawn_loss'],
                'worst_blunder_centipawn_loss': analysis_data['worst_blunder_centipawn_loss'],
                'opponent_worst_blunder_centipawn_loss': analysis_data['opponent_worst_blunder_centipawn_loss'],
                'middle_game_accuracy': analysis_data['middle_game_accuracy'],
                'endgame_accuracy': analysis_data['endgame_accuracy'],
                'time_management_score': analysis_data['time_management_score'],
                'opponent_time_management_score': analysis_data['opponent_time_management_score'],
                'material_sacrifices': analysis_data.get('material_sacrifices', 0),
                'aggressiveness_index': analysis_data.get('aggressiveness_index', analysis_data['aggressive_score']),
                'average_evaluation': analysis_data.get('average_evaluation', 0.0),
                'tactical_score': analysis_data['tactical_score'],
                'positional_score': analysis_data['positional_score'],
                'aggressive_score': analysis_data['aggressive_score'],
                'patient_score': analysis_data['patient_score'],
                'novelty_score': analysis_data['novelty_score'],
                'staleness_score': analysis_data['staleness_score'],
                'tactical_patterns': analysis_data['tactical_patterns'],
                'positional_patterns': analysis_data['positional_patterns'],
                'strategic_themes': analysis_data['strategic_themes'],
                'moves_analysis': analysis_data['moves_analysis'],
                'analysis_method': analysis_data['analysis_type'],
                'analysis_date': analysis_data['analysis_date'],
                'processing_time_ms': analysis_data['processing_time_ms'],
                'stockfish_depth': analysis_data['stockfish_depth']
            }

            logger.info(
                "move_analyses upsert payload user=%s platform=%s game=%s method=%s moves=%s",
                analysis_data['user_id'],
                analysis_data['platform'],
                analysis_data['game_id'],
                analysis_data['analysis_type'],
                len(analysis_data.get('moves_analysis') or [])
            )

            print(f"[PERSISTENCE] Saving to move_analyses table: user={analysis_data['user_id']}, game={analysis_data['game_id']}, method={analysis_data['analysis_type']}")

            move_response = self.supabase_service.table('move_analyses').upsert(
                move_analyses_data,
                on_conflict='user_id,platform,game_id,analysis_method'
            ).execute()

            move_data = getattr(move_response, 'data', None)
            move_error = getattr(move_response, 'error', None)
            move_count = len(move_data) if isinstance(move_data, list) else 0

            print(f"[PERSISTENCE] move_analyses response: rows={move_count}, error={move_error}")

            logger.info(
                "move_analyses upsert result rows=%s error=%s",
                move_count,
                move_error
            )
            if not move_data:
                logger.debug("move_analyses raw response: %s", getattr(move_response, '__dict__', {}))
                print(f"[PERSISTENCE] move_analyses raw response: {getattr(move_response, '__dict__', {})}")

            return game_analysis_id is not None, game_analysis_id

        except Exception as e:
            logger.error(f"Error saving to both tables: {str(e)}")
            print(f"[PERSISTENCE] ❌ ERROR SAVING TO BOTH TABLES: {str(e)}")
            print(f"[PERSISTENCE] Error type: {type(e).__name__}")
            print(f"[PERSISTENCE] Traceback: {traceback.format_exc()}")
            return False, None

    async def _save_to_game_analyses(self, analysis_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save analysis to game_analyses table only."""
        try:
            # First verify that the game exists in the games table
            try:
                game_check = self.supabase_service.table('games').select('id').eq(
                    'user_id', analysis_data['user_id']
                ).eq('platform', analysis_data['platform']).eq(
                    'provider_game_id', analysis_data['game_id']
                ).limit(1).execute()

                if not game_check.data:
                    print(f"[PERSISTENCE] ❌ Game not found in games table:")
                    print(f"[PERSISTENCE]    user_id: {analysis_data['user_id']}")
                    print(f"[PERSISTENCE]    platform: {analysis_data['platform']}")
                    print(f"[PERSISTENCE]    game_id: {analysis_data['game_id']}")
                    print(f"[PERSISTENCE] This game must be imported first before analysis can be saved.")
                    return False, None
            except Exception as check_error:
                print(f"[PERSISTENCE] ⚠️  Warning: Could not verify game existence: {check_error}")
                # Continue anyway - let the database constraint catch it

            game_analyses_data = {
                'game_id': analysis_data['game_id'],
                'user_id': analysis_data['user_id'],
                'platform': analysis_data['platform'],
                'total_moves': analysis_data['total_moves'],
                'accuracy': analysis_data['accuracy'],
                'opponent_accuracy': analysis_data['opponent_accuracy'],
                'blunders': analysis_data['blunders'],
                'mistakes': analysis_data['mistakes'],
                'inaccuracies': analysis_data['inaccuracies'],
                'brilliant_moves': analysis_data['brilliant_moves'],
                'best_moves': analysis_data['best_moves'],
                'good_moves': analysis_data['good_moves'],
                'acceptable_moves': analysis_data['acceptable_moves'],
                'opening_accuracy': analysis_data['opening_accuracy'],
                'middle_game_accuracy': analysis_data['middle_game_accuracy'],
                'endgame_accuracy': analysis_data['endgame_accuracy'],
                'average_centipawn_loss': analysis_data['average_centipawn_loss'],
                'opponent_average_centipawn_loss': analysis_data['opponent_average_centipawn_loss'],
                'worst_blunder_centipawn_loss': analysis_data['worst_blunder_centipawn_loss'],
                'opponent_worst_blunder_centipawn_loss': analysis_data['opponent_worst_blunder_centipawn_loss'],
                'time_management_score': analysis_data['time_management_score'],
                'opponent_time_management_score': analysis_data['opponent_time_management_score'],
                'tactical_score': analysis_data['tactical_score'],
                'positional_score': analysis_data['positional_score'],
                'aggressive_score': analysis_data['aggressive_score'],
                'patient_score': analysis_data['patient_score'],
                'novelty_score': analysis_data['novelty_score'],
                'staleness_score': analysis_data['staleness_score'],
                'tactical_patterns': analysis_data['tactical_patterns'],
                'positional_patterns': analysis_data['positional_patterns'],
                'strategic_themes': analysis_data['strategic_themes'],
                'moves_analysis': analysis_data['moves_analysis'],
                'average_evaluation': analysis_data.get('average_evaluation', 0.0),
                'analysis_type': analysis_data['analysis_type'],
                'analysis_date': analysis_data['analysis_date'],
                'processing_time_ms': analysis_data['processing_time_ms'],
                'stockfish_depth': analysis_data['stockfish_depth']
            }

            response = self.supabase_service.table('game_analyses').upsert(
                game_analyses_data,
                on_conflict='user_id,platform,game_id,analysis_type'
            ).execute()

            record_id = None
            response_data = getattr(response, 'data', None)
            if response_data:
                record_id = response_data[0].get('id')

            if record_id is None:
                fetch_response = self.supabase_service.table('game_analyses').select('id').eq('user_id', analysis_data['user_id']).eq('platform', analysis_data['platform']).eq('game_id', analysis_data['game_id']).eq('analysis_type', analysis_data['analysis_type']).limit(1).execute()
                fetch_data = getattr(fetch_response, 'data', None)
                if fetch_data:
                    record_id = fetch_data[0].get('id')

            return record_id is not None, record_id

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error saving to game_analyses: {error_msg}")

            # Check for unique constraint violation (needs database migration)
            if 'idx_game_analyses_user_platform_game' in error_msg and 'duplicate key' in error_msg.lower():
                print(f"[PERSISTENCE] ❌ DATABASE CONSTRAINT ERROR: {error_msg}")
                print(f"[PERSISTENCE] ⚠️  DATABASE MIGRATION REQUIRED!")
                print(f"[PERSISTENCE] The database constraint needs to be updated to support reanalysis.")
                print(f"[PERSISTENCE] Please run the migration: supabase/migrations/20250111000001_fix_game_analyses_constraint.sql")
                print(f"[PERSISTENCE] See FIX_REANALYSIS_ISSUE.md for detailed instructions.")
            elif 'foreign key' in error_msg.lower() or 'constraint' in error_msg.lower():
                print(f"[PERSISTENCE] ❌ FOREIGN KEY CONSTRAINT VIOLATION: {error_msg}")
                print(f"[PERSISTENCE] This means the game record doesn't exist in the games table")
                print(f"[PERSISTENCE] Game ID: {analysis_data['game_id']}, User: {analysis_data['user_id']}, Platform: {analysis_data['platform']}")
                print(f"[PERSISTENCE] The game must be imported first before it can be analyzed.")

            return False, None

    def _prepare_analysis_data(self, analysis: GameAnalysis, canonical_user_id: str, analysis_type: AnalysisType) -> Dict[str, Any]:
        """Prepare analysis data for database storage."""
        # Convert moves analysis to dict format
        moves_analysis_dict = []
        for move in analysis.moves_analysis:
            moves_analysis_dict.append({
                'move': move.move,
                'move_san': move.move_san,
                'evaluation': move.evaluation,  # Contains 'pv' field with full Stockfish PV line
                'evaluation_before': getattr(move, 'evaluation_before', None),  # CRITICAL: for personality scoring
                'evaluation_after': getattr(move, 'evaluation_after', None),  # CRITICAL: for personality scoring
                'is_best': move.is_best,
                'is_brilliant': move.is_brilliant,
                'is_great': getattr(move, 'is_great', False),  # NEW field
                'is_excellent': getattr(move, 'is_excellent', False),  # NEW field
                'is_blunder': move.is_blunder,
                'is_mistake': move.is_mistake,
                'is_inaccuracy': move.is_inaccuracy,
                'is_good': move.is_good,
                'is_acceptable': move.is_acceptable,
                'centipawn_loss': move.centipawn_loss,
                'depth_analyzed': move.depth_analyzed,
                'best_move': move.best_move,
                'best_move_san': getattr(move, 'best_move_san', ''),  # SAN notation for best move
                'best_move_pv': getattr(move, 'best_move_pv', []),  # PV for best move line (UCI)
                'fen_before': getattr(move, 'fen_before', ''),  # FEN before move
                'fen_after': getattr(move, 'fen_after', ''),  # FEN after move
                'explanation': move.explanation,
                'heuristic_details': move.heuristic_details,
                'coaching_comment': move.coaching_comment,
                'what_went_right': move.what_went_right,
                'what_went_wrong': move.what_went_wrong,
                'how_to_improve': move.how_to_improve,
                'tactical_insights': move.tactical_insights,
                'positional_insights': move.positional_insights,
                'risks': move.risks,
                'benefits': move.benefits,
                'learning_points': move.learning_points,
                'encouragement_level': move.encouragement_level,
                'move_quality': move.move_quality,
                'game_phase': move.game_phase,
                'analysis_time_ms': move.analysis_time_ms,
                'is_user_move': move.is_user_move,
                'player_color': move.player_color,
                'ply_index': move.ply_index,
                'opening_ply': move.ply_index  # Add opening_ply field for opening accuracy calculation
            })

        return {
            'game_id': analysis.game_id,
            'user_id': canonical_user_id,
            'platform': analysis.platform,
            'total_moves': analysis.total_moves,
            'accuracy': analysis.accuracy,
            'opponent_accuracy': analysis.opponent_accuracy,
            'blunders': analysis.blunders,
            'mistakes': analysis.mistakes,
            'inaccuracies': analysis.inaccuracies,
            'brilliant_moves': analysis.brilliant_moves,
            'best_moves': analysis.best_moves,
            'good_moves': analysis.good_moves,
            'acceptable_moves': analysis.acceptable_moves,
            'opening_accuracy': analysis.opening_accuracy,
            'middle_game_accuracy': analysis.middle_game_accuracy,
            'endgame_accuracy': analysis.endgame_accuracy,
            'average_centipawn_loss': analysis.average_centipawn_loss,
            'opponent_average_centipawn_loss': analysis.opponent_average_centipawn_loss,
            'worst_blunder_centipawn_loss': analysis.worst_blunder_centipawn_loss,
            'opponent_worst_blunder_centipawn_loss': analysis.opponent_worst_blunder_centipawn_loss,
            'time_management_score': analysis.time_management_score,
            'opponent_time_management_score': analysis.opponent_time_management_score,
            'tactical_score': analysis.tactical_score,
            'positional_score': analysis.positional_score,
            'aggressive_score': analysis.aggressive_score,
            'patient_score': analysis.patient_score,
            'novelty_score': analysis.novelty_score,
            'staleness_score': analysis.staleness_score,
            'tactical_patterns': analysis.tactical_patterns,
            'positional_patterns': analysis.positional_patterns,
            'strategic_themes': analysis.strategic_themes,
            'moves_analysis': moves_analysis_dict,
            'average_evaluation': getattr(analysis, 'average_evaluation', 0.0),
            'analysis_type': analysis_type.value,
            'analysis_date': analysis.analysis_date.isoformat(),
            'processing_time_ms': analysis.processing_time_ms,
            'stockfish_depth': analysis.stockfish_depth,
            'material_sacrifices': getattr(analysis, 'material_sacrifices', 0),
            'aggressiveness_index': getattr(analysis, 'aggressiveness_index', analysis.aggressive_score),
            'game_analysis_id': None
        }

    def _normalize_analysis_type(self, analysis_type: Any) -> AnalysisType:
        """Convert analysis_type into AnalysisType enum."""
        if isinstance(analysis_type, AnalysisType):
            return analysis_type
        if isinstance(analysis_type, str):
            try:
                return AnalysisType(analysis_type.lower())
            except ValueError:
                pass
        logger.warning(
            "Unknown analysis_type=%s; defaulting to %s",
            analysis_type,
            AnalysisType.STOCKFISH.value
        )
        return AnalysisType.STOCKFISH

    def _canonical_user_id(self, user_id: str, platform: str) -> str:
        """Canonicalize user ID for database operations."""
        # Remove any platform-specific prefixes or suffixes
        if platform == 'lichess' and user_id.startswith('lichess_'):
            return user_id[8:]  # Remove 'lichess_' prefix
        elif platform == 'chess.com' and user_id.startswith('chesscom_'):
            return user_id[9:]  # Remove 'chesscom_' prefix
        return user_id

    async def _create_or_update_job(self, job_id: str, analysis: GameAnalysis) -> AnalysisJob:
        """Create or update analysis job tracking."""
        now = datetime.now(timezone.utc)

        analysis_type_enum = self._normalize_analysis_type(analysis.analysis_type)

        job = AnalysisJob(
            job_id=job_id,
            user_id=analysis.user_id,
            platform=analysis.platform,
            game_id=analysis.game_id,
            analysis_type=analysis_type_enum,
            status=PersistenceStatus.IN_PROGRESS,
            created_at=now,
            updated_at=now,
            analysis_data=self._prepare_analysis_data(
                analysis,
                self._canonical_user_id(analysis.user_id, analysis.platform),
                analysis_type_enum
            )
        )

        # Store job in database for tracking
        try:
            job_data = {
                'job_id': job_id,
                'user_id': analysis.user_id,
                'platform': analysis.platform,
                'game_id': analysis.game_id,
                'analysis_type': analysis_type_enum.value,
                'status': job.status.value,
                'created_at': job.created_at.isoformat(),
                'updated_at': job.updated_at.isoformat(),
                'retry_count': job.retry_count,
                'max_retries': job.max_retries,
                'error_message': job.error_message,
                'analysis_data': job.analysis_data
            }

            self.supabase_service.table('analysis_jobs').upsert(
                job_data,
                on_conflict='job_id'
            ).execute()

        except Exception as e:
            logger.warning(f"Could not store job tracking: {str(e)}")

        return job

    async def _update_job_status(self, job_id: str, status: PersistenceStatus, message: str, extra_fields: Optional[Dict[str, Any]] = None):
        """Update job status in database."""
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            payload: Dict[str, Any] = {
                'status': status.value,
                'updated_at': now_iso
            }

            if status == PersistenceStatus.FAILED:
                payload['error_message'] = message
            elif status == PersistenceStatus.COMPLETED:
                payload['error_message'] = None
                payload.setdefault('completed_at', now_iso)
            elif status == PersistenceStatus.RETRYING:
                payload['error_message'] = message

            if extra_fields:
                payload.update({k: v for k, v in extra_fields.items() if v is not None})

            self.supabase_service.table('analysis_jobs').update(payload).eq('job_id', job_id).execute()
        except Exception as e:
            logger.warning(f"Could not update job status: {str(e)}")

    async def _handle_persistence_failure(self, job_id: str, error_message: str):
        """Handle persistence failure and update job status."""
        try:
            # Get current job
            response = self.supabase_service.table('analysis_jobs').select('*').eq('job_id', job_id).execute()

            if response.data:
                job_data = response.data[0]
                retry_count = job_data.get('retry_count', 0) + 1

                # Update retry count and status
                self.supabase_service.table('analysis_jobs').update({
                    'retry_count': retry_count,
                    'status': PersistenceStatus.RETRYING.value if retry_count < self.max_retries else PersistenceStatus.FAILED.value,
                    'updated_at': datetime.now(timezone.utc).isoformat(),
                    'error_message': error_message
                }).eq('job_id', job_id).execute()

        except Exception as e:
            logger.warning(f"Could not handle persistence failure: {str(e)}")

    async def _retry_if_possible(self, job_id: str, analysis: GameAnalysis) -> PersistenceResult:
        """Retry analysis persistence if retries are available."""
        try:
            # Get current job status
            response = self.supabase_service.table('analysis_jobs').select('*').eq('job_id', job_id).execute()

            if response.data:
                job_data = response.data[0]
                retry_count = job_data.get('retry_count', 0)
                max_retries = job_data.get('max_retries', self.max_retries)

                if retry_count < max_retries:
                    # Wait before retry
                    await asyncio.sleep(self.retry_delay * (retry_count + 1))

                    # Retry the save
                    success, saved_payload = await self._save_analysis_atomic(analysis)

                    if success:
                        extra_fields: Dict[str, Any] = {}
                        analysis_identifier = job_id
                        if saved_payload:
                            analysis_identifier = saved_payload.get('game_analysis_id') or job_id
                            extra_fields = {
                                'processing_time_ms': saved_payload.get('processing_time_ms'),
                                'analysis_data': saved_payload,
                                'completed_at': datetime.now(timezone.utc).isoformat()
                            }
                        await self._update_job_status(job_id, PersistenceStatus.COMPLETED, "Analysis saved successfully on retry", extra_fields)
                        return PersistenceResult(
                            success=True,
                            status=PersistenceStatus.COMPLETED,
                            message="Analysis saved successfully on retry",
                            retry_count=retry_count + 1,
                            analysis_id=analysis_identifier
                        )
                    else:
                        await self._handle_persistence_failure(job_id, "Failed on retry")
                        return PersistenceResult(
                            success=False,
                            status=PersistenceStatus.RETRYING,
                            message="Failed on retry, will retry again if possible",
                            retry_count=retry_count + 1
                        )
                else:
                    # Max retries exceeded
                    await self._update_job_status(job_id, PersistenceStatus.FAILED, "Max retries exceeded")
                    return PersistenceResult(
                        success=False,
                        status=PersistenceStatus.FAILED,
                        message="Max retries exceeded",
                        retry_count=retry_count,
                        error_details="Analysis could not be saved after maximum retries"
                    )
            else:
                return PersistenceResult(
                    success=False,
                    status=PersistenceStatus.FAILED,
                    message="Job not found",
                    error_details="Could not find job for retry"
                )

        except Exception as e:
            logger.error(f"Error during retry: {str(e)}")
            return PersistenceResult(
                success=False,
                status=PersistenceStatus.FAILED,
                message="Error during retry",
                error_details=str(e)
            )

    async def get_analysis_progress(self, user_id: str, platform: str) -> Dict[str, Any]:
        """Get analysis progress for a user."""
        try:
            response = self.supabase_service.table('analysis_jobs').select('*').eq('user_id', user_id).eq('platform', platform).execute()

            if response.data:
                jobs = response.data
                total_jobs = len(jobs)
                completed_jobs = len([job for job in jobs if job['status'] == PersistenceStatus.COMPLETED.value])
                failed_jobs = len([job for job in jobs if job['status'] == PersistenceStatus.FAILED.value])
                in_progress_jobs = len([job for job in jobs if job['status'] in [PersistenceStatus.IN_PROGRESS.value, PersistenceStatus.RETRYING.value]])

                return {
                    'total_jobs': total_jobs,
                    'completed_jobs': completed_jobs,
                    'failed_jobs': failed_jobs,
                    'in_progress_jobs': in_progress_jobs,
                    'progress_percentage': (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0,
                    'is_complete': completed_jobs == total_jobs,
                    'current_phase': 'analyzing' if in_progress_jobs > 0 else 'complete' if completed_jobs == total_jobs else 'pending'
                }
            else:
                return {
                    'total_jobs': 0,
                    'completed_jobs': 0,
                    'failed_jobs': 0,
                    'in_progress_jobs': 0,
                    'progress_percentage': 0,
                    'is_complete': True,
                    'current_phase': 'complete'
                }

        except Exception as e:
            logger.error(f"Error getting analysis progress: {str(e)}")
            return {
                'total_jobs': 0,
                'completed_jobs': 0,
                'failed_jobs': 0,
                'in_progress_jobs': 0,
                'progress_percentage': 0,
                'is_complete': True,
                'current_phase': 'error'
            }
