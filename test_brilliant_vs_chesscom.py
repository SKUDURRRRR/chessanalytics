#!/usr/bin/env python3
"""
Test script to compare our brilliant move detection with Chess.com's classifications.

Usage:
1. Get a PGN from Chess.com with brilliant moves
2. Note which moves Chess.com marked as brilliant
3. Run this script to see our classifications
4. Compare results

Example:
    python test_brilliant_vs_chesscom.py game.pgn
"""

import sys
import asyncio
import json
from python.core.analysis_engine import AnalysisEngine, AnalysisType

async def test_brilliant_detection(pgn_file: str):
    """Test brilliant move detection on a Chess.com game."""

    # Read PGN file
    with open(pgn_file, 'r') as f:
        pgn = f.read()

    print("=" * 80)
    print("BRILLIANT MOVE DETECTION TEST - Chess.com Comparison")
    print("=" * 80)
    print(f"\nAnalyzing: {pgn_file}")
    print("\n" + "-" * 80)

    # Initialize analysis engine
    engine = AnalysisEngine()

    # Analyze the game
    print("\n🔍 Running analysis... (this may take a minute)")
    analysis = await engine.analyze_game(
        pgn=pgn,
        user_id="test_user",  # Will be determined from PGN
        platform="chess.com",
        analysis_type=AnalysisType.DEEP
    )

    if not analysis:
        print("❌ Failed to analyze game")
        return

    # Extract brilliant moves
    brilliant_moves = []
    for move in analysis.moves:
        if move.is_brilliant:
            brilliant_moves.append({
                'move_number': move.get('fullmove_number', '?'),
                'color': 'White' if move.get('player_color') == 'white' else 'Black',
                'san': move.move_san,
                'centipawn_loss': move.centipawn_loss,
                'explanation': move.explanation
            })

    # Display results
    print("\n" + "=" * 80)
    print("📊 RESULTS")
    print("=" * 80)

    print(f"\n✨ Total Brilliant Moves Found: {len(brilliant_moves)}")

    if brilliant_moves:
        print("\nBrilliant Moves Detected:")
        print("-" * 80)
        for i, move in enumerate(brilliant_moves, 1):
            print(f"\n{i}. Move #{move['move_number']} - {move['color']}: {move['san']}")
            print(f"   Centipawn Loss: {move['centipawn_loss']:.1f}cp")
            print(f"   Explanation: {move['explanation']}")
    else:
        print("\nNo brilliant moves detected in this game.")

    # Statistics
    total_moves = len(analysis.moves)
    brilliant_percentage = (len(brilliant_moves) / total_moves * 100) if total_moves > 0 else 0

    print("\n" + "=" * 80)
    print("📈 STATISTICS")
    print("=" * 80)
    print(f"Total Moves: {total_moves}")
    print(f"Brilliant Moves: {len(brilliant_moves)}")
    print(f"Brilliant Percentage: {brilliant_percentage:.2f}%")
    print(f"Expected Range: 0-1% (across many games)")

    # Comparison prompt
    print("\n" + "=" * 80)
    print("🔄 COMPARISON WITH CHESS.COM")
    print("=" * 80)
    print("\nTo compare with Chess.com:")
    print("1. Open this game on Chess.com")
    print("2. Look for moves marked with !! (brilliant)")
    print("3. Compare with the moves listed above")
    print("\nQuestions to check:")
    print("  ✓ Did we find the same brilliant moves?")
    print("  ✓ Did we miss any they marked?")
    print("  ✓ Did we mark any they didn't?")

    # Save detailed results
    output_file = pgn_file.replace('.pgn', '_brilliant_analysis.json')
    with open(output_file, 'w') as f:
        json.dump({
            'total_moves': total_moves,
            'brilliant_moves': brilliant_moves,
            'brilliant_percentage': brilliant_percentage,
            'all_moves': [
                {
                    'move_san': m.move_san,
                    'is_brilliant': m.is_brilliant,
                    'is_best': m.is_best,
                    'centipawn_loss': m.centipawn_loss,
                    'classification': 'brilliant' if m.is_brilliant else
                                     'best' if m.is_best else
                                     'blunder' if m.is_blunder else
                                     'mistake' if m.is_mistake else
                                     'inaccuracy' if m.is_inaccuracy else 'good'
                }
                for m in analysis.moves
            ]
        }, f, indent=2)

    print(f"\n📄 Detailed results saved to: {output_file}")
    print("\n" + "=" * 80)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python test_brilliant_vs_chesscom.py <pgn_file>")
        print("\nExample:")
        print("  python test_brilliant_vs_chesscom.py game.pgn")
        sys.exit(1)

    pgn_file = sys.argv[1]

    try:
        asyncio.run(test_brilliant_detection(pgn_file))
    except KeyboardInterrupt:
        print("\n\n❌ Analysis interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
