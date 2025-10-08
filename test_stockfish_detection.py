#!/usr/bin/env python3
"""
Test script to verify Stockfish detection is working correctly.
Run this script to test the fixes locally or in production.
"""

import os
import sys

# Add python directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

print("="*60)
print("STOCKFISH DETECTION TEST")
print("="*60)

# Test 1: Check environment variable
print("\n1. Environment Variable Check:")
env_path = os.getenv("STOCKFISH_PATH")
if env_path:
    print(f"   ✅ STOCKFISH_PATH is set: {env_path}")
    if os.path.exists(env_path):
        print(f"   ✅ Path exists")
    else:
        print(f"   ⚠️  Path does not exist (might be in system PATH)")
else:
    print(f"   ℹ️  STOCKFISH_PATH not set (will use auto-detection)")

# Test 2: Config system detection
print("\n2. Config System Detection:")
try:
    from python.core.config import get_config
    config = get_config()
    if config.stockfish.path:
        print(f"   ✅ Config found Stockfish: {config.stockfish.path}")
        if os.path.exists(config.stockfish.path):
            print(f"   ✅ Path exists and is accessible")
        else:
            print(f"   ⚠️  Config path doesn't exist")
    else:
        print(f"   ❌ Config did not find Stockfish")
except Exception as e:
    print(f"   ❌ Error loading config: {e}")

# Test 3: Analysis engine detection
print("\n3. Analysis Engine Detection:")
try:
    from python.core.analysis_engine import ChessAnalysisEngine
    
    # Test with config path
    if config.stockfish.path:
        print(f"   Testing with config path: {config.stockfish.path}")
        engine = ChessAnalysisEngine(stockfish_path=config.stockfish.path)
    else:
        print(f"   Testing with auto-detection")
        engine = ChessAnalysisEngine()
    
    if engine.stockfish_path:
        print(f"   ✅ Engine has Stockfish: {engine.stockfish_path}")
    else:
        print(f"   ❌ Engine did not find Stockfish")
except Exception as e:
    print(f"   ❌ Error creating engine: {e}")
    import traceback
    traceback.print_exc()

# Test 4: Try to initialize Stockfish
print("\n4. Stockfish Initialization Test:")
if engine and engine.stockfish_path:
    try:
        import chess.engine
        print(f"   Attempting to start Stockfish at: {engine.stockfish_path}")
        with chess.engine.SimpleEngine.popen_uci(engine.stockfish_path) as sf_engine:
            print(f"   ✅ Stockfish started successfully!")
            # Try a simple analysis
            import chess
            board = chess.Board()
            result = sf_engine.analyse(board, chess.engine.Limit(time=0.1))
            score = result.get("score")
            print(f"   ✅ Analysis works! Starting position score: {score}")
    except Exception as e:
        print(f"   ❌ Failed to start Stockfish: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"   ⚠️  Skipping (no Stockfish path found)")

# Test 5: Check common paths directly
print("\n5. Direct Path Check:")
import platform
is_windows = platform.system() == "Windows"

if is_windows:
    paths_to_check = [
        os.path.join(os.path.dirname(__file__), "stockfish", "stockfish-windows-x86-64-avx2.exe"),
        "stockfish.exe",
    ]
else:
    paths_to_check = [
        "/usr/games/stockfish",
        "/usr/bin/stockfish",
        "/usr/local/bin/stockfish",
    ]

for path in paths_to_check:
    if os.path.exists(path):
        print(f"   ✅ Found: {path}")
    else:
        print(f"   ❌ Not found: {path}")

# Summary
print("\n" + "="*60)
print("SUMMARY")
print("="*60)

if engine and engine.stockfish_path and os.path.exists(engine.stockfish_path):
    print("✅ SUCCESS: Stockfish is properly detected and accessible")
    print(f"   Path: {engine.stockfish_path}")
    print("\n   You can now run analysis on your webapp!")
elif engine and engine.stockfish_path:
    print("⚠️  PARTIAL: Stockfish path found but file doesn't exist")
    print(f"   Path: {engine.stockfish_path}")
    print("\n   This might work if Stockfish is in system PATH")
else:
    print("❌ FAILURE: Stockfish not detected")
    print("\n   SOLUTIONS:")
    print("   1. Set STOCKFISH_PATH environment variable")
    print("   2. Install Stockfish to a standard location:")
    if is_windows:
        print("      - Windows: Place in stockfish/ directory")
        print("      - Or install via: winget install Stockfish.Stockfish")
    else:
        print("      - Linux: sudo apt-get install stockfish")
        print("      - Railway: Set STOCKFISH_PATH=/usr/games/stockfish")

print("="*60)

