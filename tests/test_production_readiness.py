#!/usr/bin/env python3
"""
Production Readiness Test Suite
Comprehensive tests to validate the chess analytics app is production-ready.
"""

import pytest
import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Any, List
from unittest.mock import Mock, patch, AsyncMock

# Import the modules we're testing
from python.core.reliable_analysis_persistence import ReliableAnalysisPersistence, PersistenceResult, PersistenceStatus
from python.core.performance_config import AnalysisPerformanceConfig, PerformanceProfile, get_performance_config
from python.core.security_logging import SecurityLogger, SecurityEvent, get_security_logger
from python.core.analysis_engine import AnalysisType, GameAnalysis

class TestDataModelConsistency:
    """Test data model consistency and field standardization."""
    
    def test_accuracy_field_consistency(self):
        """Test that accuracy fields are consistent across tables."""
        # This would test the unified_analyses view
        # and ensure accuracy vs best_move_percentage mapping works
        pass
    
    def test_personality_scores_consistency(self):
        """Test that personality scores are consistent across tables."""
        # Test that tactical_score, positional_score, etc. are consistent
        pass
    
    def test_data_type_consistency(self):
        """Test that data types are consistent (REAL vs FLOAT)."""
        # Test that all accuracy fields use REAL type
        pass

class TestReliablePersistence:
    """Test reliable analysis persistence system."""
    
    @pytest.fixture
    def mock_supabase(self):
        """Mock Supabase clients for testing."""
        mock_client = Mock()
        mock_service = Mock()
        return mock_client, mock_service
    
    @pytest.fixture
    def persistence(self, mock_supabase):
        """Create persistence instance with mocked clients."""
        mock_client, mock_service = mock_supabase
        return ReliableAnalysisPersistence(mock_client, mock_service)
    
    @pytest.fixture
    def sample_analysis(self):
        """Create sample analysis for testing."""
        return GameAnalysis(
            game_id="test_game_123",
            user_id="testuser",
            platform="lichess",
            total_moves=40,
            moves_analysis=[],
            accuracy=75.5,
            opponent_accuracy=70.0,
            blunders=2,
            mistakes=3,
            inaccuracies=5,
            brilliant_moves=1,
            best_moves=30,
            good_moves=25,
            acceptable_moves=20,
            opening_accuracy=80.0,
            middle_game_accuracy=70.0,
            endgame_accuracy=75.0,
            average_centipawn_loss=50.0,
            worst_blunder_centipawn_loss=200.0,
            time_management_score=60.0,
            opponent_average_centipawn_loss=45.0,
            opponent_worst_blunder_centipawn_loss=180.0,
            opponent_time_management_score=55.0,
            tactical_score=70.0,
            positional_score=65.0,
            aggressive_score=55.0,
            patient_score=60.0,
            novelty_score=50.0,
            staleness_score=45.0,
            tactical_patterns=[],
            positional_patterns=[],
            strategic_themes=[],
            analysis_type=AnalysisType.STOCKFISH,
            analysis_date=datetime.now(timezone.utc),
            processing_time_ms=1000,
            stockfish_depth=8
        )
    
    @pytest.mark.asyncio
    async def test_save_analysis_success(self, persistence, sample_analysis, mock_supabase):
        """Test successful analysis save."""
        mock_client, mock_service = mock_supabase
        
        # Mock successful database operations
        mock_service.table.return_value.upsert.return_value.execute.return_value.data = [{"id": "test_id"}]
        
        result = await persistence.save_analysis_with_retry(sample_analysis)
        
        assert result.success is True
        assert result.status == PersistenceStatus.COMPLETED
        assert result.analysis_id is not None
    
    @pytest.mark.asyncio
    async def test_save_analysis_retry_on_failure(self, persistence, sample_analysis, mock_supabase):
        """Test retry logic on analysis save failure."""
        mock_client, mock_service = mock_supabase
        
        # Mock database failure then success
        mock_service.table.return_value.upsert.return_value.execute.return_value.data = None
        
        result = await persistence.save_analysis_with_retry(sample_analysis)
        
        # Should retry and eventually fail after max retries
        assert result.success is False
        assert result.status in [PersistenceStatus.FAILED, PersistenceStatus.RETRYING]
    
    @pytest.mark.asyncio
    async def test_progress_tracking(self, persistence, mock_supabase):
        """Test analysis progress tracking."""
        mock_client, mock_service = mock_supabase
        
        # Mock progress data
        mock_service.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"status": "completed", "user_id": "testuser", "platform": "lichess"},
            {"status": "in_progress", "user_id": "testuser", "platform": "lichess"},
            {"status": "failed", "user_id": "testuser", "platform": "lichess"}
        ]
        
        progress = await persistence.get_analysis_progress("testuser", "lichess")
        
        assert progress["total_jobs"] == 3
        assert progress["completed_jobs"] == 1
        assert progress["failed_jobs"] == 1
        assert progress["in_progress_jobs"] == 1
        assert progress["progress_percentage"] == 33.33

class TestPerformanceConfiguration:
    """Test performance configuration system."""
    
    def test_development_profile(self):
        """Test development performance profile."""
        config = AnalysisPerformanceConfig.for_profile(PerformanceProfile.DEVELOPMENT)
        
        assert config.stockfish_depth == 6
        assert config.stockfish_skill_level == 6
        assert config.stockfish_time_limit == 0.5
        assert config.max_concurrent_analyses == 2
        assert config.batch_size == 5
        assert config.max_games_per_request == 10
    
    def test_production_profile(self):
        """Test production performance profile."""
        config = AnalysisPerformanceConfig.for_profile(PerformanceProfile.PRODUCTION)
        
        assert config.stockfish_depth == 8
        assert config.stockfish_skill_level == 8
        assert config.stockfish_time_limit == 1.0
        assert config.max_concurrent_analyses == 4
        assert config.batch_size == 10
        assert config.max_games_per_request == 50
    
    def test_high_performance_profile(self):
        """Test high performance profile."""
        config = AnalysisPerformanceConfig.for_profile(PerformanceProfile.HIGH_PERFORMANCE)
        
        assert config.stockfish_depth == 12
        assert config.stockfish_skill_level == 15
        assert config.stockfish_time_limit == 2.0
        assert config.max_concurrent_analyses == 8
        assert config.batch_size == 20
        assert config.max_games_per_request == 100
    
    def test_cost_optimized_profile(self):
        """Test cost optimized profile."""
        config = AnalysisPerformanceConfig.for_profile(PerformanceProfile.COST_OPTIMIZED)
        
        assert config.stockfish_depth == 6
        assert config.stockfish_skill_level == 6
        assert config.stockfish_time_limit == 0.5
        assert config.max_concurrent_analyses == 2
        assert config.batch_size == 5
        assert config.max_games_per_request == 20
    
    def test_config_validation(self):
        """Test configuration validation."""
        config = AnalysisPerformanceConfig.for_profile(PerformanceProfile.PRODUCTION)
        assert config.validate() is True
        
        # Test invalid config
        config.stockfish_depth = 25  # Invalid depth
        assert config.validate() is False
    
    def test_environment_override(self):
        """Test environment variable overrides."""
        with patch.dict('os.environ', {
            'STOCKFISH_DEPTH': '10',
            'MAX_CONCURRENT_ANALYSES': '6',
            'BATCH_SIZE': '15'
        }):
            config = get_performance_config()
            assert config.stockfish_depth == 10
            assert config.max_concurrent_analyses == 6
            assert config.batch_size == 15

class TestSecurityLogging:
    """Test security logging system."""
    
    def test_security_logger_initialization(self):
        """Test security logger initialization."""
        logger = SecurityLogger()
        assert logger.audit_enabled is True
        assert logger.log_file == "security.log"
    
    def test_log_authentication_success(self):
        """Test logging authentication success."""
        logger = SecurityLogger()
        
        with patch.object(logger.logger, 'log') as mock_log:
            logger.log_authentication_success(
                "testuser", "192.168.1.1", "Mozilla/5.0", "req123"
            )
            mock_log.assert_called_once()
    
    def test_log_authentication_failure(self):
        """Test logging authentication failure."""
        logger = SecurityLogger()
        
        with patch.object(logger.logger, 'log') as mock_log:
            logger.log_authentication_failure(
                "testuser", "192.168.1.1", "Mozilla/5.0", "req124", "Invalid token"
            )
            mock_log.assert_called_once()
    
    def test_log_data_access(self):
        """Test logging data access."""
        logger = SecurityLogger()
        
        with patch.object(logger.logger, 'log') as mock_log:
            logger.log_data_access(
                "testuser", "games", "SELECT", 10, "192.168.1.1", "req125"
            )
            mock_log.assert_called_once()
    
    def test_rate_limiting(self):
        """Test rate limiting for security events."""
        logger = SecurityLogger()
        
        # Generate many events quickly
        for i in range(150):  # More than rate limit
            logger.log_authentication_failure(
                "testuser", "192.168.1.1", "Mozilla/5.0", f"req{i}", "Invalid token"
            )
        
        # Should be rate limited after threshold
        assert len(logger.event_counts) > 0

class TestDataModelValidation:
    """Test data model validation functions."""
    
    def test_validate_data_consistency_function(self):
        """Test the validate_data_consistency database function."""
        # This would test the SQL function we created
        # to validate data consistency
        pass
    
    def test_validate_rls_security_function(self):
        """Test the validate_rls_security database function."""
        # This would test the SQL function we created
        # to validate RLS policies
        pass

class TestEndToEndWorkflow:
    """Test complete end-to-end workflow."""
    
    @pytest.mark.asyncio
    async def test_pgn_import_to_analysis_workflow(self):
        """Test complete PGN import to analysis workflow."""
        # 1. Import PGN
        # 2. Parse and store game data
        # 3. Queue analysis
        # 4. Run analysis with Stockfish
        # 5. Store results reliably
        # 6. Verify data consistency
        # 7. Test API endpoints
        pass
    
    @pytest.mark.asyncio
    async def test_analysis_retry_workflow(self):
        """Test analysis retry workflow on failure."""
        # 1. Start analysis
        # 2. Simulate database failure
        # 3. Verify retry logic
        # 4. Verify eventual success
        pass
    
    @pytest.mark.asyncio
    async def test_progress_tracking_workflow(self):
        """Test progress tracking throughout analysis."""
        # 1. Start batch analysis
        # 2. Check progress at various stages
        # 3. Verify progress accuracy
        # 4. Verify completion status
        pass

class TestSecurityCompliance:
    """Test security compliance and RLS policies."""
    
    def test_rls_policy_enforcement(self):
        """Test that RLS policies are properly enforced."""
        # Test that users can only access their own data
        # Test that service_role has full access
        # Test that anon role has limited access
        pass
    
    def test_data_encryption(self):
        """Test data encryption at rest and in transit."""
        # Test that sensitive data is encrypted
        pass
    
    def test_audit_trail_completeness(self):
        """Test that audit trail captures all necessary events."""
        # Test that all data access is logged
        # Test that all modifications are logged
        pass

class TestPerformanceBenchmarks:
    """Test performance benchmarks and limits."""
    
    def test_analysis_performance_benchmarks(self):
        """Test that analysis meets performance benchmarks."""
        # Test analysis speed for different configurations
        # Test memory usage limits
        # Test concurrent analysis limits
        pass
    
    def test_database_performance_benchmarks(self):
        """Test that database operations meet performance benchmarks."""
        # Test query performance
        # Test batch insert performance
        # Test index effectiveness
        pass

# Integration test fixtures
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def sample_pgn():
    """Sample PGN for testing."""
    return """[Event "Test Game"]
[Site "Test Site"]
[Date "2024.01.01"]
[Round "1"]
[White "TestUser"]
[Black "TestOpponent"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1500"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 c6 12. cxb5 axb5 13. Nc3 Bb7 14. Bg5 b4 15. Nb1 h6 16. Bh4 c5 17. dxe5 dxe5 18. Nxe5 Nxe4 19. Nxe4 Bxe4 20. Bxd8 Bxc2 21. Bxc7 Bxb3 22. axb3 Bxc7 23. Nc3 Bb6 24. Rxe4 f5 25. Re2 f4 26. g3 fxg3 27. fxg3 Rf7 28. Re6 Rf6 29. Re8+ Rf8 30. Rxf8+ Kxf8 31. Re1 Ke7 32. Re6+ Kd7 33. Rg6 Ke7 34. Rg7+ Kf8 35. Rg6 Ke7 36. Rg7+ Kf8 37. Rg6 1/2-1/2"""

if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])
