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
    """Get Supabase client."""
    config = get_config()
    return create_client(config.database.url, config.database.anon_key)

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
    depth = game_data.get('depth', 8)
    skill_level = game_data.get('skill_level', 8)
    
    print(f"[Game {game_id}] Starting parallel analysis at {datetime.now().strftime('%H:%M:%S.%f')[:-3]} (PID: {os.getpid()})")
    
    try:
        # Create engine in this process
        engine = ChessAnalysisEngine()
        
        # Configure analysis with environment-aware settings
        analysis_type_enum = AnalysisType(analysis_type)
        
        # Use environment-aware depth and skill level
        app_env = os.getenv('APP_ENV', 'production').lower()
        effective_depth = 6 if app_env == 'dev' else (depth or 8)
        effective_skill = 6 if app_env == 'dev' else (skill_level or 8)
        
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
            'error': str(e)
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
            # Dynamic worker count: max(1, min(3, cpu_count // 2))
            # This prevents CPU saturation while maintaining good performance
            cpu_count = os.cpu_count() or 4
            self.max_workers = max(1, min(3, cpu_count // 2))
        else:
            self.max_workers = max_workers
        self.supabase = get_supabase_client()
        
    async def analyze_games_parallel(
        self,
        user_id: str,
        platform: str,
        analysis_type: str = "stockfish",
        limit: int = 10,
        depth: int = 8,
        skill_level: int = 8,
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
        """Fetch games from database."""
        try:
            # Canonicalize user ID for database operations
            canonical_user_id = user_id.lower().strip()
            
            # Get games from database (games_pgn table) ordered by most recent first
            games_response = self.supabase.table('games_pgn').select('*').eq('user_id', canonical_user_id).eq('platform', platform).order('updated_at', desc=True).limit(limit).execute()
            games = games_response.data or []
            
            return games
        except Exception as e:
            print(f"Error fetching games: {e}")
            return []
    
    async def _analyze_games_parallel(self, game_data_list: List[Dict[str, Any]], progress_callback=None) -> List[Dict[str, Any]]:
        """Analyze games in parallel using ProcessPoolExecutor."""
        results = []
        
        print(f"PARALLEL PROCESSING: Starting with {len(game_data_list)} games using {self.max_workers} workers")
        
        # Use ProcessPoolExecutor for true parallel processing
        print(f"Starting ProcessPoolExecutor with {self.max_workers} workers...")
        try:
            with ProcessPoolExecutor(max_workers=self.max_workers) as executor:
                # Submit all tasks
                print(f"Submitting {len(game_data_list)} tasks to ProcessPoolExecutor...")
                future_to_game = {
                    executor.submit(analyze_game_worker, game_data): game_data 
                    for game_data in game_data_list
                }
                print(f"All {len(future_to_game)} tasks submitted successfully")
                
                # Collect results as they complete
                print(f"Waiting for {len(future_to_game)} tasks to complete...")
                completed_count = 0
                for future in as_completed(future_to_game):
                    try:
                        result = future.result()
                        results.append(result)
                        completed_count += 1
                        print(f"Task completed: {result.get('game_id', 'unknown')} - Success: {result.get('success', False)} ({completed_count}/{len(future_to_game)})")
                        
                        # Update progress if callback provided
                        if progress_callback:
                            progress_percentage = 20 + int((completed_count / len(future_to_game)) * 70)  # 20-90%
                            progress_callback(completed_count, len(future_to_game), progress_percentage)
                            # Add a small delay to make progress more visible
                            import time
                            time.sleep(0.5)
                            
                    except Exception as e:
                        game_data = future_to_game[future]
                        completed_count += 1
                        print(f"Error analyzing game {game_data['id']}: {e}")
                        results.append({
                            'game_id': game_data['id'],
                            'success': False,
                            'error': str(e)
                        })
                        
                        # Update progress even for failed games
                        if progress_callback:
                            progress_percentage = 20 + int((completed_count / len(future_to_game)) * 70)  # 20-90%
                            progress_callback(completed_count, len(future_to_game), progress_percentage)
        except Exception as e:
            print(f"ProcessPoolExecutor failed: {e}")
            import traceback
            traceback.print_exc()
            # Fallback to sequential processing
            print("Falling back to sequential processing...")
            for i, game_data in enumerate(game_data_list):
                try:
                    result = analyze_game_worker(game_data)
                    results.append(result)
                    completed_count = i + 1
                    print(f"Sequential task completed: {result.get('game_id', 'unknown')} - Success: {result.get('success', False)} ({completed_count}/{len(game_data_list)})")
                    
                    # Update progress if callback provided
                    if progress_callback:
                        progress_percentage = 20 + int((completed_count / len(game_data_list)) * 70)  # 20-90%
                        progress_callback(completed_count, len(game_data_list), progress_percentage)
                        
                except Exception as e:
                    print(f"Error in sequential analysis of game {game_data['id']}: {e}")
                    results.append({
                        'game_id': game_data['id'],
                        'success': False,
                        'error': str(e)
                    })
        
        return results
