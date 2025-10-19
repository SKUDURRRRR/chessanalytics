#!/usr/bin/env python3
"""
Diagnostic script to verify Railway Hobby analysis parameters
and measure actual performance vs expected performance.
"""

import asyncio
import time
import os
import sys
from datetime import datetime

# Add the python directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'python'))

from python.core.analysis_engine import ChessAnalysisEngine, AnalysisType, AnalysisConfig
from python.core.config import get_config

# Sample 80-move PGN (similar to what user is experiencing)
SAMPLE_80_MOVE_PGN = """
[Event "Test Game"]
[Site "Test"]
[Date "2024.01.01"]
[Round "1"]
[White "TestPlayer"]
[Black "TestOpponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6
8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 c6 12. cxb5 axb5 13. Nc3 Bb7
14. Bg5 b4 15. Nb1 h6 16. Bh4 c5 17. dxe5 Nxe4 18. Bxe7 Qxe7 19. exd6 Qf6
20. Nbd2 Nxd6 21. Nc4 Nxc4 22. Bxc4 Nb6 23. Ne5 Rae8 24. Bxf7+ Rxf7
25. Nxf7 Rxe1+ 26. Qxe1 Kxf7 27. Qe3 Qg5 28. Qxg5 hxg5 29. b3 Ke6
30. a3 Kd6 31. axb4 cxb4 32. Ra5 Nd5 33. f3 Bc8 34. Kf2 Bf5 35. Ra7 g6
36. Ra6+ Kc5 37. Ke1 Nf4 38. g3 Nxh3 39. Kd2 Kb5 40. Rd6 Kc5 41. Ra6 Nf2
42. g4 Bd3 43. Re6 Ne4+ 44. fxe4 Bxe4 45. Rxg6 Bd5 46. Rg8 Kb5 47. Rb8+ Kc6
48. Rc8+ Kd7 49. Rc1 Ke6 50. Re1+ Kf6 51. Rf1+ Kg6 52. Rd1 Bc6 53. Ke3 Kh6
54. Kf4 Kg6 55. Re1 Kf6 56. Re8 Bd7 57. Rg8 Ke6 58. Rxg5 Kf6 59. Rh5 Kg6
60. Rh8 Kf6 61. Rh6+ Kg7 62. Rh1 Kf6 63. Rf1+ Ke6 64. Kg5 Ke5 65. Re1+ Kd4
66. Re7 Bc6 67. Kf6 Kd5 68. Kf7 Kd6 69. Rg7 Kd5 70. Rg6 Bd7 71. Rg7 Bc6
72. Rg5+ Kd6 73. Kf6 Bd7 74. Rg7 Bc6 75. Rg6+ Kd5 76. Kf5 Bd7+ 77. Kf4 Bc6
78. Rg5+ Kd4 79. Rxg4+ Kd3 80. Rg3+ 1-0
"""

async def test_analysis_parameters():
    """Test and verify actual analysis parameters being used."""
    print("🔍 RAILWAY HOBBY ANALYSIS DIAGNOSTICS")
    print("=" * 60)
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Check environment configuration
    print("📋 ENVIRONMENT CONFIGURATION:")
    print(f"  STOCKFISH_DEPTH: {os.getenv('STOCKFISH_DEPTH', 'NOT SET (default: 14)')}")
    print(f"  STOCKFISH_SKILL_LEVEL: {os.getenv('STOCKFISH_SKILL_LEVEL', 'NOT SET (default: 20)')}")
    print(f"  STOCKFISH_TIME_LIMIT: {os.getenv('STOCKFISH_TIME_LIMIT', 'NOT SET (default: 0.8)')}")
    print(f"  STOCKFISH_PATH: {os.getenv('STOCKFISH_PATH', 'NOT SET')}")
    print(f"  DEPLOYMENT_TIER: {os.getenv('DEPLOYMENT_TIER', 'NOT SET')}")
    print()

    # Load config
    try:
        config = get_config()
        print("✅ CONFIG LOADED:")
        print(f"  Stockfish Path: {config.stockfish.path}")
        print(f"  Depth: {config.stockfish.depth}")
        print(f"  Skill Level: {config.stockfish.skill_level}")
        print(f"  Time Limit: {config.stockfish.time_limit}s")
        print(f"  Max Concurrent: {config.stockfish.max_concurrent}")
        print()
    except Exception as e:
        print(f"❌ Failed to load config: {e}")
        print()

    # Create analysis engine
    print("🚀 CREATING ANALYSIS ENGINE...")
    try:
        engine = ChessAnalysisEngine(stockfish_path=config.stockfish.path)
        engine.config = AnalysisConfig(
            analysis_type=AnalysisType.STOCKFISH,
            depth=config.stockfish.depth,
            skill_level=config.stockfish.skill_level,
            time_limit=config.stockfish.time_limit
        )
        print(f"✅ Engine created with:")
        print(f"  Depth: {engine.config.depth}")
        print(f"  Skill Level: {engine.config.skill_level}")
        print(f"  Time Limit: {engine.config.time_limit}s")
        print(f"  Stockfish Path: {engine.stockfish_path}")
        print()
    except Exception as e:
        print(f"❌ Failed to create engine: {e}")
        return

    # Test single move analysis
    print("🧪 TEST 1: Single Move Analysis")
    print("-" * 60)
    try:
        import chess
        board = chess.Board()
        move = chess.Move.from_uci("e2e4")

        start = time.time()
        result = await engine.analyze_move(board, move, AnalysisType.STOCKFISH)
        duration = time.time() - start

        print(f"✅ Single move analyzed in {duration:.3f}s")
        print(f"  Classification: {result.classification}")
        print(f"  Centipawn Loss: {result.centipawn_loss}")
        print()

        # Theoretical calculation
        # Each move requires 2 Stockfish analyses (before & after)
        time_per_move = duration
        print(f"📊 THEORETICAL PERFORMANCE FOR 80 MOVES:")
        print(f"  Time per move (measured): {time_per_move:.3f}s")
        print(f"  Sequential (80 moves × {time_per_move:.3f}s): {80 * time_per_move:.1f}s")
        print(f"  Parallel 2x (40 batches): {40 * time_per_move:.1f}s")
        print(f"  Parallel 4x (20 batches): {20 * time_per_move:.1f}s")
        print(f"  Parallel 8x (10 batches): {10 * time_per_move:.1f}s")
        print()
    except Exception as e:
        print(f"❌ Single move test failed: {e}")
        print()

    # Test full game analysis (80 moves)
    print("🧪 TEST 2: Full Game Analysis (80 moves)")
    print("-" * 60)
    try:
        start = time.time()
        analysis = await engine.analyze_game(
            pgn=SAMPLE_80_MOVE_PGN,
            user_id="TestPlayer",
            platform="lichess",
            analysis_type=AnalysisType.STOCKFISH
        )
        duration = time.time() - start

        if analysis:
            print(f"✅ 80-move game analyzed in {duration:.1f}s ({duration/60:.2f} minutes)")
            print(f"  Total moves: {analysis.total_moves}")
            print(f"  Accuracy: {analysis.accuracy:.1f}%")
            print(f"  Blunders: {analysis.blunders}")
            print(f"  Mistakes: {analysis.mistakes}")
            print(f"  Inaccuracies: {analysis.inaccuracies}")
            print(f"  Time per move (avg): {duration / analysis.total_moves:.3f}s")
            print()

            # Performance assessment
            print("📈 PERFORMANCE ASSESSMENT:")
            if duration < 20:
                print(f"  🚀 EXCELLENT: Analysis completed in {duration:.1f}s (< 20s)")
                print("  ✅ This is faster than expected! Analysis is highly optimized.")
            elif duration < 30:
                print(f"  ⚡ GOOD: Analysis completed in {duration:.1f}s (20-30s)")
                print("  ✅ This matches the expected performance for Railway Hobby tier.")
            elif duration < 60:
                print(f"  ⚠️  ACCEPTABLE: Analysis completed in {duration:.1f}s (30-60s)")
                print("  ⚠️  This is slower than optimal but still reasonable.")
            else:
                print(f"  ❌ SLOW: Analysis took {duration:.1f}s (> 60s)")
                print("  ❌ This is significantly slower than expected.")
            print()

            # Verify actual depth and time limit used
            print("🔬 ACTUAL PARAMETERS VERIFICATION:")
            print(f"  Expected depth: {engine.config.depth}")
            print(f"  Expected time limit: {engine.config.time_limit}s")
            print(f"  Stockfish depth: {analysis.stockfish_depth}")
            print()

            # Check if analysis is using shortcuts
            if duration < 10:
                print("⚠️  WARNING: Analysis completed suspiciously fast!")
                print("   Possible issues:")
                print("   - Analysis might be using cached results")
                print("   - Stockfish might not be running at all")
                print("   - Time limit might be much lower than expected")
                print("   - Depth might be much lower than expected")
                print()

        else:
            print("❌ Game analysis failed - returned None")
            print()

    except Exception as e:
        print(f"❌ Full game test failed: {e}")
        import traceback
        traceback.print_exc()
        print()

    # Test concurrent analysis capability
    print("🧪 TEST 3: Concurrent Analysis Capability")
    print("-" * 60)
    try:
        import chess

        # Create 4 different positions to analyze concurrently
        positions = [
            (chess.Board(), chess.Move.from_uci("e2e4")),
            (chess.Board(), chess.Move.from_uci("d2d4")),
            (chess.Board(), chess.Move.from_uci("c2c4")),
            (chess.Board(), chess.Move.from_uci("g1f3")),
        ]

        start = time.time()
        tasks = [engine.analyze_move(board, move, AnalysisType.STOCKFISH)
                for board, move in positions]
        results = await asyncio.gather(*tasks)
        duration = time.time() - start

        print(f"✅ 4 moves analyzed concurrently in {duration:.3f}s")
        print(f"  Average time per move: {duration / 4:.3f}s")
        print(f"  Speedup vs sequential: {(4 * time_per_move) / duration:.2f}x")
        print()

        if duration < time_per_move * 1.5:
            print("  🚀 EXCELLENT: True parallel execution detected!")
        elif duration < time_per_move * 2.5:
            print("  ⚡ GOOD: Some parallel execution, room for optimization")
        else:
            print("  ⚠️  WARNING: Analysis appears to be running sequentially!")
        print()

    except Exception as e:
        print(f"❌ Concurrent test failed: {e}")
        print()

    # Summary and recommendations
    print("=" * 60)
    print("📊 SUMMARY AND RECOMMENDATIONS")
    print("=" * 60)
    print()

    if duration < 30:
        print("✅ Analysis is performing well for Railway Hobby tier!")
        print()
        print("Current settings are optimal:")
        print(f"  - Depth: {engine.config.depth}")
        print(f"  - Time limit: {engine.config.time_limit}s")
        print(f"  - Concurrent moves: 4 (from code)")
        print()
    else:
        print("⚠️  Analysis performance can be improved!")
        print()
        print("Recommendations:")
        print("  1. Verify Stockfish is actually running (not using fallback)")
        print("  2. Check if time_limit is being respected")
        print("  3. Verify parallel execution is working")
        print("  4. Consider optimizing Stockfish parameters:")
        print(f"     - Increase Hash to 256MB (currently 96MB)")
        print(f"     - Increase concurrent moves to 6-8 (currently 4)")
        print(f"     - Consider reducing time_limit slightly (currently {engine.config.time_limit}s)")
        print()

async def main():
    """Run diagnostics."""
    try:
        await test_analysis_parameters()
    except Exception as e:
        print(f"❌ Diagnostic failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
