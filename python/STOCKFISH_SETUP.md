# Stockfish Chess Engine Setup

This document explains how Stockfish has been set up and integrated into the chess analytics project.

## Installation Summary

✅ **Stockfish Engine**: Installed via Windows Package Manager (winget)
✅ **Python Package**: `stockfish==3.28.0` installed via pip
✅ **Chess Library**: `python-chess==1.999` installed via pip
✅ **Integration**: Custom `ChessAnalysisService` class created

## Files Created

- `chess_analysis_service.py` - Main service class for chess analysis
- `test_stockfish.py` - Comprehensive test suite
- `simple_stockfish_test.py` - Basic functionality test
- `example_integration.py` - Example usage and integration demo

## Installation Details

### Stockfish Engine Binary
- **Location**: `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Stockfish.Stockfish_Microsoft.Winget.Source_8wekyb3d8bbwe\stockfish\stockfish-windows-x86-64-avx2.exe`
- **Version**: 17.1
- **Architecture**: x86-64 with AVX2 support

### Python Dependencies
```bash
pip install stockfish==3.28.0
pip install python-chess==1.999
```

## Usage Examples

### Basic Position Analysis
```python
from chess_analysis_service import ChessAnalysisService

# Initialize service
service = ChessAnalysisService()

# Analyze a position
fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
analysis = service.analyze_position(fen)
print(analysis)
```

### Move Analysis
```python
import chess
from chess_analysis_service import ChessAnalysisService

service = ChessAnalysisService()
board = chess.Board()
move = chess.Move.from_uci("e2e4")
move_analysis = service.analyze_move(board, move)
print(f"Move: {move_analysis.move}")
print(f"Evaluation: {move_analysis.evaluation}")
print(f"Is best move: {move_analysis.is_best}")
```

### Game Analysis
```python
from chess_analysis_service import ChessAnalysisService

service = ChessAnalysisService()
moves = ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]
game_analysis = service.analyze_game_from_moves(moves)

print(f"Accuracy: {game_analysis.overall_accuracy:.1f}%")
print(f"Blunders: {game_analysis.blunders}")
print(f"Mistakes: {game_analysis.mistakes}")
print(f"Best moves: {game_analysis.best_moves}")
```

## Features

### Move Quality Classification
- **Best Move**: The engine's recommended move
- **Blunder**: Loses >200 centipawns
- **Mistake**: Loses 100-200 centipawns  
- **Inaccuracy**: Loses 50-100 centipawns

### Analysis Capabilities
- Position evaluation in centipawns
- Best move suggestions
- Move quality assessment
- Game accuracy calculation
- Centipawn loss tracking
- PGN game analysis

### Configuration
- **Analysis Depth**: 12 (adjustable)
- **Skill Level**: 20 (maximum)
- **Engine**: Stockfish 17.1 with AVX2

## Testing

Run the test suite to verify installation:

```bash
# Basic functionality test
python simple_stockfish_test.py

# Comprehensive test
python test_stockfish.py

# Integration example
python example_integration.py
```

## Integration with Existing Project

The `ChessAnalysisService` class can be easily integrated with your existing chess analytics project:

1. **Import the service** in your analysis modules
2. **Initialize** with optional custom Stockfish path
3. **Analyze games** using the provided methods
4. **Export results** to your database or API

## Performance Notes

- **Analysis Speed**: ~2-5 seconds per game (depending on depth)
- **Memory Usage**: ~100MB per concurrent analysis
- **Depth Setting**: 12 provides good balance of speed vs accuracy
- **Concurrent Analysis**: Multiple games can be analyzed simultaneously

## Troubleshooting

### Stockfish Not Found
If you get "Stockfish not found" errors:
1. Verify the path in `ChessAnalysisService.__init__()`
2. Check that Stockfish is installed via winget
3. Restart your terminal/shell after installation

### Memory Issues
If you encounter memory problems:
1. Reduce the analysis depth in `ChessAnalysisService`
2. Process games in smaller batches
3. Close other applications to free memory

### Analysis Errors
If analysis fails:
1. Check that the FEN string is valid
2. Verify that moves are in UCI format
3. Ensure the game is not already finished

## Next Steps

1. **Database Integration**: Store analysis results in your Supabase database
2. **API Endpoints**: Create REST endpoints for game analysis
3. **Batch Processing**: Implement background analysis for multiple games
4. **Real-time Analysis**: Add live game analysis capabilities
5. **Advanced Features**: Implement opening book analysis, endgame tablebase integration

## Support

For issues with Stockfish integration:
1. Check the test files for working examples
2. Verify all dependencies are installed
3. Review the error messages for specific issues
4. Check the Stockfish documentation for advanced configuration
