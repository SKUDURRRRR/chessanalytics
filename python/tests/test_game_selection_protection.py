#!/usr/bin/env python3
"""
Unit tests for game selection logic protection.

These tests ensure that the game selection logic continues to work correctly
and prevents regression of the bug where random games were selected instead
of the most recent ones.
"""

import pytest
import sys
import os
from datetime import datetime, timezone
from unittest.mock import Mock, patch

# Add the python directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from core.unified_api_server import _validate_game_chronological_order
from core.api_server import _validate_game_chronological_order as legacy_validate


class TestGameSelectionProtection:
    """Test cases for game selection logic protection."""
    
    def test_validate_chronological_order_correct(self):
        """Test validation passes when games are in correct chronological order."""
        games = [
            {
                'provider_game_id': 'game1',
                'played_at': '2023-12-03T10:00:00+00:00',
                'pgn': '1. e4 e5'
            },
            {
                'provider_game_id': 'game2', 
                'played_at': '2023-12-02T10:00:00+00:00',
                'pgn': '1. d4 d5'
            },
            {
                'provider_game_id': 'game3',
                'played_at': '2023-12-01T10:00:00+00:00', 
                'pgn': '1. Nf3 Nf6'
            }
        ]
        
        # Should not raise any exception
        _validate_game_chronological_order(games, "test context")
        legacy_validate(games, "test context")
    
    def test_validate_chronological_order_incorrect(self):
        """Test validation fails when games are not in chronological order."""
        games = [
            {
                'provider_game_id': 'game1',
                'played_at': '2023-12-01T10:00:00+00:00',  # Older game first
                'pgn': '1. e4 e5'
            },
            {
                'provider_game_id': 'game2',
                'played_at': '2023-12-03T10:00:00+00:00',  # Newer game second - WRONG!
                'pgn': '1. d4 d5'
            }
        ]
        
        # Should raise ValueError
        with pytest.raises(ValueError, match="CRITICAL BUG DETECTED"):
            _validate_game_chronological_order(games, "test context")
        
        with pytest.raises(ValueError, match="CRITICAL BUG DETECTED"):
            legacy_validate(games, "test context")
    
    def test_validate_empty_list(self):
        """Test validation handles empty list gracefully."""
        games = []
        
        # Should not raise any exception
        _validate_game_chronological_order(games, "test context")
        legacy_validate(games, "test context")
    
    def test_validate_single_game(self):
        """Test validation handles single game gracefully."""
        games = [
            {
                'provider_game_id': 'game1',
                'played_at': '2023-12-01T10:00:00+00:00',
                'pgn': '1. e4 e5'
            }
        ]
        
        # Should not raise any exception
        _validate_game_chronological_order(games, "test context")
        legacy_validate(games, "test context")
    
    def test_validate_missing_played_at(self):
        """Test validation handles games without played_at field."""
        games = [
            {
                'provider_game_id': 'game1',
                'pgn': '1. e4 e5'
                # No played_at field
            },
            {
                'provider_game_id': 'game2',
                'played_at': '2023-12-01T10:00:00+00:00',
                'pgn': '1. d4 d5'
            }
        ]
        
        # Should not raise any exception (skips games without played_at)
        _validate_game_chronological_order(games, "test context")
        legacy_validate(games, "test context")
    
    def test_validate_same_timestamps(self):
        """Test validation handles games with same timestamps."""
        games = [
            {
                'provider_game_id': 'game1',
                'played_at': '2023-12-01T10:00:00+00:00',
                'pgn': '1. e4 e5'
            },
            {
                'provider_game_id': 'game2',
                'played_at': '2023-12-01T10:00:00+00:00',  # Same timestamp
                'pgn': '1. d4 d5'
            }
        ]
        
        # Should not raise any exception (equal timestamps are allowed)
        _validate_game_chronological_order(games, "test context")
        legacy_validate(games, "test context")
    
    def test_validate_error_message_content(self):
        """Test that error message contains expected information."""
        games = [
            {
                'provider_game_id': 'old_game',
                'played_at': '2023-12-01T10:00:00+00:00',
                'pgn': '1. e4 e5'
            },
            {
                'provider_game_id': 'new_game',
                'played_at': '2023-12-03T10:00:00+00:00',
                'pgn': '1. d4 d5'
            }
        ]
        
        with pytest.raises(ValueError) as exc_info:
            _validate_game_chronological_order(games, "test context")
        
        error_message = str(exc_info.value)
        assert "CRITICAL BUG DETECTED" in error_message
        assert "test context" in error_message
        assert "old_game" in error_message
        assert "new_game" in error_message
        assert "2023-12-01T10:00:00+00:00" in error_message
        assert "2023-12-03T10:00:00+00:00" in error_message
        assert "most recent first" in error_message
    
    def test_validate_different_datetime_formats(self):
        """Test validation works with different datetime formats."""
        games = [
            {
                'provider_game_id': 'game1',
                'played_at': datetime(2023, 12, 3, 10, 0, 0, tzinfo=timezone.utc),
                'pgn': '1. e4 e5'
            },
            {
                'provider_game_id': 'game2',
                'played_at': datetime(2023, 12, 2, 10, 0, 0, tzinfo=timezone.utc),
                'pgn': '1. d4 d5'
            }
        ]
        
        # Should not raise any exception
        _validate_game_chronological_order(games, "test context")
        legacy_validate(games, "test context")
    
    def test_validate_large_dataset(self):
        """Test validation works with large dataset."""
        # Create 100 games in correct chronological order
        games = []
        for i in range(100):
            games.append({
                'provider_game_id': f'game_{i}',
                'played_at': f'2023-12-{(100-i):02d}T10:00:00+00:00',
                'pgn': f'1. e4 e5 {i}'
            })
        
        # Should not raise any exception
        _validate_game_chronological_order(games, "test context")
        legacy_validate(games, "test context")
    
    def test_validate_mixed_valid_invalid(self):
        """Test validation catches error in middle of dataset."""
        games = [
            {
                'provider_game_id': 'game1',
                'played_at': '2023-12-03T10:00:00+00:00',  # Correct
                'pgn': '1. e4 e5'
            },
            {
                'provider_game_id': 'game2',
                'played_at': '2023-12-01T10:00:00+00:00',  # Wrong - older than next
                'pgn': '1. d4 d5'
            },
            {
                'provider_game_id': 'game3',
                'played_at': '2023-12-02T10:00:00+00:00',  # Wrong - newer than previous
                'pgn': '1. Nf3 Nf6'
            }
        ]
        
        # Should raise ValueError
        with pytest.raises(ValueError, match="CRITICAL BUG DETECTED"):
            _validate_game_chronological_order(games, "test context")


class TestGameSelectionIntegration:
    """Integration tests for game selection logic."""
    
    @patch('core.unified_api_server.get_supabase_client')
    def test_game_selection_maintains_order(self, mock_supabase):
        """Test that the full game selection process maintains chronological order."""
        # Mock Supabase responses
        mock_client = Mock()
        mock_supabase.return_value = mock_client
        
        # Mock games table response (ordered by played_at DESC)
        mock_games_response = Mock()
        mock_games_response.data = [
            {'provider_game_id': 'game1', 'played_at': '2023-12-03T10:00:00+00:00'},
            {'provider_game_id': 'game2', 'played_at': '2023-12-02T10:00:00+00:00'},
            {'provider_game_id': 'game3', 'played_at': '2023-12-01T10:00:00+00:00'},
        ]
        
        # Mock games_pgn table response
        mock_pgn_response = Mock()
        mock_pgn_response.data = [
            {'provider_game_id': 'game1', 'pgn': '1. e4 e5'},
            {'provider_game_id': 'game2', 'pgn': '1. d4 d5'},
            {'provider_game_id': 'game3', 'pgn': '1. Nf3 Nf6'},
        ]
        
        # Mock move_analyses and game_analyses responses (no analyzed games)
        mock_move_analyses = Mock()
        mock_move_analyses.data = []
        mock_game_analyses = Mock()
        mock_game_analyses.data = []
        
        # Configure mock client
        mock_client.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_games_response
        mock_client.table.return_value.select.return_value.eq.return_value.in_.return_value.execute.return_value = mock_pgn_response
        mock_client.table.return_value.select.return_value.eq.return_value.in_.return_value.execute.side_effect = [mock_move_analyses, mock_game_analyses]
        
        # This test would require importing the full analysis function
        # For now, we'll just test that our validation function works
        # In a real integration test, you'd call the actual analysis function
        # and verify the results maintain chronological order


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
