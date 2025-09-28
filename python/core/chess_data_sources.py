#!/usr/bin/env python3
"""
Chess Data Sources for Personality Scoring Calibration
Provides access to public chess databases and statistical data for better scoring calibration.
"""

import requests
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import statistics

@dataclass
class PlayerStats:
    """Player statistics from external sources."""
    elo: int
    games_played: int
    win_rate: float
    draw_rate: float
    loss_rate: float
    avg_accuracy: float
    tactical_score: float
    positional_score: float
    aggressive_score: float
    patient_score: float
    novelty_score: float
    staleness_score: float

class ChessDataSources:
    """Access to various chess data sources for calibration."""
    
    def __init__(self):
        self.lichess_base_url = "https://lichess.org/api"
        self.chesscom_base_url = "https://api.chess.com/pub"
        
    def get_lichess_player_stats(self, username: str) -> Optional[PlayerStats]:
        """Get player statistics from Lichess API."""
        try:
            # Get user profile
            profile_url = f"{self.lichess_base_url}/user/{username}"
            response = requests.get(profile_url, timeout=10)
            if response.status_code != 200:
                return None
                
            profile = response.json()
            
            # Get user games (last 100)
            games_url = f"{self.lichess_base_url}/games/user/{username}?max=100"
            games_response = requests.get(games_url, timeout=10)
            if games_response.status_code != 200:
                return None
                
            games = games_response.json()
            
            # Calculate basic stats
            total_games = len(games)
            if total_games == 0:
                return None
                
            wins = sum(1 for game in games if game.get('winner') == 'white' and game.get('players', {}).get('white', {}).get('user', {}).get('name') == username)
            draws = sum(1 for game in games if game.get('status') == 'draw')
            losses = total_games - wins - draws
            
            return PlayerStats(
                elo=profile.get('perfs', {}).get('rapid', {}).get('rating', 1200),
                games_played=total_games,
                win_rate=wins / total_games,
                draw_rate=draws / total_games,
                loss_rate=losses / total_games,
                avg_accuracy=0.0,  # Would need move analysis
                tactical_score=0.0,  # Would need move analysis
                positional_score=0.0,
                aggressive_score=0.0,
                patient_score=0.0,
                novelty_score=0.0,
                staleness_score=0.0
            )
        except Exception as e:
            print(f"Error fetching Lichess data: {e}")
            return None
    
    def get_chesscom_player_stats(self, username: str) -> Optional[PlayerStats]:
        """Get player statistics from Chess.com API."""
        try:
            # Get user profile
            profile_url = f"{self.chesscom_base_url}/player/{username}"
            response = requests.get(profile_url, timeout=10)
            if response.status_code != 200:
                return None
                
            profile = response.json()
            
            # Get user games
            games_url = f"{self.chesscom_base_url}/player/{username}/games/2024/01"
            games_response = requests.get(games_url, timeout=10)
            if games_response.status_code != 200:
                return None
                
            games = games_response.json().get('games', [])
            
            # Calculate basic stats
            total_games = len(games)
            if total_games == 0:
                return None
                
            wins = sum(1 for game in games if game.get('white', {}).get('username') == username and game.get('white', {}).get('result') == 'win')
            draws = sum(1 for game in games if game.get('white', {}).get('result') == 'draw')
            losses = total_games - wins - draws
            
            return PlayerStats(
                elo=profile.get('chess_rapid', {}).get('last', {}).get('rating', 1200),
                games_played=total_games,
                win_rate=wins / total_games,
                draw_rate=draws / total_games,
                loss_rate=losses / total_games,
                avg_accuracy=0.0,
                tactical_score=0.0,
                positional_score=0.0,
                aggressive_score=0.0,
                patient_score=0.0,
                novelty_score=0.0,
                staleness_score=0.0
            )
        except Exception as e:
            print(f"Error fetching Chess.com data: {e}")
            return None

class StatisticalCalibration:
    """Statistical calibration based on chess research and public data."""
    
    def __init__(self):
        # Based on chess research and typical player distributions
        self.elo_distributions = {
            'beginner': (600, 800, 0.15),      # 15% of players
            'intermediate': (800, 1200, 0.25), # 25% of players
            'advanced': (1200, 1600, 0.30),    # 30% of players
            'expert': (1600, 2000, 0.20),      # 20% of players
            'master': (2000, 2800, 0.10)       # 10% of players
        }
        
        # Typical personality trait distributions by skill level
        self.trait_expectations = {
            'beginner': {
                'tactical': (30, 60, 0.7),      # Mean, Max, StdDev
                'positional': (25, 55, 0.6),
                'aggressive': (40, 70, 0.8),
                'patient': (35, 65, 0.7),
                'novelty': (20, 50, 0.5),
                'staleness': (50, 80, 0.6)
            },
            'intermediate': {
                'tactical': (45, 75, 0.8),
                'positional': (40, 70, 0.7),
                'aggressive': (50, 80, 0.9),
                'patient': (45, 75, 0.8),
                'novelty': (35, 65, 0.7),
                'staleness': (45, 75, 0.7)
            },
            'advanced': {
                'tactical': (60, 85, 0.9),
                'positional': (55, 80, 0.8),
                'aggressive': (55, 80, 0.8),
                'patient': (55, 80, 0.8),
                'novelty': (50, 75, 0.8),
                'staleness': (40, 70, 0.7)
            },
            'expert': {
                'tactical': (70, 90, 0.8),
                'positional': (65, 85, 0.7),
                'aggressive': (60, 85, 0.8),
                'patient': (65, 85, 0.7),
                'novelty': (60, 80, 0.7),
                'staleness': (35, 65, 0.6)
            },
            'master': {
                'tactical': (80, 95, 0.7),
                'positional': (75, 90, 0.6),
                'aggressive': (65, 85, 0.7),
                'patient': (75, 90, 0.6),
                'novelty': (70, 85, 0.6),
                'staleness': (30, 60, 0.5)
            }
        }
    
    def get_percentile_score(self, score: float, skill_level: str, trait: str) -> float:
        """Convert raw score to percentile within skill level."""
        if skill_level not in self.trait_expectations:
            return score
            
        mean, max_val, std_dev = self.trait_expectations[skill_level].get(trait, (50, 80, 0.7))
        
        # Calculate percentile
        if score <= mean:
            percentile = 50 * (score / mean)
        else:
            percentile = 50 + 50 * ((score - mean) / (max_val - mean))
        
        return max(0, min(100, percentile))
    
    def get_skill_level_from_elo(self, elo: int) -> str:
        """Determine skill level from ELO rating."""
        if elo < 800:
            return 'beginner'
        elif elo < 1200:
            return 'intermediate'
        elif elo < 1600:
            return 'advanced'
        elif elo < 2000:
            return 'expert'
        else:
            return 'master'
    
    def calibrate_scores(self, scores: Dict[str, float], elo: int) -> Dict[str, float]:
        """Calibrate scores based on ELO and statistical expectations."""
        skill_level = self.get_skill_level_from_elo(elo)
        calibrated = {}
        
        for trait, score in scores.items():
            calibrated[trait] = self.get_percentile_score(score, skill_level, trait)
        
        return calibrated

# Example usage and testing
if __name__ == "__main__":
    # Test the calibration system
    calibration = StatisticalCalibration()
    
    # Test with different ELO levels
    test_scores = {
        'tactical': 70.0,
        'positional': 65.0,
        'aggressive': 60.0,
        'patient': 70.0,
        'novelty': 55.0,
        'staleness': 45.0
    }
    
    for elo in [900, 1400, 1800, 2200]:
        skill_level = calibration.get_skill_level_from_elo(elo)
        calibrated = calibration.calibrate_scores(test_scores, elo)
        print(f"ELO {elo} ({skill_level}): {calibrated}")

