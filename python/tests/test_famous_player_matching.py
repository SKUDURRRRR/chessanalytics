#!/usr/bin/env python3
"""
Test suite for famous player matching algorithm.
"""

import unittest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.unified_api_server import _generate_famous_player_comparisons


class TestFamousPlayerMatching(unittest.TestCase):
    """Test cases for famous player matching algorithm."""

    def test_tactical_player_matches_tal(self):
        """Player with high tactical scores should match Tal or similar."""
        personality_scores = {
            'tactical': 88,
            'positional': 60,
            'aggressive': 85,
            'patient': 50,
            'novelty': 80,
            'staleness': 40
        }

        result = _generate_famous_player_comparisons(
            personality_scores,
            {'category': 'tactical'}
        )

        self.assertIn('primary', result)
        primary = result['primary']

        # Should match an aggressive tactical player (expanded list)
        expected_names = ['Mikhail Tal', 'Garry Kasparov', 'Alexander Alekhine',
                         'Paul Morphy', 'Judit Polgar', 'Alireza Firouzja',
                         'Ian Nepomniachtchi', 'Shakhriyar Mamedyarov']
        self.assertIn(primary['name'], expected_names)

        # Check that new fields are present
        self.assertIn('similarity_score', primary)
        self.assertIn('match_confidence', primary)
        self.assertIn('trait_similarities', primary)
        self.assertIn('insights', primary)

        # Similarity should be reasonable
        self.assertGreater(primary['similarity_score'], 50)
        self.assertLessEqual(primary['similarity_score'], 100)

    def test_positional_player_matches_karpov(self):
        """Player with high positional/patient should match Karpov or similar."""
        personality_scores = {
            'tactical': 70,
            'positional': 92,
            'aggressive': 48,
            'patient': 88,
            'novelty': 45,
            'staleness': 72
        }

        result = _generate_famous_player_comparisons(
            personality_scores,
            {'category': 'positional'}
        )

        self.assertIn('primary', result)
        primary = result['primary']

        # Should match a positional/patient player (expanded list)
        expected_names = ['Anatoly Karpov', 'Tigran Petrosian', 'Akiba Rubinstein',
                         'José Raúl Capablanca', 'Vasily Smyslov', 'Ding Liren',
                         'Wesley So', 'Anish Giri', 'Peter Leko', 'Teimour Radjabov']
        self.assertIn(primary['name'], expected_names)

    def test_creative_player_matches_innovators(self):
        """Player with high novelty should match creative players."""
        personality_scores = {
            'tactical': 80,
            'positional': 78,
            'aggressive': 72,
            'patient': 65,
            'novelty': 90,
            'staleness': 35
        }

        result = _generate_famous_player_comparisons(
            personality_scores,
            {'category': 'creative'}
        )

        self.assertIn('primary', result)
        primary = result['primary']

        # Should match creative/innovative players (expanded list)
        expected_names = ['Aron Nimzowitsch', 'David Bronstein', 'Bent Larsen',
                         'Mikhail Tal', 'Levon Aronian', 'Richard Rapport',
                         'Daniil Dubov', 'Vassily Ivanchuk']
        self.assertIn(primary['name'], expected_names)

    def test_balanced_player_matches_universal(self):
        """Balanced player should match universal players."""
        personality_scores = {
            'tactical': 85,
            'positional': 87,
            'aggressive': 72,
            'patient': 76,
            'novelty': 68,
            'staleness': 52
        }

        result = _generate_famous_player_comparisons(
            personality_scores,
            {'category': 'universal'}
        )

        self.assertIn('primary', result)
        primary = result['primary']

        # Should match universal players (expanded list)
        expected_names = ['Magnus Carlsen', 'Garry Kasparov', 'Bobby Fischer',
                         'Viswanathan Anand', 'Fabiano Caruana', 'Maxime Vachier-Lagrave',
                         'Alexander Grischuk']
        self.assertIn(primary['name'], expected_names)

    def test_returns_three_matches(self):
        """Should return primary, secondary, and tertiary matches."""
        personality_scores = {
            'tactical': 75,
            'positional': 75,
            'aggressive': 75,
            'patient': 75,
            'novelty': 60,
            'staleness': 60
        }

        result = _generate_famous_player_comparisons(
            personality_scores,
            {'category': 'balanced'}
        )

        self.assertIn('primary', result)
        self.assertIn('secondary', result)
        self.assertIn('tertiary', result)

        # All should be different players
        names = {
            result['primary']['name'],
            result['secondary']['name'],
            result['tertiary']['name']
        }
        self.assertEqual(len(names), 3, "All three matches should be different players")

    def test_trait_similarities_structure(self):
        """Trait similarities should have all 6 traits."""
        personality_scores = {
            'tactical': 80,
            'positional': 70,
            'aggressive': 65,
            'patient': 75,
            'novelty': 60,
            'staleness': 55
        }

        result = _generate_famous_player_comparisons(
            personality_scores,
            {'category': 'balanced'}
        )

        trait_sims = result['primary']['trait_similarities']

        # Should have all 6 traits
        expected_traits = ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']
        for trait in expected_traits:
            self.assertIn(trait, trait_sims)
            # All similarities should be in valid range
            self.assertGreaterEqual(trait_sims[trait], 0)
            self.assertLessEqual(trait_sims[trait], 100)

    def test_confidence_scores(self):
        """Match confidence should be reasonable."""
        personality_scores = {
            'tactical': 85,
            'positional': 75,
            'aggressive': 70,
            'patient': 65,
            'novelty': 60,
            'staleness': 55
        }

        result = _generate_famous_player_comparisons(
            personality_scores,
            {'category': 'balanced'}
        )

        primary = result['primary']

        # Confidence should be present and in valid range
        self.assertIn('match_confidence', primary)
        self.assertGreater(primary['match_confidence'], 0)
        self.assertLessEqual(primary['match_confidence'], 100)

        # Match confidence should be <= profile confidence
        # (since match_confidence = profile_confidence * similarity_ratio)
        # We can't test this exactly without knowing profile confidence,
        # but we can check it's reasonable
        self.assertLessEqual(
            primary['match_confidence'],
            primary['similarity_score']
        )

    def test_insights_are_generated(self):
        """Insights should be generated and non-empty."""
        personality_scores = {
            'tactical': 90,
            'positional': 60,
            'aggressive': 85,
            'patient': 50,
            'novelty': 75,
            'staleness': 45
        }

        result = _generate_famous_player_comparisons(
            personality_scores,
            {'category': 'tactical'}
        )

        primary = result['primary']

        self.assertIn('insights', primary)
        self.assertIsInstance(primary['insights'], list)
        self.assertGreater(len(primary['insights']), 0, "Should have at least one insight")

        # Insights should be non-empty strings
        for insight in primary['insights']:
            self.assertIsInstance(insight, str)
            self.assertGreater(len(insight), 0)

    def test_edge_case_all_neutral(self):
        """Handle edge case where all scores are neutral (50)."""
        personality_scores = {
            'tactical': 50,
            'positional': 50,
            'aggressive': 50,
            'patient': 50,
            'novelty': 50,
            'staleness': 50
        }

        result = _generate_famous_player_comparisons(
            personality_scores,
            {'category': 'balanced'}
        )

        # Should still return valid results
        self.assertIn('primary', result)
        primary = result['primary']
        self.assertIn('name', primary)
        self.assertIn('similarity_score', primary)

    def test_similarity_ordering(self):
        """Primary should have higher similarity than secondary and tertiary."""
        personality_scores = {
            'tactical': 88,
            'positional': 75,
            'aggressive': 82,
            'patient': 60,
            'novelty': 78,
            'staleness': 42
        }

        result = _generate_famous_player_comparisons(
            personality_scores,
            {'category': 'tactical'}
        )

        primary_sim = result['primary']['similarity_score']
        secondary_sim = result['secondary']['similarity_score']
        tertiary_sim = result['tertiary']['similarity_score']

        # Should be in descending order
        self.assertGreaterEqual(primary_sim, secondary_sim)
        self.assertGreaterEqual(secondary_sim, tertiary_sim)


if __name__ == '__main__':
    unittest.main()
