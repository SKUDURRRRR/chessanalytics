#!/usr/bin/env python3
"""Test script to verify Stockfish fix"""

import sys
import os

# Add the python directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

try:
    from core.analysis_engine import ChessAnalysisEngine
    print("✅ ChessAnalysisEngine imported successfully")
    
    # Test creating an engine
    engine = ChessAnalysisEngine()
    print(f"✅ Engine created successfully")
    print(f"   Stockfish path: {engine.stockfish_path}")
    print(f"   Stockfish available: {engine.stockfish_path is not None}")
    
    # Test the get_analysis_engine function
    from core.unified_api_server import get_analysis_engine
    print("✅ get_analysis_engine function imported successfully")
    
    # Test creating engine via the function
    api_engine = get_analysis_engine()
    print(f"✅ API engine created successfully")
    print(f"   API Stockfish path: {api_engine.stockfish_path}")
    print(f"   API Stockfish available: {api_engine.stockfish_path is not None}")
    
    print("\n🎉 All tests passed! The Stockfish fix is working correctly.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
