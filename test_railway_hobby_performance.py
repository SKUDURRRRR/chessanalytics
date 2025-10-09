#!/usr/bin/env python3
"""
Performance testing script for Railway Hobby tier optimizations.
Tests both single game and batch analysis performance.
"""

import asyncio
import time
import os
import sys
from datetime import datetime

# Add the python directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'python'))

from python.core.analysis_engine import ChessAnalysisEngine, AnalysisType, AnalysisConfig
from python.core.parallel_analysis_engine import ParallelAnalysisEngine

# Sample PGN for testing
SAMPLE_PGN = """
[Event "Test Game"]
[Site "Test"]
[Date "2024.01.01"]
[Round "1"]
[White "TestPlayer"]
[Black "TestOpponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 c6 12. cxb5 axb5 13. Nc3 Bb7 14. Bg5 b4 15. Nb1 h6 16. Bh4 c5 17. dxe5 Nxe4 18. Bxe7 Qxe7 19. exd6 Qf6 20. Nbd2 Nxd6 21. Nc4 Nxc4 22. Bxc4 Nb6 23. Ne5 Rae8 24. Bxf7+ Rxf7 25. Nxf7 Rxe1+ 26. Qxe1 Kxf7 27. Qe3 Qg5 28. Qxg5 hxg5 29. b3 Ke6 30. a3 Kd6 31. axb4 cxb4 32. Ra5 Nd5 33. f3 Bc8 34. Kf2 Bf5 35. Ra7 g6 36. Ra6+ Kc5 37. Ke1 Nf4 38. g3 Nxh3 39. Kd2 Kb5 40. Rd6 Kc5 41. Ra6 Nf2 42. g4 Bd3 43. Re6 1-0
"""

async def test_single_game_analysis():
    """Test single game analysis performance."""
    print("🧪 Testing Single Game Analysis Performance")
    print("=" * 50)
    
    # Create analysis engine
    engine = ChessAnalysisEngine()
    engine.config = AnalysisConfig(
        analysis_type=AnalysisType.STOCKFISH,
        depth=12,
        skill_level=10
    )
    
    # Test single game analysis
    start_time = time.time()
    
    try:
        analysis = await engine.analyze_game(
            pgn=SAMPLE_PGN,
            user_id="test_user",
            platform="lichess",
            analysis_type=AnalysisType.STOCKFISH
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        if analysis:
            print(f"✅ Single game analysis completed successfully!")
            print(f"   Duration: {duration:.2f} seconds")
            print(f"   Total moves: {analysis.total_moves}")
            print(f"   Accuracy: {analysis.accuracy:.1f}%")
            print(f"   Blunders: {analysis.blunders}")
            print(f"   Mistakes: {analysis.mistakes}")
            print(f"   Inaccuracies: {analysis.inaccuracies}")
            print(f"   Processing time: {analysis.processing_time_ms}ms")
            
            # Performance assessment
            if duration < 15:
                print("🚀 EXCELLENT: Analysis completed in under 15 seconds!")
            elif duration < 30:
                print("⚡ GOOD: Analysis completed in under 30 seconds!")
            else:
                print("⚠️  SLOW: Analysis took longer than expected")
                
        else:
            print("❌ Single game analysis failed!")
            
    except Exception as e:
        print(f"❌ Error during single game analysis: {e}")
        return False
    
    return True

async def test_parallel_analysis():
    """Test parallel analysis performance."""
    print("\n🧪 Testing Parallel Analysis Performance")
    print("=" * 50)
    
    # Create parallel analysis engine
    parallel_engine = ParallelAnalysisEngine(max_workers=6)
    
    # Test parallel analysis (simulate with same PGN multiple times)
    test_games = []
    for i in range(5):  # Test with 5 games
        test_games.append({
            'id': f'test_game_{i}',
            'user_id': 'test_user',
            'platform': 'lichess',
            'pgn': SAMPLE_PGN,
            'analysis_type': 'stockfish',
            'depth': 12,
            'skill_level': 10
        })
    
    start_time = time.time()
    
    try:
        # Test parallel processing
        from python.core.parallel_analysis_engine import analyze_game_worker
        import concurrent.futures
        
        with concurrent.futures.ProcessPoolExecutor(max_workers=6) as executor:
            futures = [executor.submit(analyze_game_worker, game) for game in test_games]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        end_time = time.time()
        duration = end_time - start_time
        
        successful = [r for r in results if r['success']]
        failed = [r for r in results if not r['success']]
        
        print(f"✅ Parallel analysis completed!")
        print(f"   Duration: {duration:.2f} seconds")
        print(f"   Games analyzed: {len(successful)}/{len(test_games)}")
        print(f"   Failed: {len(failed)}")
        
        if successful:
            avg_accuracy = sum(r['analysis']['accuracy'] for r in successful) / len(successful)
            print(f"   Average accuracy: {avg_accuracy:.1f}%")
        
        # Performance assessment
        if duration < 30:
            print("🚀 EXCELLENT: 5 games analyzed in under 30 seconds!")
        elif duration < 60:
            print("⚡ GOOD: 5 games analyzed in under 1 minute!")
        else:
            print("⚠️  SLOW: Analysis took longer than expected")
            
    except Exception as e:
        print(f"❌ Error during parallel analysis: {e}")
        return False
    
    return True

async def test_memory_usage():
    """Test memory usage during analysis."""
    print("\n🧪 Testing Memory Usage")
    print("=" * 50)
    
    import psutil
    import os
    
    process = psutil.Process(os.getpid())
    initial_memory = process.memory_info().rss / 1024 / 1024  # MB
    
    print(f"Initial memory usage: {initial_memory:.1f} MB")
    
    # Run analysis
    engine = ChessAnalysisEngine()
    engine.config = AnalysisConfig(
        analysis_type=AnalysisType.STOCKFISH,
        depth=12,
        skill_level=10
    )
    
    try:
        analysis = await engine.analyze_game(
            pgn=SAMPLE_PGN,
            user_id="test_user",
            platform="lichess",
            analysis_type=AnalysisType.STOCKFISH
        )
        
        peak_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_used = peak_memory - initial_memory
        
        print(f"Peak memory usage: {peak_memory:.1f} MB")
        print(f"Memory used for analysis: {memory_used:.1f} MB")
        
        # Memory assessment
        if memory_used < 1000:  # Less than 1 GB
            print("✅ GOOD: Memory usage is reasonable")
        elif memory_used < 2000:  # Less than 2 GB
            print("⚠️  MODERATE: Memory usage is higher than expected")
        else:
            print("❌ HIGH: Memory usage is too high!")
            
    except Exception as e:
        print(f"❌ Error during memory test: {e}")
        return False
    
    return True

async def main():
    """Run all performance tests."""
    print("🚀 Railway Hobby Tier Performance Testing")
    print("=" * 60)
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Check if we're in the right environment
    deployment_tier = os.getenv('DEPLOYMENT_TIER', 'unknown')
    print(f"Current deployment tier: {deployment_tier}")
    
    if deployment_tier != 'railway_hobby':
        print("⚠️  Warning: Not running in Railway Hobby tier configuration")
        print("   Set DEPLOYMENT_TIER=railway_hobby for optimal performance")
        print()
    
    # Run tests
    tests = [
        ("Single Game Analysis", test_single_game_analysis),
        ("Parallel Analysis", test_parallel_analysis),
        ("Memory Usage", test_memory_usage)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with error: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n📊 Test Results Summary")
    print("=" * 30)
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Railway Hobby tier is working optimally!")
    else:
        print("⚠️  Some tests failed. Check the configuration and try again.")

if __name__ == "__main__":
    asyncio.run(main())
