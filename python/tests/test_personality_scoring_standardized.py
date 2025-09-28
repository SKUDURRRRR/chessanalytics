#!/usr/bin/env python3
"""
Comprehensive tests for the standardized personality scoring system.
"""

import sys
import unittest
from pathlib import Path
from typing import List, Dict, Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PYTHON_DIR = PROJECT_ROOT / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.append(str(PYTHON_DIR))

from core.personality_scoring import PersonalityScorer, PersonalityScores, PersonalityMetrics


class TestPersonalityScoring(unittest.TestCase):
    """Test cases for standardized personality scoring."""

    def setUp(self):
        """Set up test fixtures."""
        self.scorer = PersonalityScorer()

    def test_neutral_scores(self):
        """Test that neutral scores are returned for empty input."""
        scores = PersonalityScores.neutral()
        self.assertEqual(scores.tactical, 50.0)
        self.assertEqual(scores.positional, 50.0)
        self.assertEqual(scores.aggressive, 50.0)
        self.assertEqual(scores.patient, 50.0)
        self.assertEqual(scores.novelty, 50.0)
        self.assertEqual(scores.staleness, 50.0)

    def test_empty_moves_returns_neutral(self):
        """Test that empty move list returns neutral scores."""
        scores = self.scorer.calculate_scores([], 0.0)
        self.assertEqual(scores.tactical, 50.0)
        self.assertEqual(scores.positional, 50.0)
        self.assertEqual(scores.aggressive, 50.0)
        self.assertEqual(scores.patient, 50.0)
        self.assertEqual(scores.novelty, 50.0)
        self.assertEqual(scores.staleness, 50.0)

    def test_tactical_scoring_high_accuracy(self):
        """Test tactical scoring with high accuracy moves."""
        moves = [
            {'move_san': 'Bxf7+', 'ply_index': 1, 'centipawn_loss': 5.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Qh5+', 'ply_index': 3, 'centipawn_loss': 8.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Qh8#', 'ply_index': 5, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
        ]
        scores = self.scorer.calculate_scores(moves, 80.0, 'beginner')
        self.assertGreater(scores.tactical, 70.0)  # Should be high for accurate tactical play
        self.assertGreater(scores.aggressive, 60.0)  # Should be high for forcing moves

    def test_positional_scoring_quiet_play(self):
        """Test positional scoring with accurate quiet moves."""
        moves = [
            {'move_san': 'e4', 'ply_index': 1, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Nf3', 'ply_index': 3, 'centipawn_loss': 5.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'd3', 'ply_index': 5, 'centipawn_loss': 8.0, 'is_best': False, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Be2', 'ply_index': 7, 'centipawn_loss': 12.0, 'is_best': False, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
        ]
        scores = self.scorer.calculate_scores(moves, 85.0, 'beginner')
        self.assertGreater(scores.positional, 60.0)  # Should be good for quiet, accurate play
        self.assertGreater(scores.patient, 60.0)  # Should be good for patient play

    def test_aggressive_scoring_forcing_moves(self):
        """Test aggressive scoring with many forcing moves."""
        moves = [
            {'move_san': 'e4', 'ply_index': 1, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Nf3', 'ply_index': 3, 'centipawn_loss': 5.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Bc4', 'ply_index': 5, 'centipawn_loss': 8.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Bxf7+', 'ply_index': 7, 'centipawn_loss': 15.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Qh5+', 'ply_index': 9, 'centipawn_loss': 20.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
        ]
        scores = self.scorer.calculate_scores(moves, 70.0, 'beginner')
        self.assertGreater(scores.aggressive, 65.0)  # Should be high for many forcing moves

    def test_patient_scoring_low_errors(self):
        """Test patient scoring with low error rate."""
        moves = [
            {'move_san': 'e4', 'ply_index': 1, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Nf3', 'ply_index': 3, 'centipawn_loss': 5.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'd3', 'ply_index': 5, 'centipawn_loss': 8.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Be2', 'ply_index': 7, 'centipawn_loss': 12.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'O-O', 'ply_index': 9, 'centipawn_loss': 15.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
        ]
        scores = self.scorer.calculate_scores(moves, 90.0, 'beginner')
        self.assertGreater(scores.patient, 70.0)  # Should be high for low errors and good time management

    def test_novelty_scoring_diverse_moves(self):
        """Test novelty scoring with diverse piece usage."""
        moves = [
            {'move_san': 'e4', 'ply_index': 1, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Nf3', 'ply_index': 3, 'centipawn_loss': 5.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Bc4', 'ply_index': 5, 'centipawn_loss': 8.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Qe2', 'ply_index': 7, 'centipawn_loss': 12.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'O-O', 'ply_index': 9, 'centipawn_loss': 15.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
        ]
        scores = self.scorer.calculate_scores(moves, 70.0, 'beginner')
        self.assertGreater(scores.novelty, 55.0)  # Should be decent for diverse piece usage

    def test_staleness_scoring_conservative_play(self):
        """Test staleness scoring with conservative, structured play."""
        moves = [
            {'move_san': 'e4', 'ply_index': 1, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'e5', 'ply_index': 2, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Nf3', 'ply_index': 3, 'centipawn_loss': 5.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Nc6', 'ply_index': 4, 'centipawn_loss': 5.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
        ]
        scores = self.scorer.calculate_scores(moves, 60.0, 'beginner')
        self.assertGreater(scores.staleness, 60.0)  # Should be high for conservative/structured play

    def test_blunder_penalty(self):
        """Test that blunders significantly reduce scores."""
        moves_good = [
            {'move_san': 'e4', 'ply_index': 1, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Nf3', 'ply_index': 3, 'centipawn_loss': 5.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
        ]
        
        moves_bad = [
            {'move_san': 'e4', 'ply_index': 1, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Nf3', 'ply_index': 3, 'centipawn_loss': 500.0, 'is_best': False, 'is_blunder': True, 'is_mistake': False, 'is_inaccuracy': False},
        ]
        
        scores_good = self.scorer.calculate_scores(moves_good, 80.0, 'beginner')
        scores_bad = self.scorer.calculate_scores(moves_bad, 80.0, 'beginner')
        
        # All scores should be lower with blunders
        self.assertGreater(scores_good.tactical, scores_bad.tactical)
        self.assertGreater(scores_good.positional, scores_bad.positional)
        self.assertGreater(scores_good.patient, scores_bad.patient)

    def test_score_clamping(self):
        """Test that all scores are properly clamped to 0-100 range."""
        # Create moves that would produce extreme scores
        moves = [
            {'move_san': 'e4', 'ply_index': 1, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
        ]
        
        scores = self.scorer.calculate_scores(moves, 50.0, 'beginner')
        
        # All scores should be within valid range
        self.assertGreaterEqual(scores.tactical, 0.0)
        self.assertLessEqual(scores.tactical, 100.0)
        self.assertGreaterEqual(scores.positional, 0.0)
        self.assertLessEqual(scores.positional, 100.0)
        self.assertGreaterEqual(scores.aggressive, 0.0)
        self.assertLessEqual(scores.aggressive, 100.0)
        self.assertGreaterEqual(scores.patient, 0.0)
        self.assertLessEqual(scores.patient, 100.0)
        self.assertGreaterEqual(scores.novelty, 0.0)
        self.assertLessEqual(scores.novelty, 100.0)
        self.assertGreaterEqual(scores.staleness, 0.0)
        self.assertLessEqual(scores.staleness, 100.0)

    def test_aggregation(self):
        """Test score aggregation with weights."""
        scores1 = PersonalityScores(tactical=80.0, positional=70.0, aggressive=60.0, patient=75.0, novelty=65.0, staleness=45.0)
        scores2 = PersonalityScores(tactical=60.0, positional=80.0, aggressive=70.0, patient=65.0, novelty=55.0, staleness=55.0)
        
        weights = [2.0, 1.0]  # First score has double weight
        
        aggregated = self.scorer.aggregate_scores([scores1, scores2], weights)
        
        # Weighted average: (80*2 + 60*1) / 3 = 73.33
        expected_tactical = (80.0 * 2.0 + 60.0 * 1.0) / 3.0
        self.assertAlmostEqual(aggregated.tactical, expected_tactical, places=1)
        
        # Test that aggregation preserves the weighted average correctly
        self.assertAlmostEqual(aggregated.positional, (70.0 * 2.0 + 80.0 * 1.0) / 3.0, places=1)
        self.assertAlmostEqual(aggregated.aggressive, (60.0 * 2.0 + 70.0 * 1.0) / 3.0, places=1)

    def test_dict_conversion(self):
        """Test conversion to and from dictionary."""
        scores = PersonalityScores(tactical=80.0, positional=70.0, aggressive=60.0, patient=75.0, novelty=65.0, staleness=45.0)
        
        # Test to_dict
        scores_dict = scores.to_dict()
        self.assertEqual(scores_dict['tactical'], 80.0)
        self.assertEqual(scores_dict['positional'], 70.0)
        self.assertEqual(scores_dict['aggressive'], 60.0)
        self.assertEqual(scores_dict['patient'], 75.0)
        self.assertEqual(scores_dict['novelty'], 65.0)
        self.assertEqual(scores_dict['staleness'], 45.0)
        
        # Test from_dict
        reconstructed = PersonalityScores.from_dict(scores_dict)
        self.assertEqual(reconstructed.tactical, 80.0)
        self.assertEqual(reconstructed.positional, 70.0)
        self.assertEqual(reconstructed.aggressive, 60.0)
        self.assertEqual(reconstructed.patient, 75.0)
        self.assertEqual(reconstructed.novelty, 65.0)
        self.assertEqual(reconstructed.staleness, 45.0)

    def test_field_mapping(self):
        """Test field mapping from legacy field names."""
        legacy_data = {
            'tactical_score': 80.0,
            'positional_score': 70.0,
            'aggressive_score': 60.0,
            'patient_score': 75.0,
            'novelty_score': 65.0,
            'staleness_score': 45.0,
        }
        
        scores = PersonalityScores.from_dict(legacy_data)
        self.assertEqual(scores.tactical, 80.0)
        self.assertEqual(scores.positional, 70.0)
        self.assertEqual(scores.aggressive, 60.0)
        self.assertEqual(scores.patient, 75.0)
        self.assertEqual(scores.novelty, 65.0)
        self.assertEqual(scores.staleness, 45.0)

    def test_metrics_computation(self):
        """Test metrics computation from move data."""
        moves = [
            {'move_san': 'e4', 'ply_index': 1, 'centipawn_loss': 0.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Nf3', 'ply_index': 3, 'centipawn_loss': 5.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
            {'move_san': 'Bxf7+', 'ply_index': 5, 'centipawn_loss': 15.0, 'is_best': True, 'is_blunder': False, 'is_mistake': False, 'is_inaccuracy': False},
        ]
        
        metrics = self.scorer.compute_metrics(moves)
        
        self.assertEqual(metrics.total_moves, 3)
        self.assertEqual(metrics.best_moves, 3)
        self.assertEqual(metrics.blunders, 0)
        self.assertEqual(metrics.mistakes, 0)
        self.assertEqual(metrics.inaccuracies, 0)
        self.assertEqual(metrics.forcing_moves, 1)  # Bxf7+
        self.assertEqual(metrics.checks, 1)  # Bxf7+
        self.assertAlmostEqual(metrics.centipawn_mean, 6.67, places=1)  # (0 + 5 + 15) / 3


if __name__ == '__main__':
    unittest.main()
