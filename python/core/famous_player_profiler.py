#!/usr/bin/env python3
"""
Famous Player Profiler
Analyzes PGN collections of famous players to generate data-driven personality profiles.
"""

import json
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import chess.pgn
from io import StringIO

from .personality_scoring import PersonalityScorer


@dataclass
class FamousPlayerProfile:
    """Profile for a famous chess player with personality scores."""
    name: str
    era: str
    description: str
    strengths: List[str]
    games_analyzed: int
    profile: Dict[str, float]  # tactical, positional, aggressive, patient, novelty, staleness
    confidence: float
    metadata: Optional[Dict[str, Any]] = None


class FamousPlayerProfiler:
    """Generates personality profiles from PGN game collections."""

    def __init__(self):
        self.scorer = PersonalityScorer()

    def analyze_pgn_collection(self, pgn_content: str, player_name: str,
                              color_filter: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze a collection of PGN games for a specific player.

        Args:
            pgn_content: String containing PGN games
            player_name: Name of the player to analyze
            color_filter: Optional 'white' or 'black' to filter games by color

        Returns:
            Dictionary with aggregated personality scores and metadata
        """
        games_analyzed = 0
        total_moves = 0
        all_moves_data = []

        pgn_stream = StringIO(pgn_content)

        while True:
            game = chess.pgn.read_game(pgn_stream)
            if game is None:
                break

            # Check if this game involves the target player
            white_player = game.headers.get("White", "")
            black_player = game.headers.get("Black", "")

            if player_name.lower() not in white_player.lower() and \
               player_name.lower() not in black_player.lower():
                continue

            # Determine player's color
            player_color = None
            if player_name.lower() in white_player.lower():
                player_color = 'white'
            elif player_name.lower() in black_player.lower():
                player_color = 'black'

            # Apply color filter if specified
            if color_filter and player_color != color_filter:
                continue

            # Extract moves for analysis
            moves_data = self._extract_moves_from_game(game, player_color)
            if moves_data:
                all_moves_data.extend(moves_data)
                total_moves += len(moves_data)
                games_analyzed += 1

        if games_analyzed == 0 or total_moves == 0:
            return {
                'games_analyzed': 0,
                'total_moves': 0,
                'profile': {},
                'confidence': 0.0,
                'error': 'No games found for player'
            }

        # Calculate personality scores
        scores = self.scorer.calculate_scores(all_moves_data)

        # Calculate confidence based on sample size
        confidence = self._calculate_confidence(games_analyzed, total_moves)

        return {
            'games_analyzed': games_analyzed,
            'total_moves': total_moves,
            'profile': {
                'tactical': round(scores.tactical, 1),
                'positional': round(scores.positional, 1),
                'aggressive': round(scores.aggressive, 1),
                'patient': round(scores.patient, 1),
                'novelty': round(scores.novelty, 1),
                'staleness': round(scores.staleness, 1)
            },
            'confidence': confidence
        }

    def _extract_moves_from_game(self, game: chess.pgn.Game,
                                 player_color: str) -> List[Dict[str, Any]]:
        """
        Extract moves from a game for the specified player color.

        Note: This is a simplified extraction. In production, you'd want to:
        - Use Stockfish analysis for move classifications
        - Calculate centipawn loss
        - Mark best moves, mistakes, blunders

        For now, we'll extract basic move data.
        """
        moves_data = []
        board = game.board()
        ply_index = 0

        for move in game.mainline_moves():
            # Only include moves by the target player
            if (player_color == 'white' and ply_index % 2 == 0) or \
               (player_color == 'black' and ply_index % 2 == 1):

                san = board.san(move)

                # Basic move data (would need Stockfish analysis for accurate classification)
                move_data = {
                    'move_san': san,
                    'ply_index': ply_index,
                    'centipawn_loss': 0.0,  # Would need engine analysis
                    'is_best': False,  # Would need engine analysis
                    'is_blunder': False,
                    'is_mistake': False,
                    'is_inaccuracy': False,
                }
                moves_data.append(move_data)

            board.push(move)
            ply_index += 1

        return moves_data

    def _calculate_confidence(self, games_count: int, moves_count: int) -> float:
        """
        Calculate confidence score based on sample size.

        Confidence increases with more games and moves analyzed.
        - 100+ games, 2000+ moves: 90-95% confidence
        - 50-99 games, 1000+ moves: 80-89% confidence
        - 20-49 games, 500+ moves: 70-79% confidence
        - 10-19 games: 60-69% confidence
        - <10 games: 50-59% confidence
        """
        if games_count >= 100 and moves_count >= 2000:
            return 95.0
        elif games_count >= 75 and moves_count >= 1500:
            return 90.0
        elif games_count >= 50 and moves_count >= 1000:
            return 85.0
        elif games_count >= 30 and moves_count >= 600:
            return 80.0
        elif games_count >= 20 and moves_count >= 400:
            return 75.0
        elif games_count >= 10 and moves_count >= 200:
            return 70.0
        elif games_count >= 5:
            return 65.0
        else:
            return 60.0

    def create_player_profile(self, name: str, era: str, description: str,
                             strengths: List[str], profile_data: Dict[str, Any]) -> FamousPlayerProfile:
        """Create a FamousPlayerProfile from analysis results."""
        return FamousPlayerProfile(
            name=name,
            era=era,
            description=description,
            strengths=strengths,
            games_analyzed=profile_data['games_analyzed'],
            profile=profile_data['profile'],
            confidence=profile_data['confidence'],
            metadata={
                'total_moves': profile_data['total_moves']
            }
        )

    def save_profiles(self, profiles: List[FamousPlayerProfile], output_path: str):
        """Save profiles to JSON file."""
        profiles_dict = [asdict(profile) for profile in profiles]

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(profiles_dict, f, indent=2, ensure_ascii=False)

        print(f"Saved {len(profiles)} profiles to {output_path}")

    def load_profiles(self, input_path: str) -> List[FamousPlayerProfile]:
        """Load profiles from JSON file."""
        with open(input_path, 'r', encoding='utf-8') as f:
            profiles_dict = json.load(f)

        profiles = []
        for p in profiles_dict:
            profile = FamousPlayerProfile(
                name=p['name'],
                era=p['era'],
                description=p['description'],
                strengths=p['strengths'],
                games_analyzed=p['games_analyzed'],
                profile=p['profile'],
                confidence=p['confidence'],
                metadata=p.get('metadata')
            )
            profiles.append(profile)

        return profiles


def load_famous_player_database(database_path: str = None) -> List[Dict[str, Any]]:
    """
    Load famous player database from JSON file.

    Returns list of player dictionaries compatible with unified_api_server format.
    """
    if database_path is None:
        # Default path
        database_path = os.path.join(
            os.path.dirname(__file__),
            '..', 'data', 'famous_players_profiles.json'
        )

    if not os.path.exists(database_path):
        print(f"Warning: Famous player database not found at {database_path}")
        return []

    profiler = FamousPlayerProfiler()
    profiles = profiler.load_profiles(database_path)

    # Convert to format expected by unified_api_server
    players_list = []
    for profile in profiles:
        player_dict = {
            'name': profile.name,
            'description': profile.description,
            'era': profile.era,
            'strengths': profile.strengths,
            'profile': profile.profile,
            'confidence': profile.confidence
        }
        players_list.append(player_dict)

    return players_list
