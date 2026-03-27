"""
Opening Repertoire Analyzer
Analyzes user's opening repertoire, detects deviations, and provides drill positions
for the Coach feature's Opening Repertoire Trainer.
"""

import asyncio
import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict

logger = logging.getLogger(__name__)


class OpeningRepertoireAnalyzer:
    """Analyzes and tracks a user's opening repertoire with spaced repetition."""

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    async def analyze_repertoire(
        self,
        user_id: str,
        platform: str,
        canonical_user_id: str
    ) -> List[Dict[str, Any]]:
        """
        Analyze the user's full opening repertoire from their games.

        Args:
            user_id: Auth UUID for saving to opening_repertoire table
            platform: 'lichess' or 'chess.com'
            canonical_user_id: Platform username for querying games

        Returns:
            List of repertoire entries with stats per opening+color
        """
        from .opening_utils import normalize_opening_name

        try:
            # 1. Fetch games with opening info (include opening_family as ECO fallback)
            games_result = await asyncio.to_thread(
                lambda: self.supabase.table('games')
                .select('id, provider_game_id, opening, opening_family, result, color, my_rating, opponent_rating')
                .eq('user_id', canonical_user_id)
                .eq('platform', platform)
                .order('played_at', desc=True)
                .limit(5000)
                .execute()
            )
            games = games_result.data or []

            if not games:
                return []

            # 2. Get provider game IDs for accuracy lookup
            # game_analyses.game_id stores provider_game_id, not UUID
            provider_ids = [g['provider_game_id'] for g in games if g.get('provider_game_id')]

            # Fetch accuracy data from game_analyses in batches
            accuracy_map: Dict[str, float] = {}
            batch_size = 100
            for i in range(0, len(provider_ids), batch_size):
                batch = provider_ids[i:i + batch_size]
                analysis_result = await asyncio.to_thread(
                    lambda b=batch: self.supabase.table('game_analyses')
                    .select('game_id, accuracy')
                    .in_('game_id', b)
                    .execute()
                )
                for row in (analysis_result.data or []):
                    if row.get('accuracy') is not None:
                        accuracy_map[row['game_id']] = row['accuracy']

            # 3. Group by opening family + color
            opening_stats: Dict[str, Dict[str, Any]] = defaultdict(
                lambda: {
                    'games_played': 0,
                    'wins': 0,
                    'losses': 0,
                    'draws': 0,
                    'accuracies': [],
                    'ratings': [],
                }
            )

            for game in games:
                opening = game.get('opening') or ''
                opening_fam = game.get('opening_family') or ''
                color = game.get('color', 'white')
                result = game.get('result', '')

                # Try full opening name first, then ECO code fallback
                family = normalize_opening_name(opening) if opening else 'Unknown'
                if family == 'Unknown' and opening_fam:
                    family = normalize_opening_name(opening_fam)
                if family == 'Unknown':
                    continue

                key = f"{family}|{color}"
                stats = opening_stats[key]
                stats['games_played'] += 1

                if result == 'win':
                    stats['wins'] += 1
                elif result == 'loss':
                    stats['losses'] += 1
                else:
                    stats['draws'] += 1

                pgid = game.get('provider_game_id', '')
                if pgid in accuracy_map:
                    stats['accuracies'].append(accuracy_map[pgid])

                if game.get('my_rating'):
                    stats['ratings'].append(game['my_rating'])

            # 4. Build repertoire entries and upsert
            repertoire_entries = []
            for key, stats in opening_stats.items():
                family, color = key.split('|')

                if stats['games_played'] < 2:
                    continue

                win_rate = (stats['wins'] / stats['games_played'] * 100) if stats['games_played'] > 0 else 0
                avg_accuracy = (sum(stats['accuracies']) / len(stats['accuracies'])) if stats['accuracies'] else None

                # Confidence: logarithmic scaling so it doesn't instantly max out
                # ~20 games → 43, ~50 games → 56, ~100 games → 66, ~500 games → 90
                games_component = min(70, 10 * math.log2(stats['games_played'] + 1))
                win_rate_component = max(0, (win_rate - 40) * 0.5)  # 0-30 range
                accuracy_component = ((avg_accuracy - 50) * 0.2) if avg_accuracy and avg_accuracy > 50 else 0
                confidence = min(100, games_component + win_rate_component + accuracy_component)
                confidence = max(0, confidence)

                entry = {
                    'user_id': user_id,
                    'platform': platform,
                    'opening_family': family,
                    'color': color,
                    'games_played': stats['games_played'],
                    'win_rate': round(win_rate, 1),
                    'avg_accuracy': round(avg_accuracy, 1) if avg_accuracy else None,
                    'confidence_level': round(confidence, 1),
                    'last_practiced': datetime.now(timezone.utc).isoformat(),
                }

                repertoire_entries.append(entry)

            # 5. Upsert to database
            if repertoire_entries:
                await asyncio.to_thread(
                    lambda: self.supabase.table('opening_repertoire')
                    .upsert(
                        repertoire_entries,
                        on_conflict='user_id,platform,opening_family,color'
                    )
                    .execute()
                )

            logger.info(f"[REPERTOIRE] Analyzed {len(repertoire_entries)} openings from {len(games)} games for {canonical_user_id}")
            return repertoire_entries

        except Exception as e:
            logger.error(f"[REPERTOIRE] Error analyzing repertoire: {e}", exc_info=True)
            raise

    async def get_repertoire(
        self,
        user_id: str,
        platform: str
    ) -> List[Dict[str, Any]]:
        """Get stored repertoire for a user. Platform can be 'all' to get both."""
        try:
            query = self.supabase.table('opening_repertoire').select('*').eq('user_id', user_id)
            if platform != 'all':
                query = query.eq('platform', platform)
            result = await asyncio.to_thread(
                lambda: query.order('games_played', desc=True).execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"[REPERTOIRE] Error getting repertoire: {e}", exc_info=True)
            return []

    async def get_opening_detail(
        self,
        user_id: str,
        platform: str,
        canonical_user_id: str,
        opening_family: str,
        color: str
    ) -> Dict[str, Any]:
        """
        Get detailed analysis for a specific opening including deviation analysis.

        Returns:
            Dict with repertoire stats, recent games, and deviation points
        """
        from .opening_utils import normalize_opening_name

        try:
            # Get repertoire entry
            rep_result = await asyncio.to_thread(
                lambda: self.supabase.table('opening_repertoire')
                .select('*')
                .eq('user_id', user_id)
                .eq('platform', platform)
                .eq('opening_family', opening_family)
                .eq('color', color)
                .execute()
            )
            repertoire = rep_result.data[0] if rep_result.data else None

            # Get recent games with this opening
            games_result = await asyncio.to_thread(
                lambda: self.supabase.table('games')
                .select('id, provider_game_id, opening, opening_family, result, color, my_rating, opponent_rating, played_at')
                .eq('user_id', canonical_user_id)
                .eq('platform', platform)
                .eq('color', color)
                .order('played_at', desc=True)
                .limit(200)
                .execute()
            )

            # Filter to matching opening family (same fallback logic as analyze_repertoire)
            matching_games = []
            for game in (games_result.data or []):
                opening_name = game.get('opening') or ''
                opening_eco = game.get('opening_family') or ''
                family = normalize_opening_name(opening_name) if opening_name else 'Unknown'
                if family == 'Unknown' and opening_eco:
                    family = normalize_opening_name(opening_eco)
                if family == opening_family:
                    matching_games.append(game)

            # Get PGN data for deviation analysis (last 20 games)
            recent_provider_ids = [g['provider_game_id'] for g in matching_games[:20] if g.get('provider_game_id')]
            move_sequences = []

            if recent_provider_ids:
                pgn_result = await asyncio.to_thread(
                    lambda: self.supabase.table('games_pgn')
                    .select('provider_game_id, pgn')
                    .eq('user_id', canonical_user_id)
                    .eq('platform', platform)
                    .in_('provider_game_id', recent_provider_ids)
                    .execute()
                )

                for row in (pgn_result.data or []):
                    moves = self._extract_opening_moves(row.get('pgn', ''), max_moves=15)
                    if moves:
                        move_sequences.append({
                            'game_id': row['provider_game_id'],
                            'moves': moves
                        })

            # Deviation analysis
            deviations = self._find_deviations(move_sequences) if move_sequences else []

            return {
                'repertoire': repertoire,
                'recent_games': matching_games[:10],
                'total_games': len(matching_games),
                'deviations': deviations,
            }

        except Exception as e:
            logger.error(f"[REPERTOIRE] Error getting opening detail: {e}", exc_info=True)
            raise

    async def get_drill_positions(
        self,
        user_id: str,
        platform: str,
        canonical_user_id: str,
        opening_family: str,
        color: str
    ) -> List[Dict[str, Any]]:
        """
        Get drill positions for practicing an opening.
        Returns positions where the user commonly deviates or makes mistakes.
        """
        from .opening_utils import normalize_opening_name

        try:
            # Get games with this opening
            games_result = await asyncio.to_thread(
                lambda: self.supabase.table('games')
                .select('id, provider_game_id, opening, opening_family, color')
                .eq('user_id', canonical_user_id)
                .eq('platform', platform)
                .eq('color', color)
                .order('played_at', desc=True)
                .limit(50)
                .execute()
            )

            # move_analyses.game_id stores provider_game_id, not UUID
            matching_ids = []
            for game in (games_result.data or []):
                opening_name = game.get('opening') or ''
                opening_eco = game.get('opening_family') or ''
                family = normalize_opening_name(opening_name) if opening_name else 'Unknown'
                if family == 'Unknown' and opening_eco:
                    family = normalize_opening_name(opening_eco)
                if family == opening_family and game.get('provider_game_id'):
                    matching_ids.append(game['provider_game_id'])

            if not matching_ids:
                return []

            # Get move analyses for opening phase (first 15 moves)
            batch = matching_ids[:20]
            moves_result = await asyncio.to_thread(
                lambda: self.supabase.table('move_analyses')
                .select('game_id, move_number, fen_before, move_san, classification, is_white')
                .in_('game_id', batch)
                .lte('move_number', 15)
                .order('move_number')
                .execute()
            )

            # Find positions where user made mistakes/inaccuracies in the opening
            drill_positions = []
            seen_fens = set()

            for move in (moves_result.data or []):
                classification = move.get('classification', '')
                is_user_move = (
                    (color == 'white' and move.get('is_white')) or
                    (color == 'black' and not move.get('is_white'))
                )

                if not is_user_move:
                    continue
                if classification not in ('mistake', 'inaccuracy', 'blunder'):
                    continue

                fen = move.get('fen_before', '')
                if not fen or fen in seen_fens:
                    continue
                seen_fens.add(fen)

                drill_positions.append({
                    'fen': fen,
                    'move_number': move.get('move_number'),
                    'your_move': move.get('move_san', ''),
                    'classification': classification,
                    'description': f"Move {move.get('move_number')}: You played {move.get('move_san', '?')} ({classification})",
                })

                if len(drill_positions) >= 8:
                    break

            # Fallback: generate drill positions from PGN key moments
            if not drill_positions:
                drill_positions = await self._generate_pgn_drill_positions(
                    canonical_user_id, platform, matching_ids[:20], color
                )

            return drill_positions

        except Exception as e:
            logger.error(f"[REPERTOIRE] Error getting drill positions: {e}", exc_info=True)
            return []

    async def _generate_pgn_drill_positions(
        self,
        canonical_user_id: str,
        platform: str,
        provider_ids: List[str],
        color: str
    ) -> List[Dict[str, Any]]:
        """
        Generate drill positions from PGN data by replaying moves.
        Picks key decision points in the opening (user's moves at moves 3-12).
        """
        try:
            import chess

            if not provider_ids:
                return []

            pgn_result = await asyncio.to_thread(
                lambda: self.supabase.table('games_pgn')
                .select('provider_game_id, pgn')
                .eq('user_id', canonical_user_id)
                .eq('platform', platform)
                .in_('provider_game_id', provider_ids)
                .limit(10)
                .execute()
            )

            if not pgn_result.data:
                return []

            # Collect positions from multiple games at key decision points
            drill_positions = []
            seen_fens = set()

            for row in pgn_result.data:
                moves = self._extract_opening_moves(row.get('pgn', ''), max_moves=12)
                if len(moves) < 6:
                    continue

                # Replay moves to get FEN at each position
                board = chess.Board()
                for i, move_san in enumerate(moves):
                    try:
                        move = board.parse_san(move_san)
                    except (chess.InvalidMoveError, chess.AmbiguousMoveError):
                        break

                    move_number = (i // 2) + 1
                    is_user_move = (
                        (color == 'white' and i % 2 == 0) or
                        (color == 'black' and i % 2 == 1)
                    )

                    # Pick user's moves from move 3 onwards as drill points
                    if is_user_move and move_number >= 3:
                        fen = board.fen()
                        fen_key = fen.split(' ')[0]  # Position only, ignore move counters
                        if fen_key not in seen_fens:
                            seen_fens.add(fen_key)
                            drill_positions.append({
                                'fen': fen,
                                'move_number': move_number,
                                'your_move': move_san,
                                'classification': 'recall',
                                'description': f"Move {move_number}: What did you play here?",
                            })

                    board.push(move)

                if len(drill_positions) >= 8:
                    break

            return drill_positions[:8]

        except Exception as e:
            logger.error(f"[REPERTOIRE] Error generating PGN drill positions: {e}", exc_info=True)
            return []

    async def update_spaced_repetition(
        self,
        user_id: str,
        repertoire_id: str,
        confidence_delta: float
    ) -> Dict[str, Any]:
        """
        Update spaced repetition schedule after a drill.
        Positive delta = user performed well, increase interval.
        Negative delta = user struggled, decrease interval.
        """
        try:
            # Get current entry
            result = await asyncio.to_thread(
                lambda: self.supabase.table('opening_repertoire')
                .select('*')
                .eq('id', repertoire_id)
                .eq('user_id', user_id)
                .execute()
            )

            if not result.data:
                raise ValueError("Repertoire entry not found")

            entry = result.data[0]
            current_confidence = entry.get('confidence_level', 50)

            # Update confidence (clamp 0-100)
            new_confidence = max(0, min(100, current_confidence + confidence_delta))

            # Calculate next review date based on confidence
            if new_confidence >= 80:
                days_until_review = 14
            elif new_confidence >= 60:
                days_until_review = 7
            elif new_confidence >= 40:
                days_until_review = 3
            else:
                days_until_review = 1

            next_review = datetime.now(timezone.utc) + timedelta(days=days_until_review)

            # Update
            update_data = {
                'confidence_level': round(new_confidence, 1),
                'spaced_repetition_due': next_review.isoformat(),
                'last_practiced': datetime.now(timezone.utc).isoformat(),
            }

            await asyncio.to_thread(
                lambda: self.supabase.table('opening_repertoire')
                .update(update_data)
                .eq('id', repertoire_id)
                .execute()
            )

            return {
                'confidence_level': new_confidence,
                'next_review': next_review.isoformat(),
                'days_until_review': days_until_review,
            }

        except Exception as e:
            logger.error(f"[REPERTOIRE] Error updating spaced repetition: {e}", exc_info=True)
            raise

    def _extract_opening_moves(self, pgn_text: str, max_moves: int = 15) -> List[str]:
        """Extract the first N moves from PGN text as a list of SAN moves."""
        if not pgn_text:
            return []

        try:
            # Remove headers
            lines = pgn_text.strip().split('\n')
            movetext = ''
            for line in lines:
                if not line.startswith('['):
                    movetext += ' ' + line

            # Parse moves
            import re
            movetext = re.sub(r'\{[^}]*\}', '', movetext)  # Remove comments
            movetext = re.sub(r'\([^)]*\)', '', movetext)   # Remove variations
            movetext = re.sub(r'\d+\.\.\.', '', movetext)   # Remove continuation dots

            tokens = movetext.split()
            moves = []
            for token in tokens:
                token = token.strip()
                if not token:
                    continue
                # Skip move numbers like "1." or "1..."
                if re.match(r'^\d+\.$', token):
                    continue
                # Skip result tokens
                if token in ('1-0', '0-1', '1/2-1/2', '*'):
                    continue
                moves.append(token)
                if len(moves) >= max_moves * 2:  # max_moves per side
                    break

            return moves

        except Exception:
            return []

    def _find_deviations(self, move_sequences: List[Dict]) -> List[Dict[str, Any]]:
        """
        Find points where the user deviates from their most common line.
        Compares move sequences to find the most common continuation at each position.
        """
        if not move_sequences or len(move_sequences) < 3:
            return []

        # Build a move tree
        # tree[move_index] = {move_san: count}
        move_tree: Dict[int, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

        for seq in move_sequences:
            for i, move in enumerate(seq['moves']):
                move_tree[i][move] += 1

        deviations = []
        total_games = len(move_sequences)

        for move_idx in sorted(move_tree.keys()):
            moves_at_position = move_tree[move_idx]
            if len(moves_at_position) <= 1:
                continue  # No deviation if everyone plays the same move

            most_common = max(moves_at_position, key=moves_at_position.get)
            most_common_count = moves_at_position[most_common]
            most_common_pct = most_common_count / total_games * 100

            # Only flag if there's a clear main line (>50%) and deviations exist
            if most_common_pct < 50:
                continue

            for move, count in moves_at_position.items():
                if move == most_common:
                    continue
                deviation_pct = count / total_games * 100
                if deviation_pct >= 10:  # At least 10% of games deviate
                    move_number = (move_idx // 2) + 1
                    deviations.append({
                        'move_number': move_number,
                        'expected_move': most_common,
                        'actual_move': move,
                        'expected_frequency': round(most_common_pct, 1),
                        'deviation_frequency': round(deviation_pct, 1),
                        'games_with_deviation': count,
                    })

            if len(deviations) >= 5:
                break

        return deviations
