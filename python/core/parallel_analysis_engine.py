#!/usr/bin/env python3
"""
Parallel analysis engine using multiprocessing for true parallel game analysis.
"""

import asyncio
import multiprocessing
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from concurrent.futures import ProcessPoolExecutor, as_completed

from .analysis_engine import ChessAnalysisEngine, AnalysisType, AnalysisConfig
from .config import get_config
from supabase import create_client, Client

def get_supabase_client() -> Client:
    """Get Supabase client with service role permissions."""
    config = get_config()
    # Use service role key for backend operations that need full database access
    return create_client(config.database.url, config.database.service_role_key)

async def _save_analysis_to_database(analysis, analysis_type_enum):
    """Save analysis results to database."""
    try:
        from .unified_api_server import _save_stockfish_analysis

        # Save analysis to move_analyses table (all analysis types now use Stockfish)
        return await _save_stockfish_analysis(analysis)
    except Exception as e:
        print(f"Error saving analysis to database: {e}")
        return False

def analyze_game_worker(game_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Worker function for parallel analysis - runs in separate process.
    This is the same function we used in our test scripts.
    """
    game_id = game_data['id']
    user_id = game_data['user_id']
    platform = game_data['platform']
    pgn = game_data['pgn']
    analysis_type = game_data.get('analysis_type', 'stockfish')
    depth = game_data.get('depth', 14)
    skill_level = game_data.get('skill_level', 20)

    print(f"[Game {game_id}] Starting parallel analysis at {datetime.now().strftime('%H:%M:%S.%f')[:-3]} (PID: {os.getpid()})")

    try:
        # Create engine in this process with config stockfish path
        from .config import get_config
        config = get_config()
        engine = ChessAnalysisEngine(stockfish_path=config.stockfish.path)

        # Configure analysis with environment-aware settings
        analysis_type_enum = AnalysisType(analysis_type)

        # Use environment-aware depth and skill level
        app_env = os.getenv('APP_ENV', 'production').lower()
        effective_depth = 6 if app_env == 'dev' else (depth or 14)
        effective_skill = 6 if app_env == 'dev' else (skill_level or 20)

        config = AnalysisConfig(
            analysis_type=analysis_type_enum,
            depth=effective_depth,
            skill_level=effective_skill
        )
        engine.config = config

        # Validate PGN before analysis
        if not pgn or len(pgn.strip()) < 50 or '1.' not in pgn:
            result = {
                'game_id': game_id,
                'success': False,
                'error': f'Invalid PGN: too short or no moves (length: {len(pgn) if pgn else 0})'
            }
            print(f"Warning: [Game {game_id}] Skipped - Invalid PGN")
            return result

        # Run analysis (this is synchronous within the worker)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        analysis = loop.run_until_complete(
            engine.analyze_game(
                game_id=game_id,
                user_id=user_id,
                platform=platform,
                pgn=pgn,
                analysis_type=analysis_type_enum
            )
        )

        if analysis:
            # Save analysis to database
            save_success = loop.run_until_complete(_save_analysis_to_database(analysis, analysis_type_enum))

            result = {
                'game_id': game_id,
                'success': True,
                'analysis': {
                    'accuracy': analysis.accuracy,
                    'blunders': analysis.blunders,
                    'mistakes': analysis.mistakes,
                    'inaccuracies': analysis.inaccuracies,
                    'best_moves': analysis.best_moves,
                    'total_moves': analysis.total_moves,
                    'processing_time_ms': analysis.processing_time_ms
                },
                'saved_to_db': save_success
            }
            print(f"[Game {game_id}] Completed - Accuracy: {analysis.accuracy:.1f}% at {datetime.now().strftime('%H:%M:%S.%f')[:-3]} (PID: {os.getpid()})")
            if save_success:
                print(f"   Saved to database successfully")
            else:
                print(f"   Failed to save to database")
        else:
            result = {
                'game_id': game_id,
                'success': False,
                'error': 'Analysis returned None'
            }
            print(f"[Game {game_id}] Failed - No analysis result")

        loop.close()

    except Exception as e:
        result = {
            'game_id': game_id,
            'success': False,
            'message': str(e)
        }
        print(f"[Game {game_id}] Error: {e}")

    return result

class ParallelAnalysisEngine:
    """
    Parallel analysis engine that uses multiprocessing for true parallel game analysis.
    """

    def __init__(self, max_workers: int = None):
        """
        Initialize parallel analysis engine.

        Args:
            max_workers: Maximum number of parallel processes. If None, auto-calculates based on CPU count.
        """
        if max_workers is None:
            # Dynamic worker count optimized for Railway Hobby tier
            # Hobby tier has 8 vCPU, so we can use more workers for better performance
            cpu_count = os.cpu_count() or 4
            self.max_workers = max(1, min(6, cpu_count))  # Up to 6 workers for Railway Hobby tier
        else:
            self.max_workers = max_workers
        self.supabase = get_supabase_client()

    async def analyze_games_parallel(
        self,
        user_id: str,
        platform: str,
        analysis_type: str = "stockfish",
        limit: int = 5,
        depth: int = 14,
        skill_level: int = 20,
        progress_callback=None
    ) -> Dict[str, Any]:
        """
        Analyze multiple games in parallel using multiprocessing.

        Args:
            user_id: User ID to analyze games for
            platform: Platform (lichess or chess.com)
            analysis_type: Type of analysis (stockfish, deep)
            limit: Maximum number of games to analyze
            depth: Stockfish depth
            skill_level: Stockfish skill level

        Returns:
            Dictionary with analysis results and statistics
        """
        print(f"PARALLEL ANALYSIS: Starting analysis for {user_id} on {platform}")
        print(f"   Max workers: {self.max_workers}")
        print(f"   Analysis type: {analysis_type}")
        print(f"   Limit: {limit}")

        start_time = datetime.now()

        # Update progress to "fetching" phase before starting
        if progress_callback:
            try:
                progress_callback(0, 0, 0)  # Signal that we're starting to fetch
            except Exception as e:
                print(f"[PARALLEL ENGINE] Warning: Could not update progress at fetch start: {e}")

        # Get games from database
        games = await self._fetch_games(user_id, platform, limit)

        if not games:
            return {
                'success': False,
                'message': f'No games found for {user_id} on {platform}',
                'total_games': 0,
                'analyzed_games': 0,
                'failed_games': 0,
                'total_time': 0
            }

        print(f"Found {len(games)} games to analyze")

        # Update progress with total games found - this moves us past "starting" phase
        if progress_callback:
            try:
                progress_callback(0, len(games), 0)  # Update total_games, phase will change to "analyzing"
            except Exception as e:
                print(f"[PARALLEL ENGINE] Warning: Could not update progress after fetch: {e}")

        # Prepare game data for parallel processing
        game_data_list = []
        for game in games:
            game_data_list.append({
                'id': game['provider_game_id'],
                'user_id': user_id,
                'platform': platform,
                'pgn': game['pgn'],
                'analysis_type': analysis_type,
                'depth': depth,
                'skill_level': skill_level
            })

        # Analyze games in parallel
        results = await self._analyze_games_parallel(game_data_list, progress_callback)

        end_time = datetime.now()
        total_time = (end_time - start_time).total_seconds()

        # Process results
        successful_analyses = [r for r in results if r['success']]
        failed_analyses = [r for r in results if not r['success']]

        # Calculate statistics
        if successful_analyses:
            total_accuracy = sum(r['analysis']['accuracy'] for r in successful_analyses)
            avg_accuracy = total_accuracy / len(successful_analyses)
            total_moves = sum(r['analysis']['total_moves'] for r in successful_analyses)
        else:
            avg_accuracy = 0
            total_moves = 0

        result = {
            'success': True,
            'message': f'Parallel analysis completed for {len(successful_analyses)}/{len(games)} games',
            'total_games': len(games),
            'analyzed_games': len(successful_analyses),
            'failed_games': len(failed_analyses),
            'average_accuracy': avg_accuracy,
            'total_moves_analyzed': total_moves,
            'total_time': total_time,
            'time_per_game': total_time / len(successful_analyses) if successful_analyses else 0,
            'speedup': (len(games) * 90) / total_time if total_time > 0 else 0,  # Assume 90s per game sequential
            'results': results
        }

        print(f"PARALLEL ANALYSIS COMPLETE:")
        print(f"   Total time: {total_time:.1f}s")
        print(f"   Games analyzed: {len(successful_analyses)}/{len(games)}")
        print(f"   Average accuracy: {avg_accuracy:.1f}%")
        print(f"   Speedup: {result['speedup']:.1f}x")

        return result

    async def _fetch_games(self, user_id: str, platform: str, limit: int) -> List[Dict[str, Any]]:
        """Fetch unanalyzed games from database ordered by played_at (most recent first)."""
        try:
            # Canonicalize user ID for database operations
            # Chess.com usernames are case-insensitive (lowercase)
            # Lichess usernames are case-sensitive (preserve case)
            if platform == "chess.com":
                canonical_user_id = user_id.strip().lower()
            else:  # lichess
                canonical_user_id = user_id.strip()

            # CRITICAL FIX: Use two-step approach to maintain chronological ordering
            # Step 1: Get game IDs from games table ordered by played_at (most recent first)
            # Step 2: Fetch PGN data for those games and maintain the order
            # Step 3: Filter out already-analyzed games
            # This ensures we always get the most recently PLAYED unanalyzed games

            # Fetch more games than needed to account for already-analyzed games
            fetch_limit = max(limit * 10, 100)
            print(f"[PARALLEL ENGINE] Fetching up to {fetch_limit} most recent games to find {limit} unanalyzed games for {user_id} on {platform}")

            # First get game IDs from games table ordered by played_at (most recent first)
            games_list_response = await asyncio.to_thread(
                lambda: self.supabase.table('games').select('provider_game_id, played_at').eq('user_id', canonical_user_id).eq('platform', platform).order('played_at', desc=True).limit(fetch_limit).execute()
            )

            if not games_list_response.data:
                print(f"[PARALLEL ENGINE] No games found in games table")
                return []

            # Get provider_game_ids in order with their played_at dates
            ordered_games = games_list_response.data
            provider_game_ids = [g['provider_game_id'] for g in ordered_games]
            print(f"[PARALLEL ENGINE] Found {len(provider_game_ids)} games in database (ordered by most recent)")

            # Now fetch PGN data for these games
            pgn_response = await asyncio.to_thread(
                lambda: self.supabase.table('games_pgn').select('*').eq('user_id', canonical_user_id).eq('platform', platform).in_('provider_game_id', provider_game_ids).execute()
            )

            if not pgn_response.data:
                print(f"[PARALLEL ENGINE] No PGN data found for games")
                return []

            # Re-order PGN data to match the games table order and add played_at info
            pgn_map = {g['provider_game_id']: g for g in pgn_response.data}
            all_games = []
            for game_info in ordered_games:
                provider_game_id = game_info['provider_game_id']
                if provider_game_id in pgn_map:
                    pgn_data = pgn_map[provider_game_id].copy()
                    pgn_data['played_at'] = game_info['played_at']  # Add played_at to PGN data
                    all_games.append(pgn_data)

            print(f"[PARALLEL ENGINE] Found {len(all_games)} games with PGN data (ordered by most recent played_at)")

            # Filter out already-analyzed games
            # Get game IDs that are already analyzed (from both move_analyses and game_analyses tables)
            analyzed_game_ids = set()

            try:
                # Check move_analyses table
                move_analyses_response = await asyncio.to_thread(
                    lambda: self.supabase.table('move_analyses').select('game_id').eq('user_id', canonical_user_id).eq('platform', platform).in_('game_id', provider_game_ids).execute()
                )
                if move_analyses_response.data:
                    analyzed_game_ids.update(row['game_id'] for row in move_analyses_response.data)

                # Check game_analyses table (unified_analyses might also be used)
                game_analyses_response = await asyncio.to_thread(
                    lambda: self.supabase.table('game_analyses').select('game_id').eq('user_id', canonical_user_id).eq('platform', platform).in_('game_id', provider_game_ids).execute()
                )
                if game_analyses_response.data:
                    analyzed_game_ids.update(row['game_id'] for row in game_analyses_response.data)

            except Exception as e:
                print(f"[PARALLEL ENGINE] Warning: Could not check analyzed games: {e}")
                # If we can't check, assume no games are analyzed to be safe
                analyzed_game_ids = set()

            # Filter out already analyzed games and return only up to limit unanalyzed games
            unanalyzed_games = []
            analyzed_count = 0
            for game in all_games:
                game_id = game.get('provider_game_id')
                if game_id:
                    if game_id in analyzed_game_ids:
                        analyzed_count += 1
                    else:
                        unanalyzed_games.append(game)
                        if len(unanalyzed_games) >= limit:
                            break

            print(f"[PARALLEL ENGINE] Found {len(unanalyzed_games)} unanalyzed games out of {len(all_games)} total games")
            print(f"[PARALLEL ENGINE] Skipped {analyzed_count} already-analyzed games from the fetched set")

            if unanalyzed_games:
                print(f"[PARALLEL ENGINE] First unanalyzed game played_at: {unanalyzed_games[0].get('played_at')} | provider_game_id: {unanalyzed_games[0].get('provider_game_id')}")
                if len(unanalyzed_games) > 1:
                    print(f"[PARALLEL ENGINE] Last unanalyzed game played_at: {unanalyzed_games[-1].get('played_at')} | provider_game_id: {unanalyzed_games[-1].get('provider_game_id')}")
            else:
                print(f"[PARALLEL ENGINE] No unanalyzed games found - all recent games have been analyzed already!")

            return unanalyzed_games
        except Exception as e:
            print(f"[PARALLEL ENGINE] Error fetching games: {e}")
            import traceback
            traceback.print_exc()
            return []

    async def _analyze_games_parallel(self, game_data_list: List[Dict[str, Any]], progress_callback=None) -> List[Dict[str, Any]]:
        """Analyze games in parallel using ProcessPoolExecutor with async execution to avoid blocking."""
        results = []

        print(f"PARALLEL PROCESSING: Starting with {len(game_data_list)} games using {self.max_workers} workers")

        # Use ProcessPoolExecutor for true parallel processing
        # CRITICAL FIX: Run ProcessPoolExecutor operations asynchronously to prevent blocking other API requests
        print(f"Starting ProcessPoolExecutor with {self.max_workers} workers...")
        try:
            # Get the current event loop
            loop = asyncio.get_event_loop()

            # Create executor
            executor = ProcessPoolExecutor(max_workers=self.max_workers)

            try:
                # Submit all tasks to ProcessPoolExecutor
                print(f"Submitting {len(game_data_list)} tasks to ProcessPoolExecutor...")
                concurrent_futures = {}

                for game_data in game_data_list:
                    # Submit to ProcessPoolExecutor
                    concurrent_future = executor.submit(analyze_game_worker, game_data)
                    concurrent_futures[concurrent_future] = game_data

                print(f"All {len(concurrent_futures)} tasks submitted successfully")

                # Collect results as they complete using polling with asyncio
                # This allows other async tasks (like API requests) to run concurrently
                print(f"Waiting for {len(concurrent_futures)} tasks to complete...")
                completed_count = 0
                total_tasks = len(concurrent_futures)

                # Poll futures asynchronously until all complete
                while concurrent_futures:
                    # Check which futures are done
                    done_futures = [f for f in concurrent_futures.keys() if f.done()]

                    for future in done_futures:
                        game_data = concurrent_futures.pop(future)
                        try:
                            # Get result in thread pool to avoid blocking
                            result = await loop.run_in_executor(None, future.result)
                            results.append(result)
                            completed_count += 1
                            print(f"[PARALLEL ENGINE] Task completed: {result.get('game_id', 'unknown')} - Success: {result.get('success', False)} ({completed_count}/{total_tasks})")

                            # Update progress if callback provided
                            if progress_callback:
                                try:
                                    progress_percentage = 20 + int((completed_count / total_tasks) * 70)  # 20-90%
                                    print(f"[PARALLEL ENGINE] Calling progress callback: {completed_count}/{total_tasks} ({progress_percentage}%)")
                                    progress_callback(completed_count, total_tasks, progress_percentage)
                                    print(f"[PARALLEL ENGINE] Progress callback completed successfully")
                                except Exception as callback_error:
                                    print(f"[PARALLEL ENGINE] ERROR in progress callback: {callback_error}")
                                    import traceback
                                    traceback.print_exc()
                        except Exception as e:
                            completed_count += 1
                            print(f"[PARALLEL ENGINE] Error getting result for game {game_data.get('id', 'unknown')}: {e}")
                            results.append({
                                'game_id': game_data.get('id', 'unknown'),
                                'success': False,
                                'message': str(e)
                            })

                            # Update progress even for failed games
                            if progress_callback:
                                try:
                                    progress_percentage = 20 + int((completed_count / total_tasks) * 70)  # 20-90%
                                    print(f"[PARALLEL ENGINE] Calling progress callback for failed game: {completed_count}/{total_tasks} ({progress_percentage}%)")
                                    progress_callback(completed_count, total_tasks, progress_percentage)
                                except Exception as callback_error:
                                    print(f"[PARALLEL ENGINE] ERROR in progress callback (failed game): {callback_error}")
                                    import traceback
                                    traceback.print_exc()

                    # If no futures completed, wait a bit before checking again
                    if not done_futures:
                        await asyncio.sleep(0.1)  # Poll every 100ms


            finally:
                # Clean up executor
                print("Shutting down ProcessPoolExecutor...")
                executor.shutdown(wait=False)

        except Exception as e:
            print(f"ProcessPoolExecutor failed: {e}")
            import traceback
            traceback.print_exc()
            # Fallback to sequential processing
            print("Falling back to sequential processing...")
            loop = asyncio.get_event_loop()
            for i, game_data in enumerate(game_data_list):
                try:
                    # Run worker in thread pool to avoid blocking the event loop
                    result = await loop.run_in_executor(None, analyze_game_worker, game_data)
                    results.append(result)
                    completed_count = i + 1
                    print(f"Sequential task completed: {result.get('game_id', 'unknown')} - Success: {result.get('success', False)} ({completed_count}/{len(game_data_list)})")

                    # Update progress if callback provided
                    if progress_callback:
                        progress_percentage = 20 + int((completed_count / len(game_data_list)) * 70)  # 20-90%
                        progress_callback(completed_count, len(game_data_list), progress_percentage)
                        # Yield control to event loop
                        await asyncio.sleep(0.05)

                except Exception as e:
                    print(f"Error in sequential analysis of game {game_data['id']}: {e}")
                    results.append({
                        'game_id': game_data['id'],
                        'success': False,
                        'message': str(e)
                    })

        return results
