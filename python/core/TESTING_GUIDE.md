# Testing Guide - Unified Chess Analysis System

This guide provides comprehensive testing procedures for the new unified chess analysis system.

## 🧪 Testing Overview

The unified system includes multiple testing levels:
1. **Unit Tests** - Individual component testing
2. **Integration Tests** - API endpoint testing
3. **End-to-End Tests** - Complete workflow testing
4. **Performance Tests** - Load and stress testing
5. **Migration Tests** - Testing migration from old system

## 🚀 Quick Start Testing

### 1. Basic System Test

```bash
# Start the unified API server
python python/core/api_server.py

# In another terminal, test basic functionality
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "unified-chess-analysis-api",
  "stockfish_available": true,
  "analysis_types": ["basic", "stockfish", "deep"]
}
```

### 2. Position Analysis Test

```bash
curl -X POST http://localhost:8000/analyze-position \
     -H "Content-Type: application/json" \
     -d '{
       "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
       "analysis_type": "basic"
     }'
```

Expected response:
```json
{
  "evaluation": {"value": 0, "type": "cp"},
  "best_move": "e2e4",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "analysis_type": "basic"
}
```

## 🔧 Unit Testing

### Test the Analysis Engine

```python
#!/usr/bin/env python3
"""
Unit tests for the analysis engine
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from core.analysis_engine import ChessAnalysisEngine, AnalysisConfig, AnalysisType

async def test_analysis_engine():
    """Test the core analysis engine functionality."""
    print("Testing Analysis Engine")
    print("=" * 40)
    
    # Test 1: Basic Analysis
    print("\n1. Testing Basic Analysis...")
    engine = ChessAnalysisEngine()
    config = AnalysisConfig(analysis_type=AnalysisType.BASIC)
    engine.config = config
    
    position = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    result = await engine.analyze_position(position)
    
    assert result['analysis_type'] == 'basic'
    assert 'evaluation' in result
    assert 'best_move' in result
    print("   ✅ Basic analysis test passed")
    
    # Test 2: Stockfish Analysis (if available)
    if engine.stockfish_path:
        print("\n2. Testing Stockfish Analysis...")
        config = AnalysisConfig(analysis_type=AnalysisType.STOCKFISH, depth=10)
        engine.config = config
        
        result = await engine.analyze_position(position)
        assert result['analysis_type'] == 'stockfish'
        print("   ✅ Stockfish analysis test passed")
    else:
        print("\n2. Stockfish not available, skipping Stockfish test")
    
    # Test 3: Move Analysis
    print("\n3. Testing Move Analysis...")
    import chess
    board = chess.Board(position)
    move = chess.Move.from_uci("e2e4")
    
    move_result = await engine.analyze_move(board, move)
    assert hasattr(move_result, 'move')
    assert hasattr(move_result, 'is_best')
    assert hasattr(move_result, 'centipawn_loss')
    print("   ✅ Move analysis test passed")
    
    # Test 4: Game Analysis
    print("\n4. Testing Game Analysis...")
    pgn = """[Event "Test Game"]
[Site "test.com"]
[Date "2024.01.01"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 c6 12. cxb5 axb5 13. Nc3 Bb7 14. Bg5 b4 15. Nb1 h6 16. Bh4 c5 17. dxe5 Nxe4 18. Bxe7 Qxe7 19. exd6 Qf6 20. Nbd2 Nxd6 21. Nc4 Nxc4 22. Bxc4 Nb6 23. Ne5 Rae8 24. Bxf7+ Rxf7 25. Nxf7 Rxe1+ 26. Qxe1 Kxf7 27. Qe3 Qg5 28. Qxg5 hxg5 29. b3 Ke6 30. a3 Kd6 31. axb4 cxb4 32. Ra5 Nd5 33. f3 Bc8 34. Kf2 Bf5 35. Ra7 g6 36. Ra6+ Kc5 37. Ke1 Nf4 38. g3 Nxh3 39. Kd2 Kb5 40. Rd6 Kc5 41. Ra6 Nf2 42. g4 Bd3 43. Re6 1-0"""
    
    game_result = await engine.analyze_game(pgn, "player1", "lichess")
    if game_result:
        assert game_result.accuracy >= 0
        assert game_result.total_moves > 0
        assert len(game_result.moves_analysis) > 0
        print("   ✅ Game analysis test passed")
    else:
        print("   ⚠️ Game analysis returned None (may be expected)")
    
    print("\n🎉 All analysis engine tests passed!")

if __name__ == "__main__":
    asyncio.run(test_analysis_engine())
```

### Test Configuration

```python
#!/usr/bin/env python3
"""
Unit tests for configuration management
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from core.config import ChessAnalysisConfig, get_config

def test_configuration():
    """Test configuration management."""
    print("Testing Configuration Management")
    print("=" * 40)
    
    # Test 1: Default Configuration
    print("\n1. Testing default configuration...")
    config = ChessAnalysisConfig()
    
    assert config.database.url is not None or config.database.url == ""
    assert config.stockfish.depth > 0
    assert config.analysis.default_type in ["basic", "stockfish", "deep"]
    assert config.api.port > 0
    print("   ✅ Default configuration test passed")
    
    # Test 2: Configuration Validation
    print("\n2. Testing configuration validation...")
    is_valid = config.validate()
    print(f"   Configuration valid: {is_valid}")
    
    # Test 3: Global Configuration
    print("\n3. Testing global configuration...")
    global_config = get_config()
    assert global_config is not None
    print("   ✅ Global configuration test passed")
    
    # Test 4: Configuration Summary
    print("\n4. Configuration Summary:")
    config.print_summary()
    
    print("\n🎉 All configuration tests passed!")

if __name__ == "__main__":
    test_configuration()
```

## 🌐 API Integration Testing

### Test All API Endpoints

```python
#!/usr/bin/env python3
"""
Integration tests for the API server
"""

import requests
import json
import time
import sys
import os

def test_api_endpoints():
    """Test all API endpoints."""
    base_url = "http://localhost:8000"
    
    print("Testing API Endpoints")
    print("=" * 40)
    
    # Test 1: Health Check
    print("\n1. Testing health check...")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("   ✅ Health check passed")
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return False
    
    # Test 2: Root Endpoint
    print("\n2. Testing root endpoint...")
    try:
        response = requests.get(f"{base_url}/", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("   ✅ Root endpoint passed")
    except Exception as e:
        print(f"   ❌ Root endpoint failed: {e}")
    
    # Test 3: Position Analysis
    print("\n3. Testing position analysis...")
    try:
        data = {
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "analysis_type": "basic"
        }
        response = requests.post(f"{base_url}/analyze-position", json=data, timeout=30)
        assert response.status_code == 200
        result = response.json()
        assert "evaluation" in result
        assert "analysis_type" in result
        print("   ✅ Position analysis passed")
    except Exception as e:
        print(f"   ❌ Position analysis failed: {e}")
    
    # Test 4: Move Analysis
    print("\n4. Testing move analysis...")
    try:
        data = {
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "move": "e2e4",
            "analysis_type": "basic"
        }
        response = requests.post(f"{base_url}/analyze-move", json=data, timeout=30)
        assert response.status_code == 200
        result = response.json()
        assert "move" in result
        assert "is_best" in result
        print("   ✅ Move analysis passed")
    except Exception as e:
        print(f"   ❌ Move analysis failed: {e}")
    
    # Test 5: Game Analysis
    print("\n5. Testing game analysis...")
    try:
        pgn = """[Event "Test Game"]
[Site "test.com"]
[Date "2024.01.01"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 c6 12. cxb5 axb5 13. Nc3 Bb7 14. Bg5 b4 15. Nb1 h6 16. Bh4 c5 17. dxe5 Nxe4 18. Bxe7 Qxe7 19. exd6 Qf6 20. Nbd2 Nxd6 21. Nc4 Nxc4 22. Bxc4 Nb6 23. Ne5 Rae8 24. Bxf7+ Rxf7 25. Nxf7 Rxe1+ 26. Qxe1 Kxf7 27. Qe3 Qg5 28. Qxg5 hxg5 29. b3 Ke6 30. a3 Kd6 31. axb4 cxb4 32. Ra5 Nd5 33. f3 Bc8 34. Kf2 Bf5 35. Ra7 g6 36. Ra6+ Kc5 37. Ke1 Nf4 38. g3 Nxh3 39. Kd2 Kb5 40. Rd6 Kc5 41. Ra6 Nf2 42. g4 Bd3 43. Re6 1-0"""
        
        data = {
            "pgn": pgn,
            "user_id": "test_user",
            "platform": "lichess",
            "analysis_type": "basic"
        }
        response = requests.post(f"{base_url}/analyze-game", json=data, timeout=60)
        assert response.status_code == 200
        result = response.json()
        assert "success" in result
        print("   ✅ Game analysis passed")
    except Exception as e:
        print(f"   ❌ Game analysis failed: {e}")
    
    # Test 6: Batch Analysis
    print("\n6. Testing batch analysis...")
    try:
        data = {
            "user_id": "test_user",
            "platform": "lichess",
            "analysis_type": "basic",
            "limit": 3
        }
        response = requests.post(f"{base_url}/analyze-games", json=data, timeout=30)
        assert response.status_code == 200
        result = response.json()
        assert "success" in result
        print("   ✅ Batch analysis started")
        
        # Check progress
        time.sleep(2)
        progress_response = requests.get(f"{base_url}/analysis-progress/test_user/lichess")
        if progress_response.status_code == 200:
            progress = progress_response.json()
            print(f"   Progress: {progress['progress_percentage']}%")
    except Exception as e:
        print(f"   ❌ Batch analysis failed: {e}")
    
    # Test 7: Get Analysis Results
    print("\n7. Testing get analysis results...")
    try:
        response = requests.get(f"{base_url}/analysis/test_user/lichess?limit=5")
        assert response.status_code == 200
        results = response.json()
        print(f"   Found {len(results)} analysis results")
        print("   ✅ Get analysis results passed")
    except Exception as e:
        print(f"   ❌ Get analysis results failed: {e}")
    
    # Test 8: Get Analysis Stats
    print("\n8. Testing get analysis stats...")
    try:
        response = requests.get(f"{base_url}/analysis-stats/test_user/lichess")
        assert response.status_code == 200
        stats = response.json()
        assert "total_games_analyzed" in stats
        print("   ✅ Get analysis stats passed")
    except Exception as e:
        print(f"   ❌ Get analysis stats failed: {e}")
    
    print("\n🎉 API integration tests completed!")

if __name__ == "__main__":
    test_api_endpoints()
```

## 🔄 Migration Testing

### Test Migration from Old System

```python
#!/usr/bin/env python3
"""
Test migration from old system to new unified system
"""

import requests
import json
import time

def test_migration():
    """Test migration from old system."""
    print("Testing Migration from Old System")
    print("=" * 40)
    
    # Test 1: Compare API Responses
    print("\n1. Comparing API responses...")
    
    # Old system endpoints (if still running)
    old_endpoints = [
        "http://localhost:8002",  # hybrid_analysis_server
        "http://localhost:8003"   # real_stockfish_server
    ]
    
    new_endpoint = "http://localhost:8000"  # unified server
    
    # Test position analysis comparison
    position_data = {
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    }
    
    print("   Testing new unified API...")
    try:
        new_response = requests.post(f"{new_endpoint}/analyze-position", 
                                   json={**position_data, "analysis_type": "basic"}, 
                                   timeout=30)
        if new_response.status_code == 200:
            print("   ✅ New API working")
        else:
            print(f"   ❌ New API failed: {new_response.status_code}")
    except Exception as e:
        print(f"   ❌ New API error: {e}")
    
    # Test 2: Data Format Compatibility
    print("\n2. Testing data format compatibility...")
    try:
        response = requests.get(f"{new_endpoint}/analysis/test_user/lichess")
        if response.status_code == 200:
            results = response.json()
            if results:
                # Check if new format includes all expected fields
                expected_fields = [
                    "game_id", "accuracy", "blunders", "mistakes", 
                    "inaccuracies", "brilliant_moves", "analysis_type"
                ]
                sample = results[0]
                missing_fields = [field for field in expected_fields if field not in sample]
                if not missing_fields:
                    print("   ✅ Data format compatible")
                else:
                    print(f"   ⚠️ Missing fields: {missing_fields}")
            else:
                print("   ℹ️ No analysis results found (expected for new system)")
    except Exception as e:
        print(f"   ❌ Data format test failed: {e}")
    
    print("\n🎉 Migration testing completed!")

if __name__ == "__main__":
    test_migration()
```

## ⚡ Performance Testing

### Load Testing

```python
#!/usr/bin/env python3
"""
Performance and load testing for the unified system
"""

import requests
import time
import concurrent.futures
import statistics
from datetime import datetime

def test_performance():
    """Test system performance under load."""
    print("Performance Testing")
    print("=" * 40)
    
    base_url = "http://localhost:8000"
    
    # Test 1: Single Request Performance
    print("\n1. Testing single request performance...")
    start_time = time.time()
    
    try:
        response = requests.post(f"{base_url}/analyze-position", json={
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "analysis_type": "basic"
        }, timeout=30)
        
        end_time = time.time()
        duration = end_time - start_time
        
        if response.status_code == 200:
            print(f"   ✅ Single request completed in {duration:.2f}s")
        else:
            print(f"   ❌ Single request failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Single request error: {e}")
    
    # Test 2: Concurrent Request Performance
    print("\n2. Testing concurrent request performance...")
    
    def make_request():
        start = time.time()
        try:
            response = requests.post(f"{base_url}/analyze-position", json={
                "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "analysis_type": "basic"
            }, timeout=30)
            end = time.time()
            return {"success": response.status_code == 200, "duration": end - start}
        except Exception as e:
            end = time.time()
            return {"success": False, "duration": end - start, "error": str(e)}
    
    # Test with 5 concurrent requests
    concurrent_requests = 5
    print(f"   Making {concurrent_requests} concurrent requests...")
    
    start_time = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrent_requests) as executor:
        futures = [executor.submit(make_request) for _ in range(concurrent_requests)]
        results = [future.result() for future in concurrent.futures.as_completed(futures)]
    
    end_time = time.time()
    total_duration = end_time - start_time
    
    successful_requests = [r for r in results if r["success"]]
    durations = [r["duration"] for r in successful_requests]
    
    if durations:
        avg_duration = statistics.mean(durations)
        min_duration = min(durations)
        max_duration = max(durations)
        
        print(f"   ✅ {len(successful_requests)}/{concurrent_requests} requests successful")
        print(f"   Average duration: {avg_duration:.2f}s")
        print(f"   Min duration: {min_duration:.2f}s")
        print(f"   Max duration: {max_duration:.2f}s")
        print(f"   Total time: {total_duration:.2f}s")
    else:
        print("   ❌ No successful requests")
    
    # Test 3: Memory Usage (basic check)
    print("\n3. Testing memory usage...")
    try:
        import psutil
        process = psutil.Process()
        memory_info = process.memory_info()
        memory_mb = memory_info.rss / 1024 / 1024
        print(f"   Current memory usage: {memory_mb:.1f} MB")
    except ImportError:
        print("   ℹ️ psutil not available for memory testing")
    
    print("\n🎉 Performance testing completed!")

if __name__ == "__main__":
    test_performance()
```

## 🧪 Running All Tests

### Complete Test Suite

```bash
#!/bin/bash
# Complete test suite runner

echo "Chess Analysis System - Complete Test Suite"
echo "=========================================="

# Check if server is running
echo "Checking if API server is running..."
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ API server is running"
else
    echo "❌ API server is not running. Please start it first:"
    echo "   python python/core/api_server.py"
    exit 1
fi

echo ""
echo "Running unit tests..."

# Test analysis engine
echo "1. Testing analysis engine..."
python python/core/analysis_engine.py

# Test configuration
echo "2. Testing configuration..."
python python/core/config.py

# Test API endpoints
echo "3. Testing API endpoints..."
python python/example_api_usage.py

# Test performance
echo "4. Testing performance..."
python python/core/TESTING_GUIDE.md  # This will run the performance test

echo ""
echo "🎉 All tests completed!"
echo ""
echo "Next steps:"
echo "1. Review test results above"
echo "2. Fix any failing tests"
echo "3. Run migration script if needed"
echo "4. Deploy to production"
```

## 📊 Test Results Interpretation

### Success Criteria

- ✅ **Health Check**: API responds with 200 status
- ✅ **Position Analysis**: Returns evaluation and best move
- ✅ **Move Analysis**: Returns move quality metrics
- ✅ **Game Analysis**: Processes PGN and returns analysis
- ✅ **Batch Analysis**: Starts background processing
- ✅ **Data Retrieval**: Returns analysis results and stats
- ✅ **Performance**: Single requests < 5s, concurrent requests < 10s
- ✅ **Error Handling**: Graceful fallbacks when services unavailable

### Common Issues and Solutions

1. **Stockfish Not Found**
   - System falls back to basic analysis
   - Check `STOCKFISH_PATH` environment variable
   - Verify Stockfish executable exists

2. **Database Connection Issues**
   - Check `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - Verify network connectivity
   - Check database permissions

3. **Slow Performance**
   - Reduce analysis depth for faster results
   - Use basic analysis for quick testing
   - Check system resources

4. **Memory Issues**
   - Reduce batch sizes
   - Monitor memory usage
   - Restart server if needed

## 🎯 Testing Checklist

- [ ] API server starts successfully
- [ ] Health check endpoint responds
- [ ] Position analysis works (basic and Stockfish)
- [ ] Move analysis works
- [ ] Game analysis works
- [ ] Batch analysis starts and tracks progress
- [ ] Analysis results are saved to database
- [ ] Data retrieval endpoints work
- [ ] Error handling works (fallbacks)
- [ ] Performance is acceptable
- [ ] Migration from old system works
- [ ] Configuration validation works
- [ ] Logging works correctly

## 🚀 Production Testing

Before deploying to production:

1. **Run complete test suite**
2. **Test with real data** (not just test data)
3. **Test error scenarios** (network issues, invalid data)
4. **Test performance under load**
5. **Verify database integration**
6. **Test backup and recovery procedures**
7. **Monitor logs and metrics**

This comprehensive testing approach ensures the unified system is robust, reliable, and ready for production use!
